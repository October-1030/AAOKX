'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { useState, useRef, useEffect } from 'react';

// 交易执行历史记录
interface ExecutionLog {
  timestamp: number;
  status: 'success' | 'error';
  message: string;
  decisions?: number;
}

// localStorage keys for auto trading state persistence
const AUTO_TRADING_STATE_KEY = 'autoTradingState';

interface AutoTradingState {
  isRunning: boolean;
  nextExecutionTime: number;
  startedAt: number;
}

export default function TradingBot() {
  const [testingConnection, setTestingConnection] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [nextExecutionTime, setNextExecutionTime] = useState<number>(0);

  // 定时器引用
  const tradingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasRestoredState = useRef(false);

  // 保存自动交易状态到 localStorage
  const saveAutoTradingState = (running: boolean, nextTime: number) => {
    try {
      const state: AutoTradingState = {
        isRunning: running,
        nextExecutionTime: nextTime,
        startedAt: Date.now(),
      };
      localStorage.setItem(AUTO_TRADING_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('[Frontend] Failed to save auto trading state:', e);
    }
  };

  // 清除自动交易状态
  const clearAutoTradingState = () => {
    try {
      localStorage.removeItem(AUTO_TRADING_STATE_KEY);
    } catch (e) {
      console.error('[Frontend] Failed to clear auto trading state:', e);
    }
  };

  // 组件卸载时清理定时器（但不清除 localStorage 状态）
  useEffect(() => {
    return () => {
      if (tradingIntervalRef.current) {
        clearInterval(tradingIntervalRef.current);
        tradingIntervalRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, []);

  // 倒计时更新
  useEffect(() => {
    if (isRunning && nextExecutionTime > 0) {
      countdownIntervalRef.current = setInterval(() => {
        const remaining = Math.max(0, nextExecutionTime - Date.now());
        setCountdown(remaining);

        if (remaining <= 0) {
          setNextExecutionTime(Date.now() + 3 * 60 * 1000);
        }
      }, 1000);

      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
      };
    }
  }, [isRunning, nextExecutionTime]);

  // 获取OKX账户数据
  const { data: okxAccount, error, mutate } = useSWR('/api/okx-account', fetcher, {
    refreshInterval: 10000, // 每10秒刷新
  });

  // 解析OKX账户数据
  const accountInfo = okxAccount?.account;
  const fundingAccount = okxAccount?.fundingAccount || [];
  const positions = okxAccount?.positions || [];
  const marketPrices = okxAccount?.marketPrices || {};
  const config = okxAccount?.config || {};

  // 币种符号映射（OKX返回的币种符号 -> 市场价格键名）
  const getCoinPrice = (ccy: string): number => {
    // 常见币种映射
    const priceMap: Record<string, string> = {
      'BTC': 'BTC',
      'ETH': 'ETH',
      'SOL': 'SOL',
      'BNB': 'BNB',
      'DOGE': 'DOGE',
      'AVAX': 'AVAX',
      'ETHW': 'ETH', // ETHW使用ETH价格估算（实际价格会低很多，但数量太小可以忽略）
    };

    const priceKey = priceMap[ccy];
    return priceKey && marketPrices[priceKey] ? marketPrices[priceKey] : 0;
  };

  // 计算资金账户总余额（USD）
  const fundingTotal = fundingAccount.reduce((total: number, asset: any) => {
    const balance = parseFloat(asset.bal || '0');
    const price = getCoinPrice(asset.ccy);
    const usdValue = balance * price;

    console.log(`[Frontend] ${asset.ccy}: ${balance} × $${price} = $${usdValue.toFixed(2)}`);

    return total + usdValue;
  }, 0);

  // 获取交易账户余额信息
  const tradingEquity = accountInfo?.totalEq ? parseFloat(accountInfo.totalEq) : 0;
  const availableBalance = accountInfo?.availBal ? parseFloat(accountInfo.availBal) : 0;
  const marginUsed = accountInfo?.mgnRatio ? parseFloat(accountInfo.mgnRatio) : 0;

  // 总权益 = 交易账户 + 资金账户
  const totalEquity = tradingEquity + fundingTotal;

  // 计算回报率（使用实际初始资金）
  const INITIAL_CAPITAL = 232.5; // 你的实际初始资金
  const returnPercent = totalEquity > 0
    ? ((totalEquity - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100
    : 0;

  // 静默执行一次交易（用于定时器）
  const executeOnceSilent = async () => {
    const timestamp = Date.now();
    console.log('[Frontend] ⏰ 定时器触发 - 执行交易周期...');

    try {
      const response = await fetch('/api/trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute_cycle' }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('[Frontend] ✅ AI分析完成:', result);

        // 添加执行日志
        setExecutionLogs(prev => [
          {
            timestamp,
            status: 'success',
            message: result.message || 'AI分析完成',
            decisions: result.data?.decisions?.length || 0,
          },
          ...prev.slice(0, 9) // 只保留最近10条
        ]);

        mutate(); // 刷新账户数据
      } else {
        console.error('[Frontend] ❌ AI分析失败:', result.error || result.message);

        // 添加错误日志
        setExecutionLogs(prev => [
          {
            timestamp,
            status: 'error',
            message: result.error || result.message || 'AI分析失败',
          },
          ...prev.slice(0, 9)
        ]);
      }
    } catch (error) {
      console.error('[Frontend] ❌ 执行失败:', error);

      // 添加错误日志
      setExecutionLogs(prev => [
        {
          timestamp,
          status: 'error',
          message: (error as Error).message || '执行失败',
        },
        ...prev.slice(0, 9)
      ]);
    }
  };

  // 页面加载时恢复自动交易状态
  useEffect(() => {
    if (hasRestoredState.current) return;
    hasRestoredState.current = true;

    try {
      const raw = localStorage.getItem(AUTO_TRADING_STATE_KEY);
      if (raw) {
        const state: AutoTradingState = JSON.parse(raw);

        // 检查状态是否有效（24小时内启动的）
        const isRecent = Date.now() - state.startedAt < 24 * 60 * 60 * 1000;

        if (state.isRunning && isRecent) {
          console.log('[Frontend] 🔄 恢复自动交易状态...');

          // 计算下次执行时间
          let nextTime = state.nextExecutionTime;

          // 如果下次执行时间已过，立即执行并设置新的时间
          if (nextTime <= Date.now()) {
            console.log('[Frontend] ⏰ 上次执行时间已过，立即执行...');
            executeOnceSilent();
            nextTime = Date.now() + 3 * 60 * 1000;
          }

          setNextExecutionTime(nextTime);
          setIsRunning(true);

          // 重新设置定时器
          tradingIntervalRef.current = setInterval(() => {
            executeOnceSilent();
            const newNextTime = Date.now() + 3 * 60 * 1000;
            setNextExecutionTime(newNextTime);
            saveAutoTradingState(true, newNextTime);
          }, 3 * 60 * 1000);

          console.log('[Frontend] ✅ 自动交易状态已恢复');
        } else if (!isRecent) {
          // 状态太旧，清除它
          console.log('[Frontend] 🗑️ 清除过期的自动交易状态');
          clearAutoTradingState();
        }
      }
    } catch (e) {
      console.error('[Frontend] Failed to restore auto trading state:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 测试OKX连接
  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await fetch('/api/okx-test');
      const result = await response.json();

      if (result.success) {
        alert('✅ OKX连接测试成功！\n\n查看控制台获取详细信息');
        console.log('OKX测试结果:', result);
      } else {
        alert('❌ OKX连接测试失败\n\n' + (result.error || result.message));
      }
    } catch (error) {
      console.error('测试失败:', error);
      alert('❌ 测试失败: ' + (error as Error).message);
    } finally {
      setTestingConnection(false);
    }
  };

  // 资金划转到交易账户
  const transferToTrading = async () => {
    if (fundingTotal <= 0) {
      alert('⚠️ 资金账户余额为0，无需划转');
      return;
    }

    const confirmed = confirm(
      `💸 确认划转操作？\n\n` +
      `将把资金账户的所有资产划转到交易账户：\n` +
      `总价值：$${fundingTotal.toFixed(2)}\n` +
      `包含 ${fundingAccount.length} 种资产\n\n` +
      `点击"确定"开始划转`
    );

    if (!confirmed) return;

    setTransferring(true);
    try {
      const response = await fetch('/api/okx-transfer', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ 资金划转成功！\n\n${result.message}\n\n详情请查看控制台`);
        console.log('划转结果:', result);

        // 刷新账户数据
        mutate();
      } else {
        alert('❌ 资金划转失败\n\n' + (result.error || result.details));
        console.error('划转失败:', result);
      }
    } catch (error) {
      console.error('划转失败:', error);
      alert('❌ 划转失败: ' + (error as Error).message);
    } finally {
      setTransferring(false);
    }
  };

  // 启动自动交易
  const startTrading = async () => {
    if (tradingEquity <= 0) {
      alert('⚠️ 交易账户余额为0，请先划转资金');
      return;
    }

    const confirmed = confirm(
      `🤖 启动自动交易？\n\n` +
      `AI将每3分钟自动分析市场并执行交易\n` +
      `交易账户余额：$${tradingEquity.toFixed(2)}\n\n` +
      `确定启动吗？`
    );

    if (!confirmed) return;

    // 清除旧的定时器（如果有）
    if (tradingIntervalRef.current) {
      clearInterval(tradingIntervalRef.current);
    }

    // 立即执行一次
    console.log('[Frontend] 🚀 启动自动交易，立即执行第一次分析...');
    await executeOnceSilent();

    // 设置下次执行时间为3分钟后
    const nextTime = Date.now() + 3 * 60 * 1000;
    setNextExecutionTime(nextTime);

    // 保存状态到 localStorage
    saveAutoTradingState(true, nextTime);

    // 设置定时器（每3分钟执行一次）
    tradingIntervalRef.current = setInterval(() => {
      executeOnceSilent();
      const newNextTime = Date.now() + 3 * 60 * 1000;
      setNextExecutionTime(newNextTime);
      saveAutoTradingState(true, newNextTime); // 每次执行后更新状态
    }, 3 * 60 * 1000); // 3分钟

    setIsRunning(true);
    alert('✅ 自动交易已启动！\n\nAI将每3分钟执行一次交易分析\n刷新页面后会自动恢复运行状态');
    console.log('[Frontend] ✅ 自动交易已启动，定时器ID:', tradingIntervalRef.current);
  };

  // 停止自动交易
  const stopTrading = () => {
    if (tradingIntervalRef.current) {
      clearInterval(tradingIntervalRef.current);
      tradingIntervalRef.current = null;
      console.log('[Frontend] ⏸️ 自动交易已停止，定时器已清除');
    }

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // 清除 localStorage 状态
    clearAutoTradingState();

    setIsRunning(false);
    setCountdown(0);
    setNextExecutionTime(0);
    alert('⏸️ 自动交易已停止');
  };

  // 执行一次交易
  const executeOnce = async () => {
    if (tradingEquity <= 0) {
      alert('⚠️ 交易账户余额为0，请先划转资金');
      return;
    }

    setIsExecuting(true);
    try {
      const response = await fetch('/api/trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute_cycle' }),
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ 交易执行完成！\n\n查看控制台获取详细信息');
        console.log('交易结果:', result);
        mutate(); // 刷新账户数据
      } else {
        alert('❌ 交易执行失败\n\n' + (result.error || result.message));
      }
    } catch (error) {
      console.error('执行失败:', error);
      alert('❌ 执行失败: ' + (error as Error).message);
    } finally {
      setIsExecuting(false);
    }
  };

  if (!okxAccount && !error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-xl text-gray-400 animate-pulse">Loading OKX Account...</div>
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
                OKX Trading Dashboard
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                {config.sandbox ? 'OKX Demo Trading (Sandbox Mode)' : 'OKX Live Trading'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-sm ${
                error ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'
              }`}>
                {error ? '⚠️ Disconnected' : '✅ Connected'}
              </div>

              <div className={`px-3 py-1 rounded-full text-sm ${
                config.hasApiKey ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'
              }`}>
                {config.hasApiKey ? '🔑 API Key OK' : '⚠️ No API Key'}
              </div>

              {fundingTotal > 0 && (
                <button
                  onClick={transferToTrading}
                  disabled={transferring}
                  className={`${
                    transferring
                      ? 'bg-purple-400 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700'
                  } px-6 py-2 rounded-lg font-semibold`}
                >
                  {transferring ? '⏳ Transferring...' : '💸 Transfer to Trading'}
                </button>
              )}

              {tradingEquity > 0 && !isRunning && (
                <button
                  onClick={startTrading}
                  className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold"
                >
                  ▶️ Start Auto Trading
                </button>
              )}

              {tradingEquity > 0 && isRunning && (
                <button
                  onClick={stopTrading}
                  className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold"
                >
                  ⏸️ Stop Trading
                </button>
              )}

              {tradingEquity > 0 && (
                <button
                  onClick={executeOnce}
                  disabled={isExecuting}
                  className={`${
                    isExecuting
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  } px-6 py-2 rounded-lg font-semibold`}
                >
                  {isExecuting ? '⏳ Executing...' : '🔄 Execute Once'}
                </button>
              )}

              <button
                onClick={testConnection}
                disabled={testingConnection}
                className={`${
                  testingConnection
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gray-600 hover:bg-gray-700'
                } px-6 py-2 rounded-lg font-semibold`}
              >
                {testingConnection ? '⏳ Testing...' : '🔧 Test'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Auto Trading Status Bar (visible when running) */}
        {isRunning && (
          <div className="bg-gradient-to-r from-green-900/50 to-blue-900/50 border border-green-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-bold text-green-300">🤖 Auto Trading Active</span>
                </div>
                <div className="text-gray-300">
                  Next execution in: <span className="font-mono font-bold text-blue-300">
                    {Math.floor(countdown / 60000)}:{String(Math.floor((countdown % 60000) / 1000)).padStart(2, '0')}
                  </span>
                </div>
              </div>
              <div className="text-sm text-gray-400">
                {executionLogs.length > 0 && (
                  <>Last run: {new Date(executionLogs[0].timestamp).toLocaleTimeString()}</>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Account Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Total Equity</div>
            <div className="text-3xl font-bold text-white">
              ${totalEquity.toFixed(2)}
            </div>
            <div className={`text-sm mt-2 ${
              returnPercent >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {returnPercent >= 0 ? '📈' : '📉'} {returnPercent.toFixed(2)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Trading: ${tradingEquity.toFixed(2)} | Funding: ${fundingTotal.toFixed(2)}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Funding Account</div>
            <div className="text-3xl font-bold text-white">
              ${fundingTotal.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              {fundingAccount.length} Assets
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Need transfer to trade
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Open Positions</div>
            <div className="text-3xl font-bold text-white">
              {positions.length}
            </div>
            <div className="text-sm text-gray-500 mt-2">Active Trades</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Account Status</div>
            <div className="text-xl font-bold text-white mt-2">
              {accountInfo ? '✅ Active' : '⚠️ No Data'}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              {config.sandbox ? 'Demo Mode' : 'Live Trading'}
            </div>
          </div>
        </div>

        {/* Current Positions */}
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-bold">Current Positions</h2>
          </div>
          <div className="p-6">
            {positions.length > 0 ? (
              <div className="space-y-3">
                {positions.map((pos: any, index: number) => {
                  const size = parseFloat(pos.pos || '0');
                  const isLong = size > 0;
                  const leverage = parseFloat(pos.lever || '1');
                  const avgPrice = parseFloat(pos.avgPx || '0');
                  const unrealizedPnL = parseFloat(pos.upl || '0');
                  const uplRatio = parseFloat(pos.uplRatio || '0') * 100;

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
                            {pos.instId} {isLong ? '🟢 LONG' : '🔴 SHORT'} {leverage}x
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            Size: {Math.abs(size).toFixed(4)} | Avg Price: ${avgPrice.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xl font-bold ${
                            unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2)}
                          </div>
                          <div className={`text-sm ${
                            uplRatio >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            P/L Ratio: {uplRatio.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <div className="text-2xl mb-2">💼</div>
                <div>No open positions</div>
                <div className="text-xs mt-2">
                  {okxAccount ? 'OKX account has no active trades' : 'Loading account data...'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Market Data */}
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-bold">Market Prices (OKX)</h2>
          </div>
          <div className="p-6">
            {Object.keys(marketPrices).length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(marketPrices).slice(0, 12).map(([symbol, price]: [string, any]) => (
                  <div key={symbol} className="bg-gray-700/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400">{symbol}</div>
                    <div className="text-xl font-bold mt-1">
                      ${typeof price === 'number' ? price.toLocaleString() : parseFloat(price).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <div className="text-2xl mb-2">📊</div>
                <div>No market data available</div>
              </div>
            )}
          </div>
        </div>

        {/* Status Info */}
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">ℹ️</div>
            <div className="flex-1">
              <div className="font-bold text-blue-300 mb-1">OKX Connection Status</div>
              <div className="text-sm text-gray-300">
                {okxAccount?.success ? (
                  <>🟢 Successfully connected to <span className="text-green-400 font-bold">OKX API</span></>
                ) : (
                  <>⚠️ <span className="text-yellow-400 font-bold">Connection issue</span> - Check your API credentials</>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Exchange: OKX | Mode: {config.sandbox ? 'Demo Trading (Sandbox)' : 'Live Trading'} | API Key: {config.hasApiKey ? 'Configured' : 'Missing'}
              </div>
              {error && (
                <div className="text-xs text-red-400 mt-2">
                  Error: {error.message || 'Failed to fetch account data'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Execution History */}
        {executionLogs.length > 0 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-bold">🕒 Execution History</h2>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {executionLogs.map((log, index) => (
                  <div
                    key={log.timestamp}
                    className={`p-3 rounded-lg border ${
                      log.status === 'success'
                        ? 'bg-green-900/20 border-green-700'
                        : 'bg-red-900/20 border-red-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {log.status === 'success' ? '✅' : '❌'}
                        </span>
                        <div>
                          <div className="text-sm font-semibold">
                            {log.message}
                            {log.decisions !== undefined && log.decisions > 0 && (
                              <span className="ml-2 text-blue-400">
                                ({log.decisions} decision{log.decisions > 1 ? 's' : ''})
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(log.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        #{executionLogs.length - index}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
