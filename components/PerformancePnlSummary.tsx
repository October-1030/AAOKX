'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface DailyPnl {
  date: string;
  realizedPnl: number;
  tradesCount: number;
  winCount: number;
  lossCount: number;
}

interface PnlSummary {
  todayPnl: number;
  todayTrades: number;
  todayWinRate: number;
  totalPnl: number;
  winRate: number;
  totalTrades: number;
}

interface PerformancePnlSummaryProps {
  dailyPnl?: DailyPnl[];
  summary?: PnlSummary;
}

const defaultSummary: PnlSummary = {
  todayPnl: 0,
  todayTrades: 0,
  todayWinRate: 0,
  totalPnl: 0,
  winRate: 0,
  totalTrades: 0,
};

export default function PerformancePnlSummary({ dailyPnl: propDailyPnl, summary: propSummary }: PerformancePnlSummaryProps) {
  const [dailyPnl, setDailyPnl] = useState<DailyPnl[]>(propDailyPnl || []);
  const [summary, setSummary] = useState<PnlSummary>(propSummary || defaultSummary);
  const [loading, setLoading] = useState(!propDailyPnl);

  useEffect(() => {
    // 如果没有传入 props，则自己 fetch
    if (!propDailyPnl) {
      fetch('/api/performance/daily-pnl')
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            setDailyPnl(result.data || []);
            setSummary(result.summary || defaultSummary);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [propDailyPnl]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <div className="animate-pulse">Loading daily PnL...</div>
      </div>
    );
  }

  const chartData = dailyPnl.map(d => ({
    ...d,
    pnl: d.realizedPnl, // Map to 'pnl' for chart
    displayDate: d.date.slice(5), // MM-DD
  }));

  return (
    <div className="bg-gray-900 rounded-lg p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Daily PnL</h2>
        <div className="flex gap-4 text-sm">
          <div className="text-gray-400">
            Today: <span className={summary.todayPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
              {summary.todayPnl >= 0 ? '+' : ''}${summary.todayPnl.toFixed(2)}
            </span>
          </div>
          <div className="text-gray-400">
            Total: <span className={summary.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
              {summary.totalPnl >= 0 ? '+' : ''}${summary.totalPnl.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="displayDate"
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
            />
            <YAxis
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af' }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'PnL']}
            />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.pnl >= 0 ? '#4ade80' : '#f87171'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center text-gray-400 py-8">
          No PnL data available yet...
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div className="bg-gray-800 rounded p-3">
          <div className="text-xs text-gray-500">Total Trades</div>
          <div className="text-lg font-bold text-white">{summary.totalTrades}</div>
        </div>
        <div className="bg-gray-800 rounded p-3">
          <div className="text-xs text-gray-500">Win Rate</div>
          <div className={`text-lg font-bold ${summary.winRate >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
            {summary.winRate.toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-800 rounded p-3">
          <div className="text-xs text-gray-500">Today Trades</div>
          <div className="text-lg font-bold text-gray-300">{summary.todayTrades}</div>
        </div>
      </div>
    </div>
  );
}
