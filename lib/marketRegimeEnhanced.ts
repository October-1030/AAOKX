// lib/marketRegimeEnhanced.ts
import type { MarketRegime, StrategyFlavor, TechnicalIndicators } from '@/types/trading';

export interface RegimeContext {
  price: number;      // 当前价格
  emaShort: number;   // 例如 EMA20
  emaMid: number;     // 例如 EMA50
  emaLong: number;    // 例如 EMA100 或 200
  macd: number;       // MACD 主线
  adx: number;        // 趋势强度
  atrPct: number;     // ATR(14) / price * 100
  rsi: number;        // RSI(14)
  zScore?: number;    // 可选：线性回归 Z-Score
  rSquared?: number;  // 可选：线性回归拟合度
}

export interface RegimeAnalysis {
  regime: MarketRegime;
  confidence: number;  // 0-1，对判断的置信度
  recommendedStrategy: StrategyFlavor;
  bias: 'LONG' | 'SHORT' | 'FLAT';
  shouldTrade: boolean;
  reasoning: string;
}

/**
 * 根据一组技术指标，判断当前市场属于哪种 regime
 */
export function detectMarketRegime(ctx: RegimeContext): MarketRegime {
  const { price, emaShort, emaMid, emaLong, macd, adx, atrPct, rsi } = ctx;

  // 安全保护：数据不全时一律当 RANGING
  if (!price || !emaShort || !emaMid || !emaLong || !atrPct) {
    return 'RANGING';
  }

  const emaBull = emaShort > emaMid && emaMid > emaLong;
  const emaBear = emaShort < emaMid && emaMid < emaLong;

  const strongTrend = adx >= 22;  // ADX>22 认为有趋势
  const weakTrend = adx < 18;     // ADX<18 认为偏震荡

  const highVol = atrPct >= 5;    // 波动 >5% 很剧烈
  const lowVol = atrPct <= 1.5;   // 波动 <1.5% 几乎不动

  // 1️⃣ 极端低波动：LOW_VOL
  if (lowVol && weakTrend) {
    return 'LOW_VOL';
  }

  // 2️⃣ 强趋势上涨：UPTREND
  if (emaBull && macd > 0 && strongTrend) {
    return 'UPTREND';
  }

  // 3️⃣ 强趋势下跌：DOWNTREND
  if (emaBear && macd < 0 && strongTrend) {
    return 'DOWNTREND';
  }

  // 4️⃣ CHOPPY：均线缠绕 + 波动大 + RSI 在中间抖
  const emaEntangled =
    Math.abs(emaShort - emaMid) / price < 0.005 &&
    Math.abs(emaMid - emaLong) / price < 0.005;

  const rsiMid = rsi >= 40 && rsi <= 60;

  if (emaEntangled && highVol && rsiMid) {
    return 'CHOPPY';
  }

  // 5️⃣ 默认：RANGING（震荡区间）
  if (weakTrend) {
    return 'RANGING';
  }

  // 兜底：方向不够明显，也当 RANGING
  return 'RANGING';
}

/**
 * 简单的方向判断：只在趋势里给 long/short，其他返回 FLAT
 */
export function getDirectionalBias(
  regime: MarketRegime
): 'LONG' | 'SHORT' | 'FLAT' {
  if (regime === 'UPTREND') return 'LONG';
  if (regime === 'DOWNTREND') return 'SHORT';
  return 'FLAT';
}

/**
 * ✅ 增强版：综合分析市场状态并推荐策略
 */
export function analyzeMarketRegime(ctx: RegimeContext): RegimeAnalysis {
  const regime = detectMarketRegime(ctx);
  const bias = getDirectionalBias(regime);

  let confidence = 0.5;
  let recommendedStrategy: StrategyFlavor = 'NO_TRADE';
  let shouldTrade = false;
  let reasoning = '';

  const { adx, atrPct, rsi, zScore, rSquared, macd } = ctx;

  switch (regime) {
    case 'UPTREND':
      confidence = Math.min(0.9, 0.5 + (adx - 22) / 100 + (rSquared || 0) * 0.3);
      recommendedStrategy = 'TREND_FOLLOWING';
      shouldTrade = true;
      reasoning = `Strong uptrend confirmed (ADX: ${adx.toFixed(1)}, EMA alignment). Follow the trend.`;
      break;

    case 'DOWNTREND':
      confidence = Math.min(0.9, 0.5 + (adx - 22) / 100 + (rSquared || 0) * 0.3);
      recommendedStrategy = 'TREND_FOLLOWING';
      shouldTrade = true;
      reasoning = `Strong downtrend confirmed (ADX: ${adx.toFixed(1)}, EMA alignment). Follow the trend SHORT.`;
      break;

    case 'RANGING':
      // 在震荡市场，检查是否有极端超买超卖
      const extremeOversold = rsi < 30 && (zScore || 0) < -1.5;
      const extremeOverbought = rsi > 70 && (zScore || 0) > 1.5;

      if (extremeOversold || extremeOverbought) {
        confidence = 0.65;
        recommendedStrategy = 'MEAN_REVERSION';
        shouldTrade = true;
        reasoning = extremeOversold
          ? `Ranging market with extreme oversold (RSI: ${rsi.toFixed(1)}, Z-Score: ${zScore?.toFixed(2)}). Mean reversion opportunity.`
          : `Ranging market with extreme overbought (RSI: ${rsi.toFixed(1)}, Z-Score: ${zScore?.toFixed(2)}). Mean reversion opportunity.`;
      } else {
        confidence = 0.4;
        recommendedStrategy = 'NO_TRADE';
        shouldTrade = false;
        reasoning = `Ranging market without extreme levels (RSI: ${rsi.toFixed(1)}). Wait for better setup.`;
      }
      break;

    case 'CHOPPY':
      confidence = 0.3;
      recommendedStrategy = 'NO_TRADE';
      shouldTrade = false;
      reasoning = `Choppy market detected (EMAs entangled, high volatility). Avoid trading - high risk of false breakouts.`;
      break;

    case 'LOW_VOL':
      // 低波动市场，只在极端情况或突破时交易
      if (atrPct < 1.0) {
        confidence = 0.2;
        recommendedStrategy = 'NO_TRADE';
        shouldTrade = false;
        reasoning = `Extremely low volatility (ATR: ${atrPct.toFixed(2)}%). No trading opportunity.`;
      } else {
        confidence = 0.4;
        recommendedStrategy = 'SCALPING';
        shouldTrade = false; // 需要人工确认
        reasoning = `Low volatility (ATR: ${atrPct.toFixed(2)}%). Only scalp if spreads are tight.`;
      }
      break;
  }

  return {
    regime,
    confidence,
    recommendedStrategy,
    bias,
    shouldTrade,
    reasoning,
  };
}

/**
 * ✅ 从 TechnicalIndicators 创建 RegimeContext
 */
export function createRegimeContext(indicators: TechnicalIndicators): RegimeContext {
  return {
    price: indicators.price,
    emaShort: indicators.ema_20,
    emaMid: indicators.ema_50,
    emaLong: indicators.ema_200,
    macd: indicators.macd,
    adx: indicators.market_regime.adx,
    atrPct: (indicators.atr_14 / indicators.price) * 100,
    rsi: indicators.rsi_14,
    zScore: indicators.linear_regression?.zScore,
    rSquared: indicators.linear_regression?.rSquared,
  };
}

/**
 * ✅ 格式化输出市场状态分析（用于日志）
 */
export function formatRegimeAnalysis(analysis: RegimeAnalysis): string {
  const { regime, confidence, recommendedStrategy, bias, shouldTrade, reasoning } = analysis;

  const tradeEmoji = shouldTrade ? '✅' : '❌';
  const biasEmoji = bias === 'LONG' ? '📈' : bias === 'SHORT' ? '📉' : '➖';

  return `
${tradeEmoji} Market Regime: ${regime} (${(confidence * 100).toFixed(0)}% confidence)
${biasEmoji} Directional Bias: ${bias}
🎯 Recommended Strategy: ${recommendedStrategy}
💡 Analysis: ${reasoning}
  `.trim();
}
