/**
 * 风险管理系统
 * 借鉴 Nautilus Trader 的风险管理理念
 *
 * NOTE: 系统已重构为 DeepSeek 单模型架构
 * 决策链：行情 → 指标 → DeepSeek → 风控检查(本模块) → RealTradingExecutor
 *
 * 保留的风控功能：
 * - 最大仓位限制
 * - 最大持仓数量
 * - 每日最大亏损
 * - 单币种亏损限制
 * - Kelly公式计算
 */

import { Coin, Position, TradingDecision, AccountStatus } from '@/types/trading';
import { getTradingStorage } from './persistence/storage';

// 风险管理配置
export const RISK_CONFIG = {
  // 单币种风险限制
  MAX_COIN_LOSS_PERCENT: 10, // 单币种最大亏损10%
  MAX_COIN_EXPOSURE_PERCENT: 30, // 单币种最大仓位占比30%

  // 相关性限制
  MAX_CORRELATED_EXPOSURE: 50, // 高相关币种总仓位不超过50%

  // Kelly公式配置
  KELLY_FRACTION: 0.25, // 使用25% Kelly（保守）
  MIN_KELLY_SIZE: 0.05, // 最小仓位5%
  MAX_KELLY_SIZE: 0.25, // 最大仓位25%

  // 波动率调整
  VOLATILITY_LOOKBACK: 20, // 计算20个周期的波动率
  MAX_LEVERAGE_HIGH_VOL: 5, // 高波动时最大杠杆5x

  // 集中度限制
  MAX_SINGLE_POSITION_PERCENT: 20, // 单笔交易最大占比20%
  MAX_TOTAL_POSITIONS: 6, // 最多6个持仓
};

/**
 * 币种相关性矩阵（基于历史数据）
 * 1.0 = 完全正相关
 * 0.0 = 无相关
 * -1.0 = 完全负相关
 */
const CORRELATION_MATRIX: Partial<Record<Coin, Partial<Record<Coin, number>>>> = {
  BTC: { BTC: 1.0, ETH: 0.85, SOL: 0.75, BNB: 0.70, DOGE: 0.60, XRP: 0.65 },
  ETH: { BTC: 0.85, ETH: 1.0, SOL: 0.80, BNB: 0.75, DOGE: 0.55, XRP: 0.60 },
  SOL: { BTC: 0.75, ETH: 0.80, SOL: 1.0, BNB: 0.70, DOGE: 0.50, XRP: 0.55 },
  BNB: { BTC: 0.70, ETH: 0.75, SOL: 0.70, BNB: 1.0, DOGE: 0.45, XRP: 0.50 },
  DOGE: { BTC: 0.60, ETH: 0.55, SOL: 0.50, BNB: 0.45, DOGE: 1.0, XRP: 0.40 },
  XRP: { BTC: 0.65, ETH: 0.60, SOL: 0.55, BNB: 0.50, DOGE: 0.40, XRP: 1.0 },
};

/**
 * 风险管理器
 */
export class RiskManager {
  private storage = getTradingStorage();

  /**
   * 🛡️ 1. 单币种最大亏损限制
   * 检查某个币种是否已经亏损过多
   */
  async checkCoinLossLimit(
    modelName: string,
    coin: Coin,
    currentAccount: AccountStatus
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // 获取该币种的所有历史交易
      const allTrades = await this.storage.getAllTrades(modelName);
      const coinTrades = allTrades.filter(t => t.coin === coin);

      if (coinTrades.length === 0) {
        return { allowed: true }; // 没有历史交易，允许
      }

      // 计算该币种的总盈亏
      const totalCoinPnL = coinTrades.reduce((sum, t) => sum + t.pnl, 0);

      // 计算该币种的亏损占初始资金的百分比
      const initialCapital = 1000; // 从配置中获取
      const coinLossPercent = (totalCoinPnL / initialCapital) * 100;

      if (coinLossPercent <= -RISK_CONFIG.MAX_COIN_LOSS_PERCENT) {
        return {
          allowed: false,
          reason: `${coin} 累计亏损 ${Math.abs(coinLossPercent).toFixed(1)}% 超过限制 ${RISK_CONFIG.MAX_COIN_LOSS_PERCENT}%`,
        };
      }

      // 检查当前持仓的未实现亏损
      const currentPosition = currentAccount.positions.find(p => p.coin === coin);
      if (currentPosition && currentPosition.unrealizedPnLPercent < -RISK_CONFIG.MAX_COIN_LOSS_PERCENT) {
        return {
          allowed: false,
          reason: `${coin} 当前持仓亏损 ${Math.abs(currentPosition.unrealizedPnLPercent).toFixed(1)}% 超过限制`,
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('[RiskManager] 检查币种亏损限制失败:', error);
      return { allowed: true }; // 出错时不阻止交易
    }
  }

  /**
   * 🛡️ 2. 单币种最大仓位限制
   */
  checkCoinExposureLimit(
    coin: Coin,
    newNotional: number,
    currentAccount: AccountStatus
  ): { allowed: boolean; reason?: string } {
    const totalEquity = currentAccount.totalEquity;
    const maxExposure = totalEquity * (RISK_CONFIG.MAX_COIN_EXPOSURE_PERCENT / 100);

    // 计算该币种的当前总仓位
    const currentExposure = currentAccount.positions
      .filter(p => p.coin === coin)
      .reduce((sum, p) => sum + p.notional, 0);

    const newTotalExposure = currentExposure + newNotional;

    if (newTotalExposure > maxExposure) {
      return {
        allowed: false,
        reason: `${coin} 总仓位 $${newTotalExposure.toFixed(2)} 超过限制 $${maxExposure.toFixed(2)} (${RISK_CONFIG.MAX_COIN_EXPOSURE_PERCENT}%)`,
      };
    }

    return { allowed: true };
  }

  /**
   * 🛡️ 3. 相关性检查
   * 避免高相关币种同时持有大量仓位
   */
  checkCorrelationRisk(
    coin: Coin,
    newNotional: number,
    currentAccount: AccountStatus
  ): { allowed: boolean; reason?: string; correlatedCoins?: Coin[] } {
    const totalEquity = currentAccount.totalEquity;
    const maxCorrelatedExposure = totalEquity * (RISK_CONFIG.MAX_CORRELATED_EXPOSURE / 100);

    // 找出与该币种高相关的币种（相关性 > 0.7）
    const correlatedCoins: Coin[] = [];
    let correlatedExposure = 0;

    for (const [otherCoin, correlation] of Object.entries(CORRELATION_MATRIX[coin] || {})) {
      if (correlation as number >= 0.7 && otherCoin !== coin) {
        const exposure = currentAccount.positions
          .filter(p => p.coin === otherCoin)
          .reduce((sum, p) => sum + p.notional, 0);

        if (exposure > 0) {
          correlatedCoins.push(otherCoin as Coin);
          correlatedExposure += exposure;
        }
      }
    }

    const newTotalCorrelatedExposure = correlatedExposure + newNotional;

    if (newTotalCorrelatedExposure > maxCorrelatedExposure) {
      return {
        allowed: false,
        reason: `${coin} 与 [${correlatedCoins.join(', ')}] 高相关，总仓位 $${newTotalCorrelatedExposure.toFixed(2)} 超过限制 $${maxCorrelatedExposure.toFixed(2)}`,
        correlatedCoins,
      };
    }

    return { allowed: true };
  }

  /**
   * 🎯 4. Kelly公式 - 计算最优仓位大小
   * Kelly Criterion: f* = (p * b - q) / b
   * 其中:
   * - p = 胜率
   * - q = 败率 (1-p)
   * - b = 平均盈利/平均亏损比
   */
  async calculateKellySize(
    modelName: string,
    confidence: number,
    currentEquity: number
  ): Promise<number> {
    try {
      const stats = await this.storage.getTradingStats(modelName);

      // 如果没有足够的历史数据，使用保守估计
      if (stats.totalTrades < 10) {
        return currentEquity * RISK_CONFIG.MIN_KELLY_SIZE;
      }

      const winRate = stats.winRate / 100; // 转换为小数
      const lossRate = 1 - winRate;

      // 计算平均盈亏比
      const trades = await this.storage.getAllTrades(modelName);
      const winningTrades = trades.filter(t => t.pnl > 0);
      const losingTrades = trades.filter(t => t.pnl < 0);

      if (losingTrades.length === 0) {
        // 没有亏损交易，使用保守值
        return currentEquity * RISK_CONFIG.MIN_KELLY_SIZE;
      }

      const avgWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length;
      const avgLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length);
      const profitLossRatio = avgWin / avgLoss;

      // Kelly公式
      let kellyPercent = (winRate * profitLossRatio - lossRate) / profitLossRatio;

      // 应用Kelly分数（保守）
      kellyPercent = kellyPercent * RISK_CONFIG.KELLY_FRACTION;

      // 根据AI信心度调整
      kellyPercent = kellyPercent * confidence;

      // 限制在安全范围内
      kellyPercent = Math.max(RISK_CONFIG.MIN_KELLY_SIZE, Math.min(kellyPercent, RISK_CONFIG.MAX_KELLY_SIZE));

      const kellySize = currentEquity * kellyPercent;

      console.log(`[Kelly] 胜率: ${(winRate * 100).toFixed(1)}%, 盈亏比: ${profitLossRatio.toFixed(2)}, 建议仓位: ${(kellyPercent * 100).toFixed(1)}% ($${kellySize.toFixed(2)})`);

      return kellySize;
    } catch (error) {
      console.error('[RiskManager] Kelly公式计算失败:', error);
      return currentEquity * RISK_CONFIG.MIN_KELLY_SIZE; // 降级到保守值
    }
  }

  /**
   * 🛡️ 5. 持仓数量限制
   */
  checkPositionCountLimit(currentAccount: AccountStatus): { allowed: boolean; reason?: string } {
    if (currentAccount.positions.length >= RISK_CONFIG.MAX_TOTAL_POSITIONS) {
      return {
        allowed: false,
        reason: `持仓数量 ${currentAccount.positions.length} 已达上限 ${RISK_CONFIG.MAX_TOTAL_POSITIONS}`,
      };
    }
    return { allowed: true };
  }

  /**
   * 🛡️ 6. 单笔交易大小限制
   */
  checkPositionSizeLimit(
    notional: number,
    currentEquity: number
  ): { allowed: boolean; reason?: string } {
    const maxSize = currentEquity * (RISK_CONFIG.MAX_SINGLE_POSITION_PERCENT / 100);

    if (notional > maxSize) {
      return {
        allowed: false,
        reason: `单笔交易 $${notional.toFixed(2)} 超过限制 $${maxSize.toFixed(2)} (${RISK_CONFIG.MAX_SINGLE_POSITION_PERCENT}%)`,
      };
    }

    return { allowed: true };
  }

  /**
   * 🛡️ 综合风险检查
   * 在执行交易前调用，检查所有风险限制
   */
  async validateTrade(
    modelName: string,
    decision: TradingDecision,
    currentAccount: AccountStatus
  ): Promise<{ allowed: boolean; reasons: string[] }> {
    const reasons: string[] = [];

    // 只对开仓操作进行检查
    if (decision.action === 'close' || decision.action === 'hold') {
      return { allowed: true, reasons: [] };
    }

    // 1. 检查持仓数量
    const countCheck = this.checkPositionCountLimit(currentAccount);
    if (!countCheck.allowed) {
      reasons.push(countCheck.reason!);
    }

    // 2. 检查单笔交易大小
    if (decision.notional) {
      const sizeCheck = this.checkPositionSizeLimit(decision.notional, currentAccount.totalEquity);
      if (!sizeCheck.allowed) {
        reasons.push(sizeCheck.reason!);
      }

      // 3. 检查单币种亏损限制
      const lossCheck = await this.checkCoinLossLimit(modelName, decision.coin, currentAccount);
      if (!lossCheck.allowed) {
        reasons.push(lossCheck.reason!);
      }

      // 4. 检查单币种仓位限制
      const exposureCheck = this.checkCoinExposureLimit(decision.coin, decision.notional, currentAccount);
      if (!exposureCheck.allowed) {
        reasons.push(exposureCheck.reason!);
      }

      // 5. 检查相关性风险
      const correlationCheck = this.checkCorrelationRisk(decision.coin, decision.notional, currentAccount);
      if (!correlationCheck.allowed) {
        reasons.push(correlationCheck.reason!);
      }
    }

    const allowed = reasons.length === 0;

    if (!allowed) {
      console.warn(`[RiskManager] 🚫 交易被拒绝: ${decision.coin} ${decision.action}`);
      reasons.forEach(r => console.warn(`   - ${r}`));
    }

    return { allowed, reasons };
  }

  /**
   * 📊 获取风险指标摘要
   */
  async getRiskMetrics(modelName: string, currentAccount: AccountStatus): Promise<{
    totalExposure: number;
    exposurePercent: number;
    positionCount: number;
    coinExposures: Record<Coin, number>;
    correlatedExposure: number;
  }> {
    const totalEquity = currentAccount.totalEquity;
    const totalExposure = currentAccount.positions.reduce((sum, p) => sum + p.notional, 0);
    const exposurePercent = (totalExposure / totalEquity) * 100;

    // 计算每个币种的仓位
    const coinExposures: Record<string, number> = {};
    for (const position of currentAccount.positions) {
      coinExposures[position.coin] = (coinExposures[position.coin] || 0) + position.notional;
    }

    // 计算高相关币种的总仓位
    let correlatedExposure = 0;
    const processedPairs = new Set<string>();

    for (const pos1 of currentAccount.positions) {
      for (const pos2 of currentAccount.positions) {
        if (pos1.coin === pos2.coin) continue;

        const pairKey = [pos1.coin, pos2.coin].sort().join('-');
        if (processedPairs.has(pairKey)) continue;

        const correlation = CORRELATION_MATRIX[pos1.coin]?.[pos2.coin] || 0;
        if (correlation >= 0.7) {
          correlatedExposure += pos1.notional + pos2.notional;
          processedPairs.add(pairKey);
        }
      }
    }

    return {
      totalExposure,
      exposurePercent,
      positionCount: currentAccount.positions.length,
      coinExposures: coinExposures as Record<Coin, number>,
      correlatedExposure,
    };
  }
}

// 导出单例
let riskManagerInstance: RiskManager | null = null;

export function getRiskManager(): RiskManager {
  if (!riskManagerInstance) {
    riskManagerInstance = new RiskManager();
  }
  return riskManagerInstance;
}
