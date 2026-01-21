import { NextRequest, NextResponse } from 'next/server';
import { importHistoricalData, HistoricalDataConfig } from '@/lib/historicalDataImporter';
import { BacktestEngine, BacktestConfig } from '@/lib/backtestEngine';
import { Coin } from '@/types/trading';
import { calculateAllIndicators } from '@/lib/indicators';
import { callDeepSeek } from '@/lib/deepseekClient';
import { parseNOF1Response } from '@/lib/tradingPromptNOF1';

export const maxDuration = 300; // 5分钟超时限制

/**
 * POST /api/backtest
 * 执行回测
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      dataSource = 'okx', // 'okx' | 'binance' | 'csv'
      coins = ['BTC', 'ETH', 'SOL'],
      startDate, // ISO string
      endDate, // ISO string
      interval = '15m', // '1m' | '5m' | '15m' | '1h' | '4h' | '1d'
      initialBalance = 1000,
      maxLeverage = 2, // 🔒 三方共识 v1.2：默认 2x
      tradingInterval = 180, // 交易周期（秒）
      csvData, // CSV文件内容（如果dataSource是csv）
    } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: '请提供起始时间和结束时间' }, { status: 400 });
    }

    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();

    if (startTime >= endTime) {
      return NextResponse.json({ error: '起始时间必须早于结束时间' }, { status: 400 });
    }

    console.log('\n========================================');
    console.log('🧪 开始回测');
    console.log('========================================');
    console.log(`数据源: ${dataSource}`);
    console.log(`币种: ${coins.join(', ')}`);
    console.log(`时间范围: ${startDate} - ${endDate}`);
    console.log(`K线周期: ${interval}`);
    console.log(`初始资金: $${initialBalance}`);
    console.log(`========================================\n`);

    // 步骤1：导入历史数据
    console.log('[Backtest] 📥 步骤 1/3: 导入历史数据...');
    const historicalData = new Map();

    for (const coin of coins as Coin[]) {
      const config: HistoricalDataConfig = {
        source: dataSource,
        coin,
        startTime,
        endTime,
        interval,
        csvData: dataSource === 'csv' ? csvData : undefined,
      };

      try {
        const result = await importHistoricalData(config);
        historicalData.set(coin, result.candles);
        console.log(`[Backtest] ✅ ${coin}: ${result.count} 根K线`);
      } catch (error: any) {
        console.error(`[Backtest] ❌ ${coin} 导入失败:`, error.message);
        // 继续处理其他币种
      }
    }

    if (historicalData.size === 0) {
      return NextResponse.json({ error: '没有成功导入任何历史数据' }, { status: 500 });
    }

    // 步骤2：配置回测引擎
    console.log('\n[Backtest] ⚙️ 步骤 2/3: 配置回测引擎...');
    const backtestConfig: BacktestConfig = {
      initialBalance,
      maxLeverage,
      tradingInterval,
      coins: Array.from(historicalData.keys()) as Coin[],
      startTime,
      endTime,
    };

    const engine = new BacktestEngine(backtestConfig);

    // 步骤3：执行回测
    console.log('\n[Backtest] 🚀 步骤 3/3: 执行回测...');

    // AI 决策函数
    const aiDecisionFn = async (marketData: any, balance: number) => {
      // 准备数据给AI
      const coinsData = [];

      for (const [coin, data] of Object.entries(marketData as any)) {
        const { candles, indicators, currentPrice } = data as any;

        // 获取最近10分钟的数据（用于intraday分析）
        const recentCandles = candles.slice(-10);

        coinsData.push({
          coin,
          price: currentPrice,
          ema20: indicators.ema20,
          rsi7: indicators.rsi7,
          macd: indicators.macd,
          macdSignal: indicators.macdSignal,
          adx: indicators.adx,
          regime: indicators.regime,
          zScore: indicators.zScore,
          volumeRatio: indicators.volumeRatio,
          intradaySeries: recentCandles.map((c: any) => ({
            time: new Date(c.timestamp).toLocaleTimeString(),
            price: c.close,
          })),
        });
      }

      // 调用DeepSeek API
      const prompt = `You are a professional crypto trader using the nof1.ai trading format.

Current Market Data:
${JSON.stringify(coinsData, null, 2)}

Account Balance: $${balance.toFixed(2)}

Based on this data, make trading decisions for each coin. Provide your response in the nof1.ai format with CHAIN_OF_THOUGHT and TRADING_DECISIONS sections.`;

      try {
        const response = await callDeepSeek('You are a professional crypto trader.', prompt);
        const decisions = parseNOF1Response(response);
        return decisions;
      } catch (error) {
        console.error('[Backtest] ❌ AI决策失败:', error);
        return []; // 返回空决策
      }
    };

    const result = await engine.run(historicalData, aiDecisionFn);

    console.log('\n========================================');
    console.log('✅ 回测完成！');
    console.log('========================================');
    console.log(`总收益: $${result.totalPnL.toFixed(2)} (${result.totalPnLPercent.toFixed(2)}%)`);
    console.log(`总交易次数: ${result.totalTrades}`);
    console.log(`胜率: ${result.winRate.toFixed(2)}%`);
    console.log(`最大回撤: ${result.maxDrawdownPercent.toFixed(2)}%`);
    console.log(`夏普比率: ${result.sharpeRatio.toFixed(2)}`);
    console.log(`执行时间: ${(result.executionTimeMs / 1000).toFixed(2)}秒`);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      result,
    });

  } catch (error: any) {
    console.error('[Backtest] ❌ 回测失败:', error);
    return NextResponse.json(
      { error: `回测失败: ${error.message}` },
      { status: 500 }
    );
  }
}
