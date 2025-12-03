/**
 * 三重风险控制系统
 * 借鉴 NOFX 项目的风险管理机制
 *
 * 三层保护：
 * 1. 单笔交易风险限制（已有）
 * 2. 日损失限制（新增）
 * 3. 最大回撤限制（新增）
 *
 * 特殊机制：
 * - 触发限制后自动暂停交易
 * - 冷却期后恢复
 */

import { CompletedTrade, Position } from '@/types/trading';

/**
 * 风险控制配置
 */
export interface RiskControlConfig {
  // 第1层：单笔限制（已有，这里记录）
  maxPositionPercent: number;      // 单仓最大占比（如 5%）
  maxLeverage: number;             // 最大杠杆（如 3x）

  // 第2层：日损失限制
  maxDailyLossPercent: number;     // 日最大损失百分比（如 10%）
  stopTradingMinutes: number;      // 触发后暂停交易的分钟数（如 60）

  // 第3层：最大回撤限制
  maxDrawdownPercent: number;      // 最大回撤百分比（如 20%）
  criticalStopMinutes: number;     // 触发最大回撤后的暂停时间（如 240分钟 = 4小时）
}

/**
 * 风险状态
 */
export interface RiskStatus {
  // 日损失状态
  dailyPnL: number;
  dailyLossPercent: number;
  dailyLimitReached: boolean;

  // 回撤状态
  peakEquity: number;
  currentEquity: number;
  drawdown: number;
  drawdownPercent: number;
  drawdownLimitReached: boolean;

  // 交易暂停状态
  isTradingPaused: boolean;
  pauseReason?: string;
  pausedUntil?: number;           // 暂停到什么时间
  remainingPauseMinutes?: number;

  // 风险等级
  riskLevel: 'SAFE' | 'WARNING' | 'DANGER' | 'CRITICAL';
}

/**
 * 交易决策验证结果
 */
export interface TradeValidationResult {
  allowed: boolean;
  reason: string;
  riskStatus: RiskStatus;
}

/**
 * 三重风险控制器
 */
export class TripleRiskControl {
  private config: RiskControlConfig;

  // 状态跟踪
  private todayDate: string = '';
  private todayTrades: CompletedTrade[] = [];
  private todayStartEquity: number = 0;
  private peakEquity: number = 0;
  private initialEquity: number = 0;

  // 暂停状态
  private pausedUntil: number = 0;
  private pauseReason: string = '';

  constructor(config?: Partial<RiskControlConfig>) {
    // 默认配置（保守）
    this.config = {
      maxPositionPercent: 5,       // 单仓最大5%
      maxLeverage: 3,              // 最大3x杠杆
      maxDailyLossPercent: 10,     // 日最大损失10%
      stopTradingMinutes: 60,      // 暂停60分钟
      maxDrawdownPercent: 20,      // 最大回撤20%
      criticalStopMinutes: 240,    // 暂停4小时
      ...config,
    };

    this.resetDaily();
  }

  /**
   * 初始化（设置初始资金）
   */
  initialize(initialEquity: number) {
    this.initialEquity = initialEquity;
    this.peakEquity = initialEquity;
    this.todayStartEquity = initialEquity;
    console.log(`[TripleRisk] 🛡️ 初始化风险控制系统，初始资金: $${initialEquity.toFixed(2)}`);
  }

  /**
   * 重置每日数据
   */
  private resetDaily() {
    const today = new Date().toISOString().split('T')[0];
    if (this.todayDate !== today) {
      this.todayDate = today;
      this.todayTrades = [];
      console.log('[TripleRisk] 📅 每日风险数据已重置');
    }
  }

  /**
   * 更新账户权益（在每次交易周期中调用）
   */
  updateEquity(currentEquity: number, completedTrades: CompletedTrade[]) {
    this.resetDaily();

    // 更新峰值权益
    if (currentEquity > this.peakEquity) {
      this.peakEquity = currentEquity;
      console.log(`[TripleRisk] 🎉 新的权益峰值: $${this.peakEquity.toFixed(2)}`);
    }

    // 如果没有设置今日起始权益，设置它
    if (this.todayStartEquity === 0) {
      this.todayStartEquity = currentEquity;
    }

    // 更新今日交易列表
    const today = new Date().toISOString().split('T')[0];
    this.todayTrades = completedTrades.filter(trade => {
      const tradeDate = new Date(trade.closedAt).toISOString().split('T')[0];
      return tradeDate === today;
    });
  }

  /**
   * 检查是否允许交易
   */
  canTrade(currentEquity: number): TradeValidationResult {
    const riskStatus = this.getRiskStatus(currentEquity);

    // 检查暂停状态
    if (this.isPaused()) {
      return {
        allowed: false,
        reason: `交易已暂停：${this.pauseReason}（剩余${riskStatus.remainingPauseMinutes}分钟）`,
        riskStatus,
      };
    }

    // 检查日损失限制
    if (riskStatus.dailyLimitReached) {
      this.pauseTrading(
        this.config.stopTradingMinutes,
        `触发日损失限制（损失${riskStatus.dailyLossPercent.toFixed(1)}%）`
      );
      return {
        allowed: false,
        reason: `触发日损失限制：今日损失${riskStatus.dailyLossPercent.toFixed(1)}%，已达上限${this.config.maxDailyLossPercent}%`,
        riskStatus,
      };
    }

    // 检查最大回撤限制
    if (riskStatus.drawdownLimitReached) {
      this.pauseTrading(
        this.config.criticalStopMinutes,
        `触发最大回撤限制（回撤${riskStatus.drawdownPercent.toFixed(1)}%）`
      );
      return {
        allowed: false,
        reason: `触发最大回撤限制：回撤${riskStatus.drawdownPercent.toFixed(1)}%，已达上限${this.config.maxDrawdownPercent}%`,
        riskStatus,
      };
    }

    // 所有检查通过
    return {
      allowed: true,
      reason: 'All risk checks passed',
      riskStatus,
    };
  }

  /**
   * 获取当前风险状态
   */
  getRiskStatus(currentEquity: number): RiskStatus {
    this.resetDaily();

    // 1. 计算日损失
    const dailyPnL = currentEquity - this.todayStartEquity;
    const dailyLossPercent = this.todayStartEquity > 0
      ? (dailyPnL / this.todayStartEquity) * 100
      : 0;
    const dailyLimitReached = dailyLossPercent < -this.config.maxDailyLossPercent;

    // 2. 计算回撤
    const drawdown = this.peakEquity - currentEquity;
    const drawdownPercent = this.peakEquity > 0
      ? (drawdown / this.peakEquity) * 100
      : 0;
    const drawdownLimitReached = drawdownPercent > this.config.maxDrawdownPercent;

    // 3. 检查暂停状态
    const isTradingPaused = this.isPaused();
    const remainingPauseMinutes = isTradingPaused
      ? Math.ceil((this.pausedUntil - Date.now()) / 60000)
      : 0;

    // 4. 确定风险等级
    let riskLevel: RiskStatus['riskLevel'] = 'SAFE';
    if (drawdownLimitReached || dailyLimitReached) {
      riskLevel = 'CRITICAL';
    } else if (drawdownPercent > this.config.maxDrawdownPercent * 0.75 || dailyLossPercent < -this.config.maxDailyLossPercent * 0.75) {
      riskLevel = 'DANGER';
    } else if (drawdownPercent > this.config.maxDrawdownPercent * 0.5 || dailyLossPercent < -this.config.maxDailyLossPercent * 0.5) {
      riskLevel = 'WARNING';
    }

    return {
      dailyPnL,
      dailyLossPercent,
      dailyLimitReached,
      peakEquity: this.peakEquity,
      currentEquity,
      drawdown,
      drawdownPercent,
      drawdownLimitReached,
      isTradingPaused,
      pauseReason: this.pauseReason || undefined,
      pausedUntil: this.pausedUntil || undefined,
      remainingPauseMinutes: isTradingPaused ? remainingPauseMinutes : undefined,
      riskLevel,
    };
  }

  /**
   * 暂停交易
   */
  private pauseTrading(minutes: number, reason: string) {
    this.pausedUntil = Date.now() + minutes * 60000;
    this.pauseReason = reason;
    console.log(`[TripleRisk] 🚨 交易已暂停 ${minutes} 分钟：${reason}`);
    console.log(`[TripleRisk] ⏰ 恢复时间：${new Date(this.pausedUntil).toLocaleString()}`);
  }

  /**
   * 检查是否处于暂停状态
   */
  private isPaused(): boolean {
    if (this.pausedUntil === 0) return false;

    const now = Date.now();
    if (now < this.pausedUntil) {
      return true;
    } else {
      // 暂停期已过，清除状态
      console.log('[TripleRisk] ✅ 交易暂停期已结束，恢复交易');
      this.pausedUntil = 0;
      this.pauseReason = '';
      return false;
    }
  }

  /**
   * 手动恢复交易（紧急情况下使用）
   */
  resumeTrading() {
    if (this.pausedUntil > 0) {
      console.log('[TripleRisk] 🔓 手动恢复交易');
      this.pausedUntil = 0;
      this.pauseReason = '';
    }
  }

  /**
   * 获取风险报告（用于监控）
   */
  generateRiskReport(currentEquity: number): string {
    const status = this.getRiskStatus(currentEquity);

    let report = `\n=== 🛡️ TRIPLE RISK CONTROL REPORT ===\n\n`;

    // 风险等级
    const levelEmoji = {
      SAFE: '🟢',
      WARNING: '🟡',
      DANGER: '🟠',
      CRITICAL: '🔴',
    }[status.riskLevel];

    report += `Risk Level: ${levelEmoji} ${status.riskLevel}\n\n`;

    // 第1层：单笔限制（显示配置）
    report += `Layer 1 - Position Limits:\n`;
    report += `  Max Position: ${this.config.maxPositionPercent}% of equity\n`;
    report += `  Max Leverage: ${this.config.maxLeverage}x\n`;
    report += `  Status: ✅ Active\n\n`;

    // 第2层：日损失
    report += `Layer 2 - Daily Loss Limit:\n`;
    report += `  Today's PnL: $${status.dailyPnL.toFixed(2)} (${status.dailyLossPercent >= 0 ? '+' : ''}${status.dailyLossPercent.toFixed(2)}%)\n`;
    report += `  Daily Limit: -${this.config.maxDailyLossPercent}%\n`;
    report += `  Status: ${status.dailyLimitReached ? '🔴 TRIGGERED' : '🟢 OK'}\n\n`;

    // 第3层：最大回撤
    report += `Layer 3 - Maximum Drawdown:\n`;
    report += `  Peak Equity: $${status.peakEquity.toFixed(2)}\n`;
    report += `  Current Equity: $${status.currentEquity.toFixed(2)}\n`;
    report += `  Drawdown: $${status.drawdown.toFixed(2)} (${status.drawdownPercent.toFixed(2)}%)\n`;
    report += `  Max Allowed: ${this.config.maxDrawdownPercent}%\n`;
    report += `  Status: ${status.drawdownLimitReached ? '🔴 TRIGGERED' : '🟢 OK'}\n\n`;

    // 暂停状态
    if (status.isTradingPaused) {
      report += `⏸️  TRADING PAUSED\n`;
      report += `   Reason: ${status.pauseReason}\n`;
      report += `   Remaining: ${status.remainingPauseMinutes} minutes\n`;
      report += `   Resume at: ${new Date(status.pausedUntil!).toLocaleString()}\n\n`;
    }

    report += `===================================\n`;

    return report;
  }

  /**
   * 获取配置
   */
  getConfig(): RiskControlConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<RiskControlConfig>) {
    this.config = { ...this.config, ...newConfig };
    console.log('[TripleRisk] ⚙️ 风险控制配置已更新:', this.config);
  }
}

/**
 * 单例实例
 */
let riskControlInstance: TripleRiskControl | null = null;

export function getTripleRiskControl(config?: Partial<RiskControlConfig>): TripleRiskControl {
  if (!riskControlInstance) {
    riskControlInstance = new TripleRiskControl(config);
  }
  return riskControlInstance;
}

/**
 * 重置实例（用于测试）
 */
export function resetTripleRiskControl() {
  riskControlInstance = null;
}
