# 🛡️ 风险管理系统使用指南

本系统借鉴了 **Nautilus Trader** 的风险管理理念，实现了全方位的交易风险控制。

---

## 📋 **功能概览**

### **1️⃣ 单币种最大亏损限制**
**目的**：防止某个币种反复亏损
**规则**：
- 单个币种累计亏损超过 **10%** 时，停止该币种的新交易
- 当前持仓亏损超过 **10%** 时，不允许加仓

**示例**：
```
ETH 历史交易亏损 -$105（-10.5%）
❌ 拒绝新的 ETH 交易
✅ 允许其他币种交易
```

---

### **2️⃣ 单币种最大仓位限制**
**目的**：避免仓位过度集中
**规则**：
- 单个币种仓位不超过账户总权益的 **30%**

**示例**：
```
账户总权益: $1,357
最大单币种仓位: $407
当前 BTC 仓位: $350
❌ 拒绝新增 $100 BTC 仓位（总计 $450 > $407）
```

---

### **3️⃣ 相关性风险检查** 🔥重要
**目的**：避免高相关币种同时持有，风险集中
**规则**：
- 计算币种之间的相关性（0.7 以上视为高相关）
- 高相关币种总仓位不超过账户的 **50%**

**相关性矩阵**：
```
BTC ↔ ETH:  0.85 (高相关)
BTC ↔ SOL:  0.75 (高相关)
ETH ↔ SOL:  0.80 (高相关)
BTC ↔ DOGE: 0.60 (中等相关)
```

**示例**：
```
当前持仓:
- BTC: $300
- ETH: $250 (与 BTC 相关性 0.85)

尝试买入 SOL $200 (与 BTC、ETH 都高相关)
总相关仓位: $300 + $250 + $200 = $750
账户权益: $1,357
相关仓位占比: 55.3% > 50%
❌ 拒绝交易
```

---

### **4️⃣ Kelly 公式资金管理** 📊
**目的**：科学计算最优仓位大小
**公式**：
```
Kelly% = (p × b - q) / b × Kelly分数
```
- **p** = 胜率（历史交易胜率）
- **q** = 败率 (1-p)
- **b** = 平均盈利/平均亏损比
- **Kelly分数** = 0.25（保守，使用25% Kelly）

**示例**：
```
历史统计:
- 总交易: 20 笔
- 胜率: 60%
- 平均盈利: $50
- 平均亏损: $30
- 盈亏比: 1.67

Kelly% = (0.6 × 1.67 - 0.4) / 1.67 × 0.25 = 8.4%
建议仓位: $1,357 × 8.4% = $114

✅ AI 信心度 80% → 实际仓位 $91 (114 × 0.8)
```

---

### **5️⃣ 持仓数量限制**
**目的**：防止过度分散，难以管理
**规则**：
- 最多持有 **6 个**币种仓位

---

### **6️⃣ 单笔交易大小限制**
**目的**：防止单笔交易过大
**规则**：
- 单笔交易不超过账户的 **20%**

---

## 🎯 **实际应用示例**

### **场景1：ETH 已经亏损 15%**
```
AI 决策: 买入 ETH LONG $200
风险检查:
  ❌ ETH 累计亏损 -15% 超过限制 -10%
结果: 交易被拒绝
日志: [RiskManager] 🚫 Trade rejected for ETH:
       - ETH 累计亏损 15.0% 超过限制 10%
```

---

### **场景2：BTC、ETH 同时持有，再买 SOL**
```
当前持仓:
- BTC: $400 (40%)
- ETH: $300 (30%)

AI 决策: 买入 SOL LONG $250
风险检查:
  1. ✅ SOL 没有亏损历史
  2. ✅ SOL 单币种仓位 $250 < $407 (30%)
  3. ❌ SOL 与 BTC、ETH 高相关
     - BTC ↔ SOL: 0.75
     - ETH ↔ SOL: 0.80
     - 相关仓位: $400 + $300 + $250 = $950 (70% > 50%)
结果: 交易被拒绝
日志: [RiskManager] 🚫 Trade rejected for SOL:
       - SOL 与 [BTC, ETH] 高相关，总仓位 $950 超过限制 $678
```

---

### **场景3：成功的交易**
```
当前持仓:
- BTC: $250 (20%)

AI 决策: 买入 DOGE LONG $150
风险检查:
  1. ✅ DOGE 没有亏损历史
  2. ✅ DOGE 单币种仓位 $150 < $407 (30%)
  3. ✅ DOGE 与 BTC 相关性 0.60 < 0.70（不算高相关）
  4. ✅ 持仓数量 2 < 6
  5. ✅ 单笔交易 $150 < $271 (20%)
  6. ✅ Kelly 公式建议仓位 $180，实际 $150 符合
结果: 交易通过
日志: [Trading] ✅ Validated DOGE LONG - Leverage: 8x
```

---

## 🔧 **配置调整**

在 `lib/config.ts` 中调整参数：

```typescript
RISK_MANAGEMENT: {
  ENABLED: true,                     // 启用/禁用风险管理
  MAX_COIN_LOSS_PERCENT: 10,         // 单币种最大亏损 (%)
  MAX_COIN_EXPOSURE_PERCENT: 30,     // 单币种最大仓位 (%)
  MAX_CORRELATED_EXPOSURE: 50,       // 高相关币种总仓位 (%)
  KELLY_ENABLED: true,               // 启用Kelly公式
  KELLY_FRACTION: 0.25,              // Kelly分数 (0.25 = 保守)
  MAX_TOTAL_POSITIONS: 6,            // 最多持仓数
  MAX_SINGLE_POSITION_PERCENT: 20,   // 单笔交易最大占比 (%)
}
```

---

## 📊 **查看风险指标**

系统会自动记录所有风险事件到数据库：

```typescript
// 查询被拒绝的交易
const storage = getTradingStorage();
const rejectedDecisions = await storage.getAllAIDecisions()
  .filter(d => d.executionResult.includes('rejected'));

// 查看风险指标
const riskManager = getRiskManager();
const metrics = await riskManager.getRiskMetrics("DeepSeek V3.1", account);
console.log(metrics);
// {
//   totalExposure: 750,
//   exposurePercent: 55.3,
//   positionCount: 3,
//   coinExposures: { BTC: 400, ETH: 300, SOL: 50 },
//   correlatedExposure: 750
// }
```

---

## ⚠️ **注意事项**

1. **风险检查只在开仓时触发**，平仓不受限制
2. **相关性数据基于历史统计**，市场环境变化时可能失效
3. **Kelly公式需要至少10笔历史交易**才准确
4. **可以在配置中临时禁用** `ENABLED: false` 进行测试

---

## 🎓 **借鉴自 Nautilus Trader**

本风险管理系统借鉴了 Nautilus Trader 的以下理念：
- ✅ 多层次风险检查（单币种 → 相关性 → 总仓位）
- ✅ 科学的资金管理（Kelly公式）
- ✅ 实时风险监控
- ✅ 事件驱动架构（所有风险事件都记录）

---

**风险管理是交易成功的关键！** 🛡️
