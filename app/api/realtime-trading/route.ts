/**
 * 实时交易 API 端点
 * 使用 Sentinel + Strategist 架构替代 3 分钟轮询
 */

import { NextResponse } from 'next/server';
import { getRealtimeTradingManager } from '@/lib/trading/realtimeTradingManager';
import { getMarketContext } from '@/lib/market/marketContext';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    const manager = getRealtimeTradingManager();

    switch (action) {
      case 'status':
        return NextResponse.json({
          success: true,
          ...manager.getStatus(),
        });

      case 'market-context':
        const ctx = getMarketContext();
        return NextResponse.json({
          success: true,
          context: ctx.get(),
          summary: ctx.getSummary(),
        });

      default:
        return NextResponse.json({
          success: true,
          ...manager.getStatus(),
        });
    }
  } catch (error) {
    console.error('[API] 实时交易 GET 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: '内部服务器错误',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    const manager = getRealtimeTradingManager();

    switch (action) {
      case 'start':
        console.log('[API] 🚀 启动实时交易系统...');
        const startResult = await manager.start();
        return NextResponse.json({
          success: startResult.success,
          message: startResult.message,
          status: manager.getStatus(),
        });

      case 'stop':
        console.log('[API] 🛑 停止实时交易系统...');
        const stopResult = manager.stop();
        return NextResponse.json({
          success: stopResult.success,
          message: stopResult.message,
          status: manager.getStatus(),
        });

      case 'trigger_analysis':
        console.log('[API] 📊 手动触发 Strategist 分析...');
        await manager.triggerStrategistAnalysis();
        return NextResponse.json({
          success: true,
          message: 'Strategist 分析已触发',
          status: manager.getStatus(),
        });

      default:
        return NextResponse.json(
          { success: false, error: '未知操作' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API] 实时交易 POST 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: '内部服务器错误',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}
