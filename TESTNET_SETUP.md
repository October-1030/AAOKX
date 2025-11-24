# 🧪 Hyperliquid 测试网配置指南

> 在真实交易前，先在测试网上验证系统！

---

## 📍 测试网网址

### 主要网址
- **交易界面**: https://app.hyperliquid-testnet.xyz/trade
- **账户管理**: https://app.hyperliquid-testnet.xyz/
- **领取测试币**: https://app.hyperliquid-testnet.xyz/drip

### API 端点
- **API Base URL**: https://api.hyperliquid-testnet.xyz/info

---

## 🚀 快速开始（3步）

### 步骤1：获取测试网钱包

1. **访问测试网**：https://app.hyperliquid-testnet.xyz/

2. **连接钱包**：
   - 使用 MetaMask
   - 或创建新的测试钱包

3. **复制你的钱包地址**：
   ```
   例如：0x1234567890abcdef1234567890abcdef12345678
   ```

---

### 步骤2：领取测试币（免费）

#### 方法1：通过网页领取（推荐）

1. 访问：https://app.hyperliquid-testnet.xyz/drip
2. 点击 "Get 1,000 USDC"
3. 等待30秒
4. 完成！你会收到 **1,000 测试USDC**

#### 方法2：通过 Discord 领取

1. 加入 Discord：https://discord.gg/hyperliquid
2. 进入 `#testnet-faucet` 频道
3. 发送命令：
   ```
   /faucet 0xYourWalletAddressHere
   ```
4. 等待1-2分钟，会收到测试币

---

### 步骤3：配置API密钥

#### 3.1 生成 API Agent Wallet

1. 访问：https://app.hyperliquid-testnet.xyz/
2. 点击右上角头像 → **Settings**
3. 找到 **API Agent Wallet** 部分
4. 点击 **Generate New Agent Wallet**
5. **非常重要**：立即复制并保存显示的私钥！

   ```
   ⚠️  警告：私钥只显示一次，丢失无法找回！
   ```

6. 记录以下信息：
   ```
   主钱包地址: 0xYourMainWalletHere
   API 钱包地址: 0xYourAPIWalletHere
   API 私钥: 0xYourPrivateKeyHere
   ```

#### 3.2 配置 .env.local 文件

在项目根目录创建 `.env.local` 文件：

```bash
# ==================================================
# Hyperliquid 测试网配置
# ==================================================

# 主钱包地址（你的 MetaMask 地址）
HYPERLIQUID_MAIN_WALLET=0xYourMainWalletHere

# API 钱包地址（测试网生成的）
HYPERLIQUID_API_WALLET=0xYourAPIWalletHere

# API Secret Key（测试网私钥）⚠️ 重要：不要泄露！
HYPERLIQUID_API_SECRET=0xYourPrivateKeyHere

# 启用测试网模式
HYPERLIQUID_TESTNET=true

# DeepSeek API Key（必需）
DEEPSEEK_API_KEY=sk-or-v1-your-key-here
```

---

## ✅ 验证配置

### 检查余额

运行以下命令：

```bash
node check-balance.js
```

**预期输出**：

```
=== Hyperliquid 账户信息 ===

💰 账户余额
   账户总价值: $1,000.00
   可提现金额: $1,000.00
   已用保证金: $0.00
   网络模式: 测试网 (Testnet)

📊 当前持仓: 0 个
```

### 如果余额为 $0：

1. 确认已访问 https://app.hyperliquid-testnet.xyz/drip
2. 点击 "Get 1,000 USDC"
3. 等待30秒后重新运行 `node check-balance.js`

---

## 🎯 开始测试交易

### 启动系统

```bash
npm run dev
```

### 访问界面

打开浏览器：http://localhost:3000

### 观察日志

终端会显示：

```
[Hyperliquid] ✅ 客户端初始化成功
[Hyperliquid] 📍 模式: Testnet
[Hyperliquid] 👛 主钱包: 0x1234...
[Hyperliquid] 💰 账户余额: $1,000.00
```

---

## 📊 测试网 vs 主网对比

| 特性 | 测试网 | 主网 |
|------|--------|------|
| **网址** | app.hyperliquid-testnet.xyz | app.hyperliquid.xyz |
| **资金** | 免费测试币（1,000 USDC） | 真实资金 |
| **风险** | ✅ 零风险 | ⚠️ 真实风险 |
| **性能** | 与主网相同 | 生产环境 |
| **适用** | 学习、测试、开发 | 正式交易 |
| **配置** | `HYPERLIQUID_TESTNET=true` | `HYPERLIQUID_TESTNET=false` |

---

## 🔄 从测试网切换到主网

### ⚠️ 切换前确认：

- [ ] 测试网运行至少 **2周**
- [ ] 总回报率 > **+20%**
- [ ] 无重大bug或异常
- [ ] 你已准备好真实资金
- [ ] 已在主网创建账户和API密钥

### 切换步骤：

1. **在主网重新生成 API 密钥**
   - 访问：https://app.hyperliquid.xyz/
   - Settings → Generate New Agent Wallet
   - 保存新的主网私钥

2. **修改 .env.local**
   ```bash
   # 主网配置
   HYPERLIQUID_TESTNET=false  # ⚠️ 改为 false

   # 使用主网的 API 密钥
   HYPERLIQUID_MAIN_WALLET=0xYourMainnetWalletHere
   HYPERLIQUID_API_WALLET=0xYourMainnetAPIWalletHere
   HYPERLIQUID_API_SECRET=0xYourMainnetPrivateKeyHere
   ```

3. **修改初始资金配置**
   ```typescript
   // lib/config.ts
   SAFETY: {
     INITIAL_CAPITAL: 200, // 改成你的实际入金金额
   }
   ```

4. **⚠️ 重启系统**
   ```bash
   # Ctrl+C 停止
   npm run dev
   ```

5. **确认主网模式**

   日志应显示：
   ```
   [Hyperliquid] 📍 模式: Mainnet
   ```

---

## 🎓 测试网学习目标

### 阶段1目标（第1周）

- [ ] 成功连接测试网
- [ ] 执行至少 **10笔交易**
- [ ] 触发智能止盈系统（+30%, +50%）
- [ ] 理解系统日志输出
- [ ] 记录所有问题和bug

### 阶段2目标（第2周）

- [ ] 测试安全熔断机制（故意触发）
- [ ] 验证高点回撤保护
- [ ] 评估AI决策质量
- [ ] 优化配置参数
- [ ] 决定是否切换主网

---

## 📝 测试日志模板

每天记录：

```
日期: 2025-01-10
模式: 测试网
总回报: +5.2%
今日交易: 3笔（2盈1亏）
触发止盈: 1次（BTC +32%）
问题: 无
备注: 系统运行稳定
```

---

## ❓ 常见问题

### Q1：测试币用完了怎么办？

**A**：可以无限次领取！
- 访问 https://app.hyperliquid-testnet.xyz/drip
- 每次可领取 1,000 USDC

### Q2：测试网数据会保留吗？

**A**：测试网定期重置，数据不会保留。但你的学习经验会保留！

### Q3：测试网和主网的AI表现一样吗？

**A**：AI逻辑完全相同，但市场行为可能略有不同。

### Q4：在测试网赚的钱能提现吗？

**A**：不能。测试币没有真实价值，只用于学习。

### Q5：我需要在测试网待多久？

**A**：建议至少 **2周**，确保系统稳定且你理解所有机制。

---

## 🔗 有用的链接

| 资源 | 链接 |
|------|------|
| 测试网交易界面 | https://app.hyperliquid-testnet.xyz/trade |
| 领取测试币 | https://app.hyperliquid-testnet.xyz/drip |
| Hyperliquid 文档 | https://hyperliquid.gitbook.io/ |
| Discord 社区 | https://discord.gg/hyperliquid |
| GitHub 仓库 | https://github.com/hyperliquid-dex/ |

---

## ✅ 配置检查清单

在开始测试前，确认：

- [ ] ✅ 已访问测试网网址
- [ ] ✅ 已连接钱包
- [ ] ✅ 已领取1,000测试USDC
- [ ] ✅ 已生成API密钥
- [ ] ✅ 已配置 .env.local
- [ ] ✅ `node check-balance.js` 显示余额
- [ ] ✅ 已阅读 SAFETY_GUIDE.md
- [ ] ✅ 准备开始测试

### 如果以上全部打勾：

```bash
npm run dev
```

**开始你的测试网之旅！记住：这是零风险学习的完美机会。** 🚀
