// 模拟市场数据生成器 + 真实价格数据（CoinGecko）

import { Coin, CandleData, MarketData } from '@/types/trading';
import { calculateAllIndicators, CandleStick } from './indicators';
import { getAllCoinGeckoPrices, RealTimePrice } from './coingeckoClient';
import { CONFIG } from './config';

// 初始价格（如果使用真实数据会被覆盖）
const INITIAL_PRICES: Record<Coin, number> = {
  BTC: 67200,
  ETH: 3450,
  SOL: 145,
  BNB: 580,
  DOGE: 0.38,
  XRP: 2.15,
};

// 真实价格缓存（从 Hyperliquid/CoinGecko 获取）
let realPricesCache: Record<Coin, RealTimePrice> | null = null;
let lastRealPriceFetch = 0;
const PRICE_FETCH_INTERVAL = 10000; // ✅ 10秒刷新一次（更实时）

// 市场数据存储
const marketHistory: Record<Coin, CandleStick[]> = {
  BTC: [],
  ETH: [],
  SOL: [],
  BNB: [],
  DOGE: [],
  XRP: [],
};

/**
 * 生成模拟K线数据（随机游走模型）
 */
function generateCandle(lastClose: number, volatility = 0.02): CandleStick {
  const timestamp = Date.now();

  // 随机游走
  const changePercent = (Math.random() - 0.5) * 2 * volatility;
  const open = lastClose;
  const close = open * (1 + changePercent);

  const high = Math.max(open, close) * (1 + Math.random() * volatility / 2);
  const low = Math.min(open, close) * (1 - Math.random() * volatility / 2);

  const volume = Math.random() * 1000000 + 500000;

  return {
    timestamp,
    open,
    high,
    low,
    close,
    volume,
  };
}

/**
 * 初始化市场历史数据
 */
export async function initializeMarketData() {
  const now = Date.now();
  const minutesInDay = 60 * 24;

  // 如果启用真实市场数据，先获取一次真实价格
  if (CONFIG.USE_REAL_MARKET_DATA) {
    console.log('[MarketData] 🌐 使用 CoinGecko 真实价格');
    await fetchRealPrices();
  } else {
    console.log('[MarketData] 🎲 使用模拟价格数据');
  }

  for (const coin of Object.keys(INITIAL_PRICES) as Coin[]) {
    const candles: CandleStick[] = [];

    // 使用真实价格或默认价格作为目标价格
    let targetPrice = INITIAL_PRICES[coin];
    if (CONFIG.USE_REAL_MARKET_DATA && realPricesCache && realPricesCache[coin]) {
      targetPrice = realPricesCache[coin].price;
      console.log(`[MarketData] ${coin} 实时价格: $${targetPrice.toLocaleString()}`);
    }

    // 生成过去24小时的10分钟K线 (143个数据点，围绕目标价格波动)
    // 从稍早的价格开始，模拟趋势
    let lastClose = targetPrice * (0.95 + Math.random() * 0.1); // 95%-105% 的目标价格

    for (let i = minutesInDay; i >= 10; i -= 10) {
      const timestamp = now - i * 60 * 1000;
      const candle = generateCandle(lastClose);
      candle.timestamp = timestamp;
      candles.push(candle);
      lastClose = candle.close;
    }

    // 🔥 关键修复：最后一根K线强制使用真实价格
    const finalCandle: CandleStick = {
      timestamp: now,
      open: lastClose,
      high: Math.max(lastClose, targetPrice) * 1.001,
      low: Math.min(lastClose, targetPrice) * 0.999,
      close: targetPrice,  // ✅ 强制使用真实价格
      volume: Math.random() * 1000000 + 500000,
    };
    candles.push(finalCandle);

    marketHistory[coin] = candles;
    console.log(`[MarketData] ${coin} 最新 K线价格: $${targetPrice.toLocaleString()}`);
  }
}

/**
 * 获取真实价格（优先 Hyperliquid，降级 CoinGecko）
 * 每分钟最多刷新一次
 */
async function fetchRealPrices(): Promise<void> {
  const now = Date.now();

  // 检查是否需要刷新（避免频繁调用 API）
  if (realPricesCache && now - lastRealPriceFetch < PRICE_FETCH_INTERVAL) {
    return; // 使用缓存
  }

  const coins: Coin[] = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP'];

  // 🔥 方案1：优先尝试 Hyperliquid 永续合约价格（和真实交易价格一致）
  try {
    const { getHyperliquidClient } = await import('./hyperliquidClient');
    const hyperliquid = getHyperliquidClient();

    if (hyperliquid.isAvailable()) {
      console.log('[MarketData] 🔗 从 Hyperliquid 获取永续合约价格...');
      const hlPrices = await hyperliquid.getAllMarketPrices();

      // 验证价格是否有效（不为0）
      const btcPrice = hlPrices.BTC;
      if (btcPrice && btcPrice > 1000) {
        console.log(`[MarketData] ✅ Hyperliquid 价格获取成功`);
        console.log(`[MarketData] 💹 BTC: $${btcPrice.toLocaleString()}`);

        // 转换为 RealTimePrice 格式
        realPricesCache = {} as Record<Coin, RealTimePrice>;
        coins.forEach(coin => {
          realPricesCache![coin] = {
            coin,
            price: hlPrices[coin] || 0,
            volume24h: 0,
            change24h: 0,
            timestamp: now,
          };
        });

        lastRealPriceFetch = now;
        return;
      } else {
        console.warn('[MarketData] ⚠️ Hyperliquid 返回无效价格，降级到 CoinGecko');
      }
    }
  } catch (error) {
    console.warn('[MarketData] ⚠️ Hyperliquid 获取失败，降级到 CoinGecko:', error);
  }

  // 🌐 方案2：降级到 CoinGecko 现货价格
  try {
    console.log('[MarketData] 🌐 从 CoinGecko 获取现货价格...');
    const prices = await getAllCoinGeckoPrices(coins);

    // 更新缓存
    realPricesCache = {} as Record<Coin, RealTimePrice>;
    prices.forEach(priceData => {
      realPricesCache![priceData.coin] = priceData;
    });

    lastRealPriceFetch = now;
    console.log('[MarketData] ✅ CoinGecko 价格获取成功');
  } catch (error) {
    console.error('[MarketData] ❌ 所有价格源均失败:', error);
  }
}

/**
 * 更新市场数据（模拟实时更新 或 使用真实价格）
 */
export async function updateMarketData() {
  // 如果启用真实市场数据，先获取真实价格
  if (CONFIG.USE_REAL_MARKET_DATA) {
    await fetchRealPrices();
  }

  for (const coin of Object.keys(marketHistory) as Coin[]) {
    const history = marketHistory[coin];
    const lastCandle = history[history.length - 1];

    // 安全检查：如果没有历史数据，跳过
    if (!lastCandle) {
      console.warn(`[MarketData] ⚠️ ${coin} 没有历史数据，跳过更新`);
      continue;
    }

    let newClose: number;

    // 使用真实价格或模拟价格
    if (CONFIG.USE_REAL_MARKET_DATA && realPricesCache && realPricesCache[coin]) {
      // 使用 CoinGecko 真实价格
      newClose = realPricesCache[coin].price;
    } else {
      // 生成模拟价格
      newClose = lastCandle.close * (1 + (Math.random() - 0.5) * 0.04);
    }

    // 生成 K 线
    const timestamp = Date.now();
    const open = lastCandle.close;
    const close = newClose;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = Math.random() * 1000000 + 500000;

    const newCandle: CandleStick = {
      timestamp,
      open,
      high,
      low,
      close,
      volume,
    };

    // 保持最近144个数据点（24小时）
    if (history.length >= 144) {
      history.shift();
    }

    history.push(newCandle);
  }
}

/**
 * 获取币种的市场数据和技术指标
 */
export function getMarketData(coin: Coin): MarketData {
  const history = marketHistory[coin];

  if (history.length === 0) {
    initializeMarketData();
  }

  // 获取最近10个10分钟K线（日内数据）
  const intraday = history.slice(-10).map(c => ({
    timestamp: c.timestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));

  // 4小时K线（每24个10分钟K线聚合成一个4小时K线）
  const daily: CandleData[] = [];
  const candlesPerPeriod = 24; // 4小时 = 24个10分钟

  for (let i = 0; i < history.length; i += candlesPerPeriod) {
    const periodCandles = history.slice(i, i + candlesPerPeriod);
    if (periodCandles.length === 0) continue;

    daily.push({
      timestamp: periodCandles[0].timestamp,
      open: periodCandles[0].open,
      high: Math.max(...periodCandles.map(c => c.high)),
      low: Math.min(...periodCandles.map(c => c.low)),
      close: periodCandles[periodCandles.length - 1].close,
      volume: periodCandles.reduce((sum, c) => sum + c.volume, 0),
    });
  }

  // 计算技术指标
  const current = calculateAllIndicators(history);

  return {
    coin,
    current,
    intraday,
    daily,
  };
}

/**
 * 获取所有币种的市场数据
 */
export function getAllMarketData(): MarketData[] {
  return (Object.keys(INITIAL_PRICES) as Coin[]).map(coin => getMarketData(coin));
}

/**
 * 获取当前价格
 */
export function getCurrentPrice(coin: Coin): number {
  const history = marketHistory[coin];
  if (history.length === 0) return INITIAL_PRICES[coin];
  return history[history.length - 1].close;
}

// 自动初始化
if (typeof window === 'undefined') {
  // 服务端初始化
  initializeMarketData();
}
