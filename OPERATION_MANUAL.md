# Alpha Arena 交易系统 - 操作手册

## 🚀 快速启动

### 1. 启动系统
```bash
npm run dev
```

### 2. 检查状态
```bash
curl http://localhost:3000/api/trading
```

### 3. 开始交易
```bash
curl http://localhost:3000/api/trading?action=start
```

### 4. 停止交易
```bash
curl http://localhost:3000/api/trading?action=stop
```

## 🆘 紧急操作

### 立即平仓所有持仓
```bash
npx tsx close-all-positions.ts
```

### 强制关闭ETH持仓（示例）
```bash
npx tsx force-close-eth.ts
```

### 测试风险管理系统
```bash
npx tsx test-risk-fixes.ts
```

## 📊 监控命令

### 查看实时状态
```bash
# 账户信息
curl "http://localhost:3000/api/trading?action=status"

# 执行单次交易周期
curl -X POST http://localhost:3000/api/trading -H "Content-Type: application/json" -d '{"action":"execute_cycle"}'
```

### 查看日志
```bash
# 实时日志
tail -f trading-execution.log

# 错误日志
grep "ERROR\|❌" trading-execution.log
```

## 🔧 常用脚本

### 检查持仓
```javascript
// 在浏览器控制台运行
fetch('/api/trading')
  .then(r => r.json())
  .then(data => console.log(data.performances));
```

### 手动止损检查
```bash
npx tsx -e "
import { getRealTradingExecutor } from './lib/realTradingExecutor.js';
const executor = getRealTradingExecutor();
executor.getCurrentPositions().then(console.log);
"
```

## 🛡️ 安全检查清单

### 启动前检查
- [ ] 确认使用测试网 (`HYPERLIQUID_TESTNET=true`)
- [ ] 检查API密钥配置
- [ ] 验证账户余额充足
- [ ] 确认风险限制生效

### 运行中监控
- [ ] 每小时检查持仓状态
- [ ] 监控账户余额变化
- [ ] 观察AI决策质量
- [ ] 验证止损系统工作

### 异常处理
- [ ] 发现异常立即停止系统
- [ ] 紧急平仓所有持仓
- [ ] 检查错误日志
- [ ] 联系技术支持

## ⚙️ 配置调整

### 降低风险
```typescript
// 在 tradingConfig.ts 中调整
maxPositionPercent: 3%    // 从5%降至3%
maxLeverage: 2x          // 从3x降至2x
emergencyStopLoss: -2%   // 从-3%收紧至-2%
```

### 增加交易频率
```typescript
// 在 CONFIG 中调整
TRADING_INTERVAL_MS: 120000  // 2分钟（从3分钟）
maxDailyTrades: 20          // 从10次增加到20次
```

### 调整策略权重
```typescript
// 在 tradingPromptNOF1.ts 中修改策略选择逻辑
// 增加保守策略权重，减少激进策略权重
```

## 📈 性能优化

### 提高响应速度
```bash
# 预热API连接
curl http://localhost:3000/api/trading > /dev/null &

# 增加并发处理
export UV_THREADPOOL_SIZE=128
```

### 减少资源占用
```bash
# 限制内存使用
node --max-old-space-size=1024 server.js

# 优化垃圾回收
node --expose-gc --optimize-for-size server.js
```

## 🔍 故障排查

### 常见问题

**1. API连接失败**
```bash
# 检查网络连接
ping api.deepseek.com

# 验证API密钥
echo $DEEPSEEK_API_KEY
```

**2. Hyperliquid连接问题**
```bash
# 检查钱包地址
echo $HYPERLIQUID_MAIN_WALLET

# 验证API密钥
echo $HYPERLIQUID_API_SECRET
```

**3. 交易执行失败**
```bash
# 检查账户余额
npx tsx -e "
import { getHyperliquidClient } from './lib/hyperliquidClient.js';
const hl = getHyperliquidClient();
hl.getAccountInfo().then(console.log);
"
```

**4. 止损不工作**
- 检查 `checkAndExecuteAutoClose` 是否被调用
- 验证仓位数据是否正确
- 确认价格数据更新正常

### 日志分析
```bash
# 查找错误
grep -i "error\|fail\|exception" trading-execution.log

# 查看交易记录
grep "执行交易决策\|平仓\|开仓" trading-execution.log

# 分析性能
grep "执行时间\|响应时间" trading-execution.log
```

## 📋 维护计划

### 每日任务
- [ ] 检查系统运行状态
- [ ] 审查交易日志
- [ ] 监控账户余额
- [ ] 验证AI决策质量

### 每周任务
- [ ] 分析交易性能
- [ ] 调整策略参数
- [ ] 更新风险限制
- [ ] 备份重要数据

### 每月任务
- [ ] 系统性能评估
- [ ] 策略效果分析
- [ ] 安全审计检查
- [ ] 版本更新规划

## 🆔 联系支持

### 技术问题
- 检查项目文档
- 查看GitHub Issues
- 使用聊天界面获取帮助

### 紧急情况
1. 立即停止系统
2. 执行紧急平仓
3. 保存错误日志
4. 联系技术支持

---

**操作原则**: 安全第一，谨慎操作，充分测试  
**风险提醒**: 仅限测试网使用，真实交易需谨慎  
**更新频率**: 根据系统变更及时更新

*最后更新: 2024年12月1日*