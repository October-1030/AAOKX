/**
 * 事件总线 - 核心事件分发系统
 * 借鉴 Nautilus Trader 的事件驱动架构
 */

import {
  TradingEvent,
  TradingEventType,
  EventHandler,
  EventFilter,
} from './types';

// ==========================================
// 订阅者管理
// ==========================================
interface Subscription {
  id: string;
  handler: EventHandler;
  filter?: EventFilter;
}

// ==========================================
// EventBus 核心类
// ==========================================
export class EventBus {
  private subscriptions: Map<TradingEventType | '*', Subscription[]> = new Map();
  private eventHistory: TradingEvent[] = [];
  private maxHistorySize: number;
  private isEnabled: boolean = true;

  constructor(maxHistorySize: number = 1000) {
    this.maxHistorySize = maxHistorySize;
  }

  // ==========================================
  // 订阅事件
  // ==========================================

  /**
   * 订阅特定类型的事件
   */
  subscribe(
    eventType: TradingEventType | '*',
    handler: EventHandler,
    filter?: EventFilter
  ): string {
    const subscription: Subscription = {
      id: this.generateSubscriptionId(),
      handler,
      filter,
    };

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }

    this.subscriptions.get(eventType)!.push(subscription);

    return subscription.id;
  }

  /**
   * 订阅多个事件类型
   */
  subscribeMultiple(
    eventTypes: TradingEventType[],
    handler: EventHandler,
    filter?: EventFilter
  ): string[] {
    return eventTypes.map(type => this.subscribe(type, handler, filter));
  }

  /**
   * 订阅所有事件
   */
  subscribeAll(handler: EventHandler, filter?: EventFilter): string {
    return this.subscribe('*', handler, filter);
  }

  // ==========================================
  // 取消订阅
  // ==========================================

  /**
   * 通过订阅ID取消订阅
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [eventType, subs] of this.subscriptions.entries()) {
      const index = subs.findIndex(sub => sub.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        if (subs.length === 0) {
          this.subscriptions.delete(eventType);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * 取消所有订阅
   */
  unsubscribeAll(): void {
    this.subscriptions.clear();
  }

  /**
   * 取消特定事件类型的所有订阅
   */
  unsubscribeByType(eventType: TradingEventType | '*'): void {
    this.subscriptions.delete(eventType);
  }

  // ==========================================
  // 发布事件
  // ==========================================

  /**
   * 发布事件到所有订阅者
   */
  async emit(event: TradingEvent): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    // 1. 保存到历史记录
    this.addToHistory(event);

    // 2. 获取所有匹配的订阅者
    const subscriptions = this.getMatchingSubscriptions(event);

    // 3. 执行所有handler（并行执行）
    const promises = subscriptions.map(async (subscription) => {
      try {
        // 检查过滤器
        if (subscription.filter && !this.matchesFilter(event, subscription.filter)) {
          return;
        }

        // 执行handler
        await subscription.handler(event);
      } catch (error) {
        console.error(
          `[EventBus] Error in handler for event ${event.type}:`,
          error
        );
        // 不抛出错误，避免影响其他handler
      }
    });

    await Promise.all(promises);
  }

  /**
   * 同步发布事件（不等待handler完成）
   */
  emitSync(event: TradingEvent): void {
    this.emit(event).catch(error => {
      console.error('[EventBus] Error in emitSync:', error);
    });
  }

  // ==========================================
  // 历史记录
  // ==========================================

  /**
   * 获取事件历史
   */
  getHistory(filter?: EventFilter): TradingEvent[] {
    if (!filter) {
      return [...this.eventHistory];
    }

    return this.eventHistory.filter(event => this.matchesFilter(event, filter));
  }

  /**
   * 清空历史记录
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * 获取最近N个事件
   */
  getRecentEvents(count: number, filter?: EventFilter): TradingEvent[] {
    const history = this.getHistory(filter);
    return history.slice(-count);
  }

  // ==========================================
  // 控制方法
  // ==========================================

  /**
   * 启用事件总线
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * 禁用事件总线（不会处理新事件）
   */
  disable(): void {
    this.isEnabled = false;
  }

  /**
   * 获取状态信息
   */
  getStats() {
    const subscriptionCounts = new Map<TradingEventType | '*', number>();

    for (const [eventType, subs] of this.subscriptions.entries()) {
      subscriptionCounts.set(eventType, subs.length);
    }

    return {
      isEnabled: this.isEnabled,
      subscriptionCounts: Object.fromEntries(subscriptionCounts),
      totalSubscriptions: Array.from(this.subscriptions.values())
        .reduce((sum, subs) => sum + subs.length, 0),
      historySize: this.eventHistory.length,
      maxHistorySize: this.maxHistorySize,
    };
  }

  // ==========================================
  // 私有辅助方法
  // ==========================================

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getMatchingSubscriptions(event: TradingEvent): Subscription[] {
    const specific = this.subscriptions.get(event.type) || [];
    const wildcard = this.subscriptions.get('*') || [];
    return [...specific, ...wildcard];
  }

  private matchesFilter(event: TradingEvent, filter: EventFilter): boolean {
    // 检查事件类型
    if (filter.types && !filter.types.includes(event.type)) {
      return false;
    }

    // 检查模型名称
    if (filter.modelName && event.modelName !== filter.modelName) {
      return false;
    }

    // 检查时间范围
    if (filter.startTime && event.timestamp < filter.startTime) {
      return false;
    }

    if (filter.endTime && event.timestamp > filter.endTime) {
      return false;
    }

    return true;
  }

  private addToHistory(event: TradingEvent): void {
    this.eventHistory.push(event);

    // 如果超过最大历史大小，删除最旧的事件
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }
}

// ==========================================
// 全局单例实例
// ==========================================
let globalEventBus: EventBus | null = null;

/**
 * 获取全局EventBus实例
 */
export function getEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus(1000);
  }
  return globalEventBus;
}

/**
 * 创建新的EventBus实例（用于测试或隔离场景）
 */
export function createEventBus(maxHistorySize?: number): EventBus {
  return new EventBus(maxHistorySize);
}
