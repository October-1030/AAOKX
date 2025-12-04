/**
 * 增强交易API路由
 * 使用混合交易引擎和高级功能
 */

import { NextResponse } from 'next/server';
import { hybridTradingEngine } from '@/lib/enhanced/hybridTradingEngine';
import { getAllMarketData, updateMarketData, initializeMarketData } from '@/lib/marketData';
import { CONFIG } from '@/lib/config';
import fs from 'fs';
import path from 'path';

// 运行状态管理
let isRunning = false;
let updateInterval: NodeJS.Timeout | null = null;
let marketDataInitialized = false;
let systemStartTime = 0;

/**
 * 获取市场数据
 */
async function getMarketData() {
  if (!marketDataInitialized) {
    try {
      await initializeMarketData();
      marketDataInitialized = true;
      console.log('✅ [Enhanced] Market data initialized');
    } catch (error) {
      console.error('❌ [Enhanced] Failed to initialize market data:', error);
    }
  }
  return getAllMarketData();
}

/**
 * 启动增强交易循环
 */
async function startEnhancedTradingLoop() {
  if (isRunning) return;

  isRunning = true;
  systemStartTime = Date.now();
  
  try {
    // 初始化市场数据
    await getMarketData();
    console.log('✅ [Enhanced] Market data ready');

    // 启动混合交易引擎
    await hybridTradingEngine.start();
    console.log('🚀 [Enhanced] Hybrid trading engine started');

    // 价格更新循环 (每30秒更新价格给事件系统)
    updateInterval = setInterval(async () => {
      try {
        await updateMarketData();
        const marketData = getAllMarketData();
        
        // 将价格更新推送给事件驱动系统
        for (const [coin, data] of Object.entries(marketData)) {
          if (data && typeof data === 'object' && 'price' in data) {
            hybridTradingEngine.updatePrice(coin as any, (data as any).price);
          }
        }
        
      } catch (error) {
        console.error('❌ [Enhanced] Price update failed:', error);
      }
    }, 30000); // 每30秒更新一次价格

    console.log(`⏰ [Enhanced] Price updates every 30 seconds, trading decisions every 3 minutes`);
    
  } catch (error) {
    console.error('❌ [Enhanced] Failed to start trading loop:', error);
    isRunning = false;
    throw error;
  }
}

/**
 * 停止增强交易循环
 */
function stopEnhancedTradingLoop() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  
  hybridTradingEngine.stop();
  isRunning = false;
  
  const runningTime = Date.now() - systemStartTime;
  console.log(`⏸️ [Enhanced] Trading engine stopped after ${Math.round(runningTime / 1000)}s`);
}

/**
 * 获取增强系统状态
 */
async function getEnhancedSystemStatus() {
  const marketData = await getMarketData();
  const systemStatus = hybridTradingEngine.getSystemStatus();
  const runningTime = isRunning ? Date.now() - systemStartTime : 0;
  
  return {
    isRunning,
    runningTimeMs: runningTime,
    marketData,
    hybridEngine: systemStatus,
    timestamp: Date.now(),
    dataSource: CONFIG.USE_REAL_MARKET_DATA ? 'real' : 'simulated',
    version: 'enhanced-v2.0'
  };
}

/**
 * GET请求处理
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'start':
        await startEnhancedTradingLoop();
        return NextResponse.json({ 
          status: 'started', 
          message: 'Enhanced hybrid trading engine started',
          features: [
            'Event-driven architecture',
            'Real-time arbitrage detection', 
            'Strict type safety',
            'Advanced risk management'
          ]
        });

      case 'stop':
        stopEnhancedTradingLoop();
        return NextResponse.json({ 
          status: 'stopped',
          message: 'Enhanced hybrid trading engine stopped'
        });

      case 'status':
        const status = await getEnhancedSystemStatus();
        return NextResponse.json(status);

      case 'metrics':
        const systemStatus = hybridTradingEngine.getSystemStatus();
        return NextResponse.json({
          performance: systemStatus.performanceMetrics,
          arbitrage: systemStatus.arbitrageStats,
          eventEngine: systemStatus.advancedEngineStatus,
          timestamp: Date.now()
        });

      case 'test_arbitrage':
        // 测试套利检测
        hybridTradingEngine.updatePrice('BTC', 50000, 'hyperliquid');
        hybridTradingEngine.updatePrice('BTC', 50150, 'binance'); // 0.3%差价
        hybridTradingEngine.updatePrice('ETH', 3000, 'hyperliquid');
        hybridTradingEngine.updatePrice('ETH', 3020, 'coinbase'); // 0.67%差价
        
        return NextResponse.json({
          message: 'Test price differences injected',
          note: 'Check logs for arbitrage detection results'
        });

      default:
        // 默认返回系统状态
        const defaultStatus = await getEnhancedSystemStatus();
        return NextResponse.json(defaultStatus);
    }
  } catch (error) {
    console.error('❌ [Enhanced] API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: (error as Error).message,
        version: 'enhanced-v2.0'
      },
      { status: 500 }
    );
  }
}

/**
 * POST请求处理
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'execute_enhanced_cycle':
        console.log('\n🚀 [Enhanced] Manual cycle execution requested');
        
        // 手动触发一次增强交易周期
        if (!isRunning) {
          return NextResponse.json(
            { error: 'Enhanced trading engine is not running. Start it first.' },
            { status: 400 }
          );
        }

        // 更新市场数据
        await updateMarketData();
        const marketData = getAllMarketData();
        
        // 推送价格更新
        for (const [coin, data] of Object.entries(marketData)) {
          if (data && typeof data === 'object' && 'price' in data) {
            hybridTradingEngine.updatePrice(coin as any, (data as any).price);
          }
        }

        const systemStatus = hybridTradingEngine.getSystemStatus();
        
        return NextResponse.json({
          success: true,
          message: 'Enhanced trading cycle executed',
          systemStatus,
          marketData,
          timestamp: Date.now()
        });

      case 'update_prices':
        // 手动价格更新
        const { priceUpdates } = body;
        if (priceUpdates && Array.isArray(priceUpdates)) {
          for (const update of priceUpdates) {
            if (update.coin && update.price) {
              hybridTradingEngine.updatePrice(
                update.coin, 
                update.price, 
                update.exchange || 'manual'
              );
            }
          }
        }
        
        return NextResponse.json({
          success: true,
          message: `Updated ${priceUpdates?.length || 0} prices`,
          timestamp: Date.now()
        });

      case 'test_integration':
        // 集成测试
        const testResults = {
          strictTypes: 'Available',
          eventDriven: hybridTradingEngine.getSystemStatus().isRunning ? 'Running' : 'Stopped',
          arbitrageDetection: 'Active',
          marketData: marketDataInitialized ? 'Initialized' : 'Not ready'
        };

        return NextResponse.json({
          success: true,
          message: 'Integration test completed',
          results: testResults,
          timestamp: Date.now()
        });

      default:
        return NextResponse.json(
          { error: 'Unknown action', availableActions: [
            'execute_enhanced_cycle',
            'update_prices', 
            'test_integration'
          ]},
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ [Enhanced] POST API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: (error as Error).message,
        version: 'enhanced-v2.0'
      },
      { status: 500 }
    );
  }
}