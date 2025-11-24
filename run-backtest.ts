/**
 * 回测运行脚本
 * 用法: npx ts-node run-backtest.ts
 */

import { BacktestEngine } from './lib/backtesting/backtestEngine';
import { fetchHistoricalCandles, fetchMultipleCoinsData } from './lib/backtesting/historicalData';
import { AI_MODELS } from './lib/aiModels';
import { Coin } from './types/trading';

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🔬 Alpha Arena - 回测系统');
  console.log('='.repeat(70) + '\n');

  // 配置回测参数
  const COINS: Coin[] = ['BTC', 'ETH', 'SOL'];  // 回测的币种
  const INTERVAL = '1h';                        // K线间隔
  const DAYS = 7;                               // 回测天数
  const INITIAL_CAPITAL = 1000;                 // 初始资金

  try {
    // 1. 获取历史数据
    console.log('📡 步骤 1/3: 获取历史数据...\n');

    const endTime = Date.now();
    const startTime = endTime - (DAYS * 24 * 60 * 60 * 1000);

    const historicalDataSets = [];

    for (const coin of COINS) {
      console.log(`   正在获取 ${coin} 最近 ${DAYS} 天的 ${INTERVAL} K线数据...`);
      const candles = await fetchHistoricalCandles(coin, INTERVAL, 500);

      historicalDataSets.push({
        coin,
        interval: INTERVAL,
        candles,
      });

      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`\n✅ 历史数据获取完成！\n`);

    // 2. 选择要测试的AI模型
    console.log('🤖 步骤 2/3: 选择AI模型...\n');

    // 这里使用第一个模型（DeepSeek V3.1）
    const model = AI_MODELS[0];
    console.log(`   使用模型: ${model.displayName}`);
    console.log(`   策略: ${model.strategy}\n`);

    // 3. 运行回测
    console.log('🚀 步骤 3/3: 运行回测...\n');

    const engine = new BacktestEngine();

    const result = await engine.runBacktest(model, historicalDataSets, {
      initialCapital: INITIAL_CAPITAL,
      startDate: new Date(startTime),
      endDate: new Date(endTime),
      interval: INTERVAL,
      enableRiskManagement: true,  // 启用风险管理
    });

    // 4. 保存结果（可选）
    console.log('💾 保存回测结果...\n');

    const fs = await import('fs');
    const path = await import('path');

    const resultDir = path.join(process.cwd(), 'backtest-results');
    if (!fs.existsSync(resultDir)) {
      fs.mkdirSync(resultDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backtest_${model.name}_${timestamp}.json`;
    const filepath = path.join(resultDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));

    console.log(`✅ 回测结果已保存到: ${filepath}\n`);

    // 5. 输出简要摘要
    console.log('=' .repeat(70));
    console.log('📋 回测总结');
    console.log('='.repeat(70));
    console.log(`模型: ${result.model}`);
    console.log(`回测时长: ${DAYS} 天 (${result.totalBars} 根K线)`);
    console.log(`初始资金: $${INITIAL_CAPITAL}`);
    console.log(`最终权益: $${result.finalEquity.toFixed(2)}`);
    console.log(`总回报: ${result.totalReturn >= 0 ? '+' : ''}${result.totalReturn.toFixed(2)}%`);
    console.log(`胜率: ${result.winRate.toFixed(1)}%`);
    console.log(`最大回撤: ${result.maxDrawdown.toFixed(2)}%`);
    console.log(`夏普比率: ${result.sharpeRatio.toFixed(2)}`);
    console.log('='.repeat(70) + '\n');

    // 6. 显示前5笔交易
    if (result.trades.length > 0) {
      console.log('📈 前 5 笔交易:\n');
      result.trades.slice(0, 5).forEach((trade, i) => {
        const pnlSign = trade.pnl >= 0 ? '+' : '';
        console.log(`${i + 1}. ${trade.coin} ${trade.side} ${trade.leverage}x`);
        console.log(`   入场: $${trade.entryPrice.toFixed(2)} → 出场: $${trade.exitPrice.toFixed(2)}`);
        console.log(`   盈亏: ${pnlSign}$${trade.pnl.toFixed(2)} (${pnlSign}${trade.pnlPercent.toFixed(2)}%)`);
        console.log(`   原因: ${trade.exitReason}\n`);
      });
    }

    console.log('🎉 回测完成！\n');

  } catch (error) {
    console.error('\n❌ 回测失败:', error);
    console.error('\n提示: 请检查网络连接和API可用性\n');
    process.exit(1);
  }
}

// 运行主函数
main().catch(console.error);
