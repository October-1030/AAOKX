// Performance 页面统一的类型定义
import type { MarketRegime, StrategyFlavor } from './trading';

/**
 * Trade 类型 - 用于 Performance 分析
 * 统一了 API 返回、组件展示、详细分析所需的字段
 */
export interface Trade {
  id: string;
  symbol: string;
  side: 'long' | 'short' | 'LONG' | 'SHORT';
  notional: number;
  leverage?: number;
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: number;
  closedAt?: number;
  entryTime?: string; // ISO 字符串格式
  exitTime?: string; // ISO 字符串格式
  realizedPnl?: number;
  pnl: number; // 与 realizedPnl 相同，为兼容性保留两个字段
  realizedPnlPercent?: number;
  status: 'open' | 'closed' | 'stopped' | 'tp_hit' | 'liquidated';

  // AI 相关字段
  aiReason?: string;
  marketContext?: string;
  riskNote?: string;
  modelName?: string;
  confidence?: number;

  // 市场状态与策略
  regime?: MarketRegime;
  strategyFlavor?: StrategyFlavor;

  // 高级分析字段
  rMultiple?: number; // R-Multiple (盈亏比倍数)
  qty?: number; // 数量
  isLive?: boolean; // 是否真实交易
}

/**
 * Trade Stats - 交易统计
 */
export interface TradeStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  winCount: number;
  lossCount: number;
}

/**
 * Regime × Strategy 统计
 */
export interface RegimeStrategyStats {
  regime: string;
  strategyFlavor: string;
  tradeCount: number;
  winRate: number; // 0-1
  avgR: number | null;
  totalPnl: number;
  maxLosingStreak: number;
}
