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
  // 主流币种 (原有6个)
  BTC: 'BTC-PERP',
  ETH: 'ETH-PERP',
  SOL: 'SOL-PERP',
  BNB: 'BNB-PERP',
  DOGE: 'DOGE-PERP',
  XRP: 'XRP-PERP',
  
  // L1公链
  ATOM: 'ATOM-PERP',
  AVAX: 'AVAX-PERP',
  DOT: 'DOT-PERP',
  ADA: 'ADA-PERP',
  NEAR: 'NEAR-PERP',
  FIL: 'FIL-PERP',
  TIA: 'TIA-PERP',
  TON: 'TON-PERP',
  SUI: 'SUI-PERP',
  APT: 'APT-PERP',
  SEI: 'SEI-PERP',
  INJ: 'INJ-PERP',
  
  // DeFi蓝筹
  UNI: 'UNI-PERP',
  LINK: 'LINK-PERP',
  AAVE: 'AAVE-PERP',
  CRV: 'CRV-PERP',
  LDO: 'LDO-PERP',
  PENDLE: 'PENDLE-PERP',
  ENS: 'ENS-PERP',
  SUSHI: 'SUSHI-PERP',
  
  // L2/扩容
  OP: 'OP-PERP',
  ARB: 'ARB-PERP',
  MATIC: 'MATIC-PERP',
  LTC: 'LTC-PERP',
  BCH: 'BCH-PERP',
  ETC: 'ETC-PERP',
  
  // Meme币热门
  kPEPE: 'kPEPE-PERP',
  kSHIB: 'kSHIB-PERP',
  WIF: 'WIF-PERP',
  POPCAT: 'POPCAT-PERP',
  BOME: 'BOME-PERP',
  GOAT: 'GOAT-PERP',
  PNUT: 'PNUT-PERP',
  PENGU: 'PENGU-PERP',
  kBONK: 'kBONK-PERP',
  
  // AI概念
  AIXBT: 'AIXBT-PERP',
  VIRTUAL: 'VIRTUAL-PERP',
  ZEREBRO: 'ZEREBRO-PERP',
  TAO: 'TAO-PERP',
  RENDER: 'RENDER-PERP',
  FET: 'FET-PERP',
  
  // 新热点
  TRUMP: 'TRUMP-PERP',
  HYPE: 'HYPE-PERP',
  MOVE: 'MOVE-PERP',
  ME: 'ME-PERP',
  USUAL: 'USUAL-PERP',
  MORPHO: 'MORPHO-PERP',
  
  // 游戏/NFT
  IMX: 'IMX-PERP',
  GALA: 'GALA-PERP',
  SAND: 'SAND-PERP',
  GMT: 'GMT-PERP',
  YGG: 'YGG-PERP',
  BIGTIME: 'BIGTIME-PERP',
  
  // 其他热门
  JUP: 'JUP-PERP',
  PYTH: 'PYTH-PERP',
  ONDO: 'ONDO-PERP',
  ENA: 'ENA-PERP',
  JTO: 'JTO-PERP',
  W: 'W-PERP',
  STRK: 'STRK-PERP',
  ETHFI: 'ETHFI-PERP',
  BLAST: 'BLAST-PERP'
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
      // ✅ 修复：accountValue 应该优先使用 marginSummary.accountValue
      const withdrawable = accountState.withdrawable || 0;
      const accountValue = accountState.marginSummary?.accountValue || accountState.accountValue || accountState.account_value || withdrawable;
      const marginUsed = accountState.marginUsed || accountState.margin_used || (accountValue - withdrawable) || 0;

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
   * 获取市场价格（单个币种）
   */
  async getMarketPrice(coin: Coin): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('Hyperliquid 客户端未初始化');
    }

    try {
      const symbol = COIN_TO_SYMBOL[coin];
      if (!symbol) {
        throw new Error(`不支持的币种: ${coin}`);
      }
      
      const allMids = await this.client.info.getAllMids();
      const price = parseFloat(allMids[symbol] || '0');
      
      // 只有在实际交易时才打印价格日志，避免日志污染
      // console.log(`[Hyperliquid] 💹 ${coin} 价格: $${price}`);

      return price;
    } catch (error) {
      console.error(`[Hyperliquid] ❌ 获取 ${coin} 价格失败:`, error);
      throw error;
    }
  }

  /**
   * 获取任意币种的实时价格（用于交易执行）
   */
  async getAnyCoinPrice(coin: Coin): Promise<number> {
    const symbol = COIN_TO_SYMBOL[coin];
    if (!symbol) {
      throw new Error(`不支持的币种: ${coin}`);
    }
    
    try {
      const allMids = await this.client.info.getAllMids();
      const price = parseFloat(allMids[symbol] || '0');
      console.log(`[Hyperliquid] 🎯 获取 ${coin} 交易价格: $${price}`);
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

      // 只获取主要6个币种的价格，保持界面简洁
      const mainCoins = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'AVAX'];
      
      for (const coin of mainCoins) {
        const symbol = COIN_TO_SYMBOL[coin as Coin];
        const rawPrice = allMids[symbol];
        const price = parseFloat(rawPrice || '0');
        prices[coin] = price;

        console.log(`[Hyperliquid] 💹 ${coin} (${symbol}): ${rawPrice} => ${price}`);
      }

      console.log('[Hyperliquid] 💹 所有市场价格已更新');
      return prices as Record<Coin, number>;
    } catch (error) {
      console.error('[Hyperliquid] ❌ 获取市场价格失败:', error);
      console.warn('[Hyperliquid] ⚠️ API临时不可用，将降级到备用价格源');
      return null; // 返回null让系统降级到CoinGecko
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

      // 获取当前市场价格
      console.log(`[Hyperliquid] 📡 获取 ${coin} 市场价格...`);
      const currentPrice = await this.getMarketPrice(coin);

      if (!currentPrice || currentPrice === 0) {
        throw new Error(`无法获取 ${coin} 的市场价格`);
      }

      console.log(`[Hyperliquid] 💰 ${coin} 当前价格: $${currentPrice.toFixed(2)}`);

      // 设置一个有利的价格（买入时略高，卖出时略低），确保成交
      const slippage = 0.01; // 1% 滑点
      const limitPrice = isBuy
        ? currentPrice * (1 + slippage)  // 买入价略高
        : currentPrice * (1 - slippage); // 卖出价略低

      console.log(`[Hyperliquid] 🎯 下单价格: $${limitPrice.toFixed(2)} (${isBuy ? '买入' : '卖出'}, 含 1% 滑点)`);

      // 🔥 关键修复：将美元金额转换为币的数量
      // size 是美元金额（如 $669.36）
      // Hyperliquid需要的是币的数量（如 4111 DOGE）
      let coinQuantity = size / currentPrice;

      // 🔥 修复精度问题：Hyperliquid对不同币种有不同的精度要求（从API查询的真实值）
      // 根据币种设置合适的小数位数，避免 "floatToWire causes rounding" 错误
      const precisionMap: Record<string, number> = {
        'BTC': 5,   // BTC: 5位小数（API返回）
        'ETH': 4,   // ETH: 4位小数（API返回）
        'SOL': 2,   // SOL: 2位小数（API返回）
        'BNB': 3,   // BNB: 3位小数（API返回）
        'DOGE': 0,  // DOGE: 整数（API返回）
        'XRP': 0,   // XRP: 整数（暂无测试网数据，估计值）
      };

      console.log(`[Hyperliquid] 🔍 调试: coin="${coin}", symbol="${symbol}"`);
      const precision = precisionMap[coin] || 5;
      coinQuantity = Number(coinQuantity.toFixed(precision));

      console.log(`[Hyperliquid] 💵 订单金额: $${size.toFixed(2)} → ${coinQuantity} ${coin} (精度: ${precision}位)`);

      const order = await this.client.exchange.placeOrder({
        coin: symbol,
        is_buy: isBuy,
        sz: coinQuantity,
        limit_px: limitPrice.toFixed(2),
        order_type: { limit: { tif: 'Ioc' } }, // IoC = Immediate or Cancel (市价单)
        reduce_only: reduceOnly,
      });

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

      // 获取当前价格用于市价单
      const currentPrice = await this.getMarketPrice(coin);
      // 使用 1% 滑点的限价单模拟市价单
      const limitPrice = isBuy ? currentPrice * 1.01 : currentPrice * 0.99;

      // 格式化数量精度
      const precision = this.getPrecision(coin);
      const formattedSize = parseFloat(size.toFixed(precision));

      const order = await this.client.exchange.placeOrder({
        coin: symbol,
        is_buy: isBuy,
        sz: formattedSize,
        limit_px: limitPrice.toFixed(2),
        order_type: { limit: { tif: 'Ioc' } }, // IoC = Immediate or Cancel (市价单)
        reduce_only: true,
      });

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
    console.log(`[Hyperliquid] ⚙️ 设置杠杆: ${symbol} ${leverage}x (cross)`);

    try {
      // leverageMode: "cross" for cross leverage, "isolated" for isolated leverage
      await this.client.exchange.updateLeverage(symbol, "cross", leverage);
      console.log(`[Hyperliquid] ✅ ${symbol} 杠杆已设置为 ${leverage}x (cross)`);
    } catch (error) {
      console.error(`[Hyperliquid] ❌ 设置杠杆失败:`, error);
      throw error;
    }
  }

  /**
   * 获取币种精度
   */
  private getPrecision(coin: Coin): number {
    // 基于Hyperliquid API返回的szDecimals值
    const precisionMap: Record<Coin, number> = {
      // 主流币种
      'BTC': 5,   'ETH': 4,   'SOL': 2,   'BNB': 3,   'DOGE': 0,   'XRP': 0,
      
      // L1公链
      'ATOM': 2,  'AVAX': 2,  'DOT': 1,   'ADA': 0,   'NEAR': 1,  'FIL': 1,
      'TIA': 1,   'TON': 1,   'SUI': 1,   'APT': 2,   'SEI': 0,   'INJ': 1,
      
      // DeFi蓝筹
      'UNI': 1,   'LINK': 1,  'AAVE': 2,  'CRV': 1,   'LDO': 1,   'PENDLE': 0,
      'ENS': 2,   'SUSHI': 1,
      
      // L2/扩容
      'OP': 1,    'ARB': 1,   'MATIC': 1, 'LTC': 2,   'BCH': 3,   'ETC': 2,
      
      // Meme币热门
      'kPEPE': 0, 'kSHIB': 0, 'WIF': 0,   'POPCAT': 0,'BOME': 0,  'GOAT': 0,
      'PNUT': 1,  'PENGU': 0, 'kBONK': 0,
      
      // AI概念
      'AIXBT': 0, 'VIRTUAL': 1,'ZEREBRO': 0,'TAO': 3,  'RENDER': 1,'FET': 0,
      
      // 新热点
      'TRUMP': 1, 'HYPE': 2,  'MOVE': 0,  'ME': 1,    'USUAL': 1, 'MORPHO': 1,
      
      // 游戏/NFT
      'IMX': 1,   'GALA': 0,  'SAND': 0,  'GMT': 0,   'YGG': 0,   'BIGTIME': 0,
      
      // 其他热门
      'JUP': 0,   'PYTH': 0,  'ONDO': 0,  'ENA': 0,   'JTO': 0,   'W': 1,
      'STRK': 1,  'ETHFI': 1, 'BLAST': 0
    };
    return precisionMap[coin] || 2; // 默认2位小数
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
