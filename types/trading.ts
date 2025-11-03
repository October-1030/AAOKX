// 核心交易类型定义

export type Coin = 'BTC' | 'ETH' | 'SOL' | 'BNB' | 'DOGE' | 'XRP';

export type TradeSide = 'LONG' | 'SHORT';

export type TradeAction = 'BUY' | 'SELL' | 'HOLD' | 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_POSITION' | 'ADJUST_POSITION';

export interface TechnicalIndicators {
  price: number;
  ema_20: number;
  ema_50: number;
  ema_200: number;
  macd: number;
  macd_signal: number;
  macd_histogram: number;
  rsi: number;          // 14周期 RSI（默认）
  rsi_7: number;        // 7周期 RSI（短线）
  rsi_14: number;       // 14周期 RSI（中线）
  atr: number;          // 14周期 ATR（默认）
  atr_3: number;        // 3周期 ATR（短期波动）
  atr_14: number;       // 14周期 ATR（中期波动）
  volume: number;
  volume_ratio: number;
}

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketData {
  coin: Coin;
  current: TechnicalIndicators;
  intraday: CandleData[]; // 10分钟K线，最近10个数据点
  daily: CandleData[];    // 4小时K线，长期背景
}

export interface Position {
  id: string;
  coin: Coin;
  side: TradeSide;
  leverage: number;
  notional: number;
  entryPrice: number;
  currentPrice: number;
  liquidationPrice: number;     // 清算价格（新增 - nof1.ai 必需）
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  exitPlan: {
    invalidation: string;
    stopLoss: number;
    takeProfit: number;
  };
  openedAt: number;
}

export interface AccountStatus {
  tradingDuration: number;
  totalCalls: number;
  totalReturn: number;
  availableCash: number;
  totalEquity: number;
  positions: Position[];
}

export interface TradingDecision {
  coin: Coin;
  action: TradeAction;
  confidence: number; // 0-100
  quantity?: number;
  size?: number;        // 交易数量（币的数量）
  side?: TradeSide;
  leverage?: number;
  notional?: number;
  exitPlan?: {
    invalidation: string;
    stopLoss: number;
    takeProfit: number;
  };
  entryPlan?: {        // 入场计划（用于复杂订单）
    orderType?: 'MARKET' | 'LIMIT';
    limitPrice?: number;
  };
}

export interface ChainOfThought {
  overallAssessment: string;
  positionAnalysis: {
    positionId: string;
    analysis: string;
    decision: 'HOLD' | 'EXIT';
    rationale: string;
  }[];
  newOpportunities: {
    coin: Coin;
    signal: string;
    assessment: string;
  }[];
  finalSummary: string;
}

export interface AIResponse {
  modelName: string;
  chainOfThought: ChainOfThought;
  decisions: TradingDecision[];
  timestamp: number;
}

export interface ModelPerformance {
  modelName: string;
  displayName: string;
  strategy: string;
  initialCapital: number;
  currentEquity: number;
  totalReturn: number;
  returnPercent: number;
  totalTrades: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  positions: Position[];
  recentDecisions: AIResponse[];
  equityHistory: { timestamp: number; equity: number }[];
}

export interface CompletedTrade {
  id: string;
  modelName: string;
  coin: Coin;
  side: TradeSide;
  entryPrice: number;
  exitPrice: number;
  leverage: number;
  notional: number;
  pnl: number;
  pnlPercent: number;
  openedAt: number;
  closedAt: number;
  exitReason: string;

  // 链上透明度字段（Blockchain Transparency）
  tradeHash?: string;      // SHA-256 哈希，唯一标识此交易
  blockHash?: string;      // 所属区块的哈希（用于分组）
  verified?: boolean;      // 是否已验证
}

/**
 * 交易区块（Trade Block）- 用于组织和验证多笔交易
 */
export interface TradeBlock {
  blockNumber: number;           // 区块编号
  timestamp: number;              // 区块生成时间
  trades: CompletedTrade[];      // 区块内的交易列表
  previousBlockHash: string;     // 前一个区块的哈希（链式结构）
  blockHash: string;             // 当前区块的哈希
  merkleRoot: string;            // Merkle 树根节点（高级验证）
}

/**
 * 透明度导出数据（用于公开验证）
 */
export interface TransparencyExport {
  exportVersion: string;         // 导出格式版本
  exportTimestamp: number;       // 导出时间
  totalTrades: number;           // 总交易数
  blocks: TradeBlock[];          // 所有区块
  metadata: {
    initialCapital: number;
    finalEquity: number;
    totalReturn: number;
    timeRange: { start: number; end: number };
  };
}
