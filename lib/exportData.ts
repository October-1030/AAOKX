// 数据导出功能 - CSV/JSON格式

import { ModelPerformance, CompletedTrade } from '@/types/trading';

/**
 * 导出性能数据为CSV
 */
export function exportPerformancesToCSV(performances: ModelPerformance[]): string {
  const headers = [
    'Model',
    'Provider',
    'Strategy',
    'Initial Capital',
    'Current Equity',
    'Return %',
    'Total Trades',
    'Win Rate %',
    'Sharpe Ratio',
    'Max Drawdown %',
  ];

  const rows = performances.map(p => [
    p.displayName,
    p.strategy.split(' ').slice(0, 3).join(' '), // 简化策略描述
    p.initialCapital.toFixed(2),
    p.currentEquity.toFixed(2),
    p.returnPercent.toFixed(2),
    p.totalTrades.toString(),
    p.winRate.toFixed(2),
    p.sharpeRatio.toFixed(2),
    p.maxDrawdown.toFixed(2),
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  return csv;
}

/**
 * 导出交易记录为CSV
 */
export function exportTradesToCSV(trades: CompletedTrade[]): string {
  const headers = [
    'Date',
    'Model',
    'Coin',
    'Side',
    'Entry Price',
    'Exit Price',
    'Leverage',
    'Notional',
    'P&L',
    'P&L %',
    'Exit Reason',
  ];

  const rows = trades.map(t => [
    new Date(t.closedAt).toISOString(),
    t.modelName,
    t.coin,
    t.side,
    t.entryPrice.toFixed(2),
    t.exitPrice.toFixed(2),
    t.leverage.toString(),
    t.notional.toFixed(2),
    t.pnl.toFixed(2),
    t.pnlPercent.toFixed(2),
    `"${t.exitReason}"`, // 引号包裹避免逗号问题
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  return csv;
}

/**
 * 导出权益曲线为CSV
 */
export function exportEquityCurveToCSV(performances: ModelPerformance[]): string {
  // 找出所有时间戳
  const timestamps = new Set<number>();
  performances.forEach(p => {
    p.equityHistory.forEach(point => {
      timestamps.add(point.timestamp);
    });
  });

  const sortedTimestamps = Array.from(timestamps).sort((a, b) => a - b);

  // 构建CSV
  const headers = ['Timestamp', 'Date', ...performances.map(p => p.displayName)];

  const rows = sortedTimestamps.map(ts => {
    const row = [
      ts.toString(),
      new Date(ts).toISOString(),
    ];

    performances.forEach(p => {
      const point = p.equityHistory.find(h => h.timestamp === ts);
      row.push(point ? point.equity.toFixed(2) : '');
    });

    return row;
  });

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  return csv;
}

/**
 * 浏览器端：下载CSV文件
 */
export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 浏览器端：下载JSON文件
 */
export function downloadJSON(data: any, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 生成完整的数据导出包
 */
export function generateDataExportPackage(
  performances: ModelPerformance[],
  trades: CompletedTrade[]
) {
  return {
    performances: {
      csv: exportPerformancesToCSV(performances),
      json: performances,
    },
    trades: {
      csv: exportTradesToCSV(trades),
      json: trades,
    },
    equityCurve: {
      csv: exportEquityCurveToCSV(performances),
      json: performances.map(p => ({
        model: p.displayName,
        data: p.equityHistory,
      })),
    },
    metadata: {
      exportedAt: new Date().toISOString(),
      totalModels: performances.length,
      totalTrades: trades.length,
      dataSource: 'Alpha Arena Clone',
    },
  };
}
