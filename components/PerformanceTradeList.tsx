'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { MarketRegime, StrategyFlavor } from '@/types/trading';

interface TradeRecord {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  notional: number;
  leverage: number;
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: number;
  closedAt?: number;
  realizedPnl?: number;
  status: string;
  aiReason?: string;
  marketContext?: string;
  riskNote?: string;
  modelName?: string;
  confidence?: number;
  regime?: MarketRegime;
  strategyFlavor?: StrategyFlavor;
}

interface TradeStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  winCount: number;
  lossCount: number;
}

interface PerformanceTradeListProps {
  trades?: TradeRecord[];
  stats?: TradeStats;
}

const defaultStats: TradeStats = {
  totalTrades: 0,
  openTrades: 0,
  closedTrades: 0,
  winRate: 0,
  totalPnl: 0,
  avgPnl: 0,
  winCount: 0,
  lossCount: 0,
};

export default function PerformanceTradeList({ trades: propTrades, stats: propStats }: PerformanceTradeListProps) {
  const [trades, setTrades] = useState<TradeRecord[]>(propTrades || []);
  const [stats, setStats] = useState<TradeStats>(propStats || defaultStats);
  const [loading, setLoading] = useState(!propTrades);

  // Regime badge styles
  const regimeBadgeClass: Record<string, string> = {
    UPTREND: 'bg-green-100 text-green-800',
    DOWNTREND: 'bg-red-100 text-red-800',
    RANGING: 'bg-yellow-100 text-yellow-800',
    CHOPPY: 'bg-purple-100 text-purple-800',
    LOW_VOL: 'bg-gray-100 text-gray-700',
  };

  // Strategy badge styles
  const strategyBadgeClass: Record<string, string> = {
    TREND_FOLLOWING: 'bg-emerald-100 text-emerald-800',
    MEAN_REVERSION: 'bg-sky-100 text-sky-800',
    SCALPING: 'bg-pink-100 text-pink-800',
    BREAKOUT: 'bg-orange-100 text-orange-800',
    NO_TRADE: 'bg-gray-100 text-gray-700',
  };

  function formatStrategyLabel(strategy?: string) {
    if (!strategy) return 'N/A';
    return strategy
      .toLowerCase()
      .split('_')
      .map((s) => s[0].toUpperCase() + s.slice(1))
      .join(' ');
  }

  useEffect(() => {
    // 如果没有传入 props，则自己 fetch
    if (!propTrades) {
      fetch('/api/performance/trades')
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            setTrades(result.data || []);
            setStats(result.stats || defaultStats);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [propTrades]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <div className="animate-pulse">Loading trade history...</div>
      </div>
    );
  }
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: 'bg-blue-900 text-blue-300',
      closed: 'bg-gray-700 text-gray-300',
      stopped: 'bg-red-900 text-red-300',
      tp_hit: 'bg-green-900 text-green-300',
      liquidated: 'bg-purple-900 text-purple-300',
    };
    return styles[status] || 'bg-gray-700 text-gray-300';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: 'OPEN',
      closed: 'CLOSED',
      stopped: 'STOP LOSS',
      tp_hit: 'TAKE PROFIT',
      liquidated: 'LIQUIDATED',
    };
    return labels[status] || status.toUpperCase();
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Trade History</h2>
        <div className="flex gap-4 text-sm text-gray-400">
          <span>Open: <span className="text-blue-400">{stats.openTrades}</span></span>
          <span>Wins: <span className="text-green-400">{stats.winCount}</span></span>
          <span>Losses: <span className="text-red-400">{stats.lossCount}</span></span>
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          No trades recorded yet...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-3 py-2 text-left text-gray-400 font-semibold">Time</th>
                <th className="px-3 py-2 text-left text-gray-400 font-semibold">Symbol</th>
                <th className="px-3 py-2 text-left text-gray-400 font-semibold">Side</th>
                <th className="px-3 py-2 text-right text-gray-400 font-semibold">Entry</th>
                <th className="px-3 py-2 text-right text-gray-400 font-semibold">Exit</th>
                <th className="px-3 py-2 text-right text-gray-400 font-semibold">PnL</th>
                <th className="px-3 py-2 text-center text-gray-400 font-semibold">Status</th>
                <th className="px-3 py-2 text-left text-gray-400 font-semibold">AI Reason</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr
                  key={trade.id}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  {/* Time */}
                  <td className="px-3 py-2 text-gray-300">
                    <div>{format(new Date(trade.openedAt), 'MM/dd HH:mm')}</div>
                    {trade.closedAt && (
                      <div className="text-xs text-gray-500">
                        {Math.round((trade.closedAt - trade.openedAt) / 60000)}m
                      </div>
                    )}
                  </td>

                  {/* Symbol */}
                  <td className="px-3 py-2">
                    <span className="font-mono font-semibold text-white">
                      {trade.symbol}
                    </span>
                    {trade.leverage && (
                      <span className="text-xs text-gray-500 ml-1">{trade.leverage}x</span>
                    )}
                  </td>

                  {/* Side */}
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        trade.side === 'long'
                          ? 'bg-green-900 text-green-300'
                          : 'bg-red-900 text-red-300'
                      }`}
                    >
                      {trade.side.toUpperCase()}
                    </span>
                  </td>

                  {/* Entry Price */}
                  <td className="px-3 py-2 text-right font-mono text-gray-300">
                    ${trade.entryPrice.toFixed(2)}
                  </td>

                  {/* Exit Price */}
                  <td className="px-3 py-2 text-right font-mono text-gray-300">
                    {trade.exitPrice ? `$${trade.exitPrice.toFixed(2)}` : '-'}
                  </td>

                  {/* PnL */}
                  <td className="px-3 py-2 text-right">
                    {trade.realizedPnl !== undefined ? (
                      <span className={`font-bold ${trade.realizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trade.realizedPnl >= 0 ? '+' : ''}${trade.realizedPnl.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      <div className="text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusBadge(trade.status)}`}>
                          {getStatusLabel(trade.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {trade.regime && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              regimeBadgeClass[trade.regime] || 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {trade.regime}
                          </span>
                        )}
                        {trade.strategyFlavor && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              strategyBadgeClass[trade.strategyFlavor] || 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {formatStrategyLabel(trade.strategyFlavor)}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* AI Reason */}
                  <td className="px-3 py-2">
                    <div className="max-w-xs">
                      {trade.aiReason && (
                        <div className="text-xs text-gray-300 truncate" title={trade.aiReason}>
                          {trade.aiReason}
                        </div>
                      )}
                      {trade.marketContext && (
                        <div className="text-xs text-gray-500 truncate" title={trade.marketContext}>
                          {trade.marketContext}
                        </div>
                      )}
                      {trade.riskNote && (
                        <div className="text-xs text-yellow-500 truncate" title={trade.riskNote}>
                          {trade.riskNote}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stats Footer */}
      {trades.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-4 p-3 bg-gray-800 rounded-lg text-center">
          <div>
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-lg font-bold text-white">{stats.totalTrades}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Win Rate</div>
            <div className={`text-lg font-bold ${stats.winRate >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
              {stats.winRate.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Total PnL</div>
            <div className={`text-lg font-bold ${stats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Avg PnL</div>
            <div className={`text-lg font-bold ${stats.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.avgPnl >= 0 ? '+' : ''}${stats.avgPnl.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
