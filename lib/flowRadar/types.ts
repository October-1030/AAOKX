/**
 * Flow-Radar 信号类型定义
 * 基于 Flow-Radar 项目的信号格式
 */

// 信号优先级
export enum SignalPriority {
  P1 = 1, // 最高优先级（鲸鱼、对称性破坏）
  P2 = 2, // 冰山、强势信号
  P3 = 3, // 链上信号
  P4 = 4, // 最低优先级
}

// 信号状态
export enum SignalStatus {
  ACTIVE = 'active',
  DECAYING = 'decaying',
  EXPIRED = 'expired',
  CONFIRMED = 'confirmed',
  INVALIDATED = 'invalidated',
}

// 信号方向
export type SignalDirection = 'LONG' | 'SHORT' | 'NEUTRAL';

// 冰山信号级别
export enum IcebergLevel {
  NONE = 'none',
  ACTIVITY = 'refill_activity', // 有补单活动（可能是做市噪音）
  CONFIRMED = 'confirmed_iceberg', // 确认冰山（满足吸收度条件）
}

// 共振等级
export enum ResonanceLevel {
  NONE = 0,
  SINGLE = 1, // 单一信号
  DOUBLE = 2, // 双重共振
  TRIPLE = 3, // 三重共振（最强）
}

// 市场状态（K神战法）
export enum MarketState {
  NEUTRAL = 'neutral', // 多空博弈
  ACCUMULATING = 'accumulating', // 暗中吸筹
  DISTRIBUTING = 'distributing', // 暗中出货
  TREND_UP = 'trend_up', // 真实上涨
  TREND_DOWN = 'trend_down', // 真实下跌
  WASH_ACCUMULATE = 'wash_accumulate', // 洗盘吸筹
  TRAP_DISTRIBUTION = 'trap_distribution', // 诱多出货
}

// 信号类型
export const SIGNAL_TYPES = {
  WHALE_BUY: { name: '巨鲸买入', direction: 'LONG' as SignalDirection, priority: SignalPriority.P1 },
  WHALE_SELL: { name: '巨鲸卖出', direction: 'SHORT' as SignalDirection, priority: SignalPriority.P1 },
  ICEBERG_BUY: { name: '冰山买单', direction: 'LONG' as SignalDirection, priority: SignalPriority.P2 },
  ICEBERG_SELL: { name: '冰山卖单', direction: 'SHORT' as SignalDirection, priority: SignalPriority.P2 },
  STRONG_BULLISH: { name: '强势看多', direction: 'LONG' as SignalDirection, priority: SignalPriority.P2 },
  STRONG_BEARISH: { name: '强势看空', direction: 'SHORT' as SignalDirection, priority: SignalPriority.P2 },
  SYMMETRY_BREAK_UP: { name: '对称性破坏(上)', direction: 'LONG' as SignalDirection, priority: SignalPriority.P1 },
  SYMMETRY_BREAK_DOWN: { name: '对称性破坏(下)', direction: 'SHORT' as SignalDirection, priority: SignalPriority.P1 },
  LIQUIDITY_GRAB: { name: '流动性猎杀', direction: 'NEUTRAL' as SignalDirection, priority: SignalPriority.P1 },
  CHAIN_INFLOW: { name: '链上流入', direction: 'SHORT' as SignalDirection, priority: SignalPriority.P3 },
  CHAIN_OUTFLOW: { name: '链上流出', direction: 'LONG' as SignalDirection, priority: SignalPriority.P3 },
} as const;

export type SignalType = keyof typeof SIGNAL_TYPES;

// 冰山信号
export interface IcebergSignal {
  timestamp: string; // ISO 时间
  price: number;
  side: 'BUY' | 'SELL';
  cumulative_volume: number; // 累计成交量
  visible_depth: number; // 可见挂单量
  intensity: number; // 强度
  refill_count: number; // 补单次数
  confidence: number; // 0-100
  level: IcebergLevel;
}

// 系统信号
export interface SystemSignal {
  source: 'M' | 'I' | 'A' | 'C'; // Market, Iceberg, Chain, Command
  signal_type: SignalType;
  direction: SignalDirection;
  strength: number; // 0-100
  timestamp: string;
  details?: Record<string, unknown>;
}

// 共振信号（K神战法）
export interface ResonanceSignal {
  timestamp: string;
  level: ResonanceLevel;
  direction: SignalDirection;
  confidence: number; // 0-100
  sources: string[];
  signals: SystemSignal[];
  recommended_action: string;
  details?: Record<string, unknown>;
}

// 状态机输出
export interface StateOutput {
  state: MarketState;
  state_name: string;
  confidence: number;
  reason: string;
  recommendation: string;
  detail: string;
  cooldown_remaining?: number;
  state_changed?: boolean;
  previous_state?: MarketState;
}

// 原始信号事件（从 JSONL 读取）
export interface RawSignalEvent {
  type: 'signal' | 'state' | 'orderbook' | 'trades';
  ts: number; // Unix 时间戳
  symbol: string;
  data: {
    id?: string;
    signal_type?: string;
    direction?: SignalDirection;
    source?: string;
    priority?: number;
    strength?: number;
    confidence?: number;
    timestamp?: string;
    price_at_signal?: number;
    details?: Record<string, unknown>;
    status?: SignalStatus;
    decay_factor?: number;
    // 冰山信号字段
    price?: number;
    side?: 'BUY' | 'SELL';
    cumulative_volume?: number;
    visible_depth?: number;
    intensity?: number;
    refill_count?: number;
    level?: IcebergLevel;
    // 状态机字段
    state?: MarketState;
    state_name?: string;
    reason?: string;
    recommendation?: string;
  };
}

// 标准化信号（处理后）
export interface NormalizedSignal {
  id: string;
  type: 'iceberg' | 'kking' | 'resonance' | 'state';
  signal_type: string;
  direction: SignalDirection;
  source: string;
  priority: SignalPriority;
  strength: number;
  confidence: number;
  timestamp: number; // Unix ms
  price: number;
  symbol: string;
  ttl: number; // 有效期（秒）
  details: Record<string, unknown>;
  status: SignalStatus;
  // 冰山特有字段
  iceberg_level?: IcebergLevel;
  refill_count?: number;
  // K神特有字段
  market_state?: MarketState;
  resonance_level?: ResonanceLevel;
}

// 信号摘要（注入 Prompt 的格式）
export interface FlowRadarSummary {
  as_of: string; // ISO 时间戳
  symbol: string;
  window_sec: number;
  signals: NormalizedSignal[];
  consensus: {
    bias: 'bullish' | 'bearish' | 'neutral';
    conflict: boolean;
  };
  trend_congruence: boolean;
  iceberg_summary?: {
    buy_signals: number;
    sell_signals: number;
    confirmed_buy: boolean;
    confirmed_sell: boolean;
  };
  kking_summary?: {
    state: MarketState;
    state_name: string;
    confidence: number;
    recommendation: string;
  };
}

// 系统状态
export enum FlowRadarStatus {
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COOLDOWN = 'COOLDOWN',
  ERROR = 'ERROR',
}

// 心跳状态
export interface HeartbeatState {
  status: FlowRadarStatus;
  last_signal_time: number;
  consecutive_signals: number;
  signal_start_time: number;
  cooldown_until: number;
  pause_reason?: string;
}
