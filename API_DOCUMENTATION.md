# 🚀 Alpha Arena API 文档

## 概述

本项目现已完全支持 **nof1.ai 风格的 REST API**，提供与原始 Alpha Arena 平台相同的数据结构和接口。

---

## 📡 API 端点总览

| 端点 | 方法 | 描述 | nof1.ai 兼容 |
|------|------|------|--------------|
| `/api/crypto-prices` | GET | 获取所有加密货币的实时价格 | ✅ |
| `/api/trades` | GET | 获取所有已完成的交易记录 | ✅ |
| `/api/account-totals` | GET | 获取所有模型的账户快照 | ✅ |
| `/api/since-inception-values` | GET | 获取历史权益数据（用于绘制曲线） | ✅ |
| `/api/trading` | GET/POST | 原有的交易引擎接口 | ⚠️ 旧版 |

---

## 🔹 1. `/api/crypto-prices`

### 描述
返回所有加密货币的当前市场价格（nof1.ai 格式）

### 请求示例
```bash
GET http://localhost:3000/api/crypto-prices
```

### 响应格式
```json
{
  "prices": {
    "BTC": {
      "symbol": "BTC",
      "price": 101601.50,
      "timestamp": 1762316847674
    },
    "ETH": {
      "symbol": "ETH",
      "price": 3315.35,
      "timestamp": 1762316847674
    },
    "SOL": {
      "symbol": "SOL",
      "price": 155.77,
      "timestamp": 1762316847674
    },
    "BNB": {
      "symbol": "BNB",
      "price": 943.32,
      "timestamp": 1762316847674
    },
    "DOGE": {
      "symbol": "DOGE",
      "price": 0.1638,
      "timestamp": 1762316847674
    },
    "XRP": {
      "symbol": "XRP",
      "price": 2.2298,
      "timestamp": 1762316847674
    }
  },
  "serverTime": 1762316847674
}
```

### 字段说明
| 字段 | 类型 | 说明 |
|------|------|------|
| `symbol` | string | 币种符号 |
| `price` | number | 当前价格（USD） |
| `timestamp` | number | 价格更新时间（Unix 时间戳） |
| `serverTime` | number | 服务器时间（Unix 时间戳） |

---

## 🔹 2. `/api/trades`

### 描述
返回所有 AI 模型完成的交易记录（按时间倒序）

### 请求示例
```bash
GET http://localhost:3000/api/trades
```

### 响应格式
```json
{
  "trades": [
    {
      "id": "gpt-5_BTC-1762310000000",
      "trade_id": "1762310000000_1762320000000_BTC_long",
      "symbol": "BTC",
      "side": "long",
      "trade_type": "long",
      "model_id": "gpt-5",
      "quantity": 0.1,
      "entry_price": 100000,
      "exit_price": 102000,
      "entry_sz": 0.1,
      "exit_sz": 0.1,
      "entry_time": 1762310000000,
      "exit_time": 1762320000000,
      "entry_human_time": "2025-11-04T10:00:00.000Z",
      "exit_human_time": "2025-11-04T12:46:40.000Z",
      "entry_oid": 0,
      "exit_oid": 1,
      "entry_tid": 0,
      "exit_tid": 1,
      "entry_crossed": true,
      "exit_crossed": true,
      "leverage": 15,
      "confidence": 0.75,
      "entry_commission_dollars": 5.5,
      "exit_commission_dollars": 5.61,
      "total_commission_dollars": 11.11,
      "entry_closed_pnl": 0,
      "exit_closed_pnl": 188.89,
      "realized_gross_pnl": 200,
      "realized_net_pnl": 188.89,
      "entry_liquidation": null,
      "exit_liquidation": null,
      "exit_plan": {
        "profit_target": 105000,
        "stop_loss": 98000,
        "invalidation_condition": "Manual close"
      }
    }
  ]
}
```

### 字段说明
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一交易 ID |
| `symbol` | string | 交易币种（BTC, ETH, SOL, BNB, DOGE, XRP） |
| `side` | string | 方向：`long` 或 `short` |
| `model_id` | string | AI 模型 ID |
| `entry_price` | number | 入场价格 |
| `exit_price` | number | 出场价格 |
| `leverage` | number | 杠杆倍数 |
| `realized_net_pnl` | number | 净利润（扣除手续费） |
| `exit_plan` | object | 退出计划（止盈/止损） |

---

## 🔹 3. `/api/account-totals`

### 描述
返回所有 AI 模型的账户快照（包含持仓、权益、收益率等）

### 请求示例
```bash
GET http://localhost:3000/api/account-totals
GET http://localhost:3000/api/account-totals?lastHourlyMarker=437
```

### 查询参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `lastHourlyMarker` | number | 否 | 分页标记（用于增量更新） |

### 响应格式
```json
{
  "accountTotals": [
    {
      "id": "deepseek-v3_1762320000000_0",
      "timestamp": 1762320000000,
      "realized_pnl": 150.50,
      "positions": {
        "BTC": {
          "entry_oid": 0,
          "risk_usd": 666.67,
          "confidence": 0.75,
          "index_col": null,
          "exit_plan": {
            "profit_target": 105000,
            "stop_loss": 98000,
            "invalidation_condition": "Price moves against position by 5%"
          },
          "entry_time": 1762310000000,
          "symbol": "BTC",
          "entry_price": 100000,
          "tp_oid": 1,
          "margin": 666.67,
          "wait_for_fill": false,
          "sl_oid": 0,
          "oid": 0,
          "current_price": 101000,
          "closed_pnl": 0,
          "liquidation_price": 93333.33,
          "commission": 5.5,
          "leverage": 15,
          "slippage": 0,
          "quantity": 0.1,
          "unrealized_pnl": 100
        }
      },
      "since_inception_minute_marker": 0,
      "sharpe_ratio": 2.5,
      "cum_pnl_pct": 1.505,
      "total_unrealized_pnl": 100,
      "model_id": "deepseek-v3",
      "since_inception_hourly_marker": 0,
      "dollar_equity": 10150.50
    }
  ]
}
```

### 字段说明
| 字段 | 类型 | 说明 |
|------|------|------|
| `dollar_equity` | number | 账户总权益（USD） |
| `realized_pnl` | number | 已实现盈亏 |
| `total_unrealized_pnl` | number | 未实现盈亏 |
| `cum_pnl_pct` | number | 累计收益率（%） |
| `sharpe_ratio` | number | 夏普比率 |
| `positions` | object | 当前持仓字典 |

---

## 🔹 4. `/api/since-inception-values`

### 描述
返回所有模型的历史权益数据（用于绘制权益曲线图）

### 请求示例
```bash
GET http://localhost:3000/api/since-inception-values
```

### 响应格式
```json
{
  "values": {
    "deepseek-v3": [
      {
        "timestamp": 1762310000000,
        "equity": 10000
      },
      {
        "timestamp": 1762311800000,
        "equity": 10050
      },
      {
        "timestamp": 1762313600000,
        "equity": 10150
      }
    ],
    "gpt-5": [
      {
        "timestamp": 1762310000000,
        "equity": 10000
      },
      {
        "timestamp": 1762311800000,
        "equity": 9950
      }
    ]
  }
}
```

### 字段说明
| 字段 | 类型 | 说明 |
|------|------|------|
| `values` | object | 模型ID → 权益历史数组的映射 |
| `timestamp` | number | 时间戳 |
| `equity` | number | 账户权益（USD） |

---

## 🔹 5. `/api/trading` (原有接口)

### 描述
原有的交易引擎控制接口（保留向后兼容）

### GET 请求
```bash
GET http://localhost:3000/api/trading?action=status  # 获取状态
GET http://localhost:3000/api/trading?action=start   # 启动自动交易
GET http://localhost:3000/api/trading?action=stop    # 停止自动交易
```

### POST 请求
```bash
POST http://localhost:3000/api/trading
Content-Type: application/json

{
  "action": "execute_cycle"
}
```

---

## 🎯 使用示例

### JavaScript/TypeScript
```typescript
// 1. 获取实时价格
const prices = await fetch('/api/crypto-prices').then(r => r.json());
console.log('BTC Price:', prices.prices.BTC.price);

// 2. 获取交易历史
const trades = await fetch('/api/trades').then(r => r.json());
console.log('Total Trades:', trades.trades.length);

// 3. 获取账户状态
const accounts = await fetch('/api/account-totals').then(r => r.json());
accounts.accountTotals.forEach(account => {
  console.log(`${account.model_id}: $${account.dollar_equity}`);
});

// 4. 获取权益曲线
const values = await fetch('/api/since-inception-values').then(r => r.json());
Object.entries(values.values).forEach(([modelId, history]) => {
  console.log(`${modelId} has ${history.length} data points`);
});
```

### Python
```python
import requests

# 获取价格
prices = requests.get('http://localhost:3000/api/crypto-prices').json()
print(f"BTC: ${prices['prices']['BTC']['price']}")

# 获取交易
trades = requests.get('http://localhost:3000/api/trades').json()
print(f"Total trades: {len(trades['trades'])}")

# 获取账户状态
accounts = requests.get('http://localhost:3000/api/account-totals').json()
for account in accounts['accountTotals']:
    print(f"{account['model_id']}: ${account['dollar_equity']:.2f}")
```

---

## 🔧 数据更新频率

| 数据类型 | 更新频率 | 说明 |
|---------|---------|------|
| 价格数据 | 每 60 秒 | 从 Hyperliquid 实时获取 |
| 交易执行 | 每 180 秒 | AI 模型决策周期 |
| 账户快照 | 每次交易后 | 实时更新 |
| 权益历史 | 每次交易后 | 添加新数据点 |

---

## ⚙️ 配置

所有配置都在 `lib/config.ts` 中：

```typescript
export const CONFIG = {
  USE_REAL_MARKET_DATA: true,    // 使用真实市场数据
  USE_REAL_AI: true,              // 使用真实 AI 模型
  USE_REAL_TRADING: true,         // 使用真实交易（Hyperliquid）
  TRADING_INTERVAL_MS: 180000,    // 3 分钟交易周期
  MARKET_DATA_UPDATE_MS: 60000,   // 1 分钟价格更新
};
```

---

## 🐛 故障排查

### 问题 1: API 返回空数据
**原因**: 交易引擎未初始化
**解决方法**: 访问 `/api/trading?action=status` 初始化引擎

### 问题 2: 价格显示为 0
**原因**: 市场数据尚未加载
**解决方法**: 等待 1-2 秒，市场数据会自动从 Hyperliquid 获取

### 问题 3: CORS 错误
**原因**: 跨域请求被阻止
**解决方法**: 在 `next.config.ts` 中配置 CORS 头

---

## 📊 性能优化建议

1. **使用增量更新**: `/api/account-totals?lastHourlyMarker=437`
2. **限制权益历史长度**: 只保留最近 1000 个数据点
3. **使用 WebSocket**: 对于实时更新，考虑使用 WebSocket 代替轮询

---

## 🔐 安全提示

- ⚠️ **不要在生产环境暴露 API 密钥**
- ⚠️ **添加速率限制以防止滥用**
- ⚠️ **使用 HTTPS 保护数据传输**
- ⚠️ **验证所有用户输入**

---

## 📝 更新日志

### v2.0.0 (2025-11-05)
- ✅ 添加 nof1.ai 兼容的 4 个新 API 端点
- ✅ 重构 TradingEngine 以存储完整交易历史
- ✅ 更新类型定义以匹配 nof1.ai 数据结构
- ✅ 添加 Hyperliquid 真实交易支持
- ✅ 添加完整的 API 文档

---

## 📧 支持

如有问题，请在 GitHub 提交 Issue 或联系开发团队。

**项目地址**: https://github.com/your-org/alpha-arena-clone
