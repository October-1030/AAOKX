import { NextResponse } from 'next/server';
import { TradesResponse, TradeRecord } from '@/types/trading';
import { CompletedTrade } from '@/types/trading';
import { getTradingEngine } from '@/lib/tradingEngineManager';

/**
 * GET /api/trades
 * 返回所有完成的交易记录（nof1.ai 格式）
 */
export async function GET(request: Request) {
  try {
    // 获取引擎实例
    const tradingEngine = getTradingEngine();

    // 如果没有引擎实例，返回空数组
    if (!tradingEngine) {
      return NextResponse.json({
        trades: [],
      } as TradesResponse);
    }

    const completedTrades = tradingEngine.getAllCompletedTrades();

    // 转换为 nof1.ai 格式
    const trades: TradeRecord[] = completedTrades.map((trade: CompletedTrade, index: number) => {
      const symbol = trade.coin;
      const side = trade.side.toLowerCase() as 'long' | 'short';

      // 生成唯一 ID
      const id = `${trade.modelName.toLowerCase()}_${trade.id}`;
      const trade_id = `${trade.openedAt}_${trade.closedAt}_${symbol}_${side}`;

      // 计算手续费
      const entry_commission = trade.notional * 0.00055;
      const exit_commission = trade.notional * 0.00055;
      const total_commission = entry_commission + exit_commission;

      // 计算毛利和净利
      const realized_gross_pnl = trade.pnl + total_commission;
      const realized_net_pnl = trade.pnl;

      return {
        id,
        trade_id,
        symbol,
        side,
        trade_type: side,
        model_id: trade.modelName.toLowerCase(),
        quantity: trade.side === 'SHORT' ? -trade.notional / trade.entryPrice : trade.notional / trade.entryPrice,
        entry_price: trade.entryPrice,
        exit_price: trade.exitPrice,
        entry_sz: trade.notional / trade.entryPrice,
        exit_sz: trade.notional / trade.exitPrice,
        entry_time: trade.openedAt,
        exit_time: trade.closedAt,
        entry_human_time: new Date(trade.openedAt).toISOString(),
        exit_human_time: new Date(trade.closedAt).toISOString(),
        entry_oid: index * 2,
        exit_oid: index * 2 + 1,
        entry_tid: index * 2,
        exit_tid: index * 2 + 1,
        entry_crossed: true,
        exit_crossed: true,
        leverage: trade.leverage,
        confidence: 0.75, // 默认信心值
        entry_commission_dollars: entry_commission,
        exit_commission_dollars: exit_commission,
        total_commission_dollars: total_commission,
        entry_closed_pnl: 0,
        exit_closed_pnl: realized_net_pnl,
        realized_gross_pnl,
        realized_net_pnl,
        entry_liquidation: null,
        exit_liquidation: null,
        exit_plan: {
          profit_target: 0,
          stop_loss: 0,
          invalidation_condition: trade.exitReason,
        },
      };
    });

    const response: TradesResponse = {
      trades,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ /api/trades error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
