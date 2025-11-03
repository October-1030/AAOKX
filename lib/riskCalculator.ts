/**
 * 风险计算工具
 * 包含清算价格、风险评估等功能
 */

import { TradeSide } from '@/types/trading';

/**
 * 计算清算价格
 *
 * @param entryPrice 入场价格
 * @param leverage 杠杆倍数
 * @param side 交易方向（LONG/SHORT）
 * @returns 清算价格
 *
 * 公式：
 * - 多头清算价 = 入场价 × (1 - 1/杠杆)
 * - 空头清算价 = 入场价 × (1 + 1/杠杆)
 *
 * 示例：
 * - 10x多头，入场价$100 → 清算价=$90
 * - 10x空头，入场价$100 → 清算价=$110
 */
export function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  side: TradeSide
): number {
  if (side === 'LONG') {
    // 多头：价格下跌到一定程度会爆仓
    return entryPrice * (1 - 1 / leverage);
  } else {
    // 空头：价格上涨到一定程度会爆仓
    return entryPrice * (1 + 1 / leverage);
  }
}

/**
 * 计算距离清算的百分比
 *
 * @param currentPrice 当前价格
 * @param liquidationPrice 清算价格
 * @param side 交易方向
 * @returns 距离清算的百分比（正数表示安全，负数表示已爆仓）
 */
export function calculateDistanceToLiquidation(
  currentPrice: number,
  liquidationPrice: number,
  side: TradeSide
): number {
  if (side === 'LONG') {
    // 多头：当前价格应该高于清算价格
    return ((currentPrice - liquidationPrice) / liquidationPrice) * 100;
  } else {
    // 空头：当前价格应该低于清算价格
    return ((liquidationPrice - currentPrice) / liquidationPrice) * 100;
  }
}

/**
 * 评估清算风险等级
 *
 * @param distancePercent 距离清算的百分比
 * @returns 风险等级
 */
export function assessLiquidationRisk(distancePercent: number): {
  level: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER' | 'LIQUIDATED';
  message: string;
  color: string;
} {
  if (distancePercent <= 0) {
    return {
      level: 'LIQUIDATED',
      message: '已爆仓',
      color: '#000000',
    };
  } else if (distancePercent < 5) {
    return {
      level: 'DANGER',
      message: '极度危险（< 5%）',
      color: '#ef4444',
    };
  } else if (distancePercent < 10) {
    return {
      level: 'WARNING',
      message: '高风险（< 10%）',
      color: '#f59e0b',
    };
  } else if (distancePercent < 20) {
    return {
      level: 'CAUTION',
      message: '需谨慎（< 20%）',
      color: '#eab308',
    };
  } else {
    return {
      level: 'SAFE',
      message: '安全（> 20%）',
      color: '#10b981',
    };
  }
}

/**
 * 计算最大可用杠杆（基于风险容忍度）
 *
 * @param riskTolerance 风险容忍度（资金的百分比，例如 0.05 = 5%）
 * @returns 建议的最大杠杆倍数
 */
export function calculateMaxLeverage(riskTolerance: number): number {
  // 最大杠杆 = 1 / 风险容忍度
  return Math.floor(1 / riskTolerance);
}

/**
 * 计算建议仓位大小（基于风险管理）
 *
 * @param accountValue 账户总价值
 * @param riskPercentage 单笔交易风险百分比（例如 1 = 1%）
 * @param entryPrice 入场价格
 * @param stopLoss 止损价格
 * @param leverage 杠杆倍数
 * @returns 建议的仓位大小（USD）
 */
export function calculatePositionSize(
  accountValue: number,
  riskPercentage: number,
  entryPrice: number,
  stopLoss: number,
  leverage: number
): number {
  // 风险金额
  const riskAmount = accountValue * (riskPercentage / 100);

  // 价格变动百分比
  const priceMove = Math.abs(entryPrice - stopLoss) / entryPrice;

  // 考虑杠杆的实际风险
  const leveragedRisk = priceMove * leverage;

  // 仓位大小 = 风险金额 / 杠杆风险
  return riskAmount / leveragedRisk;
}
