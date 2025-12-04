# 均值回归策略指南 (Mean Reversion Strategy Guide)

## 📊 概述

本指南介绍 Alpha Arena 的**均值回归策略系统**，该系统通过线性回归分析识别价格偏离，并结合市场状态判断自动切换交易策略。

### 核心理念

**均值回归** (Mean Reversion) 基于统计学原理：价格在偏离统计平均值后，有较高概率回归均值。

- 💡 **适用场景**：震荡市场（RANGING）
- 📈 **交易逻辑**：价格极度偏离 → 逆向交易 → 等待回归
- ⚠️ **关键风险**：趋势市场中使用会导致"接飞刀"

---

## 🎯 新增技术指标

### 1. 线性回归分析 (Linear Regression)

使用 20 周期线性回归拟合价格走势，计算以下指标：

#### **核心指标**

| 指标 | 说明 | 用途 |
|------|------|------|
| **Z-Score** | 标准化偏离度 | 识别极端超买/超卖 |
| **R²** | 拟合优度 (0-1) | 判断趋势强度 |
| **Signal** | 交易信号 | OVERBOUGHT / OVERSOLD / NEUTRAL |
| **Deviation** | 价格偏离度 | 美元金额 + 百分比 |

#### **Z-Score 解读**

```
Z-Score > +2   →  极度超买 (EXTREME OVERBOUGHT) ⚠️
                  价格在回归线上方 2+ 个标准差
                  → 考虑做空（仅限震荡市场）

Z-Score: -2 到 +2  →  正常范围 (Normal Range)
                      无极端偏离

Z-Score < -2   →  极度超卖 (EXTREME OVERSOLD) ⚠️
                  价格在回归线下方 2+ 个标准差
                  → 考虑做多（仅限震荡市场）
```

---

### 2. 市场状态识别 (Market Regime)

使用 ADX (Average Directional Index) 和 R² 判断市场状态：

#### **市场状态分类**

| 状态 | 条件 | 推荐策略 |
|------|------|----------|
| **RANGING** (震荡) | ADX < 20 且 R² < 0.4 | **均值回归** - 寻找 Z-Score 极值 |
| **TRENDING** (趋势) | ADX > 25 且 R² > 0.7 | **趋势跟踪** - 跟随动量方向 |
| **TRANSITIONING** (过渡) | 介于两者之间 | **等待** - 观望等待明确信号 |

#### **ADX 解读**

```
ADX < 20   →  弱趋势/震荡市场
              适合均值回归策略

ADX 20-25  →  过渡状态
              观望等待

ADX > 25   →  强趋势市场
              适合趋势跟踪策略
```

---

## 📋 交易规则

### ✅ 做多设置 (LONG Setups)

**必须同时满足以下条件：**

1. ✅ **Z-Score < -2** - 价格极度超卖
2. ✅ **RSI_14 < 30** - 传统超卖确认
3. ✅ **Market Regime = RANGING** - 震荡市场
4. ✅ **成交量支持** - 当前成交量 > 平均成交量

**交易逻辑：**
```
价格 = $67,000
回归线预测值 = $68,500
Z-Score = -2.5

→ 价格在统计均值下方 2.5 个标准差
→ 历史上有 80% 概率在 24-72 小时内回归
→ 做多，目标 Z-Score 回到 0（均值）
```

---

### ✅ 做空设置 (SHORT Setups)

**必须同时满足以下条件：**

1. ✅ **Z-Score > +2** - 价格极度超买
2. ✅ **RSI_14 > 70** - 传统超买确认
3. ✅ **Market Regime = RANGING** - 震荡市场
4. ✅ **成交量支持** - 当前成交量 > 平均成交量

**交易逻辑：**
```
价格 = $70,000
回归线预测值 = $68,000
Z-Score = +2.8

→ 价格在统计均值上方 2.8 个标准差
→ 统计上存在显著回落概率
→ 做空，目标 Z-Score 回到 0（均值）
```

---

## ⚠️ 关键警告

### ❌ 不要在趋势市场使用均值回归

```
错误示例：

BTC 分析：
- Z-Score: +3.5 (极度超买)
- RSI: 78
- Market Regime: TRENDING (ADX=32, R²=0.88)
- Recommendation: TREND_FOLLOWING

❌ 错误决策：做空 BTC（逆势）
✅ 正确决策：HOLD 或跟随趋势做多

原因：在强趋势中，"超买可以持续超买"
      价格会沿趋势继续上涨，不会快速回归
```

### ❌ 不要仅依赖 Z-Score 单一指标

必须结合：
- RSI 确认
- 市场状态判断
- 成交量验证

### ❌ 不要在趋势反转时逆势

如果市场从 RANGING 变为 TRENDING，立即退出均值回归仓位。

---

## 🧠 AI 决策流程

系统 AI 现在遵循以下决策树：

```
1. 检查市场状态
   ├─ RANGING → 启用均值回归逻辑
   ├─ TRENDING → 启用趋势跟踪逻辑
   └─ WAIT → 观望，不开新仓

2. 如果 RANGING：
   ├─ 检查 Z-Score
   │  ├─ Z < -2 且 RSI < 30 → 考虑做多
   │  ├─ Z > +2 且 RSI > 70 → 考虑做空
   │  └─ -2 < Z < +2 → 无极端信号
   └─ 验证成交量 > 平均

3. 如果 TRENDING：
   ├─ 忽略 Z-Score（无关）
   ├─ 检查 MACD + EMA 排列
   └─ 跟随趋势方向

4. 风险管理：
   ├─ 单笔最大风险 2% 账户
   ├─ 止损设置在 Z-Score = -3/+3（论点失效）
   └─ 止盈设置在 Z-Score = 0（回归均值）
```

---

## 📊 实战示例

### 示例 1：完美的均值回归做多

```
BTC 分析（震荡市场）:
├─ 价格: $66,500
├─ 回归线预测: $68,200
├─ Z-Score: -2.3 (极度超卖 ⚠️)
├─ RSI_14: 26 (超卖)
├─ Market Regime: RANGING (ADX=16, R²=0.35)
├─ 成交量: 1.15x 平均
└─ Recommendation: MEAN_REVERSION

✅ 决策：buy_to_enter BTC
   - Confidence: 0.78
   - Leverage: 6x
   - Stop Loss: $65,800 (-1.05%, Z=-2.8)
   - Take Profit: $68,200 (+2.55%, Z=0)
   - Rationale: "BTC 在统计均值下方 2.3 个标准差，
                 RSI 确认超卖，市场处于震荡状态。
                 历史数据显示 24-72 小时内回归概率 82%"
```

### 示例 2：避免在趋势中逆势

```
ETH 分析（趋势市场）:
├─ 价格: $3,200
├─ 回归线预测: $2,980
├─ Z-Score: +2.6 (极度超买 ⚠️)
├─ RSI_14: 74 (超买)
├─ Market Regime: TRENDING (ADX=29, R²=0.82)
├─ MACD: 强烈看涨
└─ Recommendation: TREND_FOLLOWING

❌ 不做空（虽然 Z-Score > +2）
✅ 决策：hold ETH 或 buy_to_enter（顺势）
   - Rationale: "虽然 Z-Score 显示超买，但市场处于强趋势。
                 ADX=29 表明趋势强劲，不适合均值回归。
                 在趋势中，价格可以持续偏离统计均值"
```

### 示例 3：过渡期观望

```
SOL 分析（过渡状态）:
├─ 价格: $139.50
├─ Z-Score: -1.2 (轻微偏离)
├─ RSI_14: 45 (中性)
├─ Market Regime: RANGING (ADX=22, R²=0.58)
├─ Recommendation: WAIT
└─ 信号强度: 低

✅ 决策：hold SOL
   - Rationale: "Z-Score 未达到极值（-2），
                 市场状态不明确（ADX=22 介于震荡和趋势之间）。
                 等待更清晰的信号"
```

---

## 🔧 技术实现

### 代码位置

| 文件 | 功能 |
|------|------|
| `lib/indicators.ts:190-289` | `calculateLinearRegression()` - 线性回归计算 |
| `lib/indicators.ts:291-375` | `identifyMarketRegime()` - 市场状态识别 |
| `lib/tradingPromptNOF1.ts:265-346` | AI 系统提示词 - 策略指导 |
| `lib/tradingPromptNOF1.ts:65-77` | AI 用户提示词 - 数据展示 |
| `types/trading.ts:27-47` | TypeScript 类型定义 |

### 计算参数

```typescript
// 线性回归
period = 20  // 20 周期回归

// 市场状态
ADX_period = 14
R²_threshold_ranging = 0.4
R²_threshold_trending = 0.7
ADX_threshold_ranging = 20
ADX_threshold_trending = 25

// Z-Score 阈值
extreme_threshold = ±2 标准差
```

---

## 📈 性能优化建议

### 参数调优

视频中提到的策略表现：
- 净利润: 116%
- 最大回撤: 11.85%
- 胜率: 64%
- 盈亏比: 1.96

**优化方向：**

1. **不同币种使用不同参数**
   - BTC/ETH (大市值)：period = 20-30
   - SOL/BNB (中市值)：period = 14-20
   - DOGE (高波动)：period = 10-14

2. **Z-Score 阈值调整**
   - 保守: ±2.5 标准差
   - 激进: ±1.5 标准差
   - 建议: 从 ±2 开始测试

3. **ADX 阈值优化**
   - 根据历史数据回测确定最佳阈值
   - 不同市场环境可能需要不同值

---

## 🎓 延伸学习

### 统计学基础

- **标准差** (Standard Deviation): 衡量数据离散程度
- **Z-Score**: (当前值 - 均值) / 标准差
- **线性回归**: 最小二乘法拟合直线

### 推荐资源

- 📖 "Quantitative Trading" by Ernest Chan
- 📊 TradingView 线性回归指标教程
- 🎥 参考视频：线性回归震荡器策略（已集成）

---

## ⚙️ 配置选项

当前系统为**轻量级集成**：
- ✅ 指标自动计算
- ✅ 数据自动提供给 AI
- ✅ AI 自主决定是否使用

**未来可选扩展：**
- [ ] 独立的均值回归策略模式
- [ ] 参数自适应优化
- [ ] 多周期线性回归对比
- [ ] Bollinger Bands + Z-Score 组合

---

## 🛡️ 风险提示

1. **均值回归不是圣杯** - 在趋势市场会失效
2. **需要严格止损** - 如果论点失效必须立即止损
3. **观察 AI 行为** - 监控 AI 是否正确识别市场状态
4. **先在测试网验证** - 不要直接在真实资金上使用

---

## 📞 支持

如有问题，请查看：
- 📖 `README.md` - 项目总览
- 🚀 `QUICKSTART.md` - 快速入门
- 📊 `QUICK_REFERENCE.md` - 技术指标速查
- 🔒 `SAFETY_GUIDE.md` - 安全配置

---

**更新日期**: 2025-11-25
**版本**: v1.0 - 初始集成
