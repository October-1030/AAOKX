/**
 * 测试交易执行脚本
 * 直接运行交易引擎，查看完整日志
 */

const fs = require('fs');
const path = require('path');

// 🔥 关键修复：加载 .env.local 文件
require('dotenv').config({ path: '.env.local' });

// 设置环境变量
process.env.NODE_ENV = 'development';

console.log('🔑 环境变量检查:');
console.log('  DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? '✅ 已配置' : '❌ 未配置');
console.log('  HYPERLIQUID_API_SECRET:', process.env.HYPERLIQUID_API_SECRET ? '✅ 已配置' : '❌ 未配置');
console.log('  HYPERLIQUID_TESTNET:', process.env.HYPERLIQUID_TESTNET);
console.log('');

// 重定向 console.log 到文件
const logFile = path.join(__dirname, 'trading-test.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  logStream.write(`[LOG] ${message}\n`);
  originalLog(...args);
};

console.error = (...args) => {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  logStream.write(`[ERROR] ${message}\n`);
  originalError(...args);
};

console.warn = (...args) => {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  logStream.write(`[WARN] ${message}\n`);
  originalWarn(...args);
};

async function runTest() {
  console.log('\n\n========================================');
  console.log('🚀 开始测试交易执行');
  console.log(`⏰ 时间: ${new Date().toLocaleString()}`);
  console.log('========================================\n');

  try {
    // 使用 tsx 加载 TypeScript 模块
    const { TradingEngineState } = await import('./lib/tradingEngine.ts');
    const { AI_MODELS } = await import('./lib/aiModels.ts');
    const { initializeMarketData, updateMarketData } = await import('./lib/marketData.ts');

    console.log('📊 初始化市场数据...');
    await initializeMarketData();

    console.log('🤖 初始化交易引擎...');
    const engine = new TradingEngineState(AI_MODELS);

    console.log('🔄 更新市场数据...');
    await updateMarketData();

    console.log('⚡ 执行交易周期...\n');
    await engine.executeTradingCycle();

    console.log('\n✅ 交易周期执行完成！');
    console.log('📄 完整日志已保存到: trading-test.log');

    // 显示性能摘要
    console.log('\n========================================');
    console.log('📊 模型表现摘要');
    console.log('========================================');
    const performances = engine.getAllPerformances();
    performances.forEach(perf => {
      console.log(`\n🤖 ${perf.displayName}:`);
      console.log(`  💰 当前权益: $${perf.currentEquity.toFixed(2)}`);
      console.log(`  📈 总回报: ${perf.totalReturn.toFixed(2)}%`);
      console.log(`  📊 持仓数: ${perf.positions.length}`);
    });

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error(error.stack);
  } finally {
    logStream.end();
    process.exit(0);
  }
}

// 运行测试
runTest();
