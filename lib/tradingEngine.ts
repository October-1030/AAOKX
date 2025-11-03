// 交易执行引擎

import {
  Position,
  TradingDecision,
  Coin,
  AccountStatus,
  ModelPerformance,
  AIResponse,
  CompletedTrade,
} from '@/types/trading';
import { getCurrentPrice, getAllMarketData } from './marketData';
import {
  generateNOF1SystemPrompt,
  generateNOF1UserPrompt,
  parseNOF1Response,
} from './tradingPromptNOF1';
import { AIModel } from './aiModels';
import { CONFIG } from './config';
import { getRealTradingExecutor } from './realTradingExecutor';

const INITIAL_CAPITAL = 10000;
const MAKER_FEE = -0.0002; // 返佣
const TAKER_FEE = 0.00055;

/**
 * 交易引擎状态
 */
export class TradingEngineState {
  private modelStates: Map<string, ModelState> = new Map();

  constructor(models: AIModel[]) {
    for (const model of models) {
      this.modelStates.set(model.name, {
        model,
        account: this.createInitialAccount(),
        completedTrades: [],
        equityHistory: [{ timestamp: Date.now(), equity: INITIAL_CAPITAL }],
        lastUpdateTime: Date.now(),
      });
    }
  }

  private createInitialAccount(): AccountStatus {
    return {
      tradingDuration: 0,
      totalCalls: 0,
      totalReturn: 0,
      availableCash: INITIAL_CAPITAL,
      totalEquity: INITIAL_CAPITAL,
      positions: [],
    };
  }

  /**
   * 执行一轮交易决策
   */
  async executeTradingCycle() {
    const marketData = getAllMarketData();

    for (const [modelName, state] of this.modelStates) {
      try {
        await this.executeModelDecision(state, marketData);
      } catch (error) {
        console.error(`Error executing ${modelName}:`, error);
      }
    }
  }

  /**
   * 执行单个模型的交易决策
   */
  private async executeModelDecision(
    state: ModelState,
    marketData: ReturnType<typeof getAllMarketData>
  ) {
    const { model, account } = state;

    // 更新持仓的当前价格和P&L
    this.updatePositions(account);

    // 生成提示词（使用 nof1.ai 系统）
    const systemPrompt = generateNOF1SystemPrompt(model.strategy);
    const userPrompt = generateNOF1UserPrompt(account, marketData);

    // 🔍 调试：开始调用 AI
    console.log(`[TradingEngine] 🔍 正在调用 ${model.displayName} API...`);

    // 调用AI模型
    const rawResponse = await model.callAPI(systemPrompt, userPrompt);

    // 🔍 调试：AI 响应长度
    console.log(`[TradingEngine] 🔍 ${model.displayName} 响应长度: ${rawResponse.length} 字符`);

    const { chainOfThought, decisions } = parseNOF1Response(rawResponse);

    // 🔍 调试：解析结果
    console.log(`[TradingEngine] 🔍 ${model.displayName} 解析结果: ${decisions.length} 个决策`);

    // 记录AI响应
    const aiResponse: AIResponse = {
      modelName: model.name,
      chainOfThought: {
        overallAssessment: chainOfThought,
        positionAnalysis: [],
        newOpportunities: [],
        finalSummary: '',
      },
      decisions,
      timestamp: Date.now(),
    };

    // 📊 日志：显示 AI 决策摘要
    const buyDecisions = decisions.filter(d => d.action === 'BUY');
    const sellDecisions = decisions.filter(d => d.action === 'SELL');
    const holdDecisions = decisions.filter(d => d.action === 'HOLD');

    console.log(`[TradingEngine] 🤖 ${model.displayName} 决策: BUY=${buyDecisions.length}, SELL=${sellDecisions.length}, HOLD=${holdDecisions.length}`);

    if (buyDecisions.length > 0) {
      buyDecisions.forEach(d => console.log(`  📈 BUY ${d.coin} ${d.side} ${d.leverage}x $${d.notional}`));
    }
    if (sellDecisions.length > 0) {
      sellDecisions.forEach(d => console.log(`  📉 SELL ${d.coin}`));
    }

    // 执行交易决策
    for (const decision of decisions) {
      await this.executeDecision(state, decision);
    }

    // 更新账户状态
    account.totalCalls++;
    account.tradingDuration = Date.now() - (state.lastUpdateTime - account.tradingDuration);

    const totalEquity = this.calculateTotalEquity(account);
    account.totalEquity = totalEquity;
    account.totalReturn = ((totalEquity - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

    // 记录权益历史
    state.equityHistory.push({
      timestamp: Date.now(),
      equity: totalEquity,
    });

    // 保持最近1000个数据点
    if (state.equityHistory.length > 1000) {
      state.equityHistory = state.equityHistory.slice(-1000);
    }
  }

  /**
   * 转换 AI 决策格式 → RealExecutor 格式
   */
  private convertToRealTradingFormat(decision: TradingDecision): TradingDecision {
    // BUY → OPEN_LONG / OPEN_SHORT
    if (decision.action === 'BUY') {
      // 🔥 关键修复：计算 size（从 notional 转换）
      let size = decision.size;
      if (!size && decision.notional) {
        const currentPrice = getCurrentPrice(decision.coin);
        size = decision.notional / currentPrice;
        console.log(`[TradingEngine] 🔄 计算 size: $${decision.notional} / $${currentPrice.toFixed(2)} = ${size.toFixed(6)} ${decision.coin}`);
      }

      return {
        ...decision,
        action: decision.side === 'LONG' ? 'OPEN_LONG' : 'OPEN_SHORT',
        size, // ✅ 添加 size 参数
      } as TradingDecision;
    }

    // SELL → CLOSE_POSITION
    if (decision.action === 'SELL') {
      return {
        ...decision,
        action: 'CLOSE_POSITION',
      } as TradingDecision;
    }

    // HOLD → HOLD (不变)
    return decision;
  }

  /**
   * 执行单个交易决策
   */
  private async executeDecision(state: ModelState, decision: TradingDecision) {
    const { account, completedTrades, model } = state;

    // 🚀 真实交易模式
    if (CONFIG.USE_REAL_TRADING) {
      console.log(`[RealTrading] 💰 ${model.displayName} - 执行真实交易决策`);
      const realExecutor = getRealTradingExecutor({ dryRun: false });

      try {
        // 🔄 转换 AI 决策格式 → RealExecutor 格式
        const realDecision = this.convertToRealTradingFormat(decision);

        const result = await realExecutor.executeDecision(
          model.displayName,
          realDecision,
          account.positions
        );

        console.log(`[RealTrading] ${result.success ? '✅' : '❌'} ${result.message}`);

        // 如果真实交易成功，继续模拟记录
        if (result.success) {
          this.executeSimulatedDecision(state, decision);
        }
      } catch (error) {
        console.error(`[RealTrading] ❌ 执行失败:`, error);
      }
    } else {
      // 🧪 模拟模式
      this.executeSimulatedDecision(state, decision);
    }
  }

  /**
   * 执行模拟交易决策（仅记录）
   */
  private executeSimulatedDecision(state: ModelState, decision: TradingDecision) {
    const { account, completedTrades } = state;

    switch (decision.action) {
      case 'BUY':
        this.executeBuy(account, decision);
        break;

      case 'SELL':
        this.executeSell(account, completedTrades, decision);
        break;

      case 'HOLD':
        // 检查是否需要触发止损/止盈
        this.checkExitConditions(account, completedTrades, decision.coin);
        break;
    }
  }

  /**
   * 执行买入
   */
  private executeBuy(account: AccountStatus, decision: TradingDecision) {
    if (!decision.notional || !decision.leverage || !decision.side) return;

    const currentPrice = getCurrentPrice(decision.coin);

    // 检查资金充足
    const requiredMargin = decision.notional / decision.leverage;
    if (requiredMargin > account.availableCash * 0.95) {
      console.log(`Insufficient funds for ${decision.coin}`);
      return;
    }

    // 计算手续费
    const fee = decision.notional * TAKER_FEE;

    // 计算清算价格（基于杠杆和方向）
    // 清算发生在亏损达到初始保证金的时候
    // LONG: liquidation = entryPrice * (1 - 1/leverage * 0.9)
    // SHORT: liquidation = entryPrice * (1 + 1/leverage * 0.9)
    const maintenanceMarginRate = 0.05; // 维持保证金率 5%
    const liquidationPrice = decision.side === 'LONG'
      ? currentPrice * (1 - (1 / decision.leverage) * (1 - maintenanceMarginRate))
      : currentPrice * (1 + (1 / decision.leverage) * (1 - maintenanceMarginRate));

    // 创建持仓
    const position: Position = {
      id: `${decision.coin}-${Date.now()}`,
      coin: decision.coin,
      side: decision.side,
      leverage: decision.leverage,
      notional: decision.notional,
      entryPrice: currentPrice,
      currentPrice: currentPrice,
      liquidationPrice: liquidationPrice,
      unrealizedPnL: -fee,
      unrealizedPnLPercent: (-fee / requiredMargin) * 100,
      exitPlan: decision.exitPlan || {
        invalidation: `Price moves against position by 5%`,
        stopLoss: decision.side === 'LONG' ? currentPrice * 0.95 : currentPrice * 1.05,
        takeProfit: decision.side === 'LONG' ? currentPrice * 1.10 : currentPrice * 0.90,
      },
      openedAt: Date.now(),
    };

    account.positions.push(position);
    account.availableCash -= (requiredMargin + fee);

    console.log(`${decision.coin} ${decision.side} opened at $${currentPrice.toFixed(2)}`);
  }

  /**
   * 执行卖出
   */
  private executeSell(
    account: AccountStatus,
    completedTrades: CompletedTrade[],
    decision: TradingDecision
  ) {
    const positionIndex = account.positions.findIndex(p => p.coin === decision.coin);
    if (positionIndex === -1) return;

    const position = account.positions[positionIndex];
    const currentPrice = getCurrentPrice(decision.coin);

    this.closePosition(account, completedTrades, position, currentPrice, 'Manual close');
  }

  /**
   * 检查退出条件（止损/止盈）
   */
  private checkExitConditions(
    account: AccountStatus,
    completedTrades: CompletedTrade[],
    coin?: Coin
  ) {
    const positionsToCheck = coin
      ? account.positions.filter(p => p.coin === coin)
      : account.positions;

    for (const position of positionsToCheck) {
      const currentPrice = getCurrentPrice(position.coin);

      // 检查止损
      if (position.side === 'LONG' && currentPrice <= position.exitPlan.stopLoss) {
        this.closePosition(account, completedTrades, position, currentPrice, 'Stop loss triggered');
        continue;
      }

      if (position.side === 'SHORT' && currentPrice >= position.exitPlan.stopLoss) {
        this.closePosition(account, completedTrades, position, currentPrice, 'Stop loss triggered');
        continue;
      }

      // 检查止盈
      if (position.side === 'LONG' && currentPrice >= position.exitPlan.takeProfit) {
        this.closePosition(account, completedTrades, position, currentPrice, 'Take profit hit');
        continue;
      }

      if (position.side === 'SHORT' && currentPrice <= position.exitPlan.takeProfit) {
        this.closePosition(account, completedTrades, position, currentPrice, 'Take profit hit');
      }
    }
  }

  /**
   * 关闭持仓
   */
  private closePosition(
    account: AccountStatus,
    completedTrades: CompletedTrade[],
    position: Position,
    exitPrice: number,
    exitReason: string
  ) {
    const pnl = this.calculatePositionPnL(position, exitPrice);
    const requiredMargin = position.notional / position.leverage;
    const fee = position.notional * TAKER_FEE;

    // 返还保证金 + P&L - 手续费
    account.availableCash += requiredMargin + pnl - fee;

    // 记录完成的交易
    const completedTrade: CompletedTrade = {
      id: position.id,
      modelName: '',
      coin: position.coin,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice,
      leverage: position.leverage,
      notional: position.notional,
      pnl: pnl - fee,
      pnlPercent: ((pnl - fee) / requiredMargin) * 100,
      openedAt: position.openedAt,
      closedAt: Date.now(),
      exitReason,
    };

    completedTrades.push(completedTrade);

    // 从持仓中移除
    const index = account.positions.indexOf(position);
    if (index > -1) {
      account.positions.splice(index, 1);
    }

    console.log(
      `${position.coin} ${position.side} closed: ${exitReason}, P&L: $${pnl.toFixed(2)}`
    );
  }

  /**
   * 计算持仓P&L
   */
  private calculatePositionPnL(position: Position, currentPrice: number): number {
    const priceDiff = position.side === 'LONG'
      ? currentPrice - position.entryPrice
      : position.entryPrice - currentPrice;

    const pnl = (priceDiff / position.entryPrice) * position.notional;
    return pnl;
  }

  /**
   * 更新所有持仓的当前价格和P&L
   */
  private updatePositions(account: AccountStatus) {
    for (const position of account.positions) {
      const currentPrice = getCurrentPrice(position.coin);
      position.currentPrice = currentPrice;

      const pnl = this.calculatePositionPnL(position, currentPrice);
      const requiredMargin = position.notional / position.leverage;

      position.unrealizedPnL = pnl;
      position.unrealizedPnLPercent = (pnl / requiredMargin) * 100;
    }
  }

  /**
   * 计算总权益
   */
  private calculateTotalEquity(account: AccountStatus): number {
    const unrealizedPnL = account.positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
    return account.availableCash + unrealizedPnL;
  }

  /**
   * 获取模型表现
   */
  getModelPerformance(modelName: string): ModelPerformance | null {
    const state = this.modelStates.get(modelName);
    if (!state) return null;

    const { model, account, completedTrades, equityHistory } = state;
    const winningTrades = completedTrades.filter(t => t.pnl > 0).length;

    return {
      modelName: model.name,
      displayName: model.displayName,
      strategy: model.strategy,
      initialCapital: INITIAL_CAPITAL,
      currentEquity: account.totalEquity,
      totalReturn: account.totalReturn,
      returnPercent: account.totalReturn,
      totalTrades: completedTrades.length,
      winRate: completedTrades.length > 0 ? (winningTrades / completedTrades.length) * 100 : 0,
      sharpeRatio: this.calculateSharpeRatio(equityHistory),
      maxDrawdown: this.calculateMaxDrawdown(equityHistory),
      positions: account.positions,
      recentDecisions: [],
      equityHistory: equityHistory.slice(-100),
    };
  }

  /**
   * 获取所有模型表现
   */
  getAllPerformances(): ModelPerformance[] {
    const performances: ModelPerformance[] = [];

    for (const modelName of this.modelStates.keys()) {
      const perf = this.getModelPerformance(modelName);
      if (perf) performances.push(perf);
    }

    // 按回报率排序
    return performances.sort((a, b) => b.returnPercent - a.returnPercent);
  }

  /**
   * 计算夏普比率
   */
  private calculateSharpeRatio(equityHistory: { timestamp: number; equity: number }[]): number {
    if (equityHistory.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < equityHistory.length; i++) {
      const ret = (equityHistory[i].equity - equityHistory[i - 1].equity) / equityHistory[i - 1].equity;
      returns.push(ret);
    }

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev === 0 ? 0 : (avgReturn / stdDev) * Math.sqrt(252); // 年化
  }

  /**
   * 计算最大回撤
   */
  private calculateMaxDrawdown(equityHistory: { timestamp: number; equity: number }[]): number {
    let maxEquity = 0;
    let maxDrawdown = 0;

    for (const point of equityHistory) {
      if (point.equity > maxEquity) {
        maxEquity = point.equity;
      }

      const drawdown = ((maxEquity - point.equity) / maxEquity) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }
}

interface ModelState {
  model: AIModel;
  account: AccountStatus;
  completedTrades: CompletedTrade[];
  equityHistory: { timestamp: number; equity: number }[];
  lastUpdateTime: number;
}
