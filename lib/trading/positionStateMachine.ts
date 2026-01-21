/**
 * 持仓状态机
 * 管理 FLAT / LONG / PAUSED 状态转换
 * Phase 1：只做多
 */

import * as fs from 'fs';
import * as path from 'path';

// 持仓状态
export type PositionState = 'FLAT' | 'LONG' | 'PAUSED';

// 状态转换原因
export interface StateTransition {
  from: PositionState;
  to: PositionState;
  reason: string;
  timestamp: number;
  signal?: {
    type: string;
    direction: string;
    confidence: number;
  };
}

// 持仓信息
export interface PositionInfo {
  state: PositionState;
  entryPrice: number;
  entryTime: number;
  positionSize: number; // 仓位比例 (0-1)
  leverage: number;
  stopLoss: number;
  trailingStop: boolean;
  pauseReason?: string;
  pauseUntil?: number;
}

// 影子空单记录
export interface ShadowShort {
  type: 'shadow_short';
  signal: {
    type: string;
    direction: string;
    confidence: number;
    timestamp: number;
  };
  entry_price: number;
  simulated_pnl: number | null;
  timestamp: string;
  checked_prices: { time: number; price: number; pnl: number }[];
}

// 配置
const STATE_MACHINE_CONFIG = {
  // 杠杆
  LEVERAGE: 2,

  // 单次仓位百分比
  POSITION_SIZE_PCT: 5,

  // 硬止损百分比
  HARD_STOP_LOSS_PCT: 4,

  // 追踪止盈
  TRAILING_STOP_ENABLED: true,
  TRAILING_STOP_TRIGGER_PCT: 2, // 盈利 2% 后启动追踪
  TRAILING_STOP_DISTANCE_PCT: 1.5, // 追踪距离 1.5%

  // 防追涨
  ANTI_CHASE_WINDOW_SEC: 60,
  ANTI_CHASE_THRESHOLD_PCT: 2,

  // bearish 平仓阈值
  // 🔧 FIX: 提高阈值，避免频繁开平仓震荡
  // 原来是 75/60，导致每5秒开平仓一次！
  CLOSE_ALL_CONFIDENCE: 90,   // 只有 90%+ 的 bearish 信号才全平
  CLOSE_HALF_CONFIDENCE: 80,  // 80-89% 半仓平仓

  // 状态文件路径
  STATE_FILE: 'position_state.json',
  SHADOW_LOG_FILE: 'shadow_shorts.jsonl',
};

/**
 * 持仓状态机
 */
class PositionStateMachine {
  private position: PositionInfo;
  private transitions: StateTransition[] = [];
  private shadowShorts: ShadowShort[] = [];
  private priceHistory: { time: number; price: number }[] = [];
  private storagePath: string;

  constructor() {
    this.storagePath = path.join(process.cwd(), 'storage');

    // 默认空仓状态
    this.position = {
      state: 'FLAT',
      entryPrice: 0,
      entryTime: 0,
      positionSize: 0,
      leverage: STATE_MACHINE_CONFIG.LEVERAGE,
      stopLoss: 0,
      trailingStop: STATE_MACHINE_CONFIG.TRAILING_STOP_ENABLED,
    };

    // 尝试从文件恢复状态
    this.loadState();
  }

  /**
   * 获取当前状态
   */
  getState(): PositionState {
    return this.position.state;
  }

  /**
   * 获取完整持仓信息
   */
  getPosition(): Readonly<PositionInfo> {
    return { ...this.position };
  }

  /**
   * 检查是否可以开多
   */
  canOpenLong(currentPrice: number, signal: { confidence: number; type: string }): {
    allowed: boolean;
    reason: string;
    positionMultiplier: number;
  } {
    // 检查状态
    if (this.position.state === 'PAUSED') {
      return {
        allowed: false,
        reason: `系统处于 PAUSED 状态: ${this.position.pauseReason}`,
        positionMultiplier: 0,
      };
    }

    if (this.position.state === 'LONG') {
      return {
        allowed: false,
        reason: '已有多仓，不加仓',
        positionMultiplier: 0,
      };
    }

    // 检查防追涨
    const antiChaseCheck = this.checkAntiChase(currentPrice);
    if (!antiChaseCheck.allowed) {
      return {
        allowed: false,
        reason: antiChaseCheck.reason,
        positionMultiplier: 0,
      };
    }

    // 基础仓位
    let positionMultiplier = 1.0;

    // EMA200 过滤（需要外部传入，这里先返回基础仓位）
    // 实际使用时由 Sentinel 结合 MarketContext 判断

    return {
      allowed: true,
      reason: `可以开多 (${signal.type}, 置信度 ${signal.confidence}%)`,
      positionMultiplier,
    };
  }

  /**
   * 检查防追涨
   */
  private checkAntiChase(currentPrice: number): { allowed: boolean; reason: string } {
    const now = Date.now();
    const windowStart = now - STATE_MACHINE_CONFIG.ANTI_CHASE_WINDOW_SEC * 1000;

    // 过滤最近 60 秒的价格
    const recentPrices = this.priceHistory.filter(p => p.time >= windowStart);

    if (recentPrices.length === 0) {
      return { allowed: true, reason: '无历史价格数据' };
    }

    // 找最低价
    const minPrice = Math.min(...recentPrices.map(p => p.price));
    const pumpPct = ((currentPrice - minPrice) / minPrice) * 100;

    if (pumpPct >= STATE_MACHINE_CONFIG.ANTI_CHASE_THRESHOLD_PCT) {
      return {
        allowed: false,
        reason: `防追涨: 过去 ${STATE_MACHINE_CONFIG.ANTI_CHASE_WINDOW_SEC}s 内上涨 ${pumpPct.toFixed(2)}% > ${STATE_MACHINE_CONFIG.ANTI_CHASE_THRESHOLD_PCT}%，等回踩`,
      };
    }

    return { allowed: true, reason: '防追涨检查通过' };
  }

  /**
   * 开多
   */
  openLong(price: number, signal: { type: string; confidence: number }): void {
    if (this.position.state !== 'FLAT') {
      console.log(`[StateMachine] ⚠️ 无法开多，当前状态: ${this.position.state}`);
      return;
    }

    const stopLoss = price * (1 - STATE_MACHINE_CONFIG.HARD_STOP_LOSS_PCT / 100);

    this.transition('LONG', `开多信号 (${signal.type}, 置信度 ${signal.confidence}%)`, {
      type: signal.type,
      direction: 'LONG',
      confidence: signal.confidence,
    });

    this.position.entryPrice = price;
    this.position.entryTime = Date.now();
    this.position.positionSize = STATE_MACHINE_CONFIG.POSITION_SIZE_PCT / 100;
    this.position.leverage = STATE_MACHINE_CONFIG.LEVERAGE;
    this.position.stopLoss = stopLoss;
    this.position.trailingStop = STATE_MACHINE_CONFIG.TRAILING_STOP_ENABLED;

    console.log(`[StateMachine] 📈 开多: 入场价 ${price}, 止损 ${stopLoss.toFixed(6)}`);
    this.saveState();
  }

  /**
   * 处理 bearish 信号
   */
  handleBearishSignal(
    currentPrice: number,
    signal: { type: string; confidence: number; isDualSignal?: boolean }
  ): {
    action: 'CLOSE_ALL' | 'CLOSE_HALF' | 'TIGHTEN_STOP' | 'NONE';
    reason: string;
  } {
    // 如果是空仓或已暂停，只记录影子空单
    if (this.position.state !== 'LONG') {
      this.recordShadowShort(currentPrice, signal);
      return { action: 'NONE', reason: `当前状态 ${this.position.state}，仅记录影子空单` };
    }

    const confidence = signal.confidence;
    const isDualSignal = signal.isDualSignal || false;

    // 置信度 ≥ 75% 或双信号 → 全平
    if (confidence >= STATE_MACHINE_CONFIG.CLOSE_ALL_CONFIDENCE || isDualSignal) {
      const reason = isDualSignal
        ? `冰山+K神双信号，全平`
        : `bearish 置信度 ${confidence}% ≥ ${STATE_MACHINE_CONFIG.CLOSE_ALL_CONFIDENCE}%，全平`;

      this.closeLong(currentPrice, reason);
      return { action: 'CLOSE_ALL', reason };
    }

    // 置信度 60-74% → 平仓 50%，收紧止损
    if (confidence >= STATE_MACHINE_CONFIG.CLOSE_HALF_CONFIDENCE) {
      const reason = `bearish 置信度 ${confidence}%，平仓 50%，收紧止损至入场价`;

      // 减半仓位
      this.position.positionSize *= 0.5;

      // 收紧止损到入场价（保本止损）
      this.position.stopLoss = this.position.entryPrice;

      console.log(`[StateMachine] ⚠️ ${reason}`);
      this.saveState();

      return { action: 'CLOSE_HALF', reason };
    }

    // 置信度 < 60% → 不操作，只记录
    console.log(`[StateMachine] 📝 bearish 置信度 ${confidence}% < ${STATE_MACHINE_CONFIG.CLOSE_HALF_CONFIDENCE}%，仅记录`);
    this.recordShadowShort(currentPrice, signal);

    return { action: 'NONE', reason: `bearish 置信度 ${confidence}% 过低，仅记录` };
  }

  /**
   * 平多
   */
  closeLong(price: number, reason: string): void {
    if (this.position.state !== 'LONG') {
      console.log(`[StateMachine] ⚠️ 无法平多，当前状态: ${this.position.state}`);
      return;
    }

    const pnlPct = ((price - this.position.entryPrice) / this.position.entryPrice) * 100;

    this.transition('FLAT', reason, undefined);

    console.log(`[StateMachine] 📉 平多: 平仓价 ${price}, 盈亏 ${pnlPct.toFixed(2)}%`);

    // 重置持仓信息
    this.position.entryPrice = 0;
    this.position.entryTime = 0;
    this.position.positionSize = 0;
    this.position.stopLoss = 0;

    this.saveState();
  }

  /**
   * 检查止损
   */
  checkStopLoss(currentPrice: number): { triggered: boolean; reason: string } {
    if (this.position.state !== 'LONG') {
      return { triggered: false, reason: '无持仓' };
    }

    // 检查硬止损
    if (currentPrice <= this.position.stopLoss) {
      return {
        triggered: true,
        reason: `触发止损: 当前价 ${currentPrice} ≤ 止损价 ${this.position.stopLoss}`,
      };
    }

    // 更新追踪止损
    if (this.position.trailingStop) {
      const profitPct = ((currentPrice - this.position.entryPrice) / this.position.entryPrice) * 100;

      // 盈利超过阈值后启动追踪
      if (profitPct >= STATE_MACHINE_CONFIG.TRAILING_STOP_TRIGGER_PCT) {
        const trailingStop = currentPrice * (1 - STATE_MACHINE_CONFIG.TRAILING_STOP_DISTANCE_PCT / 100);

        // 只上移不下移
        if (trailingStop > this.position.stopLoss) {
          this.position.stopLoss = trailingStop;
          console.log(`[StateMachine] 📊 追踪止损上移至 ${trailingStop.toFixed(6)}`);
          this.saveState();
        }
      }
    }

    return { triggered: false, reason: '未触发止损' };
  }

  /**
   * 暂停（熔断）
   */
  pause(reason: string, durationMs?: number): void {
    this.transition('PAUSED', reason, undefined);
    this.position.pauseReason = reason;

    if (durationMs) {
      this.position.pauseUntil = Date.now() + durationMs;
    }

    console.log(`[StateMachine] 🛑 系统暂停: ${reason}`);
    this.saveState();
  }

  /**
   * 恢复
   */
  resume(): void {
    if (this.position.state !== 'PAUSED') {
      return;
    }

    // 恢复到 FLAT 状态（如果有仓位应该已经平掉了）
    this.transition('FLAT', '系统恢复', undefined);
    this.position.pauseReason = undefined;
    this.position.pauseUntil = undefined;

    console.log(`[StateMachine] ✅ 系统恢复`);
    this.saveState();
  }

  /**
   * 强制重置为 FLAT 状态
   * 用于手动修复状态不同步问题
   */
  reset(reason: string = '手动重置'): void {
    console.log(`[StateMachine] 🔄 重置状态: ${this.position.state} → FLAT (${reason})`);

    this.transition('FLAT', reason, undefined);
    this.position.entryPrice = 0;
    this.position.entryTime = 0;
    this.position.positionSize = 0;
    this.position.stopLoss = 0;
    this.position.pauseReason = undefined;
    this.position.pauseUntil = undefined;

    this.saveState();
    console.log(`[StateMachine] ✅ 已重置为 FLAT`);
  }

  /**
   * 与实际仓位同步
   * @param actualPositionCount - OKX 实际持仓数量
   * @param actualPositionSide - OKX 实际持仓方向 (long/short/undefined)
   */
  syncWithActualPositions(
    actualPositionCount: number,
    actualPositionSide?: 'long' | 'short'
  ): void {
    const currentState = this.position.state;

    console.log(`[StateMachine] 🔄 同步检查: 状态机=${currentState}, OKX仓位=${actualPositionCount} (${actualPositionSide || 'none'})`);

    // Case 1: 状态机认为有仓位，但 OKX 没有
    if (currentState === 'LONG' && actualPositionCount === 0) {
      console.log(`[StateMachine] ⚠️ 状态不同步! 状态机=LONG, OKX=空仓`);
      this.reset('与 OKX 同步: 实际无仓位');
      return;
    }

    // Case 2: 状态机认为空仓，但 OKX 有多仓
    if (currentState === 'FLAT' && actualPositionCount > 0 && actualPositionSide === 'long') {
      console.log(`[StateMachine] ⚠️ 状态不同步! 状态机=FLAT, OKX=有多仓`);
      // 更新状态机为 LONG（但我们不知道入场价等信息）
      this.transition('LONG', '与 OKX 同步: 发现已有多仓', undefined);
      this.position.entryPrice = 0; // 未知
      this.position.entryTime = Date.now();
      this.saveState();
      return;
    }

    // Case 3: 状态一致
    console.log(`[StateMachine] ✅ 状态同步正常`);
  }

  /**
   * 记录影子空单
   */
  private recordShadowShort(price: number, signal: { type: string; confidence: number }): void {
    const shadowShort: ShadowShort = {
      type: 'shadow_short',
      signal: {
        type: signal.type,
        direction: 'SHORT',
        confidence: signal.confidence,
        timestamp: Date.now(),
      },
      entry_price: price,
      simulated_pnl: null,
      timestamp: new Date().toISOString(),
      checked_prices: [],
    };

    this.shadowShorts.push(shadowShort);

    console.log(`[StateMachine] 👻 记录影子空单: 价格 ${price}, 置信度 ${signal.confidence}%`);

    // 写入日志文件
    this.appendShadowLog(shadowShort);
  }

  /**
   * 更新价格（用于防追涨和影子空单计算）
   */
  updatePrice(price: number): void {
    const now = Date.now();

    // 添加新价格
    this.priceHistory.push({ time: now, price });

    // 清理 5 分钟前的价格
    const fiveMinAgo = now - 5 * 60 * 1000;
    this.priceHistory = this.priceHistory.filter(p => p.time >= fiveMinAgo);

    // 更新影子空单的模拟盈亏
    this.updateShadowShortPnL(price);
  }

  /**
   * 更新影子空单盈亏
   */
  private updateShadowShortPnL(currentPrice: number): void {
    const now = Date.now();

    for (const shadow of this.shadowShorts) {
      // 只计算最近 1 小时内的影子空单
      if (now - shadow.signal.timestamp > 60 * 60 * 1000) {
        continue;
      }

      // 计算模拟盈亏（做空盈亏 = 入场价 - 当前价）
      const pnlPct = ((shadow.entry_price - currentPrice) / shadow.entry_price) * 100;
      shadow.simulated_pnl = pnlPct;

      // 记录价格点
      shadow.checked_prices.push({
        time: now,
        price: currentPrice,
        pnl: pnlPct,
      });

      // 只保留最近 10 个价格点
      if (shadow.checked_prices.length > 10) {
        shadow.checked_prices = shadow.checked_prices.slice(-10);
      }
    }
  }

  /**
   * 获取影子空单统计
   */
  getShadowShortStats(): {
    count: number;
    profitableCount: number;
    totalPnL: number;
    avgPnL: number;
  } {
    const recentShorts = this.shadowShorts.filter(
      s => s.simulated_pnl !== null && Date.now() - s.signal.timestamp < 24 * 60 * 60 * 1000
    );

    if (recentShorts.length === 0) {
      return { count: 0, profitableCount: 0, totalPnL: 0, avgPnL: 0 };
    }

    const profitableCount = recentShorts.filter(s => (s.simulated_pnl ?? 0) > 0).length;
    const totalPnL = recentShorts.reduce((sum, s) => sum + (s.simulated_pnl ?? 0), 0);

    return {
      count: recentShorts.length,
      profitableCount,
      totalPnL,
      avgPnL: totalPnL / recentShorts.length,
    };
  }

  /**
   * 状态转换
   */
  private transition(
    to: PositionState,
    reason: string,
    signal?: { type: string; direction: string; confidence: number }
  ): void {
    const transition: StateTransition = {
      from: this.position.state,
      to,
      reason,
      timestamp: Date.now(),
      signal,
    };

    this.transitions.push(transition);
    this.position.state = to;

    console.log(`[StateMachine] 状态转换: ${transition.from} → ${transition.to} (${reason})`);
  }

  /**
   * 保存状态到文件
   */
  private saveState(): void {
    try {
      if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(this.storagePath, { recursive: true });
      }

      const stateFile = path.join(this.storagePath, STATE_MACHINE_CONFIG.STATE_FILE);
      const state = {
        position: this.position,
        transitions: this.transitions.slice(-100), // 保留最近 100 条
        updatedAt: new Date().toISOString(),
      };

      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('[StateMachine] 保存状态失败:', error);
    }
  }

  /**
   * 从文件加载状态
   */
  private loadState(): void {
    try {
      const stateFile = path.join(this.storagePath, STATE_MACHINE_CONFIG.STATE_FILE);

      if (fs.existsSync(stateFile)) {
        const data = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        this.position = data.position;
        this.transitions = data.transitions || [];
        console.log(`[StateMachine] ✅ 状态已恢复: ${this.position.state}`);
      }
    } catch (error) {
      console.error('[StateMachine] 加载状态失败:', error);
    }
  }

  /**
   * 追加影子空单日志
   */
  private appendShadowLog(shadow: ShadowShort): void {
    try {
      if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(this.storagePath, { recursive: true });
      }

      const logFile = path.join(this.storagePath, STATE_MACHINE_CONFIG.SHADOW_LOG_FILE);
      fs.appendFileSync(logFile, JSON.stringify(shadow) + '\n');
    } catch (error) {
      console.error('[StateMachine] 写入影子空单日志失败:', error);
    }
  }

  /**
   * 获取状态摘要
   */
  getSummary(): string {
    const pos = this.position;
    const shadowStats = this.getShadowShortStats();

    if (pos.state === 'FLAT') {
      return `[状态:FLAT|影子空单:${shadowStats.count}笔,胜率${shadowStats.count > 0 ? ((shadowStats.profitableCount / shadowStats.count) * 100).toFixed(0) : 0}%]`;
    }

    if (pos.state === 'LONG') {
      return `[状态:LONG|入场:${pos.entryPrice}|止损:${pos.stopLoss.toFixed(6)}|杠杆:${pos.leverage}x]`;
    }

    return `[状态:PAUSED|原因:${pos.pauseReason}]`;
  }
}

// 单例
let stateMachineInstance: PositionStateMachine | null = null;

export function getPositionStateMachine(): PositionStateMachine {
  if (!stateMachineInstance) {
    stateMachineInstance = new PositionStateMachine();
  }
  return stateMachineInstance;
}

export { PositionStateMachine, STATE_MACHINE_CONFIG };
