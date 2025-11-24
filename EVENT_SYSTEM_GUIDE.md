# 📡 事件驱动系统使用指南

事件驱动系统借鉴了 **Nautilus Trader** 的架构设计，让你能够监听和响应交易系统中的各种事件。

---

## 🎯 **什么是事件驱动系统？**

**事件驱动系统** = 当系统中发生某些事情（如开仓、平仓、止损触发）时，自动通知所有订阅者

### **优势**：
- ✅ **解耦代码** - 不同模块之间松散耦合，易于维护
- ✅ **实时监控** - 可以实时监听交易系统的所有活动
- ✅ **灵活扩展** - 轻松添加新功能（如日志记录、警报、统计分析）
- ✅ **调试友好** - 可以追踪系统中发生的所有事件

---

## 📊 **支持的事件类型**

系统支持 20+ 种事件类型，涵盖交易的各个方面：

### **订单事件**
- `ORDER_SUBMITTED` - 订单提交
- `ORDER_ACCEPTED` - 订单接受
- `ORDER_REJECTED` - 订单拒绝
- `ORDER_FILLED` - 订单成交
- `ORDER_CANCELLED` - 订单取消

### **持仓事件**
- `POSITION_OPENED` - 持仓开启
- `POSITION_MODIFIED` - 持仓修改
- `POSITION_CLOSED` - 持仓关闭

### **风险事件**
- `RISK_LIMIT_BREACHED` - 风险限制触发
- `STOP_LOSS_TRIGGERED` - 止损触发
- `TAKE_PROFIT_TRIGGERED` - 止盈触发

### **AI决策事件**
- `AI_DECISION_MADE` - AI做出决策
- `AI_DECISION_EXECUTED` - AI决策执行成功
- `AI_DECISION_REJECTED` - AI决策被拒绝

### **系统事件**
- `TRADING_CYCLE_START` - 交易周期开始
- `TRADING_CYCLE_END` - 交易周期结束
- `MARKET_DATA_UPDATED` - 市场数据更新
- `ACCOUNT_UPDATED` - 账户状态更新

### **安全事件**
- `CIRCUIT_BREAKER_TRIGGERED` - 熔断触发
- `DAILY_LOSS_LIMIT_REACHED` - 单日亏损限制达到

---

## 🚀 **快速开始**

### **1. 基础用法 - 监听单个事件**

```typescript
import { getEventBus } from '@/lib/events/eventBus';
import { TradingEventType } from '@/lib/events/types';

// 获取事件总线实例
const eventBus = getEventBus();

// 订阅持仓开启事件
const subscriptionId = eventBus.subscribe(
  TradingEventType.POSITION_OPENED,
  (event) => {
    console.log(`🎉 新持仓开启: ${event.position.coin} ${event.position.side}`);
    console.log(`   杠杆: ${event.position.leverage}x`);
    console.log(`   入场价: $${event.position.entryPrice.toFixed(2)}`);
  }
);
```

---

### **2. 监听多个事件类型**

```typescript
// 同时监听开仓和平仓
const subscriptionIds = eventBus.subscribeMultiple(
  [
    TradingEventType.POSITION_OPENED,
    TradingEventType.POSITION_CLOSED
  ],
  (event) => {
    if (event.type === TradingEventType.POSITION_OPENED) {
      console.log('📈 开仓:', event.position.coin);
    } else if (event.type === TradingEventType.POSITION_CLOSED) {
      console.log('📉 平仓:', event.coin, 'P&L:', event.pnl);
    }
  }
);
```

---

### **3. 监听所有事件**

```typescript
// 监听系统中的所有事件
const allEventsId = eventBus.subscribeAll((event) => {
  console.log(`[${event.type}] 时间: ${new Date(event.timestamp).toISOString()}`);

  // 根据事件类型执行不同操作
  switch (event.type) {
    case TradingEventType.STOP_LOSS_TRIGGERED:
      console.warn('⚠️ 止损触发:', event.coin);
      break;
    case TradingEventType.CIRCUIT_BREAKER_TRIGGERED:
      console.error('🚨 熔断触发! 原因:', event.reason);
      break;
  }
});
```

---

### **4. 使用过滤器**

```typescript
// 只监听特定模型的事件
const filteredId = eventBus.subscribe(
  TradingEventType.AI_DECISION_MADE,
  (event) => {
    console.log('🤖 AI决策:', event.decision);
  },
  {
    modelName: 'deepseek-v3-1', // 只监听 DeepSeek V3.1 的决策
    startTime: Date.now() - 3600000, // 只监听最近1小时的事件
  }
);
```

---

## 📈 **实际应用示例**

### **示例 1：实时交易日志记录**

```typescript
import { getEventBus } from '@/lib/events/eventBus';
import { TradingEventType } from '@/lib/events/types';
import fs from 'fs';

const eventBus = getEventBus();
const logFile = 'trading-events.log';

// 记录所有交易相关事件
eventBus.subscribeMultiple(
  [
    TradingEventType.POSITION_OPENED,
    TradingEventType.POSITION_CLOSED,
    TradingEventType.STOP_LOSS_TRIGGERED,
  ],
  (event) => {
    const logEntry = {
      timestamp: new Date(event.timestamp).toISOString(),
      type: event.type,
      data: event,
    };

    fs.appendFileSync(
      logFile,
      JSON.stringify(logEntry) + '\n'
    );
  }
);
```

---

### **示例 2：盈亏监控和警报**

```typescript
import { getEventBus } from '@/lib/events/eventBus';
import { TradingEventType } from '@/lib/events/types';

const eventBus = getEventBus();

// 监控大额盈利/亏损
eventBus.subscribe(
  TradingEventType.POSITION_CLOSED,
  (event) => {
    const pnlPercent = event.pnlPercent;

    if (pnlPercent >= 50) {
      console.log('🎉 大额盈利! +' + pnlPercent.toFixed(1) + '%');
      // 发送推送通知（可以集成 Telegram Bot 等）
    } else if (pnlPercent <= -20) {
      console.warn('⚠️ 大额亏损! ' + pnlPercent.toFixed(1) + '%');
      // 发送警报
    }
  }
);
```

---

### **示例 3：交易统计分析**

```typescript
import { getEventBus } from '@/lib/events/eventBus';
import { TradingEventType } from '@/lib/events/types';

const eventBus = getEventBus();

// 统计每个币种的交易次数
const coinStats = new Map<string, { opened: number; closed: number }>();

eventBus.subscribe(
  TradingEventType.POSITION_OPENED,
  (event) => {
    const coin = event.position.coin;
    const stats = coinStats.get(coin) || { opened: 0, closed: 0 };
    stats.opened++;
    coinStats.set(coin, stats);
  }
);

eventBus.subscribe(
  TradingEventType.POSITION_CLOSED,
  (event) => {
    const coin = event.coin;
    const stats = coinStats.get(coin) || { opened: 0, closed: 0 };
    stats.closed++;
    coinStats.set(coin, stats);

    // 每10笔交易输出统计
    if (stats.closed % 10 === 0) {
      console.log(`\n📊 ${coin} 交易统计:`);
      console.log(`   开仓: ${stats.opened} 次`);
      console.log(`   平仓: ${stats.closed} 次`);
    }
  }
);
```

---

### **示例 4：风险事件自动响应**

```typescript
import { getEventBus } from '@/lib/events/eventBus';
import { TradingEventType } from '@/lib/events/types';

const eventBus = getEventBus();

// 监听所有风险事件
eventBus.subscribeMultiple(
  [
    TradingEventType.RISK_LIMIT_BREACHED,
    TradingEventType.CIRCUIT_BREAKER_TRIGGERED,
    TradingEventType.DAILY_LOSS_LIMIT_REACHED,
  ],
  async (event) => {
    console.error('🚨 风险事件触发:', event.type);

    // 发送紧急通知
    // await sendTelegramAlert('风险警报: ' + event.type);

    // 记录到数据库
    // await saveRiskEvent(event);

    // 暂停交易（如果需要）
    if (event.type === TradingEventType.CIRCUIT_BREAKER_TRIGGERED) {
      console.error('🛑 交易已自动暂停');
    }
  }
);
```

---

## 🔧 **高级功能**

### **查看事件历史**

```typescript
import { getEventBus } from '@/lib/events/eventBus';
import { TradingEventType } from '@/lib/events/types';

const eventBus = getEventBus();

// 获取所有历史事件
const allEvents = eventBus.getHistory();
console.log('总事件数:', allEvents.length);

// 获取最近10个事件
const recentEvents = eventBus.getRecentEvents(10);

// 获取特定类型的历史事件
const stopLossEvents = eventBus.getHistory({
  types: [TradingEventType.STOP_LOSS_TRIGGERED],
  startTime: Date.now() - 86400000, // 最近24小时
});
console.log('过去24小时止损次数:', stopLossEvents.length);
```

---

### **取消订阅**

```typescript
import { getEventBus } from '@/lib/events/eventBus';

const eventBus = getEventBus();

// 订阅事件
const subscriptionId = eventBus.subscribe(
  TradingEventType.POSITION_OPENED,
  (event) => { /* ... */ }
);

// 稍后取消订阅
eventBus.unsubscribe(subscriptionId);

// 或取消所有订阅
eventBus.unsubscribeAll();

// 或取消特定类型的所有订阅
eventBus.unsubscribeByType(TradingEventType.POSITION_OPENED);
```

---

### **启用/禁用事件总线**

```typescript
import { getEventBus } from '@/lib/events/eventBus';

const eventBus = getEventBus();

// 暂时禁用事件系统（不会触发任何事件）
eventBus.disable();

// 重新启用
eventBus.enable();

// 检查状态
const stats = eventBus.getStats();
console.log('事件总线状态:', stats);
```

---

### **查看事件总线统计**

```typescript
import { getEventBus } from '@/lib/events/eventBus';

const eventBus = getEventBus();

const stats = eventBus.getStats();
console.log('📊 事件总线统计:');
console.log('   启用状态:', stats.isEnabled);
console.log('   总订阅数:', stats.totalSubscriptions);
console.log('   历史事件数:', stats.historySize);
console.log('   最大历史容量:', stats.maxHistorySize);
console.log('   订阅详情:', stats.subscriptionCounts);
```

---

## 🎨 **事件数据结构示例**

### **POSITION_OPENED 事件**

```typescript
{
  type: 'POSITION_OPENED',
  timestamp: 1706000000000,
  modelName: 'deepseek-v3-1',
  position: {
    id: 'BTC-1706000000000',
    coin: 'BTC',
    side: 'LONG',
    leverage: 10,
    notional: 100,
    entryPrice: 45000,
    currentPrice: 45000,
    liquidationPrice: 40500,
    unrealizedPnL: -0.055,
    unrealizedPnLPercent: -0.55,
    exitPlan: {
      stopLoss: 42750,
      takeProfit: 49500,
      invalidation: 'Price drops below 95%'
    },
    openedAt: 1706000000000
  }
}
```

---

### **POSITION_CLOSED 事件**

```typescript
{
  type: 'POSITION_CLOSED',
  timestamp: 1706003600000,
  modelName: 'deepseek-v3-1',
  coin: 'BTC',
  side: 'LONG',
  entryPrice: 45000,
  exitPrice: 46350,
  pnl: 2.945,
  pnlPercent: 29.45,
  exitReason: 'Take profit hit'
}
```

---

### **STOP_LOSS_TRIGGERED 事件**

```typescript
{
  type: 'STOP_LOSS_TRIGGERED',
  timestamp: 1706001800000,
  modelName: 'deepseek-v3-1',
  coin: 'ETH',
  currentPrice: 2280,
  stopLossPrice: 2300
}
```

---

### **AI_DECISION_MADE 事件**

```typescript
{
  type: 'AI_DECISION_MADE',
  timestamp: 1706000000000,
  modelName: 'deepseek-v3-1',
  decision: {
    action: 'buy_to_enter',
    coin: 'SOL',
    notional: 50,
    confidence: 0.75,
    leverage: 12,
    exitPlan: {
      stopLoss: 95,
      takeProfit: 115,
      invalidation: 'Break below support'
    }
  },
  chainOfThought: 'SOL shows strong upward momentum...'
}
```

---

## 🚨 **常见问题**

### **Q1: 事件会影响性能吗？**
**A:** 影响极小。事件使用 `emitSync` 异步发送，不会阻塞主交易逻辑。

---

### **Q2: 事件历史会占用多少内存？**
**A:** 默认最多保存 1000 个事件。超过后会自动删除最旧的事件。可以通过 `clearHistory()` 手动清空。

---

### **Q3: 如何在回测中使用事件系统？**
**A:** 回测引擎默认不启用事件系统。如果需要在回测中记录事件，可以在回测引擎中集成 EventBus。

---

### **Q4: 可以持久化事件到数据库吗？**
**A:** 可以！只需订阅所有事件并保存到数据库：

```typescript
eventBus.subscribeAll(async (event) => {
  await saveEventToDatabase(event);
});
```

---

### **Q5: 如何避免事件处理器中的错误影响系统？**
**A:** EventBus 已内置错误处理。如果某个事件处理器抛出错误，不会影响其他处理器和主系统。错误会被记录到控制台。

---

## 🔗 **下一步**

1. **阅读事件类型定义** → `lib/events/types.ts` 查看所有可用事件
2. **试验基础订阅** → 从监听单个事件开始
3. **构建自定义监控** → 根据需求创建自己的事件处理器
4. **集成第三方服务** → 连接 Telegram Bot、数据库、监控系统等

---

## 📚 **相关文档**

- `lib/events/types.ts` - 所有事件类型定义
- `lib/events/eventBus.ts` - EventBus 核心实现
- `lib/tradingEngine.ts` - 事件发射位置（参考实现）

---

**记住：事件驱动系统让代码更清晰、更灵活、更易于扩展！** 📡
