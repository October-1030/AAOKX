import numeral from "numeral";

/**
 * 格式化货币
 */
export function formatCurrency(value: number, decimals: number = 2): string {
  if (Math.abs(value) >= 1000000) {
    return numeral(value).format("$0.00a").toUpperCase();
  }
  return numeral(value).format(`$0,0.${"0".repeat(decimals)}`);
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number, decimals: number = 2): string {
  const format = `0.${"0".repeat(decimals)}%`;
  return numeral(value / 100).format(format);
}

/**
 * 格式化带正负号的百分比
 */
export function formatPercentWithSign(
  value: number,
  decimals: number = 2
): string {
  const formatted = formatPercent(value, decimals);
  return value >= 0 ? `+${formatted}` : formatted;
}

/**
 * 格式化数字（带千分位）
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return numeral(value).format(`0,0.${"0".repeat(decimals)}`);
}

/**
 * 格式化大数（K, M, B）
 */
export function formatLargeNumber(value: number): string {
  return numeral(value).format("0.0a").toUpperCase();
}

/**
 * 格式化价格（根据币种自动调整小数位）
 */
export function formatPrice(value: number, coin?: string): string {
  // DOGE 等低价币种显示更多小数位
  const decimals = coin === "DOGE" ? 4 : 2;
  return numeral(value).format(`$0,0.${"0".repeat(decimals)}`);
}
