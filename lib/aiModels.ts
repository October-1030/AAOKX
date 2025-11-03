// AI模型集成器

import { callDeepSeek } from './deepseekClient';

export interface AIModel {
  name: string;
  displayName: string;
  provider: string;
  strategy: string;
  callAPI: (systemPrompt: string, userPrompt: string) => Promise<string>;
}

/**
 * 模拟AI响应（用于演示）
 */
async function simulateAIResponse(
  modelName: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  // 解析用户提示词中的市场数据
  const btcPriceMatch = userPrompt.match(/### BTC[\s\S]*?Price: \$(\d+\.?\d*)/);
  const btcPrice = btcPriceMatch ? parseFloat(btcPriceMatch[1]) : 67000;

  // 根据不同模型生成不同风格的响应
  const responses: Record<string, string> = {
    'deepseek-v3': generateDeepSeekResponse(btcPrice),
    'claude-4.5': generateClaudeResponse(btcPrice),
    'gpt-5': generateGPTResponse(btcPrice),
    'gemini-2.5': generateGeminiResponse(btcPrice),
    'qwen-3': generateQwenResponse(btcPrice),
    'grok-4': generateGrokResponse(btcPrice),
  };

  // 模拟API延迟
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

  return responses[modelName] || responses['claude-4.5'];
}

function generateDeepSeekResponse(btcPrice: number): string {
  // DeepSeek 有50%概率进行交易（演示模式）
  const shouldTrade = Math.random() > 0.5;
  const ethPrice = btcPrice * 0.035; // 近似 ETH/BTC 比例

  if (shouldTrade) {
    const coins = ['BTC', 'ETH', 'SOL'];
    const chosenCoin = coins[Math.floor(Math.random() * coins.length)];
    const side = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const leverage = 12 + Math.floor(Math.random() * 7); // 12-18x
    const price = chosenCoin === 'BTC' ? btcPrice : (chosenCoin === 'ETH' ? ethPrice : 183);

    return `## 1. Overall Assessment

Identifying a high-probability setup in ${chosenCoin}. Market conditions favor ${side === 'LONG' ? 'bullish' : 'bearish'} positioning with clear risk management.

## 3. New Opportunity Scan

**${chosenCoin} Analysis:**
- Strong ${side === 'LONG' ? 'bullish' : 'bearish'} momentum detected
- Entry conditions met with favorable risk/reward

\`\`\`json
{
  "decisions": [
    {
      "coin": "${chosenCoin}",
      "action": "BUY",
      "confidence": 75,
      "side": "${side}",
      "leverage": ${leverage},
      "notional": 2500,
      "quantity": ${(2500 / price).toFixed(6)},
      "exitPlan": {
        "invalidation": "${side === 'LONG' ? 'Price drops below' : 'Price rises above'} $${(price * (side === 'LONG' ? 0.98 : 1.02)).toFixed(2)}",
        "stopLoss": ${(price * (side === 'LONG' ? 0.98 : 1.02)).toFixed(2)},
        "takeProfit": ${(price * (side === 'LONG' ? 1.04 : 0.96)).toFixed(2)}
      }
    },
    {"coin": "ETH", "action": "HOLD", "confidence": 50},
    {"coin": "SOL", "action": "HOLD", "confidence": 50},
    {"coin": "BNB", "action": "HOLD", "confidence": 50},
    {"coin": "DOGE", "action": "HOLD", "confidence": 50},
    {"coin": "XRP", "action": "HOLD", "confidence": 50}
  ]
}
\`\`\``;
  }

  return `## 1. Overall Assessment

Market consolidating. Waiting for clearer signals.

\`\`\`json
{
  "decisions": [
    {"coin": "BTC", "action": "HOLD", "confidence": 60},
    {"coin": "ETH", "action": "HOLD", "confidence": 55},
    {"coin": "SOL", "action": "HOLD", "confidence": 50},
    {"coin": "BNB", "action": "HOLD", "confidence": 50},
    {"coin": "DOGE", "action": "HOLD", "confidence": 50},
    {"coin": "XRP", "action": "HOLD", "confidence": 50}
  ]
}
\`\`\``;
}

function generateClaudeResponse(btcPrice: number): string {
  return `## Overall Assessment

Conservative market analysis reveals a consolidating market with no clear directional bias. Traditional value metrics suggest patience is warranted. Current portfolio positioning allows for opportunistic deployment when superior risk/reward setups emerge.

## New Opportunity Scan

All assets currently lack the stringent entry criteria required by our conservative value investing mandate. Awaiting oversold conditions or confirmed trend reversals.

## Final Summary

Maintaining cash position. Zero active positions. "Discipline is paramount - waiting for high-conviction opportunities."

\`\`\`json
{
  "decisions": [
    {"coin": "BTC", "action": "HOLD", "confidence": 70},
    {"coin": "ETH", "action": "HOLD", "confidence": 65},
    {"coin": "SOL", "action": "HOLD", "confidence": 60},
    {"coin": "BNB", "action": "HOLD", "confidence": 60},
    {"coin": "DOGE", "action": "HOLD", "confidence": 55},
    {"coin": "XRP", "action": "HOLD", "confidence": 55}
  ]
}
\`\`\``;
}

function generateGPTResponse(btcPrice: number): string {
  // GPT-5 有40%概率进行交易
  const shouldTrade = Math.random() > 0.6;

  if (shouldTrade) {
    const ethPrice = btcPrice * 0.035;
    const coin = Math.random() > 0.5 ? 'BTC' : 'ETH';
    const price = coin === 'BTC' ? btcPrice : ethPrice;
    const leverage = 14 + Math.floor(Math.random() * 5);

    return `## Market Analysis

Balanced opportunity detected in ${coin}. Entering position with moderate leverage.

\`\`\`json
{
  "decisions": [
    {
      "coin": "${coin}",
      "action": "BUY",
      "confidence": 68,
      "side": "LONG",
      "leverage": ${leverage},
      "notional": 3000,
      "quantity": ${(3000 / price).toFixed(6)},
      "exitPlan": {
        "invalidation": "Price drops below $${(price * 0.975).toFixed(2)}",
        "stopLoss": ${(price * 0.975).toFixed(2)},
        "takeProfit": ${(price * 1.045).toFixed(2)}
      }
    },
    {"coin": "ETH", "action": "HOLD", "confidence": 50},
    {"coin": "SOL", "action": "HOLD", "confidence": 50},
    {"coin": "BNB", "action": "HOLD", "confidence": 50},
    {"coin": "DOGE", "action": "HOLD", "confidence": 50},
    {"coin": "XRP", "action": "HOLD", "confidence": 50}
  ]
}
\`\`\``;
  }

  return `## Market Analysis

Mixed technical signals across all assets. Neutral positioning recommended.

\`\`\`json
{
  "decisions": [
    {"coin": "BTC", "action": "HOLD", "confidence": 50},
    {"coin": "ETH", "action": "HOLD", "confidence": 50},
    {"coin": "SOL", "action": "HOLD", "confidence": 50},
    {"coin": "BNB", "action": "HOLD", "confidence": 50},
    {"coin": "DOGE", "action": "HOLD", "confidence": 50},
    {"coin": "XRP", "action": "HOLD", "confidence": 50}
  ]
}
\`\`\``;
}

function generateGeminiResponse(btcPrice: number): string {
  // Gemini倾向于更激进的交易（80%概率）
  const shouldTrade = Math.random() > 0.2;

  if (shouldTrade) {
    return `## Quick Analysis

Detecting potential opportunity in BTC. Entering position.

\`\`\`json
{
  "decisions": [
    {
      "coin": "BTC",
      "action": "BUY",
      "confidence": 65,
      "side": "LONG",
      "leverage": 18,
      "notional": 3000,
      "quantity": ${(3000 / btcPrice).toFixed(6)},
      "exitPlan": {
        "invalidation": "Price drops below $${(btcPrice * 0.97).toFixed(0)}",
        "stopLoss": ${(btcPrice * 0.97).toFixed(0)},
        "takeProfit": ${(btcPrice * 1.05).toFixed(0)}
      }
    },
    {"coin": "ETH", "action": "HOLD", "confidence": 50},
    {"coin": "SOL", "action": "HOLD", "confidence": 50},
    {"coin": "BNB", "action": "HOLD", "confidence": 50},
    {"coin": "DOGE", "action": "HOLD", "confidence": 50},
    {"coin": "XRP", "action": "HOLD", "confidence": 50}
  ]
}
\`\`\``;
  }

  return generateGPTResponse(btcPrice);
}

function generateQwenResponse(btcPrice: number): string {
  // Qwen 有35%概率进行交易
  const shouldTrade = Math.random() > 0.65;

  if (shouldTrade) {
    const coins = ['SOL', 'BNB', 'DOGE'];
    const coin = coins[Math.floor(Math.random() * coins.length)];
    const price = coin === 'SOL' ? 183 : (coin === 'BNB' ? 1067 : 0.18);
    const leverage = 13 + Math.floor(Math.random() * 6);

    return `## 整体评估

在${coin}中发现交易机会。技术指标显示积极信号，适合建仓。

\`\`\`json
{
  "decisions": [
    {
      "coin": "${coin}",
      "action": "BUY",
      "confidence": 70,
      "side": "LONG",
      "leverage": ${leverage},
      "notional": 2800,
      "quantity": ${(2800 / price).toFixed(6)},
      "exitPlan": {
        "invalidation": "价格跌破 $${(price * 0.97).toFixed(2)}",
        "stopLoss": ${(price * 0.97).toFixed(2)},
        "takeProfit": ${(price * 1.05).toFixed(2)}
      }
    },
    {"coin": "BTC", "action": "HOLD", "confidence": 60},
    {"coin": "ETH", "action": "HOLD", "confidence": 60},
    {"coin": "SOL", "action": "HOLD", "confidence": 58},
    {"coin": "BNB", "action": "HOLD", "confidence": 58},
    {"coin": "XRP", "action": "HOLD", "confidence": 55}
  ]
}
\`\`\``;
  }

  return `## 整体评估

市场处于盘整状态，技术指标显示中性信号。采用稳健策略，等待更明确的入场机会。

## 最终总结

保持观望，严守纪律。"Discipline is paramount - 耐心等待高概率交易机会。"

\`\`\`json
{
  "decisions": [
    {"coin": "BTC", "action": "HOLD", "confidence": 65},
    {"coin": "ETH", "action": "HOLD", "confidence": 60},
    {"coin": "SOL", "action": "HOLD", "confidence": 58},
    {"coin": "BNB", "action": "HOLD", "confidence": 58},
    {"coin": "DOGE", "action": "HOLD", "confidence": 55},
    {"coin": "XRP", "action": "HOLD", "confidence": 55}
  ]
}
\`\`\``;
}

function generateGrokResponse(btcPrice: number): string {
  return `\`\`\`json
{
  "decisions": [
    {"coin": "BTC", "action": "HOLD", "confidence": 55},
    {"coin": "ETH", "action": "HOLD", "confidence": 55},
    {"coin": "SOL", "action": "HOLD", "confidence": 50},
    {"coin": "BNB", "action": "HOLD", "confidence": 50},
    {"coin": "DOGE", "action": "HOLD", "confidence": 50},
    {"coin": "XRP", "action": "HOLD", "confidence": 50}
  ]
}
\`\`\``;
}

/**
 * AI模型配置
 *
 * 🎮 演示模式：使用模拟AI响应（不需要API密钥）
 * 💡 如需使用真实API，请配置对应的API密钥
 */
export const AI_MODELS: AIModel[] = [
  {
    name: 'deepseek-v3',
    displayName: 'DeepSeek V3.1',
    provider: 'Simulated',
    strategy: 'Conservative value investing with multi-period technical analysis',
    callAPI: async (systemPrompt, userPrompt) => {
      return simulateAIResponse('deepseek-v3', systemPrompt, userPrompt);
    },
  },
  {
    name: 'claude-4.5',
    displayName: 'Claude 4.5 Sonnet',
    provider: 'Simulated',
    strategy: 'Conservative value investing with strict risk controls',
    callAPI: async (systemPrompt, userPrompt) => {
      return simulateAIResponse('claude-4.5', systemPrompt, userPrompt);
    },
  },
  {
    name: 'gpt-5',
    displayName: 'GPT-5',
    provider: 'Simulated',
    strategy: 'Balanced multi-asset strategy with momentum trading',
    callAPI: async (systemPrompt, userPrompt) => {
      return simulateAIResponse('gpt-5', systemPrompt, userPrompt);
    },
  },
  {
    name: 'gemini-2.5',
    displayName: 'Gemini 2.5 Pro',
    provider: 'Simulated',
    strategy: 'Aggressive momentum trading with high leverage',
    callAPI: async (systemPrompt, userPrompt) => {
      return simulateAIResponse('gemini-2.5', systemPrompt, userPrompt);
    },
  },
  {
    name: 'qwen-3',
    displayName: 'Qwen 3 Max',
    provider: 'Simulated',
    strategy: 'Quantitative analysis with altcoin focus',
    callAPI: async (systemPrompt, userPrompt) => {
      return simulateAIResponse('qwen-3', systemPrompt, userPrompt);
    },
  },
  {
    name: 'grok-4',
    displayName: 'Grok 4',
    provider: 'Simulated',
    strategy: 'Contrarian trading with volatility analysis',
    callAPI: async (systemPrompt, userPrompt) => {
      return simulateAIResponse('grok-4', systemPrompt, userPrompt);
    },
  },
];
