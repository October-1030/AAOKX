/**
 * 分析当前OKX持仓的市场状态
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { analyzeMarketRegime, formatRegimeAnalysis, type RegimeContext } from './lib/marketRegimeEnhanced';

// 加载环境变量
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const key in envConfig) {
    process.env[key] = envConfig[key];
  }
}

// 当前持仓数据（从 check-positions-simple.ts 的结果）
const currentPositions = [
  {
    coin: 'BNB',
    side: 'LONG',
    entryPrice: 899.81,
    currentPrice: 890.00,
    leverage: 3,
    notional: 267.01,
    unrealizedPnL: -2.94,
    uplPercent: -3.27,
  },
  {
    coin: 'SOL',
    side: 'LONG',
    entryPrice: 139.59,
    currentPrice: 138.72,
    leverage: 3,
    notional: 166.47,
    unrealizedPnL: -1.04,
    uplPercent: -1.87,
  },
  {
    coin: 'DOGE',
    side: 'LONG',
    entryPrice: 0.15,
    currentPrice: 0.15,
    leverage: 3,
    notional: 33.77,
    unrealizedPnL: -0.93,
    uplPercent: -8.07,
  },
];

// 模拟当前市场技术指标（需要实际从API获取）
// 这里使用模拟数据展示功能
const marketContexts: Record<string, RegimeContext> = {
  BNB: {
    price: 890.00,
    emaShort: 895,    // EMA20
    emaMid: 900,      // EMA50
    emaLong: 905,     // EMA200
    macd: -2.5,       // 负值，下跌
    adx: 16,          // 弱趋势
    atrPct: 3.2,      // 适中波动
    rsi: 45,          // 中性偏弱
    zScore: -0.5,
    rSquared: 0.3,
  },
  SOL: {
    price: 138.72,
    emaShort: 140,
    emaMid: 141,
    emaLong: 142,
    macd: -1.8,
    adx: 14,          // 震荡
    atrPct: 4.5,
    rsi: 42,
    zScore: -0.8,
    rSquared: 0.25,
  },
  DOGE: {
    price: 0.15,
    emaShort: 0.151,
    emaMid: 0.1505,
    emaLong: 0.1508,
    macd: -0.002,
    adx: 12,          // 震荡
    atrPct: 5.8,      // 较高波动
    rsi: 38,
    zScore: -1.2,
    rSquared: 0.2,
  },
};

console.log('========================================');
console.log('   Current Positions Regime Analysis');
console.log('========================================\n');

let totalNotional = 0;
let totalUpl = 0;

currentPositions.forEach((pos, index) => {
  totalNotional += pos.notional;
  totalUpl += pos.unrealizedPnL;

  console.log(`\n${index + 1}. ${pos.coin}-USDT-SWAP ${pos.side}`);
  console.log('─'.repeat(70));
  console.log(`Entry: $${pos.entryPrice.toFixed(2)} → Current: $${pos.currentPrice.toFixed(2)}`);
  console.log(`Notional: $${pos.notional.toFixed(2)} @ ${pos.leverage}x leverage`);
  console.log(`P&L: $${pos.unrealizedPnL.toFixed(2)} (${pos.uplPercent.toFixed(2)}%)`);

  // 分析当前市场状态
  const regimeCtx = marketContexts[pos.coin];
  if (regimeCtx) {
    const analysis = analyzeMarketRegime(regimeCtx);

    console.log('\n📊 Market Regime Analysis:');
    console.log(formatRegimeAnalysis(analysis));

    // 给出持仓建议
    console.log('\n💡 Position Recommendation:');

    if (pos.side === 'LONG') {
      if (analysis.regime === 'DOWNTREND') {
        console.log('   ⚠️  WARNING: Holding LONG in DOWNTREND - Consider closing');
      } else if (analysis.regime === 'CHOPPY') {
        console.log('   ⚠️  WARNING: Holding position in CHOPPY market - High risk');
      } else if (analysis.regime === 'UPTREND') {
        console.log('   ✅ GOOD: Aligned with UPTREND - Let it run');
      } else if (analysis.regime === 'RANGING') {
        if (analysis.bias === 'FLAT' && pos.uplPercent < -2) {
          console.log('   ⚠️  NEUTRAL: Ranging market with loss > 2% - Consider exiting');
        } else {
          console.log('   ⏸️  HOLD: Wait for clearer signal in ranging market');
        }
      }
    }

    // 止损建议
    if (pos.uplPercent < -3) {
      console.log(`   🛑 STOP LOSS: Loss exceeds -3% (${pos.uplPercent.toFixed(2)}%)`);
    } else if (pos.uplPercent < -2) {
      console.log(`   ⚠️  CAUTION: Loss approaching -2% threshold`);
    }
  }
});

// 总览
console.log('\n\n========================================');
console.log('   Portfolio Summary');
console.log('========================================\n');

console.log(`Total Positions: ${currentPositions.length}`);
console.log(`Total Notional: $${totalNotional.toFixed(2)}`);
console.log(`Total Unrealized P&L: $${totalUpl.toFixed(2)} (${((totalUpl / totalNotional) * 100).toFixed(2)}%)`);

// 风险评估
console.log('\n🎯 Risk Assessment:');

const highRiskPositions = currentPositions.filter(p => {
  const ctx = marketContexts[p.coin];
  if (!ctx) return false;
  const analysis = analyzeMarketRegime(ctx);
  return analysis.regime === 'CHOPPY' || analysis.regime === 'DOWNTREND' ||
         (p.side === 'LONG' && analysis.bias === 'SHORT');
});

const lossyPositions = currentPositions.filter(p => p.uplPercent < -2);

if (highRiskPositions.length > 0) {
  console.log(`   ⚠️  ${highRiskPositions.length} position(s) in unfavorable market regime`);
  highRiskPositions.forEach(p => console.log(`      - ${p.coin}: ${p.uplPercent.toFixed(2)}%`));
}

if (lossyPositions.length > 0) {
  console.log(`   🛑 ${lossyPositions.length} position(s) with loss > 2%`);
  lossyPositions.forEach(p => console.log(`      - ${p.coin}: ${p.uplPercent.toFixed(2)}%`));
}

if (highRiskPositions.length === 0 && lossyPositions.length === 0) {
  console.log('   ✅ No high-risk positions detected');
}

// 建议
console.log('\n💡 Overall Recommendations:');

const avgLoss = totalUpl / currentPositions.length;
if (avgLoss < -2) {
  console.log('   1. Portfolio is underperforming - Review all positions');
}

if (highRiskPositions.length > 1) {
  console.log('   2. Multiple positions in unfavorable regimes - Consider reducing exposure');
}

if (Math.abs(totalUpl) > 10) {
  console.log('   3. Total unrealized loss exceeds $10 - Review risk management');
}

const doge = currentPositions.find(p => p.coin === 'DOGE');
if (doge && doge.uplPercent < -5) {
  console.log(`   4. DOGE position has significant loss (${doge.uplPercent.toFixed(2)}%) - Consider cutting loss`);
}

console.log('\n');
