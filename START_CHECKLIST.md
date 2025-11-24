# ✅ 启动前检查清单

> 在开始交易前，请逐项检查以下内容

---

## 📋 配置检查

### 1. 环境变量（`.env.local`）

```bash
# 必需配置
DEEPSEEK_API_KEY=sk-or-v1-xxxxx  # ✅ 已配置
HYPERLIQUID_API_KEY=xxxxx        # ⚠️  使用真实交易时需要
HYPERLIQUID_PRIVATE_KEY=xxxxx    # ⚠️  使用真实交易时需要
```

**检查方法**：
```bash
# Windows
type .env.local | findstr "DEEPSEEK_API_KEY"

# Linux/Mac
grep "DEEPSEEK_API_KEY" .env.local
```

---

### 2. 系统配置（`lib/config.ts`）

```typescript
export const CONFIG = {
  // ✅ 第一阶段：模拟测试
  USE_REAL_MARKET_DATA: true,  // ✅ 使用真实价格
  USE_REAL_AI: true,           // ✅ 使用真实AI
  USE_REAL_TRADING: true,      // ⚠️  测试网模式

  // ✅ 交易周期
  TRADING_INTERVAL_MS: 180000, // 3分钟/次

  // ✅ 安全保护
  SAFETY: {
    MAX_TOTAL_LOSS_PERCENT: 20,   // -20% 熔断
    MAX_DAILY_LOSS_PERCENT: 5,    // -5% 暂停
    INITIAL_CAPITAL: 10000,       // ⚠️  改成你的实际资金
  },
};
```

**修改提醒**：
- [ ] `INITIAL_CAPITAL` 改成你的实际入金金额

---

### 3. 真实交易执行器（`lib/realTradingExecutor.ts`）

```typescript
export class RealTradingExecutor {
  constructor(config: Partial<RealTradingExecutorConfig> = {}) {
    this.config = {
      dryRun: config.dryRun ?? true,  // ⚠️  true=模拟, false=真实
      maxDailyTrades: 150,             // ✅ 已设置
    };
  }
}
```

**阶段设置**：
- **阶段1（模拟测试）**: `dryRun: true`
- **阶段2（小资金实盘）**: `dryRun: false`

---

## 🔍 功能验证

### 智能止盈系统

检查文件：`lib/tradingEngine.ts`

- [x] 分批止盈（+50%, +100%, +200%）
- [x] 高点回撤保护（15%回撤触发）
- [x] 移动止损（+30%, +50%, +100%）

### 安全熔断机制

检查文件：`lib/tradingEngine.ts`

- [x] 总亏损熔断（-20%）
- [x] 单日亏损限制（-5%）
- [x] 每日交易次数限制（150次）

---

## 🚀 启动步骤

### 第一次启动

```bash
# 1. 安装依赖（如果还没装）
npm install

# 2. 启动开发服务器
npm run dev

# 3. 打开浏览器
# 访问 http://localhost:3000
```

### 预期看到的日志

```
✅ 正常日志：
[TradingEngine] 🔍 正在调用 DeepSeek V3.1 API...
[DeepSeek V3.1] ✅ API 调用成功
[Safety] 📅 每日追踪已重置，今日起始权益: $10,000.00
[SmartProfit] 🔒 BTC 移动止损激活...

❌ 错误日志（需要修复）：
❌ DEEPSEEK_API_KEY 未设置！
❌ API 错误 (401): Unauthorized
🚨 总亏损熔断触发！（正常保护，不是bug）
```

---

## 📊 监控要点

### 每天检查（5分钟）

1. **访问** `http://localhost:3000`

2. **查看总回报率**
   - 绿色（正收益）：✅ 继续观察
   - 红色（负收益）：⚠️  分析原因

3. **安全状态**
   - `tradingHalted`: 应该是 `false`
   - `dailyLossPaused`: 应该是 `false`

4. **查看终端日志**
   - 是否有 `[SmartProfit]` 触发记录
   - 是否有错误或警告

---

## 🛑 紧急停止

如果遇到问题，立即停止：

### 方法1：停止服务器

```bash
# 终端中按
Ctrl + C
```

### 方法2：平掉所有仓位

```javascript
// 浏览器控制台执行
fetch('/api/close-all-positions', { method: 'POST' })
```

### 方法3：修改配置

```typescript
// lib/config.ts
export const CONFIG = {
  USE_REAL_TRADING: false, // 改为 false 停止真实交易
};
```

---

## 📝 阶段1任务清单

### 模拟测试（1-3天）

- [ ] **第1天**
  - [ ] 启动系统
  - [ ] 观察日志1小时
  - [ ] 检查AI是否正常决策
  - [ ] 记录初始状态

- [ ] **第2天**
  - [ ] 检查总回报率
  - [ ] 查看完成的交易记录
  - [ ] 验证智能止盈是否触发
  - [ ] 记录异常（如果有）

- [ ] **第3天**
  - [ ] 完整复盘3天表现
  - [ ] 决定是否进入阶段2
  - [ ] 准备小额资金

---

## 📝 阶段2任务清单

### 小资金实盘（1-2周）

**前置条件**：
- [ ] 阶段1运行正常
- [ ] 准备好 $100-$500 资金
- [ ] 已配置 Hyperliquid API Key

**操作**：
- [ ] 修改 `INITIAL_CAPITAL` 为实际金额
- [ ] 设置 `dryRun: false`
- [ ] 入金到 Hyperliquid
- [ ] 启动系统
- [ ] 每天检查10分钟

---

## ⚠️  风险提醒

### 请确认你已理解：

- [ ] 加密货币交易有极高风险
- [ ] 可能损失全部投入资金
- [ ] AI系统不保证盈利
- [ ] 仅使用你能承受损失的资金
- [ ] 定期检查系统运行状态
- [ ] 遇到问题立即停止

---

## 📞 需要帮助？

### 查看文档

- `README.md` - 项目总览
- `SAFETY_GUIDE.md` - 详细安全指南
- `API_DOCUMENTATION.md` - API接口文档

### 常用命令

```bash
# 查看配置
cat lib/config.ts | grep -A 10 "SAFETY"

# 查看日志
npm run dev | tee trading.log

# 检查环境变量
echo $DEEPSEEK_API_KEY
```

---

## ✅ 最终确认

### 启动前最后检查：

- [ ] ✅ 已阅读 `SAFETY_GUIDE.md`
- [ ] ✅ 已配置 `.env.local`
- [ ] ✅ 已修改 `INITIAL_CAPITAL`
- [ ] ✅ 明确当前阶段（模拟/实盘）
- [ ] ✅ 理解所有风险
- [ ] ✅ 准备好监控系统

### 如果以上全部打勾，你可以：

```bash
npm run dev
```

**祝你交易顺利！记住：慢慢来，数据说话，安全第一。** 🚀
