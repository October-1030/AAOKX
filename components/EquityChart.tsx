'use client';

import { ModelPerformance } from '@/types/trading';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { getModelColor } from '@/lib/modelMeta';

interface EquityChartProps {
  performances: ModelPerformance[];
}

export default function EquityChart({ performances }: EquityChartProps) {
  // 过滤有效数据
  const validPerformances = performances.filter(
    perf => perf && perf.equityHistory && perf.equityHistory.length > 0
  );

  if (validPerformances.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-white">📈 EQUITY CURVES</h2>
        <div className="text-center text-gray-400 py-8">
          No equity data available yet...
        </div>
      </div>
    );
  }

  // 合并所有模型的权益历史数据
  const allTimestamps = new Set<number>();
  validPerformances.forEach(perf => {
    (perf.equityHistory || []).forEach(point => {
      if (point && typeof point.timestamp === 'number') {
        allTimestamps.add(point.timestamp);
      }
    });
  });

  const timestamps = Array.from(allTimestamps).sort((a, b) => a - b);

  const chartData = timestamps.map(timestamp => {
    const dataPoint: any = {
      timestamp,
      time: format(new Date(timestamp), 'HH:mm'),
    };

    validPerformances.forEach(perf => {
      const point = (perf.equityHistory || []).find(p => p.timestamp === timestamp);
      dataPoint[perf.displayName] = point ? (point.equity ?? 0) : null;
    });

    return dataPoint;
  });

  return (
    <div className="bg-gray-900 rounded-lg p-6 shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-white">📈 EQUITY CURVES</h2>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time"
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
          />
          <YAxis
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#f3f4f6' }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
          />
          <Legend wrapperStyle={{ color: '#f3f4f6' }} />

          {validPerformances.map((perf) => (
            <Line
              key={perf.modelName}
              type="monotone"
              dataKey={perf.displayName}
              stroke={getModelColor(perf.modelName)}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 flex flex-wrap gap-4 justify-center">
        {validPerformances.map((perf) => (
          <div key={perf.modelName} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: getModelColor(perf.modelName) }}
            />
            <span className="text-sm text-gray-300">{perf.displayName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
