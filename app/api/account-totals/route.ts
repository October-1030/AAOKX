import { NextResponse } from 'next/server';
import { AccountTotalsResponse, AccountSnapshot } from '@/types/trading';
import { getTradingEngine } from '../trading/route';
import { getCurrentPrice } from '@/lib/marketData';

/**
 * GET /api/account-totals
 * 返回所有模型的账户快照（nof1.ai 格式）
 * 支持分页：?lastHourlyMarker=437
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lastHourlyMarker = searchParams.get('lastHourlyMarker');

    // 获取引擎实例
    const tradingEngine = getTradingEngine();

    // 如果没有引擎实例，返回空数组
    if (!tradingEngine) {
      return NextResponse.json({
        accountTotals: [],
      } as AccountTotalsResponse);
    }

    const snapshots = tradingEngine.getAllAccountSnapshots();
    const timestamp = Date.now();

    // 转换为 nof1.ai 格式
    const accountTotals: AccountSnapshot[] = snapshots.map((snapshot, index) => {
      // 将持仓转换为 nof1.ai 格式
      const positions: { [symbol: string]: any } = {};

      snapshot.positions.forEach((position, posIndex) => {
        const currentPrice = getCurrentPrice(position.coin);

        positions[position.coin] = {
          entry_oid: posIndex,
          risk_usd: position.notional / position.leverage,
          confidence: 0.75,
          index_col: null,
          exit_plan: {
            profit_target: position.exitPlan.takeProfit,
            stop_loss: position.exitPlan.stopLoss,
            invalidation_condition: position.exitPlan.invalidation,
          },
          entry_time: position.openedAt,
          symbol: position.coin,
          entry_price: position.entryPrice,
          tp_oid: posIndex * 2 + 1,
          margin: position.notional / position.leverage,
          wait_for_fill: false,
          sl_oid: posIndex * 2,
          oid: posIndex,
          current_price: currentPrice,
          closed_pnl: 0,
          liquidation_price: position.liquidationPrice,
          commission: position.notional * 0.00055,
          leverage: position.leverage,
          slippage: 0,
          quantity: position.side === 'SHORT' ? -(position.notional / position.entryPrice) : (position.notional / position.entryPrice),
          unrealized_pnl: position.unrealizedPnL,
        };
      });

      return {
        id: `${snapshot.model_id}_${timestamp}_${index}`,
        timestamp,
        realized_pnl: snapshot.realized_pnl,
        positions,
        since_inception_minute_marker: index,
        sharpe_ratio: snapshot.sharpe_ratio,
        cum_pnl_pct: snapshot.cum_pnl_pct,
        total_unrealized_pnl: snapshot.total_unrealized_pnl,
        model_id: snapshot.model_id,
        since_inception_hourly_marker: index,
        dollar_equity: snapshot.dollar_equity,
      };
    });

    const response: AccountTotalsResponse = {
      accountTotals,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ /api/account-totals error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
