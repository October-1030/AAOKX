/**
 * 真实交易执行器（OKX-only 架构）
 * NOTE: 系统已重构为 OKX 单交易所架构，Hyperliquid 支持已移除
 *
 * 功能：
 * - 执行 AI 决策（开仓/平仓）
 * - 整合 TradeLog 记录交易和盈亏
 * - 自动止损/止盈管理
 */

// NOTE: Hyperliquid 客户端导入已移除，系统现在只使用 OKX
// import { getHyperliquidClient } from './hyperliquidClient';
import { getOKXClient } from './okxClient';
import { getCoinGlassClient } from './coinglassClient';
import {
  calculateTradingLimits,
  validateOrder,
  adjustOrderSize,
  getRiskWarnings,
} from './tradingConfig';
import { Coin, Position, TradingDecision } from '@/types/trading';
import { getTradeLog, TradeStatus } from './tradeLog';

// NOTE: 系统已重构为 OKX-only 架构，Hyperliquid 选项已移除
export type Exchange = 'okx';

export interface RealTradingExecutorConfig {
  dryRun: boolean; // 模拟模式（不执行真实订单）
  enableRiskChecks: boolean; // 启用风险检查
  maxDailyTrades: number; // 每日最大交易次数
  exchange: Exchange; // 交易所选择
}

export class RealTradingExecutor {
  // NOTE: Hyperliquid 客户端已移除，系统现在只使用 OKX
  // private hyperliquid = getHyperliquidClient();
  private okx = getOKXClient();
  private coinglass = getCoinGlassClient();
  private config: RealTradingExecutorConfig;
  private dailyTradeCount: number = 0;
  private lastResetDate: string = '';
  // 🔥 存储每个仓位的 exitPlan（止损/止盈）
  private exitPlans: Map<Coin, { stopLoss: number; takeProfit: number; invalidation: string }> = new Map();

  constructor(config: Partial<RealTradingExecutorConfig> = {}) {
    this.config = {
      dryRun: config.dryRun ?? true, // 默认模拟模式
      enableRiskChecks: config.enableRiskChecks ?? true,
      maxDailyTrades: config.maxDailyTrades ?? 150, // 每日最大150次交易（3分钟周期 × 24小时）
      exchange: config.exchange ?? 'okx', // 默认使用OKX
    };

    console.log('[RealTrading] 🚀 初始化真实交易执行器');
    console.log(`[RealTrading] 交易所: ${this.config.exchange.toUpperCase()}`);
    console.log(`[RealTrading] 模式: ${this.config.dryRun ? '模拟' : '真实交易'}`);

    this.resetDailyCounter();
  }

  /**
   * 重置每日计数器
   */
  private resetDailyCounter() {
    const today = new Date().toISOString().split('T')[0];
    if (this.lastResetDate !== today) {
      this.dailyTradeCount = 0;
      this.lastResetDate = today;
      console.log('[RealTrading] 📅 每日交易计数器已重置');
    }
  }

  /**
   * 获取账户信息和交易限制（OKX-only）
   * NOTE: 系统已重构为 OKX 单交易所架构
   */
  async getAccountLimits() {
    try {
      if (!this.okx.isAvailable()) {
        console.warn('[RealTrading] ⚠️ OKX 未配置，使用默认限制');
        return calculateTradingLimits(1000); // 默认 $1,000
      }

      const accountInfo = await this.okx.getAccountInfo();
      const balance = parseFloat(accountInfo.totalEq || '0');

      console.log(`[RealTrading] 💰 OKX 账户余额: $${balance.toFixed(2)}`);

      const limits = calculateTradingLimits(balance);
      const warnings = getRiskWarnings(limits);

      warnings.forEach(warning => console.log(`[RealTrading] ${warning}`));

      return limits;
    } catch (error) {
      console.error('[RealTrading] ❌ 获取账户限制失败:', error);
      return calculateTradingLimits(1000); // 降级到默认值
    }
  }

  /**
   * 执行交易决策
   */
  async executeDecision(
    modelName: string,
    decision: TradingDecision,
    currentPositions: Position[]
  ): Promise<{ success: boolean; message: string; newPositions?: Position[] }> {
    this.resetDailyCounter();

    console.log(`\n[RealTrading] 📊 ${modelName} - 执行交易决策`);
    console.log(`[RealTrading] 动作: ${decision.action}`);

    // 🔥 优先检查止损/止盈（无论AI决策是什么）
    console.log(`[RealTrading] 🔍 优先检查所有持仓的止损/止盈条件...`);
    const autoCloseResult = await this.checkAndExecuteAutoClose(currentPositions);
    if (autoCloseResult.closed > 0) {
      console.log(`[RealTrading] 🚨 自动平仓了 ${autoCloseResult.closed} 个仓位，跳过AI决策`);
      return {
        success: true,
        message: `Auto-closed ${autoCloseResult.closed} position(s) due to SL/TP, skipped AI decision`
      };
    }

    // 检查每日交易限制
    if (this.dailyTradeCount >= this.config.maxDailyTrades) {
      const msg = `⚠️ 已达到每日最大交易次数 (${this.config.maxDailyTrades})`;
      console.warn(`[RealTrading] ${msg}`);
      return { success: false, message: msg };
    }

    // 获取账户限制
    const limits = await this.getAccountLimits();

    try {
      // 根据决策类型执行（nof1.ai 格式）
      switch (decision.action) {
        case 'hold':
          console.log('[RealTrading] ℹ️ 保持当前仓位');

          // 🔥 关键修复：检查所有持仓的止损/止盈条件
          const autoCloseResult = await this.checkAndExecuteAutoClose(currentPositions);
          if (autoCloseResult.closed > 0) {
            return {
              success: true,
              message: `Hold position (auto-closed ${autoCloseResult.closed} position(s) due to SL/TP)`
            };
          }

          return { success: true, message: 'Hold position' };

        case 'buy_to_enter':
          return await this.executeOpenPosition(decision, limits, 'LONG');

        case 'sell_to_enter':
          return await this.executeOpenPosition(decision, limits, 'SHORT');

        case 'close':
          // AI 决策的平仓默认为 'closed'，除非调用方另有指定
          return await this.executeClosePosition(decision, currentPositions, 'closed');

        default:
          console.log(`[RealTrading] ⚠️ 未知动作: ${decision.action}`);
          return { success: false, message: `Unknown action: ${decision.action}` };
      }
    } catch (error) {
      console.error('[RealTrading] ❌ 执行失败:', error);
      return {
        success: false,
        message: `Execution error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * @deprecated 自动平仓逻辑已迁移到 RealtimeMonitor
   * NOTE: 此方法保留作为最后防线，但主动监控价格并决定是否平仓的职责
   * 已经统一到 lib/realtimeMonitor.ts。RealTradingExecutor 现在只负责执行平仓指令。
   *
   * 🔥 智能风险管理系统（Perfect Trading Strategy + Trailing Stop）
   * 使用先进的风险管理策略，根据最高盈利点动态调整止损
   * 对于没有 exitPlan 的旧仓位，使用紧急止损保护
   */
  private async checkAndExecuteAutoClose(positions: Position[]): Promise<{ closed: number; reasons: string[] }> {
    const { getCurrentPrice } = await import('./marketData');
    const { perfectStrategy } = await import('./perfectTradingStrategy');
    const { trailingStopSystem } = await import('./trailingStopSystem');

    let closedCount = 0;
    const closeReasons: string[] = [];
    const closedCoins = new Set<string>(); // 记录已平仓的币种

    for (const position of positions) {
      // 跳过已经平仓的币种
      if (closedCoins.has(position.coin)) {
        console.log(`[RealTrading] ⏭️ ${position.coin} 已平仓，跳过`);
        continue;
      }
      const currentPrice = getCurrentPrice(position.coin);
      
      // 🎯 使用Perfect Trading Strategy进行智能止损决策
      const currentProfit = position.side === 'LONG' 
        ? ((currentPrice - position.entryPrice) / position.entryPrice) * 100
        : ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
      
      // 获取最高盈利（如果没有记录，使用当前盈利）
      const maxProfit = Math.max(currentProfit, position.maxUnrealizedPnLPercent || currentProfit);

      // 持仓时间（小时）
      const holdingHours = (Date.now() - (position.openedAt || Date.now())) / (1000 * 60 * 60);
      
      // 使用Perfect Trading Strategy获取退出决策
      const strategyDecision = perfectStrategy.getOptimalExitStrategy({
        currentPrice,
        entryPrice: position.entryPrice,
        highestPrice: position.side === 'LONG' ? 
          position.entryPrice * (1 + maxProfit / 100) : 
          position.entryPrice * (1 - maxProfit / 100),
        currentProfit,
        maxProfit,
        holdingHours,
        positionSize: position.notional || 100, // 默认仓位大小（名义价值）
        adx: 25, // 默认ADX值
        volatility: 0.03, // 默认波动率
        trend: currentProfit > 0 ? 'UP' : 'DOWN'
      });

      // 🔥 根据策略决策执行操作
      if (strategyDecision.action === 'FULL_CLOSE' || strategyDecision.action === 'PARTIAL_CLOSE') {
        console.log(`[RealTrading] 🎯 ${position.coin} Perfect Strategy 触发: ${strategyDecision.action}`);
        console.log(`   原因: ${strategyDecision.reason}`);
        console.log(`   当前盈利: ${currentProfit.toFixed(2)}%`);
        console.log(`   最大盈利: ${maxProfit.toFixed(2)}%`);
        console.log(`   持仓时间: ${holdingHours.toFixed(1)}小时`);
        console.log(`   止损价: $${strategyDecision.stopLoss.toFixed(2)}`);

        // 显式传入 closeStatus，根据盈亏判断是止损还是止盈
        const perfectCloseStatus: TradeStatus = currentProfit < 0 ? 'stopped' : 'tp_hit';
        const closeResult = await this.executeClosePosition({
          action: 'close',
          coin: position.coin,
          confidence: 1.0,
          exitPlan: {
            invalidation: strategyDecision.reason,
            stopLoss: currentPrice,
            takeProfit: currentPrice,
          },
        }, positions, perfectCloseStatus, strategyDecision.reason);

        if (closeResult.success) {
          closedCount++;
          closeReasons.push(`${position.coin}: ${strategyDecision.reason}`);
          closedCoins.add(position.coin); // 标记为已平仓
          console.log(`[RealTrading] ✅ ${position.coin} 平仓成功 - Perfect Strategy`);
        } else {
          console.error(`[RealTrading] ❌ ${position.coin} 平仓失败:`, closeResult.message);
        }
        continue;
      }

      // 🛡️ 紧急止损系统：对于没有 exitPlan 的旧仓位或极端损失
      if (!position.exitPlan || (position.exitPlan.stopLoss === 0 && position.exitPlan.takeProfit === 0)) {
        console.warn(`[RealTrading] ⚠️ ${position.coin} 缺少有效的 exitPlan，启用紧急止损保护`);

        // 🛑 紧急止损规则：价格跌幅超过 -3%（做多）或 +3%（做空）
        const emergencyStopLossPercent = -3;

        if (position.side === 'LONG' && currentProfit <= emergencyStopLossPercent) {
          console.log(`[RealTrading] 🚨 ${position.coin} 触发紧急止损！（旧仓位保护）`);
          console.log(`   入场价格: $${position.entryPrice.toFixed(2)}`);
          console.log(`   当前价格: $${currentPrice.toFixed(2)}`);
          console.log(`   价格变化: ${currentProfit.toFixed(2)}%`);

          const closeResult = await this.executeClosePosition({
            action: 'close',
            coin: position.coin,
            confidence: 1.0,
            exitPlan: {
              invalidation: 'Emergency stop loss triggered',
              stopLoss: currentPrice,
              takeProfit: currentPrice,
            },
          }, positions, 'stopped', `Emergency Stop Loss (${currentProfit.toFixed(2)}%)`);

          if (closeResult.success) {
            closedCount++;
            closeReasons.push(`${position.coin} Emergency Stop Loss (${currentProfit.toFixed(2)}%)`);
            closedCoins.add(position.coin); // 标记为已平仓
          }
          continue;
        }

        if (position.side === 'SHORT' && currentProfit <= emergencyStopLossPercent) {
          console.log(`[RealTrading] 🚨 ${position.coin} 触发紧急止损！（做空，旧仓位保护）`);
          console.log(`   入场价格: $${position.entryPrice.toFixed(2)}`);
          console.log(`   当前价格: $${currentPrice.toFixed(2)}`);
          console.log(`   价格变化: ${currentProfit.toFixed(2)}%`);

          const closeResult = await this.executeClosePosition({
            action: 'close',
            coin: position.coin,
            confidence: 1.0,
            exitPlan: {
              invalidation: 'Emergency stop loss triggered (SHORT)',
              stopLoss: currentPrice,
              takeProfit: currentPrice,
            },
          }, positions, 'stopped', `Emergency Stop Loss SHORT (${currentProfit.toFixed(2)}%)`);

          if (closeResult.success) {
            closedCount++;
            closeReasons.push(`${position.coin} Emergency Stop Loss (${currentProfit.toFixed(2)}%)`);
            closedCoins.add(position.coin); // 标记为已平仓
          }
          continue;
        }

        // 🎯 紧急止盈规则：价格涨幅超过 +20%（做多）或 -20%（做空）
        const emergencyTakeProfitPercent = 20;

        if (position.side === 'LONG' && currentProfit >= emergencyTakeProfitPercent) {
          console.log(`[RealTrading] 🎯 ${position.coin} 触发紧急止盈！（旧仓位保护）`);
          console.log(`   入场价格: $${position.entryPrice.toFixed(2)}`);
          console.log(`   当前价格: $${currentPrice.toFixed(2)}`);
          console.log(`   价格涨幅: +${currentProfit.toFixed(2)}%`);

          const closeResult = await this.executeClosePosition({
            action: 'close',
            coin: position.coin,
            confidence: 1.0,
            exitPlan: {
              invalidation: 'Emergency take profit triggered',
              stopLoss: currentPrice,
              takeProfit: currentPrice,
            },
          }, positions, 'tp_hit', `Emergency Take Profit (+${currentProfit.toFixed(2)}%)`);

          if (closeResult.success) {
            closedCount++;
            closeReasons.push(`${position.coin} Emergency Take Profit (+${currentProfit.toFixed(2)}%)`);
            closedCoins.add(position.coin); // 标记为已平仓
          }
          continue;
        }

        if (position.side === 'SHORT' && currentProfit >= emergencyTakeProfitPercent) {
          console.log(`[RealTrading] 🎯 ${position.coin} 触发紧急止盈！（做空，旧仓位保护）`);
          console.log(`   入场价格: $${position.entryPrice.toFixed(2)}`);
          console.log(`   当前价格: $${currentPrice.toFixed(2)}`);
          console.log(`   价格利润: ${currentProfit.toFixed(2)}%`);

          const closeResult = await this.executeClosePosition({
            action: 'close',
            coin: position.coin,
            confidence: 1.0,
            exitPlan: {
              invalidation: 'Emergency take profit triggered (SHORT)',
              stopLoss: currentPrice,
              takeProfit: currentPrice,
            },
          }, positions, 'tp_hit', `Emergency Take Profit SHORT (+${Math.abs(currentProfit).toFixed(2)}%)`);

          if (closeResult.success) {
            closedCount++;
            closeReasons.push(`${position.coin} Emergency Take Profit (+${Math.abs(currentProfit).toFixed(2)}%)`);
            closedCoins.add(position.coin); // 标记为已平仓
          }
          continue;
        }

        // 如果没有触发紧急止损/止盈，继续监控
        console.log(`[RealTrading] 👀 ${position.coin} 紧急保护监控中 (${currentProfit >= 0 ? '+' : ''}${currentProfit.toFixed(2)}%)`);
        continue;
      }

      // 正常的 exitPlan 检查（有止损/止盈计划的新仓位）
      const { stopLoss, takeProfit } = position.exitPlan;

      // 检查做多止损
      if (position.side === 'LONG' && currentPrice <= stopLoss) {
        console.log(`[RealTrading] 🛑 ${position.coin} 触发止损！`);
        console.log(`   当前价格: $${currentPrice.toFixed(2)}`);
        console.log(`   止损价格: $${stopLoss.toFixed(2)}`);
        console.log(`   浮动亏损: ${position.unrealizedPnLPercent?.toFixed(2)}%`);

        const closeResult = await this.executeClosePosition({
          action: 'close',
          coin: position.coin,
          confidence: 1.0,
          exitPlan: position.exitPlan,
        }, positions, 'stopped', `Stop Loss triggered at $${stopLoss.toFixed(2)}`);

        if (closeResult.success) {
          closedCount++;
          closeReasons.push(`${position.coin} Stop Loss (-${Math.abs(position.unrealizedPnLPercent || 0).toFixed(2)}%)`);
          closedCoins.add(position.coin); // 标记为已平仓
        }
        continue;
      }

      // 检查做多止盈
      if (position.side === 'LONG' && currentPrice >= takeProfit) {
        console.log(`[RealTrading] 🎯 ${position.coin} 触发止盈！`);
        console.log(`   当前价格: $${currentPrice.toFixed(2)}`);
        console.log(`   止盈价格: $${takeProfit.toFixed(2)}`);
        console.log(`   浮动盈利: +${position.unrealizedPnLPercent?.toFixed(2)}%`);

        const closeResult = await this.executeClosePosition({
          action: 'close',
          coin: position.coin,
          confidence: 1.0,
          exitPlan: position.exitPlan,
        }, positions, 'tp_hit', `Take Profit triggered at $${takeProfit.toFixed(2)}`);

        if (closeResult.success) {
          closedCount++;
          closeReasons.push(`${position.coin} Take Profit (+${position.unrealizedPnLPercent?.toFixed(2)}%)`);
          closedCoins.add(position.coin); // 标记为已平仓
        }
        continue;
      }

      // 检查做空止损
      if (position.side === 'SHORT' && currentPrice >= stopLoss) {
        console.log(`[RealTrading] 🛑 ${position.coin} 触发止损（做空）！`);
        console.log(`   当前价格: $${currentPrice.toFixed(2)}`);
        console.log(`   止损价格: $${stopLoss.toFixed(2)}`);
        console.log(`   浮动亏损: ${position.unrealizedPnLPercent?.toFixed(2)}%`);

        const closeResult = await this.executeClosePosition({
          action: 'close',
          coin: position.coin,
          confidence: 1.0,
          exitPlan: position.exitPlan,
        }, positions, 'stopped', `Stop Loss SHORT triggered at $${stopLoss.toFixed(2)}`);

        if (closeResult.success) {
          closedCount++;
          closeReasons.push(`${position.coin} Stop Loss (-${Math.abs(position.unrealizedPnLPercent || 0).toFixed(2)}%)`);
          closedCoins.add(position.coin); // 标记为已平仓
        }
        continue;
      }

      // 检查做空止盈
      if (position.side === 'SHORT' && currentPrice <= takeProfit) {
        console.log(`[RealTrading] 🎯 ${position.coin} 触发止盈（做空）！`);
        console.log(`   当前价格: $${currentPrice.toFixed(2)}`);
        console.log(`   止盈价格: $${takeProfit.toFixed(2)}`);
        console.log(`   浮动盈利: +${position.unrealizedPnLPercent?.toFixed(2)}%`);

        const closeResult = await this.executeClosePosition({
          action: 'close',
          coin: position.coin,
          confidence: 1.0,
          exitPlan: position.exitPlan,
        }, positions, 'tp_hit', `Take Profit SHORT triggered at $${takeProfit.toFixed(2)}`);

        if (closeResult.success) {
          closedCount++;
          closeReasons.push(`${position.coin} Take Profit (+${position.unrealizedPnLPercent?.toFixed(2)}%)`);
          closedCoins.add(position.coin); // 标记为已平仓
        }
        continue;
      }
    }

    if (closedCount > 0) {
      console.log(`[RealTrading] ✅ 自动平仓完成：${closedCount} 个仓位`);
      closeReasons.forEach(reason => console.log(`   - ${reason}`));
    }

    return { closed: closedCount, reasons: closeReasons };
  }

  /**
   * 开仓
   */
  private async executeOpenPosition(decision: TradingDecision, limits: any, side: 'LONG' | 'SHORT') {
    const { coin, leverage, notional } = decision;

    if (!coin || !leverage || !notional) {
      return { success: false, message: 'Missing required parameters' };
    }

    // ✅ 先验证决策（风险回报比、止损止盈方向）
    const { getCurrentPrice } = await import('./marketData');
    const { validateTradingDecision } = await import('./tradingEngine');
    const currentPrice = getCurrentPrice(coin);

    const validation = validateTradingDecision(decision, currentPrice, side);
    if (!validation.valid) {
      console.warn(`[RealTrading] ❌ 决策验证失败: ${validation.reason}`);
      return { success: false, message: `Decision validation failed: ${validation.reason}` };
    }

    // 使用 notional（美元金额）
    const sizeInUsd = notional;

    // 调整订单大小（美元）
    const adjustedSizeInUsd = adjustOrderSize(coin, sizeInUsd, limits);

    if (adjustedSizeInUsd === 0) {
      return {
        success: false,
        message: `${coin} 不可交易或订单量不足`,
      };
    }

    // 验证订单（美元）
    const orderValidation = validateOrder(coin, adjustedSizeInUsd, leverage, limits);
    if (!orderValidation.valid) {
      console.warn(`[RealTrading] ❌ 订单验证失败: ${orderValidation.reason}`);
      return { success: false, message: orderValidation.reason || 'Validation failed' };
    }

    console.log(`[RealTrading] 📝 开仓 ${side}:`, {
      coin,
      originalSize: sizeInUsd,
      adjustedSize: adjustedSizeInUsd,
      leverage,
    });

    // 模拟模式
    if (this.config.dryRun) {
      console.log('[RealTrading] 🧪 [模拟模式] 订单未实际提交');
      this.dailyTradeCount++;
      return {
        success: true,
        message: `[DRY RUN] ${side} ${coin} $${adjustedSizeInUsd.toFixed(2)} @ ${leverage}x`,
      };
    }

    // 真实交易（OKX-only）
    try {
      // NOTE: 系统已重构为 OKX-only 架构，直接使用 OKX 客户端
      const client = this.okx;

      // 先设置杠杆
      await client.setLeverage(coin, leverage);

      // 下市价单
      const order = await client.placeMarketOrder({
        coin,
        side,
        size: adjustedSizeInUsd,
        leverage,
      });

      this.dailyTradeCount++;

      // 🔥 存储 exitPlan（止损/止盈）
      if (decision.exitPlan) {
        this.exitPlans.set(coin, decision.exitPlan);
        console.log(`[RealTrading] 💾 存储 ${coin} exitPlan:`, {
          stopLoss: decision.exitPlan.stopLoss,
          takeProfit: decision.exitPlan.takeProfit,
        });
      }

      // 📊 记录到 TradeLog
      const tradeLog = getTradeLog();
      const { getCurrentPrice } = await import('./marketData');
      const entryPrice = getCurrentPrice(coin);

      tradeLog.addOpenTrade({
        symbol: coin,
        side: side === 'LONG' ? 'long' : 'short',
        notional: adjustedSizeInUsd,
        leverage,
        entryPrice,
        stopLoss: decision.exitPlan?.stopLoss,
        takeProfit: decision.exitPlan?.takeProfit,
        openedAt: Date.now(),
        // AI 解释字段
        aiReason: decision.aiReason || decision.justification,
        marketContext: decision.marketContext,
        riskNote: decision.riskNote,
        modelName: 'deepseek-v3',
        confidence: decision.confidence,
      });

      console.log('[RealTrading] ✅ 订单已提交:', order);
      return {
        success: true,
        message: `${side} ${coin} $${adjustedSizeInUsd.toFixed(2)} @ ${leverage}x`,
      };
    } catch (error) {
      console.error('[RealTrading] ❌ 下单失败:', error);
      return {
        success: false,
        message: `Order failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 平仓（支持现货和期货）
   * @param decision 交易决策
   * @param currentPositions 当前持仓列表
   * @param closeStatus 平仓状态（由调用方显式传入，不再通过文本猜测）
   * @param closeReason 平仓原因（可选）
   */
  private async executeClosePosition(
    decision: TradingDecision,
    currentPositions?: Position[],
    closeStatus: TradeStatus = 'closed',
    closeReason?: string
  ) {
    const { coin } = decision;

    if (!coin) {
      return { success: false, message: 'Missing coin parameter' };
    }

    // 查找当前持仓信息
    const position = currentPositions?.find(p => p.coin === coin);
    const isSpot = position && (position as any).isSpot === true;

    // 使用传入的 closeReason，或从 decision 中获取
    const finalReason = closeReason || decision.aiReason || decision.justification || '';

    console.log(`[RealTrading] 🔄 平仓: ${coin} (${isSpot ? '现货' : '期货'}) [${closeStatus}]`);

    if (isSpot && position) {
      // 从名义价值计算实际数量
      const spotSize = position.notional / position.currentPrice;
      console.log(`[RealTrading] 💼 现货卖出: ${spotSize.toFixed(4)} ${coin} @ 市价`);
    }

    // 模拟模式
    if (this.config.dryRun) {
      console.log('[RealTrading] 🧪 [模拟模式] 平仓未实际执行');
      this.dailyTradeCount++;
      return {
        success: true,
        message: `[DRY RUN] Close ${coin} (${isSpot ? 'SPOT' : 'FUTURES'}) [${closeStatus}]`,
      };
    }

    // 真实交易（OKX-only）
    try {
      // NOTE: 系统已重构为 OKX-only 架构，直接使用 OKX 客户端
      let result;
      if (isSpot && position) {
        // ✅ 现货平仓：使用市价卖单
        // 从名义价值计算实际数量
        const spotSize = position.notional / position.currentPrice;
        result = await this.okx.closeSpotPosition(coin, spotSize);
      } else {
        // ✅ 期货平仓：使用合约平仓API
        result = await this.okx.closePosition(coin);
      }

      this.dailyTradeCount++;

      // 🔥 删除存储的 exitPlan
      if (this.exitPlans.has(coin)) {
        this.exitPlans.delete(coin);
        console.log(`[RealTrading] 🗑️ 删除 ${coin} exitPlan`);
      }

      // 📊 更新 TradeLog - 关闭交易记录
      // closeStatus 直接使用参数传入的值，不再通过文本匹配猜测
      const tradeLog = getTradeLog();
      const { getCurrentPrice } = await import('./marketData');
      const exitPrice = getCurrentPrice(coin);

      tradeLog.closeTradeBySymbol(coin, exitPrice, closeStatus, finalReason);

      // 更新净值（从 OKX 获取最新账户余额）
      try {
        const accountInfo = await this.okx.getAccountInfo();
        const equity = parseFloat(accountInfo.totalEq || '0');
        if (equity > 0) {
          tradeLog.updateEquity(equity);
        }
      } catch (e) {
        console.warn('[RealTrading] 无法更新净值:', e);
      }

      console.log(`[RealTrading] ✅ 平仓成功 (${isSpot ? '现货卖出' : '期货平仓'}) [${closeStatus}]`);
      return {
        success: true,
        message: `Closed ${coin} (${isSpot ? 'SPOT' : 'FUTURES'}) [${closeStatus}]`,
      };
    } catch (error) {
      console.error('[RealTrading] ❌ 平仓失败:', error);
      return {
        success: false,
        message: `Close failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 调整仓位 - nof1.ai 不支持，已废弃
   * @deprecated nof1.ai 规则禁止 pyramiding，此方法不再使用
   */
  private async executeAdjustPosition(decision: TradingDecision, limits: any) {
    console.warn('[RealTrading] ⚠️ 加仓功能已禁用（nof1.ai 规则）');
    return { success: false, message: 'Adjust position not allowed (nof1.ai rules)' };
  }

  /**
   * 获取当前持仓（OKX-only）
   * NOTE: 系统已重构为 OKX 单交易所架构
   */
  async getCurrentPositions(): Promise<Position[]> {
    if (this.config.dryRun || !this.okx.isAvailable()) {
      console.log(`[RealTrading] 📊 模拟模式/OKX未配置 - 返回空持仓`);
      return [];
    }

    try {
      // NOTE: 系统已重构为 OKX-only 架构，直接使用 OKX 客户端
      const positions = await this.okx.getPositions();
      const { getCurrentPrice } = await import('./marketData');

      return positions.map((p: any) => {
        const coin = p.coin as Coin;
        const currentPrice = getCurrentPrice(coin);

        return {
          id: `${coin}-${Date.now()}`,
          coin,
          side: p.side,
          size: Math.abs(p.size),
          leverage: p.leverage,
          entryPrice: p.entryPrice,
          currentPrice,
          unrealizedPnL: p.unrealizedPnL,
          unrealizedPnLPercent: (p.unrealizedPnL / (p.entryPrice * Math.abs(p.size))) * 100,
          entryTime: Date.now(),
          // 🔥 从存储中获取 exitPlan（如果不存在则返回 undefined）
          exitPlan: this.exitPlans.get(coin),
          notional: p.entryPrice * Math.abs(p.size),
        };
      });
    } catch (error) {
      console.error('[RealTrading] ❌ 获取持仓失败:', error);
      return [];
    }
  }

  /**
   * 切换模拟/真实模式
   */
  setDryRun(dryRun: boolean) {
    this.config.dryRun = dryRun;
    console.log(`[RealTrading] 🔄 切换模式: ${dryRun ? '模拟' : '真实交易'}`);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      mode: this.config.dryRun ? 'DRY_RUN' : 'LIVE',
      dailyTrades: this.dailyTradeCount,
      maxDailyTrades: this.config.maxDailyTrades,
      remainingTrades: this.config.maxDailyTrades - this.dailyTradeCount,
      lastResetDate: this.lastResetDate,
    };
  }
}

// 导出单例
let realTradingExecutor: RealTradingExecutor | null = null;

export function getRealTradingExecutor(
  config?: Partial<RealTradingExecutorConfig>
): RealTradingExecutor {
  if (!realTradingExecutor) {
    realTradingExecutor = new RealTradingExecutor(config);
  }
  return realTradingExecutor;
}
