/**
 * 突破策略 (Breakout Strategy)
 * 
 * 在价格突破关键技术位置时入场，捕捉趋势开始的爆发性行情
 * 结合成交量确认突破的有效性
 */

import { Coin } from '@/types/trading';
import { calculateBollingerBands } from '../indicators';

export interface BreakoutSignal {
  type: 'RESISTANCE_BREAK' | 'SUPPORT_BREAK' | 'BOLLINGER_BREAK' | 'RANGE_BREAK' | 'NONE';
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  strength: number;        // 突破强度 0-100
  volumeConfirmed: boolean; // 成交量确认
  confidence: number;      // 信心水平 0-100
  entryPrice: number;     // 建议入场价
  stopLoss: number;       // 止损价
  takeProfit: number;     // 止盈价
  message: string;        // 信号描述
}

export interface SupportResistance {
  support: number[];      // 支撑位数组
  resistance: number[];   // 阻力位数组
  strongestSupport: number;
  strongestResistance: number;
}

/**
 * 识别支撑和阻力位
 */
export function identifySupportResistance(
  prices: number[],
  period: number = 20,
  sensitivity: number = 0.02
): SupportResistance {
  if (prices.length < period) {
    return {
      support: [],
      resistance: [],
      strongestSupport: 0,
      strongestResistance: 0
    };
  }

  const support: number[] = [];
  const resistance: number[] = [];
  const pricePoints: Map<number, number> = new Map();

  // 找出局部高点和低点
  for (let i = 1; i < prices.length - 1; i++) {
    const prev = prices[i - 1];
    const curr = prices[i];
    const next = prices[i + 1];

    // 局部低点（支撑）
    if (curr < prev && curr < next) {
      const rounded = Math.round(curr / 10) * 10; // 四舍五入到10
      pricePoints.set(rounded, (pricePoints.get(rounded) || 0) + 1);
      support.push(curr);
    }

    // 局部高点（阻力）
    if (curr > prev && curr > next) {
      const rounded = Math.round(curr / 10) * 10;
      pricePoints.set(rounded, (pricePoints.get(rounded) || 0) + 1);
      resistance.push(curr);
    }
  }

  // 聚类相近的价格点
  const clusters = clusterPrices([...support, ...resistance], sensitivity);
  
  // 区分支撑和阻力
  const currentPrice = prices[prices.length - 1];
  const finalSupport = clusters.filter(p => p < currentPrice).slice(-3); // 最近3个支撑位
  const finalResistance = clusters.filter(p => p > currentPrice).slice(0, 3); // 最近3个阻力位

  return {
    support: finalSupport,
    resistance: finalResistance,
    strongestSupport: finalSupport[finalSupport.length - 1] || currentPrice * 0.98,
    strongestResistance: finalResistance[0] || currentPrice * 1.02
  };
}

/**
 * 聚类相近的价格点
 */
function clusterPrices(prices: number[], threshold: number): number[] {
  if (prices.length === 0) return [];
  
  prices.sort((a, b) => a - b);
  const clusters: number[] = [];
  let clusterSum = prices[0];
  let clusterCount = 1;

  for (let i = 1; i < prices.length; i++) {
    if ((prices[i] - prices[i - 1]) / prices[i - 1] < threshold) {
      // 添加到当前聚类
      clusterSum += prices[i];
      clusterCount++;
    } else {
      // 开始新聚类
      clusters.push(clusterSum / clusterCount);
      clusterSum = prices[i];
      clusterCount = 1;
    }
  }
  clusters.push(clusterSum / clusterCount);

  return clusters;
}

/**
 * 检测布林带突破
 */
export function detectBollingerBreakout(
  prices: number[],
  volume: number,
  avgVolume: number,
  period: number = 20
): BreakoutSignal {
  const bb = calculateBollingerBands(prices, period);
  const currentPrice = prices[prices.length - 1];
  const prevPrice = prices[prices.length - 2];
  const volumeRatio = volume / avgVolume;

  // 检测挤压后的突破（Squeeze Breakout）
  if (bb.squeeze && bb.bandwidth < 2) {
    return {
      type: 'NONE',
      direction: 'NEUTRAL',
      strength: 0,
      volumeConfirmed: false,
      confidence: 0,
      entryPrice: currentPrice,
      stopLoss: currentPrice,
      takeProfit: currentPrice,
      message: '布林带挤压中，等待突破方向'
    };
  }

  // 向上突破上轨
  if (currentPrice > bb.upper && prevPrice <= bb.upper) {
    const strength = Math.min(100, (currentPrice - bb.upper) / bb.upper * 1000);
    const volumeConfirmed = volumeRatio > 1.5;
    const confidence = volumeConfirmed ? Math.min(90, strength + 20) : Math.min(70, strength);

    return {
      type: 'BOLLINGER_BREAK',
      direction: 'UP',
      strength,
      volumeConfirmed,
      confidence,
      entryPrice: currentPrice,
      stopLoss: bb.middle,
      takeProfit: currentPrice + (currentPrice - bb.middle),
      message: `突破布林带上轨${volumeConfirmed ? '（成交量确认）' : ''}`
    };
  }

  // 向下突破下轨
  if (currentPrice < bb.lower && prevPrice >= bb.lower) {
    const strength = Math.min(100, (bb.lower - currentPrice) / bb.lower * 1000);
    const volumeConfirmed = volumeRatio > 1.5;
    const confidence = volumeConfirmed ? Math.min(90, strength + 20) : Math.min(70, strength);

    return {
      type: 'BOLLINGER_BREAK',
      direction: 'DOWN',
      strength,
      volumeConfirmed,
      confidence,
      entryPrice: currentPrice,
      stopLoss: bb.middle,
      takeProfit: currentPrice - (bb.middle - currentPrice),
      message: `突破布林带下轨${volumeConfirmed ? '（成交量确认）' : ''}`
    };
  }

  return {
    type: 'NONE',
    direction: 'NEUTRAL',
    strength: 0,
    volumeConfirmed: false,
    confidence: 0,
    entryPrice: currentPrice,
    stopLoss: currentPrice,
    takeProfit: currentPrice,
    message: '无突破信号'
  };
}

/**
 * 检测支撑阻力突破
 */
export function detectSupportResistanceBreakout(
  prices: number[],
  volume: number,
  avgVolume: number
): BreakoutSignal {
  const sr = identifySupportResistance(prices);
  const currentPrice = prices[prices.length - 1];
  const prevPrice = prices[prices.length - 2];
  const volumeRatio = volume / avgVolume;

  // 突破阻力位
  if (sr.strongestResistance > 0) {
    const distanceToResistance = (currentPrice - sr.strongestResistance) / sr.strongestResistance;
    
    if (currentPrice > sr.strongestResistance && prevPrice <= sr.strongestResistance) {
      const strength = Math.min(100, distanceToResistance * 1000);
      const volumeConfirmed = volumeRatio > 1.8;
      const confidence = volumeConfirmed ? Math.min(85, strength + 30) : Math.min(60, strength + 10);

      return {
        type: 'RESISTANCE_BREAK',
        direction: 'UP',
        strength,
        volumeConfirmed,
        confidence,
        entryPrice: currentPrice,
        stopLoss: sr.strongestResistance * 0.98,
        takeProfit: sr.strongestResistance * 1.05,
        message: `突破关键阻力位 $${sr.strongestResistance.toFixed(2)}`
      };
    }
  }

  // 跌破支撑位
  if (sr.strongestSupport > 0) {
    const distanceToSupport = (sr.strongestSupport - currentPrice) / sr.strongestSupport;
    
    if (currentPrice < sr.strongestSupport && prevPrice >= sr.strongestSupport) {
      const strength = Math.min(100, distanceToSupport * 1000);
      const volumeConfirmed = volumeRatio > 1.8;
      const confidence = volumeConfirmed ? Math.min(85, strength + 30) : Math.min(60, strength + 10);

      return {
        type: 'SUPPORT_BREAK',
        direction: 'DOWN',
        strength,
        volumeConfirmed,
        confidence,
        entryPrice: currentPrice,
        stopLoss: sr.strongestSupport * 1.02,
        takeProfit: sr.strongestSupport * 0.95,
        message: `跌破关键支撑位 $${sr.strongestSupport.toFixed(2)}`
      };
    }
  }

  return {
    type: 'NONE',
    direction: 'NEUTRAL',
    strength: 0,
    volumeConfirmed: false,
    confidence: 0,
    entryPrice: currentPrice,
    stopLoss: currentPrice,
    takeProfit: currentPrice,
    message: '价格在支撑阻力区间内'
  };
}

/**
 * 综合突破策略分析
 */
export function analyzeBreakout(
  coin: Coin,
  prices: number[],
  volume: number,
  avgVolume: number,
  volatility: number,
  trend: 'UP' | 'DOWN' | 'SIDEWAYS'
): BreakoutSignal {
  // 检测布林带突破
  const bbBreakout = detectBollingerBreakout(prices, volume, avgVolume);
  
  // 检测支撑阻力突破
  const srBreakout = detectSupportResistanceBreakout(prices, volume, avgVolume);

  // 选择更强的信号
  let bestSignal = bbBreakout.confidence > srBreakout.confidence ? bbBreakout : srBreakout;

  // 趋势确认
  if (bestSignal.direction === 'UP' && trend === 'DOWN') {
    bestSignal.confidence *= 0.7; // 逆势降低信心
    bestSignal.message += ' (逆势警告)';
  } else if (bestSignal.direction === trend) {
    bestSignal.confidence = Math.min(100, bestSignal.confidence * 1.2); // 顺势增加信心
    bestSignal.message += ' (顺势确认)';
  }

  // 波动率调整
  if (volatility > 0.05) {
    // 高波动率，扩大止损
    bestSignal.stopLoss = bestSignal.entryPrice * (bestSignal.direction === 'UP' ? 0.97 : 1.03);
    bestSignal.message += ' (高波动率)';
  }

  return bestSignal;
}

/**
 * 生成突破交易决策
 */
export function generateBreakoutDecision(
  coin: Coin,
  breakoutSignal: BreakoutSignal,
  accountBalance: number,
  maxRiskPercent: number = 0.02
): {
  shouldTrade: boolean;
  action: 'buy_to_enter' | 'sell_to_enter' | 'hold';
  leverage: number;
  notional: number;
  stopLoss: number;
  takeProfit: number;
  reason: string;
} {
  // 信心阈值
  const MIN_CONFIDENCE = 65;

  if (breakoutSignal.confidence < MIN_CONFIDENCE) {
    return {
      shouldTrade: false,
      action: 'hold',
      leverage: 0,
      notional: 0,
      stopLoss: 0,
      takeProfit: 0,
      reason: `信心不足 (${breakoutSignal.confidence.toFixed(0)}% < ${MIN_CONFIDENCE}%)`
    };
  }

  if (!breakoutSignal.volumeConfirmed) {
    return {
      shouldTrade: false,
      action: 'hold',
      leverage: 0,
      notional: 0,
      stopLoss: 0,
      takeProfit: 0,
      reason: '成交量未确认突破'
    };
  }

  // 计算仓位大小（基于风险）
  const riskAmount = accountBalance * maxRiskPercent;
  const stopLossPercent = Math.abs(breakoutSignal.entryPrice - breakoutSignal.stopLoss) / breakoutSignal.entryPrice;
  const positionSize = riskAmount / stopLossPercent;

  // 根据信心调整杠杆
  const leverage = Math.min(20, Math.floor(10 + (breakoutSignal.confidence / 100) * 10));

  // 最终交易金额
  const notional = Math.min(positionSize, accountBalance * 0.3);

  return {
    shouldTrade: true,
    action: breakoutSignal.direction === 'UP' ? 'buy_to_enter' : 'sell_to_enter',
    leverage,
    notional,
    stopLoss: breakoutSignal.stopLoss,
    takeProfit: breakoutSignal.takeProfit,
    reason: breakoutSignal.message
  };
}

/**
 * 突破策略适用性评分
 */
export function evaluateBreakoutSuitability(
  adx: number,
  volatility: number,
  volumeTrend: 'INCREASING' | 'DECREASING' | 'STABLE',
  priceNearKey: boolean
): {
  score: number;
  suitable: boolean;
  reason: string;
} {
  let score = 0;
  const reasons: string[] = [];

  // ADX 评分（高 ADX 适合突破）
  if (adx > 30) {
    score += 40;
    reasons.push('强趋势环境(ADX>30)');
  } else if (adx > 25) {
    score += 25;
    reasons.push('趋势形成中');
  } else if (adx < 20) {
    score += 10;
    reasons.push('可能出现挤压突破');
  }

  // 波动率评分
  if (volatility > 0.03 && volatility < 0.06) {
    score += 30;
    reasons.push('波动率适合突破交易');
  } else if (volatility < 0.02) {
    score += 15;
    reasons.push('低波动可能爆发');
  } else if (volatility > 0.08) {
    score -= 10;
    reasons.push('波动过大风险高');
  }

  // 成交量趋势
  if (volumeTrend === 'INCREASING') {
    score += 20;
    reasons.push('成交量递增');
  } else if (volumeTrend === 'DECREASING') {
    score -= 10;
    reasons.push('成交量萎缩');
  }

  // 价格位置
  if (priceNearKey) {
    score += 10;
    reasons.push('接近关键价位');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    suitable: score > 50,
    reason: reasons.join('; ')
  };
}