/**
 * 高级事件驱动交易引擎
 * 基于QuantStart架构理念，优化性能和可扩展性
 */

import EventEmitter from 'events';
import { Coin, Position, TradingDecision } from '@/types/trading';

// 事件类型定义
export enum TradingEventType {
  PRICE_UPDATE = 'PRICE_UPDATE',
  SIGNAL_GENERATED = 'SIGNAL_GENERATED',
  ORDER_PLACED = 'ORDER_PLACED',
  ORDER_FILLED = 'ORDER_FILLED',
  RISK_ALERT = 'RISK_ALERT',
  ARBITRAGE_OPPORTUNITY = 'ARBITRAGE_OPPORTUNITY',
  MARKET_DATA_UPDATE = 'MARKET_DATA_UPDATE',
  PORTFOLIO_UPDATE = 'PORTFOLIO_UPDATE'
}

// 事件数据结构
export interface TradingEvent {
  type: TradingEventType;
  timestamp: number;
  data: any;
  priority: number; // 0 = 最高优先级
}

export interface PriceUpdateEvent extends TradingEvent {
  type: TradingEventType.PRICE_UPDATE;
  data: {
    coin: Coin;
    price: number;
    volume: number;
    exchange: string;
  };
}

export interface ArbitrageEvent extends TradingEvent {
  type: TradingEventType.ARBITRAGE_OPPORTUNITY;
  data: {
    coin: Coin;
    buyExchange: string;
    sellExchange: string;
    buyPrice: number;
    sellPrice: number;
    profitPercent: number;
    estimatedProfit: number;
  };
}

/**
 * 高性能事件队列
 * 使用优先级队列确保关键事件优先处理
 */
export class EventQueue {
  private queue: TradingEvent[] = [];
  private processing = false;

  enqueue(event: TradingEvent): void {
    // 按优先级插入队列
    const insertIndex = this.queue.findIndex(e => e.priority > event.priority);
    if (insertIndex === -1) {
      this.queue.push(event);
    } else {
      this.queue.splice(insertIndex, 0, event);
    }
  }

  dequeue(): TradingEvent | undefined {
    return this.queue.shift();
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  // 批量处理事件以提高效率
  dequeueBatch(maxSize: number = 10): TradingEvent[] {
    const batch = this.queue.splice(0, Math.min(maxSize, this.queue.length));
    return batch;
  }
}

/**
 * 实时价格监控器
 * 检测跨交易所价格差异和套利机会
 */
export class RealTimePriceMonitor extends EventEmitter {
  private priceCache = new Map<string, { price: number; timestamp: number; exchange: string }>();
  private arbitrageThreshold = 0.5; // 0.5%以上差价才考虑套利

  updatePrice(coin: Coin, price: number, exchange: string = 'hyperliquid'): void {
    const key = `${coin}_${exchange}`;
    const timestamp = Date.now();
    
    // 更新价格缓存
    this.priceCache.set(key, { price, timestamp, exchange });

    // 发出价格更新事件
    this.emit('priceUpdate', {
      type: TradingEventType.PRICE_UPDATE,
      timestamp,
      data: { coin, price, exchange },
      priority: 1
    } as PriceUpdateEvent);

    // 检查套利机会
    this.checkArbitrageOpportunities(coin);
  }

  private checkArbitrageOpportunities(coin: Coin): void {
    const prices: Array<{ price: number; exchange: string; timestamp: number }> = [];
    
    // 收集该币种在所有交易所的价格
    for (const [key, data] of this.priceCache) {
      if (key.startsWith(coin + '_')) {
        const age = Date.now() - data.timestamp;
        if (age < 60000) { // 只考虑1分钟内的价格数据
          prices.push(data);
        }
      }
    }

    if (prices.length < 2) return;

    // 寻找最大价差
    let maxPriceDiff = 0;
    let bestBuy: any = null;
    let bestSell: any = null;

    for (let i = 0; i < prices.length; i++) {
      for (let j = i + 1; j < prices.length; j++) {
        const diff = Math.abs(prices[i].price - prices[j].price);
        const diffPercent = (diff / Math.min(prices[i].price, prices[j].price)) * 100;
        
        if (diffPercent > maxPriceDiff && diffPercent > this.arbitrageThreshold) {
          maxPriceDiff = diffPercent;
          if (prices[i].price < prices[j].price) {
            bestBuy = prices[i];
            bestSell = prices[j];
          } else {
            bestBuy = prices[j];
            bestSell = prices[i];
          }
        }
      }
    }

    // 如果发现套利机会，发出事件
    if (bestBuy && bestSell) {
      this.emit('arbitrageOpportunity', {
        type: TradingEventType.ARBITRAGE_OPPORTUNITY,
        timestamp: Date.now(),
        data: {
          coin,
          buyExchange: bestBuy.exchange,
          sellExchange: bestSell.exchange,
          buyPrice: bestBuy.price,
          sellPrice: bestSell.price,
          profitPercent: maxPriceDiff,
          estimatedProfit: (bestSell.price - bestBuy.price) * 100 // 假设100单位
        },
        priority: 0 // 最高优先级
      } as ArbitrageEvent);
    }
  }

  // 获取当前最佳价格
  getBestPrice(coin: Coin): { price: number; exchange: string } | null {
    let bestPrice: number | null = null;
    let bestExchange = '';
    
    for (const [key, data] of this.priceCache) {
      if (key.startsWith(coin + '_')) {
        const age = Date.now() - data.timestamp;
        if (age < 30000 && (bestPrice === null || data.price < bestPrice)) {
          bestPrice = data.price;
          bestExchange = data.exchange;
        }
      }
    }
    
    return bestPrice ? { price: bestPrice, exchange: bestExchange } : null;
  }
}

/**
 * 高级事件驱动交易引擎
 * 整合所有组件，提供高性能的事件处理
 */
export class AdvancedTradingEngine extends EventEmitter {
  private eventQueue = new EventQueue();
  private priceMonitor = new RealTimePriceMonitor();
  private processingInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // 价格更新处理
    this.priceMonitor.on('priceUpdate', (event: PriceUpdateEvent) => {
      this.eventQueue.enqueue(event);
    });

    // 套利机会处理
    this.priceMonitor.on('arbitrageOpportunity', (event: ArbitrageEvent) => {
      this.eventQueue.enqueue(event);
      console.log(`🔥 套利机会: ${event.data.coin} 预期利润 ${event.data.profitPercent.toFixed(2)}%`);
    });
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🚀 高级事件驱动引擎启动');

    // 高频事件处理循环 (每100ms处理一次)
    this.processingInterval = setInterval(() => {
      this.processEventBatch();
    }, 100);
  }

  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    console.log('⏹️ 高级事件驱动引擎停止');
  }

  // 批量处理事件以提高性能
  private processEventBatch(): void {
    const events = this.eventQueue.dequeueBatch(20); // 每次处理最多20个事件
    
    for (const event of events) {
      this.processEvent(event);
    }

    // 输出队列状态
    if (this.eventQueue.size() > 100) {
      console.warn(`⚠️ 事件队列积压: ${this.eventQueue.size()} 个事件`);
    }
  }

  private processEvent(event: TradingEvent): void {
    switch (event.type) {
      case TradingEventType.PRICE_UPDATE:
        this.handlePriceUpdate(event as PriceUpdateEvent);
        break;
      
      case TradingEventType.ARBITRAGE_OPPORTUNITY:
        this.handleArbitrageOpportunity(event as ArbitrageEvent);
        break;
      
      default:
        console.log(`未处理的事件类型: ${event.type}`);
    }
  }

  private handlePriceUpdate(event: PriceUpdateEvent): void {
    const { coin, price, exchange } = event.data;
    
    // 发出价格更新信号给策略模块
    this.emit('priceUpdate', { coin, price, exchange, timestamp: event.timestamp });
  }

  private async handleArbitrageOpportunity(event: ArbitrageEvent): Promise<void> {
    const { coin, buyPrice, sellPrice, profitPercent } = event.data;
    
    // 简单的套利执行逻辑
    if (profitPercent > 1.0) { // 只执行超过1%利润的套利
      console.log(`💰 执行套利: ${coin} 买入@${buyPrice} 卖出@${sellPrice} 利润${profitPercent.toFixed(2)}%`);
      
      // 这里会调用真实的交易执行逻辑
      // await this.executeArbitrage(event.data);
      
      // 发出套利执行事件
      this.emit('arbitrageExecuted', event.data);
    }
  }

  // 外部接口：更新价格
  updatePrice(coin: Coin, price: number, exchange: string = 'hyperliquid'): void {
    this.priceMonitor.updatePrice(coin, price, exchange);
  }

  // 外部接口：获取最佳价格
  getBestPrice(coin: Coin): { price: number; exchange: string } | null {
    return this.priceMonitor.getBestPrice(coin);
  }

  // 获取系统状态
  getSystemStatus(): {
    isRunning: boolean;
    queueSize: number;
    priceDataPoints: number;
  } {
    return {
      isRunning: this.isRunning,
      queueSize: this.eventQueue.size(),
      priceDataPoints: this.priceMonitor['priceCache'].size
    };
  }
}

// 导出单例
export const advancedTradingEngine = new AdvancedTradingEngine();