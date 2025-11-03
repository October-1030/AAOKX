'use client';

import { ModelPerformance } from '@/types/trading';
import { getModelColor } from '@/lib/modelMeta';

interface LeaderboardProps {
  performances: ModelPerformance[];
}

export default function Leaderboard({ performances }: LeaderboardProps) {
  // 过滤并验证数据
  const validPerformances = performances.filter(
    perf => perf && typeof perf.returnPercent === 'number'
  );

  if (validPerformances.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-white">🏆 LEADING MODELS</h2>
        <div className="text-center text-gray-400 py-8">
          Waiting for models to start trading...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-white">🏆 LEADING MODELS</h2>

      <div className="space-y-3">
        {validPerformances.map((perf, index) => {
          // 安全获取所有数值
          const returnPercent = perf.returnPercent ?? 0;
          const currentEquity = perf.currentEquity ?? 10000;
          const totalTrades = perf.totalTrades ?? 0;
          const winRate = perf.winRate ?? 0;
          const sharpeRatio = perf.sharpeRatio ?? 0;
          const maxDrawdown = perf.maxDrawdown ?? 0;
          const positions = perf.positions ?? [];

          return (
          <div
            key={perf.modelName}
            className={`p-4 rounded-lg transition-all hover:scale-[1.02] relative overflow-hidden ${
              index === 0
                ? 'bg-gradient-to-r from-yellow-600 to-yellow-700 border-2 border-yellow-400'
                : index === 1
                ? 'bg-gradient-to-r from-gray-600 to-gray-700 border-2 border-gray-400'
                : index === 2
                ? 'bg-gradient-to-r from-orange-600 to-orange-700 border-2 border-orange-400'
                : 'bg-gray-800 border border-gray-700'
            }`}
          >
            {/* Model color accent bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: getModelColor(perf.modelName) }}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold text-white">
                  #{index + 1}
                </div>
                <div>
                  <div className="text-lg font-semibold text-white flex items-center gap-2">
                    {perf.displayName}
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getModelColor(perf.modelName) }}
                    />
                  </div>
                  <div className="text-sm text-gray-300">
                    {perf.strategy}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className={`text-2xl font-bold ${
                  returnPercent >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {returnPercent >= 0 ? '+' : ''}
                  {returnPercent.toFixed(2)}%
                </div>
                <div className="text-sm text-gray-300">
                  ${currentEquity.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Trades</div>
                <div className="text-white font-semibold">{totalTrades}</div>
              </div>
              <div>
                <div className="text-gray-400">Win Rate</div>
                <div className="text-white font-semibold">{winRate.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-gray-400">Sharpe</div>
                <div className="text-white font-semibold">{sharpeRatio.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-400">Max DD</div>
                <div className="text-red-400 font-semibold">-{maxDrawdown.toFixed(1)}%</div>
              </div>
            </div>

            {positions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-600">
                <div className="text-xs text-gray-400 mb-2">Active Positions:</div>
                <div className="flex flex-wrap gap-2">
                  {positions.map(pos => {
                    const unrealizedPnL = pos.unrealizedPnLPercent ?? 0;
                    return (
                      <span
                        key={pos.id}
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          pos.side === 'LONG'
                            ? 'bg-green-900 text-green-300'
                            : 'bg-red-900 text-red-300'
                        }`}
                      >
                        {pos.coin} {pos.side} {pos.leverage}x
                        {' '}
                        ({unrealizedPnL >= 0 ? '+' : ''}
                        {unrealizedPnL.toFixed(1)}%)
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
