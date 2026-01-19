/**
 * Flow-Radar 风控熔断规则
 */

import { NormalizedSignal, FlowRadarSummary, SignalDirection } from './types';
import { getFlowRadarHeartbeat } from './heartbeat';

// 风控配置
const RISK_CONFIG = {
  // 日亏损熔断：净值回撤阈值
  DAILY_LOSS_THRESHOLD: 0.05, // 5%

  // 连亏熔断
  CONSECUTIVE_LOSS_THRESHOLD: 3, // 连续亏损笔数
  CONSECUTIVE_LOSS_PAUSE_HOURS: 2, // 暂停小时数

  // 信号门槛
  MIN_CONFIDENCE: 60, // 最小置信度

  // 滑点控制
  MAX_SLIPPAGE: 0.003, // 0.3%

  // 平仓后冷却（秒）
  POSITION_CLOSE_COOLDOWN_MIN_SEC: 30,
  POSITION_CLOSE_COOLDOWN_MAX_SEC: 60,

  // 杠杆设置
  DEFAULT_LEVERAGE: 2,
  MIN_LEVERAGE: 1,
  MAX_LEVERAGE: 5,
  LEVERAGE_DOWNGRADE_STEP: 1, // 连亏后降档幅度

  // 仓位限制
  MAX_SINGLE_NOTIONAL_PERCENT: 0.05, // 单次 5%
  MAX_TOTAL_NOTIONAL_PERCENT: 0.30, // 总持仓 30%
  ACCOUNT_SIZE: 300, // 账户 300U（示例）
};

// 交易记录
interface TradeRecord {
  id: string;
  side: 'LONG' | 'SHORT';
  pnl: number;
  closedAt: number;
}

// 风控状态
interface RiskState {
  // 日亏损
  dailyStartEquity: number;
  currentEquity: number;
  dailyDrawdown: number;
  isDailyHalted: boolean;

  // 连亏
  consecutiveLosses: number;
  isConsecutiveLossHalted: boolean;
  consecutiveLossPauseUntil: number;

  // 杠杆
  currentLeverage: number;

  // 仓位冷却
  lastClosedSide: 'LONG' | 'SHORT' | null;
  lastClosedAt: number;
  positionCooldownUntil: number;

  // 当前持仓 Notional
  currentTotalNotional: number;
}

/**
 * Flow-Radar 风控管理器
 */
export class FlowRadarRiskControl {
  private state: RiskState;
  private tradeHistory: TradeRecord[] = [];

  constructor() {
    this.state = {
      dailyStartEquity: RISK_CONFIG.ACCOUNT_SIZE,
      currentEquity: RISK_CONFIG.ACCOUNT_SIZE,
      dailyDrawdown: 0,
      isDailyHalted: false,

      consecutiveLosses: 0,
      isConsecutiveLossHalted: false,
      consecutiveLossPauseUntil: 0,

      currentLeverage: RISK_CONFIG.DEFAULT_LEVERAGE,

      lastClosedSide: null,
      lastClosedAt: 0,
      positionCooldownUntil: 0,

      currentTotalNotional: 0,
    };
  }

  /**
   * 更新账户权益
   */
  updateEquity(equity: number): void {
    this.state.currentEquity = equity;

    // 计算日回撤
    this.state.dailyDrawdown =
      (this.state.dailyStartEquity - equity) / this.state.dailyStartEquity;

    // 检查日亏损熔断
    if (this.state.dailyDrawdown >= RISK_CONFIG.DAILY_LOSS_THRESHOLD) {
      if (!this.state.isDailyHalted) {
        this.state.isDailyHalted = true;
        console.log(
          `[FlowRadar RiskControl] 🛑 日亏损熔断触发: 回撤 ${(this.state.dailyDrawdown * 100).toFixed(2)}%`
        );
      }
    }
  }

  /**
   * 重置每日数据（每天开盘时调用）
   */
  resetDaily(startEquity: number): void {
    this.state.dailyStartEquity = startEquity;
    this.state.dailyDrawdown = 0;
    this.state.isDailyHalted = false;
    console.log(
      `[FlowRadar RiskControl] 📅 每日重置，起始权益: $${startEquity.toFixed(2)}`
    );
  }

  /**
   * 记录交易结果
   */
  recordTrade(trade: TradeRecord): void {
    this.tradeHistory.push(trade);

    // 更新连亏计数
    if (trade.pnl < 0) {
      this.state.consecutiveLosses++;
      console.log(
        `[FlowRadar RiskControl] 📉 亏损交易，连续亏损: ${this.state.consecutiveLosses}`
      );

      // 检查连亏熔断
      if (this.state.consecutiveLosses >= RISK_CONFIG.CONSECUTIVE_LOSS_THRESHOLD) {
        this.triggerConsecutiveLossHalt();
      }
    } else {
      // 盈利，重置连亏计数
      this.state.consecutiveLosses = 0;
      // 恢复杠杆（如果之前降过）
      if (this.state.currentLeverage < RISK_CONFIG.DEFAULT_LEVERAGE) {
        this.state.currentLeverage = Math.min(
          this.state.currentLeverage + 1,
          RISK_CONFIG.DEFAULT_LEVERAGE
        );
        console.log(
          `[FlowRadar RiskControl] 📈 盈利交易，杠杆恢复: ${this.state.currentLeverage}x`
        );
      }
    }

    // 设置平仓冷却
    this.state.lastClosedSide = trade.side;
    this.state.lastClosedAt = trade.closedAt;
    const cooldownSec =
      RISK_CONFIG.POSITION_CLOSE_COOLDOWN_MIN_SEC +
      Math.random() *
        (RISK_CONFIG.POSITION_CLOSE_COOLDOWN_MAX_SEC -
          RISK_CONFIG.POSITION_CLOSE_COOLDOWN_MIN_SEC);
    this.state.positionCooldownUntil = trade.closedAt + cooldownSec * 1000;
  }

  /**
   * 触发连亏熔断
   */
  private triggerConsecutiveLossHalt(): void {
    this.state.isConsecutiveLossHalted = true;
    this.state.consecutiveLossPauseUntil =
      Date.now() + RISK_CONFIG.CONSECUTIVE_LOSS_PAUSE_HOURS * 60 * 60 * 1000;

    // 降低杠杆
    this.state.currentLeverage = Math.max(
      this.state.currentLeverage - RISK_CONFIG.LEVERAGE_DOWNGRADE_STEP,
      RISK_CONFIG.MIN_LEVERAGE
    );

    console.log(
      `[FlowRadar RiskControl] 🛑 连亏熔断触发: 暂停 ${RISK_CONFIG.CONSECUTIVE_LOSS_PAUSE_HOURS} 小时, 杠杆降至 ${this.state.currentLeverage}x`
    );
  }

  /**
   * 检查连亏暂停是否结束
   */
  private checkConsecutiveLossPause(): void {
    if (
      this.state.isConsecutiveLossHalted &&
      Date.now() >= this.state.consecutiveLossPauseUntil
    ) {
      this.state.isConsecutiveLossHalted = false;
      this.state.consecutiveLosses = 0;
      console.log('[FlowRadar RiskControl] ✅ 连亏暂停结束');
    }
  }

  /**
   * 验证信号是否可执行
   */
  validateSignal(signal: NormalizedSignal): {
    valid: boolean;
    reason?: string;
  } {
    // 检查置信度
    if (signal.confidence < RISK_CONFIG.MIN_CONFIDENCE) {
      return {
        valid: false,
        reason: `置信度不足: ${signal.confidence} < ${RISK_CONFIG.MIN_CONFIDENCE}`,
      };
    }

    return { valid: true };
  }

  /**
   * 检查是否允许开仓
   */
  canOpenPosition(
    direction: SignalDirection,
    notional: number,
    estimatedSlippage: number = 0
  ): { allowed: boolean; reason?: string } {
    // 检查心跳状态
    const heartbeat = getFlowRadarHeartbeat();
    if (!heartbeat.canOpenPosition()) {
      return {
        allowed: false,
        reason: `心跳状态不允许: ${heartbeat.getStatusDescription()}`,
      };
    }

    // 检查日亏损熔断
    if (this.state.isDailyHalted) {
      return {
        allowed: false,
        reason: `日亏损熔断: 回撤 ${(this.state.dailyDrawdown * 100).toFixed(2)}%`,
      };
    }

    // 检查连亏熔断
    this.checkConsecutiveLossPause();
    if (this.state.isConsecutiveLossHalted) {
      const remainingMin = Math.ceil(
        (this.state.consecutiveLossPauseUntil - Date.now()) / 60000
      );
      return {
        allowed: false,
        reason: `连亏熔断: 剩余 ${remainingMin} 分钟`,
      };
    }

    // 检查平仓冷却
    if (
      this.state.lastClosedSide === direction &&
      Date.now() < this.state.positionCooldownUntil
    ) {
      const remainingSec = Math.ceil(
        (this.state.positionCooldownUntil - Date.now()) / 1000
      );
      return {
        allowed: false,
        reason: `同向开仓冷却: 剩余 ${remainingSec} 秒`,
      };
    }

    // 检查滑点
    if (estimatedSlippage > RISK_CONFIG.MAX_SLIPPAGE) {
      return {
        allowed: false,
        reason: `预估滑点过大: ${(estimatedSlippage * 100).toFixed(3)}% > ${(RISK_CONFIG.MAX_SLIPPAGE * 100).toFixed(3)}%`,
      };
    }

    // 检查单次 Notional 限制
    const maxSingleNotional =
      this.state.currentEquity * RISK_CONFIG.MAX_SINGLE_NOTIONAL_PERCENT;
    if (notional > maxSingleNotional) {
      return {
        allowed: false,
        reason: `单次 Notional 超限: $${notional.toFixed(2)} > $${maxSingleNotional.toFixed(2)}`,
      };
    }

    // 检查总 Notional 限制
    const maxTotalNotional =
      this.state.currentEquity * RISK_CONFIG.MAX_TOTAL_NOTIONAL_PERCENT;
    if (this.state.currentTotalNotional + notional > maxTotalNotional) {
      return {
        allowed: false,
        reason: `总 Notional 超限: $${(this.state.currentTotalNotional + notional).toFixed(2)} > $${maxTotalNotional.toFixed(2)}`,
      };
    }

    return { allowed: true };
  }

  /**
   * 检查是否允许平仓
   */
  canClosePosition(): { allowed: boolean; reason?: string } {
    const heartbeat = getFlowRadarHeartbeat();
    if (!heartbeat.canClosePosition()) {
      return {
        allowed: false,
        reason: `心跳状态不允许平仓: ${heartbeat.getStatusDescription()}`,
      };
    }
    return { allowed: true };
  }

  /**
   * 获取当前杠杆
   */
  getCurrentLeverage(): number {
    return this.state.currentLeverage;
  }

  /**
   * 计算建议的 Notional
   */
  calculateSuggestedNotional(confidence: number): number {
    // 基础 Notional = 账户 * 单次上限
    let baseNotional =
      this.state.currentEquity * RISK_CONFIG.MAX_SINGLE_NOTIONAL_PERCENT;

    // 根据置信度调整
    const confidenceMultiplier = Math.min(confidence / 100, 1);
    baseNotional *= confidenceMultiplier;

    // 确保不超过剩余额度
    const maxTotalNotional =
      this.state.currentEquity * RISK_CONFIG.MAX_TOTAL_NOTIONAL_PERCENT;
    const remainingNotional = maxTotalNotional - this.state.currentTotalNotional;

    return Math.min(baseNotional, remainingNotional);
  }

  /**
   * 更新持仓 Notional
   */
  updateTotalNotional(notional: number): void {
    this.state.currentTotalNotional = notional;
  }

  /**
   * 获取风控状态摘要
   */
  getStatusSummary(): {
    dailyDrawdown: string;
    isDailyHalted: boolean;
    consecutiveLosses: number;
    isConsecutiveLossHalted: boolean;
    currentLeverage: number;
    totalNotional: string;
    maxNotional: string;
  } {
    const maxTotalNotional =
      this.state.currentEquity * RISK_CONFIG.MAX_TOTAL_NOTIONAL_PERCENT;

    return {
      dailyDrawdown: `${(this.state.dailyDrawdown * 100).toFixed(2)}%`,
      isDailyHalted: this.state.isDailyHalted,
      consecutiveLosses: this.state.consecutiveLosses,
      isConsecutiveLossHalted: this.state.isConsecutiveLossHalted,
      currentLeverage: this.state.currentLeverage,
      totalNotional: `$${this.state.currentTotalNotional.toFixed(2)}`,
      maxNotional: `$${maxTotalNotional.toFixed(2)}`,
    };
  }

  /**
   * 基于信号摘要生成交易建议
   */
  generateTradeAdvice(summary: FlowRadarSummary): {
    action: 'LONG' | 'SHORT' | 'HOLD' | 'NO_TRADE';
    reason: string;
    notional: number;
    leverage: number;
    confidence: number;
  } {
    // 检查冲突
    if (summary.consensus.conflict) {
      return {
        action: 'NO_TRADE',
        reason: '信号冲突：bullish + bearish 同时存在',
        notional: 0,
        leverage: this.state.currentLeverage,
        confidence: 0,
      };
    }

    // 检查是否有信号
    if (summary.signals.length === 0) {
      return {
        action: 'HOLD',
        reason: '无有效信号',
        notional: 0,
        leverage: this.state.currentLeverage,
        confidence: 0,
      };
    }

    // 获取最高优先级信号
    const topSignal = summary.signals[0];

    // 检查信号有效性
    const validation = this.validateSignal(topSignal);
    if (!validation.valid) {
      return {
        action: 'NO_TRADE',
        reason: validation.reason || '信号无效',
        notional: 0,
        leverage: this.state.currentLeverage,
        confidence: topSignal.confidence,
      };
    }

    // 计算建议 Notional
    const suggestedNotional = this.calculateSuggestedNotional(topSignal.confidence);

    // 确定方向
    let action: 'LONG' | 'SHORT' | 'HOLD' | 'NO_TRADE';
    if (topSignal.direction === 'LONG') {
      action = 'LONG';
    } else if (topSignal.direction === 'SHORT') {
      action = 'SHORT';
    } else {
      action = 'HOLD';
    }

    // 构建原因
    let reason = `${topSignal.signal_type}`;
    if (summary.trend_congruence) {
      reason += ' + 冰山K神共振';
    }
    if (summary.iceberg_summary?.confirmed_buy || summary.iceberg_summary?.confirmed_sell) {
      reason += ' (冰山确认)';
    }

    return {
      action,
      reason,
      notional: suggestedNotional,
      leverage: this.state.currentLeverage,
      confidence: topSignal.confidence,
    };
  }
}

// 单例
let riskControlInstance: FlowRadarRiskControl | null = null;

export function getFlowRadarRiskControl(): FlowRadarRiskControl {
  if (!riskControlInstance) {
    riskControlInstance = new FlowRadarRiskControl();
  }
  return riskControlInstance;
}
