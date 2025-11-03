'use client';

import { CompletedTrade } from '@/types/trading';
import { format } from 'date-fns';
import { getModelColor, getModelDisplayName } from '@/lib/modelMeta';

interface TradeHistoryProps {
  trades: CompletedTrade[];
  modelFilter?: string;
}

export default function TradeHistory({ trades, modelFilter }: TradeHistoryProps) {
  // 过滤交易
  const filteredTrades = modelFilter
    ? trades.filter(t => t.modelName === modelFilter)
    : trades;

  // 按时间倒序排列
  const sortedTrades = [...filteredTrades].sort((a, b) => b.closedAt - a.openedAt);

  return (
    <div className="bg-gray-900 rounded-lg p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">
          📜 TRADE HISTORY
        </h2>
        <div className="text-sm text-gray-400">
          Total: {sortedTrades.length} trades
        </div>
      </div>

      {sortedTrades.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">📭</div>
          <div>No trades completed yet</div>
          <div className="text-sm mt-2">Execute some trading cycles to see history</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-3 text-left text-gray-400 font-semibold">Time</th>
                <th className="px-4 py-3 text-left text-gray-400 font-semibold">Model</th>
                <th className="px-4 py-3 text-left text-gray-400 font-semibold">Asset</th>
                <th className="px-4 py-3 text-left text-gray-400 font-semibold">Side</th>
                <th className="px-4 py-3 text-right text-gray-400 font-semibold">Entry</th>
                <th className="px-4 py-3 text-right text-gray-400 font-semibold">Exit</th>
                <th className="px-4 py-3 text-right text-gray-400 font-semibold">Leverage</th>
                <th className="px-4 py-3 text-right text-gray-400 font-semibold">P&L</th>
                <th className="px-4 py-3 text-left text-gray-400 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {sortedTrades.map((trade) => (
                <tr
                  key={trade.id}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  {/* Time */}
                  <td className="px-4 py-3 text-gray-300">
                    <div>{format(new Date(trade.closedAt), 'MM/dd HH:mm')}</div>
                    <div className="text-xs text-gray-500">
                      Duration: {Math.round((trade.closedAt - trade.openedAt) / 60000)}m
                    </div>
                  </td>

                  {/* Model */}
                  <td className="px-4 py-3">
                    <div
                      className="inline-block px-2 py-1 rounded text-xs font-semibold"
                      style={{
                        backgroundColor: `${getModelColor(trade.modelName)}20`,
                        color: getModelColor(trade.modelName),
                      }}
                    >
                      {getModelDisplayName(trade.modelName)}
                    </div>
                  </td>

                  {/* Asset */}
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-white">
                      {trade.coin}
                    </span>
                  </td>

                  {/* Side */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        trade.side === 'LONG'
                          ? 'bg-green-900 text-green-300'
                          : 'bg-red-900 text-red-300'
                      }`}
                    >
                      {trade.side}
                    </span>
                  </td>

                  {/* Entry Price */}
                  <td className="px-4 py-3 text-right font-mono text-gray-300">
                    ${trade.entryPrice.toFixed(2)}
                  </td>

                  {/* Exit Price */}
                  <td className="px-4 py-3 text-right font-mono text-gray-300">
                    ${trade.exitPrice.toFixed(2)}
                  </td>

                  {/* Leverage */}
                  <td className="px-4 py-3 text-right text-gray-300">
                    {trade.leverage}x
                  </td>

                  {/* P&L */}
                  <td className="px-4 py-3 text-right">
                    <div
                      className={`font-bold ${
                        trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </div>
                    <div
                      className={`text-xs ${
                        trade.pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      ({trade.pnlPercent >= 0 ? '+' : ''}
                      {trade.pnlPercent.toFixed(2)}%)
                    </div>
                  </td>

                  {/* Exit Reason */}
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {trade.exitReason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Statistics */}
      {sortedTrades.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-800 rounded-lg">
          <div>
            <div className="text-xs text-gray-500">Total Trades</div>
            <div className="text-lg font-bold text-white">
              {sortedTrades.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Profitable</div>
            <div className="text-lg font-bold text-green-400">
              {sortedTrades.filter(t => t.pnl > 0).length}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Losing</div>
            <div className="text-lg font-bold text-red-400">
              {sortedTrades.filter(t => t.pnl < 0).length}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Total P&L</div>
            <div
              className={`text-lg font-bold ${
                sortedTrades.reduce((sum, t) => sum + t.pnl, 0) >= 0
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}
            >
              {sortedTrades.reduce((sum, t) => sum + t.pnl, 0) >= 0 ? '+' : ''}$
              {sortedTrades.reduce((sum, t) => sum + t.pnl, 0).toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
