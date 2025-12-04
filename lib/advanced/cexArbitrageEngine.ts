/**
 * CEX-CEX 套利引擎
 * 专门检测 Hyperliquid 与其他 CEX 之间的套利机会
 * 集成所有生产级功能：精确数学、性能监控、高性能日志
 */

import { EventEmitter } from 'events';
import { SafePrice, TradingMath } from './precisionMath';
import { SupportedCoin, USD, Percentage, createUSD, createPercentage, MathHelpers } from './strictTypes';
import { MultiExchangeConnector, PriceData } from './multiExchangeConnector';
import { performanceMonitor, PerformanceMetrics } from './performanceMonitor';
import { logger } from './logger';
import { getAllMarketData } from '../marketData';

// CEX 套利机会接口
export interface CEXArbitrageOpportunity {
  id: string;
  coin: SupportedCoin;
  
  // 价格信息
  hyperliquidPrice: USD;
  otherExchangePrice: USD;
  otherExchange: string;
  
  // 套利方向和利润
  direction: 'BUY_HL_SELL_OTHER' | 'BUY_OTHER_SELL_HL';
  grossSpreadPercent: Percentage;
  netProfitPercent: Percentage;
  estimatedProfit: USD;
  
  // 风险评估
  riskScore: Percentage;
  confidence: Percentage;
  
  // 执行相关
  recommendedSize: USD;
  maxSize: USD;
  timeToExecute: number;
  
  // 时间信息
  detectedAt: number;
  expiresAt: number;
  
  // 市场数据
  hyperliquidVolume?: USD;
  otherExchangeVolume?: USD;
  priceAge: number;
}

// 执行计划
export interface ArbitrageExecutionPlan {
  opportunity: CEXArbitrageOpportunity;
  
  // 执行参数
  executeSize: USD;
  hyperliquidOrder: {
    side: 'BUY' | 'SELL';
    size: USD;
    expectedPrice: USD;
    slippage: Percentage;
  };
  
  // 风险参数
  stopLoss: USD;
  maxSlippage: Percentage;
  timeoutMs: number;
  
  // 预期结果
  expectedNetProfit: USD;
  expectedROI: Percentage;
  breakEvenSpread: Percentage;
}

// 统计信息
export interface ArbitrageStats {
  totalOpportunities: number;
  avgSpreadPercent: number;
  avgRiskScore: number;
  avgConfidence: number;
  bestOpportunity: CEXArbitrageOpportunity | null;
  opportunitiesByExchange: Record<string, number>;
  opportunitiesByCoin: Record<SupportedCoin, number>;
  avgDetectionLatency: number;
}

/**
 * CEX 套利引擎
 */
export class CEXArbitrageEngine extends EventEmitter {
  private multiExchangeConnector: MultiExchangeConnector;
  private isRunning = false;
  private detectionInterval: NodeJS.Timeout | null = null;
  
  // 配置参数
  private readonly config = {
    minSpreadPercent: 0.3,           // 最小价差 0.3%
    maxRiskScore: 40,                // 最大风险评分 40%
    minConfidence: 60,               // 最小置信度 60%
    detectionIntervalMs: 5000,       // 检测间隔 5秒
    opportunityTTLMs: 30000,         // 机会有效期 30秒
    maxPositionSize: 1000,           // 最大仓位 $1000
    hyperliquidFee: 0.02,           // Hyperliquid 手续费 0.02%
    otherExchangeFee: 0.1,          // 其他交易所估算手续费 0.1%
  };
  
  // 状态跟踪
  private opportunities = new Map<string, CEXArbitrageOpportunity>();
  private stats: ArbitrageStats = this.initializeStats();
  private lastHyperliquidUpdate = 0;
  private priceCache = new Map<string, PriceData>();

  constructor() {
    super();
    
    this.multiExchangeConnector = new MultiExchangeConnector();
    this.setupEventHandlers();
    
    logger.info('🏗️ CEX 套利引擎初始化完成', {
      config: this.config
    });
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 监听多交易所价格更新
    this.multiExchangeConnector.on('priceUpdate', (priceData: PriceData) => {
      this.handlePriceUpdate(priceData);
    });

    // 监听性能告警
    performanceMonitor.on('alert', (alertData) => {
      logger.warn('性能告警', alertData);
      this.handlePerformanceAlert(alertData);
    });
  }

  /**
   * 启动套利引擎
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    logger.info('🚀 启动 CEX 套利引擎...');
    
    try {
      // 启动性能监控
      performanceMonitor.start();
      
      // 启动多交易所连接器
      await this.multiExchangeConnector.start();
      
      this.isRunning = true;
      
      // 定期检测套利机会
      this.detectionInterval = setInterval(() => {
        this.detectArbitrageOpportunities();
      }, this.config.detectionIntervalMs);
      
      // 立即执行一次检测
      setTimeout(() => this.detectArbitrageOpportunities(), 2000);
      
      logger.info('✅ CEX 套利引擎已启动', {
        detectionInterval: this.config.detectionIntervalMs,
        minSpread: this.config.minSpreadPercent
      });
      
    } catch (error) {
      logger.error('❌ CEX 套利引擎启动失败', error);
      throw error;
    }
  }

  /**
   * 停止套利引擎
   */
  stop(): void {
    if (!this.isRunning) return;

    logger.info('⏹️ 停止 CEX 套利引擎...');
    
    this.isRunning = false;
    
    // 停止定时检测
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    
    // 停止多交易所连接器
    this.multiExchangeConnector.stop();
    
    // 停止性能监控
    performanceMonitor.stop();
    
    logger.info('✅ CEX 套利引擎已停止');
  }

  /**
   * 处理价格更新
   */
  private handlePriceUpdate(priceData: PriceData): void {
    const key = `${priceData.exchange}_${priceData.symbol}`;
    this.priceCache.set(key, priceData);
    
    logger.marketData(`价格更新: ${priceData.exchange} ${priceData.symbol}`, {
      price: (priceData.price as SafePrice).toFixed(2),
      volume: priceData.volume ? (priceData.volume as SafePrice).toFixed(0) : 'N/A'
    });
  }

  /**
   * 处理性能告警
   */
  private handlePerformanceAlert(alertData: any): void {
    // 如果 Event Loop 延迟过高，暂时降低检测频率
    const metrics = alertData.metrics as PerformanceMetrics;
    if (metrics.eventLoopLag > 20) {
      logger.warn('Event Loop 延迟过高，调整检测频率');
      // 这里可以动态调整 detectionIntervalMs
    }
  }

  /**
   * 检测套利机会
   */
  private detectArbitrageOpportunities(): void {
    logger.time('套利检测周期', () => {
      try {
        // 获取 Hyperliquid 价格
        const hyperliquidPrices = this.getHyperliquidPrices();
        if (Object.keys(hyperliquidPrices).length === 0) {
          logger.debug('Hyperliquid 价格数据不可用');
          return;
        }

        // 获取其他交易所价格
        const otherExchangePrices = this.getOtherExchangePrices();
        
        // 清理过期机会
        this.cleanupExpiredOpportunities();
        
        // 检测每个币种的套利机会
        let newOpportunities = 0;
        
        for (const coin of Object.keys(hyperliquidPrices) as SupportedCoin[]) {
          const hlPrice = hyperliquidPrices[coin];
          if (!hlPrice) continue;
          
          for (const [exchange, prices] of Object.entries(otherExchangePrices)) {
            const otherPrice = prices[coin];
            if (!otherPrice) continue;
            
            const opportunity = this.calculateArbitrageOpportunity(
              coin,
              hlPrice,
              otherPrice,
              exchange
            );
            
            if (opportunity && this.validateOpportunity(opportunity)) {
              const existingKey = this.getOpportunityKey(opportunity);
              if (!this.opportunities.has(existingKey)) {
                this.opportunities.set(existingKey, opportunity);
                newOpportunities++;
                
                logger.arbitrage('发现新套利机会', {
                  coin: opportunity.coin,
                  exchange: opportunity.otherExchange,
                  spread: opportunity.grossSpreadPercent.toFixed(3) + '%',
                  profit: '$' + (opportunity.estimatedProfit as SafePrice).toFixed(2),
                  direction: opportunity.direction
                });
                
                this.emit('newOpportunity', opportunity);
              }
            }
          }
        }
        
        // 更新统计
        this.updateStats();
        
        if (newOpportunities > 0) {
          logger.info(`检测完成：发现 ${newOpportunities} 个新套利机会`, {
            totalActive: this.opportunities.size
          });
        }
        
      } catch (error) {
        logger.error('套利检测失败', error);
      }
    });
  }

  /**
   * 获取 Hyperliquid 价格
   */
  private getHyperliquidPrices(): Record<SupportedCoin, USD> {
    try {
      const marketData = getAllMarketData();
      const prices: Record<string, USD> = {};
      
      for (const [coin, data] of Object.entries(marketData)) {
        if (data && typeof data === 'object' && 'price' in data) {
          prices[coin] = createUSD((data as any).price);
        }
      }
      
      this.lastHyperliquidUpdate = Date.now();
      return prices as Record<SupportedCoin, USD>;
      
    } catch (error) {
      logger.error('获取 Hyperliquid 价格失败', error);
      return {};
    }
  }

  /**
   * 获取其他交易所价格
   */
  private getOtherExchangePrices(): Record<string, Record<SupportedCoin, USD>> {
    const result: Record<string, Record<string, USD>> = {};
    
    for (const [key, priceData] of this.priceCache) {
      const [exchange, coin] = key.split('_');
      
      if (!result[exchange]) {
        result[exchange] = {};
      }
      
      result[exchange][coin] = priceData.price;
    }
    
    return result as Record<string, Record<SupportedCoin, USD>>;
  }

  /**
   * 计算套利机会
   */
  private calculateArbitrageOpportunity(
    coin: SupportedCoin,
    hlPrice: USD,
    otherPrice: USD,
    otherExchange: string
  ): CEXArbitrageOpportunity | null {
    try {
      const hlSafePrice = hlPrice as SafePrice;
      const otherSafePrice = otherPrice as SafePrice;
      
      // 计算价差
      const spread = TradingMath.calculateSpreadPercent(hlSafePrice, otherSafePrice);
      const grossSpreadPercent = createPercentage(spread.toNumber());
      
      // 检查最小价差要求
      if (spread.lt(this.config.minSpreadPercent)) {
        return null;
      }
      
      // 确定套利方向
      let direction: 'BUY_HL_SELL_OTHER' | 'BUY_OTHER_SELL_HL';
      let buyPrice: SafePrice;
      let sellPrice: SafePrice;
      
      if (hlSafePrice.lt(otherSafePrice)) {
        direction = 'BUY_HL_SELL_OTHER';
        buyPrice = hlSafePrice;
        sellPrice = otherSafePrice;
      } else {
        direction = 'BUY_OTHER_SELL_HL';
        buyPrice = otherSafePrice;
        sellPrice = hlSafePrice;
      }
      
      // 计算净利润（扣除手续费）
      const totalFees = new SafePrice(this.config.hyperliquidFee + this.config.otherExchangeFee);
      const netProfitPercent = createPercentage(
        spread.minus(totalFees).toNumber()
      );
      
      // 计算风险评分
      const riskScore = this.calculateRiskScore(coin, otherExchange, spread);
      
      // 计算置信度
      const confidence = this.calculateConfidence(coin, otherExchange, spread);
      
      // 计算推荐仓位大小
      const recommendedSize = this.calculatePositionSize(netProfitPercent, riskScore);
      
      // 估算利润
      const estimatedProfit = TradingMath.calculateArbitrageProfit(
        buyPrice,
        sellPrice,
        recommendedSize as SafePrice,
        new SafePrice(this.config.hyperliquidFee),
        new SafePrice(this.config.otherExchangeFee)
      ) as USD;
      
      const opportunity: CEXArbitrageOpportunity = {
        id: `${coin}_${otherExchange}_${Date.now()}`,
        coin,
        hyperliquidPrice: hlPrice,
        otherExchangePrice: otherPrice,
        otherExchange,
        direction,
        grossSpreadPercent,
        netProfitPercent,
        estimatedProfit,
        riskScore,
        confidence,
        recommendedSize,
        maxSize: createUSD(this.config.maxPositionSize),
        timeToExecute: this.estimateExecutionTime(otherExchange),
        detectedAt: Date.now(),
        expiresAt: Date.now() + this.config.opportunityTTLMs,
        priceAge: Date.now() - this.lastHyperliquidUpdate
      };
      
      return opportunity;
      
    } catch (error) {
      logger.error(`计算套利机会失败: ${coin} ${otherExchange}`, error);
      return null;
    }
  }

  /**
   * 验证套利机会
   */
  private validateOpportunity(opportunity: CEXArbitrageOpportunity): boolean {
    // 检查净利润阈值
    if ((opportunity.netProfitPercent as SafePrice).lt(this.config.minSpreadPercent)) {
      return false;
    }
    
    // 检查风险评分
    if ((opportunity.riskScore as SafePrice).gt(this.config.maxRiskScore)) {
      return false;
    }
    
    // 检查置信度
    if ((opportunity.confidence as SafePrice).lt(this.config.minConfidence)) {
      return false;
    }
    
    // 检查价格数据新鲜度（不超过30秒）
    if (opportunity.priceAge > 30000) {
      return false;
    }
    
    return true;
  }

  /**
   * 计算风险评分
   */
  private calculateRiskScore(coin: SupportedCoin, exchange: string, spread: SafePrice): Percentage {
    let risk = new SafePrice(0);
    
    // 基础风险（价差越小风险越高）
    if (spread.lt(1)) {
      risk = risk.plus(new SafePrice(20));
    } else if (spread.lt(2)) {
      risk = risk.plus(new SafePrice(10));
    }
    
    // 交易所风险
    const exchangeRisk: Record<string, number> = {
      'okx': 5,
      'binance': 3,
      'coinbase': 8
    };
    risk = risk.plus(new SafePrice(exchangeRisk[exchange] || 15));
    
    // 币种风险
    const coinRisk: Record<SupportedCoin, number> = {
      'BTC': 2,
      'ETH': 3,
      'SOL': 8,
      'BNB': 6,
      'DOGE': 15,
      'XRP': 10
    };
    risk = risk.plus(new SafePrice(coinRisk[coin] || 20));
    
    return createPercentage(Math.min(risk.toNumber(), 100));
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(coin: SupportedCoin, exchange: string, spread: SafePrice): Percentage {
    let confidence = new SafePrice(50); // 基础置信度
    
    // 价差越大置信度越高
    if (spread.gt(2)) confidence = confidence.plus(new SafePrice(20));
    if (spread.gt(1)) confidence = confidence.plus(new SafePrice(10));
    
    // 主流交易所置信度更高
    const exchangeBonus: Record<string, number> = {
      'okx': 15,
      'binance': 20,
      'coinbase': 10
    };
    confidence = confidence.plus(new SafePrice(exchangeBonus[exchange] || 0));
    
    // 主流币种置信度更高
    const coinBonus: Record<SupportedCoin, number> = {
      'BTC': 20,
      'ETH': 15,
      'SOL': 5,
      'BNB': 10,
      'DOGE': -10,
      'XRP': 0
    };
    confidence = confidence.plus(new SafePrice(coinBonus[coin] || -5));
    
    return createPercentage(Math.min(Math.max(confidence.toNumber(), 0), 100));
  }

  /**
   * 计算仓位大小
   */
  private calculatePositionSize(netProfit: Percentage, riskScore: Percentage): USD {
    const maxSize = new SafePrice(this.config.maxPositionSize);
    const profitFactor = (netProfit as SafePrice).div(5); // 利润系数
    const riskFactor = new SafePrice(1).minus((riskScore as SafePrice).div(100)); // 风险系数
    
    const size = maxSize.times(profitFactor).times(riskFactor);
    return createUSD(Math.min(Math.max(size.toNumber(), 50), this.config.maxPositionSize));
  }

  /**
   * 估算执行时间
   */
  private estimateExecutionTime(exchange: string): number {
    const executionTimes: Record<string, number> = {
      'okx': 2000,
      'binance': 1500,
      'coinbase': 3000
    };
    
    return executionTimes[exchange] || 5000;
  }

  /**
   * 生成机会唯一键
   */
  private getOpportunityKey(opportunity: CEXArbitrageOpportunity): string {
    return `${opportunity.coin}_${opportunity.otherExchange}_${opportunity.direction}`;
  }

  /**
   * 清理过期机会
   */
  private cleanupExpiredOpportunities(): void {
    const now = Date.now();
    const expired: string[] = [];
    
    for (const [key, opportunity] of this.opportunities) {
      if (now > opportunity.expiresAt) {
        expired.push(key);
      }
    }
    
    for (const key of expired) {
      this.opportunities.delete(key);
    }
    
    if (expired.length > 0) {
      logger.debug(`清理 ${expired.length} 个过期套利机会`);
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    const opportunities = Array.from(this.opportunities.values());
    
    this.stats.totalOpportunities = opportunities.length;
    
    if (opportunities.length > 0) {
      this.stats.avgSpreadPercent = opportunities.reduce((sum, op) => 
        sum + (op.grossSpreadPercent as SafePrice).toNumber(), 0) / opportunities.length;
      
      this.stats.avgRiskScore = opportunities.reduce((sum, op) => 
        sum + (op.riskScore as SafePrice).toNumber(), 0) / opportunities.length;
      
      this.stats.avgConfidence = opportunities.reduce((sum, op) => 
        sum + (op.confidence as SafePrice).toNumber(), 0) / opportunities.length;
      
      this.stats.bestOpportunity = opportunities.reduce((best, current) => 
        (current.netProfitPercent as SafePrice).gt(best.netProfitPercent as SafePrice) ? current : best);
      
      // 按交易所统计
      this.stats.opportunitiesByExchange = {};
      this.stats.opportunitiesByCoin = {} as Record<SupportedCoin, number>;
      
      for (const op of opportunities) {
        this.stats.opportunitiesByExchange[op.otherExchange] = 
          (this.stats.opportunitiesByExchange[op.otherExchange] || 0) + 1;
        this.stats.opportunitiesByCoin[op.coin] = 
          (this.stats.opportunitiesByCoin[op.coin] || 0) + 1;
      }
    }
  }

  /**
   * 初始化统计
   */
  private initializeStats(): ArbitrageStats {
    return {
      totalOpportunities: 0,
      avgSpreadPercent: 0,
      avgRiskScore: 0,
      avgConfidence: 0,
      bestOpportunity: null,
      opportunitiesByExchange: {},
      opportunitiesByCoin: {} as Record<SupportedCoin, number>,
      avgDetectionLatency: 0
    };
  }

  /**
   * 获取当前套利机会
   */
  getCurrentOpportunities(): CEXArbitrageOpportunity[] {
    return Array.from(this.opportunities.values());
  }

  /**
   * 获取统计信息
   */
  getStats(): ArbitrageStats {
    return { ...this.stats };
  }

  /**
   * 获取系统状态
   */
  getStatus(): {
    isRunning: boolean;
    activeOpportunities: number;
    lastDetectionTime: number;
    performanceMetrics: PerformanceMetrics | null;
    exchangeStatus: any;
  } {
    return {
      isRunning: this.isRunning,
      activeOpportunities: this.opportunities.size,
      lastDetectionTime: this.lastHyperliquidUpdate,
      performanceMetrics: performanceMonitor.getCurrentMetrics(),
      exchangeStatus: this.multiExchangeConnector.getStatus()
    };
  }
}

// 导出单例
export const cexArbitrageEngine = new CEXArbitrageEngine();