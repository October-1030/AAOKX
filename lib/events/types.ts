/**
 * 交易事件类型定义
 * 借鉴 Nautilus Trader 的事件驱动架构
 */

import { Coin, Position, TradingDecision } from '@/types/trading';

// ==========================================
// 事件类型枚举
// ==========================================
export enum TradingEventType {
  // 订单事件
  ORDER_SUBMITTED = 'ORDER_SUBMITTED',
  ORDER_ACCEPTED = 'ORDER_ACCEPTED',
  ORDER_REJECTED = 'ORDER_REJECTED',
  ORDER_FILLED = 'ORDER_FILLED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',

  // 持仓事件
  POSITION_OPENED = 'POSITION_OPENED',
  POSITION_MODIFIED = 'POSITION_MODIFIED',
  POSITION_CLOSED = 'POSITION_CLOSED',

  // 风险事件
  RISK_LIMIT_BREACHED = 'RISK_LIMIT_BREACHED',
  STOP_LOSS_TRIGGERED = 'STOP_LOSS_TRIGGERED',
  TAKE_PROFIT_TRIGGERED = 'TAKE_PROFIT_TRIGGERED',

  // AI决策事件
  AI_DECISION_MADE = 'AI_DECISION_MADE',
  AI_DECISION_EXECUTED = 'AI_DECISION_EXECUTED',
  AI_DECISION_REJECTED = 'AI_DECISION_REJECTED',

  // 系统事件
  TRADING_CYCLE_START = 'TRADING_CYCLE_START',
  TRADING_CYCLE_END = 'TRADING_CYCLE_END',
  MARKET_DATA_UPDATED = 'MARKET_DATA_UPDATED',
  ACCOUNT_UPDATED = 'ACCOUNT_UPDATED',

  // 安全事件
  CIRCUIT_BREAKER_TRIGGERED = 'CIRCUIT_BREAKER_TRIGGERED',
  DAILY_LOSS_LIMIT_REACHED = 'DAILY_LOSS_LIMIT_REACHED',
}

// ==========================================
// 基础事件接口
// ==========================================
export interface BaseEvent {
  type: TradingEventType;
  timestamp: number;
  modelName?: string;
}

// ==========================================
// 订单事件
// ==========================================
export interface OrderSubmittedEvent extends BaseEvent {
  type: TradingEventType.ORDER_SUBMITTED;
  coin: Coin;
  side: 'LONG' | 'SHORT';
  notional: number;
  leverage: number;
  price: number;
}

export interface OrderAcceptedEvent extends BaseEvent {
  type: TradingEventType.ORDER_ACCEPTED;
  coin: Coin;
  orderId: string;
}

export interface OrderRejectedEvent extends BaseEvent {
  type: TradingEventType.ORDER_REJECTED;
  coin: Coin;
  reason: string;
}

export interface OrderFilledEvent extends BaseEvent {
  type: TradingEventType.ORDER_FILLED;
  coin: Coin;
  side: 'LONG' | 'SHORT';
  fillPrice: number;
  fillNotional: number;
}

// ==========================================
// 持仓事件
// ==========================================
export interface PositionOpenedEvent extends BaseEvent {
  type: TradingEventType.POSITION_OPENED;
  position: Position;
}

export interface PositionModifiedEvent extends BaseEvent {
  type: TradingEventType.POSITION_MODIFIED;
  position: Position;
  changes: {
    stopLoss?: number;
    takeProfit?: number;
  };
}

export interface PositionClosedEvent extends BaseEvent {
  type: TradingEventType.POSITION_CLOSED;
  coin: Coin;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  exitReason: string;
}

// ==========================================
// 风险事件
// ==========================================
export interface RiskLimitBreachedEvent extends BaseEvent {
  type: TradingEventType.RISK_LIMIT_BREACHED;
  limitType: string;
  currentValue: number;
  limitValue: number;
  message: string;
}

export interface StopLossTriggeredEvent extends BaseEvent {
  type: TradingEventType.STOP_LOSS_TRIGGERED;
  coin: Coin;
  currentPrice: number;
  stopLossPrice: number;
}

export interface TakeProfitTriggeredEvent extends BaseEvent {
  type: TradingEventType.TAKE_PROFIT_TRIGGERED;
  coin: Coin;
  currentPrice: number;
  takeProfitPrice: number;
}

// ==========================================
// AI决策事件
// ==========================================
export interface AIDecisionMadeEvent extends BaseEvent {
  type: TradingEventType.AI_DECISION_MADE;
  decision: TradingDecision;
  chainOfThought: string;
}

export interface AIDecisionExecutedEvent extends BaseEvent {
  type: TradingEventType.AI_DECISION_EXECUTED;
  decision: TradingDecision;
  success: boolean;
  result?: string;
}

export interface AIDecisionRejectedEvent extends BaseEvent {
  type: TradingEventType.AI_DECISION_REJECTED;
  decision: TradingDecision;
  reasons: string[];
}

// ==========================================
// 系统事件
// ==========================================
export interface TradingCycleStartEvent extends BaseEvent {
  type: TradingEventType.TRADING_CYCLE_START;
  cycleNumber: number;
}

export interface TradingCycleEndEvent extends BaseEvent {
  type: TradingEventType.TRADING_CYCLE_END;
  cycleNumber: number;
  totalEquity: number;
  positionsCount: number;
}

export interface MarketDataUpdatedEvent extends BaseEvent {
  type: TradingEventType.MARKET_DATA_UPDATED;
  coins: Coin[];
}

export interface AccountUpdatedEvent extends BaseEvent {
  type: TradingEventType.ACCOUNT_UPDATED;
  totalEquity: number;
  availableCash: number;
  totalReturn: number;
}

// ==========================================
// 安全事件
// ==========================================
export interface CircuitBreakerTriggeredEvent extends BaseEvent {
  type: TradingEventType.CIRCUIT_BREAKER_TRIGGERED;
  reason: string;
  totalLossPercent: number;
}

export interface DailyLossLimitReachedEvent extends BaseEvent {
  type: TradingEventType.DAILY_LOSS_LIMIT_REACHED;
  dailyLossPercent: number;
  limitPercent: number;
}

// ==========================================
// 联合类型：所有事件
// ==========================================
export type TradingEvent =
  | OrderSubmittedEvent
  | OrderAcceptedEvent
  | OrderRejectedEvent
  | OrderFilledEvent
  | PositionOpenedEvent
  | PositionModifiedEvent
  | PositionClosedEvent
  | RiskLimitBreachedEvent
  | StopLossTriggeredEvent
  | TakeProfitTriggeredEvent
  | AIDecisionMadeEvent
  | AIDecisionExecutedEvent
  | AIDecisionRejectedEvent
  | TradingCycleStartEvent
  | TradingCycleEndEvent
  | MarketDataUpdatedEvent
  | AccountUpdatedEvent
  | CircuitBreakerTriggeredEvent
  | DailyLossLimitReachedEvent;

// ==========================================
// 事件处理器类型
// ==========================================
export type EventHandler<T extends TradingEvent = TradingEvent> = (event: T) => void | Promise<void>;

// ==========================================
// 事件过滤器
// ==========================================
export interface EventFilter {
  types?: TradingEventType[];
  modelName?: string;
  startTime?: number;
  endTime?: number;
}
