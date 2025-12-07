'use client';

import { useState } from 'react';
import { Coin } from '@/types/trading';
import { EquityCurveChart, DailyReturnsChart, PnLDistributionChart, DrawdownChart } from '@/components/BacktestCharts';

// 所有支持的币种
const ALL_COINS: Coin[] = [
  'BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP', 'AVAX', 'ATOM', 'DOT', 'ADA',
  'NEAR', 'FIL', 'TIA', 'TON', 'SUI', 'APT', 'SEI', 'INJ', 'UNI', 'LINK',
  'AAVE', 'CRV', 'LDO', 'PENDLE', 'ENS', 'SUSHI', 'OP', 'ARB', 'MATIC', 'LTC',
  'BCH', 'ETC', 'kPEPE', 'kSHIB', 'WIF', 'POPCAT', 'BOME', 'GOAT', 'PNUT',
  'PENGU', 'kBONK', 'AIXBT', 'VIRTUAL', 'ZEREBRO', 'TAO', 'RENDER', 'FET',
  'TRUMP', 'HYPE', 'MOVE', 'ME', 'USUAL', 'MORPHO', 'IMX', 'GALA', 'SAND',
  'GMT', 'YGG', 'BIGTIME', 'JUP', 'PYTH', 'ONDO', 'ENA', 'JTO', 'W', 'STRK',
  'ETHFI', 'BLAST',
];

interface BacktestConfig {
  dataSource: 'okx' | 'binance' | 'csv';
  coins: Coin[];
  startDate: string;
  endDate: string;
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  initialBalance: number;
  maxLeverage: number;
  tradingInterval: number; // 秒
  csvData?: string;
}

export default function BacktestPage() {
  const [config, setConfig] = useState<BacktestConfig>({
    dataSource: 'okx',
    coins: ['BTC', 'ETH', 'SOL'],
    startDate: '',
    endDate: '',
    interval: '15m',
    initialBalance: 1000,
    maxLeverage: 5,
    tradingInterval: 180, // 3分钟
  });

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  // 更新配置
  const updateConfig = (field: keyof BacktestConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  // 处理币种选择
  const toggleCoin = (coin: Coin) => {
    setConfig(prev => ({
      ...prev,
      coins: prev.coins.includes(coin)
        ? prev.coins.filter(c => c !== coin)
        : [...prev.coins, coin],
    }));
  };

  // 处理CSV文件上传
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const csvData = event.target?.result as string;
        updateConfig('csvData', csvData);
      };
      reader.readAsText(file);
    }
  };

  // 运行回测
  const runBacktest = async () => {
    // 验证输入
    if (!config.startDate || !config.endDate) {
      setError('请选择起始时间和结束时间');
      return;
    }

    if (config.coins.length === 0) {
      setError('请至少选择一个币种');
      return;
    }

    if (config.dataSource === 'csv' && !config.csvData) {
      setError('请上传CSV文件');
      return;
    }

    setIsRunning(true);
    setError('');
    setResult(null);
    setProgress('正在启动回测...');

    try {
      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '回测失败');
      }

      setResult(data.result);
      setProgress('回测完成！');
    } catch (err: any) {
      setError(err.message || '回测失败');
      setProgress('');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* 标题 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">策略回测系统</h1>
          <p className="text-gray-400">使用历史数据测试交易策略表现</p>
        </div>

        {/* 配置表单 */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 mb-6 border border-gray-700">
          <h2 className="text-2xl font-semibold text-white mb-6">回测配置</h2>

          {/* 数据源选择 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              数据源
            </label>
            <div className="flex gap-4">
              {(['okx', 'binance', 'csv'] as const).map((source) => (
                <button
                  key={source}
                  onClick={() => updateConfig('dataSource', source)}
                  className={`px-6 py-3 rounded-lg font-medium transition-all ${
                    config.dataSource === source
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {source === 'okx' ? 'OKX' : source === 'binance' ? 'Binance' : 'CSV文件'}
                </button>
              ))}
            </div>
          </div>

          {/* CSV上传 */}
          {config.dataSource === 'csv' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                上传CSV文件 (格式: timestamp,open,high,low,close,volume)
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
              />
              {csvFile && (
                <p className="mt-2 text-sm text-green-400">已选择: {csvFile.name}</p>
              )}
            </div>
          )}

          {/* 时间范围 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                起始时间
              </label>
              <input
                type="datetime-local"
                value={config.startDate}
                onChange={(e) => updateConfig('startDate', e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                结束时间
              </label>
              <input
                type="datetime-local"
                value={config.endDate}
                onChange={(e) => updateConfig('endDate', e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* K线周期 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              K线周期
            </label>
            <div className="flex gap-2">
              {(['1m', '5m', '15m', '1h', '4h', '1d'] as const).map((interval) => (
                <button
                  key={interval}
                  onClick={() => updateConfig('interval', interval)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    config.interval === interval
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {interval}
                </button>
              ))}
            </div>
          </div>

          {/* 币种选择 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              选择币种 ({config.coins.length} 个已选)
            </label>
            <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto p-4 bg-gray-900/50 rounded-lg">
              {ALL_COINS.map((coin) => (
                <button
                  key={coin}
                  onClick={() => toggleCoin(coin)}
                  className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                    config.coins.includes(coin)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {coin}
                </button>
              ))}
            </div>
          </div>

          {/* 交易参数 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                初始资金 ($)
              </label>
              <input
                type="number"
                value={config.initialBalance}
                onChange={(e) => updateConfig('initialBalance', parseFloat(e.target.value))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                最大杠杆
              </label>
              <input
                type="number"
                value={config.maxLeverage}
                onChange={(e) => updateConfig('maxLeverage', parseFloat(e.target.value))}
                min="1"
                max="20"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                交易周期 (秒)
              </label>
              <input
                type="number"
                value={config.tradingInterval}
                onChange={(e) => updateConfig('tradingInterval', parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 运行按钮 */}
          <button
            onClick={runBacktest}
            disabled={isRunning}
            className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
              isRunning
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/50'
            }`}
          >
            {isRunning ? '回测运行中...' : '开始回测'}
          </button>

          {/* 进度提示 */}
          {progress && (
            <div className="mt-4 p-4 bg-blue-900/30 border border-blue-500 rounded-lg">
              <p className="text-blue-300">{progress}</p>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-500 rounded-lg">
              <p className="text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* 结果展示 */}
        {result && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-semibold text-white mb-6">回测结果</h2>

            {/* 核心指标 */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 p-4 rounded-lg border border-green-700">
                <div className="text-sm text-gray-400 mb-1">总收益</div>
                <div className={`text-2xl font-bold ${result.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${result.totalPnL.toFixed(2)}
                </div>
                <div className={`text-sm ${result.totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {result.totalPnLPercent.toFixed(2)}%
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 p-4 rounded-lg border border-blue-700">
                <div className="text-sm text-gray-400 mb-1">胜率</div>
                <div className="text-2xl font-bold text-blue-400">
                  {result.winRate.toFixed(2)}%
                </div>
                <div className="text-sm text-gray-400">
                  {result.winningTrades}胜 / {result.losingTrades}负
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 p-4 rounded-lg border border-purple-700">
                <div className="text-sm text-gray-400 mb-1">最大回撤</div>
                <div className="text-2xl font-bold text-purple-400">
                  {result.maxDrawdownPercent.toFixed(2)}%
                </div>
                <div className="text-sm text-gray-400">
                  ${result.maxDrawdown.toFixed(2)}
                </div>
              </div>

              <div className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 p-4 rounded-lg border border-yellow-700">
                <div className="text-sm text-gray-400 mb-1">夏普比率</div>
                <div className="text-2xl font-bold text-yellow-400">
                  {result.sharpeRatio.toFixed(2)}
                </div>
                <div className="text-sm text-gray-400">
                  风险调整收益
                </div>
              </div>
            </div>

            {/* 详细统计 */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">总交易次数</div>
                <div className="text-xl font-bold text-white">{result.totalTrades}</div>
              </div>
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">盈利因子</div>
                <div className="text-xl font-bold text-white">
                  {result.profitFactor === Infinity ? '∞' : result.profitFactor.toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">平均持仓时间</div>
                <div className="text-xl font-bold text-white">
                  {(result.avgHoldingTime / 60).toFixed(1)} 分钟
                </div>
              </div>
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">平均盈利</div>
                <div className="text-xl font-bold text-green-400">
                  ${result.averageWin.toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">平均亏损</div>
                <div className="text-xl font-bold text-red-400">
                  ${result.averageLoss.toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">执行时间</div>
                <div className="text-xl font-bold text-white">
                  {(result.executionTimeMs / 1000).toFixed(2)}秒
                </div>
              </div>
            </div>

            {/* 连胜/连亏 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-900/20 p-4 rounded-lg border border-green-700">
                <div className="text-sm text-gray-400 mb-1">最大连胜</div>
                <div className="text-xl font-bold text-green-400">
                  {result.maxConsecutiveWins} 次
                </div>
              </div>
              <div className="bg-red-900/20 p-4 rounded-lg border border-red-700">
                <div className="text-sm text-gray-400 mb-1">最大连亏</div>
                <div className="text-xl font-bold text-red-400">
                  {result.maxConsecutiveLosses} 次
                </div>
              </div>
            </div>

            {/* 可视化图表 */}
            <div className="grid grid-cols-1 gap-6 mb-6">
              <EquityCurveChart data={result.equityCurve} initialBalance={result.initialBalance} />
              <div className="grid grid-cols-2 gap-6">
                <DailyReturnsChart data={result.dailyReturns} />
                <DrawdownChart equityCurve={result.equityCurve} />
              </div>
              <PnLDistributionChart trades={result.trades} />
            </div>

            {/* 交易记录 */}
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                交易记录 ({result.trades.length} 笔)
              </h3>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900/80 sticky top-0">
                    <tr className="text-gray-400 text-left">
                      <th className="p-3">ID</th>
                      <th className="p-3">币种</th>
                      <th className="p-3">方向</th>
                      <th className="p-3">开仓价</th>
                      <th className="p-3">平仓价</th>
                      <th className="p-3">仓位</th>
                      <th className="p-3">杠杆</th>
                      <th className="p-3">盈亏</th>
                      <th className="p-3">盈亏%</th>
                      <th className="p-3">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((trade: any) => (
                      <tr key={trade.id} className="border-b border-gray-700 hover:bg-gray-900/30">
                        <td className="p-3 text-gray-400">{trade.id}</td>
                        <td className="p-3 text-white font-medium">{trade.coin}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            trade.side === 'LONG' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                          }`}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="p-3 text-gray-300">${trade.entryPrice.toFixed(2)}</td>
                        <td className="p-3 text-gray-300">
                          {trade.exitPrice ? `$${trade.exitPrice.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-3 text-gray-300">${trade.size.toFixed(2)}</td>
                        <td className="p-3 text-gray-300">{trade.leverage}x</td>
                        <td className={`p-3 font-medium ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${trade.pnl.toFixed(2)}
                        </td>
                        <td className={`p-3 font-medium ${trade.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {trade.pnlPercent.toFixed(2)}%
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            trade.status === 'open' ? 'bg-blue-900/50 text-blue-400' : 'bg-gray-700 text-gray-400'
                          }`}>
                            {trade.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
