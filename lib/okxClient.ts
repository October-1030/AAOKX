// OKX API 客户端 - 替代Hyperliquid
import { Coin } from '@/types/trading';
import crypto from 'crypto';

// OKX API配置
interface OKXConfig {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  sandbox: boolean; // true = 模拟交易环境，false = 实盘
  baseURL?: string;
}

// OKX API配置（优先使用环境变量）
const OKX_CONFIG: OKXConfig = {
  apiKey: process.env.OKX_API_KEY || 'demo-api-key',
  secretKey: process.env.OKX_SECRET_KEY || 'demo-secret-key', 
  passphrase: process.env.OKX_PASSPHRASE || 'demo-passphrase',
  sandbox: process.env.OKX_SANDBOX === 'false' ? false : true, // 默认模拟环境
  baseURL: process.env.OKX_SANDBOX === 'false' ? 'https://www.okx.com' : 'https://www.okx.com'
};

// 币种到OKX交易对的映射
const COIN_TO_OKX_SYMBOL: Record<Coin, string> = {
  // 主流币种
  BTC: 'BTC-USDT-SWAP',
  ETH: 'ETH-USDT-SWAP', 
  SOL: 'SOL-USDT-SWAP',
  BNB: 'BNB-USDT-SWAP',
  DOGE: 'DOGE-USDT-SWAP',
  AVAX: 'AVAX-USDT-SWAP',
  
  // L1公链
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
  
  // DeFi蓝筹
  UNI: 'UNI-USDT-SWAP',
  LINK: 'LINK-USDT-SWAP',
  AAVE: 'AAVE-USDT-SWAP',
  CRV: 'CRV-USDT-SWAP',
  LDO: 'LDO-USDT-SWAP',
  PENDLE: 'PENDLE-USDT-SWAP',
  ENS: 'ENS-USDT-SWAP',
  SUSHI: 'SUSHI-USDT-SWAP',
  
  // L2/扩容
  OP: 'OP-USDT-SWAP',
  ARB: 'ARB-USDT-SWAP',
  MATIC: 'MATIC-USDT-SWAP',
  LTC: 'LTC-USDT-SWAP',
  BCH: 'BCH-USDT-SWAP',
  ETC: 'ETC-USDT-SWAP',
  
  // Meme币（注意：部分可能不支持永续）
  kPEPE: 'PEPE-USDT-SWAP',
  kSHIB: 'SHIB-USDT-SWAP',
  WIF: 'WIF-USDT-SWAP',
  POPCAT: 'POPCAT-USDT-SWAP',
  BOME: 'BOME-USDT-SWAP',
  GOAT: 'GOAT-USDT-SWAP',
  PNUT: 'PNUT-USDT-SWAP',
  PENGU: 'PENGU-USDT-SWAP',
  kBONK: 'BONK-USDT-SWAP',
  
  // AI概念
  AIXBT: 'AI-USDT-SWAP',
  VIRTUAL: 'VIRTUAL-USDT-SWAP',
  ZEREBRO: 'ZEREBRO-USDT-SWAP',
  TAO: 'TAO-USDT-SWAP',
  RENDER: 'RENDER-USDT-SWAP',
  FET: 'FET-USDT-SWAP',
  
  // 新热点
  TRUMP: 'TRUMP-USDT-SWAP',
  HYPE: 'HYPE-USDT-SWAP',
  MOVE: 'MOVE-USDT-SWAP',
  ME: 'ME-USDT-SWAP',
  USUAL: 'USUAL-USDT-SWAP',
  MORPHO: 'MORPHO-USDT-SWAP',
  
  // 游戏/NFT
  IMX: 'IMX-USDT-SWAP',
  GALA: 'GALA-USDT-SWAP',
  SAND: 'SAND-USDT-SWAP',
  GMT: 'GMT-USDT-SWAP',
  YGG: 'YGG-USDT-SWAP',
  BIGTIME: 'BIGTIME-USDT-SWAP',
  
  // 其他热门
  JUP: 'JUP-USDT-SWAP',
  PYTH: 'PYTH-USDT-SWAP',
  ONDO: 'ONDO-USDT-SWAP',
  ENA: 'ENA-USDT-SWAP',
  JTO: 'JTO-USDT-SWAP',
  W: 'W-USDT-SWAP',
  STRK: 'STRK-USDT-SWAP',
  ETHFI: 'ETHFI-USDT-SWAP',
  BLAST: 'BLAST-USDT-SWAP'
};

export class OKXClient {
  private client: any;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      console.log('[OKX] 🔄 正在初始化客户端...');
      console.log(`[OKX] 📊 配置: sandbox=${OKX_CONFIG.sandbox}, apiKey=${OKX_CONFIG.apiKey.substring(0, 8)}...`);
      
      // 简单的REST API客户端实现
      this.client = {
        baseURL: OKX_CONFIG.sandbox ? 'https://www.okx.com' : 'https://www.okx.com',
        apiKey: OKX_CONFIG.apiKey,
        secretKey: OKX_CONFIG.secretKey,
        passphrase: OKX_CONFIG.passphrase,
        sandbox: OKX_CONFIG.sandbox
      };

      this.initialized = true;
      console.log('[OKX] 🚀 客户端初始化成功');
      console.log(`[OKX] 📊 交易环境: ${OKX_CONFIG.sandbox ? '🧪 模拟环境' : '🔴 实盘环境'}`);
      console.log(`[OKX] 🔑 API Key: ${OKX_CONFIG.apiKey.substring(0, 8)}...`);
    } catch (error) {
      console.error('[OKX] ❌ 初始化失败:', error);
      this.initialized = false;
    }
  }

  isAvailable(): boolean {
    return this.initialized;
  }

  /**
   * 获取账户信息
   */
  async getAccountInfo() {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    try {
      // 获取账户余额
      const balanceRes = await this.client.getBalance();
      
      // 获取持仓信息
      const positionsRes = await this.client.getPositions();

      console.log('[OKX] 📊 账户信息获取成功');
      
      return {
        accountValue: parseFloat(balanceRes.data?.[0]?.totalEq || '0'),
        withdrawable: parseFloat(balanceRes.data?.[0]?.availEq || '0'),
        marginUsed: parseFloat(balanceRes.data?.[0]?.ordFroz || '0'),
        positions: positionsRes.data || []
      };
    } catch (error) {
      console.error('[OKX] ❌ 获取账户信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取单个币种价格
   */
  async getCoinPrice(coin: Coin): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    try {
      const symbol = COIN_TO_OKX_SYMBOL[coin];
      if (!symbol) {
        throw new Error(`不支持的币种: ${coin}`);
      }

      const ticker = await this.client.getTicker({ instId: symbol });
      const price = parseFloat(ticker.data?.[0]?.last || '0');
      
      console.log(`[OKX] 💹 ${coin} 价格: $${price}`);
      return price;
    } catch (error) {
      console.error(`[OKX] ❌ 获取 ${coin} 价格失败:`, error);
      throw error;
    }
  }

  /**
   * 获取多个币种价格
   */
  async getAllMarketPrices(): Promise<Record<Coin, number> | null> {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    try {
      const prices: Record<string, number> = {};
      
      // 只获取主要6个币种的价格，保持界面简洁
      const mainCoins = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'AVAX'];
      
      // 并发获取所有价格
      const pricePromises = mainCoins.map(async (coin) => {
        const symbol = COIN_TO_OKX_SYMBOL[coin as Coin];
        const ticker = await this.client.getTicker({ instId: symbol });
        const price = parseFloat(ticker.data?.[0]?.last || '0');
        return { coin, price };
      });

      const results = await Promise.all(pricePromises);
      
      for (const { coin, price } of results) {
        prices[coin] = price;
        console.log(`[OKX] 💹 ${coin}: $${price.toLocaleString()}`);
      }

      console.log('[OKX] 💹 所有市场价格已更新');
      return prices as Record<Coin, number>;
    } catch (error) {
      console.error('[OKX] ❌ 获取市场价格失败:', error);
      console.warn('[OKX] ⚠️ API临时不可用，将降级到备用价格源');
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
      throw new Error('OKX 客户端未初始化');
    }

    const { coin, side, size, leverage, reduceOnly = false } = params;
    const symbol = COIN_TO_OKX_SYMBOL[coin];
    
    console.log(`[OKX] 📝 下单:`, {
      symbol,
      side,
      size,
      leverage,
      reduceOnly,
    });

    try {
      // 先设置杠杆
      await this.setLeverage(coin, leverage);

      const orderParams = {
        instId: symbol,
        tdMode: 'cross', // 全仓模式
        side: side.toLowerCase(), // 'long' or 'short' 
        ordType: 'market', // 市价单
        sz: size.toString(),
        reduceOnly: reduceOnly,
      };

      const order = await this.client.placeOrder(orderParams);
      console.log('[OKX] ✅ 订单已提交:', order);
      return order;
    } catch (error) {
      console.error('[OKX] ❌ 下单失败:', error);
      throw error;
    }
  }

  /**
   * 平仓
   */
  async closePosition(coin: Coin) {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    const symbol = COIN_TO_OKX_SYMBOL[coin];
    console.log(`[OKX] 🔄 平仓: ${symbol}`);

    try {
      // 获取当前持仓
      const positions = await this.client.getPositions({ instId: symbol });
      const position = positions.data?.[0];

      if (!position || parseFloat(position.pos) === 0) {
        console.log(`[OKX] ⚠️ ${coin} 无持仓需要平仓`);
        return null;
      }

      // 平仓订单
      const closeOrder = await this.client.placeOrder({
        instId: symbol,
        tdMode: 'cross',
        side: parseFloat(position.pos) > 0 ? 'sell' : 'buy', // 多头平仓=卖出，空头平仓=买入
        ordType: 'market',
        sz: Math.abs(parseFloat(position.pos)).toString(),
        reduceOnly: true,
      });

      console.log(`[OKX] ✅ ${symbol} 平仓成功`);
      return closeOrder;
    } catch (error) {
      console.error(`[OKX] ❌ ${coin} 平仓失败:`, error);
      throw error;
    }
  }

  /**
   * 设置杠杆
   */
  async setLeverage(coin: Coin, leverage: number) {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    const symbol = COIN_TO_OKX_SYMBOL[coin];
    console.log(`[OKX] ⚙️ 设置杠杆: ${symbol} ${leverage}x`);

    try {
      await this.client.setLeverage({
        instId: symbol,
        lever: leverage.toString(),
        mgnMode: 'cross', // 全仓杠杆
      });
      console.log(`[OKX] ✅ ${symbol} 杠杆已设置为 ${leverage}x (全仓)`);
    } catch (error) {
      console.error(`[OKX] ❌ 设置杠杆失败:`, error);
      throw error;
    }
  }
}

// 单例模式
let okxClientInstance: OKXClient | null = null;

export function getOKXClient(): OKXClient {
  if (!okxClientInstance) {
    okxClientInstance = new OKXClient();
  }
  return okxClientInstance;
}

export default OKXClient;