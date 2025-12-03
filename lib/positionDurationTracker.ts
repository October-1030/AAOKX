/**
 * 持仓时长跟踪系统
 * 借鉴 NOFX v2.0.2 的持仓时长功能
 *
 * 核心价值：
 * 1. 防止AI持有亏损仓位过久
 * 2. 提醒AI及时锁定利润
 * 3. 基于持仓时长动态调整策略
 */

import { Position } from '@/types/trading';

/**
 * 增强的持仓信息（包含时长分析）
 */
export interface EnhancedPosition extends Position {
  // 持仓时长信息
  holdingDuration: {
    milliseconds: number;
    minutes: number;
    hours: number;
    formatted: string;  // "2h 35m"
  };

  // 性能分析
  performance: {
    currentPnL: number;
    currentPnLPercent: number;
    peakPnL: number;           // 历史最高盈利
    peakPnLPercent: number;    // 历史最高盈利%
    drawdownFromPeak: number;  // 从最高点回撤多少
    drawdownPercent: number;   // 回撤百分比
  };

  // AI建议
  aiSuggestion: {
    action: 'HOLD' | 'CONSIDER_EXIT' | 'URGENT_EXIT';
    reason: string;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
}

/**
 * 持仓时长跟踪器
 */
export class PositionDurationTracker {
  // 持仓时长阈值（分钟）
  private readonly THRESHOLDS = {
    SHORT_TERM: 60,      // 1小时
    MEDIUM_TERM: 240,    // 4小时
    LONG_TERM: 480,      // 8小时
    VERY_LONG: 1440,     // 24小时
  };

  // 从最高点回撤阈值
  private readonly DRAWDOWN_THRESHOLDS = {
    WARNING: 0.3,    // 30% 回撤 → 警告
    CRITICAL: 0.5,   // 50% 回撤 → 严重
  };

  /**
   * 增强单个持仓信息
   */
  enhancePosition(position: Position, currentTime: number = Date.now()): EnhancedPosition {
    // 1. 计算持仓时长
    const holdingMillis = currentTime - position.openedAt;
    const holdingMinutes = Math.floor(holdingMillis / 60000);
    const holdingHours = Math.floor(holdingMinutes / 60);
    const remainingMinutes = holdingMinutes % 60;

    const holdingDuration = {
      milliseconds: holdingMillis,
      minutes: holdingMinutes,
      hours: holdingHours,
      formatted: holdingHours > 0
        ? `${holdingHours}h ${remainingMinutes}m`
        : `${holdingMinutes}m`,
    };

    // 2. 性能分析
    const currentPnL = position.unrealizedPnL;
    const currentPnLPercent = position.unrealizedPnLPercent;
    const peakPnL = position.maxUnrealizedPnL || currentPnL;
    const peakPnLPercent = position.maxUnrealizedPnLPercent || currentPnLPercent;

    // 计算从峰值的回撤
    let drawdownFromPeak = 0;
    let drawdownPercent = 0;
    if (peakPnL > 0) {
      drawdownFromPeak = peakPnL - currentPnL;
      drawdownPercent = drawdownFromPeak / peakPnL;
    }

    const performance = {
      currentPnL,
      currentPnLPercent,
      peakPnL,
      peakPnLPercent,
      drawdownFromPeak,
      drawdownPercent,
    };

    // 3. 生成AI建议
    const aiSuggestion = this.generateSuggestion(
      position,
      holdingDuration,
      performance
    );

    return {
      ...position,
      holdingDuration,
      performance,
      aiSuggestion,
    };
  }

  /**
   * 增强所有持仓
   */
  enhanceAllPositions(positions: Position[], currentTime: number = Date.now()): EnhancedPosition[] {
    return positions.map(pos => this.enhancePosition(pos, currentTime));
  }

  /**
   * 生成AI建议
   */
  private generateSuggestion(
    position: Position,
    duration: EnhancedPosition['holdingDuration'],
    performance: EnhancedPosition['performance']
  ): EnhancedPosition['aiSuggestion'] {
    const { currentPnL, currentPnLPercent, peakPnL, drawdownPercent } = performance;
    const holdingMinutes = duration.minutes;

    // 场景1: 亏损仓位持有过久
    if (currentPnL < 0) {
      if (holdingMinutes > this.THRESHOLDS.LONG_TERM) {
        return {
          action: 'URGENT_EXIT',
          reason: `亏损仓位已持有${duration.formatted}，建议立即止损`,
          urgency: 'CRITICAL',
        };
      } else if (holdingMinutes > this.THRESHOLDS.MEDIUM_TERM) {
        return {
          action: 'CONSIDER_EXIT',
          reason: `亏损仓位已持有${duration.formatted}，考虑止损`,
          urgency: 'HIGH',
        };
      } else if (currentPnLPercent < -5) {
        return {
          action: 'CONSIDER_EXIT',
          reason: `亏损已达${currentPnLPercent.toFixed(1)}%，接近止损位`,
          urgency: 'HIGH',
        };
      }
    }

    // 场景2: 盈利仓位，从峰值大幅回撤
    if (peakPnL > 0 && drawdownPercent > this.DRAWDOWN_THRESHOLDS.CRITICAL) {
      return {
        action: 'URGENT_EXIT',
        reason: `利润从峰值$${peakPnL.toFixed(2)}回撤${(drawdownPercent * 100).toFixed(0)}%，建议锁定剩余利润`,
        urgency: 'CRITICAL',
      };
    } else if (peakPnL > 0 && drawdownPercent > this.DRAWDOWN_THRESHOLDS.WARNING) {
      return {
        action: 'CONSIDER_EXIT',
        reason: `利润从峰值$${peakPnL.toFixed(2)}回撤${(drawdownPercent * 100).toFixed(0)}%，考虑部分止盈`,
        urgency: 'HIGH',
      };
    }

    // 场景3: 盈利仓位持有很久
    if (currentPnL > 0 && holdingMinutes > this.THRESHOLDS.VERY_LONG) {
      return {
        action: 'CONSIDER_EXIT',
        reason: `已盈利$${currentPnL.toFixed(2)}并持有${duration.formatted}，考虑获利了结`,
        urgency: 'MEDIUM',
      };
    }

    // 场景4: 盈利仓位但接近止盈目标
    if (currentPnLPercent > 8) {
      return {
        action: 'CONSIDER_EXIT',
        reason: `已盈利${currentPnLPercent.toFixed(1)}%，考虑锁定利润`,
        urgency: 'MEDIUM',
      };
    }

    // 场景5: 正常持有
    return {
      action: 'HOLD',
      reason: `持仓${duration.formatted}，表现正常`,
      urgency: 'LOW',
    };
  }

  /**
   * 生成持仓时长的prompt文本（注入到AI决策中）
   */
  generatePositionDurationPrompt(enhancedPositions: EnhancedPosition[]): string {
    if (enhancedPositions.length === 0) {
      return '';
    }

    let prompt = `\n=== ⏱️ POSITION DURATION & PERFORMANCE ANALYSIS ===\n\n`;
    prompt += `You have ${enhancedPositions.length} active position(s). Below is detailed duration and performance analysis:\n\n`;

    for (const pos of enhancedPositions) {
      const { coin, side, holdingDuration, performance, aiSuggestion } = pos;

      prompt += `📊 ${coin} ${side}:\n`;
      prompt += `   Holding Duration: ${holdingDuration.formatted} (${holdingDuration.minutes} minutes)\n`;
      prompt += `   Current PnL: $${performance.currentPnL.toFixed(2)} (${performance.currentPnLPercent.toFixed(2)}%)\n`;

      if (performance.peakPnL !== performance.currentPnL) {
        prompt += `   Peak PnL: $${performance.peakPnL.toFixed(2)} (${performance.peakPnLPercent.toFixed(2)}%)\n`;
        prompt += `   Drawdown from Peak: $${performance.drawdownFromPeak.toFixed(2)} (-${(performance.drawdownPercent * 100).toFixed(1)}%)\n`;
      }

      // AI建议
      const urgencyEmoji = {
        LOW: 'ℹ️',
        MEDIUM: '⚠️',
        HIGH: '🔴',
        CRITICAL: '🚨',
      }[aiSuggestion.urgency];

      prompt += `   ${urgencyEmoji} Suggestion: ${aiSuggestion.action} - ${aiSuggestion.reason}\n`;
      prompt += `\n`;
    }

    prompt += `⚠️ IMPORTANT: Consider position duration and drawdown when making hold/exit decisions.\n`;
    prompt += `   - Losing positions held >4h should be reconsidered\n`;
    prompt += `   - Winning positions with >30% drawdown from peak should be protected\n`;
    prompt += `   - Very long positions (>24h) may need revaluation\n\n`;

    return prompt;
  }

  /**
   * 获取需要关注的持仓（高优先级）
   */
  getPositionsNeedingAttention(enhancedPositions: EnhancedPosition[]): EnhancedPosition[] {
    return enhancedPositions.filter(pos =>
      pos.aiSuggestion.urgency === 'HIGH' ||
      pos.aiSuggestion.urgency === 'CRITICAL'
    ).sort((a, b) => {
      // 按紧急程度排序
      const urgencyOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return urgencyOrder[b.aiSuggestion.urgency] - urgencyOrder[a.aiSuggestion.urgency];
    });
  }

  /**
   * 更新持仓的峰值PnL（在交易引擎中调用）
   */
  updatePeakPnL(position: Position): Position {
    const currentPnL = position.unrealizedPnL;
    const currentPnLPercent = position.unrealizedPnLPercent;
    const currentPeak = position.maxUnrealizedPnL || 0;

    if (currentPnL > currentPeak) {
      return {
        ...position,
        maxUnrealizedPnL: currentPnL,
        maxUnrealizedPnLPercent: currentPnLPercent,
      };
    }

    return position;
  }
}

/**
 * 单例实例
 */
let trackerInstance: PositionDurationTracker | null = null;

export function getPositionDurationTracker(): PositionDurationTracker {
  if (!trackerInstance) {
    trackerInstance = new PositionDurationTracker();
  }
  return trackerInstance;
}
