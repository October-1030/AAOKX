'use client';

import React, { useMemo } from 'react';
import type { Trade, RegimeStrategyStats } from '@/types/performance';

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
const formatNumber = (value: number, digits = 2) => value.toFixed(digits);

/**
 * 按 Regime + StrategyFlavor 分组，计算：
 * - 交易笔数
 * - 胜率
 * - 平均 R
 * - 总 PnL
 * - 最大连续亏损次数
 */
function computeStatsByRegimeAndStrategy(trades: Trade[]): RegimeStrategyStats[] {
  // 只统计有 regime 和 strategyFlavor 的已平仓交易
  const closed = trades.filter(
    (t) => t.regime && t.strategyFlavor && (t.exitTime || t.closedAt) // exitTime 或 closedAt 存在视为 closed trade
  );

  const groups = new Map<string, Trade[]>();

  for (const t of closed) {
    const regime = t.regime || 'UNKNOWN';
    const strategyFlavor = t.strategyFlavor || 'UNKNOWN';
    const key = `${regime}__${strategyFlavor}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(t);
  }

  const result: RegimeStrategyStats[] = [];

  for (const [key, group] of groups.entries()) {
    const [regime, strategyFlavor] = key.split('__');

    const tradeCount = group.length;
    if (!tradeCount) continue;

    let winCount = 0;
    let totalPnl = 0;
    let rSum = 0;
    let rCount = 0;

    let currentLosingStreak = 0;
    let maxLosingStreak = 0;

    for (const t of group) {
      const pnl = t.pnl ?? t.realizedPnl ?? 0;
      totalPnl += pnl;

      if (pnl > 0) {
        winCount++;
        currentLosingStreak = 0;
      } else if (pnl < 0) {
        currentLosingStreak++;
        if (currentLosingStreak > maxLosingStreak) {
          maxLosingStreak = currentLosingStreak;
        }
      }

      if (typeof t.rMultiple === 'number') {
        rSum += t.rMultiple;
        rCount++;
      }
    }

    const winRate = winCount / tradeCount;
    const avgR = rCount > 0 ? rSum / rCount : null;

    result.push({
      regime,
      strategyFlavor,
      tradeCount,
      winRate,
      avgR,
      totalPnl,
      maxLosingStreak,
    });
  }

  // 排序：先按 regime，再按 strategyFlavor
  result.sort((a, b) => {
    if (a.regime === b.regime) {
      return a.strategyFlavor.localeCompare(b.strategyFlavor);
    }
    return a.regime.localeCompare(b.regime);
  });

  return result;
}

export default function PerformanceRegimeDetail({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => computeStatsByRegimeAndStrategy(trades), [trades]);

  if (!stats.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3 text-xs text-gray-500">
        No regime &amp; strategy stats yet. Once you have some closed trades with{' '}
        <span className="font-medium text-gray-700">regime</span> and{' '}
        <span className="font-medium text-gray-700">strategyFlavor</span> set,
        this table will show how each combination performs.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Regime × Strategy Detail
          </h3>
          <p className="text-xs text-gray-500">
            Breakdown of performance by market regime and strategy flavor.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Regime</th>
              <th className="px-3 py-2 font-medium">Strategy</th>
              <th className="px-3 py-2 text-right font-medium">Trades</th>
              <th className="px-3 py-2 text-right font-medium">Win Rate</th>
              <th className="px-3 py-2 text-right font-medium">Avg R</th>
              <th className="px-3 py-2 text-right font-medium">Total PnL</th>
              <th className="px-3 py-2 text-right font-medium">
                Max Losing Streak
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.map((row) => {
              const isPositivePnl = row.totalPnl > 0;
              const isGoodWinRate = row.winRate >= 0.5;

              return (
                <tr
                  key={`${row.regime}__${row.strategyFlavor}`}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                      {row.regime}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{row.strategyFlavor}</td>
                  <td className="px-3 py-2 text-right text-gray-900 font-medium">
                    {row.tradeCount}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`font-medium ${
                        isGoodWinRate ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatPercent(row.winRate)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {row.avgR !== null ? formatNumber(row.avgR, 2) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`font-medium ${
                        isPositivePnl ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {isPositivePnl ? '+' : ''}${formatNumber(row.totalPnl)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        row.maxLosingStreak >= 3
                          ? 'bg-red-100 text-red-700'
                          : row.maxLosingStreak >= 2
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {row.maxLosingStreak}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
