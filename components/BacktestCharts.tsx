'use client';

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface EquityCurveProps {
  data: Array<{ timestamp: number; balance: number }>;
  initialBalance: number;
}

export function EquityCurveChart({ data, initialBalance }: EquityCurveProps) {
  // 转换数据格式
  const chartData = data.map((point) => ({
    time: new Date(point.timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    balance: point.balance,
    pnl: point.balance - initialBalance,
    pnlPercent: ((point.balance - initialBalance) / initialBalance) * 100,
  }));

  return (
    <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
      <h3 className="text-xl font-semibold text-white mb-4">资金曲线 (Equity Curve)</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time"
            stroke="#9CA3AF"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F9FAFB',
            }}
            formatter={(value: any, name: string) => {
              if (name === 'balance') return [`$${value.toFixed(2)}`, '账户余额'];
              if (name === 'pnl') return [`$${value.toFixed(2)}`, '盈亏'];
              if (name === 'pnlPercent') return [`${value.toFixed(2)}%`, '收益率'];
              return [value, name];
            }}
          />
          <Legend
            wrapperStyle={{ color: '#F9FAFB' }}
            formatter={(value) => {
              if (value === 'balance') return '账户余额';
              if (value === 'pnl') return '盈亏';
              return value;
            }}
          />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="#8B5CF6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DailyReturnsProps {
  data: Array<{ date: string; return: number }>;
}

export function DailyReturnsChart({ data }: DailyReturnsProps) {
  const chartData = data.map((point) => ({
    date: point.date.split('-').slice(1).join('-'), // MM-DD格式
    return: point.return,
    positive: point.return >= 0,
  }));

  return (
    <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
      <h3 className="text-xl font-semibold text-white mb-4">每日收益 (Daily Returns)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            stroke="#9CA3AF"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value.toFixed(1)}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F9FAFB',
            }}
            formatter={(value: any) => [`${Number(value).toFixed(2)}%`, '收益率']}
          />
          <Bar
            dataKey="return"
            fill="#8B5CF6"
            radius={[4, 4, 0, 0]}
            shape={(props: any) => {
              const { x, y, width, height, return: returnValue } = props;
              const fill = returnValue >= 0 ? '#10B981' : '#EF4444';
              return (
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={fill}
                  rx={4}
                />
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface PnLDistributionProps {
  trades: Array<{ pnl: number; coin: string }>;
}

export function PnLDistributionChart({ trades }: PnLDistributionProps) {
  // 按PnL分组统计
  const bins = [-Infinity, -50, -20, -10, -5, 0, 5, 10, 20, 50, Infinity];
  const binLabels = ['<-$50', '-$50~-$20', '-$20~-$10', '-$10~-$5', '-$5~$0', '$0~$5', '$5~$10', '$10~$20', '$20~$50', '>$50'];

  const distribution = bins.slice(0, -1).map((min, i) => {
    const max = bins[i + 1];
    const count = trades.filter(t => t.pnl >= min && t.pnl < max).length;
    return {
      range: binLabels[i],
      count,
      isProfit: min >= 0,
    };
  });

  return (
    <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
      <h3 className="text-xl font-semibold text-white mb-4">盈亏分布 (P&L Distribution)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={distribution}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="range"
            stroke="#9CA3AF"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fontSize: 12 }}
            label={{ value: '交易次数', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF' } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F9FAFB',
            }}
            formatter={(value: any) => [`${value} 笔交易`, '数量']}
          />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            shape={(props: any) => {
              const { x, y, width, height, isProfit } = props;
              const fill = isProfit ? '#10B981' : '#EF4444';
              return (
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={fill}
                  rx={4}
                />
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DrawdownChartProps {
  equityCurve: Array<{ timestamp: number; balance: number }>;
}

export function DrawdownChart({ equityCurve }: DrawdownChartProps) {
  // 计算回撤
  let peak = equityCurve[0]?.balance || 0;
  const drawdownData = equityCurve.map((point) => {
    if (point.balance > peak) {
      peak = point.balance;
    }
    const drawdown = peak > 0 ? ((peak - point.balance) / peak) * 100 : 0;
    return {
      time: new Date(point.timestamp).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      drawdown: -drawdown, // 负值表示回撤
    };
  });

  return (
    <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
      <h3 className="text-xl font-semibold text-white mb-4">回撤曲线 (Drawdown)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={drawdownData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time"
            stroke="#9CA3AF"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value.toFixed(1)}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F9FAFB',
            }}
            formatter={(value: any) => [`${Number(value).toFixed(2)}%`, '回撤']}
          />
          <Line
            type="monotone"
            dataKey="drawdown"
            stroke="#EF4444"
            strokeWidth={2}
            dot={false}
            fill="#EF4444"
            fillOpacity={0.2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
