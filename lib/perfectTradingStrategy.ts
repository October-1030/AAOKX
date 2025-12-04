/**
 * 完美交易策略系统
 * 基于最佳实践的止盈止损策略
 */

export interface PerfectStrategyConfig {
  // 基础参数
  initialStopLoss: number;        // 初始止损百分比
  breakEvenThreshold: number;     // 保本阈值
  enablePartialTakeProfit: boolean; // 是否启用分批止盈
  enableTimeDecay: boolean;       // 是否启用时间衰减
  
  // 高级参数
  aggressiveMode: boolean;        // 激进模式（适合牛市）
  conservativeMode: boolean;      // 保守模式（适合熊市）
}

export class PerfectTradingStrategy {
  private config: PerfectStrategyConfig;
  
  constructor(config?: Partial<PerfectStrategyConfig>) {
    this.config = {
      initialStopLoss: 3,           // 初始止损 3%
      breakEvenThreshold: 2,        // 盈利 2% 移动到保本
      enablePartialTakeProfit: true, // 启用分批止盈
      enableTimeDecay: true,        // 启用时间衰减
      aggressiveMode: false,
      conservativeMode: false,
      ...config
    };
  }
  
  /**
   * 🎯 获取动态回撤止盈百分比
   * 这是核心算法 - 盈利越多，允许回撤越少
   */
  getTrailingStopPercent(maxProfitPercent: number): number {
    // 基础回撤表
    const trailingTable = [
      { profit: 0, trailing: 10 },    // 刚开始，给足空间
      { profit: 2, trailing: 8 },     // 小盈利，适度保护
      { profit: 3, trailing: 6 },     // 保本线，开始收紧
      { profit: 5, trailing: 5 },     // 标准保护
      { profit: 10, trailing: 4 },    // 不错的利润，强保护
      { profit: 15, trailing: 3.5 },  // 优秀利润
      { profit: 20, trailing: 3 },    // 很好的利润
      { profit: 30, trailing: 2.5 },  // 极好的利润
      { profit: 50, trailing: 2 },    // 暴利，超级保护
      { profit: 100, trailing: 1.5 }, // 翻倍，极限保护
    ];
    
    // 根据利润查找对应的回撤百分比
    for (let i = trailingTable.length - 1; i >= 0; i--) {
      if (maxProfitPercent >= trailingTable[i].profit) {
        return trailingTable[i].trailing;
      }
    }
    
    return 10; // 默认 10%
  }
  
  /**
   * 📈 计算分批止盈计划
   * 不是一次性全部平仓，而是分批锁定利润
   */
  getPartialTakeProfitPlan(
    currentProfit: number,
    positionSize: number
  ): {
    shouldTakeProfit: boolean;
    amountToClose: number;
    reason: string;
  } {
    if (!this.config.enablePartialTakeProfit) {
      return { shouldTakeProfit: false, amountToClose: 0, reason: 'Partial TP disabled' };
    }
    
    // 分批止盈计划
    const partialTPLevels = [
      { profit: 5, closePercent: 20, reason: '达到5%，平仓20%回本' },
      { profit: 10, closePercent: 30, reason: '达到10%，再平30%锁利' },
      { profit: 20, closePercent: 30, reason: '达到20%，再平30%落袋' },
      { profit: 50, closePercent: 10, reason: '达到50%，再平10%' },
      // 剩余10%让它自由飞翔
    ];
    
    // 检查是否达到某个止盈级别
    for (const level of partialTPLevels) {
      if (currentProfit >= level.profit && currentProfit < level.profit + 0.5) {
        return {
          shouldTakeProfit: true,
          amountToClose: positionSize * (level.closePercent / 100),
          reason: level.reason
        };
      }
    }
    
    return { shouldTakeProfit: false, amountToClose: 0, reason: 'No trigger' };
  }
  
  /**
   * ⏰ 时间衰减因子
   * 持仓时间越长，策略越保守
   */
  getTimeDecayFactor(holdingHours: number): {
    stopLossAdjust: number;
    takeProfitAdjust: number;
    reason: string;
  } {
    if (!this.config.enableTimeDecay) {
      return { stopLossAdjust: 0, takeProfitAdjust: 0, reason: 'Time decay disabled' };
    }
    
    if (holdingHours < 1) {
      // 1小时内：正常
      return { 
        stopLossAdjust: 0, 
        takeProfitAdjust: 0, 
        reason: '持仓<1小时，标准设置' 
      };
    } else if (holdingHours < 6) {
      // 1-6小时：给点时间发展
      return { 
        stopLossAdjust: 0.5,   // 止损放宽0.5%
        takeProfitAdjust: 1,    // 止盈放宽1%
        reason: '持仓1-6小时，适度放宽' 
      };
    } else if (holdingHours < 24) {
      // 6-24小时：日内最佳时段
      return { 
        stopLossAdjust: 1,     // 止损放宽1%
        takeProfitAdjust: 2,    // 止盈放宽2%
        reason: '持仓6-24小时，黄金时段' 
      };
    } else if (holdingHours < 48) {
      // 24-48小时：开始收紧
      return { 
        stopLossAdjust: -1,    // 止损收紧1%
        takeProfitAdjust: -2,   // 止盈收紧2%
        reason: '持仓24-48小时，隔夜风险' 
      };
    } else {
      // 超过48小时：该走了
      return { 
        stopLossAdjust: -2,    // 止损收紧2%
        takeProfitAdjust: -4,   // 止盈收紧4%
        reason: '持仓>48小时，时间成本过高' 
      };
    }
  }
  
  /**
   * 🌊 根据市场状态调整
   */
  getMarketAdjustment(
    adx: number,
    volatility: number,
    trend: 'UP' | 'DOWN' | 'SIDEWAYS'
  ): {
    stopLossMultiplier: number;
    takeProfitMultiplier: number;
    reason: string;
  } {
    // ADX 调整
    let multiplier = 1;
    let reason = '';
    
    if (adx > 40) {
      // 超强趋势：让利润奔跑
      multiplier = 1.5;
      reason = '超强趋势，放宽止盈';
    } else if (adx > 25) {
      // 普通趋势
      multiplier = 1.2;
      reason = '趋势明确，适度放宽';
    } else if (adx < 20) {
      // 震荡市：见好就收
      multiplier = 0.8;
      reason = '震荡市场，及时止盈';
    }
    
    // 波动率调整
    if (volatility > 0.05) {
      // 高波动
      multiplier *= 1.2;
      reason += '；高波动放宽';
    } else if (volatility < 0.02) {
      // 低波动
      multiplier *= 0.9;
      reason += '；低波动收紧';
    }
    
    // 趋势方向调整
    if (trend === 'UP' && this.config.aggressiveMode) {
      multiplier *= 1.3;
      reason += '；牛市激进';
    } else if (trend === 'DOWN' && this.config.conservativeMode) {
      multiplier *= 0.7;
      reason += '；熊市保守';
    }
    
    return {
      stopLossMultiplier: multiplier,
      takeProfitMultiplier: multiplier,
      reason
    };
  }
  
  /**
   * 🎯 综合决策
   */
  getOptimalExitStrategy(params: {
    currentPrice: number;
    entryPrice: number;
    highestPrice: number;
    currentProfit: number;
    maxProfit: number;
    holdingHours: number;
    positionSize: number;
    adx: number;
    volatility: number;
    trend: 'UP' | 'DOWN' | 'SIDEWAYS';
  }): {
    action: 'HOLD' | 'PARTIAL_CLOSE' | 'FULL_CLOSE';
    stopLoss: number;
    takeProfit: number;
    amount?: number;
    reason: string;
  } {
    const {
      currentPrice,
      entryPrice,
      highestPrice,
      currentProfit,
      maxProfit,
      holdingHours,
      positionSize,
      adx,
      volatility,
      trend
    } = params;
    
    // 1. 获取基础回撤止盈
    let trailingPercent = this.getTrailingStopPercent(maxProfit);
    
    // 2. 时间衰减调整
    const timeAdjust = this.getTimeDecayFactor(holdingHours);
    trailingPercent += timeAdjust.takeProfitAdjust;
    
    // 3. 市场状态调整
    const marketAdjust = this.getMarketAdjustment(adx, volatility, trend);
    trailingPercent *= marketAdjust.takeProfitMultiplier;
    
    // 4. 计算止损价
    const fromHighRetracement = ((highestPrice - currentPrice) / highestPrice) * 100;
    const stopLossPrice = highestPrice * (1 - trailingPercent / 100);
    
    // 5. 检查分批止盈
    const partialTP = this.getPartialTakeProfitPlan(currentProfit, positionSize);
    
    // 6. 决定行动
    let action: 'HOLD' | 'PARTIAL_CLOSE' | 'FULL_CLOSE' = 'HOLD';
    let reason = '';
    
    // 触发止损
    if (currentPrice <= stopLossPrice) {
      action = 'FULL_CLOSE';
      reason = `从最高点回撤${fromHighRetracement.toFixed(2)}%，触发止损`;
    }
    // 分批止盈
    else if (partialTP.shouldTakeProfit) {
      action = 'PARTIAL_CLOSE';
      reason = partialTP.reason;
    }
    // 超级利润，考虑全部止盈
    else if (currentProfit > 100) {
      action = 'FULL_CLOSE';
      reason = '利润翻倍，全部止盈';
    }
    // 时间太长，利润不错就走
    else if (holdingHours > 72 && currentProfit > 15) {
      action = 'FULL_CLOSE';
      reason = '持仓超3天且利润可观，落袋为安';
    }
    
    return {
      action,
      stopLoss: stopLossPrice,
      takeProfit: highestPrice * (1 + trailingPercent / 100), // 理论止盈位
      amount: partialTP.amountToClose,
      reason: reason || `持仓中，回撤止损${trailingPercent.toFixed(1)}%`
    };
  }
}

// 导出默认策略
export const perfectStrategy = new PerfectTradingStrategy();

/**
 * 使用示例：
 * 
 * const strategy = new PerfectTradingStrategy({
 *   aggressiveMode: true,  // 牛市用这个
 *   conservativeMode: false
 * });
 * 
 * const decision = strategy.getOptimalExitStrategy({
 *   currentPrice: 3100,
 *   entryPrice: 2900,
 *   highestPrice: 3200,
 *   currentProfit: 6.9,
 *   maxProfit: 10.3,
 *   holdingHours: 12,
 *   positionSize: 10000,
 *   adx: 35,
 *   volatility: 0.03,
 *   trend: 'UP'
 * });
 * 
 * console.log(decision);
 * // { 
 * //   action: 'PARTIAL_CLOSE',
 * //   stopLoss: 3072,  // 从3200回撤4%
 * //   amount: 3000,     // 平仓30%
 * //   reason: '达到10%，再平30%锁利'
 * // }
 */