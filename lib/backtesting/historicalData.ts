/**
 * 历史数据获取模块
 * 从 Binance API 获取历史K线数据用于回测
 */

import { Coin } from '@/types/trading';

export interface Candle {
  timestamp: number;      // 开盘时间
  open: number;           // 开盘价
  high: number;           // 最高价
  low: number;            // 最低价
  close: number;          // 收盘价
  volume: number;         // 成交量
}

export interface HistoricalDataSet {
  coin: Coin;
  interval: string;       // 如 '1h', '4h', '1d'
  candles: Candle[];
}

// Binance API 配置
const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

// 币种映射到 Binance 交易对
const COIN_TO_SYMBOL: Record<Coin, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
  BNB: 'BNBUSDT',
  DOGE: 'DOGEUSDT',
  XRP: 'XRPUSDT',
};

/**
 * 从 Binance 获取历史K线数据
 * @param coin 币种
 * @param interval K线间隔 ('1m', '5m', '15m', '1h', '4h', '1d')
 * @param limit 获取数量（最多1000）
 * @param startTime 开始时间（可选）
 * @param endTime 结束时间（可选）
 */
export async function fetchHistoricalCandles(
  coin: Coin,
  interval: string = '1h',
  limit: number = 500,
  startTime?: number,
  endTime?: number
): Promise<Candle[]> {
  const symbol = COIN_TO_SYMBOL[coin];

  try {
    // 构建请求URL
    let url = `${BINANCE_API_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

    if (startTime) {
      url += `&startTime=${startTime}`;
    }
    if (endTime) {
      url += `&endTime=${endTime}`;
    }

    console.log(`[HistoricalData] 📡 获取 ${coin} ${interval} K线数据 (${limit} 条)...`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Binance API 错误: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // 转换 Binance 格式到我们的格式
    const candles: Candle[] = data.map((item: any[]) => ({
      timestamp: item[0],                    // 开盘时间
      open: parseFloat(item[1]),             // 开盘价
      high: parseFloat(item[2]),             // 最高价
      low: parseFloat(item[3]),              // 最低价
      close: parseFloat(item[4]),            // 收盘价
      volume: parseFloat(item[5]),           // 成交量
    }));

    console.log(`[HistoricalData] ✅ 获取成功: ${candles.length} 条 ${coin} K线数据`);
    console.log(`[HistoricalData] 📅 时间范围: ${new Date(candles[0].timestamp).toLocaleString()} ~ ${new Date(candles[candles.length - 1].timestamp).toLocaleString()}`);
    console.log(`[HistoricalData] 💰 价格范围: $${Math.min(...candles.map(c => c.low)).toFixed(2)} ~ $${Math.max(...candles.map(c => c.high)).toFixed(2)}`);

    return candles;
  } catch (error) {
    console.error(`[HistoricalData] ❌ 获取 ${coin} 历史数据失败:`, error);
    throw error;
  }
}

/**
 * 批量获取多个币种的历史数据
 */
export async function fetchMultipleCoinsData(
  coins: Coin[],
  interval: string = '1h',
  limit: number = 500
): Promise<HistoricalDataSet[]> {
  console.log(`[HistoricalData] 📊 开始批量获取 ${coins.length} 个币种的历史数据...`);

  const results: HistoricalDataSet[] = [];

  for (const coin of coins) {
    try {
      const candles = await fetchHistoricalCandles(coin, interval, limit);
      results.push({
        coin,
        interval,
        candles,
      });

      // 避免请求过快，等待一下
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`[HistoricalData] ❌ ${coin} 获取失败，跳过`);
    }
  }

  console.log(`[HistoricalData] ✅ 批量获取完成: ${results.length}/${coins.length} 个币种`);
  return results;
}

/**
 * 获取指定时间范围的历史数据
 * @param coin 币种
 * @param interval K线间隔
 * @param days 获取最近多少天的数据
 */
export async function fetchRecentDaysData(
  coin: Coin,
  interval: string = '1h',
  days: number = 7
): Promise<Candle[]> {
  const endTime = Date.now();
  const startTime = endTime - (days * 24 * 60 * 60 * 1000);

  // Binance 每次最多返回1000条，需要分批获取
  const allCandles: Candle[] = [];
  let currentStartTime = startTime;

  while (currentStartTime < endTime) {
    const candles = await fetchHistoricalCandles(
      coin,
      interval,
      1000,
      currentStartTime,
      endTime
    );

    if (candles.length === 0) break;

    allCandles.push(...candles);

    // 更新下一批的开始时间
    currentStartTime = candles[candles.length - 1].timestamp + 1;

    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`[HistoricalData] ✅ 获取 ${coin} 最近 ${days} 天数据: ${allCandles.length} 条`);
  return allCandles;
}

/**
 * 计算技术指标（用于回测时的数据准备）
 */
export function calculateIndicators(candles: Candle[]) {
  // EMA 计算
  const ema = (period: number): number[] => {
    const k = 2 / (period + 1);
    const emaValues: number[] = [];

    // 初始值使用 SMA
    let prevEma = candles.slice(0, period).reduce((sum, c) => sum + c.close, 0) / period;
    emaValues.push(prevEma);

    for (let i = period; i < candles.length; i++) {
      const currentEma = candles[i].close * k + prevEma * (1 - k);
      emaValues.push(currentEma);
      prevEma = currentEma;
    }

    return emaValues;
  };

  // RSI 计算
  const rsi = (period: number = 14): number[] => {
    const rsiValues: number[] = [];
    let gains = 0;
    let losses = 0;

    // 初始平均涨跌
    for (let i = 1; i <= period; i++) {
      const change = candles[i].close - candles[i - 1].close;
      if (change > 0) gains += change;
      else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period; i < candles.length; i++) {
      const change = candles[i].close - candles[i - 1].close;
      const currentGain = change > 0 ? change : 0;
      const currentLoss = change < 0 ? -change : 0;

      avgGain = (avgGain * (period - 1) + currentGain) / period;
      avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsiValue = 100 - (100 / (1 + rs));
      rsiValues.push(rsiValue);
    }

    return rsiValues;
  };

  return {
    ema20: ema(20),
    ema50: ema(50),
    ema200: ema(200),
    rsi14: rsi(14),
  };
}

/**
 * 保存历史数据到本地文件（可选）
 */
export async function saveToFile(data: HistoricalDataSet, filename: string) {
  if (typeof window === 'undefined') {
    const fs = await import('fs');
    const path = await import('path');

    const filePath = path.join(process.cwd(), 'backtest-data', filename);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`[HistoricalData] 💾 数据已保存到: ${filePath}`);
  }
}

/**
 * 从本地文件加载历史数据（可选）
 */
export async function loadFromFile(filename: string): Promise<HistoricalDataSet | null> {
  if (typeof window === 'undefined') {
    const fs = await import('fs');
    const path = await import('path');

    const filePath = path.join(process.cwd(), 'backtest-data', filename);

    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      console.log(`[HistoricalData] 📂 从文件加载: ${filePath}`);
      return JSON.parse(data);
    }
  }
  return null;
}
