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
const COIN_TO_OKX_SYMBOL: Partial<Record<Coin, string>> = {
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
  private config: OKXConfig;
  private initialized = false;
  private baseURL: string;

  constructor() {
    this.config = OKX_CONFIG;
    this.baseURL = OKX_CONFIG.sandbox ? 'https://www.okx.com' : 'https://www.okx.com';
    this.initialize();
  }

  private async initialize() {
    try {
      console.log('[OKX] 🔄 正在初始化客户端...');
      console.log(`[OKX] 📊 配置: sandbox=${this.config.sandbox}, apiKey=${this.config.apiKey.substring(0, 8)}...`);

      this.initialized = true;
      console.log('[OKX] 🚀 客户端初始化成功');
      console.log(`[OKX] 📊 交易环境: ${this.config.sandbox ? '🧪 模拟环境' : '🔴 实盘环境'}`);
      console.log(`[OKX] 🔑 API Key: ${this.config.apiKey.substring(0, 8)}...`);
    } catch (error) {
      console.error('[OKX] ❌ 初始化失败:', error);
      this.initialized = false;
    }
  }

  isAvailable(): boolean {
    return this.initialized;
  }

  /**
   * 生成OKX API签名
   */
  private generateSignature(timestamp: string, method: string, requestPath: string, body: string = ''): string {
    const message = timestamp + method + requestPath + body;
    const signature = crypto.createHmac('sha256', this.config.secretKey)
      .update(message)
      .digest('base64');
    return signature;
  }

  /**
   * 执行OKX API请求
   */
  private async request(method: string, endpoint: string, params?: any): Promise<any> {
    const timestamp = new Date().toISOString();

    let requestPath = endpoint;
    let body = '';

    if (method === 'GET' && params) {
      const queryString = Object.keys(params)
        .filter(key => params[key] !== undefined && params[key] !== null)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');
      if (queryString) {
        requestPath += '?' + queryString;
      }
    } else if (method !== 'GET' && params) {
      body = JSON.stringify(params);
    }

    const signature = this.generateSignature(timestamp, method, requestPath, body);

    const headers: Record<string, string> = {
      'OK-ACCESS-KEY': this.config.apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': this.config.passphrase,
      'Content-Type': 'application/json',
    };

    if (this.config.sandbox) {
      headers['x-simulated-trading'] = '1';
    }

    const url = this.baseURL + requestPath;

    console.log('[OKX] 📡 Request:', {
      method,
      url,
      timestamp,
      hasSignature: !!signature,
    });

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' && body ? body : undefined,
      });

      const data = await response.json();

      console.log('[OKX] 📥 Response:', {
        status: response.status,
        code: data.code,
        msg: data.msg,
        hasData: !!data.data,
      });

      if (data.code !== '0') {
        console.error('[OKX] ❌ API错误详情:', data);
        throw new Error(`OKX API Error [${data.code}]: ${data.msg || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      console.error('[OKX] ❌ Request failed:', error);
      throw error;
    }
  }

  /**
   * 获取账户信息（交易账户）
   */
  async getAccountInfo() {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    try {
      // 获取交易账户余额
      const balanceRes = await this.request('GET', '/api/v5/account/balance');

      console.log('[OKX] 📊 交易账户信息获取成功:', balanceRes.data?.[0]);

      return balanceRes.data?.[0] || {};
    } catch (error) {
      console.error('[OKX] ❌ 获取交易账户信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取资金账户余额
   */
  async getFundingBalance() {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    try {
      // 获取资金账户余额
      const balanceRes = await this.request('GET', '/api/v5/asset/balances');

      console.log('[OKX] 💰 资金账户余额获取成功');
      console.log('[OKX] 💰 资金账户详情:', balanceRes.data);

      return balanceRes.data || [];
    } catch (error) {
      console.error('[OKX] ❌ 获取资金账户余额失败:', error);
      throw error;
    }
  }

  /**
   * 获取合约持仓信息
   */
  async getPositions() {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    try {
      const positionsRes = await this.request('GET', '/api/v5/account/positions');
      console.log('[OKX] 📊 合约持仓信息获取成功');
      return positionsRes.data || [];
    } catch (error) {
      console.error('[OKX] ❌ 获取合约持仓信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取现货持仓（从交易账户余额中提取）
   * 返回格式兼容系统 Position 类型
   */
  async getSpotPositions() {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    try {
      const accountInfo = await this.getAccountInfo();
      const details = accountInfo.details || [];

      // 提取有余额的现货币种
      const spotPositions = details
        .filter((detail: any) => {
          const balance = parseFloat(detail.eq || '0');
          const coin = detail.ccy;
          // 只包含支持的交易币种，且余额 > 0.001
          return balance > 0.001 && ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'AVAX', 'XRP'].includes(coin);
        })
        .map((detail: any) => {
          const coin = detail.ccy;
          const size = parseFloat(detail.eq || '0');
          const avgPrice = parseFloat(detail.accAvgPx || '0');
          const currentPrice = 0; // 需要调用 getMarketPrice 获取
          const unrealizedPnL = parseFloat(detail.spotUpl || '0');

          return {
            coin,
            side: 'LONG' as const, // 现货只能是多头
            size,
            entryPrice: avgPrice || 0,
            currentPrice: 0, // 稍后更新
            unrealizedPnL,
            leverage: 1, // 现货无杠杆
            notional: 0, // 稍后更新
            liquidationPrice: 0, // 现货无爆仓价
            isSpot: true, // ✅ 标记为现货持仓
            exitPlan: {
              invalidation: 'No exit plan set for spot position',
              stopLoss: 0,
              takeProfit: 0,
            },
            timestamp: Date.now(),
          };
        });

      console.log(`[OKX] 💼 发现 ${spotPositions.length} 个现货持仓`);
      return spotPositions;
    } catch (error) {
      console.error('[OKX] ❌ 获取现货持仓失败:', error);
      return [];
    }
  }

  /**
   * 获取单个币种的市场价格
   */
  async getMarketPrice(coin: Coin): Promise<number> {
    const prices = await this.getAllMarketPrices();
    return prices?.[coin] || 0;
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

      const ticker = await this.request('GET', '/api/v5/market/ticker', { instId: symbol });
      const price = parseFloat(ticker.data?.[0]?.last || '0');

      console.log(`[OKX] 💹 ${coin} 价格: $${price}`);
      return price;
    } catch (error) {
      console.error(`[OKX] ❌ 获取 ${coin} 价格失败:`, error);
      throw error;
    }
  }

  /**
   * 获取 K 线数据
   * @param instId 交易对，如 'DOGE-USDT-SWAP'
   * @param bar K 线周期，如 '1m', '5m', '15m', '1H', '4H', '1D'
   * @param limit 数量，最大 300
   * @returns K 线数组 [[ts, open, high, low, close, vol, volCcy], ...]
   */
  async getCandles(instId: string, bar: string = '1m', limit: number = 30): Promise<any[]> {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    try {
      const response = await this.request('GET', '/api/v5/market/candles', {
        instId,
        bar,
        limit: String(limit),
      });

      if (response.code !== '0' || !response.data) {
        throw new Error(`获取 K 线失败: ${response.msg || '未知错误'}`);
      }

      console.log(`[OKX] 📊 获取 ${instId} ${bar} K 线: ${response.data.length} 根`);
      return response.data;
    } catch (error) {
      console.error(`[OKX] ❌ 获取 K 线失败:`, error);
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
        const ticker = await this.request('GET', '/api/v5/market/ticker', { instId: symbol });
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
   * 获取交易对规格信息（合约面值、最小下单单位等）
   */
  async getInstrumentInfo(coin: Coin): Promise<{
    ctVal: number; // 合约面值
    lotSz: number; // 最小下单单位
    minSz: number; // 最小下单数量
  }> {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    const symbol = COIN_TO_OKX_SYMBOL[coin];

    try {
      const result = await this.request('GET', '/api/v5/public/instruments', {
        instType: 'SWAP',
        instId: symbol,
      });

      const instrument = result.data?.[0];
      if (!instrument) {
        throw new Error(`未找到交易对信息: ${symbol}`);
      }

      const ctVal = parseFloat(instrument.ctVal || '1');
      const lotSz = parseFloat(instrument.lotSz || '1');
      const minSz = parseFloat(instrument.minSz || '1');

      console.log(`[OKX] 📊 ${symbol} 规格:`, {
        ctVal,
        lotSz,
        minSz,
      });

      return { ctVal, lotSz, minSz };
    } catch (error) {
      console.error(`[OKX] ❌ 获取交易对规格失败:`, error);
      throw error;
    }
  }

  /**
   * 下市价单
   */
  async placeMarketOrder(params: {
    coin: Coin;
    side: 'LONG' | 'SHORT';
    size: number; // USD 金额
    leverage: number;
    reduceOnly?: boolean;
  }) {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    const { coin, side, size, leverage, reduceOnly = false } = params;
    const symbol = COIN_TO_OKX_SYMBOL[coin];

    console.log(`[OKX] 📝 准备下单:`, {
      symbol,
      side,
      sizeUSD: size,
      leverage,
      reduceOnly,
    });

    try {
      // 1. 获取当前价格
      const currentPrice = await this.getCoinPrice(coin);
      console.log(`[OKX] 💹 ${coin} 当前价格: $${currentPrice}`);

      // 2. 获取交易对规格信息
      const { ctVal, lotSz, minSz } = await this.getInstrumentInfo(coin);
      console.log(`[OKX] 📊 合约规格: ctVal=${ctVal}, lotSz=${lotSz}, minSz=${minSz}`);

      // 3. 计算币的数量
      const coinAmount = size / currentPrice;
      console.log(`[OKX] 💰 需要币数量: ${coinAmount} ${coin}`);

      // 4. 计算合约张数
      const contractCount = coinAmount / ctVal;
      console.log(`[OKX] 📄 计算合约张数: ${contractCount} 张（未取整）`);

      // 5. 按 lotSz 向下取整
      const roundedContracts = Math.floor(contractCount / lotSz) * lotSz;
      console.log(`[OKX] 📄 取整后合约张数: ${roundedContracts} 张（lotSz=${lotSz}）`);

      // 6. 检查是否满足最小下单量
      if (roundedContracts < minSz) {
        throw new Error(
          `订单量太小：需要至少 ${minSz} 张合约（约 $${(minSz * ctVal * currentPrice).toFixed(2)}），当前只有 ${roundedContracts} 张`
        );
      }

      // 🔧 v1.4 安全检查：最大合约张数限制（防止意外大单）
      const MAX_CONTRACTS = 50; // DOGE: 50张 = 500 DOGE ≈ $65
      if (roundedContracts > MAX_CONTRACTS) {
        console.error(`[OKX] 🚨 安全警告：计算出的合约数 ${roundedContracts} 超过上限 ${MAX_CONTRACTS}！`);
        console.error(`[OKX]    请求金额: $${size}, 价格: $${currentPrice}, 币数: ${coinAmount}`);
        console.error(`[OKX]    这可能是计算 bug，拒绝下单！`);
        throw new Error(`安全限制：合约数 ${roundedContracts} 超过上限 ${MAX_CONTRACTS}（约 $${(MAX_CONTRACTS * ctVal * currentPrice).toFixed(2)}）`);
      }

      // 🔧 v1.4 安全检查：名义价值验证
      const notionalValue = roundedContracts * ctVal * currentPrice;
      const MAX_NOTIONAL_USD = 100; // 最大 $100
      if (notionalValue > MAX_NOTIONAL_USD) {
        console.error(`[OKX] 🚨 安全警告：名义价值 $${notionalValue.toFixed(2)} 超过上限 $${MAX_NOTIONAL_USD}！`);
        throw new Error(`安全限制：名义价值 $${notionalValue.toFixed(2)} 超过上限 $${MAX_NOTIONAL_USD}`);
      }

      console.log(`[OKX] ✅ 安全检查通过: ${roundedContracts} 张, 名义价值 $${notionalValue.toFixed(2)}`);

      // 🔧 v1.4: 预下单验证（显示将要下的单）
      console.log(`[OKX] 📝 预下单确认:`);
      console.log(`    合约: ${symbol}`);
      console.log(`    方向: ${side}`);
      console.log(`    张数: ${roundedContracts}`);
      console.log(`    币数: ${roundedContracts * ctVal} DOGE`);
      console.log(`    名义价值: $${notionalValue.toFixed(2)}`);
      console.log(`    预估保证金: $${(notionalValue / leverage).toFixed(2)} (${leverage}x 杠杆)`);
      console.log(`    ---`);
      console.log(`    输入金额: $${size}`);
      console.log(`    当前价格: $${currentPrice}`);
      console.log(`    合约面值: ${ctVal} DOGE/张`);

      // 7. 先设置杠杆
      await this.setLeverage(coin, leverage);

      // 8. 提交订单 - 尝试不同的交易模式
      console.log(`[OKX] 🔄 尝试提交订单...`);

      // 尝试顺序：isolated（逐仓）> cross（全仓）> cash（现货模式）
      const tradingModes = ['isolated', 'cross', 'cash'] as const;
      let order = null;
      let lastError = null;

      for (const tdMode of tradingModes) {
        try {
          const orderParams = {
            instId: symbol,
            tdMode: tdMode,
            side: side === 'LONG' ? 'buy' : 'sell',
            ordType: 'market',
            sz: roundedContracts.toString(),
            reduceOnly: reduceOnly,
          };

          console.log(`[OKX] 📝 尝试 ${tdMode} 模式:`, orderParams);

          order = await this.request('POST', '/api/v5/trade/order', orderParams);
          console.log(`[OKX] ✅ 订单已提交 (${tdMode} 模式):`, order);
          break; // 成功则退出循环
        } catch (error: any) {
          const errorCode = error?.data?.[0]?.sCode || error?.code;
          console.log(`[OKX] ⚠️ ${tdMode} 模式失败 (错误码: ${errorCode}), 尝试下一个模式...`);
          lastError = error;

          // 如果不是账户模式错误，直接抛出
          if (errorCode !== '51010') {
            throw error;
          }
        }
      }

      // 如果所有模式都失败了
      if (!order) {
        console.error('[OKX] ❌ 所有交易模式都失败了:', lastError);
        throw lastError;
      }

      // 记录实际订单价值
      const actualValue = roundedContracts * ctVal * currentPrice;
      console.log(`[OKX] 💵 实际订单价值: $${actualValue.toFixed(2)} (请求 $${size.toFixed(2)})`);

      return order;
    } catch (error) {
      console.error('[OKX] ❌ 下单失败:', error);
      throw error;
    }
  }

  /**
   * 平仓（期货合约）
   */
  async closePosition(coin: Coin) {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    const symbol = COIN_TO_OKX_SYMBOL[coin];
    console.log(`[OKX] 🔄 平仓（期货）: ${symbol}`);

    try {
      // 获取当前持仓
      const positions = await this.request('GET', '/api/v5/account/positions', { instId: symbol });
      const position = positions.data?.[0];

      if (!position || parseFloat(position.pos) === 0) {
        console.log(`[OKX] ⚠️ ${coin} 无持仓需要平仓`);
        return null;
      }

      // 使用持仓的保证金模式（mgnMode）
      const tdMode = position.mgnMode || 'isolated'; // 默认使用逐仓
      console.log(`[OKX] 📊 持仓模式: ${tdMode}, 持仓量: ${position.pos}`);

      // 平仓订单
      const closeOrder = await this.request('POST', '/api/v5/trade/order', {
        instId: symbol,
        tdMode: tdMode,
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
   * 部分平仓（期货合约）
   * @param coin 币种
   * @param percentage 平仓百分比 (0-100)
   */
  async partialClosePosition(coin: Coin, percentage: number) {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    if (percentage <= 0 || percentage > 100) {
      throw new Error(`无效的平仓百分比: ${percentage}%`);
    }

    const symbol = COIN_TO_OKX_SYMBOL[coin];
    console.log(`[OKX] 🔄 部分平仓: ${symbol} ${percentage}%`);

    try {
      // 获取当前持仓
      const positions = await this.request('GET', '/api/v5/account/positions', { instId: symbol });
      const position = positions.data?.[0];

      if (!position || parseFloat(position.pos) === 0) {
        console.log(`[OKX] ⚠️ ${coin} 无持仓需要平仓`);
        return null;
      }

      const currentPos = Math.abs(parseFloat(position.pos));
      const closeSize = Math.floor(currentPos * (percentage / 100)); // 向下取整

      if (closeSize < 1) {
        console.log(`[OKX] ⚠️ 平仓数量不足1张合约，跳过`);
        return null;
      }

      const tdMode = position.mgnMode || 'isolated';
      console.log(`[OKX] 📊 持仓: ${currentPos}张, 平仓: ${closeSize}张 (${percentage}%)`);

      // 部分平仓订单
      const closeOrder = await this.request('POST', '/api/v5/trade/order', {
        instId: symbol,
        tdMode: tdMode,
        side: parseFloat(position.pos) > 0 ? 'sell' : 'buy',
        ordType: 'market',
        sz: closeSize.toString(),
        reduceOnly: true,
      });

      console.log(`[OKX] ✅ ${symbol} 部分平仓成功 (${closeSize}张)`);
      return closeOrder;
    } catch (error) {
      console.error(`[OKX] ❌ ${coin} 部分平仓失败:`, error);
      throw error;
    }
  }

  /**
   * 平仓（现货）- 使用市价卖单
   */
  async closeSpotPosition(coin: Coin, size: number) {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    // 现货交易对格式：BTC-USDT（不是 SWAP）
    const spotSymbol = `${coin}-USDT`;
    console.log(`[OKX] 🔄 平仓（现货）: ${spotSymbol}`);
    console.log(`[OKX] 💼 卖出数量: ${size}`);

    try {
      // 下市价卖单
      const sellOrder = await this.request('POST', '/api/v5/trade/order', {
        instId: spotSymbol,
        tdMode: 'cash', // 现货交易模式
        side: 'sell', // 卖出
        ordType: 'market', // 市价单
        sz: size.toString(), // 卖出数量
      });

      console.log(`[OKX] ✅ ${spotSymbol} 现货卖出成功:`, sellOrder);
      return sellOrder;
    } catch (error) {
      console.error(`[OKX] ❌ ${coin} 现货卖出失败:`, error);
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

    // 尝试不同的保证金模式
    const marginModes = ['isolated', 'cross'] as const;
    let lastError = null;

    for (const mgnMode of marginModes) {
      try {
        await this.request('POST', '/api/v5/account/set-leverage', {
          instId: symbol,
          lever: leverage.toString(),
          mgnMode: mgnMode,
        });
        console.log(`[OKX] ✅ ${symbol} 杠杆已设置为 ${leverage}x (${mgnMode} 模式)`);
        return; // 成功则退出
      } catch (error: any) {
        const errorCode = error?.data?.[0]?.sCode || error?.code;
        console.log(`[OKX] ⚠️ ${mgnMode} 模式设置杠杆失败 (错误码: ${errorCode}), 尝试下一个...`);
        lastError = error;

        // 如果不是账户模式错误，直接抛出
        if (errorCode !== '51010' && errorCode !== '59110') {
          throw error;
        }
      }
    }

    // 如果所有模式都失败了
    console.error(`[OKX] ❌ 设置杠杆失败（所有模式都尝试过）:`, lastError);
    throw lastError;
  }

  /**
   * 资金划转（从资金账户转到交易账户）
   */
  async transferFunds(params: {
    currency: string;
    amount: string;
    from?: string;  // 默认'6'(资金账户)
    to?: string;    // 默认'18'(交易账户)
  }) {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    const { currency, amount, from = '6', to = '18' } = params;

    console.log(`[OKX] 💸 资金划转: ${amount} ${currency} (从账户${from}到账户${to})`);

    try {
      const result = await this.request('POST', '/api/v5/asset/transfer', {
        ccy: currency,
        amt: amount,
        from: from,  // 6 = 资金账户
        to: to,      // 18 = 交易账户
        type: '0',   // 0 = 账户内划转
      });

      console.log(`[OKX] ✅ 资金划转成功:`, result);
      return result;
    } catch (error) {
      console.error(`[OKX] ❌ 资金划转失败:`, error);
      throw error;
    }
  }

  /**
   * 批量划转所有资金到交易账户
   */
  async transferAllToTrading() {
    if (!this.isAvailable()) {
      throw new Error('OKX 客户端未初始化');
    }

    try {
      // 获取资金账户余额
      const balances = await this.getFundingBalance();

      console.log(`[OKX] 💰 开始批量划转，共 ${balances.length} 种资产`);

      const results = [];

      for (const asset of balances) {
        const balance = parseFloat(asset.availBal || '0');

        // 只划转有余额的币种（过滤掉小额资产）
        if (balance > 0.00001) {
          try {
            console.log(`[OKX] 💸 划转 ${asset.ccy}: ${balance}`);

            const result = await this.transferFunds({
              currency: asset.ccy,
              amount: asset.availBal,
            });

            results.push({
              currency: asset.ccy,
              amount: balance,
              success: true,
            });

            // 等待100ms避免频率限制
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`[OKX] ❌ ${asset.ccy} 划转失败:`, error);
            results.push({
              currency: asset.ccy,
              amount: balance,
              success: false,
              error: (error as Error).message,
            });
          }
        }
      }

      console.log(`[OKX] ✅ 批量划转完成，成功 ${results.filter(r => r.success).length}/${results.length}`);

      return results;
    } catch (error) {
      console.error(`[OKX] ❌ 批量划转失败:`, error);
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