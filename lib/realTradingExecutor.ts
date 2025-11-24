/**
 * 真实交易执行器
 * 使用 Hyperliquid API 执行真实订单
 */

import { getHyperliquidClient } from './hyperliquidClient';
import { getCoinGlassClient } from './coinglassClient';
import {
  calculateTradingLimits,
  validateOrder,
  adjustOrderSize,
  getRiskWarnings,
} from './tradingConfig';
import { Coin, Position, TradingDecision } from '@/types/trading';

export interface RealTradingExecutorConfig {
  dryRun: boolean; // 模拟模式（不执行真实订单）
  enableRiskChecks: boolean; // 启用风险检查
  maxDailyTrades: number; // 每日最大交易次数
}

export class RealTradingExecutor {
  private hyperliquid = getHyperliquidClient();
  private coinglass = getCoinGlassClient();
  private config: RealTradingExecutorConfig;
  private dailyTradeCount: number = 0;
  private lastResetDate: string = '';

  constructor(config: Partial<RealTradingExecutorConfig> = {}) {
    this.config = {
      dryRun: config.dryRun ?? true, // 默认模拟模式
      enableRiskChecks: config.enableRiskChecks ?? true,
      maxDailyTrades: config.maxDailyTrades ?? 150, // 每日最大150次交易（3分钟周期 × 24小时）
    };

    console.log('[RealTrading] 🚀 初始化真实交易执行器');
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
   * 获取账户信息和交易限制
   */
  async getAccountLimits() {
    try {
      if (!this.hyperliquid.isAvailable()) {
        console.warn('[RealTrading] ⚠️ Hyperliquid 未配置，使用默认限制');
        return calculateTradingLimits(10000); // 默认 $10,000
      }

      const accountInfo = await this.hyperliquid.getAccountInfo();
      const balance = accountInfo.accountValue;

      console.log(`[RealTrading] 💰 账户余额: $${balance.toFixed(2)}`);

      const limits = calculateTradingLimits(balance);
      const warnings = getRiskWarnings(limits);

      warnings.forEach(warning => console.log(`[RealTrading] ${warning}`));

      return limits;
    } catch (error) {
      console.error('[RealTrading] ❌ 获取账户限制失败:', error);
      return calculateTradingLimits(10000); // 降级到默认值
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
          return { success: true, message: 'Hold position' };

        case 'buy_to_enter':
          return await this.executeOpenPosition(decision, limits, 'LONG');

        case 'sell_to_enter':
          return await this.executeOpenPosition(decision, limits, 'SHORT');

        case 'close':
          return await this.executeClosePosition(decision);

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

    // 真实交易
    try {
      // 先设置杠杆
      await this.hyperliquid.setLeverage(coin, leverage);

      // 下市价单
      const order = await this.hyperliquid.placeMarketOrder({
        coin,
        side,
        size: adjustedSizeInUsd,
        leverage,
      });

      this.dailyTradeCount++;

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
   * 平仓
   */
  private async executeClosePosition(decision: TradingDecision) {
    const { coin } = decision;

    if (!coin) {
      return { success: false, message: 'Missing coin parameter' };
    }

    console.log(`[RealTrading] 🔄 平仓: ${coin}`);

    // 模拟模式
    if (this.config.dryRun) {
      console.log('[RealTrading] 🧪 [模拟模式] 平仓未实际执行');
      this.dailyTradeCount++;
      return {
        success: true,
        message: `[DRY RUN] Close ${coin}`,
      };
    }

    // 真实交易
    try {
      const result = await this.hyperliquid.closePosition(coin);

      this.dailyTradeCount++;

      console.log('[RealTrading] ✅ 平仓成功');
      return {
        success: true,
        message: `Closed ${coin}`,
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
   * 获取当前持仓
   */
  async getCurrentPositions(): Promise<Position[]> {
    if (this.config.dryRun || !this.hyperliquid.isAvailable()) {
      console.log('[RealTrading] 📊 模拟模式/未配置 - 返回空持仓');
      return [];
    }

    try {
      const positions = await this.hyperliquid.getPositions();

      return positions.map((p: any) => ({
        id: `${p.coin}-${Date.now()}`,
        coin: p.coin as Coin,
        side: p.side,
        size: Math.abs(p.size),
        leverage: p.leverage,
        entryPrice: p.entryPrice,
        currentPrice: p.entryPrice, // 需要实时更新
        unrealizedPnL: p.unrealizedPnL,
        unrealizedPnLPercent: (p.unrealizedPnL / (p.entryPrice * Math.abs(p.size))) * 100,
        entryTime: Date.now(),
      }));
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
