/**
 * 测试市场状态检测逻辑
 */

import { detectMarketRegime, analyzeMarketRegime, formatRegimeAnalysis, type RegimeContext } from './lib/marketRegimeEnhanced';

console.log('========================================');
console.log('   Market Regime Detection Test');
console.log('========================================\n');

// 测试场景 1: 强趋势上涨
const uptrendContext: RegimeContext = {
  price: 3100,
  emaShort: 3080,  // EMA20
  emaMid: 3050,    // EMA50
  emaLong: 3000,   // EMA200
  macd: 15,        // 正值
  adx: 35,         // 强趋势
  atrPct: 3.5,     // 适中波动
  rsi: 65,         // 偏强
  zScore: 0.5,
  rSquared: 0.8,
};

console.log('Test 1: Strong Uptrend');
console.log('─'.repeat(60));
const result1 = analyzeMarketRegime(uptrendContext);
console.log(formatRegimeAnalysis(result1));
console.log('');

// 测试场景 2: 强趋势下跌
const downtrendContext: RegimeContext = {
  price: 3000,
  emaShort: 3020,  // EMA20 < price
  emaMid: 3050,    // EMA50 > EMA20
  emaLong: 3100,   // EMA200 > EMA50
  macd: -12,       // 负值
  adx: 30,         // 强趋势
  atrPct: 4.2,     // 适中波动
  rsi: 35,         // 偏弱
  zScore: -0.8,
  rSquared: 0.75,
};

console.log('Test 2: Strong Downtrend');
console.log('─'.repeat(60));
const result2 = analyzeMarketRegime(downtrendContext);
console.log(formatRegimeAnalysis(result2));
console.log('');

// 测试场景 3: 震荡区间 - 极端超卖
const rangingOversoldContext: RegimeContext = {
  price: 3050,
  emaShort: 3055,
  emaMid: 3053,
  emaLong: 3060,
  macd: -2,
  adx: 15,         // 弱趋势
  atrPct: 2.8,     // 适中波动
  rsi: 25,         // 超卖
  zScore: -2.1,    // 极端超卖
  rSquared: 0.3,
};

console.log('Test 3: Ranging Market - Oversold Extreme');
console.log('─'.repeat(60));
const result3 = analyzeMarketRegime(rangingOversoldContext);
console.log(formatRegimeAnalysis(result3));
console.log('');

// 测试场景 4: Choppy 市场
const choppyContext: RegimeContext = {
  price: 3100,
  emaShort: 3098,  // 均线缠绕
  emaMid: 3099,
  emaLong: 3097,
  macd: 1,
  adx: 12,         // 弱趋势
  atrPct: 6.5,     // 高波动
  rsi: 48,         // 中性
  zScore: 0.2,
  rSquared: 0.2,
};

console.log('Test 4: Choppy Market');
console.log('─'.repeat(60));
const result4 = analyzeMarketRegime(choppyContext);
console.log(formatRegimeAnalysis(result4));
console.log('');

// 测试场景 5: 低波动市场
const lowVolContext: RegimeContext = {
  price: 3100,
  emaShort: 3105,
  emaMid: 3102,
  emaLong: 3098,
  macd: 0.5,
  adx: 10,         // 弱趋势
  atrPct: 0.8,     // 极低波动
  rsi: 52,
  zScore: 0.1,
  rSquared: 0.15,
};

console.log('Test 5: Low Volatility Market');
console.log('─'.repeat(60));
const result5 = analyzeMarketRegime(lowVolContext);
console.log(formatRegimeAnalysis(result5));
console.log('');

// 测试场景 6: 震荡区间 - 无极端信号
const rangingNeutralContext: RegimeContext = {
  price: 3050,
  emaShort: 3052,
  emaMid: 3055,
  emaLong: 3060,
  macd: -1,
  adx: 16,
  atrPct: 2.5,
  rsi: 50,         // 中性
  zScore: 0.3,     // 接近均值
  rSquared: 0.25,
};

console.log('Test 6: Ranging Market - Neutral (No Trade)');
console.log('─'.repeat(60));
const result6 = analyzeMarketRegime(rangingNeutralContext);
console.log(formatRegimeAnalysis(result6));
console.log('');

// 汇总统计
console.log('========================================');
console.log('   Summary');
console.log('========================================\n');

const results = [result1, result2, result3, result4, result5, result6];
const tradeable = results.filter(r => r.shouldTrade).length;

console.log(`Total Test Cases: ${results.length}`);
console.log(`Tradeable Setups: ${tradeable} (${((tradeable / results.length) * 100).toFixed(1)}%)`);
console.log(`No Trade Setups: ${results.length - tradeable} (${(((results.length - tradeable) / results.length) * 100).toFixed(1)}%)`);
console.log('');

console.log('Regime Distribution:');
const regimeCounts: Record<string, number> = {};
results.forEach(r => {
  regimeCounts[r.regime] = (regimeCounts[r.regime] || 0) + 1;
});
Object.entries(regimeCounts).forEach(([regime, count]) => {
  console.log(`  ${regime}: ${count} (${((count / results.length) * 100).toFixed(1)}%)`);
});
console.log('');

console.log('Strategy Distribution:');
const strategyCounts: Record<string, number> = {};
results.forEach(r => {
  strategyCounts[r.recommendedStrategy] = (strategyCounts[r.recommendedStrategy] || 0) + 1;
});
Object.entries(strategyCounts).forEach(([strategy, count]) => {
  console.log(`  ${strategy}: ${count} (${((count / results.length) * 100).toFixed(1)}%)`);
});
console.log('');

console.log('Average Confidence: ' + (results.reduce((sum, r) => sum + r.confidence, 0) / results.length * 100).toFixed(1) + '%');
console.log('');
