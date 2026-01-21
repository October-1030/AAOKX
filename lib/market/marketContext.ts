/**
 * MarketContext 缓存模块
 * 缓存当前市场状态，供实时层快速读取
 */

export type TrendBias = 'bullish' | 'bearish' | 'neutral';
export type MarketRegime = 'trend' | 'range' | 'high_vol' | 'low_liq';
export type RiskMode = 'normal' | 'cautious' | 'paused';
export type EmaTrend = 'bullish' | 'bearish' | 'neutral';

export interface MarketContextData {
  // 趋势判断
  trend_bias: TrendBias;
  regime: MarketRegime;

  // 风险控制
  risk_mode: RiskMode;
  allowed_leverage_max: 2 | 3 | 5;
  position_cap_pct: number;
  trade_allowed: boolean;

  // 技术指标快照
  rsi: number;
  ema_trend: EmaTrend;

  // 元数据
  updated_at: string;
  symbol: string;
}

// 默认上下文
const DEFAULT_CONTEXT: MarketContextData = {
  trend_bias: 'neutral',
  regime: 'range',
  risk_mode: 'cautious',
  allowed_leverage_max: 2,
  position_cap_pct: 5,
  trade_allowed: false, // 初始化时不允许交易，等 Strategist 首次运行
  rsi: 50,
  ema_trend: 'neutral',
  updated_at: new Date().toISOString(),
  symbol: 'DOGE/USDT',
};

/**
 * MarketContext 管理器
 * 单例模式，提供全局访问
 */
class MarketContextManager {
  private context: MarketContextData;
  private listeners: ((ctx: MarketContextData) => void)[] = [];

  constructor() {
    this.context = { ...DEFAULT_CONTEXT };
  }

  /**
   * 获取当前上下文（只读）
   */
  get(): Readonly<MarketContextData> {
    return { ...this.context };
  }

  /**
   * 更新上下文
   */
  update(partial: Partial<MarketContextData>): void {
    const previous = { ...this.context };

    this.context = {
      ...this.context,
      ...partial,
      updated_at: new Date().toISOString(),
    };

    // 记录变更
    const changes = this.getChanges(previous, this.context);
    if (changes.length > 0) {
      console.log(`[MarketContext] 📊 上下文更新:`);
      changes.forEach(change => {
        console.log(`  ${change.key}: ${change.from} → ${change.to}`);
      });
    }

    // 通知监听器
    this.notifyListeners();
  }

  /**
   * 检查是否允许交易
   */
  canTrade(): boolean {
    return this.context.trade_allowed && this.context.risk_mode !== 'paused';
  }

  /**
   * 获取当前允许的最大杠杆
   */
  getMaxLeverage(): number {
    return this.context.allowed_leverage_max;
  }

  /**
   * 获取仓位上限百分比
   */
  getPositionCapPct(): number {
    return this.context.position_cap_pct;
  }

  /**
   * 检查信号方向是否与趋势一致
   */
  checkTrendAlignment(signalDirection: 'LONG' | 'SHORT'): {
    aligned: boolean;
    positionMultiplier: number;
    reason: string;
  } {
    const { trend_bias } = this.context;

    // 信号方向映射
    const signalBias: TrendBias = signalDirection === 'LONG' ? 'bullish' : 'bearish';

    if (trend_bias === signalBias) {
      return {
        aligned: true,
        positionMultiplier: 1.0, // 100% 仓位
        reason: `信号方向与趋势一致 (${trend_bias})`,
      };
    }

    if (trend_bias === 'neutral') {
      return {
        aligned: true, // 中性也允许
        positionMultiplier: 0.7, // 70% 仓位
        reason: `趋势中性，降低仓位`,
      };
    }

    // 信号与趋势冲突
    return {
      aligned: false,
      positionMultiplier: 0.5, // 50% 仓位（高置信度时）
      reason: `信号方向 (${signalBias}) 与趋势 (${trend_bias}) 冲突`,
    };
  }

  /**
   * 设置风险模式
   */
  setRiskMode(mode: RiskMode, reason?: string): void {
    if (this.context.risk_mode !== mode) {
      console.log(`[MarketContext] ⚠️ 风险模式变更: ${this.context.risk_mode} → ${mode}${reason ? ` (${reason})` : ''}`);

      // 根据风险模式调整参数
      let leverage: 2 | 3 | 5 = 2;
      let positionCap = 5;
      let tradeAllowed = true;

      switch (mode) {
        case 'normal':
          leverage = 5;
          positionCap = 5;
          tradeAllowed = true;
          break;
        case 'cautious':
          leverage = 2;
          positionCap = 3;
          tradeAllowed = true;
          break;
        case 'paused':
          leverage = 2;
          positionCap = 0;
          tradeAllowed = false;
          break;
      }

      this.update({
        risk_mode: mode,
        allowed_leverage_max: leverage,
        position_cap_pct: positionCap,
        trade_allowed: tradeAllowed,
      });
    }
  }

  /**
   * 添加监听器
   */
  addListener(callback: (ctx: MarketContextData) => void): void {
    this.listeners.push(callback);
  }

  /**
   * 移除监听器
   */
  removeListener(callback: (ctx: MarketContextData) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const ctx = this.get();
    for (const listener of this.listeners) {
      try {
        listener(ctx);
      } catch (error) {
        console.error('[MarketContext] 监听器错误:', error);
      }
    }
  }

  /**
   * 获取变更列表
   */
  private getChanges(
    prev: MarketContextData,
    curr: MarketContextData
  ): { key: string; from: any; to: any }[] {
    const changes: { key: string; from: any; to: any }[] = [];
    const keys: (keyof MarketContextData)[] = [
      'trend_bias', 'regime', 'risk_mode', 'allowed_leverage_max',
      'position_cap_pct', 'trade_allowed', 'rsi', 'ema_trend'
    ];

    for (const key of keys) {
      if (prev[key] !== curr[key]) {
        changes.push({ key, from: prev[key], to: curr[key] });
      }
    }

    return changes;
  }

  /**
   * 获取状态摘要（用于日志）
   */
  getSummary(): string {
    const ctx = this.context;
    return `[趋势:${ctx.trend_bias}|风险:${ctx.risk_mode}|杠杆≤${ctx.allowed_leverage_max}x|仓位≤${ctx.position_cap_pct}%|交易:${ctx.trade_allowed ? '允许' : '禁止'}]`;
  }

  /**
   * 重置为默认状态
   */
  reset(): void {
    this.context = { ...DEFAULT_CONTEXT };
    console.log('[MarketContext] 🔄 已重置为默认状态');
  }
}

// 单例
let instance: MarketContextManager | null = null;

export function getMarketContext(): MarketContextManager {
  if (!instance) {
    instance = new MarketContextManager();
  }
  return instance;
}

// 导出类型和管理器
export { MarketContextManager };
