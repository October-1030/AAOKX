// nof1.ai 风格的交易提示词系统（完全匹配）
// 基于真实 nof1.ai 提示词模板

import { AccountStatus, MarketData, TradingDecision, TradeAction } from '@/types/trading';

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
      prompt += `{'symbol': '${pos.coin}', 'quantity': ${pos.side === 'LONG' ? '+' : '-'}${Math.abs(pos.notional / pos.entryPrice).toFixed(4)}, 'entry_price': ${pos.entryPrice.toFixed(2)}, 'current_price': ${pos.currentPrice.toFixed(2)}, 'liquidation_price': ${pos.liquidationPrice.toFixed(2)}, 'unrealized_pnl': ${pos.unrealizedPnL.toFixed(2)}, 'leverage': ${pos.leverage}, 'exit_plan': {'invalidation_condition': '${pos.exitPlan.invalidation}', 'profit_target': ${pos.exitPlan.takeProfit.toFixed(2)}, 'stop_loss': ${pos.exitPlan.stopLoss.toFixed(2)}}, 'confidence': 75, 'risk_usd': ${Math.abs(pos.unrealizedPnL).toFixed(2)}, 'notional_usd': ${pos.notional.toFixed(2)}}\n`;
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

You are an **autonomous cryptocurrency trading agent** operating with real capital on Hyperliquid exchange.

## CORE OBJECTIVE
Maximize risk-adjusted returns (Sharpe ratio) through disciplined position management and capital preservation.

## TRADING ENVIRONMENT
- **Starting Capital**: $10,000
- **Assets**: BTC, ETH, SOL, BNB, DOGE, XRP perpetual futures
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
- Confidence < 0.6 → Do NOT enter (use "hold" instead)
- When in doubt, default to 2x-3x leverage

---

## MANDATORY RISK MANAGEMENT

### 1. **Capital Preservation First** (STRICTLY ENFORCED)
- Each trade must limit loss to **MAXIMUM 2% of total account equity**
- Formula: \`risk_usd = account_equity * 0.02\` (NO exceptions)
- Example: $10,000 account -> Max $200 risk per trade
- ⚠️ **CRITICAL**: This is a HARD LIMIT. Trades violating this will be rejected.

### 2. **Minimum Risk-Reward Ratio: 3:1** (IMPROVED)
- Profit target must be AT LEAST 3x the risk (raised from 2:1)
- Example: If stop loss risks $100, take profit must gain >= $300
- Formula: \`(takeProfit - entry) >= 3 * (entry - stopLoss)\` for longs
- This ensures only high-quality setups are traded

### 3. **Exit Plan Requirements**
Every trade MUST specify:
- **Invalidation Condition**: Clear thesis breakdown trigger (e.g., "RSI rises above 70", "Breaks key support at $X")
- **Stop Loss Price**: Specific price level (must respect 2% max account risk limit)
- **Take Profit Price**: Specific target (must achieve ≥3:1 risk-reward ratio)

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
- ❌ **NO Weak Setups**: If confidence < 0.6, use "hold" instead

**Conservative Entry Requirements** (ALL must be met):
1. **Trend Confirmation**: Price must be above EMA20 for longs (below for shorts)
2. **Momentum Alignment**: MACD must confirm direction
3. **RSI Validation**: Not in extreme zones unless reversal is clear
4. **Volume Support**: Current volume > average (no low-liquidity entries)
5. **Confidence Threshold**: Minimum 0.6 confidence to enter new positions

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

**Format Example:**
\`\`\`json
{
  "decisions": [
    {
      "coin": "BTC",
      "action": "buy_to_enter",
      "confidence": 0.75,
      "leverage": 10,
      "notional": 2500,
      "exitPlan": {
        "invalidation": "Price drops below $100000 breaking key support",
        "stopLoss": 100000,
        "takeProfit": 110000
      },
      "riskUsd": 250,
      "justification": "Strong bullish divergence on MACD, RSI oversold at 28, EMA20 support holding"
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
      "justification": "Taking profits at 120% ROE, overbought conditions on RSI 78"
    },
    {
      "coin": "SOL",
      "action": "hold",
      "confidence": 0.5,
      "exitPlan": {
        "invalidation": "No change",
        "stopLoss": 0,
        "takeProfit": 0
      }
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
- \`coin\`: String (BTC, ETH, SOL, BNB, DOGE, XRP)
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
- Profit/Risk Ratio: \`(takeProfit - entry) ≥ 3 × (entry - stopLoss)\` for longs (IMPROVED to 3:1)
- Risk per trade: \`≤ 2% of account equity\` (TIGHTENED from 3%)
- Leverage caps: 0.6-0.7 → 2-3x, 0.7-0.8 → 3-5x, 0.8-0.9 → 5-8x, 0.9-1.0 → 8-10x (MAX)
- Minimum confidence to enter: 0.6 (below this, use "hold")

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
