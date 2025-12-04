/**
 * 网格交易策略 (Grid Trading Strategy)
 * 
 * 在震荡市场中通过设置多个买卖价格点来捕捉价格波动
 * 适用于横盘整理的市场环境
 */

import { Coin } from '@/types/trading';

export interface GridLevel {
  price: number;
  type: 'BUY' | 'SELL';
  executed: boolean;
  orderId?: string;
  quantity?: number;
}

export interface GridConfig {
  coin: Coin;
  upperPrice: number;      // 网格上限
  lowerPrice: number;      // 网格下限
  gridCount: number;       // 网格数量
  totalAmount: number;     // 总投资金额
  currentPrice: number;    // 当前价格
}

export interface GridAnalysis {
  levels: GridLevel[];
  profitPotential: number;  // 潜在收益率
  riskLevel: string;        // 风险等级
  recommendation: string;   // 策略建议
  optimalGridCount: number; // 最优网格数
}

/**
 * 计算网格交易水平线
 */
export function calculateGridLevels(config: GridConfig): GridLevel[] {
  const { upperPrice, lowerPrice, gridCount, currentPrice } = config;
  
  // 计算网格间距
  const gridSpacing = (upperPrice - lowerPrice) / (gridCount - 1);
  const levels: GridLevel[] = [];
  
  // 生成网格水平线
  for (let i = 0; i < gridCount; i++) {
    const price = lowerPrice + (gridSpacing * i);
    
    // 确定是买入还是卖出网格
    const type: 'BUY' | 'SELL' = price < currentPrice ? 'BUY' : 'SELL';
    
    levels.push({
      price: Number(price.toFixed(2)),
      type,
      executed: false
    });
  }
  
  return levels;
}

/**
 * 计算每个网格的交易量
 */
export function calculateGridQuantity(
  config: GridConfig,
  levels: GridLevel[]
): GridLevel[] {
  const { totalAmount, currentPrice } = config;
  
  // 计算买入网格数量
  const buyLevels = levels.filter(l => l.type === 'BUY').length;
  
  // 平均分配资金到每个买入网格
  const amountPerGrid = buyLevels > 0 ? totalAmount / buyLevels : 0;
  
  return levels.map(level => ({
    ...level,
    quantity: level.type === 'BUY' 
      ? Number((amountPerGrid / level.price).toFixed(6))
      : Number((amountPerGrid / level.price).toFixed(6)) // 卖出数量与买入匹配
  }));
}

/**
 * 分析网格策略的收益潜力
 */
export function analyzeGridProfitability(
  config: GridConfig,
  volatility: number
): GridAnalysis {
  const levels = calculateGridLevels(config);
  const levelsWithQty = calculateGridQuantity(config, levels);
  
  // 计算单次网格利润
  const gridSpacing = (config.upperPrice - config.lowerPrice) / (config.gridCount - 1);
  const gridProfitPercent = (gridSpacing / config.currentPrice) * 100;
  
  // 估算日收益（基于波动率）
  const estimatedDailyTrades = Math.floor(volatility * 100); // 简化估算
  const dailyProfitPotential = gridProfitPercent * estimatedDailyTrades;
  
  // 风险评估
  let riskLevel = 'LOW';
  let recommendation = '';
  
  const priceRange = ((config.upperPrice - config.lowerPrice) / config.currentPrice) * 100;
  
  if (priceRange > 20) {
    riskLevel = 'HIGH';
    recommendation = '网格范围过大，建议缩小到10-15%';
  } else if (priceRange < 5) {
    riskLevel = 'LOW';
    recommendation = '网格范围过小，可能错失获利机会';
  } else if (volatility < 0.01) {
    riskLevel = 'LOW';
    recommendation = '当前波动率较低，网格交易效果可能有限';
  } else if (volatility > 0.05) {
    riskLevel = 'MEDIUM';
    recommendation = '高波动市场，建议扩大网格间距';
  } else {
    riskLevel = 'OPTIMAL';
    recommendation = '当前设置适合震荡市场网格交易';
  }
  
  // 计算最优网格数（基于波动率和资金）
  const optimalGridCount = Math.max(5, Math.min(20, Math.floor(10 + volatility * 100)));
  
  return {
    levels: levelsWithQty,
    profitPotential: dailyProfitPotential,
    riskLevel,
    recommendation,
    optimalGridCount
  };
}

/**
 * 检查是否应该执行网格订单
 */
export function checkGridExecution(
  currentPrice: number,
  levels: GridLevel[]
): GridLevel | null {
  // 查找最接近当前价格且未执行的网格
  for (const level of levels) {
    if (!level.executed) {
      const priceDistance = Math.abs(currentPrice - level.price) / level.price;
      
      // 如果价格接近网格线（0.1%以内）
      if (priceDistance < 0.001) {
        return level;
      }
      
      // 买入网格：价格下跌穿过网格线
      if (level.type === 'BUY' && currentPrice <= level.price) {
        return level;
      }
      
      // 卖出网格：价格上涨穿过网格线
      if (level.type === 'SELL' && currentPrice >= level.price) {
        return level;
      }
    }
  }
  
  return null;
}

/**
 * 动态调整网格参数
 */
export function adaptiveGridParameters(
  volatility: number,
  trend: 'UP' | 'DOWN' | 'SIDEWAYS',
  volume: number,
  avgVolume: number
): Partial<GridConfig> {
  let gridCount = 10;
  let priceRangePercent = 0.1; // 10% 默认范围
  
  // 根据波动率调整
  if (volatility > 0.04) {
    // 高波动：增加网格数，扩大范围
    gridCount = 15;
    priceRangePercent = 0.15;
  } else if (volatility < 0.02) {
    // 低波动：减少网格数，缩小范围
    gridCount = 8;
    priceRangePercent = 0.08;
  }
  
  // 根据趋势微调
  if (trend === 'UP') {
    // 上升趋势：上方网格多一些
    priceRangePercent *= 1.2;
  } else if (trend === 'DOWN') {
    // 下降趋势：下方网格多一些
    priceRangePercent *= 1.2;
  }
  
  // 根据成交量调整
  const volumeRatio = volume / avgVolume;
  if (volumeRatio > 2) {
    // 高成交量：可能有突破，暂停网格
    return {
      gridCount: 0 // 信号：暂停网格交易
    };
  }
  
  return {
    gridCount,
    // 上下限基于当前价格和百分比范围
    upperPrice: 1 + priceRangePercent / 2,
    lowerPrice: 1 - priceRangePercent / 2
  };
}

/**
 * 网格策略适用性评分
 */
export function evaluateGridSuitability(
  adx: number,
  rSquared: number,
  volatility: number,
  priceRange24h: number
): {
  score: number;
  suitable: boolean;
  reason: string;
} {
  let score = 0;
  const reasons: string[] = [];
  
  // ADX 评分（低 ADX 适合网格）
  if (adx < 20) {
    score += 40;
    reasons.push('市场处于震荡状态(ADX<20)');
  } else if (adx < 25) {
    score += 20;
    reasons.push('市场趋势较弱');
  } else {
    score -= 20;
    reasons.push('市场趋势强烈，不适合网格');
  }
  
  // R² 评分（低 R² 表示无明显趋势）
  if (rSquared < 0.3) {
    score += 30;
    reasons.push('价格无明显线性趋势');
  } else if (rSquared < 0.5) {
    score += 15;
  } else {
    score -= 10;
    reasons.push('价格趋势明显');
  }
  
  // 波动率评分（适中波动率最佳）
  if (volatility > 0.02 && volatility < 0.04) {
    score += 30;
    reasons.push('波动率适中，适合网格获利');
  } else if (volatility < 0.01) {
    score -= 10;
    reasons.push('波动率过低');
  } else if (volatility > 0.05) {
    score -= 5;
    reasons.push('波动率过高，需谨慎');
  }
  
  // 24小时价格范围
  if (priceRange24h > 0.03 && priceRange24h < 0.08) {
    score += 20;
    reasons.push('日内波动范围理想');
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    suitable: score > 50,
    reason: reasons.join('; ')
  };
}

/**
 * 生成网格交易决策
 */
export function generateGridDecision(
  coin: Coin,
  currentPrice: number,
  accountBalance: number,
  marketData: {
    adx: number;
    rSquared: number;
    volatility: number;
    priceRange24h: number;
  }
): {
  shouldTrade: boolean;
  config?: GridConfig;
  message: string;
} {
  // 评估网格策略适用性
  const suitability = evaluateGridSuitability(
    marketData.adx,
    marketData.rSquared,
    marketData.volatility,
    marketData.priceRange24h
  );
  
  if (!suitability.suitable) {
    return {
      shouldTrade: false,
      message: `网格交易不适合当前市场: ${suitability.reason}`
    };
  }
  
  // 获取自适应参数
  const adaptiveParams = adaptiveGridParameters(
    marketData.volatility,
    'SIDEWAYS',
    1.0,
    1.0
  );
  
  if (adaptiveParams.gridCount === 0) {
    return {
      shouldTrade: false,
      message: '市场异常，暂停网格交易'
    };
  }
  
  // 生成网格配置
  const config: GridConfig = {
    coin,
    upperPrice: currentPrice * (adaptiveParams.upperPrice || 1.05),
    lowerPrice: currentPrice * (adaptiveParams.lowerPrice || 0.95),
    gridCount: adaptiveParams.gridCount || 10,
    totalAmount: Math.min(accountBalance * 0.3, 5000), // 最多使用30%资金
    currentPrice
  };
  
  return {
    shouldTrade: true,
    config,
    message: `启动网格交易: ${suitability.reason}`
  };
}