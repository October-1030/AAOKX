/**
 * 高级套利检测系统
 * 基于Paradigm Research的DeFi数学原理
 * 集成 Decimal.js 精确数学计算
 */

import { SupportedCoin, USD, Percentage, createUSD, createPercentage, Result, Ok, Err, MathHelpers } from './strictTypes';
import { SafePrice, TradingMath } from './precisionMath';

// 交易所接口定义
export interface Exchange {
  readonly name: string;
  readonly feePercent: Percentage;
  readonly minOrderSize: USD;
  readonly maxSlippage: Percentage;
  readonly latencyMs: number;
}

// 套利机会定义
export interface ArbitrageOpportunity {
  readonly id: string;
  readonly coin: SupportedCoin;
  readonly buyExchange: Exchange;
  readonly sellExchange: Exchange;
  readonly buyPrice: USD;
  readonly sellPrice: USD;
  readonly grossProfitPercent: Percentage;
  readonly netProfitPercent: Percentage;
  readonly estimatedNetProfit: USD;
  readonly requiredCapital: USD;
  readonly riskScore: Percentage;
  readonly detectedAt: number;
  readonly expiresAt: number;
}

// 订单簿数据
export interface OrderBookData {
  readonly exchange: string;
  readonly coin: SupportedCoin;
  readonly bids: readonly { price: USD; size: USD }[];
  readonly asks: readonly { price: USD; size: USD }[];
  readonly timestamp: number;
}

// 套利执行计划
export interface ArbitrageExecutionPlan {
  readonly opportunity: ArbitrageOpportunity;
  readonly buyOrderSize: USD;
  readonly sellOrderSize: USD;
  readonly estimatedExecutionTime: number;
  readonly maxAcceptableSlippage: Percentage;
  readonly stopLoss: USD;
  readonly timeoutMs: number;
}

/**
 * 高级套利检测器
 */
export class ArbitrageDetector {
  private orderBooks = new Map<string, OrderBookData>();
  private exchanges: Exchange[] = [];
  private minProfitThreshold: Percentage;
  private maxRiskScore: Percentage;

  constructor(config: {
    minProfitThreshold?: Percentage;
    maxRiskScore?: Percentage;
  } = {}) {
    this.minProfitThreshold = config.minProfitThreshold || createPercentage(0.5); // 0.5%最小利润
    this.maxRiskScore = config.maxRiskScore || createPercentage(30); // 30%最大风险评分

    // 初始化支持的交易所
    this.initializeExchanges();
  }

  private initializeExchanges(): void {
    this.exchanges = [
      {
        name: 'hyperliquid',
        feePercent: createPercentage(0.02), // 0.02% 手续费
        minOrderSize: createUSD(10),
        maxSlippage: createPercentage(0.1),
        latencyMs: 100
      },
      {
        name: 'binance',
        feePercent: createPercentage(0.1),
        minOrderSize: createUSD(5),
        maxSlippage: createPercentage(0.05),
        latencyMs: 200
      },
      {
        name: 'coinbase',
        feePercent: createPercentage(0.5),
        minOrderSize: createUSD(1),
        maxSlippage: createPercentage(0.15),
        latencyMs: 300
      }
      // 注意：实际使用时需要真实的交易所数据
    ];
  }

  /**
   * 更新订单簿数据
   */
  updateOrderBook(data: OrderBookData): void {
    const key = `${data.exchange}_${data.coin}`;
    this.orderBooks.set(key, data);
    
    // 清理过期数据（超过30秒）
    this.cleanupOldData();
  }

  private cleanupOldData(): void {
    const now = Date.now();
    const maxAge = 30000; // 30秒
    
    for (const [key, data] of this.orderBooks) {
      if (now - data.timestamp > maxAge) {
        this.orderBooks.delete(key);
      }
    }
  }

  /**
   * 检测套利机会
   */
  detectArbitrageOpportunities(): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    const coins: SupportedCoin[] = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP'];
    
    for (const coin of coins) {
      const coinOpportunities = this.detectCoinArbitrage(coin);
      opportunities.push(...coinOpportunities);
    }

    // 按净利润排序
    return opportunities.sort((a, b) => Number(b.netProfitPercent) - Number(a.netProfitPercent));
  }

  private detectCoinArbitrage(coin: SupportedCoin): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    const orderBooks: OrderBookData[] = [];

    // 收集该币种的所有订单簿数据
    for (const [key, data] of this.orderBooks) {
      if (data.coin === coin) {
        orderBooks.push(data);
      }
    }

    if (orderBooks.length < 2) return opportunities;

    // 两两比较所有交易所
    for (let i = 0; i < orderBooks.length; i++) {
      for (let j = i + 1; j < orderBooks.length; j++) {
        const opp1 = this.calculateArbitrage(orderBooks[i], orderBooks[j]);
        const opp2 = this.calculateArbitrage(orderBooks[j], orderBooks[i]);
        
        if (opp1) opportunities.push(opp1);
        if (opp2) opportunities.push(opp2);
      }
    }

    return opportunities;
  }

  private calculateArbitrage(
    buyOrderBook: OrderBookData, 
    sellOrderBook: OrderBookData
  ): ArbitrageOpportunity | null {
    if (!buyOrderBook.asks.length || !sellOrderBook.bids.length) return null;

    const buyPrice = buyOrderBook.asks[0].price; // 最低卖价
    const sellPrice = sellOrderBook.bids[0].price; // 最高买价

    if (sellPrice <= buyPrice) return null; // 无套利空间

    const buyExchange = this.exchanges.find(e => e.name === buyOrderBook.exchange);
    const sellExchange = this.exchanges.find(e => e.name === sellOrderBook.exchange);
    
    if (!buyExchange || !sellExchange) return null;

    // 使用精确数学计算毛利润
    const grossProfitPercent = createPercentage(
      TradingMath.calculateSpreadPercent(sellPrice as SafePrice, buyPrice as SafePrice).toNumber()
    );

    // 精确计算净利润（扣除手续费和滑点）
    const totalFees = (buyExchange.feePercent as SafePrice).plus(sellExchange.feePercent as SafePrice);
    const totalSlippage = (buyExchange.maxSlippage as SafePrice).plus(sellExchange.maxSlippage as SafePrice);
    const netProfitPercent = createPercentage(
      (grossProfitPercent as SafePrice).minus(totalFees).minus(totalSlippage).toNumber()
    );

    // 检查是否达到最小利润阈值
    if ((netProfitPercent as SafePrice).lt(this.minProfitThreshold as SafePrice)) return null;

    // 精确计算所需资本（基于可用流动性）
    const maxBuySize = buyOrderBook.asks[0].size as SafePrice;
    const maxSellSize = sellOrderBook.bids[0].size as SafePrice;
    const maxCapital = new SafePrice(1000); // 最大$1000
    const requiredCapital = createUSD(
      SafePrice.prototype.constructor.apply(new SafePrice(0), [Math.min(
        maxBuySize.toNumber(),
        maxSellSize.toNumber(),
        maxCapital.toNumber()
      )]).toNumber()
    );

    // 精确计算估计净利润
    const estimatedNetProfit = createUSD(
      TradingMath.calculateArbitrageProfit(
        buyPrice as SafePrice,
        sellPrice as SafePrice,
        requiredCapital as SafePrice,
        buyExchange.feePercent as SafePrice,
        sellExchange.feePercent as SafePrice
      ).toNumber()
    );

    // 风险评分
    const riskScore = this.calculateRiskScore(buyExchange, sellExchange, netProfitPercent);

    if (Number(riskScore) > Number(this.maxRiskScore)) return null;

    return {
      id: `${buyOrderBook.coin}_${buyOrderBook.exchange}_${sellOrderBook.exchange}_${Date.now()}`,
      coin: buyOrderBook.coin,
      buyExchange,
      sellExchange,
      buyPrice,
      sellPrice,
      grossProfitPercent,
      netProfitPercent,
      estimatedNetProfit,
      requiredCapital,
      riskScore,
      detectedAt: Date.now(),
      expiresAt: Date.now() + 60000 // 1分钟后过期
    };
  }

  private calculateRiskScore(
    buyExchange: Exchange, 
    sellExchange: Exchange, 
    profitPercent: Percentage
  ): Percentage {
    const riskCalculator = new SafePrice(0);

    // 精确的延迟风险计算
    const totalLatency = new SafePrice(buyExchange.latencyMs + sellExchange.latencyMs);
    const latencyRisk = SafePrice.prototype.constructor.apply(
      new SafePrice(0), 
      [Math.min(totalLatency.div(10).toNumber(), 20)]
    );

    // 精确的滑点风险计算
    const totalSlippage = (buyExchange.maxSlippage as SafePrice).plus(sellExchange.maxSlippage as SafePrice);
    const slippageRisk = totalSlippage.times(50);

    // 流动性风险（利润越小风险越高）
    let liquidityRisk = new SafePrice(0);
    const profitValue = profitPercent as SafePrice;
    if (profitValue.lt(1)) {
      liquidityRisk = new SafePrice(1).minus(profitValue).times(30);
    }

    // 交易所信誉风险
    const reputationRisk = new SafePrice(this.getExchangeReputationRisk(buyExchange, sellExchange));

    // 总风险评分
    const totalRisk = latencyRisk.plus(slippageRisk).plus(liquidityRisk).plus(reputationRisk);
    const cappedRisk = totalRisk.gt(100) ? new SafePrice(100) : totalRisk;

    return createPercentage(cappedRisk.toNumber());
  }

  private getExchangeReputationRisk(buyExchange: Exchange, sellExchange: Exchange): number {
    // 基于交易所名称的简单风险评估
    const riskMap: Record<string, number> = {
      'hyperliquid': 5,
      'binance': 3,
      'coinbase': 3,
      'unknown': 20
    };

    return (riskMap[buyExchange.name] || 20) + (riskMap[sellExchange.name] || 20);
  }

  /**
   * 生成套利执行计划
   */
  createExecutionPlan(opportunity: ArbitrageOpportunity, capitalAmount: USD): Result<ArbitrageExecutionPlan> {
    if (Number(capitalAmount) < Number(opportunity.requiredCapital)) {
      return Err(new Error(`Insufficient capital. Required: $${opportunity.requiredCapital}, Available: $${capitalAmount}`));
    }

    // 计算最优订单大小
    const buyOrderSize = createUSD(Math.min(Number(capitalAmount) * 0.95, Number(opportunity.requiredCapital)));
    const sellOrderSize = buyOrderSize; // 1:1 对冲

    // 估算执行时间
    const estimatedExecutionTime = opportunity.buyExchange.latencyMs + opportunity.sellExchange.latencyMs + 1000;

    // 设置止损价（如果价格变化超过预期利润的50%）
    const stopLoss = createUSD(
      Number(opportunity.buyPrice) * (1 + Number(opportunity.netProfitPercent) * 0.005)
    );

    const plan: ArbitrageExecutionPlan = {
      opportunity,
      buyOrderSize,
      sellOrderSize,
      estimatedExecutionTime,
      maxAcceptableSlippage: createPercentage(Number(opportunity.netProfitPercent) * 0.3), // 30%的利润可用于滑点
      stopLoss,
      timeoutMs: 30000 // 30秒超时
    };

    return Ok(plan);
  }

  /**
   * 验证套利机会是否仍然有效
   */
  validateOpportunity(opportunity: ArbitrageOpportunity): boolean {
    // 检查是否过期
    if (Date.now() > opportunity.expiresAt) return false;

    // 检查订单簿数据是否仍然可用
    const buyKey = `${opportunity.buyExchange.name}_${opportunity.coin}`;
    const sellKey = `${opportunity.sellExchange.name}_${opportunity.coin}`;
    
    const buyOrderBook = this.orderBooks.get(buyKey);
    const sellOrderBook = this.orderBooks.get(sellKey);
    
    if (!buyOrderBook || !sellOrderBook) return false;

    // 精确重新计算套利是否仍然盈利
    const currentBuyPrice = buyOrderBook.asks[0]?.price as SafePrice;
    const currentSellPrice = sellOrderBook.bids[0]?.price as SafePrice;
    
    if (!currentBuyPrice || !currentSellPrice) return false;

    const currentGrossProfit = TradingMath.calculateSpreadPercent(currentSellPrice, currentBuyPrice);
    return currentGrossProfit.gte(this.minProfitThreshold as SafePrice);
  }

  /**
   * 获取统计信息
   */
  getStatistics(): {
    totalOpportunities: number;
    averageProfit: Percentage;
    averageRisk: Percentage;
    activeOrderBooks: number;
    supportedExchanges: number;
  } {
    const opportunities = this.detectArbitrageOpportunities();
    
    const averageProfit = opportunities.length > 0 
      ? createPercentage(opportunities.reduce((sum, opp) => sum + Number(opp.netProfitPercent), 0) / opportunities.length)
      : createPercentage(0);
      
    const averageRisk = opportunities.length > 0
      ? createPercentage(opportunities.reduce((sum, opp) => sum + Number(opp.riskScore), 0) / opportunities.length)
      : createPercentage(0);

    return {
      totalOpportunities: opportunities.length,
      averageProfit,
      averageRisk,
      activeOrderBooks: this.orderBooks.size,
      supportedExchanges: this.exchanges.length
    };
  }
}

// 导出单例
export const arbitrageDetector = new ArbitrageDetector();