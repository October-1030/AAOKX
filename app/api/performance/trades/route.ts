import { NextResponse } from 'next/server';
import { getTradeLog } from '@/lib/tradeLog';

/**
 * GET /api/performance/trades
 * 返回所有交易记录（包含 AI 解释）
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'open' | 'closed' | 'all'
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const tradeLog = getTradeLog();

    let trades;
    if (status === 'open') {
      trades = tradeLog.getOpenTrades();
    } else if (status === 'closed') {
      trades = tradeLog.getClosedTrades().slice(-limit);
    } else {
      trades = tradeLog.getAllTrades().slice(-limit);
    }

    // 计算统计
    const stats = tradeLog.getTradeStats();
    const openTrades = tradeLog.getOpenTrades();
    const closedTrades = tradeLog.getClosedTrades();

    return NextResponse.json({
      success: true,
      data: trades,
      stats: {
        totalTrades: stats.totalTrades,
        openTrades: openTrades.length,
        closedTrades: closedTrades.length,
        winRate: stats.winRate,
        totalPnl: stats.totalPnl,
        avgPnl: stats.totalTrades > 0 ? stats.totalPnl / stats.totalTrades : 0,
        winCount: stats.winningTrades,
        lossCount: stats.losingTrades,
      },
    });
  } catch (error) {
    console.error('[API] /api/performance/trades error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
