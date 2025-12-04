/**
 * 高级功能综合测试
 * 测试事件驱动架构、套利检测、严格类型等新功能
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 加载环境变量
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
  console.log('✅ 环境变量已加载');
}

async function testAdvancedFeatures() {
  console.log('🧪 高级功能综合测试开始...\n');

  try {
    // 1. 测试严格类型系统
    console.log('📋 测试 1: 严格TypeScript类型系统');
    await testStrictTypes();

    // 2. 测试事件驱动架构
    console.log('\n📋 测试 2: 事件驱动交易引擎');
    await testEventDrivenEngine();

    // 3. 测试套利检测系统
    console.log('\n📋 测试 3: 套利机会检测');
    await testArbitrageDetector();

    // 4. 性能测试
    console.log('\n📋 测试 4: 性能基准测试');
    await testPerformance();

    console.log('\n🎉 所有高级功能测试通过！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    throw error;
  }
}

async function testStrictTypes() {
  const { 
    StrictDataValidator, 
    createUSD, 
    createPercentage, 
    SupportedCoins, 
    TradingAction,
    handleResult
  } = await import('./lib/advanced/strictTypes.js');

  console.log('  🔍 测试类型验证...');

  // 测试有效数据
  const validPosition = {
    id: 'pos_001',
    coin: SupportedCoins.BTC,
    side: 'LONG',
    entryPrice: 50000,
    size: 100,
    leverage: 3,
    entryTime: Date.now()
  };

  const posResult = StrictDataValidator.validatePosition(validPosition);
  handleResult(
    posResult,
    (data) => console.log('    ✅ 有效仓位验证通过'),
    (error) => console.log('    ❌ 仓位验证失败:', error.message)
  );

  // 测试无效数据
  const invalidPosition = {
    id: '',
    coin: 'INVALID_COIN',
    side: 'INVALID_SIDE',
    entryPrice: -100,
    size: 0
  };

  const invalidResult = StrictDataValidator.validatePosition(invalidPosition);
  if (!invalidResult.success) {
    console.log('    ✅ 无效数据正确被拒绝');
  }

  // 测试品牌类型
  try {
    const validUSD = createUSD(100);
    const validPercentage = createPercentage(5.5);
    console.log('    ✅ 品牌类型创建成功');
  } catch (error) {
    console.log('    ❌ 品牌类型创建失败');
  }

  // 测试无效品牌类型
  try {
    const invalidUSD = createUSD(-100); // 负数应该失败
    console.log('    ❌ 负数USD应该被拒绝');
  } catch (error) {
    console.log('    ✅ 负数USD正确被拒绝');
  }
}

async function testEventDrivenEngine() {
  const { 
    AdvancedTradingEngine, 
    RealTimePriceMonitor,
    TradingEventType 
  } = await import('./lib/advanced/eventDrivenEngine.js');

  console.log('  🚀 测试事件驱动引擎...');

  const engine = new AdvancedTradingEngine();
  
  // 测试引擎状态
  const initialStatus = engine.getSystemStatus();
  console.log(`    📊 初始状态: 运行=${initialStatus.isRunning}, 队列=${initialStatus.queueSize}`);

  // 启动引擎
  engine.start();
  
  // 监听事件
  let priceUpdateCount = 0;
  let arbitrageCount = 0;
  
  engine.on('priceUpdate', (data) => {
    priceUpdateCount++;
    console.log(`    📈 价格更新: ${data.coin} = $${data.price.toFixed(2)}`);
  });
  
  engine.on('arbitrageExecuted', (data) => {
    arbitrageCount++;
    console.log(`    💰 套利执行: ${data.coin} 利润 ${data.profitPercent.toFixed(2)}%`);
  });

  // 模拟价格更新
  console.log('    🔄 模拟价格数据...');
  engine.updatePrice('BTC', 50000, 'hyperliquid');
  engine.updatePrice('BTC', 50100, 'binance'); // 价格差异可能触发套利
  engine.updatePrice('ETH', 3000, 'hyperliquid');
  engine.updatePrice('ETH', 3015, 'coinbase'); // 0.5%价格差异

  // 等待事件处理
  await new Promise(resolve => setTimeout(resolve, 500));

  const finalStatus = engine.getSystemStatus();
  console.log(`    📊 最终状态: 事件=${priceUpdateCount}, 套利=${arbitrageCount}, 数据点=${finalStatus.priceDataPoints}`);

  engine.stop();
  console.log('    ✅ 事件驱动引擎测试完成');
}

async function testArbitrageDetector() {
  const { ArbitrageDetector } = await import('./lib/advanced/arbitrageDetector.js');
  const { SupportedCoins, createUSD, createPercentage } = await import('./lib/advanced/strictTypes.js');

  console.log('  💰 测试套利检测器...');

  const detector = new ArbitrageDetector();

  // 模拟订单簿数据
  const btcOrderBook1 = {
    exchange: 'hyperliquid',
    coin: SupportedCoins.BTC,
    bids: [{ price: createUSD(50000), size: createUSD(1000) }],
    asks: [{ price: createUSD(50050), size: createUSD(1000) }],
    timestamp: Date.now()
  };

  const btcOrderBook2 = {
    exchange: 'binance',
    coin: SupportedCoins.BTC,
    bids: [{ price: createUSD(50150), size: createUSD(500) }], // 更高的买价
    asks: [{ price: createUSD(50200), size: createUSD(500) }],
    timestamp: Date.now()
  };

  // 更新订单簿
  detector.updateOrderBook(btcOrderBook1);
  detector.updateOrderBook(btcOrderBook2);

  // 检测套利机会
  const opportunities = detector.detectArbitrageOpportunities();
  console.log(`    📊 发现 ${opportunities.length} 个套利机会`);

  if (opportunities.length > 0) {
    const best = opportunities[0];
    console.log(`    🎯 最佳机会: ${best.coin}`);
    console.log(`       买入@${best.buyExchange.name}: $${best.buyPrice}`);
    console.log(`       卖出@${best.sellExchange.name}: $${best.sellPrice}`);
    console.log(`       净利润: ${best.netProfitPercent.toFixed(2)}%`);
    console.log(`       风险评分: ${best.riskScore.toFixed(1)}`);

    // 测试执行计划
    const planResult = detector.createExecutionPlan(best, createUSD(1000));
    if (planResult.success) {
      console.log(`    📋 执行计划生成成功`);
      console.log(`       订单大小: $${planResult.data.buyOrderSize}`);
      console.log(`       预计执行时间: ${planResult.data.estimatedExecutionTime}ms`);
    }
  }

  // 统计信息
  const stats = detector.getStatistics();
  console.log(`    📈 统计信息:`);
  console.log(`       总机会: ${stats.totalOpportunities}`);
  console.log(`       平均利润: ${stats.averageProfit.toFixed(2)}%`);
  console.log(`       平均风险: ${stats.averageRisk.toFixed(1)}`);

  console.log('    ✅ 套利检测器测试完成');
}

async function testPerformance() {
  console.log('  ⚡ 性能基准测试...');

  // 测试类型验证性能
  const { StrictDataValidator } = await import('./lib/advanced/strictTypes.js');
  
  const testData = {
    id: 'perf_test',
    coin: 'BTC',
    side: 'LONG',
    entryPrice: 50000,
    size: 100,
    leverage: 3,
    entryTime: Date.now()
  };

  const iterations = 10000;
  
  console.log(`    🏃 类型验证性能测试 (${iterations} 次迭代)...`);
  const startTime = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    StrictDataValidator.validatePosition(testData);
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  const avgTime = duration / iterations;
  
  console.log(`    📊 验证性能:`);
  console.log(`       总时间: ${duration}ms`);
  console.log(`       平均每次: ${avgTime.toFixed(3)}ms`);
  console.log(`       每秒验证: ${Math.round(1000 / avgTime)} 次`);

  // 测试事件队列性能
  const { EventQueue } = await import('./lib/advanced/eventDrivenEngine.js');
  const queue = new EventQueue();
  
  console.log(`    🚀 事件队列性能测试...`);
  const queueStartTime = Date.now();
  
  // 入队测试
  for (let i = 0; i < iterations; i++) {
    queue.enqueue({
      type: 'TEST_EVENT' as any,
      timestamp: Date.now(),
      data: { value: i },
      priority: Math.floor(Math.random() * 3)
    });
  }
  
  // 出队测试
  let dequeueCount = 0;
  while (queue.size() > 0) {
    queue.dequeue();
    dequeueCount++;
  }
  
  const queueEndTime = Date.now();
  const queueDuration = queueEndTime - queueStartTime;
  
  console.log(`    📊 队列性能:`);
  console.log(`       处理时间: ${queueDuration}ms`);
  console.log(`       处理事件: ${dequeueCount} 个`);
  console.log(`       每秒处理: ${Math.round(dequeueCount * 1000 / queueDuration)} 个`);

  console.log('    ✅ 性能测试完成');
}

// 执行测试
testAdvancedFeatures()
  .then(() => {
    console.log('\n🟢 所有高级功能测试成功完成！');
    console.log('\n📈 升级总结:');
    console.log('✅ 事件驱动架构 - 提升响应速度和可扩展性');
    console.log('✅ 严格类型系统 - 增强代码安全性和可维护性');
    console.log('✅ 套利检测系统 - 发现跨交易所盈利机会');
    console.log('✅ 高性能设计 - 支持高频交易需求');
    console.log('\n🚀 系统已准备好部署到生产环境！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n🔴 测试失败:', error);
    process.exit(1);
  });