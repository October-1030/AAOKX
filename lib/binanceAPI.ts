// Binance API 集成 - 获取真实市场数据

import axios from 'axios';
import { Coin } from '@/types/trading';

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

// 币种映射到Binance交易对 (部分支持)
const COIN_TO_SYMBOL: Partial<Record<Coin, string>> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
  BNB: 'BNBUSDT',
  DOGE: 'DOGEUSDT',
  XRP: 'XRPUSDT',
};

export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
}

/**
 * 获取K线数据
 * @param coin 币种
 * @param interval K线间隔 (1m, 3m, 5m, 15m, 30m, 1h, 4h, 1d)
 * @param limit 数据条数 (默认500)
 */
export async function getBinanceKlines(
  coin: Coin,
  interval: string = '10m',
  limit: number = 150
): Promise<BinanceKline[]> {
  try {
    const symbol = COIN_TO_SYMBOL[coin];
    const response = await axios.get(`${BINANCE_API_BASE}/klines`, {
      params: {
        symbol,
        interval,
        limit,
      },
      timeout: 5000,
    });

    return response.data.map((k: any[]) => ({
      openTime: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: k[5],
      closeTime: k[6],
      quoteVolume: k[7],
      trades: k[8],
      takerBuyBaseVolume: k[9],
      takerBuyQuoteVolume: k[10],
    }));
  } catch (error) {
    console.error(`Failed to fetch ${coin} klines from Binance:`, error);
    throw error;
  }
}

/**
 * 获取当前价格（24小时价格统计）
 */
export async function getBinancePrice(coin: Coin): Promise<number> {
  try {
    const symbol = COIN_TO_SYMBOL[coin];
    const response = await axios.get(`${BINANCE_API_BASE}/ticker/24hr`, {
      params: { symbol },
      timeout: 5000,
    });

    return parseFloat(response.data.lastPrice);
  } catch (error) {
    console.error(`Failed to fetch ${coin} price from Binance:`, error);
    throw error;
  }
}

/**
 * 获取所有币种的当前价格
 */
export async function getAllBinancePrices(): Promise<Record<Coin, number>> {
  try {
    const promises = Object.keys(COIN_TO_SYMBOL).map(async (coin) => {
      const price = await getBinancePrice(coin as Coin);
      return [coin, price] as [Coin, number];
    });

    const results = await Promise.all(promises);
    return Object.fromEntries(results) as Record<Coin, number>;
  } catch (error) {
    console.error('Failed to fetch all prices:', error);
    throw error;
  }
}

/**
 * 获取实时WebSocket连接（可选，用于真正的实时数据）
 */
export function createBinanceWebSocket(
  coin: Coin,
  onPrice: (price: number) => void
): WebSocket {
  const symbol = (COIN_TO_SYMBOL[coin] || `${coin}USDT`).toLowerCase();
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@trade`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const price = parseFloat(data.p); // 成交价格
    onPrice(price);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return ws;
}

/**
 * 测试Binance API连接
 */
export async function testBinanceConnection(): Promise<boolean> {
  try {
    const response = await axios.get(`${BINANCE_API_BASE}/ping`, {
      timeout: 3000,
    });
    return response.status === 200;
  } catch (error) {
    console.error('Binance API connection failed:', error);
    return false;
  }
}
