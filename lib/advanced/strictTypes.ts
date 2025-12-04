/**
 * 严格TypeScript类型定义
 * 基于Matt Pocock的最佳实践，确保类型安全
 * 集成 Decimal.js 精确数学计算
 */

import { SafePrice, TradingMath } from './precisionMath';
import Decimal from 'decimal.js';

// 基础类型增强
export type NonEmptyArray<T> = [T, ...T[]];
export type Timestamp = number & { readonly brand: unique symbol };

// 升级为 SafePrice 的品牌类型
export type Percentage = SafePrice & { readonly brand: unique symbol };
export type USD = SafePrice & { readonly brand: unique symbol };

// 精确的工厂函数
export const createPercentage = (value: number | string | Decimal): Percentage => {
  const safeValue = new SafePrice(value);
  if (safeValue.lt(-100) || safeValue.gt(1000)) {
    throw new Error(`Invalid percentage: ${value}. Must be between -100 and 1000`);
  }
  return safeValue as Percentage;
};

export const createUSD = (value: number | string | Decimal): USD => {
  const safeValue = new SafePrice(value);
  if (safeValue.lt(0)) {
    throw new Error(`Invalid USD amount: ${value}. Must be positive`);
  }
  return safeValue as USD;
};

export const createTimestamp = (value?: number): Timestamp => {
  return (value || Date.now()) as Timestamp;
};

// 精确数学操作助手
export const MathHelpers = {
  /**
   * 安全的百分比计算
   */
  calculateProfitPercent(entryPrice: USD, currentPrice: USD): Percentage {
    const spread = TradingMath.calculateSpreadPercent(currentPrice, entryPrice);
    return spread as Percentage;
  },

  /**
   * 安全的资金管理
   */
  calculatePositionSize(balance: USD, riskPercent: Percentage, leverage: number = 1): USD {
    const riskAmount = (balance as SafePrice).times((riskPercent as SafePrice).div(100));
    return riskAmount.times(leverage) as USD;
  },

  /**
   * 精确的手续费计算
   */
  calculateFees(amount: USD, feeRate: Percentage): USD {
    const fee = (amount as SafePrice).times((feeRate as SafePrice).div(100));
    return fee as USD;
  }
};

// 严格的交易方向类型
export const TradingSide = {
  LONG: 'LONG',
  SHORT: 'SHORT'
} as const;
export type TradingSide = typeof TradingSide[keyof typeof TradingSide];

// 严格的币种类型
export const SupportedCoins = {
  BTC: 'BTC',
  ETH: 'ETH',
  SOL: 'SOL',
  BNB: 'BNB',
  DOGE: 'DOGE',
  XRP: 'XRP'
} as const;
export type SupportedCoin = typeof SupportedCoins[keyof typeof SupportedCoins];

// 交易动作的严格类型
export const TradingAction = {
  BUY_TO_ENTER: 'buy_to_enter',
  SELL_TO_ENTER: 'sell_to_enter',
  CLOSE: 'close',
  HOLD: 'hold'
} as const;
export type TradingAction = typeof TradingAction[keyof typeof TradingAction];

// 结果类型模式 - 强制错误处理
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// 创建Result的辅助函数
export const Ok = <T>(data: T): Result<T> => ({ success: true, data });
export const Err = <E>(error: E): Result<never, E> => ({ success: false, error });

// 严格的价格数据类型
export interface StrictPriceData {
  readonly coin: SupportedCoin;
  readonly price: USD;
  readonly timestamp: Timestamp;
  readonly volume?: USD;
  readonly source: string;
}

// 严格的仓位类型
export interface StrictPosition {
  readonly id: string;
  readonly coin: SupportedCoin;
  readonly side: TradingSide;
  readonly entryPrice: USD;
  readonly size: USD;
  readonly leverage: number;
  readonly entryTime: Timestamp;
  readonly maxProfit?: Percentage;
  readonly currentProfit?: Percentage;
  readonly exitPlan?: StrictExitPlan;
}

// 严格的退出计划类型
export interface StrictExitPlan {
  readonly stopLoss: USD;
  readonly takeProfit: USD;
  readonly invalidation: string;
  readonly createdAt: Timestamp;
}

// 严格的交易决策类型
export interface StrictTradingDecision {
  readonly action: TradingAction;
  readonly coin: SupportedCoin;
  readonly confidence: Percentage;
  readonly leverage?: number;
  readonly notional?: USD;
  readonly exitPlan?: StrictExitPlan;
  readonly reasoning: string;
  readonly timestamp: Timestamp;
}

// 账户状态的严格类型
export interface StrictAccountState {
  readonly balance: USD;
  readonly marginUsed: USD;
  readonly availableMargin: USD;
  readonly positions: readonly StrictPosition[];
  readonly timestamp: Timestamp;
}

// 风险参数的严格类型
export interface StrictRiskParameters {
  readonly maxPositionSizePercent: Percentage;
  readonly maxLeverage: number;
  readonly emergencyStopLossPercent: Percentage;
  readonly maxDailyTrades: number;
  readonly accountBalance: USD;
}

// 交易结果的严格类型
export interface StrictTradeResult {
  readonly orderId: string;
  readonly executedAt: Timestamp;
  readonly executedPrice: USD;
  readonly executedSize: USD;
  readonly fees: USD;
  readonly slippage: Percentage;
}

// 风险检查结果类型
export interface RiskCheckResult {
  readonly isValid: boolean;
  readonly violations: readonly string[];
  readonly riskScore: Percentage;
  readonly recommendations: readonly string[];
}

// 类型守卫函数
export const isValidCoin = (coin: string): coin is SupportedCoin => {
  return Object.values(SupportedCoins).includes(coin as SupportedCoin);
};

export const isValidTradingSide = (side: string): side is TradingSide => {
  return Object.values(TradingSide).includes(side as TradingSide);
};

export const isValidTradingAction = (action: string): action is TradingAction => {
  return Object.values(TradingAction).includes(action as TradingAction);
};

// 数据验证函数
export class StrictDataValidator {
  static validatePosition(data: any): Result<StrictPosition> {
    if (!data) return Err(new Error('Position data is required'));
    
    // 验证必填字段
    if (!data.id || typeof data.id !== 'string') {
      return Err(new Error('Position ID is required and must be string'));
    }
    
    if (!isValidCoin(data.coin)) {
      return Err(new Error(`Invalid coin: ${data.coin}`));
    }
    
    if (!isValidTradingSide(data.side)) {
      return Err(new Error(`Invalid trading side: ${data.side}`));
    }
    
    if (typeof data.entryPrice !== 'number' || data.entryPrice <= 0) {
      return Err(new Error('Entry price must be positive number'));
    }
    
    if (typeof data.size !== 'number' || data.size <= 0) {
      return Err(new Error('Position size must be positive number'));
    }
    
    try {
      const position: StrictPosition = {
        id: data.id,
        coin: data.coin,
        side: data.side,
        entryPrice: createUSD(data.entryPrice),
        size: createUSD(data.size),
        leverage: data.leverage || 1,
        entryTime: createTimestamp(data.entryTime),
        maxProfit: data.maxProfit ? createPercentage(data.maxProfit) : undefined,
        currentProfit: data.currentProfit ? createPercentage(data.currentProfit) : undefined,
        exitPlan: data.exitPlan ? {
          stopLoss: createUSD(data.exitPlan.stopLoss),
          takeProfit: createUSD(data.exitPlan.takeProfit),
          invalidation: data.exitPlan.invalidation || 'No reason provided',
          createdAt: createTimestamp(data.exitPlan.createdAt)
        } : undefined
      };
      
      return Ok(position);
    } catch (error) {
      return Err(error as Error);
    }
  }
  
  static validateTradingDecision(data: any): Result<StrictTradingDecision> {
    if (!data) return Err(new Error('Trading decision data is required'));
    
    if (!isValidTradingAction(data.action)) {
      return Err(new Error(`Invalid trading action: ${data.action}`));
    }
    
    if (!isValidCoin(data.coin)) {
      return Err(new Error(`Invalid coin: ${data.coin}`));
    }
    
    if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) {
      return Err(new Error('Confidence must be number between 0 and 1'));
    }
    
    try {
      const decision: StrictTradingDecision = {
        action: data.action,
        coin: data.coin,
        confidence: createPercentage(data.confidence * 100),
        leverage: data.leverage,
        notional: data.notional ? createUSD(data.notional) : undefined,
        reasoning: data.reasoning || 'No reasoning provided',
        timestamp: createTimestamp(),
        exitPlan: data.exitPlan ? {
          stopLoss: createUSD(data.exitPlan.stopLoss),
          takeProfit: createUSD(data.exitPlan.takeProfit),
          invalidation: data.exitPlan.invalidation || 'No reason provided',
          createdAt: createTimestamp()
        } : undefined
      };
      
      return Ok(decision);
    } catch (error) {
      return Err(error as Error);
    }
  }
  
  static validateAccountState(data: any): Result<StrictAccountState> {
    if (!data) return Err(new Error('Account state data is required'));
    
    try {
      // 验证所有仓位
      const positions: StrictPosition[] = [];
      if (data.positions) {
        for (const pos of data.positions) {
          const posResult = this.validatePosition(pos);
          if (!posResult.success) {
            return Err(posResult.error);
          }
          positions.push(posResult.data);
        }
      }
      
      const accountState: StrictAccountState = {
        balance: createUSD(data.balance || 0),
        marginUsed: createUSD(data.marginUsed || 0),
        availableMargin: createUSD(data.availableMargin || data.balance || 0),
        positions: positions as readonly StrictPosition[],
        timestamp: createTimestamp()
      };
      
      return Ok(accountState);
    } catch (error) {
      return Err(error as Error);
    }
  }
}

// 类型安全的交易执行器接口
export interface StrictTradingExecutor {
  executeDecision(decision: StrictTradingDecision): Promise<Result<StrictTradeResult>>;
  getCurrentPositions(): Promise<Result<readonly StrictPosition[]>>;
  getAccountState(): Promise<Result<StrictAccountState>>;
  closePosition(positionId: string): Promise<Result<StrictTradeResult>>;
  validateRisk(decision: StrictTradingDecision): Promise<Result<RiskCheckResult>>;
}

// 导出所有类型和验证器
export * from './eventDrivenEngine';

// 辅助函数：安全地处理Result类型
export const handleResult = <T, E>(
  result: Result<T, E>,
  onSuccess: (data: T) => void,
  onError: (error: E) => void
): void => {
  if (result.success) {
    onSuccess(result.data);
  } else {
    onError(result.error);
  }
};

// 异步版本的Result处理
export const handleResultAsync = async <T, E>(
  result: Result<T, E>,
  onSuccess: (data: T) => Promise<void>,
  onError: (error: E) => Promise<void>
): Promise<void> => {
  if (result.success) {
    await onSuccess(result.data);
  } else {
    await onError(result.error);
  }
};