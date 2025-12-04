# 🚀 快速参考指南

## 📌 常用命令

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 代码检查
npm run lint
```

---

## 🎨 使用主题系统

### 在组件中切换主题
```typescript
import { useTheme } from '@/store/useTheme';

function MyComponent() {
  const { theme, toggleTheme, setTheme } = useTheme();

  return (
    <button onClick={toggleTheme}>
      当前主题: {theme}
    </button>
  );
}
```

### 使用 CSS Variables
```css
.my-panel {
  background: var(--panel-bg);
  color: var(--fg);
  border: 1px solid var(--panel-border);
}

.my-text {
  color: var(--muted-text);
}
```

### 可用的 CSS Variables
| 变量 | 用途 | 深色值 | 浅色值 |
|------|------|--------|--------|
| `--bg` | 背景色 | #0a0a0a | #ffffff |
| `--fg` | 前景色 | #ededed | #171717 |
| `--panel-bg` | 面板背景 | rgba(26,26,26,0.8) | rgba(255,255,255,0.9) |
| `--muted-text` | 次要文字 | #a1a1aa | #71717a |
| `--deepseek` | DeepSeek 品牌色 | #3b82f6 | #3b82f6 |
| `--claude` | Claude 品牌色 | #ff6b35 | #ff6b35 |
| `--gpt` | GPT 品牌色 | #10a37f | #10a37f |

---

## 📦 使用 Zustand Stores

### 交易状态
```typescript
import { useTradingStore } from '@/store/useTradingStore';

function MyComponent() {
  const {
    performances,
    marketData,
    isRunning,
    setPerformances,
    setIsRunning,
  } = useTradingStore();

  return (
    <div>
      <p>运行状态: {isRunning ? '运行中' : '已停止'}</p>
      <p>模型数量: {performances.length}</p>
    </div>
  );
}
```

### 图表数据
```typescript
import { useChartStore } from '@/store/useChartStore';

function MyChart() {
  const { addPoint, getSeries, clear } = useChartStore();

  // 添加数据点
  addPoint(Date.now(), {
    'model-1': 10500,
    'model-2': 9800,
  });

  // 获取序列
  const series = getSeries();

  // 清空数据
  clear();
}
```

---

## 🔄 使用 SWR 数据获取

### 基础用法
```typescript
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

function MyComponent() {
  const { data, error, isLoading } = useSWR('/api/endpoint', fetcher);

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>加载失败</div>;

  return <div>{JSON.stringify(data)}</div>;
}
```

### 高级配置
```typescript
const { data, error, mutate } = useSWR('/api/endpoint', fetcher, {
  refreshInterval: 5000,         // 每5秒自动刷新
  revalidateOnFocus: true,       // 窗口获得焦点时重新验证
  dedupingInterval: 2000,        // 去重间隔
  revalidateOnReconnect: true,   // 重新连接时验证
});

// 手动触发重新验证
mutate();
```

---

## 🔢 使用数字格式化

```typescript
import {
  formatCurrency,
  formatPercent,
  formatPercentWithSign,
  formatNumber,
  formatLargeNumber,
  formatPrice,
} from '@/lib/formatNumber';

// 货币格式化
formatCurrency(10500.5)              // "$10,500.50"
formatCurrency(1500000)              // "$1.50M"

// 百分比
formatPercent(12.34)                 // "12.34%"
formatPercentWithSign(12.34)         // "+12.34%"
formatPercentWithSign(-5.67)         // "-5.67%"

// 数字格式化
formatNumber(1234567.89)             // "1,234,567.89"
formatLargeNumber(1000000)           // "1.0M"

// 价格格式化（根据币种）
formatPrice(67234.56, "BTC")         // "$67,234.56"
formatPrice(0.5432, "DOGE")          // "$0.5432" (4位小数)
```

---

## 📈 技术指标速查

### 传统指标

| 指标 | 周期 | 用途 | 代码位置 |
|------|------|------|----------|
| **EMA** | 20, 50, 200 | 趋势识别 | `lib/indicators.ts:15` |
| **MACD** | 12/26/9 | 动量确认 | `lib/indicators.ts:37` |
| **RSI** | 7, 14 | 超买超卖 | `lib/indicators.ts:69` |
| **ATR** | 3, 14 | 波动性 | `lib/indicators.ts:107` |

### 均值回归指标 (NEW!)

| 指标 | 计算方法 | 解读 | 代码位置 |
|------|----------|------|----------|
| **Z-Score** | (价格 - 均值) / 标准差 | ±2 = 极端 | `lib/indicators.ts:198` |
| **Linear Regression** | 20 周期最小二乘法 | R² > 0.7 = 强趋势 | `lib/indicators.ts:198` |
| **ADX** | 14 周期方向指数 | > 25 = 趋势，< 20 = 震荡 | `lib/indicators.ts:299` |
| **Market Regime** | ADX + R² 组合 | RANGING / TRENDING | `lib/indicators.ts:299` |

### 快速判断

```typescript
// 检查极端超买/超卖
if (indicators.linear_regression.zScore < -2) {
  // 极度超卖 - 考虑做多（仅限震荡市场）
}

// 检查市场状态
if (indicators.market_regime.regime === 'RANGING') {
  // 震荡市场 - 使用均值回归策略
} else if (indicators.market_regime.regime === 'TRENDING') {
  // 趋势市场 - 使用趋势跟踪策略
}

// 完整的均值回归做多设置
if (
  indicators.linear_regression.zScore < -2 &&
  indicators.rsi_14 < 30 &&
  indicators.market_regime.regime === 'RANGING' &&
  indicators.volume_ratio > 1.0
) {
  // ✅ 高概率均值回归机会
  action = 'buy_to_enter';
}
```

📖 **[完整均值回归策略指南 →](MEAN_REVERSION_GUIDE.md)**

---

## 🎯 三层提示词系统

### 生成提示词
```typescript
import {
  generateUserPrompt,
  generateSystemPrompt,
  parseAIResponse,
} from '@/lib/tradingPrompt';

// 1. 生成用户提示词（数据输入层）
const userPrompt = generateUserPrompt(accountStatus, marketData);

// 2. 生成系统提示词（包含规则和 CoT 要求）
const systemPrompt = generateSystemPrompt("你的交易策略描述");

// 3. 调用 AI（示例）
const aiResponse = await callAI(systemPrompt, userPrompt);

// 4. 解析 AI 响应
const { chainOfThought, decisions } = parseAIResponse(aiResponse);
```

### 自定义交易策略
```typescript
const myStrategy = `
你是一个极其保守的价值投资者，你的唯一目标是实现长期稳定复利

交易铁律：
- 只在RSI指标低于30时考虑买入，高于70时考虑卖出
- 单笔交易风险绝对不能超过总资产的1%
- 杠杆倍数严格控制在1-3倍之间
- 永远设置止损，保护本金是第一要务
- 绝不追涨杀跌，像猎人一样耐心等待最佳时机
`;

const systemPrompt = generateSystemPrompt(myStrategy);
```

---

## 📊 模型元数据

```typescript
import {
  getModelMeta,
  getAllModels,
  getModelColor,
  getModelDisplayName,
} from '@/lib/modelMeta';

// 获取单个模型元数据
const meta = getModelMeta('deepseek-v3');
// {
//   id: 'deepseek-v3',
//   name: 'deepseek-v3',
//   displayName: 'DeepSeek V3.1',
//   provider: 'DeepSeek',
//   color: '#3b82f6',
//   ...
// }

// 获取所有模型
const allModels = getAllModels();

// 获取模型颜色
const color = getModelColor('claude-4.5');  // '#8b5cf6'

// 获取显示名称
const name = getModelDisplayName('gpt-5');  // 'GPT-5'
```

---

## 🔧 配置文件

### lib/config.ts
```typescript
export const CONFIG = {
  // 数据源
  USE_REAL_MARKET_DATA: false,  // true = 真实数据, false = 模拟数据

  // 交易间隔
  TRADING_INTERVAL_MS: 180000,  // 3分钟

  // 数据刷新
  DATA_REFRESH_INTERVAL_MS: 60000,  // 1分钟

  // 初始资金
  INITIAL_BALANCE: 1000,

  // 杠杆范围
  MIN_LEVERAGE: 10,
  MAX_LEVERAGE: 20,
};
```

---

## 🌐 API 端点

### GET /api/trading
获取当前状态
```typescript
const res = await fetch('/api/trading');
const data = await res.json();
// {
//   isRunning: boolean,
//   performances: ModelPerformance[],
//   marketData: MarketData[],
//   timestamp: number,
//   dataSource: 'real' | 'simulated'
// }
```

### GET /api/trading?action=start
启动交易引擎

### GET /api/trading?action=stop
停止交易引擎

### POST /api/trading
手动执行交易周期
```typescript
const res = await fetch('/api/trading', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'execute_cycle' }),
});
```

---

## 🎨 常用样式类

```html
<!-- 面板 -->
<div class="panel">面板内容</div>

<!-- 文本颜色 -->
<p class="text-muted">次要文字</p>
<h1 class="text-heading">标题文字</h1>

<!-- 渐变文字 -->
<h1 class="gradient-text">ALPHA ARENA</h1>

<!-- 脉冲动画 -->
<div class="animate-pulse-glow">闪烁效果</div>
```

---

## 📁 项目结构

```
alpha-arena-clone/
├── app/
│   ├── api/
│   │   └── trading/
│   │       └── route.ts         # 交易 API
│   ├── page.tsx                 # 主页面
│   ├── layout.tsx               # 根布局
│   └── globals.css              # 全局样式
├── components/
│   ├── Leaderboard.tsx          # 排行榜
│   ├── EquityChart.tsx          # 权益图表
│   ├── MarketOverview.tsx       # 市场概览
│   ├── ModelChat.tsx            # 模型对话
│   ├── TradeHistory.tsx         # 交易历史
│   └── ThemeToggle.tsx          # 主题切换
├── store/                       # Zustand stores
│   ├── useTradingStore.ts
│   ├── useChartStore.ts
│   └── useTheme.ts
├── lib/
│   ├── tradingEngine.ts         # 交易引擎
│   ├── tradingPrompt.ts         # 提示词系统
│   ├── aiModels.ts              # AI 模型
│   ├── indicators.ts            # 技术指标
│   ├── marketData.ts            # 模拟数据
│   ├── marketDataReal.ts        # 真实数据
│   ├── binanceAPI.ts            # Binance API
│   ├── fetcher.ts               # SWR fetcher
│   ├── formatNumber.ts          # 数字格式化
│   └── config.ts                # 配置
└── types/
    └── trading.ts               # TypeScript 类型
```

---

## 🐛 常见问题

### Q: 主题切换不生效？
A: 检查是否正确导入了 `useTheme`，并确保在组件挂载后设置 `data-theme` 属性。

### Q: SWR 不自动刷新？
A: 检查 `refreshInterval` 配置，确保没有设置为 0。

### Q: Zustand 状态不更新？
A: 确保使用了 `set()` 函数，并且组件正确订阅了 store。

### Q: 数字格式化显示 NaN？
A: 检查传入的值是否为有效数字，使用 `Number()` 进行类型转换。

---

## 📚 相关文档

- [README.md](./README.md) - 项目介绍
- [MEAN_REVERSION_GUIDE.md](./MEAN_REVERSION_GUIDE.md) - 均值回归策略指南 (NEW!)
- [REAL_DATA_GUIDE.md](./REAL_DATA_GUIDE.md) - 真实数据集成指南
- [PROJECT_COMPARISON.md](./PROJECT_COMPARISON.md) - 项目对比分析
- [UPGRADE_SUMMARY.md](./UPGRADE_SUMMARY.md) - 升级总结

---

## 🔗 有用的链接

- [Zustand 文档](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [SWR 文档](https://swr.vercel.app)
- [Numeral.js 文档](http://numeraljs.com)
- [Next.js 文档](https://nextjs.org/docs)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)

---

**最后更新**：2025-11-25
