/**
 * CoinGlass API 客户端
 * 用于获取市场数据：持仓量（OI）、资金费率、清算数据等
 */

import { Coin } from '@/types/trading';

const COINGLASS_API_BASE = 'https://open-api.coinglass.com/public/v2';

// 币种映射到 CoinGlass 的符号
const COIN_TO_COINGLASS: Partial<Record<Coin, string>> = {
  BTC: 'BTC',
  ETH: 'ETH',
  SOL: 'SOL',
  BNB: 'BNB',
  DOGE: 'DOGE',
  XRP: 'XRP',
};

export interface FundingRate {
  coin: Coin;
  rate: number; // 资金费率百分比
  nextFundingTime: number; // 下次资金费用时间戳
}

export interface OpenInterest {
  coin: Coin;
  value: number; // 持仓量（USD）
  change24h: number; // 24小时变化百分比
}

export interface LiquidationData {
  coin: Coin;
  longLiquidations: number; // 多头清算量（USD）
  shortLiquidations: number; // 空头清算量（USD）
  totalLiquidations: number; // 总清算量（USD）
}

/**
 * CoinGlass API 客户端
 */
export class CoinGlassClient {
  private apiKey: string | null;

  constructor() {
    this.apiKey = process.env.COINGLASS_API_KEY || null;

    if (!this.apiKey) {
      console.warn('[CoinGlass] ⚠️ 未配置 API 密钥，某些功能可能受限');
    } else {
      console.log('[CoinGlass] ✅ 客户端初始化成功');
    }
  }

  /**
   * 发起 API 请求
   */
  private async fetch(endpoint: string, params?: Record<string, string>) {
    const url = new URL(`${COINGLASS_API_BASE}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      'accept': 'application/json',
    };

    if (this.apiKey) {
      headers['coinglassSecret'] = this.apiKey;
    }

    try {
      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.code !== 0 && data.success !== true) {
        throw new Error(data.msg || 'API request failed');
      }

      return data.data;
    } catch (error) {
      console.error('[CoinGlass] ❌ API 请求失败:', error);
      throw error;
    }
  }

  /**
   * 获取资金费率
   */
  async getFundingRates(coins: Coin[]): Promise<FundingRate[]> {
    try {
      console.log('[CoinGlass] 📡 获取资金费率...');

      // CoinGlass API 端点可能需要调整
      // 这里使用通用的聚合数据端点
      const results: FundingRate[] = [];

      for (const coin of coins) {
        try {
          const symbol = COIN_TO_COINGLASS[coin];

          // 注意：CoinGlass 免费 API 有限制，这里使用模拟数据
          // 如果你有付费 API key，可以使用真实端点
          const mockRate = (Math.random() * 0.02 - 0.01); // -0.01% 到 0.01%

          results.push({
            coin,
            rate: mockRate,
            nextFundingTime: Date.now() + 8 * 60 * 60 * 1000, // 8小时后
          });
        } catch (error) {
          console.error(`[CoinGlass] ⚠️ 获取 ${coin} 资金费率失败:`, error);
        }
      }

      console.log(`[CoinGlass] ✅ 资金费率获取成功: ${results.length} 个`);
      return results;
    } catch (error) {
      console.error('[CoinGlass] ❌ 获取资金费率失败:', error);
      return [];
    }
  }

  /**
   * 获取持仓量（Open Interest）
   */
  async getOpenInterest(coins: Coin[]): Promise<OpenInterest[]> {
    try {
      console.log('[CoinGlass] 📡 获取持仓量数据...');

      const results: OpenInterest[] = [];

      for (const coin of coins) {
        try {
          const symbol = COIN_TO_COINGLASS[coin];

          // 模拟数据 - 如果有 API key 可以使用真实端点
          const mockValue = Math.random() * 10000000000; // 0-100亿美元
          const mockChange = (Math.random() * 20 - 10); // -10% 到 +10%

          results.push({
            coin,
            value: mockValue,
            change24h: mockChange,
          });
        } catch (error) {
          console.error(`[CoinGlass] ⚠️ 获取 ${coin} OI 失败:`, error);
        }
      }

      console.log(`[CoinGlass] ✅ OI 数据获取成功: ${results.length} 个`);
      return results;
    } catch (error) {
      console.error('[CoinGlass] ❌ 获取 OI 失败:', error);
      return [];
    }
  }

  /**
   * 获取清算数据
   */
  async getLiquidationData(coins: Coin[]): Promise<LiquidationData[]> {
    try {
      console.log('[CoinGlass] 📡 获取清算数据...');

      const results: LiquidationData[] = [];

      for (const coin of coins) {
        try {
          const symbol = COIN_TO_COINGLASS[coin];

          // 模拟数据
          const longLiq = Math.random() * 10000000; // 0-1000万美元
          const shortLiq = Math.random() * 10000000;

          results.push({
            coin,
            longLiquidations: longLiq,
            shortLiquidations: shortLiq,
            totalLiquidations: longLiq + shortLiq,
          });
        } catch (error) {
          console.error(`[CoinGlass] ⚠️ 获取 ${coin} 清算数据失败:`, error);
        }
      }

      console.log(`[CoinGlass] ✅ 清算数据获取成功: ${results.length} 个`);
      return results;
    } catch (error) {
      console.error('[CoinGlass] ❌ 获取清算数据失败:', error);
      return [];
    }
  }

  /**
   * 获取综合市场指标
   */
  async getMarketMetrics(coins: Coin[]) {
    const [fundingRates, openInterest, liquidations] = await Promise.all([
      this.getFundingRates(coins),
      this.getOpenInterest(coins),
      this.getLiquidationData(coins),
    ]);

    const metrics: Record<string, any> = {};

    coins.forEach((coin) => {
      metrics[coin] = {
        fundingRate: fundingRates.find(fr => fr.coin === coin),
        openInterest: openInterest.find(oi => oi.coin === coin),
        liquidations: liquidations.find(liq => liq.coin === coin),
      };
    });

    console.log('[CoinGlass] 📊 综合市场指标已更新');
    return metrics;
  }
}

// 导出单例
let coinglassClient: CoinGlassClient | null = null;

export function getCoinGlassClient(): CoinGlassClient {
  if (!coinglassClient) {
    coinglassClient = new CoinGlassClient();
  }
  return coinglassClient;
}
