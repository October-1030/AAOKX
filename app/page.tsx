'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { useEffect, useState } from 'react';

export default function TradingBot() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // 获取交易数据
  const { data, error } = useSWR('/api/trading', fetcher, {
    refreshInterval: 5000, // 每5秒刷新
  });

  useEffect(() => {
    if (data) {
      setIsRunning(data.isRunning || false);
    }
  }, [data]);

  // 获取真实Hyperliquid账户数据
  const { data: hlAccount } = useSWR('/api/hyperliquid-account', fetcher, {
    refreshInterval: 10000, // 每10秒刷新
  });

  const performance = data?.performances?.[0]; // 只有1个DeepSeek模型
  const marketData = data?.marketData || [];

  // ✅ 优先使用真实Hyperliquid账户数据
  const accountValue = hlAccount?.accountValue || 0;
  const withdrawable = hlAccount?.withdrawable || 0;
  const realPositions = hlAccount?.assetPositions || [];
  const marginUsed = hlAccount?.marginUsed || 0;

  // 计算真实回报率（基于起始$1000）
  const REAL_INITIAL_CAPITAL = 1000;
  const realReturn = accountValue > 0
    ? ((accountValue - REAL_INITIAL_CAPITAL) / REAL_INITIAL_CAPITAL) * 100
    : (performance?.returnPercent || 0);

  // 启动/停止/执行
  const startEngine = async () => {
    try {
      await fetch('/api/trading?action=start');
      setIsRunning(true);
    } catch (error) {
      console.error('Failed to start:', error);
    }
  };

  const stopEngine = async () => {
    try {
      await fetch('/api/trading?action=stop');
      setIsRunning(false);
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  };

  const executeCycle = async () => {
    setIsExecuting(true);
    try {
      await fetch('/api/trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute_cycle' }),
      });
    } catch (error) {
      console.error('Failed to execute:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-xl text-gray-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-blue-400">
                DeepSeek Trading Bot
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Hyperliquid Testnet - Autonomous AI Trading
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-sm ${
                error ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'
              }`}>
                {error ? '⚠️ Disconnected' : '✅ Connected'}
              </div>

              {!isRunning ? (
                <button
                  onClick={startEngine}
                  className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold"
                >
                  ▶️ Start Auto Trading
                </button>
              ) : (
                <button
                  onClick={stopEngine}
                  className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold"
                >
                  ⏸️ Stop Trading
                </button>
              )}

              <button
                onClick={executeCycle}
                disabled={isExecuting}
                className={`${
                  isExecuting
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                } px-6 py-2 rounded-lg font-semibold`}
              >
                {isExecuting ? '⏳ Executing...' : '🔄 Execute Once'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Account Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Account Value (Real)</div>
            <div className="text-3xl font-bold text-white">
              ${accountValue.toFixed(2)}
            </div>
            <div className={`text-sm mt-2 ${
              realReturn >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {realReturn >= 0 ? '📈' : '📉'} {realReturn.toFixed(2)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Initial: ${REAL_INITIAL_CAPITAL}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Available Cash</div>
            <div className="text-3xl font-bold text-white">
              ${withdrawable.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500 mt-2">Withdrawable</div>
            <div className="text-xs text-gray-500 mt-1">
              Margin: ${marginUsed.toFixed(2)}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Open Positions</div>
            <div className="text-3xl font-bold text-white">
              {realPositions.length}
            </div>
            <div className="text-sm text-gray-500 mt-2">Active Trades</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Total Trades</div>
            <div className="text-3xl font-bold text-white">
              {performance?.totalTrades || 0}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Win Rate: {performance?.winRate?.toFixed(0) || 0}%
            </div>
          </div>
        </div>

        {/* Current Positions */}
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-bold">Current Positions</h2>
          </div>
          <div className="p-6">
            {realPositions.length > 0 ? (
              <div className="space-y-3">
                {realPositions.map((asset: any, index: number) => {
                  const pos = asset.position;
                  const isLong = parseFloat(pos.szi) > 0;
                  return (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        isLong
                          ? 'bg-green-900/20 border-green-700'
                          : 'bg-red-900/20 border-red-700'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-lg font-bold">
                            {pos.coin} {isLong ? '🟢 LONG' : '🔴 SHORT'} {pos.leverage.value}x
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            Size: {Math.abs(parseFloat(pos.szi)).toFixed(4)} | Entry: ${parseFloat(pos.entryPx).toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xl font-bold ${
                            parseFloat(pos.unrealizedPnl) >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {parseFloat(pos.unrealizedPnl) >= 0 ? '+' : ''}${parseFloat(pos.unrealizedPnl).toFixed(2)}
                          </div>
                          <div className={`text-sm ${
                            pos.returnOnEquity >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            ROE: {(pos.returnOnEquity * 100).toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      {pos.cumFunding && (
                        <div className="text-xs text-gray-500 mt-2">
                          Funding: ${pos.cumFunding.sinceOpen?.toFixed(2) || '0.00'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <div className="text-2xl mb-2">💼</div>
                <div>No open positions</div>
                <div className="text-xs mt-2">
                  {hlAccount ? 'Hyperliquid account has no active trades' : 'Loading account data...'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Market Data */}
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-bold">Market Prices</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {marketData.map((market: any) => (
                <div key={market.coin} className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400">{market.coin}</div>
                  <div className="text-xl font-bold mt-1">
                    ${market.current.price.toLocaleString()}
                  </div>
                  <div className={`text-sm mt-1 ${
                    market.current.rsi_14 < 30 ? 'text-green-400' :
                    market.current.rsi_14 > 70 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    RSI: {market.current.rsi_14.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status Info */}
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">ℹ️</div>
            <div className="flex-1">
              <div className="font-bold text-blue-300 mb-1">Trading Status</div>
              <div className="text-sm text-gray-300">
                {isRunning ? (
                  <>🟢 Auto-trading is <span className="text-green-400 font-bold">ACTIVE</span> - AI will execute trades every 3 minutes</>
                ) : (
                  <>⚪ Auto-trading is <span className="text-gray-400 font-bold">PAUSED</span> - Click "Execute Once" for manual trading</>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Model: DeepSeek V3.1 | Exchange: Hyperliquid Testnet | Strategy: Conservative Value Investing
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
