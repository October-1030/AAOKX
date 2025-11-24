// 核心交易类型定义

export type Coin = 'BTC' | 'ETH' | 'SOL' | 'BNB' | 'DOGE' | 'XRP';

export type TradeSide = 'LONG' | 'SHORT';

// nof1.ai 真实动作类型（基于逆向工程）
export type TradeAction = 'buy_to_enter' | 'sell_to_enter' | 'hold' | 'close';

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

  // 🎯 智能止盈系统字段
  maxUnrealizedPnL?: number;     // 最高浮盈（用于高点回撤保护）
  maxUnrealizedPnLPercent?: number; // 最高浮盈百分比
  partialExitsDone?: number[];   // 已执行的分批止盈级别 [50, 100] 表示已平仓 50% 和 100% 级别
  trailingStopActivated?: boolean; // 移动止损是否已激活
}

export interface AccountStatus {
  tradingDuration: number;
  totalCalls: number;
  totalReturn: number;
  availableCash: number;
  totalEquity: number;
  positions: Position[];
}

// nof1.ai 真实决策格式（基于逆向工程）
export interface TradingDecision {
  coin: Coin;
  action: TradeAction;  // 'buy_to_enter' | 'sell_to_enter' | 'hold' | 'close'
  confidence: number;   // 0-1 (nof1.ai 格式，不是 0-100)
  quantity?: number;    // 可选：用于 buy_to_enter/sell_to_enter
  leverage?: number;    // 根据 confidence 动态计算：0.3-0.5→1-3x, 0.5-0.7→3-8x, 0.7-1.0→8-20x
  notional?: number;    // 可选：交易名义价值
  exitPlan: {           // 必填：nof1.ai 要求所有交易必须有退出计划
    invalidation: string;  // 废弃条件描述
    stopLoss: number;      // 止损价格（必须确保单笔损失 ≤ 1-3% 账户）
    takeProfit: number;    // 止盈价格（必须确保盈亏比 ≥ 2:1）
  };
  riskUsd?: number;     // 可选：该笔交易的美元风险额
  justification?: string; // 可选：决策理由（最多 500 字符）
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
  sortinoRatio: number;  // 索提诺比率（只惩罚下行波动）
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

// ============================================
// nof1.ai API 数据结构（完全匹配）
// ============================================

/**
 * /api/crypto-prices 响应格式
 */
export interface CryptoPricesResponse {
  prices: {
    [symbol: string]: {
      symbol: string;
      price: number;
      timestamp: number;
    };
  };
  serverTime: number;
}

/**
 * /api/trades 响应格式 - 单个交易记录
 */
export interface TradeRecord {
  id: string;                          // model_id + UUID
  trade_id: string;                    // 复合ID（包含时间戳和币种）
  symbol: string;                      // 交易对（XRP, SOL, ETH, BTC, DOGE, BNB）
  side: 'long' | 'short';
  trade_type: 'long' | 'short';
  model_id: string;                    // 模型ID
  quantity: number;                    // 交易数量（负数表示空头）
  entry_price: number;
  exit_price: number;
  entry_sz: number;
  exit_sz: number;
  entry_time: number;                  // Unix 时间戳
  exit_time: number;
  entry_human_time: string;
  exit_human_time: string;
  entry_oid: number;
  exit_oid: number;
  entry_tid: number;
  exit_tid: number;
  entry_crossed: boolean;
  exit_crossed: boolean;
  leverage: number;
  confidence: number;
  entry_commission_dollars: number;
  exit_commission_dollars: number;
  total_commission_dollars: number;
  entry_closed_pnl: number;
  exit_closed_pnl: number;
  realized_gross_pnl: number;          // 税前收益
  realized_net_pnl: number;            // 税后收益
  entry_liquidation: null | any;
  exit_liquidation: null | any;
  exit_plan: {
    profit_target?: number;
    stop_loss?: number;
    invalidation_condition?: string;
  };
}

/**
 * /api/trades 响应格式
 */
export interface TradesResponse {
  trades: TradeRecord[];
}

/**
 * /api/account-totals 响应格式 - 单个账户快照
 */
export interface AccountSnapshot {
  id: string;
  timestamp: number;
  realized_pnl: number;
  positions: {
    [symbol: string]: {
      entry_oid: number;
      risk_usd: number;
      confidence: number;
      index_col: null | number;
      exit_plan: {
        profit_target: number;
        stop_loss: number;
        invalidation_condition: string;
      };
      entry_time: number;
      symbol: string;
      entry_price: number;
      tp_oid: number;
      margin: number;
      wait_for_fill: boolean;
      sl_oid: number;
      oid: number;
      current_price: number;
      closed_pnl: number;
      liquidation_price: number;
      commission: number;
      leverage: number;
      slippage: number;
      quantity: number;
      unrealized_pnl: number;
    };
  };
  since_inception_minute_marker: number;
  sharpe_ratio: number | null;
  cum_pnl_pct: number;                    // 累计收益百分比
  total_unrealized_pnl: number;
  model_id: string;
  since_inception_hourly_marker: number;
  dollar_equity: number;                   // 账户总价值
}

/**
 * /api/account-totals 响应格式
 */
export interface AccountTotalsResponse {
  accountTotals: AccountSnapshot[];
}

/**
 * /api/since-inception-values 响应格式
 */
export interface SinceInceptionValuesResponse {
  values: {
    [model_id: string]: {
      timestamp: number;
      equity: number;
    }[];
  };
}
