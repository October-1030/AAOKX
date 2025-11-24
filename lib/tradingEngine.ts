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
import { getTradingStorage } from './persistence/storage';
import { getRiskManager } from './riskManagement';
import { getEventBus } from './events/eventBus';
import { TradingEventType } from './events/types';

const INITIAL_CAPITAL = 1000; // ✅ 修复：匹配测试网实际金额
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
export function validateTradingDecision(
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
  private storage = getTradingStorage(); // 💾 持久化存储
  private riskManager = getRiskManager(); // 🛡️ 风险管理器
  private eventBus = getEventBus(); // 📡 事件总线

  // 🛡️ 安全保护状态追踪
  private tradingHalted: boolean = false; // 总熔断标志
  private dailyLossPaused: Map<string, boolean> = new Map(); // 每个模型的单日亏损暂停标志
  private lastDailyResetDate: string = ''; // 上次重置日期
  private dailyStartEquity: Map<string, number> = new Map(); // 每个模型的今日起始权益

  constructor(models: AIModel[]) {
    for (const model of models) {
      this.modelStates.set(model.name, {
        model,
        account: this.createInitialAccount(),
        completedTrades: [],
        equityHistory: [{ timestamp: Date.now(), equity: INITIAL_CAPITAL }],
        lastUpdateTime: Date.now(),
      });

      // ✅ 修复：初始化每个模型的每日追踪
      this.dailyStartEquity.set(model.name, INITIAL_CAPITAL);
      this.dailyLossPaused.set(model.name, false);
    }

    // 初始化今日起始权益
    this.resetDailyTracking();
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
   * 🛡️ 重置每日追踪数据（每个模型独立追踪）
   * @param modelName 可选的模型名称，如果提供则只重置该模型
   * @param currentEquity 可选的当前权益，如果提供则使用该值（真实交易模式）
   */
  private resetDailyTracking(modelName?: string, currentEquity?: number) {
    const today = new Date().toISOString().split('T')[0];
    const isNewDay = this.lastDailyResetDate !== today;

    if (modelName && currentEquity !== undefined) {
      // 单个模型重置（使用提供的真实权益）
      // ✅ 修复：即使不是新的一天，也要确保该模型有起始权益记录
      if (isNewDay || !this.dailyStartEquity.has(modelName)) {
        this.dailyStartEquity.set(modelName, currentEquity);
        this.dailyLossPaused.set(modelName, false);
        const state = this.modelStates.get(modelName);
        if (state) {
          console.log(`[Safety] 📅 ${state.model.displayName} 每日追踪已重置，今日起始权益: $${currentEquity.toFixed(2)}`);
        }
      }
    } else if (isNewDay) {
      // 新的一天：重置所有模型（使用模拟权益）
      for (const [modelName, state] of this.modelStates) {
        const equity = this.calculateTotalEquity(state.account);
        this.dailyStartEquity.set(modelName, equity);
        this.dailyLossPaused.set(modelName, false);
        console.log(`[Safety] 📅 ${state.model.displayName} 每日追踪已重置，今日起始权益: $${equity.toFixed(2)}`);
      }
    }

    // ✅ 修复：只在新的一天或第一次调用时更新日期
    if (isNewDay) {
      this.lastDailyResetDate = today;
    }
  }

  /**
   * 🛡️ 安全检查：总亏损熔断（针对单个模型）
   * @param modelName 模型名称
   * @param currentEquity 当前权益
   * @returns true 如果触发熔断
   */
  private checkTotalLossCircuitBreaker(modelName: string, currentEquity: number): boolean {
    if (this.tradingHalted) return true;

    // ✅ 修复：使用单个模型的初始资金计算
    const totalLossPercent = ((currentEquity - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

    if (totalLossPercent <= -CONFIG.SAFETY.MAX_TOTAL_LOSS_PERCENT) {
      this.tradingHalted = true;

      // 📡 发出熔断触发事件
      this.eventBus.emitSync({
        type: TradingEventType.CIRCUIT_BREAKER_TRIGGERED,
        timestamp: Date.now(),
        modelName,
        reason: `Total loss exceeded ${CONFIG.SAFETY.MAX_TOTAL_LOSS_PERCENT}%`,
        totalLossPercent: Math.abs(totalLossPercent),
      });

      console.error('\n' + '='.repeat(60));
      console.error(`🚨🚨🚨 ${modelName} 总亏损熔断触发！交易系统已停止！🚨🚨🚨`);
      console.error('='.repeat(60));
      console.error(`当前总回报: ${totalLossPercent.toFixed(2)}%`);
      console.error(`熔断阈值: -${CONFIG.SAFETY.MAX_TOTAL_LOSS_PERCENT}%`);
      console.error(`初始资金: $${INITIAL_CAPITAL.toFixed(2)}`);
      console.error(`当前权益: $${currentEquity.toFixed(2)}`);
      console.error(`总亏损: $${(currentEquity - INITIAL_CAPITAL).toFixed(2)}`);
      console.error('\n⚠️  请检查系统配置和策略，考虑是否需要调整参数。');
      console.error('='.repeat(60) + '\n');
      return true;
    }

    return false;
  }

  /**
   * 🛡️ 安全检查：单日亏损限制（每个模型独立检查）
   * @param modelName 模型名称
   * @param currentEquity 当前权益
   * @returns true 如果触发限制
   */
  private checkDailyLossLimit(modelName: string, currentEquity: number): boolean {
    // ✅ 修复：传入模型名称和真实权益，确保使用实际数据
    this.resetDailyTracking(modelName, currentEquity);

    // ✅ 修复：使用该模型的暂停状态
    if (this.dailyLossPaused.get(modelName)) return true;

    // ✅ 修复：使用该模型的今日起始权益
    const modelDailyStart = this.dailyStartEquity.get(modelName) || INITIAL_CAPITAL;
    const dailyLossPercent = ((currentEquity - modelDailyStart) / modelDailyStart) * 100;

    if (dailyLossPercent <= -CONFIG.SAFETY.MAX_DAILY_LOSS_PERCENT) {
      this.dailyLossPaused.set(modelName, true);

      // 📡 发出单日亏损限制事件
      this.eventBus.emitSync({
        type: TradingEventType.DAILY_LOSS_LIMIT_REACHED,
        timestamp: Date.now(),
        modelName,
        dailyLossPercent: Math.abs(dailyLossPercent),
        limitPercent: CONFIG.SAFETY.MAX_DAILY_LOSS_PERCENT,
      });

      console.warn('\n' + '='.repeat(60));
      console.warn(`⚠️  ${modelName} 单日亏损限制触发！今日交易已暂停！`);
      console.warn('='.repeat(60));
      console.warn(`今日亏损: ${dailyLossPercent.toFixed(2)}%`);
      console.warn(`限制阈值: -${CONFIG.SAFETY.MAX_DAILY_LOSS_PERCENT}%`);
      console.warn(`今日起始: $${modelDailyStart.toFixed(2)}`);
      console.warn(`当前权益: $${currentEquity.toFixed(2)}`);
      console.warn(`今日亏损: $${(currentEquity - modelDailyStart).toFixed(2)}`);
      console.warn('\n💡 系统将于明天自动恢复交易。');
      console.warn('='.repeat(60) + '\n');
      return true;
    }

    return false;
  }

  /**
   * 🛡️ 获取安全状态摘要
   */
  getSafetyStatus() {
    let totalEquity = 0;
    let totalDailyStart = 0;
    let anyPaused = false;
    const modelCount = this.modelStates.size;

    for (const [modelName, state] of this.modelStates) {
      const equity = this.calculateTotalEquity(state.account);
      totalEquity += equity;
      totalDailyStart += this.dailyStartEquity.get(modelName) || INITIAL_CAPITAL;
      if (this.dailyLossPaused.get(modelName)) anyPaused = true;
    }

    // ✅ 修复：使用所有模型的总初始资金
    const TOTAL_INITIAL_CAPITAL = INITIAL_CAPITAL * modelCount;
    const totalReturn = ((totalEquity - TOTAL_INITIAL_CAPITAL) / TOTAL_INITIAL_CAPITAL) * 100;
    const dailyReturn = ((totalEquity - totalDailyStart) / totalDailyStart) * 100;

    return {
      tradingHalted: this.tradingHalted,
      dailyLossPaused: anyPaused, // ✅ 修复：如果任何一个模型暂停，返回true
      totalEquity,
      totalReturn,
      dailyReturn,
      totalLossRemaining: CONFIG.SAFETY.MAX_TOTAL_LOSS_PERCENT + totalReturn,
      dailyLossRemaining: CONFIG.SAFETY.MAX_DAILY_LOSS_PERCENT + dailyReturn,
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

    // 🛡️ 安全检查：检查总亏损熔断和单日亏损限制
    // ✅ 修复：在真实交易模式下，使用实际 Hyperliquid 账户权益
    let currentEquity: number;

    if (CONFIG.USE_REAL_TRADING) {
      try {
        const { getHyperliquidClient } = await import('./hyperliquidClient');
        const hlClient = getHyperliquidClient();

        if (hlClient.isAvailable()) {
          const accountInfo = await hlClient.getAccountInfo();
          currentEquity = accountInfo.accountValue;
          console.log(`[Safety] 💰 使用真实 Hyperliquid 账户权益: $${currentEquity.toFixed(2)}`);
        } else {
          // 降级到模拟数据
          currentEquity = this.calculateTotalEquity(account);
          console.warn(`[Safety] ⚠️ Hyperliquid 不可用，使用模拟账户权益: $${currentEquity.toFixed(2)}`);
        }
      } catch (error) {
        console.error(`[Safety] ❌ 获取 Hyperliquid 账户失败，使用模拟数据:`, error);
        currentEquity = this.calculateTotalEquity(account);
      }
    } else {
      // 模拟模式：使用内部账户状态
      currentEquity = this.calculateTotalEquity(account);
    }

    // ✅ 修复：传入模型名称
    if (this.checkTotalLossCircuitBreaker(model.name, currentEquity)) {
      console.log(`[${model.displayName}] 🚨 总亏损熔断生效，跳过交易决策`);
      return;
    }

    // ✅ 修复：传入模型名称
    if (this.checkDailyLossLimit(model.name, currentEquity)) {
      console.log(`[${model.displayName}] ⚠️  单日亏损限制生效，跳过交易决策`);
      return;
    }

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
      // 📡 发出AI决策事件
      this.eventBus.emitSync({
        type: TradingEventType.AI_DECISION_MADE,
        timestamp: Date.now(),
        modelName: model.name,
        decision,
        chainOfThought,
      });

      const executed = await this.executeDecision(state, decision);

      // 📡 发出AI决策执行结果事件
      this.eventBus.emitSync({
        type: executed ? TradingEventType.AI_DECISION_EXECUTED : TradingEventType.AI_DECISION_REJECTED,
        timestamp: Date.now(),
        modelName: model.name,
        decision,
        success: executed,
        result: executed ? 'Success' : 'Skipped or Failed',
        reasons: executed ? [] : ['Trade validation or risk check failed'],
      });

      // 💾 保存AI决策记录到数据库
      this.storage.saveAIDecision(
        model.displayName,
        decision,
        chainOfThought,
        executed,
        executed ? 'Success' : 'Skipped or Failed'
      ).catch(err => console.error('[Storage] 保存AI决策失败:', err));
    }

    // 更新账户状态
    account.totalCalls++;
    account.tradingDuration = Date.now() - (state.lastUpdateTime - account.tradingDuration);

    const totalEquity = this.calculateTotalEquity(account);
    account.totalEquity = totalEquity;
    account.totalReturn = ((totalEquity - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

    // 📡 发出账户更新事件
    this.eventBus.emitSync({
      type: TradingEventType.ACCOUNT_UPDATED,
      timestamp: Date.now(),
      modelName: model.name,
      totalEquity,
      availableCash: account.availableCash,
      totalReturn: account.totalReturn,
    });

    // 记录权益历史
    state.equityHistory.push({
      timestamp: Date.now(),
      equity: totalEquity,
    });

    // 💾 保存权益历史到数据库
    this.storage.saveEquityPoint(model.name, totalEquity).catch(err =>
      console.error('[Storage] 保存权益历史失败:', err)
    );

    // 💾 保存账户快照到数据库
    this.storage.saveAccountSnapshot(model.displayName, account).catch(err =>
      console.error('[Storage] 保存账户快照失败:', err)
    );

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
   * @returns {Promise<boolean>} 是否执行成功
   */
  private async executeDecision(state: ModelState, decision: TradingDecision): Promise<boolean> {
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
          await this.executeSimulatedDecision(state, decision);
          return true;
        }
        return false;
      } catch (error) {
        console.error(`[RealTrading] ❌ 执行失败:`, error);
        return false;
      }
    } else {
      // 🧪 模拟模式
      await this.executeSimulatedDecision(state, decision);
      return true;
    }
  }

  /**
   * 执行模拟交易决策（基于 nof1.ai 真实规则）
   */
  private async executeSimulatedDecision(state: ModelState, decision: TradingDecision) {
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
        await this.executeBuy(account, decision, 'LONG', model.displayName);
        break;

      case 'sell_to_enter':
        // ❌ NO PYRAMIDING: 如果已有该币种持仓，禁止再次卖出
        if (existingPosition) {
          console.log(`[${model.displayName}] ❌ PYRAMIDING BLOCKED: ${decision.coin} already has position`);
          return;
        }
        // 卖出做空（SHORT）
        await this.executeBuy(account, decision, 'SHORT', model.displayName);
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
        // 持有或保持空仓，先应用智能止盈系统，再检查止损/止盈条件
        if (existingPosition) {
          // 🎯 应用三合一智能止盈系统
          this.applySmartProfitProtection(account, completedTrades, model.displayName);

          // 再检查传统止损/止盈
          this.checkExitConditions(account, completedTrades, model.displayName, decision.coin);
        }
        break;

      default:
        console.warn(`[${model.displayName}] ⚠️ Unknown action: ${decision.action}`);
    }
  }

  /**
   * 执行买入（支持动态杠杆选择 + 风险管理）
   */
  private async executeBuy(account: AccountStatus, decision: TradingDecision, side: TradeSide, modelName: string) {
    if (!decision.notional) return;

    const currentPrice = getCurrentPrice(decision.coin);

    // ✅ 验证决策合理性（借鉴 LLM-trader-test）
    const validation = validateTradingDecision(decision, currentPrice, side);
    if (!validation.valid) {
      console.warn(`[Trading] ❌ Decision validation failed for ${decision.coin}: ${validation.reason}`);
      return;
    }

    // 🛡️ 风险管理检查（借鉴 Nautilus Trader）
    const riskCheck = await this.riskManager.validateTrade(modelName, decision, account);
    if (!riskCheck.allowed) {
      console.warn(`[RiskManager] 🚫 Trade rejected for ${decision.coin}:`);
      riskCheck.reasons.forEach(r => console.warn(`   - ${r}`));
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

    // 📡 发出订单提交事件
    this.eventBus.emitSync({
      type: TradingEventType.ORDER_SUBMITTED,
      timestamp: Date.now(),
      modelName,
      coin: decision.coin,
      side,
      notional: decision.notional,
      leverage,
      price: currentPrice,
    });

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

      // 🎯 智能止盈系统初始化
      maxUnrealizedPnL: -fee,
      maxUnrealizedPnLPercent: (-fee / requiredMargin) * 100,
      partialExitsDone: [],
      trailingStopActivated: false,
    };

    account.positions.push(position);
    account.availableCash -= (requiredMargin + fee);

    // 📡 发出持仓开启事件
    this.eventBus.emitSync({
      type: TradingEventType.POSITION_OPENED,
      timestamp: Date.now(),
      modelName,
      position,
    });

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
   * 🎯 三合一智能止盈系统
   * 融合：移动止损 + 高点回撤保护 + 分批止盈
   *
   * @param account 账户状态
   * @param completedTrades 已完成交易列表
   * @param modelName 模型名称
   * @returns 是否触发了智能止盈
   */
  private applySmartProfitProtection(
    account: AccountStatus,
    completedTrades: CompletedTrade[],
    modelName: string
  ): boolean {
    let protectionTriggered = false;

    // 遍历所有持仓（倒序，因为可能会删除）
    for (let i = account.positions.length - 1; i >= 0; i--) {
      const position = account.positions[i];
      const currentPrice = getCurrentPrice(position.coin);
      const requiredMargin = position.notional / position.leverage;

      // 初始化智能止盈字段（兼容旧数据）
      if (!position.partialExitsDone) position.partialExitsDone = [];
      if (!position.maxUnrealizedPnL) position.maxUnrealizedPnL = position.unrealizedPnL;
      if (!position.maxUnrealizedPnLPercent) position.maxUnrealizedPnLPercent = position.unrealizedPnLPercent;

      const pnlPercent = position.unrealizedPnLPercent;
      const maxPnlPercent = position.maxUnrealizedPnLPercent || 0;

      // ==========================================
      // 第1层：分批止盈（主动获利）
      // ==========================================

      // ✅ 浮盈 +50%：平仓 30%
      if (pnlPercent >= 50 && !position.partialExitsDone!.includes(50)) {
        console.log(`[SmartProfit] 🎯 ${position.coin} 浮盈 +${pnlPercent.toFixed(1)}% - 分批止盈 30%`);

        // 注意：nof1.ai 规则禁止部分平仓，这里我们记录触发但不执行
        // 实际应用中，可以修改为全平仓或者在真实交易中实现部分平仓
        position.partialExitsDone!.push(50);

        // TODO: 如果交易所支持部分平仓，在这里实现
        // 暂时只记录日志
        console.log(`[SmartProfit] ⚠️ nof1.ai 规则限制：无法部分平仓，记录触发点`);
      }

      // ✅ 浮盈 +100%：平仓 50%
      if (pnlPercent >= 100 && !position.partialExitsDone!.includes(100)) {
        console.log(`[SmartProfit] 🎯 ${position.coin} 浮盈 +${pnlPercent.toFixed(1)}% - 分批止盈 50%`);
        position.partialExitsDone!.push(100);
        console.log(`[SmartProfit] ⚠️ nof1.ai 规则限制：无法部分平仓，记录触发点`);
      }

      // ✅ 浮盈 +200%：平仓 70%（建议全平）
      if (pnlPercent >= 200 && !position.partialExitsDone!.includes(200)) {
        console.log(`[SmartProfit] 🎯 ${position.coin} 浮盈 +${pnlPercent.toFixed(1)}% - 超高收益，建议全平！`);
        this.closePosition(account, completedTrades, position, currentPrice, 'Smart Profit: 200% gain', modelName);
        protectionTriggered = true;
        continue; // 已平仓，跳过后续检查
      }

      // ==========================================
      // 第2层：高点回撤保护（利润保护）
      // ==========================================

      if (maxPnlPercent > 30) { // 只在有显著浮盈时启用回撤保护
        const drawdownPercent = ((maxPnlPercent - pnlPercent) / Math.abs(maxPnlPercent)) * 100;

        // ✅ 从最高点回撤 15%：全平仓
        if (drawdownPercent >= 15) {
          console.log(`[SmartProfit] 🛡️ ${position.coin} 高点回撤保护触发！`);
          console.log(`   最高浮盈: +${maxPnlPercent.toFixed(1)}%`);
          console.log(`   当前浮盈: +${pnlPercent.toFixed(1)}%`);
          console.log(`   回撤幅度: ${drawdownPercent.toFixed(1)}% (>15%)`);

          this.closePosition(account, completedTrades, position, currentPrice,
            `Smart Profit: Drawdown protection (${drawdownPercent.toFixed(1)}% from peak)`, modelName);
          protectionTriggered = true;
          continue; // 已平仓，跳过后续检查
        }
      }

      // ==========================================
      // 第3层：移动止损（底线防御）
      // ==========================================

      // ✅ 浮盈 +30%：止损价提升到成本价（保本）
      if (pnlPercent >= 30 && !position.trailingStopActivated) {
        const newStopLoss = position.entryPrice; // 保本止损

        if (position.side === 'LONG' && newStopLoss > position.exitPlan.stopLoss) {
          console.log(`[SmartProfit] 🔒 ${position.coin} 移动止损激活：${position.exitPlan.stopLoss.toFixed(2)} → ${newStopLoss.toFixed(2)} (保本)`);
          position.exitPlan.stopLoss = newStopLoss;
          position.trailingStopActivated = true;
        } else if (position.side === 'SHORT' && newStopLoss < position.exitPlan.stopLoss) {
          console.log(`[SmartProfit] 🔒 ${position.coin} 移动止损激活：${position.exitPlan.stopLoss.toFixed(2)} → ${newStopLoss.toFixed(2)} (保本)`);
          position.exitPlan.stopLoss = newStopLoss;
          position.trailingStopActivated = true;
        }
      }

      // ✅ 浮盈 +50%：止损价提升到成本价 +20%
      if (pnlPercent >= 50) {
        const profitLockPercent = 0.20; // 锁定 20% 利润
        const newStopLoss = position.side === 'LONG'
          ? position.entryPrice * (1 + profitLockPercent)
          : position.entryPrice * (1 - profitLockPercent);

        if (position.side === 'LONG' && newStopLoss > position.exitPlan.stopLoss) {
          console.log(`[SmartProfit] 🔒 ${position.coin} 移动止损升级：${position.exitPlan.stopLoss.toFixed(2)} → ${newStopLoss.toFixed(2)} (锁定 +20%)`);
          position.exitPlan.stopLoss = newStopLoss;
        } else if (position.side === 'SHORT' && newStopLoss < position.exitPlan.stopLoss) {
          console.log(`[SmartProfit] 🔒 ${position.coin} 移动止损升级：${position.exitPlan.stopLoss.toFixed(2)} → ${newStopLoss.toFixed(2)} (锁定 +20%)`);
          position.exitPlan.stopLoss = newStopLoss;
        }
      }

      // ✅ 浮盈 +100%：止损价提升到成本价 +40%
      if (pnlPercent >= 100) {
        const profitLockPercent = 0.40; // 锁定 40% 利润
        const newStopLoss = position.side === 'LONG'
          ? position.entryPrice * (1 + profitLockPercent)
          : position.entryPrice * (1 - profitLockPercent);

        if (position.side === 'LONG' && newStopLoss > position.exitPlan.stopLoss) {
          console.log(`[SmartProfit] 🔒 ${position.coin} 移动止损升级：${position.exitPlan.stopLoss.toFixed(2)} → ${newStopLoss.toFixed(2)} (锁定 +40%)`);
          position.exitPlan.stopLoss = newStopLoss;
        } else if (position.side === 'SHORT' && newStopLoss < position.exitPlan.stopLoss) {
          console.log(`[SmartProfit] 🔒 ${position.coin} 移动止损升级：${position.exitPlan.stopLoss.toFixed(2)} → ${newStopLoss.toFixed(2)} (锁定 +40%)`);
          position.exitPlan.stopLoss = newStopLoss;
        }
      }
    }

    return protectionTriggered;
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
        // 📡 发出止损触发事件
        this.eventBus.emitSync({
          type: TradingEventType.STOP_LOSS_TRIGGERED,
          timestamp: Date.now(),
          modelName,
          coin: position.coin,
          currentPrice,
          stopLossPrice: position.exitPlan.stopLoss,
        });
        this.closePosition(account, completedTrades, position, currentPrice, 'Stop loss triggered', modelName);
        continue;
      }

      if (position.side === 'SHORT' && currentPrice >= position.exitPlan.stopLoss) {
        // 📡 发出止损触发事件
        this.eventBus.emitSync({
          type: TradingEventType.STOP_LOSS_TRIGGERED,
          timestamp: Date.now(),
          modelName,
          coin: position.coin,
          currentPrice,
          stopLossPrice: position.exitPlan.stopLoss,
        });
        this.closePosition(account, completedTrades, position, currentPrice, 'Stop loss triggered', modelName);
        continue;
      }

      // 检查止盈
      if (position.side === 'LONG' && currentPrice >= position.exitPlan.takeProfit) {
        // 📡 发出止盈触发事件
        this.eventBus.emitSync({
          type: TradingEventType.TAKE_PROFIT_TRIGGERED,
          timestamp: Date.now(),
          modelName,
          coin: position.coin,
          currentPrice,
          takeProfitPrice: position.exitPlan.takeProfit,
        });
        this.closePosition(account, completedTrades, position, currentPrice, 'Take profit hit', modelName);
        continue;
      }

      if (position.side === 'SHORT' && currentPrice <= position.exitPlan.takeProfit) {
        // 📡 发出止盈触发事件
        this.eventBus.emitSync({
          type: TradingEventType.TAKE_PROFIT_TRIGGERED,
          timestamp: Date.now(),
          modelName,
          coin: position.coin,
          currentPrice,
          takeProfitPrice: position.exitPlan.takeProfit,
        });
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

    // 💾 保存交易到数据库
    this.storage.saveTrade(completedTrade).catch(err =>
      console.error('[Storage] 保存交易失败:', err)
    );

    // 📡 发出持仓关闭事件
    this.eventBus.emitSync({
      type: TradingEventType.POSITION_CLOSED,
      timestamp: Date.now(),
      modelName,
      coin: position.coin,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice,
      pnl: completedTrade.pnl,
      pnlPercent: completedTrade.pnlPercent,
      exitReason,
    });

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

      // 🎯 更新最高浮盈（用于智能止盈系统）
      if (!position.maxUnrealizedPnL || pnl > position.maxUnrealizedPnL) {
        position.maxUnrealizedPnL = pnl;
        position.maxUnrealizedPnLPercent = position.unrealizedPnLPercent;
      }
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
