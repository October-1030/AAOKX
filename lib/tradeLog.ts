/**
 * 交易记录管理器（TradeLog）
 * 管理交易记录、每日盈亏、净值曲线数据
 *
 * NOTE: 当前使用内存存储 + 可选 JSON 文件持久化
 * 未来可替换为数据库存储（Prisma/PostgreSQL）
 */

import { Coin } from '@/types/trading';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// 核心类型定义
// ============================================

/**
 * 交易状态
 */
export type TradeStatus =
  | 'open'        // 持仓中
  | 'closed'      // 正常平仓
  | 'stopped'     // 止损平仓
  | 'tp_hit'      // 止盈平仓
  | 'liquidated'; // 被清算

/**
 * 交易记录
 */
export interface TradeRecord {
  id: string;                    // 唯一ID
  symbol: Coin;                  // 交易品种
  side: 'long' | 'short';        // 方向
  notional: number;              // 名义价值（USD）
  leverage: number;              // 杠杆倍数
  entryPrice: number;            // 入场价格
  exitPrice?: number;            // 出场价格
  stopLoss?: number;             // 止损价格
  takeProfit?: number;           // 止盈价格
  openedAt: number;              // 开仓时间戳
  closedAt?: number;             // 平仓时间戳
  realizedPnl?: number;          // 已实现盈亏（USD）
  realizedPnlPercent?: number;   // 已实现盈亏百分比
  fees?: number;                 // 手续费
  status: TradeStatus;           // 交易状态

  // AI 解释字段
  aiReason?: string;             // 开仓/平仓原因
  marketContext?: string;        // 市场结构判断
  riskNote?: string;             // 风险提示

  // 附加信息
  modelName?: string;            // AI 模型名称
  confidence?: number;           // AI 置信度
}

/**
 * 每日盈亏记录
 */
export interface DailyPnlRecord {
  date: string;                  // 日期 YYYY-MM-DD
  realizedPnl: number;           // 当日已实现盈亏
  unrealizedPnl?: number;        // 当日未实现盈亏
  fees: number;                  // 当日手续费
  tradesCount: number;           // 当日交易次数
  winCount: number;              // 盈利交易次数
  lossCount: number;             // 亏损交易次数
  equity: number;                // 当日收盘净值
  drawdown?: number;             // 当日最大回撤
}

/**
 * 净值曲线点
 */
export interface EquityPoint {
  timestamp: number;             // 时间戳
  equity: number;                // 净值
  drawdown?: number;             // 回撤百分比
  highWaterMark?: number;        // 历史最高净值
}

/**
 * 交易统计摘要
 */
export interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio?: number;
}

// ============================================
// TradeLog 管理器
// ============================================

class TradeLogManager {
  private trades: Map<string, TradeRecord> = new Map();
  private dailyPnl: Map<string, DailyPnlRecord> = new Map();
  private equityCurve: EquityPoint[] = [];
  private initialCapital: number = 1000; // 默认初始资金
  private currentEquity: number = 1000;
  private highWaterMark: number = 1000;

  // JSON 文件存储路径（可选）
  private dataDir: string = './data/tradeLog';
  private persistEnabled: boolean = false;

  constructor() {
    console.log('[TradeLog] 初始化交易记录管理器');
    this.loadFromFile();
  }

  /**
   * 设置初始资金
   */
  setInitialCapital(capital: number): void {
    this.initialCapital = capital;
    this.currentEquity = capital;
    this.highWaterMark = capital;
    console.log(`[TradeLog] 设置初始资金: $${capital}`);
  }

  /**
   * 更新当前净值
   */
  updateEquity(equity: number): void {
    this.currentEquity = equity;
    if (equity > this.highWaterMark) {
      this.highWaterMark = equity;
    }

    // 记录净值曲线点
    const point: EquityPoint = {
      timestamp: Date.now(),
      equity,
      highWaterMark: this.highWaterMark,
      drawdown: this.highWaterMark > 0
        ? ((this.highWaterMark - equity) / this.highWaterMark) * 100
        : 0,
    };

    this.equityCurve.push(point);

    // 保持最近 30 天的数据（约 4320 个点，按 10 分钟间隔）
    if (this.equityCurve.length > 5000) {
      this.equityCurve = this.equityCurve.slice(-5000);
    }
  }

  // ============================================
  // 交易记录 CRUD
  // ============================================

  /**
   * 添加开仓记录
   */
  addOpenTrade(record: Omit<TradeRecord, 'id' | 'status'>): TradeRecord {
    const id = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const trade: TradeRecord = {
      ...record,
      id,
      status: 'open',
    };

    this.trades.set(id, trade);

    console.log(`[TradeLog] 记录开仓: ${trade.symbol} ${trade.side.toUpperCase()}`);
    console.log(`   ID: ${id}`);
    console.log(`   价格: $${trade.entryPrice}`);
    console.log(`   金额: $${trade.notional}`);
    console.log(`   止损: $${trade.stopLoss || 'N/A'}`);
    console.log(`   止盈: $${trade.takeProfit || 'N/A'}`);
    if (trade.aiReason) {
      console.log(`   AI原因: ${trade.aiReason}`);
    }

    this.saveToFile();
    return trade;
  }

  /**
   * 关闭交易（平仓）
   */
  closeTrade(
    tradeId: string,
    exitPrice: number,
    status: TradeStatus = 'closed',
    reason?: string
  ): TradeRecord | null {
    const trade = this.trades.get(tradeId);
    if (!trade) {
      console.warn(`[TradeLog] 交易不存在: ${tradeId}`);
      return null;
    }

    if (trade.status !== 'open') {
      console.warn(`[TradeLog] 交易已关闭: ${tradeId}`);
      return trade;
    }

    const closedAt = Date.now();

    // 计算盈亏
    const priceDiff = trade.side === 'long'
      ? exitPrice - trade.entryPrice
      : trade.entryPrice - exitPrice;

    const pnlPercent = (priceDiff / trade.entryPrice) * 100;
    const realizedPnl = (pnlPercent / 100) * trade.notional * trade.leverage;

    // 更新交易记录
    trade.exitPrice = exitPrice;
    trade.closedAt = closedAt;
    trade.realizedPnl = realizedPnl;
    trade.realizedPnlPercent = pnlPercent * trade.leverage;
    trade.status = status;

    if (reason) {
      trade.aiReason = reason;
    }

    this.trades.set(tradeId, trade);

    // 更新每日盈亏
    this.updateDailyPnl(realizedPnl, realizedPnl > 0);

    console.log(`[TradeLog] 记录平仓: ${trade.symbol}`);
    console.log(`   状态: ${status}`);
    console.log(`   出场价: $${exitPrice}`);
    console.log(`   盈亏: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toFixed(2)} (${pnlPercent >= 0 ? '+' : ''}${(pnlPercent * trade.leverage).toFixed(2)}%)`);

    this.saveToFile();
    return trade;
  }

  /**
   * 根据品种关闭交易
   */
  closeTradeBySymbol(
    symbol: Coin,
    exitPrice: number,
    status: TradeStatus = 'closed',
    reason?: string
  ): TradeRecord | null {
    // 找到该品种的 open 交易
    const openTrade = Array.from(this.trades.values()).find(
      t => t.symbol === symbol && t.status === 'open'
    );

    if (!openTrade) {
      console.warn(`[TradeLog] 未找到 ${symbol} 的开放交易`);
      return null;
    }

    return this.closeTrade(openTrade.id, exitPrice, status, reason);
  }

  /**
   * 获取某品种的开放交易
   */
  getOpenTradeBySymbol(symbol: Coin): TradeRecord | null {
    return Array.from(this.trades.values()).find(
      t => t.symbol === symbol && t.status === 'open'
    ) || null;
  }

  /**
   * 获取所有开放交易
   */
  getOpenTrades(): TradeRecord[] {
    return Array.from(this.trades.values()).filter(t => t.status === 'open');
  }

  /**
   * 获取所有交易记录
   */
  getAllTrades(limit?: number): TradeRecord[] {
    const trades = Array.from(this.trades.values())
      .sort((a, b) => b.openedAt - a.openedAt);

    return limit ? trades.slice(0, limit) : trades;
  }

  /**
   * 获取已关闭的交易
   */
  getClosedTrades(limit?: number): TradeRecord[] {
    const trades = Array.from(this.trades.values())
      .filter(t => t.status !== 'open')
      .sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));

    return limit ? trades.slice(0, limit) : trades;
  }

  // ============================================
  // 每日盈亏管理
  // ============================================

  /**
   * 更新每日盈亏
   */
  private updateDailyPnl(pnl: number, isWin: boolean): void {
    const today = new Date().toISOString().split('T')[0];

    let record = this.dailyPnl.get(today);
    if (!record) {
      record = {
        date: today,
        realizedPnl: 0,
        fees: 0,
        tradesCount: 0,
        winCount: 0,
        lossCount: 0,
        equity: this.currentEquity,
      };
    }

    record.realizedPnl += pnl;
    record.tradesCount += 1;
    if (isWin) {
      record.winCount += 1;
    } else {
      record.lossCount += 1;
    }
    record.equity = this.currentEquity + pnl;

    this.dailyPnl.set(today, record);
  }

  /**
   * 获取每日盈亏记录
   */
  getDailyPnl(days: number = 30): DailyPnlRecord[] {
    return Array.from(this.dailyPnl.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, days);
  }

  /**
   * 获取今日盈亏
   */
  getTodayPnl(): DailyPnlRecord | null {
    const today = new Date().toISOString().split('T')[0];
    return this.dailyPnl.get(today) || null;
  }

  // ============================================
  // 净值曲线
  // ============================================

  /**
   * 获取净值曲线
   */
  getEquityCurve(points?: number): EquityPoint[] {
    if (points && this.equityCurve.length > points) {
      return this.equityCurve.slice(-points);
    }
    return [...this.equityCurve];
  }

  /**
   * 获取当前净值
   */
  getCurrentEquity(): number {
    return this.currentEquity;
  }

  /**
   * 获取历史最高净值
   */
  getHighWaterMark(): number {
    return this.highWaterMark;
  }

  /**
   * 获取当前回撤
   */
  getCurrentDrawdown(): number {
    if (this.highWaterMark <= 0) return 0;
    return ((this.highWaterMark - this.currentEquity) / this.highWaterMark) * 100;
  }

  // ============================================
  // 统计分析
  // ============================================

  /**
   * 获取交易统计
   */
  getTradeStats(): TradeStats {
    const closedTrades = this.getClosedTrades();

    const winningTrades = closedTrades.filter(t => (t.realizedPnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.realizedPnl || 0) < 0);

    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0));

    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

    // 计算最大回撤
    let maxDrawdown = 0;
    let peak = this.initialCapital;
    let runningEquity = this.initialCapital;

    for (const trade of closedTrades.sort((a, b) => (a.closedAt || 0) - (b.closedAt || 0))) {
      runningEquity += trade.realizedPnl || 0;
      if (runningEquity > peak) {
        peak = runningEquity;
      }
      const drawdown = ((peak - runningEquity) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      totalPnl,
      avgWin,
      avgLoss,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
      maxDrawdown,
    };
  }

  // ============================================
  // 持久化（可选）
  // ============================================

  /**
   * 启用文件持久化
   */
  enablePersistence(dataDir?: string): void {
    if (dataDir) {
      this.dataDir = dataDir;
    }
    this.persistEnabled = true;

    // 确保目录存在
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      console.log(`[TradeLog] 启用文件持久化: ${this.dataDir}`);
    } catch (error) {
      console.warn('[TradeLog] 无法创建数据目录，禁用持久化:', error);
      this.persistEnabled = false;
    }
  }

  /**
   * 保存到文件
   */
  private saveToFile(): void {
    if (!this.persistEnabled) return;

    try {
      const data = {
        trades: Array.from(this.trades.entries()),
        dailyPnl: Array.from(this.dailyPnl.entries()),
        equityCurve: this.equityCurve.slice(-1000), // 只保存最近 1000 点
        initialCapital: this.initialCapital,
        currentEquity: this.currentEquity,
        highWaterMark: this.highWaterMark,
        savedAt: Date.now(),
      };

      const filePath = path.join(this.dataDir, 'tradeLog.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[TradeLog] 保存文件失败:', error);
    }
  }

  /**
   * 从文件加载
   */
  private loadFromFile(): void {
    try {
      const filePath = path.join(this.dataDir, 'tradeLog.json');
      if (!fs.existsSync(filePath)) {
        return;
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      this.trades = new Map(data.trades || []);
      this.dailyPnl = new Map(data.dailyPnl || []);
      this.equityCurve = data.equityCurve || [];
      this.initialCapital = data.initialCapital || 1000;
      this.currentEquity = data.currentEquity || 1000;
      this.highWaterMark = data.highWaterMark || 1000;

      console.log(`[TradeLog] 从文件加载: ${this.trades.size} 笔交易`);
    } catch (error) {
      console.warn('[TradeLog] 加载文件失败，使用空数据:', error);
    }
  }

  /**
   * 清除所有数据（谨慎使用）
   */
  clearAll(): void {
    this.trades.clear();
    this.dailyPnl.clear();
    this.equityCurve = [];
    this.currentEquity = this.initialCapital;
    this.highWaterMark = this.initialCapital;
    this.saveToFile();
    console.log('[TradeLog] 已清除所有数据');
  }
}

// ============================================
// 导出单例
// ============================================

let tradeLogInstance: TradeLogManager | null = null;

export function getTradeLog(): TradeLogManager {
  if (!tradeLogInstance) {
    tradeLogInstance = new TradeLogManager();
  }
  return tradeLogInstance;
}

export { TradeLogManager };
