/**
 * 精确数学计算模块
 * 使用 Decimal.js 避免 JavaScript 浮点数精度问题
 * 专为量化交易金融计算设计
 */

import Decimal from 'decimal.js';

// 配置 Decimal.js 精度为金融级别
Decimal.config({
  precision: 28,        // 28位精度，足够处理加密货币计算
  rounding: Decimal.ROUND_HALF_UP,  // 银行四舍五入
  toExpNeg: -7,         // 科学计数法阈值
  toExpPos: 21,
  maxE: 9e15,
  minE: -9e15
});

/**
 * 安全价格类型 - 使用 Decimal 确保精度
 */
export class SafePrice {
  private decimal: Decimal;

  constructor(value: number | string | Decimal) {
    this.decimal = new Decimal(value);
  }

  // 基础操作
  plus(other: SafePrice | number | string): SafePrice {
    return new SafePrice(this.decimal.plus(other instanceof SafePrice ? other.decimal : other));
  }

  minus(other: SafePrice | number | string): SafePrice {
    return new SafePrice(this.decimal.minus(other instanceof SafePrice ? other.decimal : other));
  }

  times(other: SafePrice | number | string): SafePrice {
    return new SafePrice(this.decimal.times(other instanceof SafePrice ? other.decimal : other));
  }

  div(other: SafePrice | number | string): SafePrice {
    return new SafePrice(this.decimal.div(other instanceof SafePrice ? other.decimal : other));
  }

  // 比较操作
  gt(other: SafePrice | number | string): boolean {
    return this.decimal.gt(other instanceof SafePrice ? other.decimal : other);
  }

  gte(other: SafePrice | number | string): boolean {
    return this.decimal.gte(other instanceof SafePrice ? other.decimal : other);
  }

  lt(other: SafePrice | number | string): boolean {
    return this.decimal.lt(other instanceof SafePrice ? other.decimal : other);
  }

  lte(other: SafePrice | number | string): boolean {
    return this.decimal.lte(other instanceof SafePrice ? other.decimal : other);
  }

  eq(other: SafePrice | number | string): boolean {
    return this.decimal.eq(other instanceof SafePrice ? other.decimal : other);
  }

  // 数学函数
  abs(): SafePrice {
    return new SafePrice(this.decimal.abs());
  }

  round(dp?: number): SafePrice {
    return new SafePrice(this.decimal.toDecimalPlaces(dp || 8));
  }

  // 格式化输出
  toString(): string {
    return this.decimal.toString();
  }

  toFixed(decimals: number = 8): string {
    return this.decimal.toFixed(decimals);
  }

  toNumber(): number {
    return this.decimal.toNumber();
  }

  // 专用于交易的格式化
  toUSD(): string {
    return `$${this.decimal.toFixed(2)}`;
  }

  toPercent(decimals: number = 2): string {
    return `${this.decimal.toFixed(decimals)}%`;
  }
}

/**
 * 交易数学工具类
 */
export class TradingMath {
  
  /**
   * 计算价差百分比
   * @param price1 价格1
   * @param price2 价格2
   * @returns 价差百分比 (绝对值)
   */
  static calculateSpreadPercent(price1: SafePrice | number, price2: SafePrice | number): SafePrice {
    const p1 = price1 instanceof SafePrice ? price1 : new SafePrice(price1);
    const p2 = price2 instanceof SafePrice ? price2 : new SafePrice(price2);
    
    const diff = p1.minus(p2).abs();
    const avg = p1.plus(p2).div(2);
    
    return diff.div(avg).times(100);
  }

  /**
   * 计算套利净利润
   * @param buyPrice 买入价格
   * @param sellPrice 卖出价格
   * @param amount 交易数量
   * @param buyFee 买入手续费率 (%)
   * @param sellFee 卖出手续费率 (%)
   * @returns 净利润 (USD)
   */
  static calculateArbitrageProfit(
    buyPrice: SafePrice | number,
    sellPrice: SafePrice | number,
    amount: SafePrice | number,
    buyFee: SafePrice | number = 0.02,
    sellFee: SafePrice | number = 0.02
  ): SafePrice {
    const buy = buyPrice instanceof SafePrice ? buyPrice : new SafePrice(buyPrice);
    const sell = sellPrice instanceof SafePrice ? sellPrice : new SafePrice(sellPrice);
    const qty = amount instanceof SafePrice ? amount : new SafePrice(amount);
    const buyFeeRate = buyFee instanceof SafePrice ? buyFee : new SafePrice(buyFee);
    const sellFeeRate = sellFee instanceof SafePrice ? sellFee : new SafePrice(sellFee);

    // 买入成本 = 数量 * 买入价 * (1 + 手续费率)
    const buyCost = qty.times(buy).times(buyFeeRate.div(100).plus(1));
    
    // 卖出收入 = 数量 * 卖出价 * (1 - 手续费率)
    const sellIncome = qty.times(sell).times(new SafePrice(1).minus(sellFeeRate.div(100)));
    
    // 净利润 = 卖出收入 - 买入成本
    return sellIncome.minus(buyCost);
  }

  /**
   * 计算最优仓位大小 (Kelly 准则简化版)
   * @param winRate 胜率 (0-1)
   * @param avgWin 平均盈利
   * @param avgLoss 平均亏损
   * @param accountBalance 账户余额
   * @param maxRisk 最大风险比例 (0-1)
   * @returns 建议仓位大小
   */
  static calculateOptimalPositionSize(
    winRate: SafePrice | number,
    avgWin: SafePrice | number,
    avgLoss: SafePrice | number,
    accountBalance: SafePrice | number,
    maxRisk: SafePrice | number = 0.05
  ): SafePrice {
    const p = winRate instanceof SafePrice ? winRate : new SafePrice(winRate);
    const w = avgWin instanceof SafePrice ? avgWin : new SafePrice(avgWin);
    const l = avgLoss instanceof SafePrice ? avgLoss : new SafePrice(avgLoss);
    const balance = accountBalance instanceof SafePrice ? accountBalance : new SafePrice(accountBalance);
    const maxR = maxRisk instanceof SafePrice ? maxRisk : new SafePrice(maxRisk);

    // Kelly 公式: f = (p * w - (1-p) * l) / w
    // 但限制最大风险
    const kellyFraction = p.times(w).minus(new SafePrice(1).minus(p).times(l)).div(w);
    
    // 取 Kelly 和最大风险的较小值
    const safeFraction = kellyFraction.lt(maxR) ? kellyFraction : maxR;
    
    // 确保非负数
    return safeFraction.gt(0) ? balance.times(safeFraction) : new SafePrice(0);
  }

  /**
   * 计算复合收益率
   * @param initialBalance 初始余额
   * @param finalBalance 最终余额
   * @param periods 时间周期数
   * @returns 复合年化收益率 (%)
   */
  static calculateCompoundReturn(
    initialBalance: SafePrice | number,
    finalBalance: SafePrice | number,
    periods: SafePrice | number
  ): SafePrice {
    const initial = initialBalance instanceof SafePrice ? initialBalance : new SafePrice(initialBalance);
    const final = finalBalance instanceof SafePrice ? finalBalance : new SafePrice(finalBalance);
    const n = periods instanceof SafePrice ? periods : new SafePrice(periods);

    // CAGR = (Final/Initial)^(1/n) - 1
    const ratio = final.div(initial);
    const power = new SafePrice(1).div(n);
    
    // 简化计算，使用对数近似
    const logReturn = new SafePrice(Math.log(ratio.toNumber()));
    const annualizedReturn = logReturn.div(n);
    
    return new SafePrice(Math.exp(annualizedReturn.toNumber()) - 1).times(100);
  }

  /**
   * 计算滑点影响
   * @param orderSize 订单大小
   * @param marketDepth 市场深度
   * @param impactFactor 影响因子 (通常 0.5-2.0)
   * @returns 预估滑点百分比
   */
  static calculateSlippage(
    orderSize: SafePrice | number,
    marketDepth: SafePrice | number,
    impactFactor: SafePrice | number = 1.0
  ): SafePrice {
    const size = orderSize instanceof SafePrice ? orderSize : new SafePrice(orderSize);
    const depth = marketDepth instanceof SafePrice ? marketDepth : new SafePrice(marketDepth);
    const impact = impactFactor instanceof SafePrice ? impactFactor : new SafePrice(impactFactor);

    // 滑点 = (订单大小 / 市场深度) * 影响因子 * 100%
    return size.div(depth).times(impact).times(100);
  }

  /**
   * 计算风险调整收益 (Sharpe Ratio)
   * @param returns 收益率数组
   * @param riskFreeRate 无风险收益率
   * @returns Sharpe 比率
   */
  static calculateSharpeRatio(
    returns: (SafePrice | number)[],
    riskFreeRate: SafePrice | number = 0.02
  ): SafePrice {
    if (returns.length < 2) return new SafePrice(0);

    const safeReturns = returns.map(r => r instanceof SafePrice ? r : new SafePrice(r));
    const rfRate = riskFreeRate instanceof SafePrice ? riskFreeRate : new SafePrice(riskFreeRate);

    // 计算平均超额收益
    const avgReturn = safeReturns.reduce((sum, r) => sum.plus(r), new SafePrice(0)).div(returns.length);
    const excessReturn = avgReturn.minus(rfRate);

    // 计算标准差
    const variance = safeReturns.reduce((sum, r) => {
      const diff = r.minus(avgReturn);
      return sum.plus(diff.times(diff));
    }, new SafePrice(0)).div(returns.length - 1);
    
    const stdDev = new SafePrice(Math.sqrt(variance.toNumber()));

    // Sharpe = (平均收益 - 无风险收益) / 标准差
    return stdDev.gt(0) ? excessReturn.div(stdDev) : new SafePrice(0);
  }
}

/**
 * 便捷函数
 */
export const price = (value: number | string): SafePrice => new SafePrice(value);
export const usd = (value: number | string): SafePrice => new SafePrice(value);
export const percent = (value: number | string): SafePrice => new SafePrice(value);

/**
 * 数学常数
 */
export const MATH_CONSTANTS = {
  ZERO: new SafePrice(0),
  ONE: new SafePrice(1),
  HUNDRED: new SafePrice(100),
  BPS_TO_PERCENT: new SafePrice(0.01), // 基点转百分比
  PERCENT_TO_DECIMAL: new SafePrice(0.01), // 百分比转小数
} as const;

export default { SafePrice, TradingMath, price, usd, percent, MATH_CONSTANTS };