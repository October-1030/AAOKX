'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PerformanceEquityCurve from '@/components/PerformanceEquityCurve';
import PerformancePnlSummary from '@/components/PerformancePnlSummary';
import PerformanceTradeList from '@/components/PerformanceTradeList';

// localStorage key for OKX API config
const OKX_API_CONFIG_KEY = 'okxApiConfig';

interface OkxApiConfig {
  okxApiKey: string;
  okxSecretKey: string;
  okxPassphrase: string;
  updatedAt: number;
}

// ApiSettingsModal 组件
function ApiSettingsModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [okxApiKey, setOkxApiKey] = useState('');
  const [okxSecretKey, setOkxSecretKey] = useState('');
  const [okxPassphrase, setOkxPassphrase] = useState('');

  // 当弹窗打开时，从 localStorage 读取已有配置
  useEffect(() => {
    if (open) {
      try {
        const raw = localStorage.getItem(OKX_API_CONFIG_KEY);
        if (raw) {
          const config: OkxApiConfig = JSON.parse(raw);
          setOkxApiKey(config.okxApiKey || '');
          setOkxSecretKey(config.okxSecretKey || '');
          setOkxPassphrase(config.okxPassphrase || '');
        } else {
          // 如果不存在，清空表单
          setOkxApiKey('');
          setOkxSecretKey('');
          setOkxPassphrase('');
        }
      } catch {
        // 解析失败，清空表单
        setOkxApiKey('');
        setOkxSecretKey('');
        setOkxPassphrase('');
      }
    }
  }, [open]);

  const handleSave = () => {
    const config: OkxApiConfig = {
      okxApiKey,
      okxSecretKey,
      okxPassphrase,
      updatedAt: Date.now(),
    };
    localStorage.setItem(OKX_API_CONFIG_KEY, JSON.stringify(config));
    console.log('OKX API config saved to localStorage');
    onSaved();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">API Settings</h2>
        <p className="text-xs text-gray-500 mb-4">
          这些密钥仅保存在本机浏览器的 localStorage 中，不会发送到服务器。但请仍然确保在安全环境中使用。
        </p>

        <div className="space-y-4">
          {/* OKX API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OKX API Key
            </label>
            <input
              type="text"
              value={okxApiKey}
              onChange={(e) => setOkxApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your OKX API Key"
            />
          </div>

          {/* OKX Secret Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OKX Secret Key
            </label>
            <input
              type="password"
              value={okxSecretKey}
              onChange={(e) => setOkxSecretKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your OKX Secret Key"
            />
          </div>

          {/* OKX Passphrase */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OKX Passphrase
            </label>
            <input
              type="password"
              value={okxPassphrase}
              onChange={(e) => setOkxPassphrase(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your OKX Passphrase"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// MetricCard 组件
function MetricCard({
  label,
  value,
  subValue,
  trend
}: {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${trendColor}`}>{value}</div>
      {subValue && <div className="text-xs text-gray-400 mt-1">{subValue}</div>}
    </div>
  );
}

type TimeRange = '7D' | '30D' | '90D' | 'ALL';

export default function HomePage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');
  const [summary, setSummary] = useState({
    currentEquity: 0,
    totalReturn: 0,
    maxDrawdown: 0,
    winRate: 0,
    totalTrades: 0,
    totalPnl: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [hasApiConfig, setHasApiConfig] = useState(false);

  // 检查 localStorage 中是否存在 API 配置
  useEffect(() => {
    try {
      const raw = localStorage.getItem(OKX_API_CONFIG_KEY);
      setHasApiConfig(!!raw);
    } catch {
      setHasApiConfig(false);
    }
  }, []);

  useEffect(() => {
    // Fetch summary data for KPI cards
    fetch('/api/performance')
      .then(res => res.json())
      .then(result => {
        if (result.success && result.summary) {
          setSummary({
            currentEquity: result.summary.currentEquity || 0,
            totalReturn: result.summary.totalReturn || 0,
            maxDrawdown: result.summary.maxDrawdown || 0,
            winRate: result.summary.winRate || 0,
            totalTrades: result.summary.totalTrades || 0,
            totalPnl: result.summary.totalPnl || 0,
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [timeRange]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">Performance</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(['7D', '30D', '90D', 'ALL'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    timeRange === range
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            {/* Settings Button */}
            <button
              onClick={() => setShowApiSettings(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Settings</span>
              {/* 配置状态指示点 */}
              {hasApiConfig && (
                <span className="w-2 h-2 bg-green-500 rounded-full" title="API Configured" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* KPI Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <MetricCard
            label="Total Equity"
            value={`$${summary.currentEquity.toLocaleString()}`}
            trend="neutral"
          />
          <MetricCard
            label="Total Return"
            value={`${summary.totalReturn >= 0 ? '+' : ''}${summary.totalReturn.toFixed(2)}%`}
            trend={summary.totalReturn >= 0 ? 'up' : 'down'}
          />
          <MetricCard
            label="Max Drawdown"
            value={`-${summary.maxDrawdown.toFixed(2)}%`}
            trend="down"
          />
          <MetricCard
            label="Win Rate"
            value={`${summary.winRate.toFixed(1)}%`}
            trend={summary.winRate >= 50 ? 'up' : 'down'}
          />
          <MetricCard
            label="Total Trades"
            value={summary.totalTrades.toString()}
            trend="neutral"
          />
          <MetricCard
            label="Total PnL"
            value={`${summary.totalPnl >= 0 ? '+' : ''}$${summary.totalPnl.toFixed(2)}`}
            trend={summary.totalPnl >= 0 ? 'up' : 'down'}
          />
        </div>

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Equity Curve */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Equity Curve</h2>
            <div className="h-64">
              <PerformanceEquityCurve />
            </div>
          </div>

          {/* Daily PnL */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Daily PnL</h2>
            <div className="h-64">
              <PerformancePnlSummary />
            </div>
          </div>
        </div>

        {/* Trade History */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Trade History</h2>
          <PerformanceTradeList />
        </div>
      </main>

      {/* API Settings Modal */}
      <ApiSettingsModal
        open={showApiSettings}
        onClose={() => setShowApiSettings(false)}
        onSaved={() => setHasApiConfig(true)}
      />
    </div>
  );
}
