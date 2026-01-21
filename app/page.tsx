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

  // 实时交易状态轮询（检查后端状态）
  // 🔧 FIX: 不再自动关闭，只同步状态显示
  useEffect(() => {
    if (!isRunning) return;

    // 每 30 秒检查一次后端状态
    const statusCheckInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/realtime-trading?action=status');
        const result = await response.json();

        if (result.success && !result.isRunning) {
          // 🔧 FIX: 不自动关闭，只记录日志
          // 后端可能正在自动恢复中（热重载后 3 秒内会自动恢复）
          console.log('[Frontend] ⏳ 后端暂时未运行，等待自动恢复...');
          // 不再调用 setIsRunning(false) 和 clearAutoTradingState()
        }
      } catch (e) {
        // 静默处理
      }
    }, 30000);

    return () => {
      clearInterval(statusCheckInterval);
    };
  }, [isRunning]);

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

  // 静默执行一次分析（遗留代码 - 新系统由 Sentinel 自动处理）
  // 注意：新的 Sentinel v1.4 系统是事件驱动的，不需要前端定时器
  const executeOnceSilent = async () => {
    const timestamp = Date.now();
    console.log('[Frontend] ⏰ 触发 Strategist 分析...');

    try {
      // 使用新的 Sentinel 系统 API
      const response = await fetch('/api/realtime-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger_analysis' }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('[Frontend] ✅ Strategist 分析完成:', result);

        // 添加执行日志
        setExecutionLogs(prev => [
          {
            timestamp,
            status: 'success',
            message: result.status?.marketContext || 'Strategist 分析完成',
            decisions: 0, // Sentinel 系统是事件驱动的
          },
          ...prev.slice(0, 9) // 只保留最近10条
        ]);

        mutate(); // 刷新账户数据
      } else {
        console.error('[Frontend] ❌ Strategist 分析失败:', result.error || result.message);

        // 添加错误日志
        setExecutionLogs(prev => [
          {
            timestamp,
            status: 'error',
            message: result.error || result.message || 'Strategist 分析失败',
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

  // 页面加载时恢复实时交易状态
  useEffect(() => {
    if (hasRestoredState.current) return;
    hasRestoredState.current = true;

    // 检查后端实时交易状态
    const checkRealtimeTradingStatus = async () => {
      try {
        const response = await fetch('/api/realtime-trading?action=status');
        const result = await response.json();

        if (result.success && result.isRunning) {
          console.log('[Frontend] 🔄 检测到实时交易系统正在运行');
          setIsRunning(true);
          console.log('[Frontend] ✅ 实时交易状态已同步');
          console.log(`[Frontend] 📊 当前市场状态: ${result.marketContext}`);
        } else {
          // 检查 localStorage 是否有保存的状态
          const raw = localStorage.getItem(AUTO_TRADING_STATE_KEY);
          if (raw) {
            const state: AutoTradingState = JSON.parse(raw);
            const isRecent = Date.now() - state.startedAt < 24 * 60 * 60 * 1000;

            if (state.isRunning && isRecent) {
              console.log('[Frontend] 🔄 尝试恢复实时交易状态...');
              // 尝试重新启动实时交易
              const startResponse = await fetch('/api/realtime-trading', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start' }),
              });
              const startResult = await startResponse.json();

              if (startResult.success) {
                setIsRunning(true);
                console.log('[Frontend] ✅ 实时交易已自动恢复');
              }
            } else if (!isRecent) {
              console.log('[Frontend] 🗑️ 清除过期的自动交易状态');
              clearAutoTradingState();
            }
          }
        }
      } catch (e) {
        console.error('[Frontend] 无法检查实时交易状态:', e);
      }
    };

    checkRealtimeTradingStatus();
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

  // 启动自动交易（实时监听模式）
  const startTrading = async () => {
    if (tradingEquity <= 0) {
      alert('⚠️ 交易账户余额为0，请先划转资金');
      return;
    }

    const confirmed = confirm(
      `🤖 启动实时交易？\n\n` +
      `系统将实时监听 Flow-Radar 信号并自动执行交易\n` +
      `- Strategist 每15分钟更新市场状态\n` +
      `- Sentinel 实时监听信号（三道闸机制）\n` +
      `交易账户余额：$${tradingEquity.toFixed(2)}\n\n` +
      `确定启动吗？`
    );

    if (!confirmed) return;

    try {
      console.log('[Frontend] 🚀 启动实时交易系统...');

      const response = await fetch('/api/realtime-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });

      const result = await response.json();

      if (result.success) {
        setIsRunning(true);
        saveAutoTradingState(true, Date.now());
        alert(`✅ 实时交易已启动！\n\n${result.message}\n\n系统将实时响应 Flow-Radar 信号`);
        console.log('[Frontend] ✅ 实时交易已启动:', result);
      } else {
        alert('❌ 启动失败\n\n' + (result.error || result.message));
        console.error('[Frontend] 启动失败:', result);
      }
    } catch (error) {
      console.error('[Frontend] 启动异常:', error);
      alert('❌ 启动失败: ' + (error as Error).message);
    }
  };

  // 停止自动交易（实时监听模式）
  const stopTrading = async () => {
    try {
      console.log('[Frontend] 🛑 停止实时交易系统...');

      const response = await fetch('/api/realtime-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });

      const result = await response.json();

      // 清理前端状态
      if (tradingIntervalRef.current) {
        clearInterval(tradingIntervalRef.current);
        tradingIntervalRef.current = null;
      }

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      clearAutoTradingState();
      setIsRunning(false);
      setCountdown(0);
      setNextExecutionTime(0);

      if (result.success) {
        alert(`⏸️ 实时交易已停止\n\n${result.message}`);
        console.log('[Frontend] ✅ 实时交易已停止:', result);
      } else {
        alert('⚠️ 停止请求返回警告\n\n' + (result.error || result.message));
      }
    } catch (error) {
      console.error('[Frontend] 停止异常:', error);
      alert('❌ 停止失败: ' + (error as Error).message);
    }
  };

  // 手动触发 Strategist 分析（更新市场状态）
  const executeOnce = async () => {
    if (tradingEquity <= 0) {
      alert('⚠️ 交易账户余额为0，请先划转资金');
      return;
    }

    setIsExecuting(true);
    try {
      // 使用新的 Sentinel 系统 API
      const response = await fetch('/api/realtime-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger_analysis' }),
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ 市场分析已更新！\n\n' +
          '- Strategist 已刷新市场状态\n' +
          '- 交易决策由 Sentinel 根据信号自动执行\n\n' +
          `当前状态: ${result.status?.marketContext || '获取中...'}`);
        console.log('[Frontend] Strategist 分析结果:', result);
        mutate(); // 刷新账户数据
      } else {
        alert('❌ 分析失败\n\n' + (result.error || result.message));
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
              {/* 🔧 FIX: 使用 okxAccount?.success 判断连接状态，而不是 error */}
              {/* 即使有 error，只要最近有成功的数据就显示 Connected */}
              <div className={`px-3 py-1 rounded-full text-sm ${
                okxAccount?.success ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
              }`}>
                {okxAccount?.success ? '✅ Connected' : '⚠️ Disconnected'}
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
                  title="手动刷新 Strategist 市场分析（交易由信号自动触发）"
                >
                  {isExecuting ? '⏳ 分析中...' : '📊 刷新分析'}
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
                  const margin = parseFloat(pos.margin || pos.imr || '0');
                  const notionalUsd = parseFloat(pos.notionalUsd || '0');

                  // 从合约 ID 提取币种名称
                  const instId = pos.instId || '';
                  const coinName = instId.split('-')[0] || 'UNKNOWN';

                  // 获取当前市场价格
                  const currentPrice = marketPrices[coinName] || 0;

                  // 合约乘数（每张合约的币数量）：DOGE=10, BTC=0.01, ETH=0.1
                  const contractMultiplier: Record<string, number> = {
                    'DOGE': 10,
                    'BTC': 0.01,
                    'ETH': 0.1,
                    'SOL': 1,
                  };
                  const multiplier = contractMultiplier[coinName] || 1;

                  // 🔧 FIX: 从 notionalUsd 反推正确的数量（OKX pos 字段可能有格式问题）
                  // 优先使用 notionalUsd，它是最可靠的
                  let coinAmount: number;
                  let contractCount: number;

                  if (notionalUsd > 0 && currentPrice > 0) {
                    // 从名义价值反推币数量
                    coinAmount = notionalUsd / currentPrice;
                    contractCount = coinAmount / multiplier;
                  } else {
                    // 备用：使用 pos 字段（可能不准确）
                    contractCount = Math.abs(size);
                    coinAmount = contractCount * multiplier;
                  }

                  // 名义价值（直接使用 OKX 返回的值）
                  const calculatedNotional = notionalUsd > 0
                    ? notionalUsd
                    : coinAmount * (currentPrice || avgPrice);

                  // 入场价值
                  const entryValue = coinAmount * avgPrice;

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
                        <div className="flex-1">
                          <div className="text-lg font-bold">
                            {pos.instId} {isLong ? '🟢 LONG' : '🔴 SHORT'} {leverage}x
                          </div>

                          {/* 详细持仓信息 */}
                          <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                            <div className="text-gray-400">
                              合约数量: <span className="text-white font-medium">{contractCount.toFixed(0)} 张</span>
                            </div>
                            <div className="text-gray-400">
                              币种数量: <span className="text-white font-medium">{coinAmount.toFixed(2)} {coinName}</span>
                            </div>
                            <div className="text-gray-400">
                              入场均价: <span className="text-white font-medium">${avgPrice.toFixed(4)}</span>
                            </div>
                            <div className="text-gray-400">
                              当前价格: <span className="text-white font-medium">${currentPrice ? currentPrice.toFixed(4) : 'N/A'}</span>
                            </div>
                            <div className="text-gray-400">
                              入场价值: <span className="text-yellow-300 font-medium">${entryValue.toFixed(2)}</span>
                            </div>
                            <div className="text-gray-400">
                              当前价值: <span className="text-blue-300 font-medium">${calculatedNotional.toFixed(2)}</span>
                            </div>
                            <div className="text-gray-400">
                              占用保证金: <span className="text-purple-300 font-medium">${margin.toFixed(2)}</span>
                            </div>
                            <div className="text-gray-400">
                              实际杠杆: <span className="text-white font-medium">{(calculatedNotional / (margin || 1)).toFixed(1)}x</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right ml-4">
                          <div className={`text-2xl font-bold ${
                            unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2)}
                          </div>
                          <div className={`text-lg ${
                            uplRatio >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {uplRatio >= 0 ? '+' : ''}{uplRatio.toFixed(2)}%
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            未实现盈亏
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
