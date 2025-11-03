/**
 * Hyperliquid API 客户端
 * 用于与 Hyperliquid DEX 交互，执行真实的永续合约交易
 */

import { Hyperliquid } from 'hyperliquid';
import { Coin } from '@/types/trading';

// Hyperliquid 配置
const HYPERLIQUID_CONFIG = {
  mainWalletAddress: process.env.HYPERLIQUID_MAIN_WALLET || '',
  apiWalletAddress: process.env.HYPERLIQUID_API_WALLET || '',
  apiSecretKey: process.env.HYPERLIQUID_API_SECRET || '',
  testnet: process.env.HYPERLIQUID_TESTNET === 'true',
};

// 币种映射到 Hyperliquid 的永续合约交易对
const COIN_TO_SYMBOL: Record<Coin, string> = {
  BTC: 'BTC-PERP',   // ✅ 永续合约符号
  ETH: 'ETH-PERP',   // ✅ 永续合约符号
  SOL: 'SOL-PERP',   // ✅ 永续合约符号
  BNB: 'BNB-PERP',   // ✅ 永续合约符号
  DOGE: 'DOGE-PERP', // ✅ 永续合约符号
  XRP: 'XRP-PERP',   // ✅ 永续合约符号
};

/**
 * Hyperliquid 客户端类
 */
export class HyperliquidClient {
  private client: any;
  private isInitialized: boolean = false;

  constructor() {
    console.log('[Hyperliquid] 🚀 初始化客户端...');

    if (!HYPERLIQUID_CONFIG.apiSecretKey) {
      console.warn('[Hyperliquid] ⚠️ 未配置 API 密钥，将使用只读模式');
      return;
    }

    try {
      // ✅ 关键修复：使用 API Agent Wallet 时必须指定主钱包地址
      this.client = new Hyperliquid({
        privateKey: HYPERLIQUID_CONFIG.apiSecretKey,
        testnet: HYPERLIQUID_CONFIG.testnet,
        walletAddress: HYPERLIQUID_CONFIG.mainWalletAddress, // ← 主钱包地址
      });

      this.isInitialized = true;
      console.log('[Hyperliquid] ✅ 客户端初始化成功');
      console.log(`[Hyperliquid] 📍 模式: ${HYPERLIQUID_CONFIG.testnet ? 'Testnet' : 'Mainnet'}`);
      console.log(`[Hyperliquid] 👛 主钱包: ${HYPERLIQUID_CONFIG.mainWalletAddress}`);
      console.log(`[Hyperliquid] 🔑 API 钱包: ${HYPERLIQUID_CONFIG.apiWalletAddress}`);
    } catch (error) {
      console.error('[Hyperliquid] ❌ 初始化失败:', error);
    }
  }

  /**
   * 检查客户端是否可用
   */
  isAvailable(): boolean {
    return this.isInitialized && !!this.client;
  }

  /**
   * 获取账户信息
   */
  async getAccountInfo() {
    if (!this.isAvailable()) {
      throw new Error('Hyperliquid 客户端未初始化');
    }

    try {
      const address = HYPERLIQUID_CONFIG.mainWalletAddress;

      // ✅ 使用正确的 API：sdk.info.perpetuals.getClearinghouseState()
      const accountState = await this.client.info.perpetuals.getClearinghouseState(address);

      // 🔍 调试：打印完整的账户状态
      console.log('[Hyperliquid] 🔍 完整账户状态:', JSON.stringify(accountState, null, 2));

      // 尝试多种可能的字段名
      const marginUsed = accountState.marginUsed || accountState.margin_used || accountState.marginSummary?.accountValue || 0;
      const withdrawable = accountState.withdrawable || accountState.withdrawable || 0;
      const accountValue = accountState.accountValue || accountState.account_value || accountState.marginSummary?.totalMarginUsed || withdrawable;

      console.log('[Hyperliquid] 📊 解析后的账户状态:', {
        marginUsed,
        withdrawable,
        accountValue,
      });

      return {
        address,
        marginUsed: parseFloat(String(marginUsed)),
        withdrawable: parseFloat(String(withdrawable)),
        accountValue: parseFloat(String(accountValue)),
        positions: accountState.assetPositions || [],
      };
    } catch (error) {
      console.error('[Hyperliquid] ❌ 获取账户信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取市场价格
   */
  async getMarketPrice(coin: Coin): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('Hyperliquid 客户端未初始化');
    }

    try {
      const symbol = COIN_TO_SYMBOL[coin];
      const allMids = await this.client.info.getAllMids();

      const price = parseFloat(allMids[symbol] || '0');
      console.log(`[Hyperliquid] 💹 ${coin} 价格: $${price}`);

      return price;
    } catch (error) {
      console.error(`[Hyperliquid] ❌ 获取 ${coin} 价格失败:`, error);
      throw error;
    }
  }

  /**
   * 获取所有市场价格
   */
  async getAllMarketPrices(): Promise<Record<Coin, number>> {
    if (!this.isAvailable()) {
      throw new Error('Hyperliquid 客户端未初始化');
    }

    try {
      const allMids = await this.client.info.getAllMids();

      // 🔍 调试：打印原始数据
      console.log('[Hyperliquid] 🔍 原始数据类型:', typeof allMids);
      console.log('[Hyperliquid] 🔍 原始数据:', JSON.stringify(allMids).substring(0, 200));

      const prices: Record<string, number> = {};

      for (const [coin, symbol] of Object.entries(COIN_TO_SYMBOL)) {
        const rawPrice = allMids[symbol];
        const price = parseFloat(rawPrice || '0');
        prices[coin] = price;

        console.log(`[Hyperliquid] 💹 ${coin} (${symbol}): ${rawPrice} => ${price}`);
      }

      console.log('[Hyperliquid] 💹 所有市场价格已更新');
      return prices as Record<Coin, number>;
    } catch (error) {
      console.error('[Hyperliquid] ❌ 获取市场价格失败:', error);
      throw error;
    }
  }

  /**
   * 下市价单
   */
  async placeMarketOrder(params: {
    coin: Coin;
    side: 'LONG' | 'SHORT';
    size: number;
    leverage: number;
    reduceOnly?: boolean;
  }) {
    if (!this.isAvailable()) {
      throw new Error('Hyperliquid 客户端未初始化');
    }

    const { coin, side, size, leverage, reduceOnly = false } = params;
    const symbol = COIN_TO_SYMBOL[coin];

    console.log(`[Hyperliquid] 📝 下单:`, {
      symbol,
      side,
      size,
      leverage,
      reduceOnly,
    });

    try {
      const isBuy = side === 'LONG';

      const order = await this.client.exchange.marketOrder(
        symbol,
        isBuy,
        size,
        null, // slippage (null = market order)
        reduceOnly
      );

      console.log('[Hyperliquid] ✅ 订单已提交:', order);
      return order;
    } catch (error) {
      console.error('[Hyperliquid] ❌ 下单失败:', error);
      throw error;
    }
  }

  /**
   * 下限价单
   */
  async placeLimitOrder(params: {
    coin: Coin;
    side: 'LONG' | 'SHORT';
    size: number;
    price: number;
    leverage: number;
    reduceOnly?: boolean;
  }) {
    if (!this.isAvailable()) {
      throw new Error('Hyperliquid 客户端未初始化');
    }

    const { coin, side, size, price, leverage, reduceOnly = false } = params;
    const symbol = COIN_TO_SYMBOL[coin];

    console.log(`[Hyperliquid] 📝 下限价单:`, {
      symbol,
      side,
      size,
      price,
      leverage,
      reduceOnly,
    });

    try {
      const isBuy = side === 'LONG';

      const order = await this.client.exchange.limitOrder(
        symbol,
        isBuy,
        size,
        price,
        reduceOnly
      );

      console.log('[Hyperliquid] ✅ 限价单已提交:', order);
      return order;
    } catch (error) {
      console.error('[Hyperliquid] ❌ 下限价单失败:', error);
      throw error;
    }
  }

  /**
   * 平仓
   */
  async closePosition(coin: Coin) {
    if (!this.isAvailable()) {
      throw new Error('Hyperliquid 客户端未初始化');
    }

    const symbol = COIN_TO_SYMBOL[coin];
    console.log(`[Hyperliquid] 🔄 平仓: ${symbol}`);

    try {
      // 获取当前持仓
      const accountInfo = await this.getAccountInfo();
      const position = accountInfo.positions.find(
        (p: any) => p.position.coin === symbol
      );

      if (!position) {
        console.log(`[Hyperliquid] ℹ️ ${symbol} 无持仓`);
        return null;
      }

      const size = Math.abs(parseFloat(position.position.szi));
      const isBuy = parseFloat(position.position.szi) < 0; // 如果是空头，平仓需要买入

      const order = await this.client.exchange.marketOrder(
        symbol,
        isBuy,
        size,
        null,
        true // reduceOnly = true
      );

      console.log(`[Hyperliquid] ✅ ${symbol} 平仓成功`);
      return order;
    } catch (error) {
      console.error(`[Hyperliquid] ❌ ${coin} 平仓失败:`, error);
      throw error;
    }
  }

  /**
   * 获取当前持仓
   */
  async getPositions() {
    if (!this.isAvailable()) {
      throw new Error('Hyperliquid 客户端未初始化');
    }

    try {
      const accountInfo = await this.getAccountInfo();

      const positions = (accountInfo.positions || []).map((p: any) => ({
        coin: p.position.coin,
        size: parseFloat(p.position.szi),
        entryPrice: parseFloat(p.position.entryPx || '0'),
        unrealizedPnL: parseFloat(p.position.unrealizedPnl || '0'),
        leverage: parseFloat(p.position.leverage?.value || '1'),
        side: parseFloat(p.position.szi) > 0 ? 'LONG' : 'SHORT',
      }));

      console.log(`[Hyperliquid] 📊 当前持仓: ${positions.length} 个`);
      return positions;
    } catch (error) {
      console.error('[Hyperliquid] ❌ 获取持仓失败:', error);
      throw error;
    }
  }

  /**
   * 设置杠杆
   */
  async setLeverage(coin: Coin, leverage: number) {
    if (!this.isAvailable()) {
      throw new Error('Hyperliquid 客户端未初始化');
    }

    const symbol = COIN_TO_SYMBOL[coin];
    console.log(`[Hyperliquid] ⚙️ 设置杠杆: ${symbol} ${leverage}x`);

    try {
      await this.client.exchange.updateLeverage(symbol, leverage, false);
      console.log(`[Hyperliquid] ✅ ${symbol} 杠杆已设置为 ${leverage}x`);
    } catch (error) {
      console.error(`[Hyperliquid] ❌ 设置杠杆失败:`, error);
      throw error;
    }
  }
}

// 导出单例
let hyperliquidClient: HyperliquidClient | null = null;

export function getHyperliquidClient(): HyperliquidClient {
  if (!hyperliquidClient) {
    hyperliquidClient = new HyperliquidClient();
  }
  return hyperliquidClient;
}
