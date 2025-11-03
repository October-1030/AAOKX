'use client';

import useSWR from 'swr';
import Leaderboard from '@/components/Leaderboard';
import EquityChart from '@/components/EquityChart';
import MarketOverview from '@/components/MarketOverview';
import ModelChat from '@/components/ModelChat';
import ThemeToggle from '@/components/ThemeToggle';
import { useTradingStore } from '@/store/useTradingStore';
import { fetcher } from '@/lib/fetcher';
import { useEffect } from 'react';

export default function Home() {
  // 使用 Zustand 状态
  const {
    performances,
    marketData,
    isRunning,
    isLoading,
    connectionStatus,
    setPerformances,
    setMarketData,
    setIsRunning,
    setIsLoading,
    setConnectionStatus,
  } = useTradingStore();

  // 使用 SWR 自动获取数据
  const { data, error } = useSWR('/api/trading', fetcher, {
    refreshInterval: 5000, // 每5秒刷新
    revalidateOnFocus: true, // 窗口获得焦点时重新验证
    dedupingInterval: 2000, // 2秒内的重复请求会被去重
  });

  // 当 SWR 数据更新时，同步到 Zustand
  useEffect(() => {
    if (data) {
      setPerformances(data.performances || []);
      setMarketData(data.marketData || []);
      setIsRunning(data.isRunning || false);
      setConnectionStatus('CONNECTED');
      setIsLoading(false);
    }
  }, [data, setPerformances, setMarketData, setIsRunning, setConnectionStatus, setIsLoading]);

  // 错误处理
  useEffect(() => {
    if (error) {
      console.error('Failed to fetch data:', error);
      setConnectionStatus('CONNECTION FAILED');
      setIsLoading(false);
    }
  }, [error, setConnectionStatus, setIsLoading]);

  // 启动交易引擎
  const startEngine = async () => {
    try {
      await fetch('/api/trading?action=start');
      setIsRunning(true);
    } catch (error) {
      console.error('Failed to start engine:', error);
    }
  };

  // 停止交易引擎
  const stopEngine = async () => {
    try {
      await fetch('/api/trading?action=stop');
      setIsRunning(false);
    } catch (error) {
      console.error('Failed to stop engine:', error);
    }
  };

  // 手动执行一次交易周期
  const executeCycle = async () => {
    try {
      const res = await fetch('/api/trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute_cycle' }),
      });
      const data = await res.json();

      if (data.success) {
        setPerformances(data.performances || []);
        setMarketData(data.marketData || []);
      }
    } catch (error) {
      console.error('Failed to execute cycle:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl font-bold gradient-text mb-4">
            ALPHA ARENA
          </div>
          <div className="text-xl text-gray-400 animate-pulse">
            {connectionStatus}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Header */}
      <header className="border-b border-gray-800 panel sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold gradient-text">
                ALPHA ARENA
              </h1>
              <p className="text-muted mt-1">
                AI Trading in Real Markets (Demo)
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* 主题切换 */}
              <ThemeToggle />
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    connectionStatus === 'CONNECTED'
                      ? 'bg-green-500 animate-pulse'
                      : 'bg-red-500'
                  }`}
                />
                <span className="text-sm text-gray-400">
                  {connectionStatus}
                </span>
              </div>

              {!isRunning ? (
                <button
                  onClick={startEngine}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                >
                  Start Trading
                </button>
              ) : (
                <button
                  onClick={stopEngine}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                >
                  Stop Trading
                </button>
              )}

              <button
                onClick={executeCycle}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
              >
                Execute Cycle
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Market Overview */}
          <MarketOverview marketData={marketData} />

          {/* Leaderboard */}
          <Leaderboard performances={performances} />

          {/* Equity Chart */}
          {performances.length > 0 && (
            <EquityChart performances={performances} />
          )}

          {/* Model Chat */}
          {performances.length > 0 && (
            <ModelChat performances={performances} />
          )}

          {/* Info Section */}
          <div className="bg-gray-900 rounded-lg p-6 shadow-xl border border-gray-800">
            <h2 className="text-xl font-bold text-white mb-4">
              📚 About This Demo
            </h2>
            <div className="text-gray-300 space-y-3 text-sm">
              <p>
                This is a fully functional clone of Alpha Arena's AI trading competition platform.
                It features:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  <strong>6 AI Models</strong>: DeepSeek V3.1, Claude 4.5 Sonnet, GPT-5, Gemini 2.5 Pro, Qwen 3 Max, Grok 4
                </li>
                <li>
                  <strong>Real Technical Indicators</strong>: EMA, MACD, RSI, ATR calculations on simulated market data
                </li>
                <li>
                  <strong>Three-Layer Prompt Architecture</strong>: USER_PROMPT (data input), CHAIN_OF_THOUGHT (analysis), TRADING_DECISIONS (output)
                </li>
                <li>
                  <strong>Live Trading Simulation</strong>: Each model executes trades with 10-20x leverage, stop losses, and take profits
                </li>
                <li>
                  <strong>Performance Tracking</strong>: Sharpe ratio, win rate, max drawdown, equity curves
                </li>
              </ul>
              <p className="text-yellow-400 font-semibold mt-4">
                ⚠️ Note: This demo uses simulated market data and AI responses. For real trading, you would need to integrate actual exchange APIs and LLM providers.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          <p>Alpha Arena Clone - Built with Next.js, TypeScript, and Tailwind CSS</p>
          <p className="mt-2">
            Inspired by{' '}
            <a
              href="https://nof1.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              nof1.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
