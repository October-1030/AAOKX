// 模拟市场数据生成器 + 真实价格数据（CoinGecko）

import { Coin, CandleData, MarketData } from '@/types/trading';
import { calculateAllIndicators, CandleStick } from './indicators';
import { getAllCoinGeckoPrices, RealTimePrice } from './coingeckoClient';
import { CONFIG } from './config';

// 初始价格（如果使用真实数据会被覆盖）
const INITIAL_PRICES: Record<Coin, number> = {
  // 主流币种 (原有6个)
  BTC: 67200, ETH: 3450, SOL: 145, BNB: 580, DOGE: 0.38, XRP: 2.15,
  
  // L1公链
  ATOM: 8, AVAX: 40, DOT: 7, ADA: 0.9, NEAR: 5, FIL: 4, TIA: 4.5, TON: 5.5, SUI: 2.8, APT: 9, SEI: 0.3, INJ: 25,
  
  // DeFi蓝筹  
  UNI: 12, LINK: 15, AAVE: 180, CRV: 0.8, LDO: 1.8, PENDLE: 4.5, ENS: 25, SUSHI: 1.2,
  
  // L2/扩容
  OP: 2.5, ARB: 0.8, MATIC: 0.9, LTC: 100, BCH: 450, ETC: 28,
  
  // Meme币热门
  kPEPE: 0.00002, kSHIB: 0.00003, WIF: 1.8, POPCAT: 0.8, BOME: 0.01, GOAT: 0.5, PNUT: 1.2, PENGU: 0.04, kBONK: 0.00004,
  
  // AI概念
  AIXBT: 0.25, VIRTUAL: 2.5, ZEREBRO: 0.15, TAO: 450, RENDER: 7, FET: 1.5,
  
  // 新热点
  TRUMP: 35, HYPE: 28, MOVE: 0.7, ME: 3.5, USUAL: 1.1, MORPHO: 2.8,
  
  // 游戏/NFT
  IMX: 1.5, GALA: 0.04, SAND: 0.6, GMT: 0.15, YGG: 0.5, BIGTIME: 0.15,
  
  // 其他热门
  JUP: 0.8, PYTH: 0.4, ONDO: 1.4, ENA: 0.9, JTO: 2.8, W: 0.3, STRK: 0.5, ETHFI: 3.5, BLAST: 0.02
};

// 真实价格缓存（从 Hyperliquid/CoinGecko 获取）
let realPricesCache: Record<Coin, RealTimePrice> | null = null;
let lastRealPriceFetch = 0;
const PRICE_FETCH_INTERVAL = 10000; // ✅ 10秒刷新一次（更实时）

// 市场数据存储 - 只为主要6个币种初始化
const marketHistory: Record<Coin, CandleStick[]> = {} as Record<Coin, CandleStick[]>;

// 只初始化主要6个币种的历史数据，保持界面简洁  
const DISPLAY_COINS: Coin[] = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'AVAX'];
DISPLAY_COINS.forEach(coin => {
  marketHistory[coin] = [];
});

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

  // 只初始化主要6个币种的历史数据，保持界面简洁
  const mainCoins: Coin[] = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'AVAX'];
  
  for (const coin of mainCoins) {
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

  // 仅显示主要6个币种，保持界面简洁
  const coins: Coin[] = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'AVAX'];

  // 🔥 方案1：优先尝试 Hyperliquid 永续合约价格（和真实交易价格一致）
  try {
    const { getHyperliquidClient } = await import('./hyperliquidClient');
    const hyperliquid = getHyperliquidClient();

    if (hyperliquid.isAvailable()) {
      console.log('[MarketData] 🔗 从 Hyperliquid 获取永续合约价格...');
      const hlPrices = await hyperliquid.getAllMarketPrices();

      // 验证价格是否有效（不为null且不为0）
      if (hlPrices && hlPrices.BTC && hlPrices.BTC > 1000) {
        const btcPrice = hlPrices.BTC;
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

  // ⚠️ 如果历史数据为空，返回基于当前价格的虚拟数据
  if (!history || history.length === 0) {
    console.warn(`[MarketData] ⚠️ ${coin} history is empty, using fallback data`);

    // 使用默认价格或缓存的真实价格（确保不为 0）
    let fallbackPrice = INITIAL_PRICES[coin];
    if (realPricesCache && realPricesCache[coin] && realPricesCache[coin].price > 0) {
      fallbackPrice = realPricesCache[coin].price;
    }

    console.log(`[MarketData] 📌 ${coin} fallback price: $${fallbackPrice.toLocaleString()}`);

    // 返回基本的市场数据（避免 undefined 错误）
    return {
      coin,
      current: {
        price: fallbackPrice,
        ema_20: fallbackPrice,
        ema_50: fallbackPrice,
        ema_200: fallbackPrice,
        macd: 0,
        macd_signal: 0,
        macd_histogram: 0,
        rsi: 50,
        rsi_7: 50,
        rsi_14: 50,
        atr: fallbackPrice * 0.02,
        atr_3: fallbackPrice * 0.02,
        atr_14: fallbackPrice * 0.02,
        volume: 1000000,
        volume_ratio: 1,
        // 默认线性回归值（无数据时）
        linear_regression: {
          slope: 0,
          intercept: fallbackPrice,
          rSquared: 0,
          currentValue: fallbackPrice,
          deviation: 0,
          deviationPercent: 0,
          zScore: 0,
          signal: 'NEUTRAL' as const,
          standardDeviation: 0,
        },
        // 默认市场状态（无数据时假设震荡）
        market_regime: {
          regime: 'RANGING' as const,
          strength: 50,
          adx: 0,
          rSquared: 0,
          recommendation: 'WAIT' as const,
        },
      },
      intraday: [],
      daily: [],
    };
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
  // 只返回主要6个币种的市场数据，保持界面简洁
  return DISPLAY_COINS.map(coin => getMarketData(coin));
}

/**
 * 获取当前价格
 */
export function getCurrentPrice(coin: Coin): number {
  const history = marketHistory[coin];
  if (history.length === 0) return INITIAL_PRICES[coin];
  return history[history.length - 1].close;
}

// ✅ 移除自动初始化：应该由 API route 显式调用 await initializeMarketData()
// 避免在模块加载时启动异步操作导致竞争条件
