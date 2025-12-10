// lib/marketRegime.ts
import type { MarketRegime } from '@/types/trading';

export interface RegimeContext {
  price: number;      // 当前价格
  emaShort: number;   // 例如 EMA20
  emaMid: number;     // 例如 EMA50
  emaLong: number;    // 例如 EMA100 或 200
  macd: number;       // MACD 主线
  adx: number;        // 趋势强度
  atrPct: number;     // ATR(14) / price * 100
  rsi: number;        // RSI(14)
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
