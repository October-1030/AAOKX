# Alpha Arena 交易系统 - 文档索引

## 📁 项目文档

| 文档 | 描述 | 用途 |
|------|------|------|
| [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) | 🏆 **项目总览** | 完整项目开发历程和成果汇总 |
| [TECHNICAL_SPECS.md](./TECHNICAL_SPECS.md) | 🔧 **技术规格** | 详细技术架构和配置参数 |
| [OPERATION_MANUAL.md](./OPERATION_MANUAL.md) | 🚀 **操作手册** | 日常操作和维护指南 |
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) | ⚡ **快速参考** | 常用命令和API参考 |
| [MEAN_REVERSION_GUIDE.md](./MEAN_REVERSION_GUIDE.md) | 📈 **策略指南** | 均值回归交易策略详解 |

## 🛠️ 实用脚本

| 脚本 | 功能 | 使用场景 |
|------|------|----------|
| `close-all-positions.ts` | 🆘 紧急平仓 | 风险控制，立即清仓 |
| `force-close-eth.ts` | 🎯 强制平仓ETH | 特定币种紧急处理 |
| `test-risk-fixes.ts` | 🧪 风险测试 | 验证修复效果 |
| `test-deepseek-api.ts` | 🤖 API测试 | 测试AI连接 |
| `test-nof1-prompts.ts` | 📝 提示测试 | 验证交易格式 |

## 🏗️ 核心代码

### 主要模块
```
lib/
├── 🧠 tradingEngine.ts           # 交易引擎核心
├── ⚡ realTradingExecutor.ts      # 真实交易执行
├── 🎯 perfectTradingStrategy.ts   # 完美交易策略
├── 🛡️ trailingStopSystem.ts      # 移动止损系统
├── 🔗 hyperliquidClient.ts       # 交易所连接
├── 📊 marketData.ts              # 市场数据
├── 📈 indicators.ts              # 技术指标
├── ⚙️ tradingConfig.ts           # 配置管理
├── 🔒 riskCalculator.ts          # 风险计算
└── 📝 logger.ts                  # 日志系统
```

### API路由
```
app/api/
└── trading/route.ts              # 主要交易API
```

## 📊 快速状态检查

### 🟢 系统正常
- 所有持仓已清仓 ✅
- 账户余额 $1,321.44 ✅
- 风险管理已修复 ✅
- 仓位限制 5% ✅

### 📈 关键指标
- **最大单仓**: $66 (5%)
- **杠杆限制**: 3x
- **紧急止损**: -3%
- **日交易限制**: 10次

## 🚀 快速启动指令

```bash
# 1. 启动系统
npm run dev

# 2. 检查状态  
curl http://localhost:3000/api/trading

# 3. 开始交易
curl "http://localhost:3000/api/trading?action=start"

# 4. 紧急平仓
npx tsx close-all-positions.ts

# 5. 停止交易
curl "http://localhost:3000/api/trading?action=stop"
```

## 🛡️ 安全提醒

### ⚠️ 重要警告
- **仅测试网**: 当前配置仅用于测试，避免真实资金
- **谨慎操作**: 修改配置前务必备份
- **风险优先**: 发现异常立即停止交易
- **充分测试**: 新策略必须先小规模验证

### 🔐 安全检查
- [x] 使用测试网环境
- [x] API密钥安全存储
- [x] 仓位限制生效
- [x] 止损系统独立运行

## 📞 获取帮助

1. **查看文档**: 优先查阅相关文档
2. **检查日志**: 分析错误日志寻找线索
3. **测试脚本**: 使用测试脚本验证功能
4. **聊天支持**: 通过聊天界面获取实时帮助

## 📈 项目里程碑

### ✅ 已完成
- [x] 基础交易引擎开发
- [x] AI决策系统集成
- [x] 多策略支持实现
- [x] 风险管理系统完善
- [x] 真实交易执行
- [x] 紧急安全修复

### 🔄 进行中
- [ ] 系统稳定性测试
- [ ] 策略参数优化
- [ ] 性能监控完善

### 📋 待计划
- [ ] 回测系统开发
- [ ] Web界面设计
- [ ] 多账户支持
- [ ] 商业化准备

---

**项目状态**: 🟢 生产就绪 (测试网)  
**当前版本**: v1.2  
**最后更新**: 2024年12月1日  

**开始使用**: 阅读 [OPERATION_MANUAL.md](./OPERATION_MANUAL.md)  
**了解技术**: 查看 [TECHNICAL_SPECS.md](./TECHNICAL_SPECS.md)  
**项目总结**: 参考 [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)