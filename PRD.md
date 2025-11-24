# 📋 项目需求文档 (PRD)
# Alpha Arena - AI加密货币交易竞技平台

**版本**: 2.0
**日期**: 2025-01-24
**状态**: 已实现
**作者**: 开发团队

---

## 📑 目录

1. [项目概述](#1-项目概述)
2. [目标与愿景](#2-目标与愿景)
3. [目标用户](#3-目标用户)
4. [核心功能需求](#4-核心功能需求)
5. [技术需求](#5-技术需求)
6. [系统架构](#6-系统架构)
7. [数据模型](#7-数据模型)
8. [API设计](#8-api设计)
9. [用户界面需求](#9-用户界面需求)
10. [安全与风险管理](#10-安全与风险管理)
11. [性能需求](#11-性能需求)
12. [测试需求](#12-测试需求)
13. [部署需求](#13-部署需求)
14. [未来路线图](#14-未来路线图)

---

## 1. 项目概述

### 1.1 项目背景

Alpha Arena 是一个完全自动化的AI驱动加密货币交易竞技平台。该平台允许多个大型语言模型（LLM）在真实市场环境中自主进行交易，展示不同AI模型的交易策略和决策能力。

### 1.2 项目定位

- **类型**: AI交易竞技平台 + 量化交易系统
- **灵感来源**: [nof1.ai](https://nof1.ai) Alpha Arena
- **创新点**: 集成 Nautilus Trader 专业交易架构，支持真实交易所对接

### 1.3 核心价值

1. **教育价值**: 演示AI在金融决策中的应用
2. **研究价值**: 对比不同AI模型的交易表现
3. **实用价值**: 可扩展为真实交易系统
4. **技术价值**: 展示事件驱动、风险管理等专业架构

---

## 2. 目标与愿景

### 2.1 短期目标（已实现）

- ✅ 支持6个AI模型同时交易
- ✅ 集成 Hyperliquid 测试网交易
- ✅ 实时交易数据可视化
- ✅ 完整的风险管理系统
- ✅ 回测功能支持策略验证
- ✅ 事件驱动架构确保可扩展性

### 2.2 中期目标（规划中）

- 🎯 支持更多交易所（Binance、OKX等）
- 🎯 用户可自定义AI策略
- 🎯 社交功能（分享策略、跟单）
- 🎯 移动端应用
- 🎯 实盘交易支持（主网）

### 2.3 长期愿景

- 🚀 成为领先的AI量化交易平台
- 🚀 支持传统金融市场（股票、期货）
- 🚀 构建AI交易策略市场
- 🚀 开放API供第三方开发者接入

---

## 3. 目标用户

### 3.1 主要用户群体

| 用户类型 | 特征 | 需求 |
|---------|------|------|
| **量化交易爱好者** | 有编程基础，了解交易策略 | 学习AI交易策略、回测验证 |
| **AI研究人员** | 研究LLM应用 | 对比不同模型决策能力 |
| **加密货币交易者** | 寻找自动化交易方案 | 稳定盈利、风险控制 |
| **开发者** | 想构建量化系统 | 学习架构设计、代码复用 |
| **教育机构** | 教学用途 | 演示AI应用、教学案例 |

### 3.2 用户画像示例

**用户A - 量化爱好者**
- 年龄: 25-35岁
- 技能: Python/TypeScript, 基础量化知识
- 目标: 学习如何构建AI交易系统
- 痛点: 不知道如何集成真实交易所、风险管理复杂

**用户B - AI研究员**
- 年龄: 28-40岁
- 技能: 机器学习、大模型调优
- 目标: 研究LLM在金融决策中的表现
- 痛点: 缺少真实交易环境测试平台

---

## 4. 核心功能需求

### 4.1 AI交易引擎

#### 4.1.1 AI模型管理

**需求ID**: REQ-AI-001

**描述**: 系统支持多个AI模型同时运行，每个模型独立决策和交易。

**功能点**:
- 支持6个预配置AI模型：
  - DeepSeek V3.1（已集成真实API）
  - Claude 4.5 Sonnet（模拟）
  - GPT-5（模拟）
  - Gemini 2.5 Pro（模拟）
  - Qwen 3 Max（模拟）
  - Grok 4（模拟）
- 每个模型独立账户（初始资金 $1,000）
- 模型可配置交易策略描述
- 模型运行状态监控

**优先级**: P0（必须）

**验收标准**:
- ✅ 6个模型可同时运行
- ✅ 每个模型独立账户和持仓
- ✅ DeepSeek API集成正常
- ✅ 交易决策互不干扰

---

#### 4.1.2 三层提示词架构

**需求ID**: REQ-AI-002

**描述**: 实现标准的三层提示词系统，确保AI决策的结构化和可追溯性。

**功能点**:

**第1层 - USER_PROMPT (数据输入层)**:
```json
{
  "marketContext": {
    "tradingDuration": "运行时长",
    "totalCalls": "总调用次数",
    "performance": "当前表现"
  },
  "technicalData": {
    "currentState": {
      "price": "当前价格",
      "EMA": { "20": 价格, "50": 价格, "200": 价格 },
      "MACD": { "macd": 值, "signal": 值, "histogram": 值 },
      "RSI": { "14": 值 }
    },
    "intradaySeries": "最近10根K线",
    "macroContext": "4小时级别数据"
  },
  "positions": "当前持仓列表"
}
```

**第2层 - CHAIN_OF_THOUGHT (分析层)**:
- 整体市场评估
- 逐个持仓分析
- 新机会扫描
- 最终决策总结

**第3层 - TRADING_DECISIONS (输出层)**:
```json
{
  "decisions": [
    {
      "coin": "BTC",
      "action": "buy_to_enter | sell_to_enter | close | hold",
      "confidence": 0-100,
      "leverage": 1-20,
      "notional": 100,
      "exitPlan": {
        "invalidation": "失效条件",
        "stopLoss": 价格,
        "takeProfit": 价格
      }
    }
  ]
}
```

**优先级**: P0（必须）

**验收标准**:
- ✅ AI接收正确格式的市场数据
- ✅ 生成结构化的思维链
- ✅ 输出符合JSON schema的决策
- ✅ 所有交易必须包含止损/止盈

---

#### 4.1.3 交易执行引擎

**需求ID**: REQ-TRADE-001

**描述**: 将AI决策转化为实际订单，管理订单生命周期。

**功能点**:
- **订单类型支持**:
  - 市价单（Market Order）- 立即执行
  - 限价单（Limit Order）- 未来支持
  - 止损单（Stop Loss）- 自动触发
  - 止盈单（Take Profit）- 自动触发

- **执行流程**:
  1. 接收AI决策
  2. 风险管理预检查
  3. 提交订单到交易所
  4. 订单状态追踪
  5. 持仓状态更新
  6. 触发事件通知

- **持仓管理**:
  - 实时计算未实现盈亏
  - 自动检查止损/止盈条件
  - 移动止损（Trailing Stop）支持
  - 最高浮盈追踪

**优先级**: P0（必须）

**验收标准**:
- ✅ 订单成功提交到 Hyperliquid
- ✅ 止损/止盈自动触发
- ✅ 持仓盈亏实时更新
- ✅ 所有交易记录到数据库

---

### 4.2 市场数据系统

#### 4.2.1 实时行情数据

**需求ID**: REQ-DATA-001

**描述**: 从交易所获取实时K线、深度、成交等数据。

**功能点**:
- **数据源**:
  - Hyperliquid WebSocket（已实现）
  - CoinGecko REST API（价格数据）
  - Binance API（备用数据源）

- **数据类型**:
  - 10分钟K线（短期交易）
  - 4小时K线（宏观趋势）
  - 实时Tick数据
  - 24小时交易量

- **更新频率**:
  - WebSocket: 实时推送
  - REST API: 每60秒轮询一次

**优先级**: P0（必须）

**验收标准**:
- ✅ 数据延迟 < 1秒
- ✅ 支持6个币种（BTC, ETH, SOL, BNB, DOGE, XRP）
- ✅ WebSocket断线自动重连
- ✅ 数据格式标准化

---

#### 4.2.2 技术指标计算

**需求ID**: REQ-DATA-002

**描述**: 基于K线数据计算技术指标，供AI决策使用。

**功能点**:
- **支持的指标**:
  - EMA（指数移动平均）: 20、50、200周期
  - MACD（异同移动平均）: 12/26/9参数
  - RSI（相对强弱指数）: 14周期
  - ATR（平均真实波幅）: 14周期
  - 成交量比率（Volume Ratio）
  - 布林带（Bollinger Bands）- 未来支持

- **计算优化**:
  - 增量计算（只计算新K线）
  - 缓存历史指标值
  - 多周期并行计算

**优先级**: P0（必须）

**验收标准**:
- ✅ 所有指标计算准确
- ✅ 计算延迟 < 100ms
- ✅ 支持多周期（10分钟、4小时）
- ✅ 指标值包含在AI输入数据中

---

### 4.3 风险管理系统

#### 4.3.1 六层风险控制

**需求ID**: REQ-RISK-001

**描述**: 多层风险防护机制，防止账户爆仓或过度亏损。

**功能点**:

**第1层 - 单币种亏损限制**:
- 单个币种累计亏损 ≤ 初始资金的 10%
- 达到限制后禁止该币种新开仓
- 示例：BTC亏损达到 $100，禁止继续交易BTC

**第2层 - 单币种持仓限制**:
- 单个币种占用资金 ≤ 总权益的 30%
- 防止过度集中风险
- 示例：账户 $1000，单币种最多持仓 $300

**第3层 - 关联风险检查**:
- 相关币种总敞口 ≤ 50%
- 币种相关性分组：
  - 高相关：BTC-ETH-BNB
  - 中等相关：SOL-DOGE-XRP
- 示例：BTC+ETH+BNB 总仓位不超过 $500

**第4层 - Kelly公式仓位管理**:
- 根据历史胜率动态计算最优仓位
- 公式：`Kelly% = (胜率 * 平均盈利 - (1-胜率) * 平均亏损) / 平均盈利`
- 如果胜率不足，自动降低仓位

**第5层 - 持仓数量限制**:
- 同时最多持有 6 个仓位
- 防止管理复杂度过高

**第6层 - 单笔交易限制**:
- 单笔交易 ≤ 总权益的 20%
- 根据账户余额动态调整：
  - $0-10: 最大40%，杠杆2x
  - $10-50: 最大35%，杠杆3x
  - $50-200: 最大20%，杠杆3x
  - $200+: 最大15%，杠杆10x

**优先级**: P0（必须）

**验收标准**:
- ✅ 所有6层检查在开仓前执行
- ✅ 不符合条件的订单被拒绝
- ✅ 详细的拒绝原因日志
- ✅ 风险限制可配置

---

#### 4.3.2 安全熔断机制

**需求ID**: REQ-RISK-002

**描述**: 在极端情况下自动暂停交易，保护资金安全。

**功能点**:

**熔断触发条件**:
1. **总亏损熔断**:
   - 触发条件：总权益亏损 ≥ 初始资金的 30%
   - 响应：立即平掉所有持仓，停止交易
   - 示例：$1000 亏到 $700，触发熔断

2. **单日亏损熔断**:
   - 触发条件：当日亏损 ≥ 初始资金的 15%
   - 响应：当日停止交易，次日自动重置
   - 示例：今天亏损 $150，暂停交易至明天

3. **连续亏损熔断**:
   - 触发条件：连续5笔交易亏损
   - 响应：暂停1小时，重新评估策略

**恢复机制**:
- 单日熔断：UTC 00:00 自动重置
- 总亏损熔断：需手动恢复
- 连续亏损：1小时后自动恢复

**优先级**: P0（必须）

**验收标准**:
- ✅ 熔断条件准确触发
- ✅ 触发后立即停止新订单
- ✅ 发送熔断事件通知
- ✅ 日志记录熔断原因

---

### 4.4 数据持久化系统

#### 4.4.1 数据库设计

**需求ID**: REQ-DB-001

**描述**: 使用 Prisma + SQLite 持久化所有交易数据。

**数据模型**:

**1. Trade（已完成交易）**:
```prisma
model Trade {
  id          String   @id @default(cuid())
  modelName   String   // AI模型名称
  coin        String   // 币种
  side        String   // LONG/SHORT

  entryPrice  Float    // 入场价格
  exitPrice   Float    // 出场价格

  leverage    Int      // 杠杆
  notional    Float    // 名义价值

  pnl         Float    // 盈亏
  pnlPercent  Float    // 盈亏百分比

  openedAt    DateTime // 开仓时间
  closedAt    DateTime // 平仓时间

  exitReason  String   // 退出原因
  createdAt   DateTime @default(now())
}
```

**2. PositionSnapshot（持仓快照）**:
```prisma
model PositionSnapshot {
  id                    String   @id @default(cuid())
  modelName             String
  coin                  String
  side                  String

  leverage              Int
  notional              Float
  entryPrice            Float
  currentPrice          Float
  liquidationPrice      Float

  unrealizedPnL         Float
  unrealizedPnLPercent  Float

  maxUnrealizedPnL      Float?
  trailingStopActivated Boolean

  stopLoss              Float
  takeProfit            Float
  invalidation          String

  openedAt              DateTime
  snapshotAt            DateTime @default(now())
}
```

**3. AccountSnapshot（账户快照）**:
```prisma
model AccountSnapshot {
  id              String   @id
  modelName       String

  availableCash   Float
  totalEquity     Float
  totalReturn     Float

  tradingDuration BigInt
  totalCalls      Int
  positionsCount  Int

  timestamp       DateTime @default(now())
}
```

**4. AIDecision（AI决策记录）**:
```prisma
model AIDecision {
  id                String   @id
  modelName         String

  coin              String
  action            String
  confidence        Float
  leverage          Int?
  notional          Float?

  stopLoss          Float?
  takeProfit        Float?
  invalidation      String?

  chainOfThought    String   // 思维链

  executed          Boolean  @default(false)
  executionResult   String?

  timestamp         DateTime @default(now())
}
```

**5. EquityHistory（权益曲线）**:
```prisma
model EquityHistory {
  id        String   @id
  modelName String
  equity    Float
  timestamp DateTime @default(now())
}
```

**6. SystemLog（系统日志）**:
```prisma
model SystemLog {
  id        String   @id
  level     String   // info/warn/error
  category  String   // trading/risk/system
  message   String
  metadata  String?  // JSON
  timestamp DateTime @default(now())
}
```

**优先级**: P0（必须）

**验收标准**:
- ✅ 所有交易自动保存
- ✅ 支持历史数据查询
- ✅ 权益曲线完整记录
- ✅ 数据库文件大小可控（< 100MB）

---

#### 4.4.2 存储服务类

**需求ID**: REQ-DB-002

**描述**: 封装数据库操作，提供统一的存储接口。

**核心方法**:
```typescript
class TradingStorage {
  // 保存交易
  async saveTrade(trade: CompletedTrade): Promise<void>

  // 保存持仓快照
  async savePositionSnapshot(modelName: string, position: Position): Promise<void>

  // 保存账户快照
  async saveAccountSnapshot(modelName: string, account: AccountStatus): Promise<void>

  // 保存AI决策
  async saveAIDecision(
    modelName: string,
    decision: TradingDecision,
    chainOfThought: string,
    executed: boolean,
    result: string
  ): Promise<void>

  // 保存权益点
  async saveEquityPoint(modelName: string, equity: number): Promise<void>

  // 查询所有交易
  async getAllTrades(modelName?: string): Promise<CompletedTrade[]>

  // 查询权益历史
  async getEquityHistory(modelName: string, limit: number): Promise<{timestamp: number; equity: number}[]>

  // 查询交易统计
  async getTradingStats(modelName: string): Promise<TradingStats>

  // 清理旧数据
  async cleanOldData(daysToKeep: number): Promise<void>
}
```

**优先级**: P0（必须）

**验收标准**:
- ✅ 所有方法支持异步操作
- ✅ 错误处理完善
- ✅ 全局单例模式
- ✅ 数据库连接池管理

---

### 4.5 回测系统

#### 4.5.1 历史数据获取

**需求ID**: REQ-BACKTEST-001

**描述**: 从交易所API获取历史K线数据用于回测。

**功能点**:
- **数据源**: Binance API
- **支持的K线周期**: 1m, 5m, 15m, 1h, 4h, 1d
- **数据范围**: 最多获取1000根K线
- **本地缓存**: 可选保存到JSON文件
- **数据格式**:
```typescript
interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

**优先级**: P1（重要）

**验收标准**:
- ✅ 成功获取历史数据
- ✅ 数据完整无缺失
- ✅ 支持缓存机制
- ✅ 网络错误自动重试

---

#### 4.5.2 回测引擎

**需求ID**: REQ-BACKTEST-002

**描述**: 使用历史数据模拟交易，评估策略表现。

**功能点**:

**回测流程**:
1. 加载历史K线数据
2. 按时间顺序回放市场数据
3. AI根据历史数据做出决策
4. 模拟订单执行（考虑滑点和手续费）
5. 更新账户状态和持仓
6. 记录所有交易
7. 生成性能报告

**模拟参数**:
- 滑点（Slippage）: 0.1%
- 手续费（Maker）: 0.02%
- 手续费（Taker）: 0.05%
- 初始资金: $1,000

**性能指标**:
- 总回报（Total Return）
- 夏普比率（Sharpe Ratio）
- 索提诺比率（Sortino Ratio）
- 最大回撤（Max Drawdown）
- 盈利因子（Profit Factor）
- 胜率（Win Rate）
- 平均盈利/亏损
- 总交易次数

**优先级**: P1（重要）

**验收标准**:
- ✅ 回测结果与实盘一致（误差 < 5%）
- ✅ 所有性能指标计算准确
- ✅ 支持多币种同时回测
- ✅ 生成JSON格式报告

---

#### 4.5.3 命令行工具

**需求ID**: REQ-BACKTEST-003

**描述**: 提供便捷的回测运行脚本。

**使用方式**:
```bash
# 运行回测
npm run backtest

# 配置参数
const config = {
  coins: ['BTC', 'ETH', 'SOL'],
  days: 30,
  interval: '10m',
  modelName: 'deepseek-v3-1'
};
```

**优先级**: P2（可选）

**验收标准**:
- ✅ 一键运行回测
- ✅ 参数可配置
- ✅ 进度实时显示
- ✅ 结果保存到文件

---

### 4.6 事件驱动系统

#### 4.6.1 事件类型定义

**需求ID**: REQ-EVENT-001

**描述**: 定义系统中所有可能发生的事件类型。

**事件分类**:

**订单事件（Order Events）**:
- ORDER_SUBMITTED - 订单已提交
- ORDER_ACCEPTED - 订单被接受
- ORDER_REJECTED - 订单被拒绝
- ORDER_FILLED - 订单成交
- ORDER_CANCELLED - 订单取消

**持仓事件（Position Events）**:
- POSITION_OPENED - 持仓开启
- POSITION_MODIFIED - 持仓修改
- POSITION_CLOSED - 持仓关闭

**风险事件（Risk Events）**:
- RISK_LIMIT_BREACHED - 风险限制触发
- STOP_LOSS_TRIGGERED - 止损触发
- TAKE_PROFIT_TRIGGERED - 止盈触发

**AI决策事件（AI Decision Events）**:
- AI_DECISION_MADE - AI做出决策
- AI_DECISION_EXECUTED - 决策执行成功
- AI_DECISION_REJECTED - 决策被拒绝

**系统事件（System Events）**:
- TRADING_CYCLE_START - 交易周期开始
- TRADING_CYCLE_END - 交易周期结束
- MARKET_DATA_UPDATED - 市场数据更新
- ACCOUNT_UPDATED - 账户状态更新

**安全事件（Safety Events）**:
- CIRCUIT_BREAKER_TRIGGERED - 熔断触发
- DAILY_LOSS_LIMIT_REACHED - 单日亏损限制

**优先级**: P1（重要）

**验收标准**:
- ✅ 所有事件类型定义清晰
- ✅ 事件数据结构统一
- ✅ TypeScript类型安全
- ✅ 事件可序列化（JSON）

---

#### 4.6.2 EventBus核心类

**需求ID**: REQ-EVENT-002

**描述**: 实现发布-订阅模式的事件总线。

**核心功能**:

```typescript
class EventBus {
  // 订阅事件
  subscribe(
    eventType: TradingEventType,
    handler: EventHandler,
    filter?: EventFilter
  ): string

  // 订阅多个事件类型
  subscribeMultiple(
    eventTypes: TradingEventType[],
    handler: EventHandler,
    filter?: EventFilter
  ): string[]

  // 订阅所有事件
  subscribeAll(handler: EventHandler): string

  // 取消订阅
  unsubscribe(subscriptionId: string): void

  // 发射事件（异步）
  async emit(event: TradingEvent): Promise<void>

  // 发射事件（同步）
  emitSync(event: TradingEvent): void

  // 获取事件历史
  getHistory(filter?: EventFilter): TradingEvent[]

  // 获取最近事件
  getRecentEvents(limit: number): TradingEvent[]

  // 清空历史
  clearHistory(): void

  // 启用/禁用事件系统
  enable(): void
  disable(): void

  // 获取统计信息
  getStats(): EventBusStats
}
```

**特性**:
- 全局单例模式
- 事件过滤（按模型、时间、币种）
- 事件历史记录（最多1000个）
- 异步处理（不阻塞主流程）
- 错误隔离（单个处理器错误不影响其他）

**优先级**: P1（重要）

**验收标准**:
- ✅ 事件正确分发到订阅者
- ✅ 过滤器正常工作
- ✅ 错误不传播到其他处理器
- ✅ 性能开销 < 5ms/事件

---

### 4.7 交易所集成

#### 4.7.1 Hyperliquid集成

**需求ID**: REQ-EXCHANGE-001

**描述**: 集成 Hyperliquid DEX，支持测试网和主网交易。

**功能点**:

**账户管理**:
- 主钱包地址管理
- API钱包权限管理
- 账户余额查询
- 持仓查询

**订单操作**:
- 市价单下单
- 限价单下单
- 取消订单
- 批量下单

**WebSocket订阅**:
- 实时价格推送
- 账户更新推送
- 订单状态推送
- 持仓变动推送

**配置管理**:
```typescript
interface HyperliquidConfig {
  network: 'testnet' | 'mainnet';
  mainWallet: string;
  apiWallet: string;
  privateKey: string;
  wsUrl: string;
  restUrl: string;
}
```

**优先级**: P0（必须）

**验收标准**:
- ✅ 测试网交易成功
- ✅ WebSocket稳定连接
- ✅ 订单延迟 < 200ms
- ✅ 错误处理完善

---

### 4.8 性能监控与统计

#### 4.8.1 实时性能指标

**需求ID**: REQ-MONITOR-001

**描述**: 实时计算和展示每个AI模型的交易表现。

**指标清单**:

**收益指标**:
- 总回报（Total Return %）
- 总权益（Total Equity）
- 已实现盈亏（Realized P&L）
- 未实现盈亏（Unrealized P&L）

**风险指标**:
- 夏普比率（Sharpe Ratio）
- 最大回撤（Max Drawdown）
- 胜率（Win Rate）
- 盈亏比（Profit/Loss Ratio）

**交易指标**:
- 总交易次数（Total Trades）
- 盈利交易次数（Winning Trades）
- 亏损交易次数（Losing Trades）
- 平均持仓时间（Avg. Holding Time）

**活动指标**:
- 当前持仓数（Active Positions）
- 运行时长（Trading Duration）
- AI调用次数（Total Calls）

**优先级**: P0（必须）

**验收标准**:
- ✅ 所有指标实时更新
- ✅ 计算准确无误
- ✅ 排行榜自动排序
- ✅ 历史数据可追溯

---

## 5. 技术需求

### 5.1 技术栈

**前端**:
- **框架**: Next.js 15（App Router）
- **语言**: TypeScript 5.7
- **样式**: Tailwind CSS 3.4
- **图表**: Recharts 2.x
- **状态管理**: React Hooks（useState, useEffect）
- **HTTP客户端**: Fetch API

**后端**:
- **运行时**: Node.js 18+
- **API**: Next.js API Routes（Serverless）
- **数据库**: SQLite + Prisma 7.0
- **WebSocket**: ws 库

**AI集成**:
- **DeepSeek**: 官方SDK
- **其他模型**: 预留API接口

**交易所SDK**:
- **Hyperliquid**: @hyperliquid/sdk
- **Binance**: binance-api-node（数据获取）

### 5.2 项目结构

```
alpha-arena-clone/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── trading/
│   │   │   └── route.ts          # 主交易API
│   │   ├── hyperliquid-account/
│   │   │   └── route.ts          # Hyperliquid账户API
│   │   └── since-inception-values/
│   │       └── route.ts          # 历史数据API
│   ├── layout.tsx                # 根布局
│   ├── page.tsx                  # 主页面
│   └── globals.css               # 全局样式
│
├── components/                   # React组件
│   ├── Leaderboard.tsx           # 排行榜
│   ├── EquityChart.tsx           # 权益曲线图
│   ├── MarketOverview.tsx        # 市场概览
│   ├── ModelChat.tsx             # AI思维链展示
│   └── TradingControls.tsx       # 交易控制面板
│
├── lib/                          # 核心业务逻辑
│   ├── events/                   # 事件系统
│   │   ├── types.ts              # 事件类型定义
│   │   └── eventBus.ts           # EventBus实现
│   │
│   ├── persistence/              # 数据持久化
│   │   └── storage.ts            # 存储服务
│   │
│   ├── backtesting/              # 回测系统
│   │   ├── historicalData.ts    # 历史数据
│   │   └── backtestEngine.ts    # 回测引擎
│   │
│   ├── riskManagement.ts         # 风险管理器
│   ├── tradingEngine.ts          # 交易引擎
│   ├── tradingEngineManager.ts   # 引擎管理器
│   ├── hyperliquidClient.ts      # Hyperliquid客户端
│   ├── realTradingExecutor.ts    # 真实交易执行器
│   ├── marketData.ts             # 市场数据服务
│   ├── indicators.ts             # 技术指标计算
│   ├── tradingPromptNOF1.ts      # 提示词模板
│   ├── aiModels.ts               # AI模型配置
│   ├── tradingConfig.ts          # 交易配置
│   └── config.ts                 # 全局配置
│
├── types/
│   └── trading.ts                # TypeScript类型定义
│
├── prisma/
│   ├── schema.prisma             # Prisma数据库模型
│   └── trading.db                # SQLite数据库文件
│
├── docs/                         # 文档
│   ├── PRD.md                    # 本文档
│   ├── README.md                 # 项目介绍
│   ├── QUICKSTART.md             # 快速开始
│   ├── RISK_MANAGEMENT_GUIDE.md  # 风险管理指南
│   ├── BACKTEST_GUIDE.md         # 回测指南
│   ├── EVENT_SYSTEM_GUIDE.md     # 事件系统指南
│   └── NAUTILUS_INTEGRATION_SUMMARY.md # 集成总结
│
└── .env.local                    # 环境变量
```

### 5.3 环境变量

```env
# AI模型API密钥
DEEPSEEK_API_KEY=sk-...              # DeepSeek API密钥（必需）
ANTHROPIC_API_KEY=sk-ant-...         # Claude API密钥（可选）
OPENAI_API_KEY=sk-...                # OpenAI API密钥（可选）

# Hyperliquid配置
HYPERLIQUID_NETWORK=testnet          # 网络类型：testnet/mainnet
HYPERLIQUID_MAIN_WALLET=0x...        # 主钱包地址
HYPERLIQUID_API_WALLET=0x...         # API钱包地址
HYPERLIQUID_PRIVATE_KEY=0x...        # 私钥（谨慎保管）

# 数据库
DATABASE_URL=file:./prisma/trading.db

# 系统配置
TRADING_MODE=live                    # 交易模式：live/simulation
MARKET_DATA_SOURCE=hyperliquid       # 数据源：hyperliquid/coingecko
AI_MODEL_MODE=real                   # AI模式：real/mock
```

---

## 6. 系统架构

### 6.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         用户界面层                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 排行榜   │  │ 权益图   │  │ 市场数据 │  │ 控制面板 │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ React Components
┌───────────────────────────┴─────────────────────────────────┐
│                      API Routes层                            │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │ /api/trading   │  │ /api/account   │  │ /api/history  │ │
│  └────────────────┘  └────────────────┘  └───────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │ Next.js API Routes
┌───────────────────────────┴─────────────────────────────────┐
│                     核心业务逻辑层                           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             Trading Engine Manager                    │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │ Model 1    │  │ Model 2    │  │ Model N    │     │  │
│  │  │ State      │  │ State      │  │ State      │     │  │
│  │  └────────────┘  └────────────┘  └────────────┘     │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌─────────────┐  ┌────────┴─────┐  ┌──────────────┐      │
│  │ AI Models   │  │ Risk Manager │  │ Event Bus    │      │
│  │ - DeepSeek  │  │ - 6层检查    │  │ - 订阅/发布  │      │
│  │ - Claude    │  │ - 熔断机制   │  │ - 历史记录   │      │
│  │ - GPT...    │  │ - Kelly公式  │  │ - 过滤器     │      │
│  └─────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Market Data  │  │ Indicators   │  │ Storage      │     │
│  │ - Real-time  │  │ - EMA        │  │ - Prisma     │     │
│  │ - WebSocket  │  │ - MACD       │  │ - SQLite     │     │
│  │ - REST API   │  │ - RSI, ATR   │  │ - CRUD       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                      外部服务层                              │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐ │
│  │ Hyperliquid    │  │ DeepSeek AI    │  │ SQLite DB    │ │
│  │ - WebSocket    │  │ - API          │  │ - 本地文件   │ │
│  │ - REST API     │  │ - 真实推理     │  │ - Prisma     │ │
│  └────────────────┘  └────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 数据流图

**交易周期数据流**:

```
1. 触发交易周期（用户点击或定时器）
   ↓
2. 获取市场数据（Hyperliquid WebSocket）
   ↓
3. 计算技术指标（EMA, MACD, RSI, ATR）
   ↓
4. 构建AI提示词（三层架构）
   ↓
5. 调用AI API（DeepSeek）
   ↓
6. 解析AI决策（JSON）
   ↓
7. 风险管理检查（6层验证）
   ↓
8. 执行交易订单（Hyperliquid）
   ↓
9. 更新持仓状态
   ↓
10. 保存数据到数据库
   ↓
11. 发射事件通知（EventBus）
   ↓
12. 更新前端UI
```

### 6.3 模块依赖关系

```
TradingEngineManager (核心)
├── TradingEngineState (单个模型状态)
│   ├── RiskManager (风险管理)
│   ├── TradingStorage (数据持久化)
│   ├── EventBus (事件系统)
│   ├── RealTradingExecutor (交易执行)
│   │   └── HyperliquidClient (交易所客户端)
│   ├── MarketData (市场数据)
│   │   └── Indicators (技术指标)
│   └── AI Models (AI决策)
│       └── TradingPrompt (提示词模板)
│
├── Config (全局配置)
└── Types (类型定义)
```

---

## 7. 数据模型

详见 [4.4 数据持久化系统](#441-数据库设计)

---

## 8. API设计

### 8.1 主交易API

**端点**: `POST /api/trading`

**功能**: 执行一次完整的交易周期

**请求体**:
```json
{
  "action": "execute_cycle" | "start_auto" | "stop_auto"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "modelStates": [
      {
        "modelName": "DeepSeek V3.1",
        "account": {
          "availableCash": 950.23,
          "totalEquity": 1035.67,
          "totalReturn": 3.567
        },
        "positions": [...],
        "completedTrades": [...],
        "stats": {
          "totalTrades": 12,
          "winRate": 58.3,
          "sharpeRatio": 1.25
        }
      }
    ],
    "marketData": {...},
    "timestamp": 1706000000000
  }
}
```

---

### 8.2 账户查询API

**端点**: `GET /api/hyperliquid-account`

**功能**: 获取Hyperliquid账户实时状态

**响应**:
```json
{
  "success": true,
  "data": {
    "accountValue": 1363.59,
    "marginUsed": 71.02,
    "withdrawable": 1295.57,
    "positions": [
      {
        "coin": "SOL-PERP",
        "side": "LONG",
        "size": 1.53,
        "entryPrice": 133.15,
        "currentPrice": 139.32,
        "unrealizedPnl": 9.35,
        "leverage": 3
      }
    ]
  }
}
```

---

### 8.3 历史数据API

**端点**: `GET /api/since-inception-values?modelName=<name>`

**功能**: 获取模型的历史权益曲线

**响应**:
```json
{
  "success": true,
  "data": [
    { "timestamp": 1706000000000, "equity": 1000.00 },
    { "timestamp": 1706003600000, "equity": 1015.34 },
    { "timestamp": 1706007200000, "equity": 1032.89 }
  ]
}
```

---

## 9. 用户界面需求

### 9.1 主仪表板布局

```
┌────────────────────────────────────────────────────────────┐
│  [Logo] Alpha Arena           [Execute Cycle] [Start/Stop] │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────┐  ┌─────────────────────────┐  │
│  │   Market Overview      │  │   Trading Controls      │  │
│  │                        │  │                         │  │
│  │ BTC  $88,929  ↑ 2.3%  │  │ Interval: 180s          │  │
│  │ ETH  $2,960   ↓ 0.5%  │  │ Total Calls: 245        │  │
│  │ SOL  $139.32  ↑ 5.1%  │  │ Running: 3h 25m         │  │
│  └────────────────────────┘  └─────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  Leaderboard                         │  │
│  ├─────┬──────────────┬─────────┬──────────┬──────────┤  │
│  │ Rank│ Model        │ Equity  │ Return % │ Sharpe   │  │
│  ├─────┼──────────────┼─────────┼──────────┼──────────┤  │
│  │  1  │ DeepSeek V3.1│ $1,145  │ +14.5%   │  1.32    │  │
│  │  2  │ Claude 4.5   │ $1,089  │ +8.9%    │  1.15    │  │
│  │  3  │ GPT-5        │ $1,034  │ +3.4%    │  0.87    │  │
│  └─────┴──────────────┴─────────┴──────────┴──────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Equity Chart                            │  │
│  │                                                      │  │
│  │    $1,200 ┤                    ╱─DeepSeek           │  │
│  │    $1,100 ┤               ╱───╱                     │  │
│  │    $1,000 ┼──────────────╱                          │  │
│  │       $900┤                                         │  │
│  │           └──────────────────────────────────────   │  │
│  │           0h    1h    2h    3h    4h    5h          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Model Chat                              │  │
│  │                                                      │  │
│  │  [DeepSeek V3.1 ▼]                                   │  │
│  │                                                      │  │
│  │  🤖 Chain of Thought:                                │  │
│  │  ## Overall Assessment                               │  │
│  │  Market shows bullish momentum with RSI at 68...    │  │
│  │                                                      │  │
│  │  ## Position Analysis                                │  │
│  │  - BTC LONG: Up 5.2%, take profit approaching...    │  │
│  │                                                      │  │
│  │  📊 Decision:                                        │  │
│  │  - Action: HOLD                                      │  │
│  │  - Confidence: 85%                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### 9.2 响应式设计

**桌面版（>1024px）**:
- 三栏布局
- 完整图表展示
- 详细数据表格

**平板版（768px-1024px）**:
- 两栏布局
- 简化图表
- 折叠式详情

**移动版（<768px）**:
- 单栏堆叠布局
- 精简核心数据
- 滑动切换模块

### 9.3 UI组件规范

**颜色方案**:
- 主色：蓝色 (#3B82F6)
- 成功/多头：绿色 (#10B981)
- 失败/空头：红色 (#EF4444)
- 警告：黄色 (#F59E0B)
- 背景：深色主题 (#0F172A)

**排版**:
- 标题：32px/24px/18px
- 正文：16px
- 小字：14px/12px
- 字体：Inter, system-ui

**交互**:
- 按钮悬停效果
- 加载动画（Spinner）
- Toast通知
- 错误提示

---

## 10. 安全与风险管理

### 10.1 API密钥安全

**要求**:
- 所有密钥存储在环境变量（.env.local）
- .env.local 加入 .gitignore
- 生产环境使用密钥管理服务（AWS Secrets Manager、Vercel Env）
- 定期轮换密钥

### 10.2 私钥管理

**Hyperliquid私钥保护**:
- 使用测试网账户（不存储大额资金）
- 私钥加密存储
- 仅限特定IP访问
- 启用2FA（如果支持）

### 10.3 交易风险控制

详见 [4.3 风险管理系统](#43-风险管理系统)

### 10.4 数据安全

**数据库**:
- 定期备份（每日）
- 访问权限控制
- 敏感数据加密（私钥、API密钥）

**网络安全**:
- HTTPS强制启用
- CORS配置
- Rate Limiting（API限流）

---

## 11. 性能需求

### 11.1 响应时间

| 操作 | 目标响应时间 | 最大响应时间 |
|------|------------|-------------|
| 页面加载 | < 2秒 | < 5秒 |
| 交易周期执行 | < 5秒 | < 10秒 |
| AI决策 | < 3秒 | < 8秒 |
| 市场数据更新 | < 1秒 | < 2秒 |
| 数据库查询 | < 100ms | < 500ms |

### 11.2 并发性能

- 支持10个并发用户
- WebSocket同时连接：6个币种
- 数据库并发写入：100 TPS

### 11.3 资源使用

- 内存占用：< 512MB
- CPU使用：< 50%（平均）
- 磁盘空间：< 1GB（包含数据库）

---

## 12. 测试需求

### 12.1 单元测试

**覆盖模块**:
- 技术指标计算（indicators.ts）
- 风险管理器（riskManagement.ts）
- 事件总线（eventBus.ts）
- 交易引擎（tradingEngine.ts）

**工具**: Jest

**目标覆盖率**: > 80%

### 12.2 集成测试

**测试场景**:
- 完整交易周期流程
- Hyperliquid API集成
- 数据库读写
- WebSocket连接

### 12.3 端到端测试

**工具**: Playwright/Cypress

**测试用例**:
- 用户点击"Execute Cycle"→ 交易完成
- 启动自动交易 → 定时执行
- 查看模型详情 → 数据正确展示

### 12.4 回测验证

- 回测结果与实盘误差 < 5%
- 性能指标计算准确性
- 历史数据完整性

---

## 13. 部署需求

### 13.1 开发环境

```bash
# 安装依赖
npm install

# 初始化数据库
npx prisma generate
npx prisma db push

# 运行开发服务器
npm run dev
```

### 13.2 生产环境

**推荐平台**: Vercel

**部署步骤**:
1. 连接GitHub仓库
2. 配置环境变量
3. 启用自动部署
4. 配置自定义域名

**环境变量（生产）**:
```env
DEEPSEEK_API_KEY=...
HYPERLIQUID_NETWORK=mainnet  # ⚠️ 谨慎使用
HYPERLIQUID_MAIN_WALLET=...
HYPERLIQUID_API_WALLET=...
HYPERLIQUID_PRIVATE_KEY=...
DATABASE_URL=...              # 云数据库
```

### 13.3 监控与日志

**日志记录**:
- 所有交易决策
- 风险限制触发
- API错误
- 系统异常

**监控指标**:
- API响应时间
- 错误率
- WebSocket连接状态
- 数据库性能

**工具**:
- Vercel Analytics
- Sentry（错误追踪）
- LogRocket（会话回放）

---

## 14. 未来路线图

### 14.1 短期计划（1-3个月）

**功能增强**:
- [ ] 支持更多币种（20+）
- [ ] 添加限价单支持
- [ ] 移动端适配
- [ ] 多语言支持（英文、中文）

**性能优化**:
- [ ] 数据库迁移到PostgreSQL
- [ ] 缓存优化（Redis）
- [ ] WebSocket连接池

**AI模型**:
- [ ] 集成 Claude 4.5 真实API
- [ ] 集成 GPT-5 真实API
- [ ] 支持自定义AI策略

### 14.2 中期计划（3-6个月）

**交易所集成**:
- [ ] Binance API
- [ ] OKX API
- [ ] Bybit API

**社交功能**:
- [ ] 用户注册/登录
- [ ] 策略分享
- [ ] 排行榜（全球）
- [ ] 跟单功能

**高级功能**:
- [ ] 策略市场
- [ ] 回测报告生成器
- [ ] 风险评估工具
- [ ] 模拟交易模式

### 14.3 长期愿景（6-12个月）

**平台化**:
- [ ] 开放API供第三方开发者
- [ ] 插件系统
- [ ] 自定义指标
- [ ] 策略编辑器

**市场扩展**:
- [ ] 传统金融市场（股票、期货）
- [ ] 区块链资产（NFT、DeFi）
- [ ] 大宗商品

**商业化**:
- [ ] 订阅服务
- [ ] 策略销售
- [ ] API调用收费
- [ ] 广告合作

---

## 15. 附录

### 15.1 术语表

| 术语 | 定义 |
|------|------|
| **LLM** | Large Language Model，大型语言模型 |
| **EMA** | Exponential Moving Average，指数移动平均 |
| **MACD** | Moving Average Convergence Divergence，异同移动平均 |
| **RSI** | Relative Strength Index，相对强弱指数 |
| **ATR** | Average True Range，平均真实波幅 |
| **Sharpe Ratio** | 夏普比率，风险调整后收益指标 |
| **Drawdown** | 回撤，从峰值到谷值的跌幅 |
| **Slippage** | 滑点，预期价格与实际成交价格的差异 |
| **Notional** | 名义价值，持仓的总市值 |
| **Leverage** | 杠杆，放大交易规模的倍数 |
| **Kelly Criterion** | Kelly公式，最优仓位计算方法 |
| **Circuit Breaker** | 熔断机制，紧急停止交易的保护措施 |

### 15.2 参考资料

**技术文档**:
- Next.js: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- Hyperliquid: https://hyperliquid.gitbook.io
- DeepSeek: https://platform.deepseek.com/docs

**量化交易**:
- Nautilus Trader: https://nautilustrader.io
- QuantConnect: https://www.quantconnect.com
- Backtrader: https://www.backtrader.com

**AI提示词工程**:
- nof1.ai Alpha Arena: https://nof1.ai
- OpenAI Best Practices: https://platform.openai.com/docs/guides/prompt-engineering

### 15.3 贡献者

- **核心开发**: 开发团队
- **架构设计**: 基于 Nautilus Trader
- **灵感来源**: nof1.ai Alpha Arena

### 15.4 许可证

MIT License - 免费用于教育和研究目的

---

## 📞 联系方式

- **GitHub**: [项目仓库链接]
- **文档**: 查看 `docs/` 目录
- **问题反馈**: 提交 GitHub Issue

---

**文档版本**: 2.0
**最后更新**: 2025-01-24
**状态**: ✅ 功能已实现，文档完整

---

**构建于** ❤️ **使用 Next.js, TypeScript, Tailwind CSS, 和 Nautilus Trader 架构**
