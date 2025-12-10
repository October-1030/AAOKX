# Market Regime & Strategy Flavor 使用指南

## ✅ 已添加的类型定义

### MarketRegime（市场状态）
```typescript
export type MarketRegime =
  | 'UPTREND'      // 强趋势上涨
  | 'DOWNTREND'    // 强趋势下跌
  | 'RANGING'      // 震荡区间
  | 'CHOPPY'       // 假突破 / 狗庄洗盘
  | 'LOW_VOL';     // 低波动，没啥机会
```

### StrategyFlavor（策略类型）
```typescript
export type StrategyFlavor =
  | 'TREND_FOLLOWING'   // 趋势跟随
  | 'MEAN_REVERSION'    // 反转 / 抄底逃顶
  | 'SCALPING'          // 超短线
  | 'BREAKOUT'          // 突破交易
  | 'NO_TRADE';         // 仅做分析，不开仓
```

### TradingDecision 更新
```typescript
export interface TradingDecision {
  // ... 原有字段 ...

  // ✅ AI 认知层：明确标注市场状态判断和策略类型
  regime?: MarketRegime;        // AI 对当前市场状态的判断
  strategyFlavor?: StrategyFlavor;  // AI 使用的策略类型
}
```

---

## 📊 使用场景

### 1. AI提示词中要求输出

在 `lib/tradingPromptNOF1.ts` 中更新 JSON 输出格式：

```typescript
"decisions": [
  {
    "coin": "BTC",
    "action": "buy_to_enter",
    "confidence": 0.75,
    "leverage": 5,
    "notional": 500,
    "regime": "UPTREND",              // ✅ 新增：市场状态判断
    "strategyFlavor": "TREND_FOLLOWING", // ✅ 新增：策略类型
    "exitPlan": {
      "invalidation": "Breaks below $90,000 support",
      "stopLoss": 89500,
      "takeProfit": 95000
    },
    "riskUsd": 25,
    "justification": "Strong uptrend confirmed by ADX > 25, following trend momentum",
    "aiReason": "Riding strong uptrend with momentum confirmation"
  }
]
```

### 2. 市场状态识别逻辑

```typescript
// 在 AI 提示词中添加市场状态识别指南
const regimeGuidelines = `
## Market Regime Identification

1. **UPTREND**:
   - ADX > 25 + Price > EMA20 > EMA50
   - MACD histogram positive and increasing
   - Linear regression slope > 0 with R² > 0.7

2. **DOWNTREND**:
   - ADX > 25 + Price < EMA20 < EMA50
   - MACD histogram negative and decreasing
   - Linear regression slope < 0 with R² > 0.7

3. **RANGING**:
   - ADX < 20
   - Price oscillating around EMA20
   - Z-Score between -2 and +2
   - R² < 0.5 (low trend strength)

4. **CHOPPY**:
   - Frequent false breakouts
   - Contradicting signals (RSI oversold but price breaking down)
   - High ATR but low directional movement

5. **LOW_VOL**:
   - ATR < 50% of 30-day average
   - Volume < 70% of average
   - Narrow price range
`;
```

### 3. 策略选择逻辑

```typescript
const strategySelection = `
## Strategy Flavor Selection

Based on regime, choose appropriate strategy:

- **UPTREND/DOWNTREND** → TREND_FOLLOWING
  - Follow the trend with momentum
  - Use higher leverage (5-10x)
  - Wider stops (2-3% ATR)

- **RANGING** → MEAN_REVERSION
  - Trade oversold/overbought extremes
  - Use moderate leverage (2-5x)
  - Tight stops (1-2% ATR)
  - Target return to mean (Z-Score → 0)

- **CHOPPY** → NO_TRADE
  - Avoid trading in choppy conditions
  - Wait for clear regime

- **LOW_VOL** → NO_TRADE or SCALPING
  - Only scalp if spread is tight
  - Use very small positions

- **Breakout from RANGING** → BREAKOUT
  - Trade the breakout when volume confirms
  - Use trailing stops
`;
```

---

## 🔧 实现建议

### 更新 AI Prompt

在 `lib/tradingPromptNOF1.ts` 的系统提示词中添加：

```typescript
export function generateNOF1SystemPrompt(strategy?: string): string {
  return `# SYSTEM PROMPT

You are an autonomous cryptocurrency trading agent.

## MARKET REGIME AWARENESS

Before making any decision, you MUST identify the current market regime:

1. **Analyze Technical Context**:
   - Trend strength (ADX, linear regression R²)
   - Price position relative to EMAs
   - Momentum (MACD, RSI)
   - Volatility (ATR, Z-Score)

2. **Classify Market Regime**:
   - UPTREND: Strong upward movement (ADX > 25, price > EMAs)
   - DOWNTREND: Strong downward movement (ADX > 25, price < EMAs)
   - RANGING: Sideways consolidation (ADX < 20, mean-reverting)
   - CHOPPY: False breakouts, contradicting signals
   - LOW_VOL: Low volatility, narrow range

3. **Select Strategy Flavor**:
   - TREND_FOLLOWING: For strong trends (UPTREND/DOWNTREND)
   - MEAN_REVERSION: For ranging markets (RANGING)
   - BREAKOUT: For breaking out of ranges
   - SCALPING: For low volatility with tight spreads
   - NO_TRADE: For choppy or unclear conditions

## OUTPUT FORMAT

Every decision MUST include:
- "regime": "<UPTREND|DOWNTREND|RANGING|CHOPPY|LOW_VOL>"
- "strategyFlavor": "<TREND_FOLLOWING|MEAN_REVERSION|SCALPING|BREAKOUT|NO_TRADE>"

Example:
{
  "coin": "ETH",
  "action": "buy_to_enter",
  "regime": "RANGING",
  "strategyFlavor": "MEAN_REVERSION",
  "justification": "Z-Score -2.1 indicates extreme oversold in ranging market, expecting mean reversion"
}
`;
}
```

---

## 📈 数据分析应用

### 1. 统计策略有效性

```typescript
// 统计每种策略在不同市场状态下的胜率
interface StrategyStats {
  regime: MarketRegime;
  strategyFlavor: StrategyFlavor;
  totalTrades: number;
  winRate: number;
  avgReturn: number;
}

// 分析历史交易
const analyzeStrategyPerformance = (trades: CompletedTrade[]) => {
  const stats: Map<string, StrategyStats> = new Map();

  trades.forEach(trade => {
    const key = `${trade.regime}_${trade.strategyFlavor}`;
    // ... 统计逻辑
  });

  return stats;
};
```

### 2. 动态策略调整

```typescript
// 根据历史表现动态调整策略权重
const getOptimalStrategy = (
  regime: MarketRegime,
  stats: StrategyStats[]
): StrategyFlavor => {
  const regimeStats = stats.filter(s => s.regime === regime);
  const best = regimeStats.sort((a, b) => b.winRate - a.winRate)[0];
  return best.strategyFlavor;
};
```

---

## ✅ 下一步

1. **更新 Prompt 文件**:
   - 修改 `lib/tradingPromptNOF1.ts`
   - 添加 regime 和 strategyFlavor 的输出要求

2. **验证 AI 输出**:
   - 测试 AI 是否正确输出这两个字段
   - 检查分类是否合理

3. **添加日志记录**:
   - 在 `lib/tradeLog.ts` 中记录 regime 和 strategy
   - 便于后续分析

4. **性能分析**:
   - 统计不同 regime 下的交易表现
   - 优化策略选择逻辑

---

## 🎯 预期效果

通过明确标注市场状态和策略类型，系统将能够：

1. **更透明的决策过程**: 明确知道 AI 为什么选择这个策略
2. **更好的风险管理**: 在 CHOPPY 市场自动避免交易
3. **策略优化**: 统计数据支持策略改进
4. **可审计性**: 每笔交易都有明确的市场背景和策略依据
