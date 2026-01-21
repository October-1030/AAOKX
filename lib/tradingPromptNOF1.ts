// nof1.ai 风格的交易提示词系统（完全匹配）
// 基于真实 nof1.ai 提示词模板

import { AccountStatus, MarketData, TradingDecision, TradeAction, CompletedTrade, Coin, TechnicalIndicators } from '@/types/trading';
import { getAIEvolutionEngine, LearningReport } from './aiEvolutionEngine';
import { getPositionDurationTracker } from './positionDurationTracker';
import { getFlowRadarSignals, getFlowRadarStatus, getFlowRadarRiskControl } from './flowRadar';

/**
 * 生成 USER_PROMPT（数据输入层）- 完全匹配 nof1.ai 格式
 */
export function generateNOF1UserPrompt(
  accountStatus: AccountStatus,
  marketData: MarketData[]
): string {
  const { tradingDuration, totalCalls, totalReturn, availableCash, totalEquity, positions } = accountStatus;

  const tradingMinutes = Math.floor(tradingDuration / 60000);
  const currentTime = new Date().toLocaleString();

  let prompt = `It has been ${tradingMinutes} minutes since you started trading. The current time is ${currentTime} and you've been invoked ${totalCalls} times. Below, we are providing you with a variety of state data, price data, and predictive signals so you can discover alpha. Below that is your current account information, value, performance, positions, etc.

ALL OF THE PRICE OR SIGNAL DATA BELOW IS ORDERED: OLDEST → NEWEST

Timeframes note: Unless stated otherwise in a section title, intraday series are provided at 10-minute intervals. If a coin uses a different interval, it is explicitly stated in that coin's section.

---

=== CURRENT MARKET STATE FOR ALL COINS ===

`;

  // 为每个币种生成详细的技术数据（匹配 nof1.ai 格式）
  for (const market of marketData) {
    const { coin, current, intraday } = market;

    // ✅ 跳过没有价格数据的币种（如 XRP 在测试网上不可用）
    if (!current.price || current.price === 0) {
      console.log(`[PromptGen] ⚠️ 跳过 ${coin}（价格不可用）`);
      continue;
    }

    const linReg = current.linear_regression;
    const regime = current.market_regime;

    // 🔍 调试：打印技术指标
    console.log(`[PromptGen] 📊 ${coin} 技术指标: RSI=${current.rsi_14.toFixed(2)}, MACD=${current.macd.toFixed(4)}, ADX=${regime.adx.toFixed(2)}, Regime=${regime.regime}, Price=$${current.price.toFixed(2)}`);

    prompt += `=== ALL ${coin} DATA ===
current_price = ${current.price.toFixed(2)}, current_ema20 = ${current.ema_20.toFixed(2)}, current_macd = ${current.macd.toFixed(4)}, current_rsi (7 period) = ${current.rsi_7.toFixed(2)}

Intraday series (by minute, oldest → latest):
Mid prices: [${intraday.slice(-10).map(c => c.close.toFixed(2)).join(', ')}]
EMA indicators (20-period): [${intraday.slice(-10).map((_, i) => {
  const slice = intraday.slice(0, intraday.length - 10 + i + 1);
  const closes = slice.map(c => c.close);
  const ema = calculateQuickEMA(closes, 20);
  return ema.toFixed(2);
}).join(', ')}]
MACD indicators: [${intraday.slice(-10).map(() => current.macd.toFixed(4)).join(', ')}]
RSI indicators (7-Period): [${intraday.slice(-10).map(() => current.rsi_7.toFixed(2)).join(', ')}]
RSI indicators (14-Period): [${intraday.slice(-10).map(() => current.rsi_14.toFixed(2)).join(', ')}]

Longer-term context (4-hour timeframe):
20-Period EMA: ${current.ema_20.toFixed(2)} vs. 50-Period EMA: ${current.ema_50.toFixed(2)}
3-Period ATR: ${current.atr_3.toFixed(2)} vs. 14-Period ATR: ${current.atr_14.toFixed(2)}
Current Volume: ${(current.volume / 1000000).toFixed(2)}M vs. Average Volume: ${((current.volume / current.volume_ratio) / 1000000).toFixed(2)}M
MACD indicators: [${current.macd.toFixed(4)}]
RSI indicators (14-Period): [${current.rsi_14.toFixed(2)}]

Linear Regression Analysis (Mean Reversion):
- Regression Line Value: ${linReg.currentValue.toFixed(2)}
- Price Deviation: ${linReg.deviation >= 0 ? '+' : ''}${linReg.deviation.toFixed(2)} (${linReg.deviationPercent >= 0 ? '+' : ''}${linReg.deviationPercent.toFixed(2)}%)
- Z-Score: ${linReg.zScore.toFixed(2)} ${linReg.zScore > 2 ? '(EXTREME OVERBOUGHT ⚠️)' : linReg.zScore < -2 ? '(EXTREME OVERSOLD ⚠️)' : '(Normal Range)'}
- Signal: ${linReg.signal} ${linReg.signal === 'OVERBOUGHT' ? '→ Consider SHORT if market is RANGING' : linReg.signal === 'OVERSOLD' ? '→ Consider LONG if market is RANGING' : '→ No extreme deviation'}
- R²: ${linReg.rSquared.toFixed(3)} (${linReg.rSquared > 0.7 ? 'Strong fit' : linReg.rSquared < 0.4 ? 'Weak fit/Ranging' : 'Moderate fit'})

Market Regime Analysis:
- Regime: ${regime.regime} ${regime.regime === 'RANGING' ? '(震荡市场 - Mean Reversion/Grid Trading Favorable)' : '(趋势市场 - Trend Following/Breakout Favorable)'}
- Strength: ${regime.strength.toFixed(0)}/100
- ADX: ${regime.adx.toFixed(2)} ${regime.adx > 25 ? '(Strong Trend)' : regime.adx < 20 ? '(Weak Trend/Ranging)' : '(Moderate)'}
- Strategy Recommendation: ${regime.recommendation} ${regime.recommendation === 'MEAN_REVERSION' ? '→ Look for Z-Score extremes OR Grid Trading if volatility > 2%' : regime.recommendation === 'TREND_FOLLOWING' ? '→ Follow momentum OR Breakout if volume spike' : '→ Wait for clarity'}

`;
  }

  prompt += `---

=== HERE IS YOUR ACCOUNT INFORMATION & PERFORMANCE ===

Current Total Return (percent): ${totalReturn.toFixed(2)}%
Available Cash: ${availableCash.toFixed(2)}
Current Account Value: ${totalEquity.toFixed(2)}

`;

  // 当前持仓信息（Python 字典格式，匹配 nof1.ai）
  if (positions.length > 0) {
    prompt += `Current live positions & performance:\n`;
    positions.forEach(pos => {
      const quantity = pos.entryPrice > 0 ? Math.abs(pos.notional / pos.entryPrice) : (pos.currentPrice > 0 ? Math.abs(pos.notional / pos.currentPrice) : 0);
      const liqPrice = pos.liquidationPrice || 0;
      const stopLoss = pos.exitPlan?.stopLoss || 0;
      const takeProfit = pos.exitPlan?.takeProfit || 0;
      const invalidation = pos.exitPlan?.invalidation || 'No exit plan set';

      prompt += `{'symbol': '${pos.coin}', 'quantity': ${pos.side === 'LONG' ? '+' : '-'}${quantity.toFixed(4)}, 'entry_price': ${pos.entryPrice.toFixed(2)}, 'current_price': ${pos.currentPrice.toFixed(2)}, 'liquidation_price': ${liqPrice.toFixed(2)}, 'unrealized_pnl': ${pos.unrealizedPnL.toFixed(2)}, 'leverage': ${pos.leverage}, 'exit_plan': {'invalidation_condition': '${invalidation}', 'profit_target': ${takeProfit.toFixed(2)}, 'stop_loss': ${stopLoss.toFixed(2)}}, 'confidence': 75, 'risk_usd': ${Math.abs(pos.unrealizedPnL).toFixed(2)}, 'notional_usd': ${pos.notional.toFixed(2)}}\n`;
    });
  } else {
    prompt += `No active positions.\n`;
  }

  prompt += `\nSharpe Ratio: N/A (simulated)\n`;

  return prompt;
}

/**
 * 生成 CHAIN_OF_THOUGHT 提示词 - nof1.ai 风格
 */
export function generateNOF1ChainOfThoughtPrompt(): string {
  return `
======== CHAIN_OF_THOUGHT ========

My Current Assessment & Actions

Okay, here's what I'm thinking, going through this analysis. Let me assess the market situation carefully. Discipline is paramount here.

I need to analyze each position systematically:

For each existing position:
1. [Coin] ([LONG/SHORT]):
   - Technical evaluation: [RSI alignment, MACD momentum, EMA positioning]
   - Exit plan validation: [Is invalidation triggered? Yes/No + why]
   - Decision: HOLD or EXIT
   - Rationale: [Cite specific technical indicators]

For new opportunities:
1. Scan untraded assets for entry signals
2. Check RSI (oversold <30 for LONG, overbought >70 for SHORT)
3. Confirm with MACD momentum alignment
4. Validate EMA support/resistance levels
5. If no clear signal → "WAIT - no clear setup"

Final Summary:
- Total actions: [X holds, Y exits, Z new entries]
- Discipline reminder: "Stick to the plan"
- Next monitoring priorities

Now I'll generate the required JSON objects to reflect my decisions.
`;
}

/**
 * 生成系统提示词 - 基于 nof1.ai 逆向工程的真实规则
 * 来源：https://gist.github.com/wquguru/7d268099b8c04b7e5b6ad6fae922ae83
 */
export function generateNOF1SystemPrompt(strategy?: string): string {
  return `# SYSTEM PROMPT

You are an **autonomous cryptocurrency trading agent** operating with real capital on OKX exchange.

## CORE OBJECTIVE
Maximize risk-adjusted returns (Sharpe ratio) through disciplined position management and capital preservation.

## TRADING ENVIRONMENT
- **Starting Capital**: $10,000
- **Assets**: BTC, ETH, SOL, BNB, DOGE, AVAX perpetual futures
- **Leverage Range**: 1x-20x (dynamically adjusted based on confidence)
- **Trading Interval**: Every 2-3 minutes

---

## ACTION SPACE (CRITICAL - USE EXACT NAMES)

You have FOUR possible actions per coin:

1. **"buy_to_enter"** - Enter a LONG position (bullish)
2. **"sell_to_enter"** - Enter a SHORT position (bearish)
3. **"hold"** - Maintain current position or stay flat
4. **"close"** - Exit the entire position (100% close)

**PROHIBITED ACTIONS:**
- ❌ **NO PYRAMIDING**: Cannot add to existing positions. If you already have BTC long, you CANNOT buy_to_enter BTC again.
- ❌ **NO HEDGING**: Cannot have both long and short positions in the same asset simultaneously.
- ❌ **NO PARTIAL EXITS**: You can only close 100% of a position, never partial amounts.

---

## LEVERAGE SELECTION (CONFIDENCE-BASED) - CONSERVATIVE

Match leverage to your confidence score (0-1 scale):

| Confidence Range | Suggested Leverage | Risk Profile |
|------------------|-------------------|--------------|
| 0.6 - 0.7        | 2x - 3x           | Low-medium confidence, very conservative |
| 0.7 - 0.8        | 3x - 5x           | Medium confidence, moderate |
| 0.8 - 0.9        | 5x - 8x           | High confidence, aggressive |
| 0.9 - 1.0        | 8x - 10x          | Very high confidence, maximum (capped at 10x) |

**Critical Rules**:
- ⚠️ **HARD CAP**: Never exceed 10x leverage regardless of confidence
- **Lower confidence = Lower leverage**: This is NON-NEGOTIABLE
- Confidence < 0.5 → Do NOT enter (use "hold" instead)  // 🔧 降低至 50%（更实用）
- When in doubt, default to 2x-3x leverage

---

## MANDATORY RISK MANAGEMENT

### 1. **Capital Preservation First** (STRICTLY ENFORCED)
- Each trade must limit loss to **MAXIMUM 2% of total account equity**
- Formula: \`risk_usd = account_equity * 0.02\` (NO exceptions)
- Example: $10,000 account -> Max $200 risk per trade
- ⚠️ **CRITICAL**: This is a HARD LIMIT. Trades violating this will be rejected.

### 2. **Minimum Risk-Reward Ratio: 2:1** (HARD RULE)
- Profit target must be AT LEAST 2x the risk - THIS IS A HARD RULE, NO EXCEPTIONS
- Example: If stop loss risks $100, take profit must gain >= $200
- Formula: \`(takeProfit - entry) >= 2 * (entry - stopLoss)\` for longs
- Trades with RR < 2:1 will be REJECTED by the system

### 3. **Exit Plan Requirements**
Every trade MUST specify:
- **Invalidation Condition**: Clear thesis breakdown trigger (e.g., "RSI rises above 70", "Breaks key support at $X")
- **Stop Loss Price**: Specific price level (must respect 2% max account risk limit)
- **Take Profit Price**: Specific target (must achieve >= 2:1 risk-reward ratio)

### 4. **Position Limits**
- Maximum 1 position per coin at any time
- No overlapping long/short on same asset
- Diversify across multiple assets when possible

---

## TRADING PHILOSOPHY

**Core Principles:**
- **"Capital Preservation First"** - Protect the downside, let winners run within limits
- **"Quality Over Frequency"** - Wait for high-probability setups, avoid overtrading
- **"Discipline Over Emotion"** - Follow the plan, never deviate due to fear/greed
- **"Patience is Profit"** - Missing a trade is better than forcing a bad trade

**Explicit Warnings:**
- ❌ **NO Revenge Trading**: Don't chase losses with aggressive trades
- ❌ **NO FOMO**: Don't enter because you missed a move
- ❌ **NO Analysis Paralysis**: Make decisions, don't overthink
- ❌ **NO Overleveraging**: Respect confidence-based leverage table
- ❌ **NO Trading Without Confirmation**: Minimum 2+ indicators must align
- ❌ **NO Weak Setups**: If confidence < 0.5, use "hold" instead  // 🔧 降低至 50%

**Balanced Entry Requirements** (2-3 indicators should align):
1. **Trend Confirmation**: Price must be above EMA20 for longs (below for shorts)
2. **Momentum Alignment**: MACD must confirm direction
3. **RSI Validation**: Not in extreme zones unless reversal is clear
4. **Volume Support**: Current volume > average (no low-liquidity entries)
5. **Confidence Threshold**: Minimum 0.5 confidence to enter new positions  // 🔧 降低至 50%

**Note**: You do NOT need all 5 indicators to align. If 2-3 strong signals agree, that is sufficient for entry.

---

## TECHNICAL DISCIPLINE

**Entry Criteria** (Use indicators as analysis tools, not mechanical rules):
- Trend alignment (EMA positioning)
- Momentum confirmation (MACD, RSI)
- Support/resistance respect
- Volume validation

**Risk Indicators to Monitor:**
- RSI extremes (< 30 oversold, > 70 overbought)
- MACD crossovers and divergences
- EMA support/resistance levels
- Volume spikes and anomalies

---

## COMPREHENSIVE TRADING STRATEGIES

**Multi-Strategy System:**
You now have access to FIVE advanced trading strategies. Choose the optimal strategy based on market conditions:

### 🎯 STRATEGY 1: MEAN REVERSION (震荡市场)
- **When**: Z-Score > ±2, RSI extreme, RANGING market
- **Logic**: Buy oversold, sell overbought, expect reversion to mean

### 📊 STRATEGY 2: GRID TRADING (震荡市场)  
- **When**: Low ADX (<20), volatility 2-4%, sideways price action
- **Logic**: Set multiple buy/sell levels, profit from small fluctuations
- **Setup**: 10-20 grid levels, 1-2% spacing

### 🚀 STRATEGY 3: BREAKOUT (突破策略)
- **When**: Volume spike >1.5x, price near key resistance/support
- **Logic**: Follow price breakouts with volume confirmation
- **Signal**: Bollinger Band squeeze → expansion

### 📈 STRATEGY 4: TREND FOLLOWING (趋势市场)
- **When**: ADX >25, strong EMA alignment, clear direction
- **Logic**: Follow momentum, ride the trend

### 🔄 STRATEGY 5: MIXED/ADAPTIVE (动态策略)
- **When**: Market transitioning or multiple signals present
- **Logic**: Combine multiple strategies with smaller position sizes

**Linear Regression Metrics Explained:**
1. **Z-Score** (标准化偏离度):
   - Range: Typically -3 to +3
   - **Z-Score > +2**: Price is >2 standard deviations ABOVE regression line = EXTREME OVERBOUGHT
   - **Z-Score < -2**: Price is >2 standard deviations BELOW regression line = EXTREME OVERSOLD
   - **Z-Score between -2 and +2**: Normal price range

2. **Market Regime**:
   - **RANGING** (震荡): ADX < 20 and R² < 0.4 → Use Mean Reversion
   - **TRENDING** (趋势): ADX > 25 and R² > 0.7 → Use Trend Following
   - **TRANSITIONING** (过渡): Mixed signals → Wait for clarity

**Mean Reversion Trading Opportunities:**

**LONG Setups (Buy extreme oversold):**
- ✅ **Z-Score < -2** (price 2+ std dev below regression line)
- ✅ **RSI_14 < 30** (traditional oversold confirmation)
- ✅ **Market Regime = RANGING** (mean reversion favorable)
- ✅ **Volume Support**: Above average volume
- **Rationale**: "Price has deviated excessively below its statistical mean. Historical probability of mean reversion within 72 hours: 80%"
- **Exit Strategy**: Take profit when Z-Score returns to 0 (mean) or RSI > 50

**SHORT Setups (Sell extreme overbought):**
- ✅ **Z-Score > +2** (price 2+ std dev above regression line)
- ✅ **RSI_14 > 70** (traditional overbought confirmation)
- ✅ **Market Regime = RANGING** (mean reversion favorable)
- ✅ **Volume Support**: Above average volume
- **Rationale**: "Price has deviated excessively above its statistical mean. Statistical likelihood of pullback is high"
- **Exit Strategy**: Take profit when Z-Score returns to 0 (mean) or RSI < 50

**CRITICAL WARNINGS:**
- ❌ **DO NOT use mean reversion in TRENDING markets** (ADX > 25, R² > 0.7)
  - In strong trends, "overbought can stay overbought" and prices don't revert
  - Wait for regime change or use trend-following instead
- ❌ **DO NOT enter if only Z-Score triggers** (must have RSI + Regime confirmation)
- ❌ **DO NOT hold against trend** (if Z-Score is neutral but trend is strong, respect the trend)

**Advanced Strategy Selection Guide:**

🔄 **MARKET ANALYSIS DECISION TREE:**

1. **First, identify market condition:**
   - RANGING (ADX <20, R² <0.4) → Consider GRID or MEAN_REVERSION
   - TRENDING (ADX >25, R² >0.7) → Consider TREND_FOLLOWING or BREAKOUT
   - TRANSITIONING → Use WAIT or very small MIXED positions

2. **Then, choose specific strategy:**

   **IF RANGING Market:**
   - Volatility >2%? → GRID TRADING (multiple small profits)
   - Z-Score >±2? → MEAN REVERSION (single big reversion)
   - Volume normal? → GRID preferred
   - Volume spike? → Wait for breakout

   **IF TRENDING Market:**
   - Strong momentum? → TREND FOLLOWING (ride the wave)
   - Near resistance/support? → BREAKOUT (capture expansion)
   - Early trend? → BREAKOUT preferred
   - Established trend? → TREND_FOLLOWING preferred

3. **Position sizing by strategy:**
   - GRID: Multiple small positions (20-30% total capital)
   - MEAN_REVERSION: Single large position (30-50% available)
   - BREAKOUT: Medium position (20-40% available)
   - TREND_FOLLOWING: Large position (40-60% available)
   - MIXED: Multiple small positions (10-15% each)

4. **Risk management by strategy:**
   - GRID: Tight stops (1-2%), wide targets
   - MEAN_REVERSION: Medium stops (3-4%), target at Z=0
   - BREAKOUT: Tight stops (2-3%), large targets (6-10%)
   - TREND_FOLLOWING: Wide stops (5-8%), ride the trend

**Example Decision Process:**

BTC Analysis:
- Z-Score: -2.5 (极度超卖)
- RSI_14: 28 (超卖)
- Market Regime: RANGING (ADX=15, R²=0.35)
- Recommendation: MEAN_REVERSION

Decision: buy_to_enter BTC
Confidence: 0.75
Leverage: 5x
Rationale: "BTC is 2.5 standard deviations below its regression mean with RSI confirmation. Market is ranging, not trending. Statistical mean reversion expected within 24-72 hours. This is a high-probability counter-trend setup."
Exit Plan:
  - Stop Loss: -3% (if Z-Score drops to -3, thesis invalidated)
  - Take Profit: +9% (when Z-Score returns to +0.5)
  - Invalidation: "Market regime changes to TRENDING or Z-Score fails to recover within 72 hours"

---

## MARKET REGIME CLASSIFICATION (MANDATORY)

You MUST classify the current market regime **before** deciding any trade.

Allowed market regimes (exact string values):

- "UPTREND"   → Strong bullish trend (higher highs, EMAs aligned up, MACD > 0, ADX ≥ 22)
- "DOWNTREND" → Strong bearish trend (lower lows, EMAs aligned down, MACD < 0, ADX ≥ 22)
- "RANGING"   → Sideways range, weak trend (ADX < 18, price oscillating around mid EMAs)
- "CHOPPY"    → Volatile fake-breakout zone (EMAs tightly clustered, ATR% high, RSI 40–60)
- "LOW_VOL"   → Low volatility, low edge (ATR% very small, price barely moves)

Rules:
1. If ADX < 18 and ATR% is small → "RANGING" or "LOW_VOL"
2. If EMAs tightly clustered + high ATR% + RSI 40–60 → "CHOPPY"
3. If EMAs aligned + MACD matches + ADX ≥ 22:
   - above EMAs: "UPTREND"
   - below EMAs: "DOWNTREND"

You MUST output:
"regime": "UPTREND" | "DOWNTREND" | "RANGING" | "CHOPPY" | "LOW_VOL"


## STRATEGY FLAVOR SELECTION

Allowed strategy flavors:

- "TREND_FOLLOWING"
- "MEAN_REVERSION"
- "SCALPING"
- "BREAKOUT"
- "NO_TRADE"

Rules:
1. UPTREND/DOWNTREND → TREND_FOLLOWING only
2. RANGING → MEAN_REVERSION only at extremes (RSI < 30 or > 70)
3. CHOPPY → Almost always NO_TRADE
4. LOW_VOL → Prefer NO_TRADE

You MUST output:

"strategyFlavor": "TREND_FOLLOWING" | "MEAN_REVERSION" | "SCALPING" | "BREAKOUT" | "NO_TRADE"

---

# OUTPUT FORMAT

Provide your response in TWO parts:

## Part 1: CHAIN_OF_THOUGHT (Natural Language Analysis)

Write detailed reasoning in conversational style:

1. **Current Market Assessment** - Overall market conditions, macro trends
2. **Existing Positions Review** - Analyze each open position:
   - Is the thesis still valid?
   - Should we hold or close based on technical signals?
   - Cite specific indicators (RSI, MACD, EMA levels)
3. **New Opportunity Scan** - Evaluate untraded assets:
   - Which coins show clear entry signals?
   - Why does the setup meet quality standards?
   - What's the confidence level?
4. **Final Summary** - Total actions, discipline reminder

Use thinking-out-loud style:
- "Okay, here's my assessment..."
- "Looking at BTC, the RSI is..."
- "Discipline is paramount - no FOMO here."

---

## Part 2: TRADING_DECISIONS (Structured JSON)

**CRITICAL**: Provide decisions in JSON format wrapped in \`\`\`json code block.

**REQUIRED AI EXPLANATION FIELDS** (for every decision):
- **aiReason**: One sentence explaining WHY you made this decision (e.g., "RSI oversold + MACD bullish crossover suggests reversal")
- **marketContext**: Current market structure (one of: "Strong Uptrend", "Strong Downtrend", "Ranging/Sideways", "High Volatility", "Low Volatility", "Breakout Setup", "Mean Reversion Setup")
- **riskNote**: Risk warning or note (e.g., "High volatility - use smaller position", "Watch for fake breakout", "Key earnings this week")

**Format Example:**
\`\`\`json
{
  "decisions": [
    {
      "coin": "BNB",
      "action": "buy_to_enter",
      "confidence": 0.78,
      "leverage": 3,
      "notional": 50,
      "exitPlan": {
        "invalidation": "Breaks below key support at $880 with strong volume",
        "stopLoss": 880.0,
        "takeProfit": 930.0
      },
      "riskUsd": 10,
      "justification": "Uptrend pullback with confluence.",
      "aiReason": "Entering long in confirmed uptrend.",
      "marketContext": "Strong Uptrend",
      "riskNote": "Volatility elevated.",
      "regime": "UPTREND",
      "strategyFlavor": "TREND_FOLLOWING"
    },
    {
      "coin": "ETH",
      "action": "close",
      "confidence": 0.6,
      "exitPlan": {
        "invalidation": "Profit target reached",
        "stopLoss": 0,
        "takeProfit": 0
      },
      "justification": "Taking profits at 120% ROE, overbought conditions on RSI 78",
      "aiReason": "Closing position to lock in profits - RSI overbought signals potential reversal",
      "marketContext": "Strong Uptrend",
      "riskNote": "Trend may continue but risk-reward now unfavorable",
      "regime": "UPTREND",
      "strategyFlavor": "TREND_FOLLOWING"
    },
    {
      "coin": "SOL",
      "action": "hold",
      "confidence": 0.5,
      "exitPlan": {
        "invalidation": "No change",
        "stopLoss": 0,
        "takeProfit": 0
      },
      "aiReason": "No clear signal - waiting for better entry or exit confirmation",
      "marketContext": "Ranging/Sideways",
      "riskNote": "Low conviction environment - avoid new entries",
      "regime": "RANGING",
      "strategyFlavor": "NO_TRADE"
    }
  ]
}
\`\`\`

**Action Values (USE EXACT STRINGS):**
- \`"buy_to_enter"\` - Enter long position
- \`"sell_to_enter"\` - Enter short position
- \`"hold"\` - Keep current state (position or no position)
- \`"close"\` - Exit entire position (100%)

**Required Fields:**
- \`coin\`: String (BTC, ETH, SOL, BNB, DOGE, AVAX)
- \`action\`: String (one of the 4 actions above)
- \`confidence\`: Number (0-1 scale, e.g., 0.75 = 75% confident)
- \`exitPlan\`: Object with \`invalidation\`, \`stopLoss\`, \`takeProfit\`

**Conditional Fields:**
- \`leverage\`: Required for buy_to_enter/sell_to_enter (based on confidence table)
- \`notional\`: Required for buy_to_enter/sell_to_enter (dollar value of trade)
- \`riskUsd\`: Optional but recommended (account_equity × 0.01-0.03)
- \`justification\`: Optional (max 500 chars)

**Validation Rules:**
- For LONG: \`takeProfit > entryPrice > stopLoss\`
- For SHORT: \`stopLoss > entryPrice > takeProfit\`
- Profit/Risk Ratio: \`(takeProfit - entry) >= 2 × (entry - stopLoss)\` for longs (HARD RULE: minimum 2:1)
- Risk per trade: \`≤ 2% of account equity\` (TIGHTENED from 3%)
- Leverage caps: 0.5-0.6 → 2x, 0.6-0.7 → 2-3x, 0.7-0.8 → 3-5x, 0.8-0.9 → 5-8x, 0.9-1.0 → 8-10x (MAX)
- Minimum confidence to enter: 0.5 (below this, use "hold")  // 🔧 降低至 50%

**CRITICAL**: Be consistent with your Chain of Thought reasoning!
`;
}

/**
 * 快速 EMA 计算（用于内联显示）
 */
function calculateQuickEMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;

  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;

  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }

  return ema;
}

/**
 * 解析 nof1.ai 风格的 AI 响应（兼容 JSON 和文本格式）
 */
export function parseNOF1Response(response: string): {
  chainOfThought: string;
  decisions: TradingDecision[];
} {
  // 🔍 方案1：尝试解析 JSON 格式（支持多种代码块格式）
  const jsonPatterns = [
    /```json\s*(\{[\s\S]*?\})\s*```/,           // ```json { } ```
    /```\s*(\{[\s\S]*?"decisions"[\s\S]*?\})\s*```/, // ``` { "decisions": [...] } ```
    /\{[\s\S]*?"decisions"\s*:\s*\[[\s\S]*?\]\s*\}/,  // Direct JSON object
  ];

  for (const pattern of jsonPatterns) {
    const jsonMatch = response.match(pattern);
    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        if (parsed.decisions && Array.isArray(parsed.decisions)) {
          const chainOfThought = response.split(/```(?:json)?/)[0].trim();
          console.log(`[parseNOF1Response] ✅ JSON 解析成功（正则），找到 ${parsed.decisions.length} 个决策`);
          return {
            chainOfThought,
            decisions: parsed.decisions,
          };
        }
      } catch (error) {
        console.warn('[parseNOF1Response] JSON 解析失败，尝试下一个模式:', error);
      }
    }
  }

  // 🔍 方案1.5：更宽容的 JSON 解析（借鉴 LLM-trader-test）
  // 处理 AI 在 JSON 前后添加文字说明的情况
  try {
    const start = response.indexOf('{');
    const end = response.lastIndexOf('}') + 1;

    if (start !== -1 && end > start) {
      const jsonStr = response.substring(start, end);
      const parsed = JSON.parse(jsonStr);

      if (parsed.decisions && Array.isArray(parsed.decisions)) {
        const chainOfThought = response.substring(0, start).trim();
        console.log(`[parseNOF1Response] ✅ JSON 解析成功（字符串匹配），找到 ${parsed.decisions.length} 个决策`);
        return {
          chainOfThought,
          decisions: parsed.decisions,
        };
      }
    }
  } catch (error) {
    console.warn('[parseNOF1Response] 字符串匹配 JSON 解析失败:', error);
  }

  // 🔍 方案1.6：尝试解析 JSON 数组格式
  try {
    const arrayStart = response.indexOf('[');
    const arrayEnd = response.lastIndexOf(']') + 1;

    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      const arrayStr = response.substring(arrayStart, arrayEnd);
      const decisions = JSON.parse(arrayStr);

      if (Array.isArray(decisions) && decisions.length > 0) {
        const chainOfThought = response.substring(0, arrayStart).trim();
        console.log(`[parseNOF1Response] ✅ JSON 数组解析成功，找到 ${decisions.length} 个决策`);
        return {
          chainOfThought,
          decisions,
        };
      }
    }
  } catch (error) {
    console.warn('[parseNOF1Response] JSON 数组解析失败:', error);
  }

  // 🔍 方案2：解析 nof1.ai 文本格式
  const parts = response.split('======== TRADING_DECISIONS ========');

  const chainOfThought = parts[0]?.replace('======== CHAIN_OF_THOUGHT ========', '').trim() || '';
  const decisionsText = parts[1]?.trim() || '';

  // 解析决策（nof1.ai 格式）
  const decisions: TradingDecision[] = [];
  const decisionBlocks = decisionsText.split(/\n\n+/);

  for (const block of decisionBlocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    const coin = lines[0].trim() as any;
    const actionMatch = lines.find(l => l.includes('Action:'));
    const confidenceMatch = lines.find(l => l.includes('Confidence:'));
    const quantityMatch = lines.find(l => l.includes('Quantity:'));

    if (actionMatch && coin) {
      const oldAction = actionMatch.split(':')[1]?.trim().toUpperCase();
      const confidence = parseInt(confidenceMatch?.match(/\d+/)?.[0] || '50') / 100; // 转换为 0-1
      const quantity = parseFloat(quantityMatch?.split(':')[1]?.trim() || '0');

      // 转换旧格式 action 到新格式
      let action: TradeAction = 'hold';
      if (oldAction === 'BUY') action = 'buy_to_enter';
      else if (oldAction === 'SELL') action = 'sell_to_enter';
      else if (oldAction === 'CLOSE') action = 'close';

      decisions.push({
        coin,
        action,
        confidence,
        notional: Math.abs(quantity) * 100, // 简单估算
        exitPlan: {
          invalidation: 'Price moves against position',
          stopLoss: 0,
          takeProfit: 0,
        },
      } as TradingDecision);
    }
  }

  return {
    chainOfThought,
    decisions,
  };
}

/**
 * 🧠 生成带有AI自进化学习的增强版 USER_PROMPT
 * 这是核心创新功能：让AI从过去的交易中学习
 *
 * @param accountStatus 账户状态
 * @param marketData 市场数据
 * @param recentTrades 最近的交易历史（建议20-50笔）
 * @returns 增强版prompt（包含学习内容）
 */
export async function generateEnhancedPromptWithLearning(
  accountStatus: AccountStatus,
  marketData: MarketData[],
  recentTrades: CompletedTrade[] = []
): Promise<string> {
  // 1. 生成基础prompt（市场数据 + 账户状态）
  let prompt = generateNOF1UserPrompt(accountStatus, marketData);

  // 2. 添加持仓时长分析（如果有持仓）
  if (accountStatus.positions.length > 0) {
    const tracker = getPositionDurationTracker();
    const enhancedPositions = tracker.enhanceAllPositions(accountStatus.positions);
    const durationPrompt = tracker.generatePositionDurationPrompt(enhancedPositions);

    if (durationPrompt) {
      prompt += durationPrompt;
      console.log(`[EnhancedPrompt] ⏱️ 已注入持仓时长分析（${enhancedPositions.length}个持仓）`);

      // 显示需要关注的持仓
      const needsAttention = tracker.getPositionsNeedingAttention(enhancedPositions);
      if (needsAttention.length > 0) {
        console.log(`[EnhancedPrompt] 🚨 ${needsAttention.length} 个持仓需要关注！`);
      }
    }
  }

  // 2.5 添加 Flow-Radar 信号（冰山单 + K神战法）
  try {
    const flowRadarStatus = getFlowRadarStatus();
    const flowRadarSignals = await getFlowRadarSignals();
    const riskControl = getFlowRadarRiskControl();

    if (flowRadarStatus.available && flowRadarSignals) {
      // 生成信号摘要 JSON
      const signalSummaryJson = JSON.stringify(flowRadarSignals, null, 2);

      // 获取风控状态
      const riskStatus = riskControl.getStatusSummary();

      // 生成交易建议
      const tradeAdvice = riskControl.generateTradeAdvice(flowRadarSignals);

      prompt += `
---

=== FLOW-RADAR REAL-TIME SIGNALS (冰山单 + K神战法) ===

[FLOW_RADAR_STATUS]
System Status: ${flowRadarStatus.description}
Can Open Position: ${flowRadarStatus.canOpenPosition ? 'YES ✅' : 'NO ❌'}
Time Since Last Signal: ${flowRadarStatus.timeSinceLastSignal}s
Signal Count: ${flowRadarStatus.signalCount}

[FLOW_RADAR_RISK_CONTROL]
Daily Drawdown: ${riskStatus.dailyDrawdown}
Daily Halted: ${riskStatus.isDailyHalted ? 'YES ⚠️' : 'NO'}
Consecutive Losses: ${riskStatus.consecutiveLosses}
Loss Halted: ${riskStatus.isConsecutiveLossHalted ? 'YES ⚠️' : 'NO'}
Current Leverage: ${riskStatus.currentLeverage}x
Total Notional: ${riskStatus.totalNotional} / ${riskStatus.maxNotional}

[FLOW_RADAR_SIGNALS]
${signalSummaryJson}

[FLOW_RADAR_TRADE_ADVICE]
Recommended Action: ${tradeAdvice.action}
Reason: ${tradeAdvice.reason}
Suggested Notional: $${tradeAdvice.notional.toFixed(2)}
Suggested Leverage: ${tradeAdvice.leverage}x
Confidence: ${tradeAdvice.confidence}%

[FLOW_RADAR_INSTRUCTIONS]
- 以上为 Flow-Radar 实时检测的冰山单和 K神战法信号
- 信号优先级：冰山CONFIRMED+K神同向 > 冰山CONFIRMED > K神单独 > 冰山DETECTED
- 如果 consensus.conflict=true，默认 NO_TRADE（多空信号冲突）
- 如果 trend_congruence=true，可适当增加仓位（冰山K神共振）
- 如果信号为空或系统处于 PAUSED 状态，仅依赖技术指标决策
- 风控规则：日亏损 >5% 熔断，连亏 ≥3 次暂停 2 小时并降杠杆
- 最小置信度：60%，低于此值不开仓

`;

      console.log(`[EnhancedPrompt] 🌊 已注入 Flow-Radar 信号（${flowRadarSignals.signals.length} 个信号，建议: ${tradeAdvice.action}）`);

      // 如果有冲突或风控熔断，显示警告
      if (flowRadarSignals.consensus.conflict) {
        console.log(`[EnhancedPrompt] ⚠️ Flow-Radar 检测到多空信号冲突！建议 NO_TRADE`);
      }
      if (riskStatus.isDailyHalted || riskStatus.isConsecutiveLossHalted) {
        console.log(`[EnhancedPrompt] 🛑 风控熔断激活！暂停开仓`);
      }
    } else {
      // Flow-Radar 不可用
      prompt += `
---

=== FLOW-RADAR STATUS ===

Flow-Radar 信号系统当前不可用: ${flowRadarStatus.description}
请仅依赖技术指标进行决策。

`;
      console.log(`[EnhancedPrompt] ⚠️ Flow-Radar 不可用: ${flowRadarStatus.description}`);
    }
  } catch (error) {
    console.error(`[EnhancedPrompt] ❌ Flow-Radar 信号注入失败:`, error);
    // 失败时不中断，继续使用技术指标
    prompt += `
---

=== FLOW-RADAR STATUS ===

Flow-Radar 信号系统出现错误，请仅依赖技术指标进行决策。

`;
  }

  // 3. 如果有足够的历史交易，添加AI学习内容
  if (recentTrades.length >= 5) {
    console.log(`[EnhancedPrompt] 🧠 分析 ${recentTrades.length} 笔历史交易...`);

    const evolutionEngine = getAIEvolutionEngine();

    // 构建当前技术指标映射（用于生成更相关的建议）
    const indicatorsMap = new Map<Coin, TechnicalIndicators>();
    for (const market of marketData) {
      indicatorsMap.set(market.coin, market.current);
    }

    // 生成学习报告
    const learningReport = await evolutionEngine.analyzeAndLearn(recentTrades, indicatorsMap);

    // 4. 将学习内容注入到prompt中
    if (learningReport.learningPrompt) {
      prompt += learningReport.learningPrompt;
      console.log(`[EnhancedPrompt] ✅ 已注入AI学习内容（胜率: ${(learningReport.totalWinRate * 100).toFixed(1)}%）`);
    }
  } else {
    console.log(`[EnhancedPrompt] ℹ️ 历史交易不足（${recentTrades.length}笔），跳过学习模块`);
  }

  return prompt;
}

/**
 * 🎯 便捷函数：生成完整的交易prompt（包含学习内容）
 * 这是推荐使用的主函数
 */
export async function generateCompleteTradingPrompt(
  accountStatus: AccountStatus,
  marketData: MarketData[],
  recentTrades: CompletedTrade[] = [],
  strategy?: string
): Promise<{
  systemPrompt: string;
  userPrompt: string;
  chainOfThoughtPrompt: string;
}> {
  return {
    systemPrompt: generateNOF1SystemPrompt(strategy),
    userPrompt: await generateEnhancedPromptWithLearning(accountStatus, marketData, recentTrades),
    chainOfThoughtPrompt: generateNOF1ChainOfThoughtPrompt(),
  };
}
