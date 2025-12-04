/**
 * 交易配置 - 根据账户余额动态调整
 */

import { Coin } from '@/types/trading';

export interface TradingLimits {
  accountBalance: number; // 账户总余额
  maxPositionSize: number; // 单笔最大仓位（USD）
  maxPositionPercent: number; // 单笔最大仓位比例
  maxLeverage: number; // 最大杠杆
  enabledCoins: Coin[]; // 允许交易的币种
  minOrderSize: Record<Coin, number>; // 每个币种的最小订单量
}

/**
 * 根据账户余额计算交易限制
 */
export function calculateTradingLimits(balance: number): TradingLimits {
  console.log(`[TradingConfig] 💰 账户余额: $${balance.toFixed(2)}`);

  // 根据余额等级配置
  if (balance < 10) {
    // 极小额账户：$0-10
    console.log('[TradingConfig] ⚠️ 极小额模式：只交易小币种');
    return {
      accountBalance: balance,
      maxPositionSize: Math.min(balance * 0.4, 3), // 最多 $3 或 40%
      maxPositionPercent: 40,
      maxLeverage: 2, // 低杠杆保守
      enabledCoins: ['SOL', 'DOGE', 'XRP'], // 只交易小币种
      minOrderSize: {
        BTC: 999999, // 禁用 BTC（金额太小）
        ETH: 999999, // 禁用 ETH
        SOL: 2, // SOL 最小 $2
        BNB: 999999, // 禁用 BNB
        DOGE: 2, // DOGE 最小 $2
        XRP: 2, // XRP 最小 $2
      },
    };
  } else if (balance < 50) {
    // 小额账户：$10-50
    console.log('[TradingConfig] 📊 小额模式');
    return {
      accountBalance: balance,
      maxPositionSize: Math.min(balance * 0.35, 15),
      maxPositionPercent: 35,
      maxLeverage: 3,
      enabledCoins: ['ETH', 'SOL', 'DOGE', 'XRP'],
      minOrderSize: {
        BTC: 999999, // 仍然禁用 BTC
        ETH: 5,
        SOL: 3,
        BNB: 999999,
        DOGE: 2,
        XRP: 2,
      },
    };
  } else if (balance < 200) {
    // 中等账户：$50-200
    console.log('[TradingConfig] 💵 中等模式（安全设置）');
    return {
      accountBalance: balance,
      maxPositionSize: Math.min(balance * 0.08, 25), // 🔥 修复：降低至 8%（更安全）
      maxPositionPercent: 8,
      maxLeverage: 2, // 🔥 修复：降低至 2x（超安全）
      enabledCoins: ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP'],
      minOrderSize: {
        BTC: 10,
        ETH: 5,
        SOL: 3,
        BNB: 5,
        DOGE: 2,
        XRP: 2,
      },
    };
  } else {
    // 大额账户：$200+
    console.log('[TradingConfig] 💎 标准模式（超安全设置）');
    return {
      accountBalance: balance,
      maxPositionSize: Math.min(balance * 0.05, 150), // 🔥 修复：降低至 5%（超安全）
      maxPositionPercent: 5,
      maxLeverage: 3, // 🔥 修复：降低至 3x（最大安全）
      enabledCoins: ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP'],
      minOrderSize: {
        BTC: 10,
        ETH: 5,
        SOL: 3,
        BNB: 5,
        DOGE: 2,
        XRP: 2,
      },
    };
  }
}

/**
 * 检查订单是否符合限制
 */
export function validateOrder(
  coin: Coin,
  size: number,
  leverage: number,
  limits: TradingLimits
): { valid: boolean; reason?: string } {
  // 检查币种是否启用
  if (!limits.enabledCoins.includes(coin)) {
    return {
      valid: false,
      reason: `${coin} 在当前余额下不可交易（余额太小）`,
    };
  }

  // 检查最小订单量
  const minSize = limits.minOrderSize[coin];
  if (size < minSize) {
    return {
      valid: false,
      reason: `${coin} 最小订单量为 $${minSize}，当前 $${size.toFixed(2)}`,
    };
  }

  // 检查最大仓位
  if (size > limits.maxPositionSize) {
    return {
      valid: false,
      reason: `超过最大仓位限制 $${limits.maxPositionSize.toFixed(2)}`,
    };
  }

  // 检查杠杆
  if (leverage > limits.maxLeverage) {
    return {
      valid: false,
      reason: `超过最大杠杆 ${limits.maxLeverage}x`,
    };
  }

  // 检查总风险敞口
  // 🔥 修复：size 现在是 notional（订单总价值），不需要再乘以杠杆
  // 订单总价值不应超过账户余额的一定倍数
  const totalExposure = size; // size 就是订单的美元价值
  const maxExposure = limits.accountBalance * 5; // 最多 5 倍账户余额（考虑杠杆）

  if (totalExposure > maxExposure) {
    return {
      valid: false,
      reason: `订单价值超限（$${totalExposure.toFixed(2)} > $${maxExposure.toFixed(2)}，账户余额 $${limits.accountBalance.toFixed(2)}）`,
    };
  }

  return { valid: true };
}

/**
 * 调整订单大小以符合限制
 */
export function adjustOrderSize(
  coin: Coin,
  desiredSize: number,
  limits: TradingLimits
): number {
  // 确保币种启用
  if (!limits.enabledCoins.includes(coin)) {
    console.warn(`[TradingConfig] ⚠️ ${coin} 当前不可交易`);
    return 0;
  }

  const minSize = limits.minOrderSize[coin];
  const maxSize = limits.maxPositionSize;

  // 如果小于最小值，返回 0（不交易）
  if (desiredSize < minSize) {
    console.warn(
      `[TradingConfig] ⚠️ ${coin} 订单太小（$${desiredSize} < $${minSize}），跳过`
    );
    return 0;
  }

  // 如果大于最大值，调整为最大值
  if (desiredSize > maxSize) {
    console.warn(
      `[TradingConfig] ⚠️ ${coin} 订单调整：$${desiredSize} → $${maxSize}`
    );
    return maxSize;
  }

  return desiredSize;
}

/**
 * 风险管理提示
 */
export function getRiskWarnings(limits: TradingLimits): string[] {
  const warnings: string[] = [];

  if (limits.accountBalance < 10) {
    warnings.push('⚠️ 账户余额极低，建议充值至少 $50 以获得更好的交易体验');
    warnings.push('⚠️ BTC 和 ETH 已禁用（最小订单量要求太高）');
  }

  if (limits.accountBalance < 50) {
    warnings.push('⚠️ BTC 暂时禁用，建议充值至 $50+ 以解锁所有币种');
  }

  if (limits.maxLeverage <= 3) {
    warnings.push('ℹ️ 当前使用保守杠杆设置以保护资金');
  }

  warnings.push(`ℹ️ 单笔最大仓位：$${limits.maxPositionSize.toFixed(2)}`);
  warnings.push(`ℹ️ 最大杠杆：${limits.maxLeverage}x`);
  warnings.push(`ℹ️ 可交易币种：${limits.enabledCoins.join(', ')}`);

  return warnings;
}
