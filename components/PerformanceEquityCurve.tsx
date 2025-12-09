'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';
import { format } from 'date-fns';

interface EquityPoint {
  timestamp: number;
  equity: number;
  highWaterMark?: number;
  drawdown?: number;
}

interface EquitySummary {
  initialEquity: number;
  currentEquity: number;
  highWaterMark: number;
  totalReturn: number;
  maxDrawdown: number;
  dataPoints: number;
}

interface PerformanceEquityCurveProps {
  data?: EquityPoint[];
  summary?: EquitySummary;
}

export default function PerformanceEquityCurve({ data: propData, summary: propSummary }: PerformanceEquityCurveProps) {
  const [data, setData] = useState<EquityPoint[]>(propData || []);
  const [summary, setSummary] = useState<EquitySummary>(propSummary || {
    initialEquity: 0,
    currentEquity: 0,
    highWaterMark: 0,
    totalReturn: 0,
    maxDrawdown: 0,
    dataPoints: 0,
  });
  const [loading, setLoading] = useState(!propData);

  useEffect(() => {
    // 如果没有传入 props，则自己 fetch
    if (!propData) {
      fetch('/api/performance/equity-curve')
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            setData(result.data || []);
            setSummary(result.summary || summary);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [propData]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <div className="animate-pulse">Loading equity curve...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-gray-400">
        <svg className="mb-2 h-10 w-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
        <span className="text-sm">No equity data yet</span>
      </div>
    );
  }

  const chartData = data.map(point => ({
    ...point,
    time: format(new Date(point.timestamp), 'MM/dd'),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
        <XAxis
          dataKey="time"
          stroke="#9ca3af"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#9ca3af"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
          width={50}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
          labelStyle={{ color: '#374151', fontWeight: 500 }}
          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Equity']}
        />
        {summary.initialEquity > 0 && (
          <ReferenceLine
            y={summary.initialEquity}
            stroke="#9ca3af"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
          />
        )}
        <Area
          type="monotone"
          dataKey="equity"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#equityGradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#3b82f6' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
