// 交易执行引擎

import {
  Position,
  TradingDecision,
  Coin,
  AccountStatus,
  ModelPerformance,
  AIResponse,
  CompletedTrade,
  TradeSide,
  TradeAction,
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
 * 根据 confidence 计算动态杠杆（nof1.ai 规则）
 * @param confidence 信心度 (0-1)
 * @returns 建议杠杆倍数 (1-20x)
 */
function calculateDynamicLeverage(confidence: number): number {
  if (confidence < 0.3) return 1; // 极低信心，最小杠杆
  if (confidence < 0.5) return Math.floor(1 + (confidence - 0.3) * 10); // 0.3-0.5 → 1-3x
  if (confidence < 0.7) return Math.floor(3 + (confidence - 0.5) * 25); // 0.5-0.7 → 3-8x
  return Math.floor(8 + (confidence - 0.7) * 40); // 0.7-1.0 → 8-20x
}

/**
 * 验证交易决策的合理性（借鉴 LLM-trader-test）
 * @param decision 交易决策
 * @param currentPrice 当前价格
 * @param side 交易方向
 * @returns 验证结果
 */
function validateTradingDecision(
  decision: TradingDecision,
  currentPrice: number,
  side: TradeSide
): { valid: boolean; reason?: string } {
  const { exitPlan } = decision;

  // 验证 1: 止损方向检查
  if (side === 'LONG' && exitPlan.stopLoss >= currentPrice) {
    return {
      valid: false,
      reason: `LONG stop-loss ($${exitPlan.stopLoss.toFixed(2)}) must be < entry ($${currentPrice.toFixed(2)})`
    };
  }

  if (side === 'SHORT' && exitPlan.stopLoss <= currentPrice) {
    return {
      valid: false,
      reason: `SHORT stop-loss ($${exitPlan.stopLoss.toFixed(2)}) must be > entry ($${currentPrice.toFixed(2)})`
    };
  }

  // 验证 2: 止盈方向检查
  if (side === 'LONG' && exitPlan.takeProfit <= currentPrice) {
    return {
      valid: false,
      reason: `LONG take-profit ($${exitPlan.takeProfit.toFixed(2)}) must be > entry ($${currentPrice.toFixed(2)})`
    };
  }

  if (side === 'SHORT' && exitPlan.takeProfit >= currentPrice) {
    return {
      valid: false,
      reason: `SHORT take-profit ($${exitPlan.takeProfit.toFixed(2)}) must be < entry ($${currentPrice.toFixed(2)})`
    };
  }

  // 验证 3: 2:1 盈亏比检查（nof1.ai 强制规则）
  const riskDistance = Math.abs(currentPrice - exitPlan.stopLoss);
  const rewardDistance = Math.abs(exitPlan.takeProfit - currentPrice);
  const riskRewardRatio = rewardDistance / riskDistance;

  if (riskRewardRatio < 2.0) {
    return {
      valid: false,
      reason: `Risk-reward ratio ${riskRewardRatio.toFixed(2)}:1 < required 2:1 (risk: $${riskDistance.toFixed(2)}, reward: $${rewardDistance.toFixed(2)})`
    };
  }

  // 验证 4: 价格合理性（止损/止盈不能太远）
  const stopLossPercent = Math.abs((exitPlan.stopLoss - currentPrice) / currentPrice) * 100;
  const takeProfitPercent = Math.abs((exitPlan.takeProfit - currentPrice) / currentPrice) * 100;

  if (stopLossPercent > 50) {
    return {
      valid: false,
      reason: `Stop-loss too far (${stopLossPercent.toFixed(1)}% from entry)`
    };
  }

  if (takeProfitPercent > 100) {
    return {
      valid: false,
      reason: `Take-profit too far (${takeProfitPercent.toFixed(1)}% from entry)`
    };
  }

  return { valid: true };
}

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

    // 📊 日志：显示 AI 决策摘要（nof1.ai 格式）
    const buyToEnterDecisions = decisions.filter(d => d.action === 'buy_to_enter');
    const sellToEnterDecisions = decisions.filter(d => d.action === 'sell_to_enter');
    const closeDecisions = decisions.filter(d => d.action === 'close');
    const holdDecisions = decisions.filter(d => d.action === 'hold');

    console.log(`[TradingEngine] 🤖 ${model.displayName} 决策: buy_to_enter=${buyToEnterDecisions.length}, sell_to_enter=${sellToEnterDecisions.length}, close=${closeDecisions.length}, hold=${holdDecisions.length}`);

    if (buyToEnterDecisions.length > 0) {
      buyToEnterDecisions.forEach(d => {
        const leverage = d.leverage || calculateDynamicLeverage(d.confidence);
        console.log(`  📈 buy_to_enter ${d.coin} LONG ${leverage}x $${d.notional} (conf: ${d.confidence.toFixed(2)})`);
      });
    }
    if (sellToEnterDecisions.length > 0) {
      sellToEnterDecisions.forEach(d => {
        const leverage = d.leverage || calculateDynamicLeverage(d.confidence);
        console.log(`  📉 sell_to_enter ${d.coin} SHORT ${leverage}x $${d.notional} (conf: ${d.confidence.toFixed(2)})`);
      });
    }
    if (closeDecisions.length > 0) {
      closeDecisions.forEach(d => console.log(`  🔒 close ${d.coin}`));
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
   * @deprecated 不再需要格式转换，realTradingExecutor 现在直接支持 nof1.ai 格式
   * 保留此注释以记录历史
   */

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
        // ✅ 直接使用 nof1.ai 格式（realTradingExecutor 已支持）
        const result = await realExecutor.executeDecision(
          model.displayName,
          decision,
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
   * 执行模拟交易决策（基于 nof1.ai 真实规则）
   */
  private executeSimulatedDecision(state: ModelState, decision: TradingDecision) {
    const { account, completedTrades, model } = state;

    // 🔍 检查当前是否已有该币种的持仓
    const existingPosition = account.positions.find(p => p.coin === decision.coin);

    switch (decision.action) {
      case 'buy_to_enter':
        // ❌ NO PYRAMIDING: 如果已有该币种持仓，禁止再次买入
        if (existingPosition) {
          console.log(`[${model.displayName}] ❌ PYRAMIDING BLOCKED: ${decision.coin} already has position`);
          return;
        }
        // 买入做多（LONG）
        this.executeBuy(account, decision, 'LONG');
        break;

      case 'sell_to_enter':
        // ❌ NO PYRAMIDING: 如果已有该币种持仓，禁止再次卖出
        if (existingPosition) {
          console.log(`[${model.displayName}] ❌ PYRAMIDING BLOCKED: ${decision.coin} already has position`);
          return;
        }
        // 卖出做空（SHORT）
        this.executeBuy(account, decision, 'SHORT');
        break;

      case 'close':
        // 平仓（100% 退出）
        if (!existingPosition) {
          console.log(`[${model.displayName}] ⚠️ No position to close for ${decision.coin}`);
          return;
        }
        this.executeSell(account, completedTrades, decision, model.displayName);
        break;

      case 'hold':
        // 持有或保持空仓，检查止损/止盈条件
        if (existingPosition) {
          this.checkExitConditions(account, completedTrades, model.displayName, decision.coin);
        }
        break;

      default:
        console.warn(`[${model.displayName}] ⚠️ Unknown action: ${decision.action}`);
    }
  }

  /**
   * 执行买入（支持动态杠杆选择）
   */
  private executeBuy(account: AccountStatus, decision: TradingDecision, side: TradeSide) {
    if (!decision.notional) return;

    const currentPrice = getCurrentPrice(decision.coin);

    // ✅ 验证决策合理性（借鉴 LLM-trader-test）
    const validation = validateTradingDecision(decision, currentPrice, side);
    if (!validation.valid) {
      console.warn(`[Trading] ❌ Decision validation failed for ${decision.coin}: ${validation.reason}`);
      return;
    }

    // 🔥 动态杠杆：如果 AI 没有指定杠杆，根据 confidence 自动计算
    const leverage = decision.leverage || calculateDynamicLeverage(decision.confidence);
    console.log(`[Trading] ✅ Validated ${decision.coin} ${side} - Leverage: ${leverage}x (confidence: ${(decision.confidence * 100).toFixed(0)}%)`);

    // 检查资金充足
    const requiredMargin = decision.notional / leverage;
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
    const liquidationPrice = side === 'LONG'
      ? currentPrice * (1 - (1 / leverage) * (1 - maintenanceMarginRate))
      : currentPrice * (1 + (1 / leverage) * (1 - maintenanceMarginRate));

    // 创建持仓
    const position: Position = {
      id: `${decision.coin}-${Date.now()}`,
      coin: decision.coin,
      side: side,
      leverage: leverage,
      notional: decision.notional,
      entryPrice: currentPrice,
      currentPrice: currentPrice,
      liquidationPrice: liquidationPrice,
      unrealizedPnL: -fee,
      unrealizedPnLPercent: (-fee / requiredMargin) * 100,
      exitPlan: decision.exitPlan || {
        invalidation: `Price moves against position by 5%`,
        stopLoss: side === 'LONG' ? currentPrice * 0.95 : currentPrice * 1.05,
        takeProfit: side === 'LONG' ? currentPrice * 1.10 : currentPrice * 0.90,
      },
      openedAt: Date.now(),
    };

    account.positions.push(position);
    account.availableCash -= (requiredMargin + fee);

    console.log(`${decision.coin} ${side} opened at $${currentPrice.toFixed(2)}`);
  }

  /**
   * 执行卖出
   */
  private executeSell(
    account: AccountStatus,
    completedTrades: CompletedTrade[],
    decision: TradingDecision,
    modelName: string
  ) {
    const positionIndex = account.positions.findIndex(p => p.coin === decision.coin);
    if (positionIndex === -1) return;

    const position = account.positions[positionIndex];
    const currentPrice = getCurrentPrice(decision.coin);

    this.closePosition(account, completedTrades, position, currentPrice, 'Manual close', modelName);
  }

  /**
   * 检查退出条件（止损/止盈）
   */
  private checkExitConditions(
    account: AccountStatus,
    completedTrades: CompletedTrade[],
    modelName: string,
    coin?: Coin
  ) {
    const positionsToCheck = coin
      ? account.positions.filter(p => p.coin === coin)
      : account.positions;

    for (const position of positionsToCheck) {
      const currentPrice = getCurrentPrice(position.coin);

      // 检查止损
      if (position.side === 'LONG' && currentPrice <= position.exitPlan.stopLoss) {
        this.closePosition(account, completedTrades, position, currentPrice, 'Stop loss triggered', modelName);
        continue;
      }

      if (position.side === 'SHORT' && currentPrice >= position.exitPlan.stopLoss) {
        this.closePosition(account, completedTrades, position, currentPrice, 'Stop loss triggered', modelName);
        continue;
      }

      // 检查止盈
      if (position.side === 'LONG' && currentPrice >= position.exitPlan.takeProfit) {
        this.closePosition(account, completedTrades, position, currentPrice, 'Take profit hit', modelName);
        continue;
      }

      if (position.side === 'SHORT' && currentPrice <= position.exitPlan.takeProfit) {
        this.closePosition(account, completedTrades, position, currentPrice, 'Take profit hit', modelName);
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
    exitReason: string,
    modelName: string = ''
  ) {
    const pnl = this.calculatePositionPnL(position, exitPrice);
    const requiredMargin = position.notional / position.leverage;
    const fee = position.notional * TAKER_FEE;

    // 返还保证金 + P&L - 手续费
    account.availableCash += requiredMargin + pnl - fee;

    // 记录完成的交易
    const completedTrade: CompletedTrade = {
      id: position.id,
      modelName: modelName,  // ✅ 使用传入的模型名称
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
      sortinoRatio: this.calculateSortinoRatio(equityHistory),
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
   * 获取所有完成的交易（用于 /api/trades）
   */
  getAllCompletedTrades(): CompletedTrade[] {
    const allTrades: CompletedTrade[] = [];

    for (const [modelName, state] of this.modelStates) {
      // 添加模型名称并收集所有交易
      const tradesWithModel = state.completedTrades.map(trade => ({
        ...trade,
        modelName: state.model.displayName,
      }));
      allTrades.push(...tradesWithModel);
    }

    // 按时间倒序排序（最新的在前面）
    return allTrades.sort((a, b) => b.closedAt - a.closedAt);
  }

  /**
   * 获取所有账户快照（用于 /api/account-totals）
   */
  getAllAccountSnapshots() {
    const snapshots = [];

    for (const [modelName, state] of this.modelStates) {
      const { model, account, completedTrades, equityHistory } = state;

      snapshots.push({
        model_id: model.name,
        displayName: model.displayName,
        timestamp: Date.now(),
        dollar_equity: account.totalEquity,
        realized_pnl: completedTrades.reduce((sum, t) => sum + t.pnl, 0),
        total_unrealized_pnl: account.positions.reduce((sum, p) => sum + p.unrealizedPnL, 0),
        cum_pnl_pct: account.totalReturn,
        sharpe_ratio: this.calculateSharpeRatio(equityHistory),
        positions: account.positions,
        equityHistory: equityHistory.slice(-100),
      });
    }

    return snapshots;
  }

  /**
   * 计算夏普比率（Sharpe Ratio）
   * 衡量风险调整后收益，考虑所有波动性
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
   * 计算索提诺比率（Sortino Ratio）- 借鉴 LLM-trader-test
   * 只惩罚下行波动，比夏普比率更准确地反映风险
   */
  private calculateSortinoRatio(equityHistory: { timestamp: number; equity: number }[]): number {
    if (equityHistory.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < equityHistory.length; i++) {
      const ret = (equityHistory[i].equity - equityHistory[i - 1].equity) / equityHistory[i - 1].equity;
      returns.push(ret);
    }

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // 只计算负收益的标准差（下行偏差）
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) return Infinity; // 没有负收益

    const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
    const downsideDeviation = Math.sqrt(downsideVariance);

    return downsideDeviation === 0 ? 0 : (avgReturn / downsideDeviation) * Math.sqrt(252); // 年化
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
