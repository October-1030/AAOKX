/**
 * 回测引擎
 * 借鉴 Nautilus Trader 的回测理念，用历史数据模拟交易
 */

import { AIModel } from '../aiModels';
import { Coin, Position, TradingDecision, AccountStatus, CompletedTrade } from '@/types/trading';
import { Candle, HistoricalDataSet } from './historicalData';
import { generateNOF1SystemPrompt, generateNOF1UserPrompt, parseNOF1Response } from '../tradingPromptNOF1';
import { validateTradingDecision } from '../tradingEngine';
import { getRiskManager } from '../riskManagement';

const INITIAL_CAPITAL = 1000;
const MAKER_FEE = -0.0002;
const TAKER_FEE = 0.00055;

export interface BacktestConfig {
  initialCapital: number;
  startDate: Date;
  endDate: Date;
  interval: string;        // K线间隔
  enableRiskManagement: boolean;
}

export interface BacktestResult {
  model: string;
  config: BacktestConfig;

  // 性能指标
  totalReturn: number;          // 总回报率 (%)
  totalReturnDollar: number;    // 总回报 ($)
  finalEquity: number;          // 最终权益

  // 交易统计
  totalTrades: number;          // 总交易数
  winningTrades: number;        // 盈利交易数
  losingTrades: number;         // 亏损交易数
  winRate: number;              // 胜率 (%)

  // 风险指标
  sharpeRatio: number;          // 夏普比率
  sortinoRatio: number;         // 索提诺比率
  maxDrawdown: number;          // 最大回撤 (%)
  maxDrawdownDollar: number;    // 最大回撤 ($)

  // 盈亏分析
  avgWin: number;               // 平均盈利
  avgLoss: number;              // 平均亏损
  profitFactor: number;         // 盈利因子（总盈利/总亏损）

  // 详细数据
  trades: CompletedTrade[];     // 所有交易记录
  equityHistory: { timestamp: number; equity: number }[];  // 权益曲线

  // 执行统计
  totalBars: number;            // 总K线数
  executionTime: number;        // 执行时间（毫秒）
}

/**
 * 回测引擎类
 */
export class BacktestEngine {
  private riskManager = getRiskManager();

  /**
   * 运行回测
   * @param model AI模型
   * @param historicalData 历史数据集
   * @param config 回测配置
   */
  async runBacktest(
    model: AIModel,
    historicalData: HistoricalDataSet[],
    config: Partial<BacktestConfig> = {}
  ): Promise<BacktestResult> {
    const startTime = Date.now();

    console.log('\n' + '='.repeat(60));
    console.log(`🔬 开始回测: ${model.displayName}`);
    console.log('='.repeat(60));

    // 合并配置
    const fullConfig: BacktestConfig = {
      initialCapital: config.initialCapital || INITIAL_CAPITAL,
      startDate: config.startDate || new Date(0),
      endDate: config.endDate || new Date(),
      interval: config.interval || '1h',
      enableRiskManagement: config.enableRiskManagement !== undefined ? config.enableRiskManagement : true,
    };

    // 初始化账户
    const account: AccountStatus = {
      tradingDuration: 0,
      totalCalls: 0,
      totalReturn: 0,
      availableCash: fullConfig.initialCapital,
      totalEquity: fullConfig.initialCapital,
      positions: [],
    };

    const completedTrades: CompletedTrade[] = [];
    const equityHistory: { timestamp: number; equity: number }[] = [];

    // 获取主要币种的K线数据（用于时间轴）
    const mainDataSet = historicalData[0];
    if (!mainDataSet || mainDataSet.candles.length === 0) {
      throw new Error('历史数据为空');
    }

    console.log(`📊 回测数据:`);
    console.log(`   币种: ${historicalData.map(d => d.coin).join(', ')}`);
    console.log(`   K线数量: ${mainDataSet.candles.length}`);
    console.log(`   时间范围: ${new Date(mainDataSet.candles[0].timestamp).toLocaleString()} ~ ${new Date(mainDataSet.candles[mainDataSet.candles.length - 1].timestamp).toLocaleString()}`);
    console.log(`   初始资金: $${fullConfig.initialCapital}`);
    console.log(`   风险管理: ${fullConfig.enableRiskManagement ? '启用' : '禁用'}`);
    console.log('');

    // 构建价格查询表（每个时间点的每个币种价格）
    const priceData = this.buildPriceData(historicalData);

    // 遍历每个时间点
    let barCount = 0;
    for (const candle of mainDataSet.candles) {
      barCount++;
      const timestamp = candle.timestamp;

      // 每100个K线输出一次进度
      if (barCount % 100 === 0) {
        console.log(`[${barCount}/${mainDataSet.candles.length}] ${new Date(timestamp).toLocaleString()} - 权益: $${account.totalEquity.toFixed(2)}`);
      }

      // 更新所有持仓的当前价格
      this.updatePositions(account, timestamp, priceData);

      // 检查止损/止盈
      this.checkExitConditions(account, completedTrades, timestamp, priceData, model.displayName);

      // 每隔N个K线调用一次AI决策（模拟真实交易间隔）
      if (barCount % 3 === 0) {  // 每3个小时决策一次
        try {
          await this.executeAIDecision(
            model,
            account,
            completedTrades,
            timestamp,
            priceData,
            fullConfig.enableRiskManagement
          );
        } catch (error) {
          console.error(`[Backtest] AI决策失败:`, error);
        }
      }

      // 记录权益曲线
      const currentEquity = this.calculateTotalEquity(account, timestamp, priceData);
      equityHistory.push({ timestamp, equity: currentEquity });
      account.totalEquity = currentEquity;
      account.totalReturn = ((currentEquity - fullConfig.initialCapital) / fullConfig.initialCapital) * 100;
    }

    // 平掉所有剩余持仓
    console.log(`\n[Backtest] 回测结束，平掉剩余 ${account.positions.length} 个持仓`);
    for (const position of [...account.positions]) {
      const lastTimestamp = mainDataSet.candles[mainDataSet.candles.length - 1].timestamp;
      const exitPrice = priceData[position.coin][lastTimestamp] || position.currentPrice;
      this.closePosition(account, completedTrades, position, exitPrice, 'Backtest End', model.displayName, lastTimestamp);
    }

    const executionTime = Date.now() - startTime;

    // 计算性能指标
    const result = this.calculateMetrics(
      model.displayName,
      fullConfig,
      account,
      completedTrades,
      equityHistory,
      mainDataSet.candles.length,
      executionTime
    );

    // 输出结果摘要
    this.printSummary(result);

    return result;
  }

  /**
   * 构建价格查询表
   */
  private buildPriceData(historicalData: HistoricalDataSet[]): Record<Coin, Record<number, number>> {
    const priceData: Record<string, Record<number, number>> = {};

    for (const dataset of historicalData) {
      priceData[dataset.coin] = {};
      for (const candle of dataset.candles) {
        priceData[dataset.coin][candle.timestamp] = candle.close;
      }
    }

    return priceData as Record<Coin, Record<number, number>>;
  }

  /**
   * 执行AI决策
   */
  private async executeAIDecision(
    model: AIModel,
    account: AccountStatus,
    completedTrades: CompletedTrade[],
    timestamp: number,
    priceData: Record<Coin, Record<number, number>>,
    enableRiskManagement: boolean
  ) {
    // 构建市场数据（简化版）
    const marketData = this.buildMarketData(timestamp, priceData);

    // 生成Prompt
    const systemPrompt = generateNOF1SystemPrompt(model.strategy);
    const userPrompt = generateNOF1UserPrompt(account, marketData);

    // 调用AI
    const rawResponse = await model.callAPI(systemPrompt, userPrompt);
    const { decisions } = parseNOF1Response(rawResponse);

    // 执行决策
    for (const decision of decisions) {
      if (decision.action === 'buy_to_enter' || decision.action === 'sell_to_enter') {
        // 风险检查
        if (enableRiskManagement) {
          const riskCheck = await this.riskManager.validateTrade(model.displayName, decision, account);
          if (!riskCheck.allowed) {
            continue; // 跳过被拒绝的交易
          }
        }

        const side = decision.action === 'buy_to_enter' ? 'LONG' : 'SHORT';
        const currentPrice = priceData[decision.coin][timestamp];

        if (!currentPrice) continue;

        // 验证决策合理性
        const validation = validateTradingDecision(decision, currentPrice, side);
        if (!validation.valid) continue;

        // 执行开仓
        this.executeBuy(account, decision, side, currentPrice, timestamp);
      } else if (decision.action === 'close') {
        const position = account.positions.find(p => p.coin === decision.coin);
        if (position) {
          const exitPrice = priceData[decision.coin][timestamp];
          if (exitPrice) {
            this.closePosition(account, completedTrades, position, exitPrice, 'AI Close', model.displayName, timestamp);
          }
        }
      }
    }
  }

  /**
   * 构建市场数据（简化版）
   */
  private buildMarketData(timestamp: number, priceData: Record<Coin, Record<number, number>>) {
    const coins = Object.keys(priceData) as Coin[];
    const marketData: any = {};

    for (const coin of coins) {
      const price = priceData[coin][timestamp];
      if (price) {
        marketData[coin] = {
          price,
          change24h: 0, // 简化处理
          ema20: price,
          ema50: price,
          ema200: price,
          macd: { value: 0, signal: 0, histogram: 0 },
          rsi: 50,
          atr: price * 0.02,
          volume: 1000000,
        };
      }
    }

    return marketData;
  }

  /**
   * 执行买入
   */
  private executeBuy(
    account: AccountStatus,
    decision: TradingDecision,
    side: 'LONG' | 'SHORT',
    currentPrice: number,
    timestamp: number
  ) {
    if (!decision.notional) return;

    const leverage = decision.leverage || 10;
    const requiredMargin = decision.notional / leverage;

    if (requiredMargin > account.availableCash * 0.95) return;

    const fee = decision.notional * TAKER_FEE;

    const position: Position = {
      id: `${decision.coin}-${timestamp}`,
      coin: decision.coin,
      side,
      leverage,
      notional: decision.notional,
      entryPrice: currentPrice,
      currentPrice,
      liquidationPrice: side === 'LONG' ? currentPrice * 0.9 : currentPrice * 1.1,
      unrealizedPnL: -fee,
      unrealizedPnLPercent: (-fee / requiredMargin) * 100,
      exitPlan: decision.exitPlan || {
        invalidation: 'Default',
        stopLoss: side === 'LONG' ? currentPrice * 0.95 : currentPrice * 1.05,
        takeProfit: side === 'LONG' ? currentPrice * 1.10 : currentPrice * 0.90,
      },
      openedAt: timestamp,
    };

    account.positions.push(position);
    account.availableCash -= (requiredMargin + fee);
  }

  /**
   * 更新持仓价格
   */
  private updatePositions(
    account: AccountStatus,
    timestamp: number,
    priceData: Record<Coin, Record<number, number>>
  ) {
    for (const position of account.positions) {
      const currentPrice = priceData[position.coin][timestamp];
      if (!currentPrice) continue;

      position.currentPrice = currentPrice;

      const priceDiff = position.side === 'LONG'
        ? currentPrice - position.entryPrice
        : position.entryPrice - currentPrice;

      const pnl = (priceDiff / position.entryPrice) * position.notional;
      const requiredMargin = position.notional / position.leverage;

      position.unrealizedPnL = pnl;
      position.unrealizedPnLPercent = (pnl / requiredMargin) * 100;
    }
  }

  /**
   * 检查止损/止盈
   */
  private checkExitConditions(
    account: AccountStatus,
    completedTrades: CompletedTrade[],
    timestamp: number,
    priceData: Record<Coin, Record<number, number>>,
    modelName: string
  ) {
    for (let i = account.positions.length - 1; i >= 0; i--) {
      const position = account.positions[i];
      const currentPrice = priceData[position.coin][timestamp];

      if (!currentPrice) continue;

      let shouldClose = false;
      let exitReason = '';

      // 检查止损
      if (position.side === 'LONG' && currentPrice <= position.exitPlan.stopLoss) {
        shouldClose = true;
        exitReason = 'Stop Loss';
      } else if (position.side === 'SHORT' && currentPrice >= position.exitPlan.stopLoss) {
        shouldClose = true;
        exitReason = 'Stop Loss';
      }

      // 检查止盈
      if (position.side === 'LONG' && currentPrice >= position.exitPlan.takeProfit) {
        shouldClose = true;
        exitReason = 'Take Profit';
      } else if (position.side === 'SHORT' && currentPrice <= position.exitPlan.takeProfit) {
        shouldClose = true;
        exitReason = 'Take Profit';
      }

      if (shouldClose) {
        this.closePosition(account, completedTrades, position, currentPrice, exitReason, modelName, timestamp);
      }
    }
  }

  /**
   * 平仓
   */
  private closePosition(
    account: AccountStatus,
    completedTrades: CompletedTrade[],
    position: Position,
    exitPrice: number,
    exitReason: string,
    modelName: string,
    timestamp: number
  ) {
    const priceDiff = position.side === 'LONG'
      ? exitPrice - position.entryPrice
      : position.entryPrice - exitPrice;

    const pnl = (priceDiff / position.entryPrice) * position.notional;
    const requiredMargin = position.notional / position.leverage;
    const fee = position.notional * TAKER_FEE;

    account.availableCash += requiredMargin + pnl - fee;

    const trade: CompletedTrade = {
      id: position.id,
      modelName,
      coin: position.coin,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice,
      leverage: position.leverage,
      notional: position.notional,
      pnl: pnl - fee,
      pnlPercent: ((pnl - fee) / requiredMargin) * 100,
      openedAt: position.openedAt,
      closedAt: timestamp,
      exitReason,
    };

    completedTrades.push(trade);

    const index = account.positions.indexOf(position);
    if (index > -1) {
      account.positions.splice(index, 1);
    }
  }

  /**
   * 计算总权益
   */
  private calculateTotalEquity(
    account: AccountStatus,
    timestamp: number,
    priceData: Record<Coin, Record<number, number>>
  ): number {
    this.updatePositions(account, timestamp, priceData);
    const unrealizedPnL = account.positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
    return account.availableCash + unrealizedPnL;
  }

  /**
   * 计算性能指标
   */
  private calculateMetrics(
    modelName: string,
    config: BacktestConfig,
    account: AccountStatus,
    completedTrades: CompletedTrade[],
    equityHistory: { timestamp: number; equity: number }[],
    totalBars: number,
    executionTime: number
  ): BacktestResult {
    const finalEquity = account.totalEquity;
    const totalReturn = ((finalEquity - config.initialCapital) / config.initialCapital) * 100;
    const totalReturnDollar = finalEquity - config.initialCapital;

    const winningTrades = completedTrades.filter(t => t.pnl > 0);
    const losingTrades = completedTrades.filter(t => t.pnl < 0);
    const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;

    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length)
      : 0;

    const totalWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLoss === 0 ? (totalWin > 0 ? Infinity : 0) : totalWin / totalLoss;

    // 计算夏普比率
    const returns = [];
    for (let i = 1; i < equityHistory.length; i++) {
      const ret = (equityHistory[i].equity - equityHistory[i - 1].equity) / equityHistory[i - 1].equity;
      returns.push(ret);
    }
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev === 0 ? 0 : (avgReturn / stdDev) * Math.sqrt(252);

    // 计算索提诺比率
    const negativeReturns = returns.filter(r => r < 0);
    const downsideVariance = negativeReturns.length > 0
      ? negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
      : 0;
    const downsideDeviation = Math.sqrt(downsideVariance);
    const sortinoRatio = downsideDeviation === 0 ? 0 : (avgReturn / downsideDeviation) * Math.sqrt(252);

    // 计算最大回撤
    let maxEquity = config.initialCapital;
    let maxDrawdown = 0;
    let maxDrawdownDollar = 0;

    for (const point of equityHistory) {
      if (point.equity > maxEquity) {
        maxEquity = point.equity;
      }
      const drawdown = ((maxEquity - point.equity) / maxEquity) * 100;
      const drawdownDollar = maxEquity - point.equity;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownDollar = drawdownDollar;
      }
    }

    return {
      model: modelName,
      config,
      totalReturn,
      totalReturnDollar,
      finalEquity,
      totalTrades: completedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      maxDrawdownDollar,
      avgWin,
      avgLoss,
      profitFactor,
      trades: completedTrades,
      equityHistory,
      totalBars,
      executionTime,
    };
  }

  /**
   * 输出回测摘要
   */
  private printSummary(result: BacktestResult) {
    console.log('\n' + '='.repeat(60));
    console.log(`📊 回测结果: ${result.model}`);
    console.log('='.repeat(60));
    console.log(`💰 总回报: ${result.totalReturn >= 0 ? '+' : ''}${result.totalReturn.toFixed(2)}% (${result.totalReturn >= 0 ? '+' : ''}$${result.totalReturnDollar.toFixed(2)})`);
    console.log(`💵 最终权益: $${result.finalEquity.toFixed(2)}`);
    console.log(`📈 总交易: ${result.totalTrades} (${result.winningTrades} 盈利, ${result.losingTrades} 亏损)`);
    console.log(`🎯 胜率: ${result.winRate.toFixed(1)}%`);
    console.log(`📊 夏普比率: ${result.sharpeRatio.toFixed(2)}`);
    console.log(`📊 索提诺比率: ${result.sortinoRatio.toFixed(2)}`);
    console.log(`📉 最大回撤: ${result.maxDrawdown.toFixed(2)}% ($${result.maxDrawdownDollar.toFixed(2)})`);
    console.log(`💹 盈利因子: ${result.profitFactor === Infinity ? '∞' : result.profitFactor.toFixed(2)}`);
    console.log(`💚 平均盈利: $${result.avgWin.toFixed(2)}`);
    console.log(`💔 平均亏损: $${result.avgLoss.toFixed(2)}`);
    console.log(`⏱️  执行时间: ${(result.executionTime / 1000).toFixed(2)}s`);
    console.log('='.repeat(60) + '\n');
  }
}
