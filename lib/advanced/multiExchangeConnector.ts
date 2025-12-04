/**
 * 多交易所价格聚合器
 * 使用 CCXT 统一 API 获取多交易所实时价格
 * 专为套利机会检测设计
 */

import ccxt from 'ccxt';
import { SafePrice, TradingMath } from './precisionMath';
import { SupportedCoin, USD, createUSD, createPercentage } from './strictTypes';
import { EventEmitter } from 'events';

// 交易所配置
interface ExchangeConfig {
  name: string;
  apiKey?: string;
  secret?: string;
  sandbox: boolean;
  rateLimit: number;
  timeout: number;
}

// 价格数据接口
export interface PriceData {
  exchange: string;
  symbol: string;
  price: USD;
  volume: USD;
  timestamp: number;
  bid?: USD;
  ask?: USD;
  spread?: USD;
}

// 套利机会接口
export interface CrossExchangeOpportunity {
  coin: SupportedCoin;
  buyExchange: string;
  sellExchange: string;
  buyPrice: USD;
  sellPrice: USD;
  spreadPercent: SafePrice;
  potentialProfit: USD;
  confidence: number;
  timestamp: number;
}

/**
 * 多交易所连接器
 */
export class MultiExchangeConnector extends EventEmitter {
  private exchanges = new Map<string, ccxt.Exchange>();
  private priceCache = new Map<string, PriceData>();
  private isRunning = false;
  private updateInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = new Map<string, number>();

  // 支持的交易所配置
  private readonly exchangeConfigs: ExchangeConfig[] = [
    {
      name: 'binance',
      sandbox: false,
      rateLimit: 1200,
      timeout: 10000
    },
    {
      name: 'okx',
      sandbox: false, 
      rateLimit: 2000,
      timeout: 10000
    },
    {
      name: 'bybit',
      sandbox: false,
      rateLimit: 1000,
      timeout: 10000
    },
    // Hyperliquid 通过现有 API 获取
  ];

  // 交易对映射 (CCXT symbol -> 我们的币种)
  private readonly symbolMap: Record<SupportedCoin, string> = {
    'BTC': 'BTC/USDT',
    'ETH': 'ETH/USDT', 
    'SOL': 'SOL/USDT',
    'BNB': 'BNB/USDT',
    'DOGE': 'DOGE/USDT',
    'XRP': 'XRP/USDT'
  };

  constructor() {
    super();
    this.initializeExchanges();
  }

  /**
   * 初始化交易所连接
   */
  private async initializeExchanges(): Promise<void> {
    console.log('🔗 [MultiExchange] 初始化交易所连接...');

    for (const config of this.exchangeConfigs) {
      try {
        // 动态创建交易所实例
        const ExchangeClass = (ccxt as any)[config.name];
        if (!ExchangeClass) {
          console.warn(`⚠️ [MultiExchange] 交易所 ${config.name} 不受支持`);
          continue;
        }

        const exchange = new ExchangeClass({
          apiKey: config.apiKey,
          secret: config.secret,
          timeout: config.timeout,
          rateLimit: config.rateLimit,
          sandbox: config.sandbox,
          enableRateLimit: true,
          // 只读模式 - 不执行交易
          options: {
            defaultType: 'spot'
          }
        });

        // 测试连接
        await this.testExchangeConnection(exchange, config.name);
        this.exchanges.set(config.name, exchange);
        this.reconnectAttempts.set(config.name, 0);
        
        console.log(`✅ [MultiExchange] ${config.name} 连接成功`);
        
      } catch (error) {
        console.error(`❌ [MultiExchange] ${config.name} 连接失败:`, error);
        this.reconnectAttempts.set(config.name, 0);
      }
    }

    console.log(`🚀 [MultiExchange] 已连接 ${this.exchanges.size} 个交易所`);
  }

  /**
   * 测试交易所连接
   */
  private async testExchangeConnection(exchange: ccxt.Exchange, name: string): Promise<void> {
    // 测试获取 BTC 价格
    const ticker = await exchange.fetchTicker('BTC/USDT');
    if (!ticker || !ticker.last) {
      throw new Error(`无法获取 ${name} 的价格数据`);
    }
  }

  /**
   * 启动价格监控
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log('🚀 [MultiExchange] 启动价格监控...');
    this.isRunning = true;

    // 立即获取一次价格
    await this.fetchAllPrices();

    // 定期更新价格 (每10秒)
    this.updateInterval = setInterval(async () => {
      await this.fetchAllPrices();
    }, 10000);

    console.log('✅ [MultiExchange] 价格监控已启动');
  }

  /**
   * 停止价格监控
   */
  stop(): void {
    if (!this.isRunning) return;

    console.log('⏹️ [MultiExchange] 停止价格监控...');
    this.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    console.log('✅ [MultiExchange] 价格监控已停止');
  }

  /**
   * 获取所有交易所价格
   */
  private async fetchAllPrices(): Promise<void> {
    const fetchPromises: Promise<void>[] = [];

    // 并行获取所有交易所价格
    for (const [exchangeName, exchange] of this.exchanges) {
      for (const coin of Object.keys(this.symbolMap) as SupportedCoin[]) {
        fetchPromises.push(this.fetchExchangePrice(exchange, exchangeName, coin));
      }
    }

    // 等待所有价格获取完成
    await Promise.allSettled(fetchPromises);

    // 检测套利机会
    this.detectArbitrageOpportunities();
  }

  /**
   * 获取单个交易所的价格
   */
  private async fetchExchangePrice(
    exchange: ccxt.Exchange,
    exchangeName: string,
    coin: SupportedCoin
  ): Promise<void> {
    try {
      const symbol = this.symbolMap[coin];
      if (!symbol) return;

      const ticker = await exchange.fetchTicker(symbol);
      
      if (ticker && ticker.last) {
        const priceData: PriceData = {
          exchange: exchangeName,
          symbol: coin,
          price: createUSD(ticker.last),
          volume: createUSD(ticker.baseVolume || 0),
          timestamp: Date.now(),
          bid: ticker.bid ? createUSD(ticker.bid) : undefined,
          ask: ticker.ask ? createUSD(ticker.ask) : undefined,
          spread: ticker.bid && ticker.ask ? createUSD(ticker.ask - ticker.bid) : undefined
        };

        const key = `${exchangeName}_${coin}`;
        this.priceCache.set(key, priceData);

        // 发出价格更新事件
        this.emit('priceUpdate', priceData);
      }

      // 重置重连计数
      this.reconnectAttempts.set(exchangeName, 0);

    } catch (error) {
      const attempts = this.reconnectAttempts.get(exchangeName) || 0;
      this.reconnectAttempts.set(exchangeName, attempts + 1);

      // 如果连续失败超过5次，暂时跳过这个交易所
      if (attempts < 5) {
        console.error(`❌ [MultiExchange] ${exchangeName} ${coin} 价格获取失败:`, error);
      }
    }
  }

  /**
   * 检测跨交易所套利机会
   */
  private detectArbitrageOpportunities(): void {
    const opportunities: CrossExchangeOpportunity[] = [];

    // 检查每个币种的跨交易所价差
    for (const coin of Object.keys(this.symbolMap) as SupportedCoin[]) {
      const coinPrices: PriceData[] = [];
      
      // 收集该币种在所有交易所的价格
      for (const [exchangeName] of this.exchanges) {
        const key = `${exchangeName}_${coin}`;
        const priceData = this.priceCache.get(key);
        if (priceData) {
          coinPrices.push(priceData);
        }
      }

      // 添加 Hyperliquid 价格 (如果可用)
      const hyperliquidPrice = this.getHyperliquidPrice(coin);
      if (hyperliquidPrice) {
        coinPrices.push(hyperliquidPrice);
      }

      // 找到最高价和最低价
      if (coinPrices.length >= 2) {
        coinPrices.sort((a, b) => (a.price as SafePrice).minus(b.price as SafePrice).toNumber());
        
        const lowestPrice = coinPrices[0];
        const highestPrice = coinPrices[coinPrices.length - 1];

        // 计算价差百分比
        const spreadPercent = TradingMath.calculateSpreadPercent(
          highestPrice.price as SafePrice,
          lowestPrice.price as SafePrice
        );

        // 如果价差超过阈值 (比如 0.5%)
        if (spreadPercent.gt(0.5)) {
          const opportunity: CrossExchangeOpportunity = {
            coin,
            buyExchange: lowestPrice.exchange,
            sellExchange: highestPrice.exchange,
            buyPrice: lowestPrice.price,
            sellPrice: highestPrice.price,
            spreadPercent,
            potentialProfit: TradingMath.calculateArbitrageProfit(
              lowestPrice.price as SafePrice,
              highestPrice.price as SafePrice,
              new SafePrice(1000) // 假设 $1000 本金
            ) as USD,
            confidence: this.calculateOpportunityConfidence(lowestPrice, highestPrice),
            timestamp: Date.now()
          };

          opportunities.push(opportunity);
        }
      }
    }

    // 发出套利机会事件
    if (opportunities.length > 0) {
      this.emit('arbitrageOpportunities', opportunities);
      
      // 日志记录最佳机会
      const bestOpp = opportunities.sort((a, b) => b.spreadPercent.minus(a.spreadPercent).toNumber())[0];
      console.log(`💰 [MultiExchange] 发现套利机会: ${bestOpp.coin} ${bestOpp.spreadPercent.toFixed(2)}% (${bestOpp.buyExchange} → ${bestOpp.sellExchange})`);
    }
  }

  /**
   * 获取 Hyperliquid 价格 (从现有系统)
   */
  private getHyperliquidPrice(coin: SupportedCoin): PriceData | null {
    try {
      // 这里可以集成现有的 Hyperliquid 价格获取逻辑
      // 暂时返回 null，等待集成
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 计算套利机会的置信度
   */
  private calculateOpportunityConfidence(lowPriceData: PriceData, highPriceData: PriceData): number {
    let confidence = 0.5; // 基础置信度

    // 考虑交易量
    const lowVolume = lowPriceData.volume as SafePrice;
    const highVolume = highPriceData.volume as SafePrice;
    if (lowVolume.gt(100000) && highVolume.gt(100000)) {
      confidence += 0.2; // 高交易量增加置信度
    }

    // 考虑价格更新时间
    const timeDiff = Math.abs(lowPriceData.timestamp - highPriceData.timestamp);
    if (timeDiff < 30000) { // 30秒内的价格更新
      confidence += 0.2;
    }

    // 考虑点差
    if (lowPriceData.spread && highPriceData.spread) {
      const avgSpread = (lowPriceData.spread as SafePrice).plus(highPriceData.spread as SafePrice).div(2);
      if (avgSpread.lt(new SafePrice(5))) { // 点差小于$5
        confidence += 0.1;
      }
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 获取所有当前价格
   */
  getAllPrices(): Map<string, PriceData> {
    return new Map(this.priceCache);
  }

  /**
   * 获取特定币种的所有交易所价格
   */
  getCoinPrices(coin: SupportedCoin): PriceData[] {
    const prices: PriceData[] = [];
    for (const [key, priceData] of this.priceCache) {
      if (key.endsWith(`_${coin}`)) {
        prices.push(priceData);
      }
    }
    return prices;
  }

  /**
   * 获取连接状态
   */
  getStatus(): {
    isRunning: boolean;
    connectedExchanges: string[];
    totalPricePoints: number;
    lastUpdateTime: number;
  } {
    return {
      isRunning: this.isRunning,
      connectedExchanges: Array.from(this.exchanges.keys()),
      totalPricePoints: this.priceCache.size,
      lastUpdateTime: Math.max(...Array.from(this.priceCache.values()).map(p => p.timestamp))
    };
  }
}

// 导出单例
export const multiExchangeConnector = new MultiExchangeConnector();