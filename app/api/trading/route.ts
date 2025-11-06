import { NextResponse } from 'next/server';
import { TradingEngineState } from '@/lib/tradingEngine';
import { AI_MODELS } from '@/lib/aiModels';
import { getAllMarketData, updateMarketData, initializeMarketData } from '@/lib/marketData';
import { CONFIG } from '@/lib/config';
import fs from 'fs';
import path from 'path';

// 全局交易引擎实例（在实际生产环境中应使用数据库）
let tradingEngine: TradingEngineState | null = null;
let isRunning = false;
let updateInterval: NodeJS.Timeout | null = null;
let marketDataInitialized = false;

/**
 * 获取全局交易引擎实例（供其他 API 端点使用）
 */
export function getTradingEngine(): TradingEngineState | null {
  return tradingEngine;
}

/**
 * 获取市场数据（使用 CoinGecko 现货价格）
 */
async function getMarketData() {
  // 初始化市场数据（仅一次）
  if (!marketDataInitialized) {
    try {
      await initializeMarketData();
      marketDataInitialized = true;
    } catch (error) {
      console.error('Failed to initialize market data:', error);
    }
  }

  return getAllMarketData();
}

/**
 * 更新市场数据
 */
async function updateMarketDataWrapper() {
  await updateMarketData();
}

function initializeEngine() {
  if (!tradingEngine) {
    tradingEngine = new TradingEngineState(AI_MODELS);
  }
  return tradingEngine;
}

async function startTradingLoop() {
  if (isRunning) return;

  isRunning = true;
  const engine = initializeEngine();

  // ✅ 确保市场数据在第一次执行前已初始化
  try {
    await getMarketData();
    console.log('✅ Market data initialized for trading loop');
  } catch (error) {
    console.error('❌ Failed to initialize market data:', error);
    isRunning = false;
    return;
  }

  // 每3分钟执行一次交易周期（模拟Alpha Arena的2-3分钟间隔）
  updateInterval = setInterval(async () => {
    try {
      // 更新市场数据
      await updateMarketDataWrapper();

      // 执行交易周期
      await engine.executeTradingCycle();

      console.log('✅ Trading cycle completed');
    } catch (error) {
      console.error('❌ Trading cycle error:', error);
    }
  }, CONFIG.TRADING_INTERVAL_MS);

  console.log('🚀 Trading engine started');
  console.log(`📊 Data source: ${CONFIG.USE_REAL_MARKET_DATA ? 'CoinGecko (Real Prices) + Simulated K-lines' : 'Simulated'}`);
}

function stopTradingLoop() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  isRunning = false;
  console.log('⏸️ Trading engine stopped');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    const engine = initializeEngine();

    switch (action) {
      case 'start':
        await startTradingLoop();
        return NextResponse.json({ status: 'started' });

      case 'stop':
        stopTradingLoop();
        return NextResponse.json({ status: 'stopped' });

      case 'status':
        // ✅ 先确保市场数据已初始化，再更新价格
        const marketData = await getMarketData();
        await updateMarketDataWrapper();

        const performances = engine.getAllPerformances();

        return NextResponse.json({
          isRunning,
          performances,
          marketData,
          timestamp: Date.now(),
          dataSource: CONFIG.USE_REAL_MARKET_DATA ? 'real' : 'simulated',
        });

      default:
        // 默认返回当前状态
        // ✅ 先确保市场数据已初始化，再更新价格
        const allMarketData = await getMarketData();
        await updateMarketDataWrapper();

        const allPerformances = engine.getAllPerformances();

        return NextResponse.json({
          isRunning,
          performances: allPerformances,
          marketData: allMarketData,
          timestamp: Date.now(),
          dataSource: CONFIG.USE_REAL_MARKET_DATA ? 'real' : 'simulated',
        });
    }
  } catch (error) {
    console.error('❌ API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    const engine = initializeEngine();

    switch (action) {
      case 'execute_cycle':
        // 🔥 保存日志到文件
        const logFile = path.join(process.cwd(), 'trading-execution.log');
        const originalLog = console.log;
        const logs: string[] = [];

        console.log = (...args: any[]) => {
          const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ');
          logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
          originalLog(...args);
        };

        try {
          console.log('\n========================================');
          console.log('🚀 开始执行交易周期');
          console.log('========================================\n');

          // 🔥 确保市场数据已初始化
          await getMarketData();

          // 手动触发一次交易周期
          await updateMarketDataWrapper();
          await engine.executeTradingCycle();

          console.log('\n========================================');
          console.log('✅ 交易周期执行完成');
          console.log('========================================\n');

          // 恢复原始 console.log
          console.log = originalLog;

          // 保存日志到文件
          fs.appendFileSync(logFile, logs.join('\n') + '\n\n');
          console.log(`📄 完整日志已保存到: ${logFile}`);

          const performances = engine.getAllPerformances();
          const marketData = await getMarketData();

          return NextResponse.json({
            success: true,
            performances,
            marketData,
            timestamp: Date.now(),
            dataSource: CONFIG.USE_REAL_MARKET_DATA ? 'real' : 'simulated',
            logFile: logFile,
          });
        } finally {
          console.log = originalLog;
        }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ POST API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
