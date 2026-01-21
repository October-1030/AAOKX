/**
 * RealtimeTradingManager 实时交易管理器
 * 整合 Strategist、Sentinel 和 MarketContext
 * 替代原有的 3 分钟轮询机制
 */

import * as fs from 'fs';
import * as path from 'path';
import { getMarketContext } from '../market/marketContext';
import { getStrategist } from '../market/strategist';
import { getSentinel, TradeDecision } from '../signals/sentinel';
import { getTradingEngine } from '../tradingEngineManager';
import { getPositionStateMachine } from './positionStateMachine';
import { getOKXClient } from '../okxClient';

// 🔧 状态持久化文件路径
const REALTIME_STATE_FILE = path.join(process.cwd(), 'storage', 'realtime_trading_state.json');

// 运行状态
interface TradingManagerStatus {
  isRunning: boolean;
  strategistLastRun: number;
  sentinelActive: boolean;
  tradesExecuted: number;
  lastTradeTime: number;
  startedAt: number;
  errors: string[];
}

// 止损检查配置
const STOP_LOSS_CONFIG = {
  CHECK_INTERVAL_MS: 5000,      // 每 5 秒检查一次
  HARD_STOP_LOSS_PCT: 4,        // 硬止损 4%
  TRAILING_TRIGGER_PCT: 2,      // 盈利 2% 启动追踪
  TRAILING_DISTANCE_PCT: 1.5,   // 追踪距离 1.5%
};

/**
 * 实时交易管理器
 */
class RealtimeTradingManager {
  private status: TradingManagerStatus = {
    isRunning: false,
    strategistLastRun: 0,
    sentinelActive: false,
    tradesExecuted: 0,
    lastTradeTime: 0,
    startedAt: 0,
    errors: [],
  };

  private autoRestoreAttempted: boolean = false;

  // 🔧 止损检查相关
  private stopLossCheckInterval: NodeJS.Timeout | null = null;
  private highestProfitPct: number = 0;  // 追踪止盈：记录最高盈利
  private trailingStopActive: boolean = false;  // 追踪止盈是否激活

  constructor() {
    // 🔧 FIX: 检查是否需要自动恢复
    this.checkAndAutoRestore();
  }

  /**
   * 🔧 检查并自动恢复交易状态
   */
  private async checkAndAutoRestore(): Promise<void> {
    if (this.autoRestoreAttempted) return;
    this.autoRestoreAttempted = true;

    try {
      if (!fs.existsSync(REALTIME_STATE_FILE)) return;

      const data = JSON.parse(fs.readFileSync(REALTIME_STATE_FILE, 'utf-8'));
      const wasRunning = data.isRunning;
      const startedAt = data.startedAt || 0;
      const isRecent = Date.now() - startedAt < 24 * 60 * 60 * 1000; // 24小时内

      if (wasRunning && isRecent) {
        console.log('[RealtimeTradingManager] 🔄 检测到之前的运行状态，自动恢复...');
        // 延迟启动，等待其他模块初始化
        setTimeout(async () => {
          try {
            const result = await this.start();
            if (result.success) {
              console.log('[RealtimeTradingManager] ✅ 自动恢复成功');
            } else {
              console.log('[RealtimeTradingManager] ⚠️ 自动恢复失败:', result.message);
            }
          } catch (e) {
            console.error('[RealtimeTradingManager] ❌ 自动恢复异常:', e);
          }
        }, 3000);
      }
    } catch (e) {
      console.error('[RealtimeTradingManager] ⚠️ 读取状态文件失败:', e);
    }
  }

  /**
   * 🔧 保存状态到文件
   */
  private saveState(): void {
    try {
      const dir = path.dirname(REALTIME_STATE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const state = {
        isRunning: this.status.isRunning,
        startedAt: this.status.startedAt,
        tradesExecuted: this.status.tradesExecuted,
        savedAt: new Date().toISOString(),
      };

      fs.writeFileSync(REALTIME_STATE_FILE, JSON.stringify(state, null, 2));
      console.log('[RealtimeTradingManager] 💾 状态已保存');
    } catch (e) {
      console.error('[RealtimeTradingManager] ⚠️ 保存状态失败:', e);
    }
  }

  /**
   * 🔧 FIX: 同步仓位状态机与 OKX 实际仓位
   * 解决状态机与实际仓位不同步导致无法下单的问题
   */
  private async syncPositionState(): Promise<void> {
    try {
      const stateMachine = getPositionStateMachine();
      const okxClient = getOKXClient();

      if (!okxClient.isAvailable()) {
        console.log('[RealtimeTradingManager] ⚠️ OKX 客户端未初始化，跳过仓位同步');
        return;
      }

      // 获取 OKX 实际仓位
      const positions = await okxClient.getPositions();
      console.log(`[RealtimeTradingManager] 📊 OKX 实际仓位: ${positions.length} 个`);

      // 查找 DOGE 相关仓位
      const dogePositions = positions.filter((p: any) =>
        p.instId?.includes('DOGE') && Math.abs(parseFloat(p.pos || '0')) > 0
      );

      let actualPositionCount = dogePositions.length;
      let actualPositionSide: 'long' | 'short' | undefined;

      if (dogePositions.length > 0) {
        const pos = dogePositions[0];
        const posAmt = parseFloat(pos.pos || '0');
        actualPositionSide = posAmt > 0 ? 'long' : 'short';
        console.log(`[RealtimeTradingManager] 📊 DOGE 仓位: ${posAmt} (${actualPositionSide})`);
      } else {
        console.log(`[RealtimeTradingManager] 📊 DOGE 无仓位`);
      }

      // 同步状态机
      stateMachine.syncWithActualPositions(actualPositionCount, actualPositionSide);
    } catch (error) {
      console.error('[RealtimeTradingManager] ❌ 仓位同步失败:', error);
      // 同步失败时，强制重置为 FLAT（安全起见）
      const stateMachine = getPositionStateMachine();
      if (stateMachine.getState() === 'LONG') {
        console.log('[RealtimeTradingManager] ⚠️ 同步失败但状态为 LONG，为安全起见重置为 FLAT');
        stateMachine.reset('OKX 同步失败，强制重置');
      }
    }
  }

  /**
   * 启动实时交易系统
   */
  async start(): Promise<{ success: boolean; message: string }> {
    console.log('\n' + '▓'.repeat(60));
    console.log('[RealtimeTradingManager] 🚀 收到启动请求');
    console.log('▓'.repeat(60));

    if (this.status.isRunning) {
      console.log('[RealtimeTradingManager] ⚠️ 系统已在运行，跳过');
      return { success: false, message: '实时交易系统已经在运行' };
    }

    console.log('[RealtimeTradingManager] 📋 开始启动流程...');

    try {
      // 1. 初始化 MarketContext（运行一次 Strategist）
      console.log('[RealtimeTradingManager] 📊 步骤 1/5: 初始化 MarketContext...');
      console.log('[RealtimeTradingManager]    获取 Strategist 实例...');
      const strategist = getStrategist();
      console.log('[RealtimeTradingManager]    运行 Strategist.runOnce()...');
      await strategist.runOnce();
      this.status.strategistLastRun = Date.now();
      console.log('[RealtimeTradingManager] ✅ 步骤 1/5 完成: MarketContext 初始化成功');

      // 2. 启动 Strategist 定时任务（每 15 分钟）
      console.log('[RealtimeTradingManager] 📊 步骤 2/5: 启动 Strategist 定时任务...');
      strategist.start();
      console.log('[RealtimeTradingManager] ✅ 步骤 2/5 完成: Strategist 定时任务已启动');

      // 3. 🔧 FIX: 同步状态机与 OKX 实际仓位
      console.log('[RealtimeTradingManager] 📊 步骤 3/5: 同步仓位状态机...');
      await this.syncPositionState();
      console.log('[RealtimeTradingManager] ✅ 步骤 3/5 完成: 仓位状态同步成功');

      // 4. 启动 Sentinel 实时监听
      console.log('[RealtimeTradingManager] 📊 步骤 4/5: 启动 Sentinel 实时监听...');
      const sentinel = getSentinel();
      console.log('[RealtimeTradingManager]    调用 sentinel.start()...');
      sentinel.start(this.handleTradeDecision.bind(this));
      this.status.sentinelActive = true;
      console.log('[RealtimeTradingManager] ✅ 步骤 4/5 完成: Sentinel 已启动');

      // 5. 🔧 启动止损检查定时器
      console.log('[RealtimeTradingManager] 📊 步骤 5/5: 启动止损监控...');
      this.startStopLossMonitor();
      console.log('[RealtimeTradingManager] ✅ 步骤 5/5 完成: 止损监控已启动 (每 5 秒检查)');

      // 更新状态
      this.status.isRunning = true;
      this.status.startedAt = Date.now();
      this.status.errors = [];

      const ctx = getMarketContext();
      console.log('\n' + '═'.repeat(60));
      console.log('[RealtimeTradingManager] ✅ 实时交易系统启动完成！');
      console.log('═'.repeat(60));
      console.log(`[RealtimeTradingManager] 📊 当前市场状态: ${ctx.getSummary()}`);

      // 🔧 FIX: 保存状态到文件
      this.saveState();

      return {
        success: true,
        message: `实时交易系统已启动\n${ctx.getSummary()}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.status.errors.push(errorMsg);
      console.error('[RealtimeTradingManager] ❌ 启动失败:', errorMsg);
      return { success: false, message: `启动失败: ${errorMsg}` };
    }
  }

  /**
   * 停止实时交易系统
   * 🔧 FIX: 即使 isRunning 是 false，也尝试停止 Sentinel（防止状态不同步）
   */
  stop(): { success: boolean; message: string } {
    const sentinel = getSentinel();
    const strategist = getStrategist();
    const sentinelWasRunning = sentinel.isActive();

    // 🔧 FIX: 即使 status.isRunning 是 false，也要检查 Sentinel 是否实际在运行
    if (!this.status.isRunning && !sentinelWasRunning) {
      return { success: false, message: '实时交易系统未在运行' };
    }

    console.log('[RealtimeTradingManager] 🛑 停止实时交易系统...');
    console.log(`[RealtimeTradingManager] 📊 当前状态: isRunning=${this.status.isRunning}, sentinelActive=${sentinelWasRunning}`);

    try {
      // 停止 Strategist
      strategist.stop();

      // 停止 Sentinel
      sentinel.stop();

      // 🔧 停止止损监控
      this.stopStopLossMonitor();

      // 更新状态
      this.status.isRunning = false;
      this.status.sentinelActive = false;

      // 🔧 FIX: 保存状态到文件
      this.saveState();

      console.log('[RealtimeTradingManager] ✅ 实时交易系统已停止');

      return {
        success: true,
        message: `实时交易系统已停止\n共执行 ${this.status.tradesExecuted} 笔交易`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[RealtimeTradingManager] ❌ 停止失败:', errorMsg);
      return { success: false, message: `停止失败: ${errorMsg}` };
    }
  }

  /**
   * 处理交易决策（由 Sentinel 触发）
   * Phase 1：只做多，支持 OPEN_LONG / CLOSE_ALL / CLOSE_HALF
   */
  private async handleTradeDecision(decision: TradeDecision): Promise<void> {
    const action = decision.action || 'NONE';

    console.log('[RealtimeTradingManager] 📥 收到交易决策');
    console.log(`  动作: ${action}`);
    console.log(`  方向: ${decision.direction}`);
    console.log(`  仓位比例: ${(decision.positionMultiplier * 100).toFixed(0)}%`);
    console.log(`  杠杆: ${decision.leverage}x`);
    console.log(`  原因: ${decision.reason}`);

    try {
      // 获取 MarketContext 进行最终确认
      const ctx = getMarketContext();

      // 根据动作类型处理
      switch (action) {
        case 'OPEN_LONG':
          // 开多前再次确认
          if (!ctx.canTrade()) {
            console.log('[RealtimeTradingManager] ⚠️ MarketContext 禁止交易，跳过开多');
            return;
          }
          await this.executeOpenLong(decision);
          break;

        case 'CLOSE_ALL':
          console.log('[RealtimeTradingManager] 🔴 执行全平...');
          await this.executeCloseLong(decision, 1.0);
          break;

        case 'CLOSE_HALF':
          console.log('[RealtimeTradingManager] 🟡 执行平仓 50%...');
          await this.executeCloseLong(decision, 0.5);
          break;

        case 'TIGHTEN_STOP':
          console.log('[RealtimeTradingManager] 📊 收紧止损...');
          // 止损调整由状态机自动处理
          break;

        default:
          console.log(`[RealtimeTradingManager] ⏭️ 无需操作: ${action}`);
          return;
      }

      // 更新统计
      this.status.tradesExecuted++;
      this.status.lastTradeTime = Date.now();

      console.log('[RealtimeTradingManager] ✅ 交易决策处理完成');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.status.errors.push(`交易执行失败: ${errorMsg}`);
      console.error('[RealtimeTradingManager] ❌ 交易执行失败:', errorMsg);
    }
  }

  /**
   * 执行开多
   */
  private async executeOpenLong(decision: TradeDecision): Promise<void> {
    const stateMachine = getPositionStateMachine();
    const ctx = getMarketContext();

    // v1.3: 使用 Sentinel 计算的仓位百分比
    const adjustedPositionPct = decision.positionPct || (3 * decision.positionMultiplier);

    console.log(`[RealtimeTradingManager] 📈 开多:`);
    console.log(`  信号类型: ${decision.signal.type}`);
    console.log(`  信号置信度: ${decision.signal.confidence}%`);
    console.log(`  确认比: ${decision.signal.confirmRatio?.toFixed(2) || 'N/A'}`);
    console.log(`  K神状态: ${decision.signal.kGodStatus || 'normal'}`);
    console.log(`  K神降档: ${decision.kGodDowngrade ? '是' : '否'}`);
    console.log(`  入场价: ${decision.signal.price}`);
    console.log(`  仓位: ${adjustedPositionPct.toFixed(2)}%`);
    console.log(`  杠杆: ${decision.leverage}x`);

    // 通知状态机开仓
    stateMachine.openLong(decision.signal.price, {
      type: decision.signal.type,
      confidence: decision.signal.confidence,
    });

    // v1.4: 通知 Sentinel 记录开仓时间（用于反抖动保护）
    const sentinel = getSentinel();
    sentinel.recordOpenTime();

    // 🔧 重置追踪止盈状态
    this.highestProfitPct = 0;
    this.trailingStopActive = false;

    // 🔧 FIX: 调用 OKX 下单 API
    await this.executeTradeWithEngine({
      symbol: 'DOGE-USDT-SWAP',
      direction: 'LONG',
      leverage: decision.leverage,
      positionMultiplier: decision.positionMultiplier,
      positionPct: adjustedPositionPct, // v1.3: 传递计算好的仓位百分比
      reason: decision.reason,
      signalType: decision.signal.type,
      signalConfidence: decision.signal.confidence,
      signalPrice: decision.signal.price,
    });
  }

  /**
   * 执行平多
   */
  private async executeCloseLong(decision: TradeDecision, closeRatio: number): Promise<void> {
    const stateMachine = getPositionStateMachine();
    const position = stateMachine.getPosition();

    if (position.state !== 'LONG') {
      console.log('[RealtimeTradingManager] ⚠️ 无持仓可平');
      return;
    }

    console.log(`[RealtimeTradingManager] 📉 平多:`);
    console.log(`  平仓比例: ${(closeRatio * 100).toFixed(0)}%`);
    console.log(`  入场价: ${position.entryPrice}`);
    console.log(`  当前价: ${decision.signal.price}`);
    console.log(`  原因: ${decision.reason}`);

    // 计算盈亏
    const pnlPct = ((decision.signal.price - position.entryPrice) / position.entryPrice) * 100;
    console.log(`  预计盈亏: ${pnlPct.toFixed(2)}%`);

    const okxClient = getOKXClient();

    console.log(`\n${'='.repeat(50)}`);
    console.log(`[ORDER] 🔴 准备平仓`);
    console.log(`${'='.repeat(50)}`);

    try {
      if (closeRatio >= 1.0) {
        // 全平
        console.log(`[ORDER] 📡 调用 OKX API 全平...`);
        const closeResult = await okxClient.closePosition('DOGE');
        console.log(`[ORDER] 📥 OKX 返回:`, JSON.stringify(closeResult, null, 2));
        stateMachine.closeLong(decision.signal.price, decision.reason);
        console.log(`[ORDER] ✅ 全平成功！`);
      } else {
        // 部分平仓
        const closePercentage = closeRatio * 100;
        console.log(`[ORDER] 📡 调用 OKX API 部分平仓 ${closePercentage}%...`);
        const closeResult = await okxClient.partialClosePosition('DOGE', closePercentage);
        console.log(`[ORDER] 📥 OKX 返回:`, JSON.stringify(closeResult, null, 2));
        console.log(`[ORDER] ✅ 部分平仓 ${closePercentage}% 成功！`);
      }
      console.log(`${'='.repeat(50)}\n`);
    } catch (error) {
      console.error(`[ORDER] ❌ 平仓失败:`, error);
      console.log(`${'='.repeat(50)}\n`);
      throw error;
    }
  }

  /**
   * 🔧 FIX: 真正执行 OKX 下单
   */
  private async executeTradeWithEngine(request: {
    symbol: string;
    direction: 'LONG' | 'SHORT' | 'NEUTRAL';
    leverage: number;
    positionMultiplier: number;
    positionPct?: number; // v1.3: Sentinel 计算的仓位百分比
    reason: string;
    signalType: string;
    signalConfidence: number;
    signalPrice: number;
  }): Promise<void> {
    const okxClient = getOKXClient();
    const ctx = getMarketContext();

    // 🔧 FIX: 使用 Sentinel 传入的仓位百分比，或者计算
    let positionCapPct = request.positionPct || (ctx.getPositionCapPct() * request.positionMultiplier);

    // 🔧 v1.4 安全检查：硬性仓位上限
    const MAX_POSITION_PCT = 10; // 最大 10%
    if (positionCapPct > MAX_POSITION_PCT) {
      console.warn(`[ORDER] ⚠️ 仓位比例 ${positionCapPct.toFixed(2)}% 超过上限 ${MAX_POSITION_PCT}%，强制限制`);
      positionCapPct = MAX_POSITION_PCT;
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`[ORDER] 🚀 准备下单`);
    console.log(`${'='.repeat(50)}`);
    console.log(`[ORDER] 📊 交易参数:`);
    console.log(`  币种: DOGE`);
    console.log(`  方向: ${request.direction}`);
    console.log(`  杠杆: ${request.leverage}x`);
    console.log(`  仓位比例: ${positionCapPct.toFixed(2)}% (上限: ${MAX_POSITION_PCT}%)`);
    console.log(`  信号类型: ${request.signalType}`);
    console.log(`  信号置信度: ${request.signalConfidence}%`);
    console.log(`  参考价格: ${request.signalPrice}`);
    console.log(`  原因: ${request.reason}`);

    // 检查 OKX 客户端是否可用
    if (!okxClient.isAvailable()) {
      console.error(`[ORDER] ❌ OKX 客户端未初始化！`);
      throw new Error('OKX 客户端未初始化');
    }

    // 获取账户余额计算下单金额
    const accountInfo = await okxClient.getAccountInfo();
    const totalEquity = parseFloat(accountInfo.totalEq || '0');
    console.log(`[ORDER] 💰 账户总权益: $${totalEquity.toFixed(2)}`);

    // 计算下单金额（USD）
    const orderSizeUSD = totalEquity * (positionCapPct / 100);
    console.log(`[ORDER] 💵 计算下单金额: $${orderSizeUSD.toFixed(2)}`);

    // 🔧 v1.4 安全检查：最大下单金额（双重保护）
    let finalOrderSizeUSD = orderSizeUSD;
    const MAX_ORDER_SIZE_USD = 50; // 最大 $50
    if (finalOrderSizeUSD > MAX_ORDER_SIZE_USD) {
      console.warn(`[ORDER] ⚠️ 下单金额 $${finalOrderSizeUSD.toFixed(2)} 超过上限 $${MAX_ORDER_SIZE_USD}，强制限制！`);
      finalOrderSizeUSD = MAX_ORDER_SIZE_USD;
    }

    // 最小下单金额检查
    if (finalOrderSizeUSD < 5) {
      console.error(`[ORDER] ❌ 下单金额太小: $${finalOrderSizeUSD.toFixed(2)} < $5`);
      throw new Error(`下单金额太小: $${finalOrderSizeUSD.toFixed(2)}`);
    }

    console.log(`[ORDER] 📡 调用 OKX API 下单...`);
    console.log(`[ORDER] 💵 最终下单金额: $${finalOrderSizeUSD.toFixed(2)} (原始: $${orderSizeUSD.toFixed(2)})`);

    try {
      // 🔧 真正调用 OKX 下单 API（使用安全限制后的金额）
      const orderResult = await okxClient.placeMarketOrder({
        coin: 'DOGE',
        side: request.direction as 'LONG' | 'SHORT',
        size: finalOrderSizeUSD,  // 使用限制后的金额！
        leverage: request.leverage,
        reduceOnly: false,
      });

      console.log(`[ORDER] 📥 OKX 返回:`, JSON.stringify(orderResult, null, 2));
      console.log(`[ORDER] ✅ 下单成功！`);
      console.log(`${'='.repeat(50)}\n`);

    } catch (error) {
      console.error(`[ORDER] ❌ OKX 下单失败:`, error);
      console.log(`${'='.repeat(50)}\n`);
      throw error;
    }
  }

  /**
   * 获取当前状态
   * 🔧 FIX: 检查 Sentinel 的实际运行状态，而不仅仅依赖内部标志
   */
  getStatus(): TradingManagerStatus & {
    marketContext: string;
    uptime: number;
  } {
    const ctx = getMarketContext();
    const sentinel = getSentinel();

    // 🔧 FIX: 同步 Sentinel 的实际状态
    const sentinelActuallyRunning = sentinel.isActive();
    if (sentinelActuallyRunning !== this.status.sentinelActive) {
      console.log(`[RealtimeTradingManager] ⚠️ 状态不同步: status.sentinelActive=${this.status.sentinelActive}, sentinel.isActive()=${sentinelActuallyRunning}`);
      this.status.sentinelActive = sentinelActuallyRunning;
      // 如果 Sentinel 在运行但 isRunning 是 false，同步状态
      if (sentinelActuallyRunning && !this.status.isRunning) {
        console.log(`[RealtimeTradingManager] 🔄 自动同步: 设置 isRunning = true`);
        this.status.isRunning = true;
        this.status.startedAt = Date.now() - 60000; // 假设已运行 1 分钟
      }
    }

    return {
      ...this.status,
      marketContext: ctx.getSummary(),
      uptime: this.status.isRunning ? Date.now() - this.status.startedAt : 0,
    };
  }

  /**
   * 手动触发一次 Strategist 分析
   */
  async triggerStrategistAnalysis(): Promise<void> {
    const strategist = getStrategist();
    await strategist.runOnce();
    this.status.strategistLastRun = Date.now();
  }

  /**
   * 检查是否正在运行
   */
  isRunning(): boolean {
    return this.status.isRunning;
  }

  // ========== 止损监控功能 ==========

  /**
   * 启动止损监控
   */
  private startStopLossMonitor(): void {
    if (this.stopLossCheckInterval) {
      clearInterval(this.stopLossCheckInterval);
    }

    // 重置追踪止盈状态
    this.highestProfitPct = 0;
    this.trailingStopActive = false;

    console.log(`[StopLoss] 🛡️ 止损监控已启动`);
    console.log(`[StopLoss]    硬止损: ${STOP_LOSS_CONFIG.HARD_STOP_LOSS_PCT}%`);
    console.log(`[StopLoss]    追踪止盈: 盈利 ${STOP_LOSS_CONFIG.TRAILING_TRIGGER_PCT}% 后启动, 回撤 ${STOP_LOSS_CONFIG.TRAILING_DISTANCE_PCT}% 平仓`);

    this.stopLossCheckInterval = setInterval(async () => {
      await this.checkStopLoss();
    }, STOP_LOSS_CONFIG.CHECK_INTERVAL_MS);
  }

  /**
   * 停止止损监控
   */
  private stopStopLossMonitor(): void {
    if (this.stopLossCheckInterval) {
      clearInterval(this.stopLossCheckInterval);
      this.stopLossCheckInterval = null;
      console.log(`[StopLoss] 🛑 止损监控已停止`);
    }
  }

  /**
   * 检查止损（每 5 秒执行一次）
   */
  private async checkStopLoss(): Promise<void> {
    const stateMachine = getPositionStateMachine();
    const position = stateMachine.getPosition();

    // 只有持仓时才检查
    if (position.state !== 'LONG') {
      return;
    }

    // 入场价为 0 说明是同步过来的仓位，没有入场价信息
    if (position.entryPrice <= 0) {
      console.log(`[StopLoss] ⚠️ 无入场价信息，跳过止损检查`);
      return;
    }

    try {
      const okxClient = getOKXClient();
      if (!okxClient.isAvailable()) {
        return;
      }

      // 获取当前价格
      const currentPrice = await okxClient.getCoinPrice('DOGE');
      if (!currentPrice || currentPrice <= 0) {
        return;
      }

      // v1.4: 更新 Sentinel 价格历史（用于 EMA 和速度过滤）
      const sentinel = getSentinel();
      sentinel.updatePriceHistory(currentPrice);

      // 计算盈亏百分比
      const pnlPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

      // 更新最高盈利（用于追踪止盈）
      if (pnlPct > this.highestProfitPct) {
        this.highestProfitPct = pnlPct;
      }

      // 检查是否激活追踪止盈
      if (!this.trailingStopActive && pnlPct >= STOP_LOSS_CONFIG.TRAILING_TRIGGER_PCT) {
        this.trailingStopActive = true;
        console.log(`\n[StopLoss] 🎯 追踪止盈已激活！当前盈利 ${pnlPct.toFixed(2)}% >= ${STOP_LOSS_CONFIG.TRAILING_TRIGGER_PCT}%`);
        console.log(`[StopLoss]    最高盈利: ${this.highestProfitPct.toFixed(2)}%, 回撤平仓线: ${(this.highestProfitPct - STOP_LOSS_CONFIG.TRAILING_DISTANCE_PCT).toFixed(2)}%\n`);
      }

      // ========== 检查止损条件 ==========

      // 1. 硬止损：亏损 >= 4%
      if (pnlPct <= -STOP_LOSS_CONFIG.HARD_STOP_LOSS_PCT) {
        console.log(`\n${'!'.repeat(60)}`);
        console.log(`[StopLoss] 🚨 触发硬止损！`);
        console.log(`${'!'.repeat(60)}`);
        console.log(`[StopLoss] 📊 入场价: ${position.entryPrice}`);
        console.log(`[StopLoss] 📊 当前价: ${currentPrice}`);
        console.log(`[StopLoss] 📊 亏损: ${pnlPct.toFixed(2)}% (止损线: -${STOP_LOSS_CONFIG.HARD_STOP_LOSS_PCT}%)`);

        await this.executeStopLossClose('硬止损', pnlPct, currentPrice);
        return;
      }

      // 2. 追踪止盈：已激活且回撤超过阈值
      if (this.trailingStopActive) {
        const drawdownFromHigh = this.highestProfitPct - pnlPct;

        if (drawdownFromHigh >= STOP_LOSS_CONFIG.TRAILING_DISTANCE_PCT) {
          console.log(`\n${'$'.repeat(60)}`);
          console.log(`[StopLoss] 💰 触发追踪止盈！锁定利润`);
          console.log(`${'$'.repeat(60)}`);
          console.log(`[StopLoss] 📊 入场价: ${position.entryPrice}`);
          console.log(`[StopLoss] 📊 当前价: ${currentPrice}`);
          console.log(`[StopLoss] 📊 当前盈利: ${pnlPct.toFixed(2)}%`);
          console.log(`[StopLoss] 📊 最高盈利: ${this.highestProfitPct.toFixed(2)}%`);
          console.log(`[StopLoss] 📊 回撤: ${drawdownFromHigh.toFixed(2)}% (阈值: ${STOP_LOSS_CONFIG.TRAILING_DISTANCE_PCT}%)`);

          await this.executeStopLossClose('追踪止盈', pnlPct, currentPrice);
          return;
        }
      }

    } catch (error) {
      // 静默处理错误，不打印日志避免刷屏
    }
  }

  /**
   * 执行止损/止盈平仓
   */
  private async executeStopLossClose(reason: string, pnlPct: number, currentPrice: number): Promise<void> {
    const stateMachine = getPositionStateMachine();
    const okxClient = getOKXClient();

    console.log(`[StopLoss] 📡 调用 OKX API 平仓...`);

    try {
      const closeResult = await okxClient.closePosition('DOGE');
      console.log(`[StopLoss] 📥 OKX 返回:`, JSON.stringify(closeResult, null, 2));

      // 更新状态机
      stateMachine.closeLong(currentPrice, `${reason}: 盈亏 ${pnlPct.toFixed(2)}%`);

      // 重置追踪止盈状态
      this.highestProfitPct = 0;
      this.trailingStopActive = false;

      console.log(`[StopLoss] ✅ ${reason}平仓成功！最终盈亏: ${pnlPct.toFixed(2)}%`);
      console.log(`${'='.repeat(60)}\n`);

      // 更新交易统计
      this.status.tradesExecuted++;
      this.status.lastTradeTime = Date.now();

    } catch (error) {
      console.error(`[StopLoss] ❌ 平仓失败:`, error);
    }
  }
}

// 单例
let managerInstance: RealtimeTradingManager | null = null;

export function getRealtimeTradingManager(): RealtimeTradingManager {
  if (!managerInstance) {
    managerInstance = new RealtimeTradingManager();
  }
  return managerInstance;
}

export { RealtimeTradingManager };
