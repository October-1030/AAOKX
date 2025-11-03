'use client';

import { MarketData } from '@/types/trading';

interface MarketOverviewProps {
  marketData: MarketData[];
}

export default function MarketOverview({ marketData }: MarketOverviewProps) {
  // 过滤掉没有有效数据的市场
  const validMarketData = marketData.filter(
    market => market?.current && typeof market.current.price === 'number'
  );

  if (validMarketData.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-white">💹 MARKET DATA</h2>
        <div className="text-center text-gray-400 py-8">
          Loading market data...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-white">💹 MARKET DATA</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {validMarketData.map(market => {
          const { coin, current } = market;

          // 安全获取数值，提供默认值
          const price = current.price ?? 0;
          const ema20 = current.ema_20 ?? 0;
          const rsi = current.rsi ?? 50;
          const macd = current.macd ?? 0;
          const volumeRatio = current.volume_ratio ?? 1;

          const rsiStatus =
            rsi > 70
              ? 'Overbought'
              : rsi < 30
              ? 'Oversold'
              : 'Neutral';
          const macdStatus = macd > 0 ? 'Bullish' : 'Bearish';

          return (
            <div
              key={coin}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-xl font-bold text-white">{coin}</div>
                <div className="text-2xl font-bold text-blue-400">
                  ${price.toFixed(coin === 'DOGE' ? 4 : 2)}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">EMA-20</span>
                  <span className="text-white font-mono">
                    ${ema20.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">RSI</span>
                  <span
                    className={`font-mono font-semibold ${
                      rsi > 70
                        ? 'text-red-400'
                        : rsi < 30
                        ? 'text-green-400'
                        : 'text-yellow-400'
                    }`}
                  >
                    {rsi.toFixed(1)} ({rsiStatus})
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">MACD</span>
                  <span
                    className={`font-mono font-semibold ${
                      macd > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {macd.toFixed(4)} ({macdStatus})
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Volume</span>
                  <span className="text-white font-mono">
                    {volumeRatio.toFixed(2)}x avg
                  </span>
                </div>
              </div>

              {/* Mini price indicator */}
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      price > ema20
                        ? 'bg-green-500 animate-pulse'
                        : 'bg-red-500 animate-pulse'
                    }`}
                  />
                  <span className="text-xs text-gray-400">
                    {price > ema20
                      ? 'Above EMA-20'
                      : 'Below EMA-20'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
