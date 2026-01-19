'use client';

import { useEffect, useState } from 'react';
import PerformanceRegimeDetail from './PerformanceRegimeDetail';
import type { Trade } from '@/types/performance';

interface TradeRecord {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice?: number;
  openedAt: number;
  closedAt?: number;
  realizedPnl?: number;
  status: string;
  regime?: string;
  strategyFlavor?: string;
  notional?: number;
  leverage?: number;
  aiReason?: string;
  marketContext?: string;
  riskNote?: string;
}

// 转换 API 返回的 TradeRecord 到 Performance 统一的 Trade 格式
function convertToTrades(records: TradeRecord[]): Trade[] {
  // 验证 MarketRegime 类型
  const validRegimes = ['UPTREND', 'DOWNTREND', 'RANGING', 'CHOPPY', 'LOW_VOL'];
  const validFlavors = ['TREND_FOLLOWING', 'MEAN_REVERSION', 'SCALPING', 'BREAKOUT', 'NO_TRADE'];

  return records
    .filter(r => r.status !== 'open' && r.exitPrice && r.closedAt) // 只包含已关闭的交易
    .map(r => ({
      id: r.id,
      symbol: r.symbol,
      side: r.side,
      entryPrice: r.entryPrice,
      exitPrice: r.exitPrice!,
      openedAt: r.openedAt,
      closedAt: r.closedAt,
      entryTime: new Date(r.openedAt).toISOString(),
      exitTime: new Date(r.closedAt!).toISOString(),
      pnl: r.realizedPnl || 0,
      realizedPnl: r.realizedPnl,
      status: r.status as Trade['status'],
      regime: (r.regime && validRegimes.includes(r.regime) ? r.regime : undefined) as Trade['regime'],
      strategyFlavor: (r.strategyFlavor && validFlavors.includes(r.strategyFlavor) ? r.strategyFlavor : undefined) as Trade['strategyFlavor'],
      notional: r.notional || 0,
      leverage: r.leverage,
      qty: r.notional ? r.notional / r.entryPrice : 0,
      aiReason: r.aiReason,
      marketContext: r.marketContext,
      riskNote: r.riskNote,
      isLive: true,
    }));
}

export default function PerformanceRegimeDetailWrapper() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/performance/trades')
      .then(res => res.json())
      .then(result => {
        if (result.success && Array.isArray(result.data)) {
          const converted = convertToTrades(result.data);
          setTrades(converted);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-400">
        <div className="animate-pulse">Loading regime detail...</div>
      </div>
    );
  }

  return <PerformanceRegimeDetail trades={trades} />;
}
