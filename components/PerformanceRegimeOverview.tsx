'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

type MarketRegime = 'UPTREND' | 'DOWNTREND' | 'RANGING' | 'CHOPPY' | 'LOW_VOL';

type StrategyFlavor =
  | 'TREND_FOLLOWING'
  | 'MEAN_REVERSION'
  | 'SCALPING'
  | 'BREAKOUT'
  | 'NO_TRADE';

interface TradeRecord {
  id?: string;
  symbol: string;
  status: 'open' | 'closed' | 'stopped' | 'tp_hit' | 'liquidated';
  realizedPnl?: number;
  regime?: MarketRegime;
  strategyFlavor?: StrategyFlavor;
  openedAt?: number;
  closedAt?: number | null;
}

interface PerformanceRegimeOverviewProps {
  trades?: TradeRecord[];
}

const REGIME_COLORS: Record<MarketRegime, string> = {
  UPTREND: '#22c55e',
  DOWNTREND: '#ef4444',
  RANGING: '#eab308',
  CHOPPY: '#a855f7',
  LOW_VOL: '#6b7280',
};

const STRATEGY_LABELS: Record<StrategyFlavor, string> = {
  TREND_FOLLOWING: 'Trend Following',
  MEAN_REVERSION: 'Mean Reversion',
  SCALPING: 'Scalping',
  BREAKOUT: 'Breakout',
  NO_TRADE: 'No Trade',
};

export default function PerformanceRegimeOverview({
  trades: propTrades,
}: PerformanceRegimeOverviewProps) {
  const [trades, setTrades] = useState<TradeRecord[]>(propTrades || []);
  const [loading, setLoading] = useState(!propTrades);

  useEffect(() => {
    if (!propTrades) {
      fetch('/api/performance/trades')
        .then((res) => res.json())
        .then((result) => {
          if (result.success && Array.isArray(result.data)) {
            setTrades(result.data);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [propTrades]);

  const closedTrades = useMemo(
    () => trades.filter((t) => t.status !== 'open'),
    [trades]
  );

  const regimeStats = useMemo(() => {
    const base: Record<
      MarketRegime,
      { regime: MarketRegime; count: number; wins: number; losses: number }
    > = {
      UPTREND: { regime: 'UPTREND', count: 0, wins: 0, losses: 0 },
      DOWNTREND: { regime: 'DOWNTREND', count: 0, wins: 0, losses: 0 },
      RANGING: { regime: 'RANGING', count: 0, wins: 0, losses: 0 },
      CHOPPY: { regime: 'CHOPPY', count: 0, wins: 0, losses: 0 },
      LOW_VOL: { regime: 'LOW_VOL', count: 0, wins: 0, losses: 0 },
    };

    for (const t of closedTrades) {
      const regime = t.regime || 'RANGING';
      const bucket = base[regime];
      bucket.count += 1;

      if (typeof t.realizedPnl === 'number') {
        if (t.realizedPnl > 0) bucket.wins += 1;
        else if (t.realizedPnl < 0) bucket.losses += 1;
      }
    }

    return Object.values(base).filter((x) => x.count > 0);
  }, [closedTrades]);

  const strategyStats = useMemo(() => {
    const base: Record<
      StrategyFlavor,
      {
        strategy: StrategyFlavor;
        trades: number;
        wins: number;
        losses: number;
      }
    > = {
      TREND_FOLLOWING: {
        strategy: 'TREND_FOLLOWING',
        trades: 0,
        wins: 0,
        losses: 0,
      },
      MEAN_REVERSION: {
        strategy: 'MEAN_REVERSION',
        trades: 0,
        wins: 0,
        losses: 0,
      },
      SCALPING: { strategy: 'SCALPING', trades: 0, wins: 0, losses: 0 },
      BREAKOUT: { strategy: 'BREAKOUT', trades: 0, wins: 0, losses: 0 },
      NO_TRADE: { strategy: 'NO_TRADE', trades: 0, wins: 0, losses: 0 },
    };

    for (const t of closedTrades) {
      const strategy = t.strategyFlavor || 'NO_TRADE';
      const bucket = base[strategy];
      bucket.trades += 1;

      if (typeof t.realizedPnl === 'number') {
        if (t.realizedPnl > 0) bucket.wins += 1;
        else if (t.realizedPnl < 0) bucket.losses += 1;
      }
    }

    return Object.values(base)
      .map((s) => ({
        ...s,
        winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0,
      }))
      .filter((s) => s.trades > 0);
  }, [closedTrades]);

  const totalClosed = closedTrades.length;
  const choppyOrLowVolCount = closedTrades.filter((t) =>
    ['CHOPPY', 'LOW_VOL'].includes(t.regime || '')
  ).length;

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-gray-400">
        <div className="animate-pulse">Loading regime & strategy analysis...</div>
      </div>
    );
  }

  if (!totalClosed) {
    return (
      <div className="text-sm text-gray-500">
        No closed trades yet. Once you have some history, this panel will show
        how different market regimes and strategies perform.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">Closed Trades</div>
          <div className="text-xl font-semibold text-gray-900">
            {totalClosed}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">
            Trades in CHOPPY / LOW_VOL
          </div>
          <div className="text-xl font-semibold text-amber-600">
            {choppyOrLowVolCount}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Ideally this number should go down over time.
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">
            Best Regime (by win rate)
          </div>
          <div className="text-sm font-medium text-gray-900">
            {regimeStats.length
              ? regimeStats
                  .slice()
                  .sort(
                    (a, b) =>
                      (b.wins / Math.max(1, b.count)) -
                      (a.wins / Math.max(1, a.count))
                  )[0].regime
              : 'N/A'}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">
            Best Strategy (by win rate)
          </div>
          <div className="text-sm font-medium text-gray-900">
            {strategyStats.length
              ? STRATEGY_LABELS[
                  strategyStats
                    .slice()
                    .sort((a, b) => b.winRate - a.winRate)[0].strategy
                ]
              : 'N/A'}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Regime Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={regimeStats}
                  dataKey="count"
                  nameKey="regime"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {regimeStats.map((entry, index) => (
                    <Cell
                      key={entry.regime}
                      fill={REGIME_COLORS[entry.regime]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any, props: any) => {
                    const item = props.payload as any;
                    const winRate =
                      item.count > 0 ? (item.wins / item.count) * 100 : 0;
                    return [
                      `${value} trades · Win ${winRate.toFixed(1)}%`,
                      item.regime,
                    ];
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Strategy Win Rate
          </h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={strategyStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="strategy"
                  tickFormatter={(s: StrategyFlavor) => STRATEGY_LABELS[s]}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(value: any, name: any, props: any) => {
                    const item = props.payload as any;
                    return [
                      `${(value as number).toFixed(1)}% (wins ${item.wins}/${
                        item.trades
                      })`,
                      'Win Rate',
                    ];
                  }}
                />
                <Bar dataKey="winRate">
                  {strategyStats.map((s) => (
                    <Cell
                      key={s.strategy}
                      fill={
                        s.winRate >= 50
                          ? '#22c55e'
                          : s.winRate > 0
                          ? '#eab308'
                          : '#6b7280'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
