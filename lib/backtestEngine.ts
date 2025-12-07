/**
 * 回测引擎
 * 使用历史数据模拟交易执行，评估策略表现
 */

import { Coin } from '@/types/trading';
import { CandleStick, calculateAllIndicators } from './indicators';
import { TradingLimits, calculateTradingLimits } from './tradingConfig';

export interface BacktestConfig {
  initialBalance: number; // 初始资金
  maxLeverage: number; // 最大杠杆
  tradingInterval: number; // 交易周期（秒）
  coins: Coin[]; // 交易币种
  startTime: number; // 回测开始时间
  endTime: number; // 回测结束时间
}

export interface BacktestTrade {
  id: number;
  coin: Coin;
  side: 'LONG' | 'SHORT';
  entryTime: number;
  entryPrice: number;
  exitTime: number | null;
  exitPrice: number | null;
  size: number; // USD
  leverage: number;
  pnl: number; // 盈亏（USD）
  pnlPercent: number; // 盈亏百分比
  status: 'open' | 'closed';
  exitReason?: 'ai_decision' | 'stop_loss' | 'take_profit';
}

export interface BacktestResult {
  config: BacktestConfig;

  // 总体统计
  initialBalance: number;
  finalBalance: number;
  totalPnL: number;
  totalPnLPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;

  // 交易统计
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number; // 盈利因子（总盈利/总亏损）

  // 时间统计
  avgHoldingTime: number; // 平均持仓时间（秒）
  maxHoldingTime: number;
  minHoldingTime: number;

  // 详细记录
  trades: BacktestTrade[];
  equityCurve: Array<{ timestamp: number; balance: number }>; // 资金曲线
  dailyReturns: Array<{ date: string; return: number }>; // 每日收益

  // 性能指标
  sharpeRatio: number; // 夏普比率
  maxConsecutiveWins: number; // 最大连胜
  maxConsecutiveLosses: number; // 最大连亏

  // 执行时间
  executionTimeMs: number;
}

/**
 * 回测引擎
 */
export class BacktestEngine {
  private config: BacktestConfig;
  private balance: number;
  private trades: BacktestTrade[] = [];
  private openPositions: Map<Coin, BacktestTrade> = new Map();
  private equityCurve: Array<{ timestamp: number; balance: number }> = [];
  private tradeIdCounter = 0;
  private peakBalance = 0;
  private maxDrawdown = 0;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.balance = config.initialBalance;
    this.peakBalance = config.initialBalance;
  }

  /**
   * 执行回测
   */
  async run(
    historicalData: Map<Coin, CandleStick[]>,
    aiDecisionFn: (marketData: any, balance: number) => Promise<any>
  ): Promise<BacktestResult> {
    const startTime = Date.now();

    console.log('[Backtest] 🚀 开始回测...');
    console.log(`[Backtest] 初始资金: $${this.config.initialBalance}`);
    console.log(`[Backtest] 时间范围: ${new Date(this.config.startTime).toISOString()} - ${new Date(this.config.endTime).toISOString()}`);

    // 获取所有时间戳（合并所有币种的K线时间）
    const allTimestamps = new Set<number>();
    for (const candles of historicalData.values()) {
      candles.forEach(c => allTimestamps.add(c.timestamp));
    }
    const timestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    console.log(`[Backtest] 总共 ${timestamps.length} 个时间点`);

    // 遍历每个时间点
    for (let i = 0; i < timestamps.length; i++) {
      const currentTime = timestamps[i];

      // 跳过不在回测范围内的时间
      if (currentTime < this.config.startTime || currentTime > this.config.endTime) {
        continue;
      }

      // 检查是否到达交易周期
      const timeSinceLastTrade = this.trades.length > 0
        ? currentTime - this.trades[this.trades.length - 1].entryTime
        : this.config.tradingInterval * 1000 + 1;

      if (timeSinceLastTrade < this.config.tradingInterval * 1000) {
        continue; // 还没到下一个交易周期
      }

      // 准备市场数据
      const marketData: any = {};
      for (const coin of this.config.coins) {
        const candles = historicalData.get(coin);
        if (!candles) continue;

        // 获取当前时间点之前的所有K线（用于计算指标）
        const historicalCandles = candles.filter(c => c.timestamp <= currentTime);
        if (historicalCandles.length < 20) continue; // 至少需要20根K线

        // 计算技术指标
        const indicators = calculateAllIndicators(historicalCandles);
        const latestCandle = historicalCandles[historicalCandles.length - 1];

        marketData[coin] = {
          candles: historicalCandles,
          indicators,
          currentPrice: latestCandle.close,
        };
      }

      // 调用AI做决策
      try {
        const decisions = await aiDecisionFn(marketData, this.balance);

        // 执行交易决策
        for (const decision of decisions) {
          this.executeDecision(decision, currentTime, marketData[decision.coin].currentPrice);
        }
      } catch (error) {
        console.error(`[Backtest] ❌ AI决策失败:`, error);
      }

      // 更新持仓盈亏
      this.updateOpenPositions(marketData);

      // 记录资金曲线
      this.equityCurve.push({
        timestamp: currentTime,
        balance: this.getTotalEquity(marketData),
      });

      // 更新最大回撤
      const currentEquity = this.getTotalEquity(marketData);
      if (currentEquity > this.peakBalance) {
        this.peakBalance = currentEquity;
      }
      const drawdown = this.peakBalance - currentEquity;
      if (drawdown > this.maxDrawdown) {
        this.maxDrawdown = drawdown;
      }

      // 进度日志
      if (i % 100 === 0) {
        console.log(`[Backtest] 进度: ${((i / timestamps.length) * 100).toFixed(1)}% | 余额: $${this.balance.toFixed(2)} | 交易次数: ${this.trades.length}`);
      }
    }

    // 关闭所有未平仓位
    this.closeAllPositions(timestamps[timestamps.length - 1], historicalData);

    const executionTimeMs = Date.now() - startTime;
    console.log(`[Backtest] ✅ 回测完成！耗时 ${(executionTimeMs / 1000).toFixed(2)}秒`);

    // 生成结果
    return this.generateResult(executionTimeMs);
  }

  /**
   * 执行交易决策
   */
  private executeDecision(decision: any, currentTime: number, currentPrice: number) {
    const { coin, action, leverage = 2, notional = 0 } = decision;

    // 计算交易限制
    const limits = calculateTradingLimits(this.balance);

    // 如果已有持仓
    const existingPosition = this.openPositions.get(coin);

    if (action === 'close' && existingPosition) {
      // 平仓
      this.closePosition(existingPosition, currentTime, currentPrice, 'ai_decision');
      return;
    }

    if ((action === 'buy_to_enter' || action === 'sell_to_enter') && !existingPosition) {
      // 开仓
      const side = action === 'buy_to_enter' ? 'LONG' : 'SHORT';
      const adjustedSize = Math.min(notional, limits.maxPositionSize);

      if (adjustedSize < limits.minOrderSize[coin]) {
        return; // 订单太小，跳过
      }

      const trade: BacktestTrade = {
        id: ++this.tradeIdCounter,
        coin,
        side,
        entryTime: currentTime,
        entryPrice: currentPrice,
        exitTime: null,
        exitPrice: null,
        size: adjustedSize,
        leverage,
        pnl: 0,
        pnlPercent: 0,
        status: 'open',
      };

      this.openPositions.set(coin, trade);
      this.trades.push(trade);
      this.balance -= adjustedSize; // 扣除保证金（假设全仓保证金 = size / leverage，但为了简化直接用size）

      console.log(`[Backtest] 📈 开仓: ${coin} ${side} $${adjustedSize.toFixed(2)} @ $${currentPrice.toFixed(2)}`);
    }
  }

  /**
   * 更新未平仓盈亏
   */
  private updateOpenPositions(marketData: any) {
    for (const [coin, trade] of this.openPositions.entries()) {
      const currentPrice = marketData[coin]?.currentPrice;
      if (!currentPrice) continue;

      const priceChange = (currentPrice - trade.entryPrice) / trade.entryPrice;
      const directionMultiplier = trade.side === 'LONG' ? 1 : -1;
      trade.pnl = trade.size * priceChange * directionMultiplier * trade.leverage;
      trade.pnlPercent = priceChange * directionMultiplier * trade.leverage * 100;
    }
  }

  /**
   * 平仓
   */
  private closePosition(trade: BacktestTrade, exitTime: number, exitPrice: number, reason: 'ai_decision' | 'stop_loss' | 'take_profit') {
    trade.exitTime = exitTime;
    trade.exitPrice = exitPrice;
    trade.status = 'closed';
    trade.exitReason = reason;

    const priceChange = (exitPrice - trade.entryPrice) / trade.entryPrice;
    const directionMultiplier = trade.side === 'LONG' ? 1 : -1;
    trade.pnl = trade.size * priceChange * directionMultiplier * trade.leverage;
    trade.pnlPercent = priceChange * directionMultiplier * trade.leverage * 100;

    this.balance += trade.size + trade.pnl; // 归还保证金 + 盈亏
    this.openPositions.delete(trade.coin);

    console.log(`[Backtest] 📉 平仓: ${trade.coin} ${trade.side} | PnL: $${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);
  }

  /**
   * 关闭所有持仓
   */
  private closeAllPositions(finalTime: number, historicalData: Map<Coin, CandleStick[]>) {
    for (const trade of this.openPositions.values()) {
      const candles = historicalData.get(trade.coin);
      if (!candles) continue;

      const lastCandle = candles[candles.length - 1];
      this.closePosition(trade, finalTime, lastCandle.close, 'ai_decision');
    }
  }

  /**
   * 获取总权益（余额 + 未平仓盈亏）
   */
  private getTotalEquity(marketData: any): number {
    let equity = this.balance;
    for (const trade of this.openPositions.values()) {
      equity += trade.pnl;
    }
    return equity;
  }

  /**
   * 生成回测结果
   */
  private generateResult(executionTimeMs: number): BacktestResult {
    const closedTrades = this.trades.filter(t => t.status === 'closed');

    const totalPnL = this.balance - this.config.initialBalance;
    const totalPnLPercent = (totalPnL / this.config.initialBalance) * 100;

    const winningTrades = closedTrades.filter(t => t.pnl > 0);
    const losingTrades = closedTrades.filter(t => t.pnl < 0);

    const totalWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

    const holdingTimes = closedTrades
      .filter(t => t.exitTime !== null)
      .map(t => (t.exitTime! - t.entryTime) / 1000);

    // 计算连胜/连亏
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;

    for (const trade of closedTrades) {
      if (trade.pnl > 0) {
        consecutiveWins++;
        consecutiveLosses = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
      } else {
        consecutiveLosses++;
        consecutiveWins = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
      }
    }

    // 计算夏普比率（简化版：假设无风险利率为0）
    const dailyReturnsValues = this.calculateDailyReturns();
    const avgDailyReturn = dailyReturnsValues.reduce((sum, r) => sum + r.return, 0) / dailyReturnsValues.length;
    const stdDev = Math.sqrt(
      dailyReturnsValues.reduce((sum, r) => sum + Math.pow(r.return - avgDailyReturn, 2), 0) / dailyReturnsValues.length
    );
    const sharpeRatio = stdDev > 0 ? (avgDailyReturn / stdDev) * Math.sqrt(365) : 0;

    return {
      config: this.config,
      initialBalance: this.config.initialBalance,
      finalBalance: this.balance,
      totalPnL,
      totalPnLPercent,
      maxDrawdown: this.maxDrawdown,
      maxDrawdownPercent: (this.maxDrawdown / this.peakBalance) * 100,
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      averageWin: winningTrades.length > 0 ? totalWin / winningTrades.length : 0,
      averageLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
      profitFactor: totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0,
      avgHoldingTime: holdingTimes.length > 0 ? holdingTimes.reduce((sum, t) => sum + t, 0) / holdingTimes.length : 0,
      maxHoldingTime: holdingTimes.length > 0 ? Math.max(...holdingTimes) : 0,
      minHoldingTime: holdingTimes.length > 0 ? Math.min(...holdingTimes) : 0,
      trades: this.trades,
      equityCurve: this.equityCurve,
      dailyReturns: dailyReturnsValues,
      sharpeRatio,
      maxConsecutiveWins,
      maxConsecutiveLosses,
      executionTimeMs,
    };
  }

  /**
   * 计算每日收益
   */
  private calculateDailyReturns(): Array<{ date: string; return: number }> {
    const dailyReturns: Array<{ date: string; return: number }> = [];
    const dailyBalances = new Map<string, number[]>();

    for (const point of this.equityCurve) {
      const date = new Date(point.timestamp).toISOString().split('T')[0];
      if (!dailyBalances.has(date)) {
        dailyBalances.set(date, []);
      }
      dailyBalances.get(date)!.push(point.balance);
    }

    const dates = Array.from(dailyBalances.keys()).sort();
    for (let i = 1; i < dates.length; i++) {
      const prevDate = dates[i - 1];
      const currentDate = dates[i];

      const prevBalances = dailyBalances.get(prevDate)!;
      const currentBalances = dailyBalances.get(currentDate)!;

      const prevBalance = prevBalances[prevBalances.length - 1];
      const currentBalance = currentBalances[currentBalances.length - 1];

      const dailyReturn = ((currentBalance - prevBalance) / prevBalance) * 100;

      dailyReturns.push({
        date: currentDate,
        return: dailyReturn,
      });
    }

    return dailyReturns;
  }
}
