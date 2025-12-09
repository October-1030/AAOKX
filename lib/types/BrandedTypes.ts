/**
 * TypeScript 品牌类型系统
 * 基于 Matt Pocock 的 Total TypeScript 最佳实践
 * 防止金融计算中的类型混淆错误
 */

// 基础品牌类型工具
declare const __brand: unique symbol;
type Brand<B> = { [__brand]: B };
export type Branded<T, B> = T & Brand<B>;

// 货币品牌类型 - 防止不同货币混淆
export type USD = Branded<number, 'USD'>;
export type ETH = Branded<number, 'ETH'>;
export type BTC = Branded<number, 'BTC'>;
export type USDT = Branded<number, 'USDT'>;
export type USDC = Branded<number, 'USDC'>;

// 价格类型 - 防止价格和数量混淆
export type Price = Branded<number, 'Price'>;
export type Volume = Branded<number, 'Volume'>;
export type Amount = Branded<number, 'Amount'>;

// 时间相关品牌类型
export type Timestamp = Branded<number, 'Timestamp'>;
export type Duration = Branded<number, 'Duration'>;
export type BlockNumber = Branded<number, 'BlockNumber'>;

// 地址类型
export type Address = Branded<string, 'Address'>;
export type TxHash = Branded<string, 'TxHash'>;
export type PrivateKey = Branded<string, 'PrivateKey'>;

// 百分比类型 - 防止小数和百分比混淆
export type Percentage = Branded<number, 'Percentage'>; // 0-100
export type Decimal = Branded<number, 'Decimal'>;       // 0-1

// 金融计算相关
export type APY = Branded<number, 'APY'>;
export type Slippage = Branded<number, 'Slippage'>;
export type Fee = Branded<number, 'Fee'>;
export type Leverage = Branded<number, 'Leverage'>;

// Gas 相关
export type GasPrice = Branded<number, 'GasPrice'>;
export type GasLimit = Branded<number, 'GasLimit'>;
export type GasUsed = Branded<number, 'GasUsed'>;

// 交易相关
export type OrderId = Branded<string, 'OrderId'>;
export type SymbolPair = Branded<string, 'SymbolPair'>; // 如 'ETH/USDT'
export type Side = 'buy' | 'sell';

/**
 * 品牌类型构造函数
 */
export const Currency = {
  USD: (value: number): USD => value as USD,
  ETH: (value: number): ETH => value as ETH,
  BTC: (value: number): BTC => value as BTC,
  USDT: (value: number): USDT => value as USDT,
  USDC: (value: number): USDC => value as USDC,
};

export const Trading = {
  Price: (value: number): Price => value as Price,
  Volume: (value: number): Volume => value as Volume,
  Amount: (value: number): Amount => value as Amount,
  
  Percentage: (value: number): Percentage => {
    if (value < 0 || value > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }
    return value as Percentage;
  },
  
  Decimal: (value: number): Decimal => {
    if (value < 0 || value > 1) {
      throw new Error('Decimal must be between 0 and 1');
    }
    return value as Decimal;
  },
  
  APY: (value: number): APY => value as APY,
  Slippage: (value: number): Slippage => value as Slippage,
  Fee: (value: number): Fee => value as Fee,
  Leverage: (value: number): Leverage => value as Leverage,
};

export const Blockchain = {
  Address: (value: string): Address => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
      throw new Error('Invalid Ethereum address format');
    }
    return value as Address;
  },
  
  TxHash: (value: string): TxHash => {
    if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
      throw new Error('Invalid transaction hash format');
    }
    return value as TxHash;
  },
  
  PrivateKey: (value: string): PrivateKey => {
    if (!/^(0x)?[a-fA-F0-9]{64}$/.test(value)) {
      throw new Error('Invalid private key format');
    }
    return value as PrivateKey;
  },
  
  BlockNumber: (value: number): BlockNumber => {
    if (value < 0 || !Number.isInteger(value)) {
      throw new Error('Block number must be a non-negative integer');
    }
    return value as BlockNumber;
  },
  
  Timestamp: (value: number): Timestamp => {
    if (value < 0) {
      throw new Error('Timestamp must be non-negative');
    }
    return value as Timestamp;
  },
};

export const Gas = {
  Price: (value: number): GasPrice => value as GasPrice,
  Limit: (value: number): GasLimit => value as GasLimit,
  Used: (value: number): GasUsed => value as GasUsed,
};

/**
 * 类型守卫函数
 */
export const TypeGuards = {
  isUSD: (value: any): value is USD => typeof value === 'number',
  isETH: (value: any): value is ETH => typeof value === 'number',
  isBTC: (value: any): value is BTC => typeof value === 'number',
  
  isPrice: (value: any): value is Price => typeof value === 'number' && value >= 0,
  isVolume: (value: any): value is Volume => typeof value === 'number' && value >= 0,
  
  isAddress: (value: any): value is Address => 
    typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value),
  
  isTxHash: (value: any): value is TxHash => 
    typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value),
};

/**
 * 安全的货币转换工具
 */
export class CurrencyConverter {
  private static exchangeRates: Map<string, number> = new Map([
    ['ETH/USD', 2000],
    ['BTC/USD', 40000],
    ['USDT/USD', 1],
    ['USDC/USD', 1],
  ]);

  static convert<From extends keyof typeof Currency, To extends keyof typeof Currency>(
    amount: Branded<number, From>,
    fromCurrency: From,
    toCurrency: To
  ): Branded<number, To> {
    if (String(fromCurrency) === String(toCurrency)) {
      return amount as any;
    }

    const fromRate = this.exchangeRates.get(`${fromCurrency}/USD`) || 1;
    const toRate = this.exchangeRates.get(`${toCurrency}/USD`) || 1;
    
    const usdValue = (amount as number) * fromRate;
    const convertedValue = usdValue / toRate;
    
    return convertedValue as Branded<number, To>;
  }

  static updateRate(pair: string, rate: number): void {
    this.exchangeRates.set(pair, rate);
  }
}

/**
 * 安全的数学运算 - 保持类型安全
 */
export class BrandedMath {
  // 同币种加法
  static add<T extends string>(a: Branded<number, T>, b: Branded<number, T>): Branded<number, T> {
    return ((a as number) + (b as number)) as Branded<number, T>;
  }

  // 同币种减法
  static subtract<T extends string>(a: Branded<number, T>, b: Branded<number, T>): Branded<number, T> {
    return ((a as number) - (b as number)) as Branded<number, T>;
  }

  // 乘以倍数（保持类型）
  static multiply<T extends string>(amount: Branded<number, T>, multiplier: number): Branded<number, T> {
    return ((amount as number) * multiplier) as Branded<number, T>;
  }

  // 除以倍数（保持类型）
  static divide<T extends string>(amount: Branded<number, T>, divisor: number): Branded<number, T> {
    if (divisor === 0) {
      throw new Error('Division by zero');
    }
    return ((amount as number) / divisor) as Branded<number, T>;
  }

  // 计算百分比
  static percentage<T extends string>(
    amount: Branded<number, T>, 
    percent: Percentage
  ): Branded<number, T> {
    return this.multiply(amount, (percent as number) / 100);
  }

  // 应用滑点
  static applySlippage(price: Price, slippage: Slippage, side: Side): Price {
    const factor = side === 'buy' ? 1 + (slippage as number) / 100 : 1 - (slippage as number) / 100;
    return this.multiply(price, factor);
  }
}

/**
 * 交易订单类型定义
 */
export interface TradeOrder {
  id: OrderId;
  symbol: SymbolPair;
  side: Side;
  amount: Amount;
  price: Price;
  totalValue: USD; // 自动计算
  fee: Fee;
  slippage: Slippage;
  timestamp: Timestamp;
}

/**
 * 订单工厂 - 确保类型安全
 */
export class OrderFactory {
  static createMarketOrder(params: {
    symbol: SymbolPair;
    side: Side;
    amount: Amount;
    currentPrice: Price;
    feePercent: Percentage;
    slippage: Slippage;
  }): TradeOrder {
    const executionPrice = BrandedMath.applySlippage(params.currentPrice, params.slippage, params.side);
    const totalValue = Currency.USD((params.amount as number) * (executionPrice as number));
    const fee = Trading.Fee((totalValue as number) * (params.feePercent as number) / 100);

    return {
      id: `order_${Date.now()}` as OrderId,
      symbol: params.symbol,
      side: params.side,
      amount: params.amount,
      price: executionPrice,
      totalValue,
      fee,
      slippage: params.slippage,
      timestamp: Blockchain.Timestamp(Date.now())
    };
  }

  static createLimitOrder(params: {
    symbol: SymbolPair;
    side: Side;
    amount: Amount;
    limitPrice: Price;
    feePercent: Percentage;
  }): TradeOrder {
    const totalValue = Currency.USD((params.amount as number) * (params.limitPrice as number));
    const fee = Trading.Fee((totalValue as number) * (params.feePercent as number) / 100);

    return {
      id: `order_${Date.now()}` as OrderId,
      symbol: params.symbol,
      side: params.side,
      amount: params.amount,
      price: params.limitPrice,
      totalValue,
      fee,
      slippage: Trading.Slippage(0), // 限价单无滑点
      timestamp: Blockchain.Timestamp(Date.now())
    };
  }
}

/**
 * 风险管理相关类型
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

export interface RiskMetrics {
  leverage: Leverage;
  exposure: Percentage; // 账户暴露度
  stopLoss: Percentage;
  takeProfit: Percentage;
  maxDrawdown: Percentage;
  sharpeRatio: Decimal;
}

export class RiskCalculator {
  static calculatePositionSize(
    accountBalance: USD,
    riskPerTrade: Percentage,
    stopLossDistance: Percentage
  ): Amount {
    const riskAmount = BrandedMath.percentage(accountBalance, riskPerTrade);
    const positionSize = BrandedMath.divide(riskAmount, stopLossDistance as number / 100);
    return Trading.Amount(positionSize as number);
  }

  static assessRiskLevel(metrics: RiskMetrics): RiskLevel {
    const leverageScore = Math.min((metrics.leverage as number) / 10, 1);
    const exposureScore = (metrics.exposure as number) / 100;
    const drawdownScore = (metrics.maxDrawdown as number) / 100;
    
    const totalRisk = (leverageScore + exposureScore + drawdownScore) / 3;
    
    if (totalRisk < 0.25) return 'LOW';
    if (totalRisk < 0.5) return 'MEDIUM';
    if (totalRisk < 0.75) return 'HIGH';
    return 'EXTREME';
  }
}

/**
 * 示例：穷举检查确保所有情况被处理
 */
export function handleOrderSide(side: Side): string {
  switch (side) {
    case 'buy':
      return 'Buying';
    case 'sell':
      return 'Selling';
    default:
      // TypeScript 会确保这里永远不会执行
      const _exhaustiveCheck: never = side;
      throw new Error(`Unhandled case: ${_exhaustiveCheck}`);
  }
}

/**
 * 类型测试和验证
 */
export const TypeSafetyTests = {
  // 这些函数在编译时会被 TypeScript 检查
  testCurrencyTypes(): void {
    const ethAmount = Currency.ETH(1.5);
    const usdAmount = Currency.USD(3000);
    
    // ✅ 这样是安全的
    const doubleEth = BrandedMath.multiply(ethAmount, 2);
    
    // ❌ 这样会编译错误 - 不能直接混合货币
    // const mixed = BrandedMath.add(ethAmount, usdAmount);
    
    // ✅ 必须先转换
    const ethInUsd = CurrencyConverter.convert(ethAmount, 'ETH', 'USD');
    const total = BrandedMath.add(usdAmount, ethInUsd);
  },

  testAddressValidation(): void {
    try {
      const validAddress = Blockchain.Address('0x742c4bC4F12345678901234567890123456789abcd');
      // ✅ 编译时类型安全，运行时格式验证
    } catch (error) {
      // ❌ 无效地址格式会在运行时抛出错误
    }
  }
};

// 导出常用的类型别名
export type SafeAmount = Amount;
export type SafePrice = Price;
export type SafeAddress = Address;