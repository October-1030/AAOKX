// 技术指标计算库

export interface CandleStick {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * 计算EMA (指数移动平均)
 */
export function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];

  // 第一个EMA值使用SMA
  let sum = 0;
  for (let i = 0; i < period && i < data.length; i++) {
    sum += data[i];
  }
  ema[period - 1] = sum / period;

  // 后续EMA计算
  for (let i = period; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }

  return ema;
}

/**
 * 计算MACD (移动平均收敛散度)
 */
export function calculateMACD(data: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  const macdLine: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i] !== undefined && slowEMA[i] !== undefined) {
      macdLine[i] = fastEMA[i] - slowEMA[i];
    }
  }

  const signalLine = calculateEMA(macdLine.filter(v => v !== undefined), signalPeriod);
  const histogram: number[] = [];

  let signalIndex = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== undefined && signalLine[signalIndex] !== undefined) {
      histogram[i] = macdLine[i] - signalLine[signalIndex];
      signalIndex++;
    }
  }

  return {
    macd: macdLine[macdLine.length - 1] || 0,
    signal: signalLine[signalLine.length - 1] || 0,
    histogram: histogram[histogram.length - 1] || 0,
  };
}

/**
 * 计算RSI (相对强弱指标)
 */
export function calculateRSI(data: number[], period = 14): number {
  if (data.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  // 计算第一个周期的平均涨跌
  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // 计算后续周期
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - change) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
}

/**
 * 计算ATR (平均真实波幅)
 */
export function calculateATR(candles: CandleStick[], period = 14): number {
  if (candles.length < 2) return 0;

  const trueRanges: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );

    trueRanges.push(tr);
  }

  // 计算ATR (简单移动平均)
  const recentTR = trueRanges.slice(-period);
  const atr = recentTR.reduce((sum, tr) => sum + tr, 0) / recentTR.length;

  return atr;
}

/**
 * 计算所有技术指标（包含多周期 RSI 和 ATR）
 * 完全匹配 nof1.ai 的实现
 */
export function calculateAllIndicators(candles: CandleStick[]) {
  const closePrices = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  const ema20 = calculateEMA(closePrices, 20);
  const ema50 = calculateEMA(closePrices, 50);
  const ema200 = calculateEMA(closePrices, 200);

  const macd = calculateMACD(closePrices);

  // 多周期 RSI（nof1.ai 使用 7 和 14 周期）
  const rsi_7 = calculateRSI(closePrices, 7);   // 短线敏感
  const rsi_14 = calculateRSI(closePrices, 14); // 中线稳定

  // 多周期 ATR（nof1.ai 使用 3 和 14 周期）
  const atr_3 = calculateATR(candles, 3);       // 短期波动
  const atr_14 = calculateATR(candles, 14);     // 中期波动

  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
  const currentVolume = volumes[volumes.length - 1];

  return {
    price: closePrices[closePrices.length - 1],
    ema_20: ema20[ema20.length - 1] || 0,
    ema_50: ema50[ema50.length - 1] || 0,
    ema_200: ema200[ema200.length - 1] || 0,
    macd: macd.macd,
    macd_signal: macd.signal,
    macd_histogram: macd.histogram,

    // RSI 多周期（匹配 nof1.ai）
    rsi: rsi_14,          // 默认使用 14 周期
    rsi_7: rsi_7,         // 7 周期（短线）
    rsi_14: rsi_14,       // 14 周期（中线）

    // ATR 多周期（匹配 nof1.ai）
    atr: atr_14,          // 默认使用 14 周期
    atr_3: atr_3,         // 3 周期（短期波动）
    atr_14: atr_14,       // 14 周期（中期波动）

    volume: currentVolume,
    volume_ratio: avgVolume > 0 ? currentVolume / avgVolume : 1,
  };
}
