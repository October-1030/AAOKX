/**
 * 历史数据导入模块
 * 支持从 OKX、Binance 和 CSV 文件导入历史K线数据
 */

import { Coin } from '@/types/trading';
import { CandleStick } from './indicators';

export interface HistoricalDataConfig {
  source: 'okx' | 'binance' | 'csv';
  coin: Coin;
  startTime: number; // Unix timestamp (ms)
  endTime: number; // Unix timestamp (ms)
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  csvData?: string; // CSV 文件内容（如果source是csv）
}

export interface HistoricalDataResult {
  coin: Coin;
  candles: CandleStick[];
  source: string;
  startTime: number;
  endTime: number;
  count: number;
}

// OKX 币种映射
const OKX_SYMBOL_MAP: Partial<Record<Coin, string>> = {
  BTC: 'BTC-USDT-SWAP',
  ETH: 'ETH-USDT-SWAP',
  SOL: 'SOL-USDT-SWAP',
  BNB: 'BNB-USDT-SWAP',
  DOGE: 'DOGE-USDT-SWAP',
  XRP: 'XRP-USDT-SWAP',
  AVAX: 'AVAX-USDT-SWAP',
  ATOM: 'ATOM-USDT-SWAP',
  DOT: 'DOT-USDT-SWAP',
  ADA: 'ADA-USDT-SWAP',
  NEAR: 'NEAR-USDT-SWAP',
  FIL: 'FIL-USDT-SWAP',
  TIA: 'TIA-USDT-SWAP',
  TON: 'TON-USDT-SWAP',
  SUI: 'SUI-USDT-SWAP',
  APT: 'APT-USDT-SWAP',
  SEI: 'SEI-USDT-SWAP',
  INJ: 'INJ-USDT-SWAP',
  UNI: 'UNI-USDT-SWAP',
  LINK: 'LINK-USDT-SWAP',
  AAVE: 'AAVE-USDT-SWAP',
  CRV: 'CRV-USDT-SWAP',
  LDO: 'LDO-USDT-SWAP',
  PENDLE: 'PENDLE-USDT-SWAP',
  ENS: 'ENS-USDT-SWAP',
  SUSHI: 'SUSHI-USDT-SWAP',
  OP: 'OP-USDT-SWAP',
  ARB: 'ARB-USDT-SWAP',
  MATIC: 'MATIC-USDT-SWAP',
  LTC: 'LTC-USDT-SWAP',
  BCH: 'BCH-USDT-SWAP',
  ETC: 'ETC-USDT-SWAP',
  kPEPE: '1000PEPE-USDT-SWAP',
  kSHIB: '1000SHIB-USDT-SWAP',
  WIF: 'WIF-USDT-SWAP',
  POPCAT: 'POPCAT-USDT-SWAP',
  BOME: 'BOME-USDT-SWAP',
  GOAT: 'GOAT-USDT-SWAP',
  PNUT: 'PNUT-USDT-SWAP',
  PENGU: 'PENGU-USDT-SWAP',
  kBONK: '1000BONK-USDT-SWAP',
  AIXBT: 'AIXBT-USDT-SWAP',
  VIRTUAL: 'VIRTUAL-USDT-SWAP',
  ZEREBRO: 'ZEREBRO-USDT-SWAP',
  TAO: 'TAO-USDT-SWAP',
  RENDER: 'RENDER-USDT-SWAP',
  FET: 'FET-USDT-SWAP',
  TRUMP: 'TRUMP-USDT-SWAP',
  HYPE: 'HYPE-USDT-SWAP',
  MOVE: 'MOVE-USDT-SWAP',
  ME: 'ME-USDT-SWAP',
  USUAL: 'USUAL-USDT-SWAP',
  MORPHO: 'MORPHO-USDT-SWAP',
  IMX: 'IMX-USDT-SWAP',
  GALA: 'GALA-USDT-SWAP',
  SAND: 'SAND-USDT-SWAP',
  GMT: 'GMT-USDT-SWAP',
  YGG: 'YGG-USDT-SWAP',
  BIGTIME: 'BIGTIME-USDT-SWAP',
  JUP: 'JUP-USDT-SWAP',
  PYTH: 'PYTH-USDT-SWAP',
  ONDO: 'ONDO-USDT-SWAP',
  ENA: 'ENA-USDT-SWAP',
  JTO: 'JTO-USDT-SWAP',
  W: 'W-USDT-SWAP',
  STRK: 'STRK-USDT-SWAP',
  ETHFI: 'ETHFI-USDT-SWAP',
  BLAST: 'BLAST-USDT-SWAP',
};

// Binance 币种映射
const BINANCE_SYMBOL_MAP: Partial<Record<Coin, string>> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
  BNB: 'BNBUSDT',
  DOGE: 'DOGEUSDT',
  XRP: 'XRPUSDT',
  AVAX: 'AVAXUSDT',
  ATOM: 'ATOMUSDT',
  DOT: 'DOTUSDT',
  ADA: 'ADAUSDT',
  NEAR: 'NEARUSDT',
  FIL: 'FILUSDT',
  TIA: 'TIAUSDT',
  TON: 'TONUSDT',
  SUI: 'SUIUSDT',
  APT: 'APTUSDT',
  SEI: 'SEIUSDT',
  INJ: 'INJUSDT',
  UNI: 'UNIUSDT',
  LINK: 'LINKUSDT',
  AAVE: 'AAVEUSDT',
  CRV: 'CRVUSDT',
  LDO: 'LDOUSDT',
  PENDLE: 'PENDLEUSDT',
  ENS: 'ENSUSDT',
  SUSHI: 'SUSHIUSDT',
  OP: 'OPUSDT',
  ARB: 'ARBUSDT',
  MATIC: 'MATICUSDT',
  LTC: 'LTCUSDT',
  BCH: 'BCHUSDT',
  ETC: 'ETCUSDT',
  kPEPE: '1000PEPEUSDT',
  kSHIB: '1000SHIBUSDT',
  WIF: 'WIFUSDT',
  POPCAT: 'POPCATUSDT',
  BOME: 'BOMEUSDT',
  GOAT: 'GOATUSDT',
  PNUT: 'PNUTUSDT',
  PENGU: 'PENGUUSDT',
  kBONK: '1000BONKUSDT',
  AIXBT: 'AIXBTUSDT',
  VIRTUAL: 'VIRTUALUSDT',
  ZEREBRO: 'ZEREBROUSDT',
  TAO: 'TAOUSDT',
  RENDER: 'RENDERUSDT',
  FET: 'FETUSDT',
  TRUMP: 'TRUMPUSDT',
  HYPE: 'HYPEUSDT',
  MOVE: 'MOVEUSDT',
  ME: 'MEUSDT',
  USUAL: 'USUALUSDT',
  MORPHO: 'MORPHOUSDT',
  IMX: 'IMXUSDT',
  GALA: 'GALAUSDT',
  SAND: 'SANDUSDT',
  GMT: 'GMTUSDT',
  YGG: 'YGGUSDT',
  BIGTIME: 'BIGTIMEUSDT',
  JUP: 'JUPUSDT',
  PYTH: 'PYTHUSDT',
  ONDO: 'ONDOUSDT',
  ENA: 'ENAUSDT',
  JTO: 'JTOUSDT',
  W: 'WUSDT',
  STRK: 'STRKUSDT',
  ETHFI: 'ETHFIUSDT',
  BLAST: 'BLASTUSDT',
};

// OKX K线周期映射
const OKX_INTERVAL_MAP: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1D',
};

// Binance K线周期映射
const BINANCE_INTERVAL_MAP: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
};

/**
 * 从 OKX 获取历史K线数据
 */
async function fetchOKXHistoricalData(config: HistoricalDataConfig): Promise<CandleStick[]> {
  const symbol = OKX_SYMBOL_MAP[config.coin];
  const bar = OKX_INTERVAL_MAP[config.interval];

  if (!symbol) {
    throw new Error(`OKX does not support ${config.coin}`);
  }

  console.log(`[HistoricalData] 📥 从 OKX 获取 ${config.coin} 历史数据...`);
  console.log(`[HistoricalData] 时间范围: ${new Date(config.startTime).toISOString()} - ${new Date(config.endTime).toISOString()}`);

  const candles: CandleStick[] = [];
  let currentTime = config.endTime; // OKX API 从最新数据往前获取

  // OKX 限制：每次最多返回100根K线
  const limit = 100;

  while (currentTime > config.startTime) {
    const url = `https://www.okx.com/api/v5/market/history-candles?instId=${symbol}&bar=${bar}&before=${currentTime}&limit=${limit}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== '0' || !data.data || data.data.length === 0) {
        console.log(`[HistoricalData] ⚠️ 没有更多数据了`);
        break;
      }

      // OKX 返回格式: [timestamp, open, high, low, close, volume, ...]
      for (const item of data.data) {
        const timestamp = parseInt(item[0]);

        if (timestamp < config.startTime) {
          break; // 已经超出起始时间范围
        }

        const candle: CandleStick = {
          timestamp,
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5]),
        };

        candles.push(candle);
      }

      // 更新时间指针
      const oldestTimestamp = parseInt(data.data[data.data.length - 1][0]);
      if (oldestTimestamp >= currentTime) {
        break; // 避免无限循环
      }
      currentTime = oldestTimestamp;

      console.log(`[HistoricalData] 已获取 ${candles.length} 根K线...`);

      // 等待一下避免触发限流
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`[HistoricalData] ❌ 获取失败:`, error);
      throw error;
    }
  }

  // 按时间排序（从旧到新）
  candles.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`[HistoricalData] ✅ 成功获取 ${candles.length} 根K线`);
  return candles;
}

/**
 * 从 Binance 获取历史K线数据
 */
async function fetchBinanceHistoricalData(config: HistoricalDataConfig): Promise<CandleStick[]> {
  const symbol = BINANCE_SYMBOL_MAP[config.coin];
  const interval = BINANCE_INTERVAL_MAP[config.interval];

  if (!symbol) {
    throw new Error(`Binance does not support ${config.coin}`);
  }

  console.log(`[HistoricalData] 📥 从 Binance 获取 ${config.coin} 历史数据...`);

  const candles: CandleStick[] = [];
  let currentTime = config.startTime;

  // Binance 限制：每次最多返回1000根K线
  const limit = 1000;

  while (currentTime < config.endTime) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${currentTime}&limit=${limit}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      // Binance 返回格式: [openTime, open, high, low, close, volume, ...]
      for (const item of data) {
        const timestamp = item[0];

        if (timestamp > config.endTime) {
          break;
        }

        const candle: CandleStick = {
          timestamp,
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5]),
        };

        candles.push(candle);
      }

      // 更新时间指针
      const latestTimestamp = data[data.length - 1][0];
      if (latestTimestamp <= currentTime) {
        break; // 避免无限循环
      }
      currentTime = latestTimestamp + 1;

      console.log(`[HistoricalData] 已获取 ${candles.length} 根K线...`);

      // 等待一下避免触发限流
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`[HistoricalData] ❌ 获取失败:`, error);
      throw error;
    }
  }

  console.log(`[HistoricalData] ✅ 成功获取 ${candles.length} 根K线`);
  return candles;
}

/**
 * 从 CSV 解析历史K线数据
 * CSV 格式: timestamp,open,high,low,close,volume
 */
function parseCSVData(csvData: string): CandleStick[] {
  const lines = csvData.trim().split('\n');
  const candles: CandleStick[] = [];

  // 跳过标题行（如果有）
  const startIndex = lines[0].toLowerCase().includes('timestamp') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 6) {
      console.warn(`[HistoricalData] ⚠️ 跳过格式错误的行 ${i + 1}: ${line}`);
      continue;
    }

    try {
      const candle: CandleStick = {
        timestamp: parseInt(parts[0]),
        open: parseFloat(parts[1]),
        high: parseFloat(parts[2]),
        low: parseFloat(parts[3]),
        close: parseFloat(parts[4]),
        volume: parseFloat(parts[5]),
      };

      candles.push(candle);
    } catch (error) {
      console.warn(`[HistoricalData] ⚠️ 跳过无效数据行 ${i + 1}: ${line}`);
    }
  }

  // 按时间排序
  candles.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`[HistoricalData] ✅ 从 CSV 解析了 ${candles.length} 根K线`);
  return candles;
}

/**
 * 导入历史数据（主入口）
 */
export async function importHistoricalData(config: HistoricalDataConfig): Promise<HistoricalDataResult> {
  let candles: CandleStick[] = [];

  switch (config.source) {
    case 'okx':
      candles = await fetchOKXHistoricalData(config);
      break;

    case 'binance':
      candles = await fetchBinanceHistoricalData(config);
      break;

    case 'csv':
      if (!config.csvData) {
        throw new Error('CSV data is required when source is "csv"');
      }
      candles = parseCSVData(config.csvData);
      break;

    default:
      throw new Error(`Unsupported data source: ${config.source}`);
  }

  return {
    coin: config.coin,
    candles,
    source: config.source,
    startTime: candles.length > 0 ? candles[0].timestamp : config.startTime,
    endTime: candles.length > 0 ? candles[candles.length - 1].timestamp : config.endTime,
    count: candles.length,
  };
}
