/**
 * 自适应参数系统 (Adaptive Parameter System)
 * 
 * 根据市场状态、历史表现、风险指标自动调整策略参数
 * 实现智能化的参数优化和风险控制
 */

import { Coin } from '@/types/trading';

export interface MarketConditions {
  volatility: number;           // 波动率
  trend: 'UP' | 'DOWN' | 'SIDEWAYS';
  volume: number;              // 当前成交量
  avgVolume: number;           // 平均成交量
  adx: number;                 // 趋势强度
  rSquared: number;            // 线性回归R²
  marketRegime: 'TRENDING' | 'RANGING' | 'TRANSITIONING';
}

export interface PerformanceMetrics {
  winRate: number;             // 胜率
  avgProfit: number;           // 平均盈利
  avgLoss: number;             // 平均亏损
  sharpeRatio: number;         // 夏普比率
  maxDrawdown: number;         // 最大回撤
  consecutiveWins: number;     // 连胜次数
  consecutiveLosses: number;   // 连亏次数
  recentTrades: TradeResult[];
}

export interface TradeResult {
  timestamp: number;
  coin: Coin;
  profit: number;
  profitPercent: number;
  duration: number;
  strategy: string;
}

export interface AdaptiveParameters {
  // 风险管理
  leverage: number;            // 杠杆倍数
  positionSize: number;        // 仓位大小（占总资金百分比）
  stopLoss: number;           // 止损百分比
  takeProfit: number;         // 止盈百分比
  maxPositions: number;       // 最大持仓数
  
  // 策略参数
  strategyType: 'GRID' | 'BREAKOUT' | 'MEAN_REVERSION' | 'TREND_FOLLOWING' | 'MIXED';
  entryThreshold: number;     // 入场信号阈值
  exitThreshold: number;      // 出场信号阈值
  
  // 网格参数
  gridCount?: number;         // 网格数量
  gridSpacing?: number;       // 网格间距
  
  // 技术指标周期
  emaPeriod?: number;         // EMA 周期
  rsiPeriod?: number;         // RSI 周期
  bbPeriod?: number;          // 布林带周期
  
  // 调整原因
  adjustmentReason: string;
}

/**
 * 计算近期交易表现
 */
export function calculatePerformance(trades: TradeResult[]): PerformanceMetrics {
  if (trades.length === 0) {
    return {
      winRate: 0.5,
      avgProfit: 0,
      avgLoss: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      recentTrades: []
    };
  }

  const wins = trades.filter(t => t.profit > 0);
  const losses = trades.filter(t => t.profit < 0);
  
  const winRate = wins.length / trades.length;
  const avgProfit = wins.length > 0 
    ? wins.reduce((sum, t) => sum + t.profitPercent, 0) / wins.length 
    : 0;
  const avgLoss = losses.length > 0 
    ? Math.abs(losses.reduce((sum, t) => sum + t.profitPercent, 0) / losses.length)
    : 0;

  // 计算连续盈亏
  let consecutiveWins = 0;
  let consecutiveLosses = 0;
  let currentStreak = 0;
  let isWinStreak = trades[trades.length - 1]?.profit > 0;

  for (let i = trades.length - 1; i >= 0; i--) {
    if ((trades[i].profit > 0) === isWinStreak) {
      currentStreak++;
    } else {
      break;
    }
  }

  if (isWinStreak) {
    consecutiveWins = currentStreak;
  } else {
    consecutiveLosses = currentStreak;
  }

  // 简化的夏普比率计算
  const returns = trades.map(t => t.profitPercent);
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  );
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  // 最大回撤计算
  let peak = 0;
  let maxDrawdown = 0;
  let cumulative = 0;
  
  for (const trade of trades) {
    cumulative += trade.profitPercent;
    peak = Math.max(peak, cumulative);
    const drawdown = (peak - cumulative) / Math.abs(peak || 1);
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  return {
    winRate,
    avgProfit,
    avgLoss,
    sharpeRatio,
    maxDrawdown,
    consecutiveWins,
    consecutiveLosses,
    recentTrades: trades.slice(-10) // 最近10笔交易
  };
}

/**
 * 基于市场条件调整参数
 */
export function adaptToMarket(
  conditions: MarketConditions,
  baseParams: AdaptiveParameters
): AdaptiveParameters {
  const adjusted = { ...baseParams };
  const reasons: string[] = [];

  // 波动率调整
  if (conditions.volatility > 0.05) {
    // 高波动：降低杠杆，扩大止损
    adjusted.leverage = Math.max(5, baseParams.leverage * 0.7);
    adjusted.stopLoss = baseParams.stopLoss * 1.5;
    adjusted.positionSize = baseParams.positionSize * 0.8;
    reasons.push('高波动降低风险');
  } else if (conditions.volatility < 0.02) {
    // 低波动：可以适度增加杠杆，收紧止损
    adjusted.leverage = Math.min(20, baseParams.leverage * 1.2);
    adjusted.stopLoss = baseParams.stopLoss * 0.8;
    adjusted.gridSpacing = 0.005; // 缩小网格间距
    reasons.push('低波动优化参数');
  }

  // 趋势调整
  if (conditions.trend === 'UP' && conditions.adx > 25) {
    adjusted.strategyType = 'TREND_FOLLOWING';
    adjusted.entryThreshold *= 0.9; // 更容易做多
    reasons.push('上升趋势跟随');
  } else if (conditions.trend === 'DOWN' && conditions.adx > 25) {
    adjusted.strategyType = 'TREND_FOLLOWING';
    adjusted.positionSize *= 0.7; // 下跌趋势减小仓位
    reasons.push('下降趋势谨慎');
  } else if (conditions.marketRegime === 'RANGING') {
    adjusted.strategyType = conditions.volatility > 0.02 ? 'GRID' : 'MEAN_REVERSION';
    adjusted.gridCount = Math.floor(10 + conditions.volatility * 200);
    reasons.push('震荡市场网格/均值回归');
  }

  // 成交量调整
  const volumeRatio = conditions.volume / conditions.avgVolume;
  if (volumeRatio > 2) {
    adjusted.strategyType = 'BREAKOUT';
    adjusted.entryThreshold *= 0.8; // 降低突破门槛
    reasons.push('高成交量突破机会');
  } else if (volumeRatio < 0.5) {
    adjusted.maxPositions = Math.max(1, baseParams.maxPositions - 1);
    reasons.push('低成交量减少持仓');
  }

  adjusted.adjustmentReason = reasons.join('; ');
  return adjusted;
}

/**
 * 基于历史表现调整参数
 */
export function adaptToPerformance(
  performance: PerformanceMetrics,
  baseParams: AdaptiveParameters
): AdaptiveParameters {
  const adjusted = { ...baseParams };
  const reasons: string[] = [];

  // 胜率调整
  if (performance.winRate < 0.4) {
    // 低胜率：更保守
    adjusted.leverage = Math.max(5, baseParams.leverage * 0.8);
    adjusted.positionSize = baseParams.positionSize * 0.7;
    adjusted.entryThreshold *= 1.2; // 提高入场标准
    reasons.push('低胜率保守调整');
  } else if (performance.winRate > 0.65) {
    // 高胜率：可以适度激进
    adjusted.leverage = Math.min(20, baseParams.leverage * 1.1);
    adjusted.positionSize = Math.min(0.3, baseParams.positionSize * 1.2);
    reasons.push('高胜率增加仓位');
  }

  // 连续盈亏调整
  if (performance.consecutiveLosses >= 3) {
    // 连亏：大幅降低风险
    adjusted.leverage = 5;
    adjusted.positionSize = 0.05;
    adjusted.maxPositions = 1;
    reasons.push(`连续${performance.consecutiveLosses}次亏损降低风险`);
  } else if (performance.consecutiveWins >= 3) {
    // 连胜：适度增加但防止过度自信
    adjusted.positionSize = Math.min(0.2, baseParams.positionSize * 1.1);
    reasons.push(`连续${performance.consecutiveWins}次盈利谨慎加仓`);
  }

  // 夏普比率调整
  if (performance.sharpeRatio < 0) {
    adjusted.strategyType = 'MEAN_REVERSION'; // 切换到更稳定策略
    reasons.push('夏普比率为负切换策略');
  } else if (performance.sharpeRatio > 2) {
    adjusted.leverage = Math.min(20, baseParams.leverage * 1.2);
    reasons.push('优秀夏普比率增加杠杆');
  }

  // 回撤控制
  if (performance.maxDrawdown > 0.15) {
    // 大回撤：紧急风控
    adjusted.leverage = 5;
    adjusted.stopLoss = 0.02; // 2%止损
    adjusted.maxPositions = 1;
    reasons.push(`最大回撤${(performance.maxDrawdown * 100).toFixed(1)}%紧急风控`);
  }

  adjusted.adjustmentReason = baseParams.adjustmentReason + '; ' + reasons.join('; ');
  return adjusted;
}

/**
 * 综合自适应系统
 */
export function getAdaptiveParameters(
  market: MarketConditions,
  performance: PerformanceMetrics,
  accountBalance: number,
  currentPositions: number
): AdaptiveParameters {
  // 基础参数
  const baseParams: AdaptiveParameters = {
    leverage: 10,
    positionSize: 0.1,
    stopLoss: 0.03,
    takeProfit: 0.06,
    maxPositions: 3,
    strategyType: 'MIXED',
    entryThreshold: 0.65,
    exitThreshold: 0.5,
    gridCount: 10,
    gridSpacing: 0.01,
    emaPeriod: 20,
    rsiPeriod: 14,
    bbPeriod: 20,
    adjustmentReason: '基础参数'
  };

  // 步骤1：根据市场调整
  let params = adaptToMarket(market, baseParams);

  // 步骤2：根据表现调整
  params = adaptToPerformance(performance, params);

  // 步骤3：资金管理调整
  if (accountBalance < 1000) {
    params.maxPositions = 1;
    params.leverage = Math.min(params.leverage, 8);
    params.adjustmentReason += '; 小资金限制';
  } else if (accountBalance > 10000) {
    params.maxPositions = Math.min(5, params.maxPositions);
    params.adjustmentReason += '; 大资金分散';
  }

  // 步骤4：持仓限制
  if (currentPositions >= params.maxPositions) {
    params.positionSize = 0; // 达到最大持仓
    params.adjustmentReason += '; 已达最大持仓';
  }

  return params;
}

/**
 * 策略选择器
 */
export function selectOptimalStrategy(
  market: MarketConditions,
  performance: PerformanceMetrics
): {
  primary: string;
  secondary: string;
  allocation: { [key: string]: number };
  reason: string;
} {
  const strategies: { [key: string]: number } = {};
  const reasons: string[] = [];

  // 基于市场状态评分
  if (market.marketRegime === 'RANGING') {
    if (market.volatility > 0.02 && market.volatility < 0.04) {
      strategies['GRID'] = 40;
      reasons.push('震荡市场适合网格');
    }
    strategies['MEAN_REVERSION'] = 30;
    reasons.push('震荡市场均值回归');
  } else if (market.marketRegime === 'TRENDING') {
    strategies['TREND_FOLLOWING'] = 40;
    strategies['BREAKOUT'] = 20;
    reasons.push('趋势市场顺势交易');
  }

  // 基于成交量
  if (market.volume > market.avgVolume * 1.5) {
    strategies['BREAKOUT'] = (strategies['BREAKOUT'] || 0) + 20;
    reasons.push('高成交量突破机会');
  }

  // 基于历史表现
  if (performance.winRate > 0.6) {
    // 当前策略效果好，保持
    const lastStrategy = performance.recentTrades[performance.recentTrades.length - 1]?.strategy;
    if (lastStrategy) {
      strategies[lastStrategy] = (strategies[lastStrategy] || 0) + 20;
      reasons.push(`${lastStrategy}表现良好`);
    }
  }

  // 归一化权重
  const total = Object.values(strategies).reduce((sum, v) => sum + v, 0);
  if (total > 0) {
    Object.keys(strategies).forEach(key => {
      strategies[key] = strategies[key] / total;
    });
  } else {
    // 默认策略
    strategies['MEAN_REVERSION'] = 0.5;
    strategies['TREND_FOLLOWING'] = 0.5;
  }

  // 排序获取主次策略
  const sorted = Object.entries(strategies).sort((a, b) => b[1] - a[1]);
  
  return {
    primary: sorted[0]?.[0] || 'MEAN_REVERSION',
    secondary: sorted[1]?.[0] || 'TREND_FOLLOWING',
    allocation: strategies,
    reason: reasons.join('; ')
  };
}