# 🚀 Quick Start Guide - Alpha Arena Clone

## ✅ 项目已完成构建！

所有依赖已安装，项目构建成功无错误。现在可以立即启动！

---

## 📋 启动步骤

### 1. 打开终端并进入项目目录

```bash
cd C:\Users\pdb12\OneDrive\桌面\alpha-arena-clone
```

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 打开浏览器

访问: [http://localhost:3000](http://localhost:3000)

---

## 🎮 使用指南

### 第一步：查看初始状态

页面加载后，你会看到：
- 📊 **市场数据面板**: 显示 BTC、ETH、SOL、BNB、DOGE、XRP 的实时技术指标
- 🏆 **排行榜**: 6个AI模型的初始排名（都是$1,000起步）
- 📈 **权益曲线图**: 空的，等待交易开始后填充

### 第二步：执行第一次交易

点击右上角的 **"Execute Cycle"** 按钮：
- AI模型会分析市场数据
- 根据技术指标（RSI、MACD、EMA）做出决策
- 可能开仓、平仓或观望

⏱️ **需要等待**: 每个模型需要1-3秒模拟思考时间

### 第三步：启动自动交易

点击 **"Start Trading"** 按钮：
- 系统每3分钟自动执行一次交易周期
- 模拟真实的Alpha Arena运行模式
- 可以看到排行榜实时变化

### 第四步：探索功能

#### 查看模型思维过程
- 滚动到 **"MODEL CHAT"** 部分
- 选择不同的AI模型
- 查看它们的决策推理（Chain of Thought）

#### 分析持仓
- 每个模型的持仓会显示在排行榜下方
- 绿色 = 多头 (LONG)
- 红色 = 空头 (SHORT)
- 查看止损/止盈价格

#### 观察权益曲线
- 不同颜色的线代表不同模型
- 实时更新表现对比

---

## 🎯 核心功能演示

### 功能1: AI三层提示词架构

每次交易决策都经过：

1. **USER_PROMPT** (数据输入)
   - 市场数据: 价格、EMA、MACD、RSI
   - 账户状态: 现金、总资产、持仓
   - 历史K线: 10分钟和4小时周期

2. **CHAIN_OF_THOUGHT** (推理分析)
   - 市场整体评估
   - 逐个持仓分析
   - 新机会扫描
   - 最终决策总结

3. **TRADING_DECISIONS** (结构化输出)
   ```json
   {
     "coin": "BTC",
     "action": "BUY",
     "leverage": 15,
     "exitPlan": {...}
   }
   ```

### 功能2: 技术指标计算

所有指标都是实时计算：
- **EMA**: 20/50/200周期指数移动平均
- **MACD**: 12/26/9参数，包含柱状图
- **RSI**: 14周期相对强弱指标
- **ATR**: 14周期平均真实波幅

### 功能3: 风险管理

每个交易都强制包含：
- ✅ 止损价格（Stop Loss）
- ✅ 止盈目标（Take Profit）
- ✅ 失效条件（Invalidation）
- ✅ 10-20x杠杆限制

---

## 📊 预期表现

### DeepSeek V3.1
- **策略**: 保守动量交易
- **特点**: 交易频率低，止损严格
- **预期**: 通常排名前3

### Claude 4.5 Sonnet
- **策略**: 保守价值投资
- **特点**: 等待高概率机会
- **预期**: 稳定但收益一般

### Gemini 2.5 Pro
- **策略**: 反应性交易
- **特点**: 可能高频交易导致亏损
- **预期**: 表现波动大

---

## 🛠️ 常见问题

### Q: 为什么有的模型不交易？

A: 模型遵循纪律："只在RSI < 30或RSI > 70时考虑入场"。如果没有明确信号，会选择观望（HOLD）。

### Q: 如何调整交易间隔？

A: 修改 `app/api/trading/route.ts`:

```typescript
// 将180000改为你想要的毫秒数
// 60000 = 1分钟
// 180000 = 3分钟 (默认)
updateInterval = setInterval(async () => {
  //...
}, 180000);
```

### Q: 如何添加真实AI API？

A: 修改 `lib/aiModels.ts`:

```typescript
callAPI: async (systemPrompt, userPrompt) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  return (await response.json()).choices[0].message.content;
}
```

### Q: 如何集成真实市场数据？

A: 修改 `lib/marketData.ts`，使用Binance等交易所API。

---

## 🎨 自定义

### 修改初始资金

`lib/tradingEngine.ts`:
```typescript
const INITIAL_CAPITAL = 50000; // 改为你想要的金额
```

### 添加新币种

1. `types/trading.ts`:
```typescript
export type Coin = 'BTC' | 'ETH' | 'SOL' | 'BNB' | 'DOGE' | 'XRP' | 'ADA';
```

2. `lib/marketData.ts`:
```typescript
const INITIAL_PRICES: Record<Coin, number> = {
  // ... existing
  ADA: 0.75,
};
```

### 调整杠杆范围

`lib/tradingPrompt.ts`:
```typescript
- **Leverage**: 5x-15x (改为你想要的范围)
```

---

## 📈 性能指标说明

- **Return %**: 从初始$1,000的收益率
- **Sharpe Ratio**: 风险调整后收益（越高越好，>1为优秀）
- **Win Rate**: 盈利交易占比
- **Max Drawdown**: 最大回撤（越小越好）

---

## 🔥 高级技巧

### 1. 模拟市场波动

修改 `lib/marketData.ts` 中的 `volatility` 参数：

```typescript
const changePercent = (Math.random() - 0.5) * 2 * 0.05; // 5%波动
```

### 2. 强制触发止损

在控制台执行：
```javascript
// 手动修改价格触发止损
```

### 3. 导出交易记录

未来可以添加CSV导出功能，记录所有交易历史。

---

## 🎉 现在开始！

```bash
npm run dev
```

打开浏览器，点击 **"Execute Cycle"**，观看AI模型的首次交易！

**祝你玩得开心！** 🚀

---

## 📞 需要帮助？

- 查看完整文档: `README.md`
- 技术架构: `lib/` 目录下的所有文件都有详细注释
- 提示词系统: `lib/tradingPrompt.ts`
- AI模型配置: `lib/aiModels.ts`
