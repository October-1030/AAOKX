/**
 * AI自进化系统测试/演示
 * 展示如何使用新的AI学习功能
 */

import { getAIEvolutionEngine } from './lib/aiEvolutionEngine';
import { generateCompleteTradingPrompt } from './lib/tradingPromptNOF1';
import { CompletedTrade, AccountStatus, MarketData, Coin } from './types/trading';

// 模拟一些历史交易数据
const mockTrades: CompletedTrade[] = [
  // 成功的BTC交易
  {
    id: '1',
    modelName: 'DeepSeek',
    coin: 'BTC',
    side: 'LONG',
    entryPrice: 95000,
    exitPrice: 98000,
    leverage: 5,
    notional: 5000,
    pnl: 150,
    pnlPercent: 3.16,
    openedAt: Date.now() - 7200000,
    closedAt: Date.now() - 3600000,
    exitReason: 'Take profit hit',
  },
  {
    id: '2',
    modelName: 'DeepSeek',
    coin: 'BTC',
    side: 'LONG',
    entryPrice: 94000,
    exitPrice: 97000,
    leverage: 5,
    notional: 5000,
    pnl: 160,
    pnlPercent: 3.19,
    openedAt: Date.now() - 14400000,
    closedAt: Date.now() - 7200000,
    exitReason: 'Take profit hit',
  },

  // 失败的ETH交易
  {
    id: '3',
    modelName: 'DeepSeek',
    coin: 'ETH',
    side: 'SHORT',
    entryPrice: 3600,
    exitPrice: 3700,
    leverage: 10,
    notional: 3000,
    pnl: -83,
    pnlPercent: -2.78,
    openedAt: Date.now() - 21600000,
    closedAt: Date.now() - 14400000,
    exitReason: 'Stop loss hit',
  },
  {
    id: '4',
    modelName: 'DeepSeek',
    coin: 'ETH',
    side: 'SHORT',
    entryPrice: 3650,
    exitPrice: 3750,
    leverage: 10,
    notional: 3000,
    pnl: -82,
    pnlPercent: -2.74,
    openedAt: Date.now() - 28800000,
    closedAt: Date.now() - 21600000,
    exitReason: 'Stop loss hit',
  },

  // 成功的SOL交易
  {
    id: '5',
    modelName: 'DeepSeek',
    coin: 'SOL',
    side: 'LONG',
    entryPrice: 180,
    exitPrice: 190,
    leverage: 8,
    notional: 2000,
    pnl: 89,
    pnlPercent: 4.44,
    openedAt: Date.now() - 36000000,
    closedAt: Date.now() - 28800000,
    exitReason: 'Take profit hit',
  },

  // 更多BTC成功交易
  {
    id: '6',
    modelName: 'DeepSeek',
    coin: 'BTC',
    side: 'LONG',
    entryPrice: 93000,
    exitPrice: 95000,
    leverage: 5,
    notional: 5000,
    pnl: 108,
    pnlPercent: 2.15,
    openedAt: Date.now() - 43200000,
    closedAt: Date.now() - 36000000,
    exitReason: 'Take profit hit',
  },
];

async function testAIEvolution() {
  console.log('🧠 测试 AI自进化系统\n');
  console.log('=' .repeat(60));

  // 1. 获取进化引擎
  const engine = getAIEvolutionEngine();

  // 2. 分析交易历史
  console.log('\n📊 步骤1: 分析交易历史...\n');
  const report = await engine.analyzeAndLearn(mockTrades);

  console.log(`分析了 ${report.analyzedTrades} 笔交易`);
  console.log(`总胜率: ${(report.totalWinRate * 100).toFixed(1)}%\n`);

  // 3. 显示高胜率模式
  if (report.winningPatterns.length > 0) {
    console.log('✅ 高胜率模式:');
    report.winningPatterns.forEach((pattern, i) => {
      console.log(`  ${i + 1}. ${pattern.description}`);
    });
    console.log('');
  }

  // 4. 显示低胜率模式
  if (report.losingPatterns.length > 0) {
    console.log('❌ 低胜率模式:');
    report.losingPatterns.forEach((pattern, i) => {
      console.log(`  ${i + 1}. ${pattern.description}`);
    });
    console.log('');
  }

  // 5. 显示洞察
  if (report.insights.length > 0) {
    console.log('💡 关键洞察:');
    report.insights.forEach((insight, i) => {
      console.log(`  ${i + 1}. ${insight}`);
    });
    console.log('');
  }

  // 6. 显示学习prompt（这会注入到AI的下次决策中）
  console.log('=' .repeat(60));
  console.log('\n📝 步骤2: 生成学习Prompt（将注入到AI决策中）\n');
  console.log(report.learningPrompt);

  // 7. 演示完整的prompt生成（实际使用场景）
  console.log('=' .repeat(60));
  console.log('\n🎯 步骤3: 生成完整的交易Prompt（实际使用）\n');

  // 模拟账户状态
  const mockAccountStatus: AccountStatus = {
    tradingDuration: 3600000, // 1小时
    totalCalls: 20,
    totalReturn: 5.5,
    availableCash: 10500,
    totalEquity: 11055,
    positions: [],
  };

  // 模拟市场数据（简化版）
  const mockMarketData: MarketData[] = [
    {
      coin: 'BTC' as Coin,
      current: {
        price: 96000,
        ema_20: 95500,
        ema_50: 94000,
        ema_200: 90000,
        macd: 0.0045,
        macd_signal: 0.0030,
        macd_histogram: 0.0015,
        rsi: 55,
        rsi_7: 58,
        rsi_14: 55,
        atr: 1200,
        atr_3: 1000,
        atr_14: 1200,
        volume: 5000000000,
        volume_ratio: 1.2,
        linear_regression: {
          slope: 50,
          intercept: 95000,
          rSquared: 0.75,
          currentValue: 95500,
          deviation: 500,
          deviationPercent: 0.52,
          zScore: 0.5,
          signal: 'NEUTRAL',
        },
        market_regime: {
          regime: 'TRENDING',
          strength: 65,
          adx: 28,
          recommendation: 'TREND_FOLLOWING',
        },
      },
      intraday: [],
      daily: [],
    },
  ];

  // 生成增强版prompt
  const prompts = await generateCompleteTradingPrompt(
    mockAccountStatus,
    mockMarketData,
    mockTrades, // 传入历史交易
    'Balanced strategy'
  );

  console.log('✅ 已生成包含AI学习内容的完整prompt');
  console.log(`\n系统Prompt长度: ${prompts.systemPrompt.length} 字符`);
  console.log(`用户Prompt长度: ${prompts.userPrompt.length} 字符（包含学习内容）`);
  console.log(`思维链Prompt长度: ${prompts.chainOfThoughtPrompt.length} 字符`);

  // 显示用户prompt的最后一部分（包含学习内容）
  const learningSection = prompts.userPrompt.split('=== 📚 HISTORICAL LEARNING')[1];
  if (learningSection) {
    console.log('\n📚 注入的学习内容预览:');
    console.log('=== 📚 HISTORICAL LEARNING' + learningSection.substring(0, 500) + '...\n');
  }

  console.log('=' .repeat(60));
  console.log('\n✅ 测试完成！AI自进化系统已就绪。\n');
  console.log('💡 使用说明:');
  console.log('   1. 在你的交易引擎中收集 CompletedTrade[] 数据');
  console.log('   2. 调用 generateCompleteTradingPrompt() 时传入历史交易');
  console.log('   3. AI会自动从过去的成功/失败中学习');
  console.log('   4. 胜率会随着交易次数增加而提升\n');
}

// 运行测试
testAIEvolution().catch(console.error);
