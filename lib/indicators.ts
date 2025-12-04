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

  // 线性回归分析
  const linearRegression = calculateLinearRegression(closePrices, 20);
  const marketRegime = identifyMarketRegime(closePrices, 14);

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

    // 线性回归指标（均值回归策略）
    linear_regression: linearRegression,
    market_regime: marketRegime,
  };
}

/**
 * 计算线性回归（Linear Regression）
 * 用于均值回归策略，识别价格偏离程度
 *
 * @param prices - 价格数组
 * @param period - 回归周期（默认20）
 * @returns 线性回归分析结果
 */
export function calculateLinearRegression(prices: number[], period: number = 20) {
  if (prices.length < period) {
    return {
      slope: 0,
      intercept: 0,
      rSquared: 0,
      currentValue: 0,
      deviation: 0,
      deviationPercent: 0,
      zScore: 0,
      signal: 'NEUTRAL' as 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL',
    };
  }

  // 取最近period个价格
  const data = prices.slice(-period);
  const n = data.length;

  // 计算线性回归参数
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = data[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  // 斜率 (slope) 和截距 (intercept)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² (拟合优度)
  const meanY = sumY / n;
  let ssRes = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const predictedY = slope * i + intercept;
    ssRes += Math.pow(data[i] - predictedY, 2);
    ssTot += Math.pow(data[i] - meanY, 2);
  }

  const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

  // 当前价格的预测值
  const currentX = n - 1;
  const currentValue = slope * currentX + intercept;

  // 计算偏离度
  const currentPrice = prices[prices.length - 1];
  const deviation = currentPrice - currentValue;
  const deviationPercent = (deviation / currentValue) * 100;

  // 计算标准差
  let sumSquaredDeviations = 0;
  for (let i = 0; i < n; i++) {
    const predictedY = slope * i + intercept;
    sumSquaredDeviations += Math.pow(data[i] - predictedY, 2);
  }
  const standardDeviation = Math.sqrt(sumSquaredDeviations / n);

  // Z-Score (标准化偏离度)
  const zScore = standardDeviation === 0 ? 0 : deviation / standardDeviation;

  // 交易信号
  let signal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL' = 'NEUTRAL';
  if (zScore > 2) {
    signal = 'OVERBOUGHT';  // 极度超买，可能回落
  } else if (zScore < -2) {
    signal = 'OVERSOLD';    // 极度超卖，可能反弹
  }

  return {
    slope,                    // 趋势斜率（正=上涨，负=下跌）
    intercept,                // 回归线起点
    rSquared,                 // 拟合优度（0-1，越接近1越准确）
    currentValue,             // 回归线预测值
    deviation,                // 偏离度（美元）
    deviationPercent,         // 偏离度（百分比）
    zScore,                   // 标准化偏离度（-2到+2为正常）
    signal,                   // 交易信号
    standardDeviation,        // 标准差
  };
}

/**
 * 识别市场状态（震荡 vs 趋势）
 * 用于决定使用均值回归策略还是趋势跟踪策略
 *
 * @param prices - 价格数组
 * @param period - 分析周期（默认14）
 * @returns 市场状态分析
 */
export function identifyMarketRegime(prices: number[], period: number = 14) {
  if (prices.length < period + 1) {
    return {
      regime: 'RANGING' as 'RANGING' | 'TRENDING',
      strength: 0,
      adx: 0,
      recommendation: 'WAIT' as 'MEAN_REVERSION' | 'TREND_FOLLOWING' | 'WAIT',
    };
  }

  const data = prices.slice(-period - 1);

  // 计算ADX (Average Directional Index) 简化版
  let sumUpMoves = 0;
  let sumDownMoves = 0;
  let sumTrueRange = 0;

  for (let i = 1; i < data.length; i++) {
    const upMove = data[i] - data[i - 1];
    const downMove = data[i - 1] - data[i];

    if (upMove > 0 && upMove > downMove) {
      sumUpMoves += upMove;
    }
    if (downMove > 0 && downMove > upMove) {
      sumDownMoves += downMove;
    }

    sumTrueRange += Math.abs(data[i] - data[i - 1]);
  }

  const avgUpMove = sumUpMoves / period;
  const avgDownMove = sumDownMoves / period;
  const avgTrueRange = sumTrueRange / period;

  // DI+ 和 DI-
  const diPlus = avgTrueRange === 0 ? 0 : (avgUpMove / avgTrueRange) * 100;
  const diMinus = avgTrueRange === 0 ? 0 : (avgDownMove / avgTrueRange) * 100;

  // ADX 简化计算
  const dx = (diPlus + diMinus) === 0 ? 0 : Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
  const adx = dx;

  // 计算线性回归R²作为辅助判断
  const linearReg = calculateLinearRegression(prices, period);
  const rSquared = linearReg.rSquared;

  // 判断市场状态
  let regime: 'RANGING' | 'TRENDING' = 'RANGING';
  let strength = 0;
  let recommendation: 'MEAN_REVERSION' | 'TREND_FOLLOWING' | 'WAIT' = 'WAIT';

  if (adx > 25 && rSquared > 0.7) {
    // ADX > 25 且 R² > 0.7：强趋势市场
    regime = 'TRENDING';
    strength = Math.min(adx, 100);
    recommendation = 'TREND_FOLLOWING';
  } else if (adx < 20 && rSquared < 0.4) {
    // ADX < 20 且 R² < 0.4：震荡市场
    regime = 'RANGING';
    strength = 100 - adx;
    recommendation = 'MEAN_REVERSION';
  } else {
    // 过渡状态
    regime = adx > 20 ? 'TRENDING' : 'RANGING';
    strength = 50;
    recommendation = 'WAIT';
  }

  return {
    regime,                // 市场状态：RANGING (震荡) / TRENDING (趋势)
    strength,              // 状态强度 (0-100)
    adx,                   // ADX指标值
    rSquared,              // 线性回归R²
    recommendation,        // 策略推荐：MEAN_REVERSION (均值回归) / TREND_FOLLOWING (趋势跟踪) / WAIT (等待)
  };
}

/**
 * 计算布林带（Bollinger Bands）
 * 用于识别价格突破和波动率
 * 
 * @param prices - 价格数组
 * @param period - 计算周期（默认20）
 * @param stdDev - 标准差倍数（默认2）
 * @returns 布林带数据
 */
export function calculateBollingerBands(
  prices: number[], 
  period: number = 20, 
  stdDev: number = 2
) {
  if (prices.length < period) {
    return {
      upper: 0,
      middle: 0,
      lower: 0,
      bandwidth: 0,
      percentB: 0,
      squeeze: false,
      signal: 'NEUTRAL'
    };
  }

  // 计算移动平均（中轨）
  const data = prices.slice(-period);
  const middle = data.reduce((sum, price) => sum + price, 0) / period;

  // 计算标准差
  const variance = data.reduce((sum, price) => {
    return sum + Math.pow(price - middle, 2);
  }, 0) / period;
  const standardDeviation = Math.sqrt(variance);

  // 计算上轨和下轨
  const upper = middle + (standardDeviation * stdDev);
  const lower = middle - (standardDeviation * stdDev);

  // 当前价格
  const currentPrice = prices[prices.length - 1];

  // 计算带宽（Bandwidth）- 衡量波动率
  const bandwidth = ((upper - lower) / middle) * 100;

  // 计算 %B - 价格在布林带中的位置
  const percentB = (currentPrice - lower) / (upper - lower);

  // 检测挤压（Squeeze）- 波动率极低
  const squeeze = bandwidth < 2; // 带宽小于2%视为挤压

  // 生成信号
  let signal = 'NEUTRAL';
  if (squeeze) {
    signal = 'SQUEEZE';
  } else if (percentB > 1) {
    signal = 'OVERBOUGHT';
  } else if (percentB < 0) {
    signal = 'OVERSOLD';
  } else if (percentB > 0.8) {
    signal = 'UPPER_BAND';
  } else if (percentB < 0.2) {
    signal = 'LOWER_BAND';
  }

  return {
    upper,           // 上轨
    middle,          // 中轨（移动平均）
    lower,           // 下轨
    bandwidth,       // 带宽百分比
    percentB,        // %B指标（0-1之间正常）
    squeeze,         // 是否处于挤压状态
    signal           // 交易信号
  };
}
