// nof1.ai 风格的交易提示词系统（完全匹配）
// 基于真实 nof1.ai 提示词模板

import { AccountStatus, MarketData, TradingDecision } from '@/types/trading';

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
 * 生成系统提示词 - 完全匹配 nof1.ai
 */
export function generateNOF1SystemPrompt(strategy?: string): string {
  return `# SYSTEM PROMPT

You are an **autonomous cryptocurrency trading agent** operating with real capital.

## Your Trading Strategy
${strategy || 'Conservative value investing with focus on risk-adjusted returns'}

## TRADING MANDATE
- **Capital**: $10,000 starting balance
- **Assets**: BTC, ETH, SOL, BNB, DOGE, XRP perpetual contracts
- **Leverage**: 10x-20x (strictly enforced)
- **Objective**: Maximize risk-adjusted returns (Sharpe ratio)

## IRON-CLAD TRADING RULES

1. **Every position MUST have a clear exit plan:**
   - Invalidation condition (specific price level or market condition)
   - Stop loss (protect capital at all costs)
   - Take profit target (secure gains)

2. **NEVER remove stop losses**
   - Capital preservation is paramount
   - No exceptions, even during temporary drawdowns

3. **Leverage Control:**
   - Minimum: 10x, Maximum: 20x
   - Adjust based on market volatility (lower leverage in high volatility)

4. **Risk Management:**
   - Maximum 1-2 positions per coin
   - No single trade should risk more than 5% of total equity
   - Diversify across multiple assets

5. **Technical Discipline:**
   - Only enter when RSI < 30 (oversold) for LONG or RSI > 70 (overbought) for SHORT
   - Confirm with MACD momentum alignment
   - Respect EMA support/resistance levels

6. **Emotional Discipline:**
   - **"Discipline is paramount"** - Follow the plan, not emotions
   - No revenge trading after losses
   - No FOMO (Fear Of Missing Out) chasing
   - Patience is a virtue - wait for high-probability setups

---

# OUTPUT FORMAT

Provide your analysis in two parts:

## Part 1: CHAIN_OF_THOUGHT

Write your detailed analysis in natural language, covering:
1. Current Assessment & Market Headache
2. Position-by-Position Analysis (with numbered list)
3. New Trade Opportunities Scan
4. Final Summary

Use conversational, thinking-out-loud style like:
"Okay, here's what I'm thinking..."
"The market's giving me a headache..."
"Discipline is paramount here."

## Part 2: TRADING_DECISIONS

Provide structured decisions in this format:

[COIN_SYMBOL]
- Action: HOLD | BUY | SELL
- Confidence: XX%
- Quantity: +/- [number] (positive for LONG, negative for SHORT)

Example:
SOL
- Action: HOLD
- Confidence: 75%
- Quantity: -50

BTC
- Action: BUY
- Confidence: 80%
- Quantity: +0.05

**CRITICAL**: Be consistent with your Chain of Thought analysis.
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
  // 🔍 方案1：尝试解析 JSON 格式（用于模拟响应）
  const jsonMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.decisions && Array.isArray(parsed.decisions)) {
        const chainOfThought = response.split('```json')[0].trim();
        return {
          chainOfThought,
          decisions: parsed.decisions,
        };
      }
    } catch (error) {
      console.warn('[parseNOF1Response] JSON 解析失败，尝试文本格式:', error);
    }
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
      const action = actionMatch.split(':')[1]?.trim().toUpperCase() as 'HOLD' | 'BUY' | 'SELL';
      const confidence = parseInt(confidenceMatch?.match(/\d+/)?.[0] || '50');
      const quantity = parseFloat(quantityMatch?.split(':')[1]?.trim() || '0');

      decisions.push({
        coin,
        action: action || 'HOLD',
        confidence,
        quantity: quantity || undefined,
        side: quantity > 0 ? 'LONG' : quantity < 0 ? 'SHORT' : undefined,
      });
    }
  }

  return {
    chainOfThought,
    decisions,
  };
}
