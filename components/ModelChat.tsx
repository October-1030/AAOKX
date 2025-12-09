/**
 * 模型详情组件
 *
 * NOTE: 系统已重构为 DeepSeek 单模型架构
 * 此组件现在只显示 DeepSeek 的详细信息（策略、持仓、决策推理）
 * 原来的多模型选择器自动简化为只有一个选项
 *
 * 显示内容：
 * - DeepSeek 的当前策略
 * - 当前持仓详情
 * - 最新决策推理（Chain of Thought）
 * - 表现指标
 */

'use client';

import { useState } from 'react';
import { ModelPerformance } from '@/types/trading';

interface ModelChatProps {
  performances: ModelPerformance[];
}

export default function ModelChat({ performances }: ModelChatProps) {
  const [selectedModel, setSelectedModel] = useState(performances[0]?.modelName || '');

  const selectedPerf = performances.find(p => p.modelName === selectedModel);

  // 过滤有效数据
  const validPerformances = performances.filter(
    perf => perf && typeof perf.returnPercent === 'number'
  );

  if (validPerformances.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-white">💭 MODEL CHAT</h2>
        <div className="text-center text-gray-400 py-8">
          No model data available yet...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-white">💭 MODEL CHAT</h2>

      {/* Model Selector */}
      <div className="mb-6">
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
        >
          {validPerformances.map(perf => {
            const returnPercent = perf.returnPercent ?? 0;
            return (
              <option key={perf.modelName} value={perf.modelName}>
                {perf.displayName} ({returnPercent >= 0 ? '+' : ''}
                {returnPercent.toFixed(2)}%)
              </option>
            );
          })}
        </select>
      </div>

      {/* Chat Display */}
      {selectedPerf && (
        <div className="space-y-4">
          {/* Current Strategy */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Strategy</div>
            <div className="text-white">{selectedPerf.strategy}</div>
          </div>

          {/* Current Positions */}
          {(selectedPerf.positions || []).length > 0 ? (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-3">Current Positions</div>
              <div className="space-y-3">
                {(selectedPerf.positions || []).map(pos => {
                  const unrealizedPnL = pos.unrealizedPnLPercent ?? 0;
                  const entryPrice = pos.entryPrice ?? 0;
                  const currentPrice = pos.currentPrice ?? 0;
                  const stopLoss = pos.exitPlan?.stopLoss ?? 0;
                  const takeProfit = pos.exitPlan?.takeProfit ?? 0;
                  return (
                  <div
                    key={pos.id}
                    className={`p-3 rounded-lg ${
                      pos.side === 'LONG'
                        ? 'bg-green-900/30 border border-green-700'
                        : 'bg-red-900/30 border border-red-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-white">
                        {pos.coin} {pos.side} {pos.leverage}x
                      </div>
                      <div
                        className={`font-bold ${
                          unrealizedPnL >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}
                      >
                        {unrealizedPnL >= 0 ? '+' : ''}
                        {unrealizedPnL.toFixed(2)}%
                      </div>
                    </div>

                    <div className="text-sm space-y-1">
                      <div className="flex justify-between text-gray-400">
                        <span>Entry:</span>
                        <span className="text-white">
                          ${entryPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Current:</span>
                        <span className="text-white">
                          ${currentPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Stop Loss:</span>
                        <span className="text-red-400">
                          ${stopLoss.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Take Profit:</span>
                        <span className="text-green-400">
                          ${takeProfit.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <div className="text-xs text-gray-400">Exit Plan:</div>
                      <div className="text-xs text-white mt-1">
                        {pos.exitPlan?.invalidation || 'No exit plan'}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">Current Positions</div>
              <div className="text-white italic">
                No active positions. Waiting for high-probability setups...
              </div>
            </div>
          )}

          {/* Recent Decision Reasoning */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-3">
              Latest Decision Reasoning
            </div>
            <div className="text-white text-sm whitespace-pre-wrap font-mono bg-gray-900 p-3 rounded-lg overflow-auto max-h-96">
              {selectedPerf.recentDecisions.length > 0
                ? selectedPerf.recentDecisions[0].chainOfThought.overallAssessment
                : `Analyzing market conditions...

Market shows mixed signals with moderate volatility. Maintaining disciplined approach.

"Discipline is paramount - waiting for clear entry signals with RSI < 30 or confirmed breakouts."`}
            </div>
          </div>

          {/* Performance Stats */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-3">Performance Metrics</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500">Total Equity</div>
                <div className="text-lg font-bold text-white">
                  ${(selectedPerf.currentEquity ?? 10000).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Return</div>
                <div
                  className={`text-lg font-bold ${
                    (selectedPerf.returnPercent ?? 0) >= 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  {(selectedPerf.returnPercent ?? 0) >= 0 ? '+' : ''}
                  {(selectedPerf.returnPercent ?? 0).toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Win Rate</div>
                <div className="text-lg font-bold text-white">
                  {(selectedPerf.winRate ?? 0).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Sharpe Ratio</div>
                <div className="text-lg font-bold text-white">
                  {(selectedPerf.sharpeRatio ?? 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
