import { NextResponse } from 'next/server';
import { getTradeLog } from '@/lib/tradeLog';

/**
 * GET /api/performance/equity-curve
 * 返回净值曲线数据
 */
export async function GET() {
  try {
    const tradeLog = getTradeLog();
    const equityCurve = tradeLog.getEquityCurve();

    // 计算关键指标
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let highWaterMark = 0;

    for (const point of equityCurve) {
      if (point.equity > highWaterMark) {
        highWaterMark = point.equity;
      }
      if (highWaterMark > 0) {
        currentDrawdown = ((highWaterMark - point.equity) / highWaterMark) * 100;
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
        }
      }
    }

    const latestEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : 0;
    const initialEquity = equityCurve.length > 0 ? equityCurve[0].equity : 0;
    const totalReturn = initialEquity > 0 ? ((latestEquity - initialEquity) / initialEquity) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: equityCurve,
      summary: {
        initialEquity,
        currentEquity: latestEquity,
        highWaterMark,
        totalReturn: parseFloat(totalReturn.toFixed(2)),
        maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
        dataPoints: equityCurve.length,
      },
    });
  } catch (error) {
    console.error('[API] /api/performance/equity-curve error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
