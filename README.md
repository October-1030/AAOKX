# 🏆 Alpha Arena Clone

A fully functional clone of [nof1.ai](https://nof1.ai)'s Alpha Arena - an AI trading competition platform where multiple large language models trade cryptocurrency autonomously with real strategies.

![Alpha Arena Demo](https://img.shields.io/badge/Status-Demo-green)
![Next.js](https://img.shields.io/badge/Next.js-15.1-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)

## 🎯 Features

### ✅ Complete Implementation

- **6 AI Models Competing**: DeepSeek V3.1, Claude 4.5 Sonnet, GPT-5, Gemini 2.5 Pro, Qwen 3 Max, Grok 4
- **Real Technical Indicators**: EMA, MACD, RSI, ATR calculations on simulated market data
- **Three-Layer Prompt Architecture**:
  - `USER_PROMPT`: Data input layer (market data, account status, positions)
  - `CHAIN_OF_THOUGHT`: Analysis layer (reasoning, position analysis, opportunity scanning)
  - `TRADING_DECISIONS`: Output layer (structured JSON decisions)
- **Live Trading Simulation**:
  - Each model starts with $10,000
  - 10-20x leverage trading
  - Stop loss and take profit management
  - Real-time position tracking
- **Advanced Performance Metrics**:
  - Sharpe Ratio
  - Win Rate
  - Maximum Drawdown
  - Equity curves
- **Real-time Dashboard**:
  - Live leaderboard
  - Equity charts (Recharts)
  - Market data visualization
  - Model Chat (AI decision reasoning)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Navigate to project directory
cd alpha-arena-clone

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 How to Use

1. **Start the App**: The page loads with market data and 6 AI models initialized
2. **Execute Cycle**: Click "Execute Cycle" to trigger one trading round
3. **Start Auto-Trading**: Click "Start Trading" to enable automatic 3-minute trading cycles
4. **Watch the Competition**:
   - Leaderboard updates in real-time
   - Equity charts show performance over time
   - ModelChat displays AI reasoning
5. **Explore Positions**: See each model's active trades, stop losses, and take profits

## 🏗️ Architecture

### Project Structure

```
alpha-arena-clone/
├── app/
│   ├── api/
│   │   └── trading/
│   │       └── route.ts        # Trading engine API
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Main dashboard
│   └── globals.css             # Global styles
├── components/
│   ├── Leaderboard.tsx         # Model rankings
│   ├── EquityChart.tsx         # Performance charts
│   ├── MarketOverview.tsx      # Market data display
│   └── ModelChat.tsx           # AI reasoning viewer
├── lib/
│   ├── indicators.ts           # Technical indicators (EMA, MACD, RSI, ATR)
│   ├── marketData.ts           # Market data simulator
│   ├── tradingPrompt.ts        # Three-layer prompt system
│   ├── aiModels.ts             # AI model integrations
│   └── tradingEngine.ts        # Trading execution engine
├── types/
│   └── trading.ts              # TypeScript type definitions
└── package.json
```

### Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Runtime**: Node.js (serverless functions)

## 🧠 AI Trading System

### Prompt Engineering Architecture

This clone implements the exact **three-layer architecture** used by Alpha Arena:

#### 1️⃣ USER_PROMPT (Data Input Layer)

```typescript
{
  marketContext: {
    tradingDuration, totalCalls, performance
  },
  technicalData: {
    currentState: { price, EMA, MACD, RSI },
    intradaySeries: [10 recent candles],
    macroContext: { 4H EMA, ATR, volume }
  },
  positions: [
    { coin, side, leverage, exitPlan }
  ]
}
```

#### 2️⃣ CHAIN_OF_THOUGHT (Analysis Layer)

```markdown
## Overall Assessment
[Market summary]

## Position-by-Position Analysis
- Technical evaluation
- Exit plan validation
- Decision + rationale

## New Opportunity Scan
- Entry signals check
- Risk/reward assessment

## Final Summary
"Discipline is paramount..."
```

#### 3️⃣ TRADING_DECISIONS (Output Layer)

```json
{
  "decisions": [
    {
      "coin": "BTC",
      "action": "BUY",
      "confidence": 75,
      "leverage": 15,
      "exitPlan": {
        "invalidation": "...",
        "stopLoss": 64500,
        "takeProfit": 72000
      }
    }
  ]
}
```

### Technical Indicators

All indicators are calculated from scratch:

- **EMA** (Exponential Moving Average): 20, 50, 200 periods
- **MACD** (Moving Average Convergence Divergence): 12/26/9 periods
- **RSI** (Relative Strength Index): 14 periods
- **ATR** (Average True Range): 14 periods
- **Volume Analysis**: Current vs average volume ratio

## ⚙️ Configuration

### Adding Real AI Models

To integrate actual LLM APIs, modify `lib/aiModels.ts`:

```typescript
export const AI_MODELS: AIModel[] = [
  {
    name: 'gpt-5',
    displayName: 'GPT-5',
    provider: 'OpenAI',
    strategy: 'Balanced multi-asset strategy',
    callAPI: async (systemPrompt, userPrompt) => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      const data = await response.json();
      return data.choices[0].message.content;
    },
  },
  // Add more models...
];
```

### Adding Real Market Data

Modify `lib/marketData.ts` to fetch from exchanges:

```typescript
import axios from 'axios';

export async function fetchRealMarketData(coin: Coin) {
  const response = await axios.get(
    `https://api.binance.com/api/v3/klines?symbol=${coin}USDT&interval=10m&limit=144`
  );
  return response.data;
}
```

## 📊 Performance Metrics

The system tracks:

- **Total Return**: Percentage gain/loss from initial capital
- **Sharpe Ratio**: Risk-adjusted return measure
- **Win Rate**: Percentage of profitable trades
- **Max Drawdown**: Largest peak-to-trough decline
- **Total Trades**: Number of completed trades
- **Active Positions**: Current open trades

## 🎨 Customization

### Adding New Coins

1. Update `types/trading.ts`:
```typescript
export type Coin = 'BTC' | 'ETH' | 'SOL' | 'BNB' | 'DOGE' | 'XRP' | 'ADA';
```

2. Add initial price in `lib/marketData.ts`:
```typescript
const INITIAL_PRICES: Record<Coin, number> = {
  // ... existing
  ADA: 0.75,
};
```

### Customizing AI Strategies

Edit strategies in `lib/aiModels.ts`:

```typescript
strategy: "Ultra-conservative value investing with maximum risk controls"
```

## ⚠️ Disclaimer

**This is a DEMO project for educational purposes.**

- Uses **simulated market data** (random walk model)
- AI responses are **mock implementations**
- For real trading, integrate actual:
  - Exchange APIs (Binance, Hyperliquid, etc.)
  - LLM providers (OpenAI, Anthropic, DeepSeek, etc.)
  - Database for persistent storage
  - Proper error handling and security

## 🛠️ Development

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 📝 Environment Variables (Optional)

Create `.env.local` for real integrations:

```env
# AI Model API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=...

# Exchange APIs
BINANCE_API_KEY=...
BINANCE_SECRET_KEY=...
```

## 🤝 Contributing

This project is a learning resource. Feel free to:

- Fork and experiment
- Add new features
- Integrate real APIs
- Improve UI/UX

## 📄 License

MIT License - Free to use for educational purposes

## 🙏 Credits

- Inspired by [nof1.ai](https://nof1.ai) Alpha Arena
- Technical indicators implementation based on standard TA formulas
- UI design inspired by modern trading platforms

## 📧 Support

For questions or issues, please open an issue on GitHub.

---

**Built with ❤️ using Next.js, TypeScript, and Tailwind CSS**
