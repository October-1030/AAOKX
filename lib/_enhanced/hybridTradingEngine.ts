/**
 * 混合增强交易引擎
 * 集成事件驱动架构 + 套利检测 + 严格类型安全
 */

import { 
  AdvancedTradingEngine, 
  TradingEventType,
  PriceUpdateEvent 
} from '../advanced/eventDrivenEngine';
import { 
  ArbitrageDetector, 
  ArbitrageOpportunity 
} from '../advanced/arbitrageDetector';
import {
  StrictDataValidator,
  StrictTradingDecision,
  StrictPosition,
  StrictAccountState,
  SupportedCoin,
  TradingAction,
  createUSD,
  createPercentage,
  Result,
  Ok,
  Err,
  handleResult
} from '../advanced/strictTypes';

// 原有交易引擎的导入
import { getTradingEngine } from '../tradingEngineManager';
import { getRealTradingExecutor } from '../realTradingExecutor';
import { perfectStrategy } from '../perfectTradingStrategy';

/**
 * 混合交易决策
 * 结合AI决策和套利机会
 */
interface HybridDecision {
  aiDecision?: StrictTradingDecision;
  arbitrageOpportunity?: ArbitrageOpportunity;
  finalAction: TradingAction;
  reasoning: string;
  confidence: number;
  urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * 增强交易引擎
 * 整合所有高级功能
 */
export class HybridTradingEngine {
  private advancedEngine = new AdvancedTradingEngine();
  private arbitrageDetector = new ArbitrageDetector();
  private legacyEngine = getTradingEngine();
  private realExecutor = getRealTradingExecutor();
  
  private isRunning = false;
  private decisionInterval: NodeJS.Timeout | null = null;
  private lastDecisionTime = 0;
  private performanceMetrics = {
    totalDecisions: 0,
    arbitrageOpportunities: 0,
    aiDecisions: 0,
    executedTrades: 0,
    avgDecisionTime: 0
  };

  constructor() {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // 价格更新事件处理
    this.advancedEngine.on('priceUpdate', async (data: any) => {
      await this.handlePriceUpdate(data);
    });

    // 套利机会事件处理
    this.advancedEngine.on('arbitrageExecuted', async (data: any) => {
      console.log(`[HybridEngine] 💰 套利机会已执行: ${data.coin} 利润${data.profitPercent.toFixed(2)}%`);
      this.performanceMetrics.arbitrageOpportunities++;
    });
  }

  /**
   * 启动混合交易引擎
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log('🚀 启动混合增强交易引擎...');
    
    // 启动事件驱动引擎
    this.advancedEngine.start();
    this.isRunning = true;

    // 定期执行交易决策 (每3分钟)
    this.decisionInterval = setInterval(async () => {
      await this.executeHybridTradingCycle();
    }, 180000);

    // 立即执行一次
    setTimeout(() => {
      this.executeHybridTradingCycle();
    }, 5000);

    console.log('✅ 混合交易引擎已启动');
  }

  /**
   * 停止交易引擎
   */
  stop(): void {
    if (!this.isRunning) return;

    this.advancedEngine.stop();
    this.isRunning = false;
    
    if (this.decisionInterval) {
      clearInterval(this.decisionInterval);
    }

    console.log('⏹️ 混合交易引擎已停止');
  }

  /**
   * 处理价格更新
   */
  private async handlePriceUpdate(data: { coin: string; price: number; exchange: string }): Promise<void> {
    // 更新套利检测器的订单簿数据
    const supportedCoins = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP'];
    if (supportedCoins.includes(data.coin)) {
      this.arbitrageDetector.updateOrderBook({
        exchange: data.exchange,
        coin: data.coin as SupportedCoin,
        bids: [{ price: createUSD(data.price * 0.999), size: createUSD(1000) }],
        asks: [{ price: createUSD(data.price * 1.001), size: createUSD(1000) }],
        timestamp: Date.now()
      });
    }
  }

  /**
   * 执行混合交易周期
   */
  private async executeHybridTradingCycle(): Promise<void> {
    const cycleStartTime = Date.now();
    
    try {
      console.log('\n🔄 执行混合交易周期...');

      // 1. 获取当前账户状态
      const accountState = await this.getCurrentAccountState();
      if (!accountState.success) {
        console.error('❌ 获取账户状态失败:', accountState.error.message);
        return;
      }

      // 2. 检测套利机会
      const arbitrageOpportunities = this.arbitrageDetector.detectArbitrageOpportunities();
      
      // 3. 获取AI决策
      const aiDecision = await this.getAIDecision(accountState.data);

      // 4. 混合决策分析
      const hybridDecision = await this.analyzeHybridDecision(
        aiDecision, 
        arbitrageOpportunities, 
        accountState.data
      );

      // 5. 执行最终决策
      await this.executeHybridDecision(hybridDecision);

      // 6. 更新性能指标
      this.updatePerformanceMetrics(cycleStartTime);

      console.log('✅ 混合交易周期完成\n');

    } catch (error) {
      console.error('❌ 混合交易周期出错:', error);
    }
  }

  /**
   * 获取当前账户状态（使用严格类型）
   */
  private async getCurrentAccountState(): Promise<Result<StrictAccountState>> {
    try {
      const positions = await this.realExecutor.getCurrentPositions();
      const accountInfo = await this.realExecutor.getAccountLimits();

      // 转换为严格类型
      const strictPositions: StrictPosition[] = [];
      for (const pos of positions) {
        const posResult = StrictDataValidator.validatePosition({
          id: `${pos.coin}_${Date.now()}`,
          coin: pos.coin,
          side: pos.side,
          entryPrice: pos.entryPrice,
          size: (pos as any).size || 100,
          leverage: (pos as any).leverage || 1,
          entryTime: (pos as any).entryTime || Date.now(),
          maxProfit: (pos as any).maxProfit,
          currentProfit: (pos as any).unrealizedPnLPercent,
          exitPlan: (pos as any).exitPlan
        });

        if (posResult.success) {
          strictPositions.push(posResult.data);
        }
      }

      const accountState: StrictAccountState = {
        balance: createUSD(accountInfo.accountBalance),
        marginUsed: createUSD(accountInfo.accountBalance * 0.1), // 估算
        availableMargin: createUSD(accountInfo.accountBalance * 0.9),
        positions: strictPositions,
        timestamp: Date.now() as any
      };

      return Ok(accountState);
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * 获取AI交易决策
   */
  private async getAIDecision(accountState: StrictAccountState): Promise<Result<StrictTradingDecision>> {
    try {
      // 调用原有的AI决策系统
      await (this.legacyEngine as any).updateMarketData();
      const decision = await (this.legacyEngine as any).generateTradingDecision('DeepSeek-V3');

      if (!decision) {
        return Err(new Error('AI未生成有效决策'));
      }

      // 验证AI决策
      const validationResult = StrictDataValidator.validateTradingDecision(decision);
      return validationResult;

    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * 混合决策分析
   * 优先级: 套利机会 > Perfect Strategy止损 > AI决策
   */
  private async analyzeHybridDecision(
    aiDecisionResult: Result<StrictTradingDecision>,
    arbitrageOpportunities: ArbitrageOpportunity[],
    accountState: StrictAccountState
  ): Promise<HybridDecision> {
    
    let finalAction: TradingAction = TradingAction.HOLD;
    let reasoning = '';
    let confidence = 0;
    let urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    // 1. 最高优先级：套利机会
    const bestArbitrage = arbitrageOpportunities
      .filter(opp => this.arbitrageDetector.validateOpportunity(opp))
      .sort((a, b) => Number(b.netProfitPercent) - Number(a.netProfitPercent))[0];

    if (bestArbitrage && Number(bestArbitrage.netProfitPercent) > 1) {
      finalAction = TradingAction.BUY_TO_ENTER;
      reasoning = `套利机会: ${bestArbitrage.coin} 净利润${bestArbitrage.netProfitPercent.toFixed(2)}%`;
      confidence = Math.min(Number(bestArbitrage.netProfitPercent) / 5, 1);
      urgencyLevel = Number(bestArbitrage.netProfitPercent) > 3 ? 'CRITICAL' : 'HIGH';
      
      return {
        arbitrageOpportunity: bestArbitrage,
        finalAction,
        reasoning,
        confidence,
        urgencyLevel
      };
    }

    // 2. 第二优先级：Perfect Strategy风险管理
    if (accountState.positions.length > 0) {
      for (const position of accountState.positions) {
        // 使用Perfect Strategy检查每个仓位
        const currentPrice = this.advancedEngine.getBestPrice(position.coin)?.price || position.entryPrice;
        
        // 简化的风险检查
        const currentProfit = position.side === 'LONG' 
          ? ((Number(currentPrice) - Number(position.entryPrice)) / Number(position.entryPrice)) * 100
          : ((Number(position.entryPrice) - Number(currentPrice)) / Number(position.entryPrice)) * 100;

        if (currentProfit < -3) { // 亏损超过3%
          finalAction = TradingAction.CLOSE;
          reasoning = `风险管理: ${position.coin} 亏损${Math.abs(currentProfit).toFixed(2)}%，触发止损`;
          confidence = 0.9;
          urgencyLevel = 'HIGH';
          
          return { finalAction, reasoning, confidence, urgencyLevel };
        }
      }
    }

    // 3. 第三优先级：AI决策
    if (aiDecisionResult.success) {
      const aiDecision = aiDecisionResult.data;
      finalAction = aiDecision.action;
      reasoning = `AI决策: ${aiDecision.reasoning}`;
      confidence = Number(aiDecision.confidence) / 100;
      urgencyLevel = Number(aiDecision.confidence) > 80 ? 'MEDIUM' : 'LOW';

      return {
        aiDecision,
        finalAction,
        reasoning,
        confidence,
        urgencyLevel
      };
    }

    // 4. 默认：保持
    return {
      finalAction: TradingAction.HOLD,
      reasoning: '无有效交易信号，保持当前状态',
      confidence: 0.1,
      urgencyLevel: 'LOW'
    };
  }

  /**
   * 执行混合决策
   */
  private async executeHybridDecision(decision: HybridDecision): Promise<void> {
    console.log(`[HybridEngine] 🎯 决策分析:`);
    console.log(`   动作: ${decision.finalAction}`);
    console.log(`   原因: ${decision.reasoning}`);
    console.log(`   置信度: ${(decision.confidence * 100).toFixed(1)}%`);
    console.log(`   紧急程度: ${decision.urgencyLevel}`);

    // 根据紧急程度决定是否执行
    if (decision.confidence < 0.3 && decision.urgencyLevel === 'LOW') {
      console.log(`[HybridEngine] ℹ️ 信号太弱，跳过执行`);
      return;
    }

    try {
      if (decision.arbitrageOpportunity) {
        await this.executeArbitrageOpportunity(decision.arbitrageOpportunity);
      } else if (decision.aiDecision) {
        await this.executeAIDecision(decision.aiDecision);
      }
      
      this.performanceMetrics.executedTrades++;
    } catch (error) {
      console.error('[HybridEngine] ❌ 决策执行失败:', error);
    }
  }

  /**
   * 执行套利机会
   */
  private async executeArbitrageOpportunity(opportunity: ArbitrageOpportunity): Promise<void> {
    console.log(`[HybridEngine] 💰 执行套利: ${opportunity.coin}`);
    
    // 这里实现套利执行逻辑
    // 注意：当前只在Hyperliquid上交易，所以套利功能主要是演示
    console.log(`   预期利润: $${opportunity.estimatedNetProfit.toFixed(2)}`);
    console.log(`   风险评分: ${opportunity.riskScore.toFixed(1)}`);
  }

  /**
   * 执行AI决策
   */
  private async executeAIDecision(decision: StrictTradingDecision): Promise<void> {
    console.log(`[HybridEngine] 🤖 执行AI决策: ${decision.action}`);
    
    // 转换回原有格式并执行
    const legacyDecision = {
      action: decision.action,
      coin: decision.coin,
      confidence: Number(decision.confidence) / 100,
      leverage: decision.leverage,
      notional: decision.notional ? Number(decision.notional) : undefined,
      exitPlan: decision.exitPlan ? {
        stopLoss: Number(decision.exitPlan.stopLoss),
        takeProfit: Number(decision.exitPlan.takeProfit),
        invalidation: decision.exitPlan.invalidation
      } : undefined
    };

    const currentPositions = await this.realExecutor.getCurrentPositions();
    const result = await this.realExecutor.executeDecision('HybridEngine', legacyDecision as any, currentPositions);
    
    console.log(`[HybridEngine] ${result.success ? '✅' : '❌'} ${result.message}`);
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(cycleStartTime: number): void {
    const duration = Date.now() - cycleStartTime;
    this.performanceMetrics.totalDecisions++;
    this.performanceMetrics.avgDecisionTime = 
      (this.performanceMetrics.avgDecisionTime + duration) / 2;

    if (this.performanceMetrics.totalDecisions % 10 === 0) {
      this.logPerformanceMetrics();
    }
  }

  /**
   * 输出性能指标
   */
  private logPerformanceMetrics(): void {
    console.log('\n📊 混合引擎性能指标:');
    console.log(`   总决策次数: ${this.performanceMetrics.totalDecisions}`);
    console.log(`   套利机会: ${this.performanceMetrics.arbitrageOpportunities}`);
    console.log(`   AI决策: ${this.performanceMetrics.aiDecisions}`);
    console.log(`   执行交易: ${this.performanceMetrics.executedTrades}`);
    console.log(`   平均决策时间: ${this.performanceMetrics.avgDecisionTime.toFixed(0)}ms\n`);
  }

  /**
   * 获取系统状态
   */
  getSystemStatus(): {
    isRunning: boolean;
    performanceMetrics: any;
    advancedEngineStatus: any;
    arbitrageStats: any;
  } {
    return {
      isRunning: this.isRunning,
      performanceMetrics: this.performanceMetrics,
      advancedEngineStatus: this.advancedEngine.getSystemStatus(),
      arbitrageStats: this.arbitrageDetector.getStatistics()
    };
  }

  /**
   * 手动更新价格（用于测试）
   */
  updatePrice(coin: SupportedCoin, price: number, exchange: string = 'hyperliquid'): void {
    this.advancedEngine.updatePrice(coin, price, exchange);
  }
}

// 导出单例
export const hybridTradingEngine = new HybridTradingEngine();