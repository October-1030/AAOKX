/**
 * CoinGecko API 客户端
 *
 * 完全免费，无需注册，无需 API Key！
 * 限制：10-50 次/分钟
 *
 * API 文档：https://www.coingecko.com/en/api/documentation
 */

import { Coin } from '@/types/trading';

/**
 * CoinGecko 币种 ID 映射
 */
const COINGECKO_IDS: Record<Coin, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  DOGE: 'dogecoin',
  XRP: 'ripple',
};

/**
 * CoinGecko API 响应接口
 */
interface CoinGeckoPrice {
  usd: number;
  usd_24h_vol?: number;
  usd_24h_change?: number;
}

interface CoinGeckoPriceResponse {
  [coinId: string]: CoinGeckoPrice;
}

/**
 * 实时价格数据
 */
export interface RealTimePrice {
  coin: Coin;
  price: number;
  volume24h: number;
  change24h: number;
  timestamp: number;
}

/**
 * 获取单个币种的实时价格
 *
 * @param coin - 币种
 * @returns 实时价格数据
 */
export async function getCoinGeckoPrice(coin: Coin): Promise<RealTimePrice> {
  const coinId = COINGECKO_IDS[coin];

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data: CoinGeckoPriceResponse = await response.json();
    const priceData = data[coinId];

    if (!priceData) {
      throw new Error(`No data for ${coin}`);
    }

    return {
      coin,
      price: priceData.usd,
      volume24h: priceData.usd_24h_vol || 0,
      change24h: priceData.usd_24h_change || 0,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error(`[CoinGecko] 获取 ${coin} 价格失败:`, error);

    // 返回默认值（避免整个系统崩溃）
    return {
      coin,
      price: 0,
      volume24h: 0,
      change24h: 0,
      timestamp: Date.now(),
    };
  }
}

/**
 * 批量获取所有币种的实时价格
 *
 * @param coins - 币种列表
 * @returns 所有币种的实时价格
 */
export async function getAllCoinGeckoPrices(coins: Coin[]): Promise<RealTimePrice[]> {
  const coinIds = coins.map(coin => COINGECKO_IDS[coin]).join(',');

  try {
    console.log('[CoinGecko] 📡 获取实时价格...');

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data: CoinGeckoPriceResponse = await response.json();

    const prices: RealTimePrice[] = coins.map(coin => {
      const coinId = COINGECKO_IDS[coin];
      const priceData = data[coinId];

      if (!priceData) {
        console.warn(`[CoinGecko] ⚠️  ${coin} 数据缺失`);
        return {
          coin,
          price: 0,
          volume24h: 0,
          change24h: 0,
          timestamp: Date.now(),
        };
      }

      return {
        coin,
        price: priceData.usd,
        volume24h: priceData.usd_24h_vol || 0,
        change24h: priceData.usd_24h_change || 0,
        timestamp: Date.now(),
      };
    });

    console.log('[CoinGecko] ✅ 实时价格获取成功');
    console.log(`[CoinGecko] 📊 BTC: $${prices.find(p => p.coin === 'BTC')?.price.toLocaleString()}`);
    console.log(`[CoinGecko] 📊 ETH: $${prices.find(p => p.coin === 'ETH')?.price.toLocaleString()}`);

    return prices;
  } catch (error) {
    console.error('[CoinGecko] ❌ 批量获取价格失败:', error);

    // 返回默认值
    return coins.map(coin => ({
      coin,
      price: 0,
      volume24h: 0,
      change24h: 0,
      timestamp: Date.now(),
    }));
  }
}

/**
 * 测试 CoinGecko API 连接
 */
export async function testCoinGeckoConnection(): Promise<boolean> {
  try {
    console.log('[CoinGecko] 🔍 测试 API 连接...');

    const result = await getCoinGeckoPrice('BTC');

    if (result.price > 0) {
      console.log('[CoinGecko] ✅ API 连接成功！');
      console.log(`[CoinGecko] 📊 BTC 当前价格: $${result.price.toLocaleString()}`);
      return true;
    } else {
      console.error('[CoinGecko] ❌ API 返回无效数据');
      return false;
    }
  } catch (error) {
    console.error('[CoinGecko] ❌ API 连接失败:', error);
    return false;
  }
}
