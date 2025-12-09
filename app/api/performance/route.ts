import { NextResponse } from 'next/server';
import { getTradeLog } from '@/lib/tradeLog';

/**
 * GET /api/performance
 * 返回完整的性能汇总数据
 */
export async function GET() {
  try {
    const tradeLog = getTradeLog();

    // 获取所有数据
    const trades = tradeLog.getAllTrades();
    const openTrades = tradeLog.getOpenTrades();
    const closedTrades = tradeLog.getClosedTrades();
    const dailyPnl = tradeLog.getDailyPnl();
    const equityCurve = tradeLog.getEquityCurve();
    const stats = tradeLog.getTradeStats();

    // 计算净值曲线指标
    let maxDrawdown = 0;
    let highWaterMark = 0;

    for (const point of equityCurve) {
      if (point.equity > highWaterMark) {
        highWaterMark = point.equity;
      }
      if (highWaterMark > 0) {
        const drawdown = ((highWaterMark - point.equity) / highWaterMark) * 100;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
    }

    const latestEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : 0;
    const initialEquity = equityCurve.length > 0 ? equityCurve[0].equity : 0;
    const totalReturn = initialEquity > 0 ? ((latestEquity - initialEquity) / initialEquity) * 100 : 0;

    // 计算今日 PnL
    const today = new Date().toISOString().split('T')[0];
    const todayPnl = dailyPnl.find(d => d.date === today);

    return NextResponse.json({
      success: true,
      summary: {
        // 账户状态
        currentEquity: latestEquity,
        initialEquity,
        highWaterMark,
        totalReturn: parseFloat(totalReturn.toFixed(2)),
        maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),

        // 今日表现
        todayPnl: todayPnl?.realizedPnl || 0,
        todayTrades: todayPnl?.tradesCount || 0,
        todayWinRate: todayPnl ? parseFloat(((todayPnl.winCount / (todayPnl.winCount + todayPnl.lossCount || 1)) * 100).toFixed(1)) : 0,

        // 累计统计
        totalTrades: stats.totalTrades,
        openTrades: openTrades.length,
        closedTrades: closedTrades.length,
        winRate: stats.winRate,
        totalPnl: stats.totalPnl,
        avgPnl: stats.totalTrades > 0 ? stats.totalPnl / stats.totalTrades : 0,

        // 时间范围
        dataRange: {
          start: equityCurve.length > 0 ? equityCurve[0].timestamp : null,
          end: equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].timestamp : null,
        },
      },
      recentTrades: closedTrades.slice(-10).reverse(), // 最近 10 笔已平仓交易
      openPositions: openTrades,
      dailyPnl: dailyPnl.slice(-30), // 最近 30 天
      equityCurve: equityCurve.slice(-100), // 最近 100 个数据点
    });
  } catch (error) {
    console.error('[API] /api/performance error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
