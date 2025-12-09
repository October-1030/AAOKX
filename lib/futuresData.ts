/**
 * 获取合约数据（Open Interest & Funding Rate）
 *
 * 数据来源：Binance Futures 公开 API
 * 完全免费，无需注册，无需 API Key！
 *
 * API 文档：https://binance-docs.github.io/apidocs/futures/en/
 */

import { Coin } from '@/types/trading';

/**
 * 合约数据接口
 */
export interface FuturesData {
  coin: Coin;
  openInterest: number;      // 持仓量（USDT）
  fundingRate: number;       // 当前资金费率（%）
  nextFundingTime: number;   // 下次资金费时间（时间戳）
  markPrice: number;         // 标记价格
  indexPrice: number;        // 指数价格
  lastUpdateTime: number;    // 最后更新时间
}

/**
 * 币种符号映射（Binance 格式）
 */
const SYMBOL_MAP: Partial<Record<Coin, string>> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
  BNB: 'BNBUSDT',
  DOGE: 'DOGEUSDT',
  XRP: 'XRPUSDT',
};

/**
 * 获取单个币种的 Open Interest
 *
 * @param coin - 币种
 * @returns Open Interest（USDT）
 *
 * @example
 * const oi = await getOpenInterest('BTC');
 * console.log(`BTC 持仓量: ${oi.toLocaleString()} USDT`);
 */
async function getOpenInterest(coin: Coin): Promise<number> {
  const symbol = SYMBOL_MAP[coin];
  const url = `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return parseFloat(data.openInterestValue || data.openInterest || '0');
  } catch (error) {
    console.error(`[FuturesData] 获取 ${coin} Open Interest 失败:`, error);
    return 0;
  }
}

/**
 * 获取单个币种的 Funding Rate
 *
 * @param coin - 币种
 * @returns { fundingRate, nextFundingTime }
 *
 * @example
 * const { fundingRate, nextFundingTime } = await getFundingRate('BTC');
 * console.log(`BTC 资金费率: ${(fundingRate * 100).toFixed(4)}%`);
 */
async function getFundingRate(
  coin: Coin
): Promise<{ fundingRate: number; nextFundingTime: number }> {
  const symbol = SYMBOL_MAP[coin];
  const url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.length === 0) {
      return { fundingRate: 0, nextFundingTime: Date.now() + 28800000 };
    }

    return {
      fundingRate: parseFloat(data[0].fundingRate || '0'),
      nextFundingTime: parseInt(data[0].fundingTime || Date.now()),
    };
  } catch (error) {
    console.error(`[FuturesData] 获取 ${coin} Funding Rate 失败:`, error);
    return { fundingRate: 0, nextFundingTime: Date.now() + 28800000 };
  }
}

/**
 * 获取单个币种的 Mark Price 和 Index Price
 *
 * @param coin - 币种
 * @returns { markPrice, indexPrice }
 *
 * @example
 * const { markPrice, indexPrice } = await getMarkPrice('BTC');
 * console.log(`BTC 标记价格: $${markPrice.toLocaleString()}`);
 */
async function getMarkPrice(
  coin: Coin
): Promise<{ markPrice: number; indexPrice: number }> {
  const symbol = SYMBOL_MAP[coin];
  const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      markPrice: parseFloat(data.markPrice || '0'),
      indexPrice: parseFloat(data.indexPrice || '0'),
    };
  } catch (error) {
    console.error(`[FuturesData] 获取 ${coin} Mark Price 失败:`, error);
    return { markPrice: 0, indexPrice: 0 };
  }
}

/**
 * 获取单个币种的完整合约数据
 *
 * @param coin - 币种
 * @returns 完整的合约数据
 *
 * @example
 * const data = await getFuturesData('BTC');
 * console.log(`BTC 持仓量: ${data.openInterest.toLocaleString()} USDT`);
 * console.log(`资金费率: ${(data.fundingRate * 100).toFixed(4)}%`);
 */
export async function getFuturesData(coin: Coin): Promise<FuturesData> {
  console.log(`[FuturesData] 获取 ${coin} 合约数据...`);

  const [openInterest, fundingData, priceData] = await Promise.all([
    getOpenInterest(coin),
    getFundingRate(coin),
    getMarkPrice(coin),
  ]);

  const data: FuturesData = {
    coin,
    openInterest,
    fundingRate: fundingData.fundingRate,
    nextFundingTime: fundingData.nextFundingTime,
    markPrice: priceData.markPrice,
    indexPrice: priceData.indexPrice,
    lastUpdateTime: Date.now(),
  };

  console.log(`[FuturesData] ${coin} 数据获取成功:`);
  console.log(`  - 持仓量: ${data.openInterest.toLocaleString()} USDT`);
  console.log(`  - 资金费率: ${(data.fundingRate * 100).toFixed(4)}%`);
  console.log(`  - 标记价格: $${data.markPrice.toLocaleString()}`);

  return data;
}

/**
 * 批量获取所有币种的合约数据
 *
 * @param coins - 币种列表
 * @returns 所有币种的合约数据
 *
 * @example
 * const allData = await getAllFuturesData(['BTC', 'ETH', 'SOL']);
 * allData.forEach(data => {
 *   console.log(`${data.coin}: OI=${data.openInterest}, FR=${data.fundingRate}`);
 * });
 */
export async function getAllFuturesData(
  coins: Coin[]
): Promise<FuturesData[]> {
  console.log(`[FuturesData] 批量获取 ${coins.length} 个币种的合约数据...\n`);

  const results = await Promise.all(coins.map((coin) => getFuturesData(coin)));

  console.log('\n[FuturesData] 批量获取完成！\n');
  return results;
}

/**
 * 解释 Funding Rate（资金费率）
 *
 * 资金费率是永续合约特有的机制，用于保持合约价格与现货价格一致。
 *
 * - **正值（> 0）**：多头支付空头，表示市场偏多（看涨）
 * - **负值（< 0）**：空头支付多头，表示市场偏空（看跌）
 * - **接近 0**：市场中性
 *
 * 典型范围：-0.05% 到 +0.05%（每 8 小时）
 * 极端情况：可能达到 ±0.5% 或更高
 *
 * @param fundingRate - 资金费率
 * @returns 人类可读的解释
 */
export function explainFundingRate(fundingRate: number): {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: 'EXTREME' | 'STRONG' | 'MODERATE' | 'WEAK';
  description: string;
  color: string;
} {
  const percentage = fundingRate * 100;
  const absPercentage = Math.abs(percentage);

  // 判断情绪
  let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  if (fundingRate > 0.01) sentiment = 'BULLISH';
  else if (fundingRate < -0.01) sentiment = 'BEARISH';
  else sentiment = 'NEUTRAL';

  // 判断强度
  let strength: 'EXTREME' | 'STRONG' | 'MODERATE' | 'WEAK';
  if (absPercentage > 0.5) strength = 'EXTREME';
  else if (absPercentage > 0.1) strength = 'STRONG';
  else if (absPercentage > 0.03) strength = 'MODERATE';
  else strength = 'WEAK';

  // 生成描述
  let description: string;
  if (sentiment === 'BULLISH') {
    description = `多头主导，多头需支付 ${percentage.toFixed(4)}% 给空头`;
  } else if (sentiment === 'BEARISH') {
    description = `空头主导，空头需支付 ${Math.abs(percentage).toFixed(4)}% 给多头`;
  } else {
    description = `市场中性，费率接近零`;
  }

  // 颜色
  const color =
    sentiment === 'BULLISH'
      ? '#10b981' // 绿色（多头）
      : sentiment === 'BEARISH'
      ? '#ef4444' // 红色（空头）
      : '#6b7280'; // 灰色（中性）

  return { sentiment, strength, description, color };
}

/**
 * 解释 Open Interest（持仓量）
 *
 * 持仓量表示市场上所有未平仓合约的总价值。
 *
 * - **上升**：新资金进入市场，趋势可能延续
 * - **下降**：资金退出市场，趋势可能反转
 * - **与价格同向**：趋势强劲
 * - **与价格反向**：趋势疲软
 *
 * @param openInterest - 持仓量（USDT）
 * @returns 人类可读的解释
 */
export function explainOpenInterest(openInterest: number): {
  level: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW';
  description: string;
  color: string;
} {
  // 这里使用简化的判断，实际应该与历史数据对比
  let level: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW';
  let description: string;

  if (openInterest > 10_000_000_000) {
    // > 100 亿
    level = 'VERY_HIGH';
    description = `极高持仓量（${(openInterest / 1_000_000_000).toFixed(2)}B USDT），市场非常活跃`;
  } else if (openInterest > 5_000_000_000) {
    // > 50 亿
    level = 'HIGH';
    description = `高持仓量（${(openInterest / 1_000_000_000).toFixed(2)}B USDT），市场活跃`;
  } else if (openInterest > 1_000_000_000) {
    // > 10 亿
    level = 'MODERATE';
    description = `中等持仓量（${(openInterest / 1_000_000_000).toFixed(2)}B USDT），市场正常`;
  } else {
    level = 'LOW';
    description = `低持仓量（${(openInterest / 1_000_000).toFixed(2)}M USDT），市场冷清`;
  }

  const color =
    level === 'VERY_HIGH'
      ? '#ef4444' // 红色（警惕）
      : level === 'HIGH'
      ? '#f59e0b' // 橙色（注意）
      : level === 'MODERATE'
      ? '#10b981' // 绿色（正常）
      : '#6b7280'; // 灰色（冷清）

  return { level, description, color };
}
