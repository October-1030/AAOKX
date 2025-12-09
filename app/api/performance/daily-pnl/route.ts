import { NextResponse } from 'next/server';
import { getTradeLog } from '@/lib/tradeLog';

/**
 * GET /api/performance/daily-pnl
 * 返回每日 PnL 统计
 */
export async function GET() {
  try {
    const tradeLog = getTradeLog();
    const dailyPnl = tradeLog.getDailyPnl();

    return NextResponse.json({
      success: true,
      data: dailyPnl,
      count: dailyPnl.length,
    });
  } catch (error) {
    console.error('[API] /api/performance/daily-pnl error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
