/**
 * DeepSeek API 连接测试
 *
 * 这个脚本会测试你的 DeepSeek API Key 是否正确配置
 *
 * 运行步骤：
 * 1. 复制 .env.example 为 .env.local
 *    cp .env.example .env.local
 *
 * 2. 编辑 .env.local，填入你的 DeepSeek API Key
 *    DEEPSEEK_API_KEY=sk-your-actual-api-key
 *
 * 3. 运行测试
 *    npx tsx test-deepseek-api.ts
 */

import { config } from 'dotenv';
import { callDeepSeek, testDeepSeekConnection } from './lib/deepseekClient';
import {
  generateNOF1SystemPrompt,
  generateNOF1UserPrompt,
  parseNOF1Response,
} from './lib/tradingPromptNOF1';
import { AccountStatus, MarketData } from './types/trading';

// 加载环境变量
config({ path: '.env.local' });

// ========== 测试 1: 检查 API Key ==========

console.log('==========================================');
console.log('🔑 测试 1: 检查 DeepSeek API Key');
console.log('==========================================\n');

const apiKey = process.env.DEEPSEEK_API_KEY;

if (!apiKey) {
  console.error('❌ 错误: DEEPSEEK_API_KEY 未设置！\n');
  console.log('请按照以下步骤操作：\n');
  console.log('1️⃣  访问 DeepSeek 平台：');
  console.log('   https://platform.deepseek.com\n');
  console.log('2️⃣  注册/登录账号\n');
  console.log('3️⃣  前往 API Keys 页面：');
  console.log('   https://platform.deepseek.com/api_keys\n');
  console.log('4️⃣  点击 "创建 API Key"\n');
  console.log('5️⃣  复制生成的 API Key（格式：sk-...）\n');
  console.log('6️⃣  编辑 .env.local 文件，添加：');
  console.log('   DEEPSEEK_API_KEY=sk-your-api-key-here\n');
  console.log('7️⃣  重新运行此测试\n');
  process.exit(1);
}

console.log(`✅ API Key 已找到: ${apiKey.substring(0, 10)}...`);
console.log(`   长度: ${apiKey.length} 字符\n`);

// ========== 测试 2: 简单连接测试 ==========

console.log('==========================================');
console.log('🔌 测试 2: 测试 API 连接');
console.log('==========================================\n');

(async () => {
  try {
    const isConnected = await testDeepSeekConnection();

    if (!isConnected) {
      console.error('\n❌ API 连接测试失败！');
      console.log('\n请检查：');
      console.log('1. API Key 是否正确');
      console.log('2. 网络连接是否正常');
      console.log('3. DeepSeek 账户是否有余额');
      console.log('\n访问 https://platform.deepseek.com 检查账户状态\n');
      process.exit(1);
    }

    // ========== 测试 3: 交易决策测试 ==========

    console.log('==========================================');
    console.log('🤖 测试 3: 生成交易决策（真实场景）');
    console.log('==========================================\n');

    // 模拟市场数据
    const mockMarketData: MarketData[] = [
      {
        coin: 'BTC',
        current: {
          price: 67234.56,
          ema_20: 66987.23,
          ema_50: 66234.12,
          ema_200: 65123.45,
          macd: 0.0123,
          macd_signal: 0.0098,
          macd_histogram: 0.0025,
          rsi: 52.3,
          rsi_7: 45.2,
          rsi_14: 52.3,
          atr: 1456.78,
          atr_3: 1234.56,
          atr_14: 1456.78,
          volume: 123400000,
          volume_ratio: 1.07,
        },
        intraday: Array.from({ length: 10 }, (_, i) => ({
          timestamp: Date.now() - (10 - i) * 600000,
          open: 67100 + i * 10,
          high: 67150 + i * 10,
          low: 67050 + i * 10,
          close: 67100 + i * 13,
          volume: 12340000,
        })),
        daily: [],
      },
    ];

    // 模拟账户状态
    const mockAccountStatus: AccountStatus = {
      tradingDuration: 7200000,
      totalCalls: 24,
      totalReturn: 12.5,
      availableCash: 8500,
      totalEquity: 11250,
      positions: [],
    };

    console.log('📝 场景设置:');
    console.log(`   - BTC 当前价格: $${mockMarketData[0].current.price.toLocaleString()}`);
    console.log(`   - RSI-7: ${mockMarketData[0].current.rsi_7.toFixed(2)}`);
    console.log(`   - RSI-14: ${mockMarketData[0].current.rsi_14.toFixed(2)}`);
    console.log(`   - MACD: ${mockMarketData[0].current.macd.toFixed(4)}`);
    console.log(`   - 账户余额: $${mockAccountStatus.availableCash.toLocaleString()}`);
    console.log(`   - 当前持仓: ${mockAccountStatus.positions.length} 个\n`);

    // 生成保守策略
    const conservativeStrategy = `
你是一个极其保守的价值投资者，你的唯一目标是实现长期稳定复利

交易铁律：
- 只在 RSI 指标低于 30 时考虑买入（LONG），高于 70 时考虑卖出（SHORT）
- 单笔交易风险绝对不能超过总资产的 1%
- 杠杆倍数严格控制在 10-15 倍之间
- 永远不要在亏损时加仓
- 每天最多交易 3 次，避免过度交易
`;

    console.log('⚙️  交易策略: 保守型价值投资\n');

    // 生成提示词
    const systemPrompt = generateNOF1SystemPrompt(conservativeStrategy);
    const userPrompt = generateNOF1UserPrompt(mockAccountStatus, mockMarketData);

    console.log(`📊 提示词统计:`);
    console.log(`   - SYSTEM_PROMPT: ${systemPrompt.length} 字符`);
    console.log(`   - USER_PROMPT: ${userPrompt.length} 字符`);
    console.log(`   - 总计: ${(systemPrompt.length + userPrompt.length).toLocaleString()} 字符\n`);

    // 调用 DeepSeek API
    console.log('🚀 调用 DeepSeek API，请稍候...\n');

    const aiResponse = await callDeepSeek(
      systemPrompt,
      userPrompt,
      'DeepSeek Conservative'
    );

    console.log('==========================================');
    console.log('📊 AI 响应分析');
    console.log('==========================================\n');

    console.log('🧠 完整响应（前 500 字符）:');
    console.log('---');
    console.log(aiResponse.substring(0, 500) + '...\n');

    // 解析响应
    console.log('🔍 解析交易决策...\n');
    const parsed = parseNOF1Response(aiResponse);

    console.log('📋 Chain of Thought (思维链):');
    console.log('---');
    console.log(parsed.chainOfThought.substring(0, 400) + '...\n');

    console.log('💼 Trading Decisions (交易决策):');
    console.log('---');
    if (parsed.decisions.length === 0) {
      console.log('   无具体交易决策（可能是 HOLD 或 WAIT）\n');
    } else {
      parsed.decisions.forEach((decision, i) => {
        console.log(`${i + 1}. ${decision.coin}`);
        console.log(`   动作: ${decision.action}`);
        console.log(`   信心: ${decision.confidence}%`);
        if (decision.quantity) {
          console.log(`   数量: ${decision.quantity}`);
          console.log(`   方向: ${decision.side}`);
        }
        console.log('');
      });
    }

    // ========== 测试完成 ==========

    console.log('==========================================');
    console.log('🎉 所有测试完成！');
    console.log('==========================================\n');

    console.log('✅ DeepSeek API 集成成功！\n');

    console.log('📊 测试结果总结:');
    console.log('   ✅ API Key 验证通过');
    console.log('   ✅ API 连接正常');
    console.log('   ✅ 交易决策生成成功');
    console.log('   ✅ 响应解析正常\n');

    console.log('💡 下一步:');
    console.log('   1. 在 tradingEngine.ts 中集成 DeepSeek');
    console.log('   2. 为 6 个模型分配不同的交易策略');
    console.log('   3. 启动服务器观察实时交易\n');

    console.log('💰 成本估算:');
    console.log('   - 本次测试成本: ~$0.001 (约 ¥0.007)');
    console.log('   - 每次交易决策: ~$0.0005');
    console.log('   - 每天成本（6 模型，3分钟间隔）: ~$1.44');
    console.log('   - 每月成本: ~$43\n');

    console.log('🎯 对比 GPT-4:');
    console.log('   - DeepSeek: $43/月');
    console.log('   - GPT-4: $3,000+/月 (70倍更贵！)\n');

    console.log('✨ DeepSeek 优势:');
    console.log('   ✅ 成本极低（比 GPT-4 便宜 70 倍）');
    console.log('   ✅ 性能接近（特别是中文场景）');
    console.log('   ✅ 响应速度快');
    console.log('   ✅ 国内访问稳定\n');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.log('\n如果遇到问题，请检查：');
    console.log('1. API Key 是否正确（复制时可能有空格）');
    console.log('2. DeepSeek 账户是否有余额（至少充值 $1）');
    console.log('3. 网络连接是否正常（可能需要代理）');
    console.log('4. .env.local 文件是否在项目根目录\n');
    console.log('需要帮助？访问：https://platform.deepseek.com/docs\n');
    process.exit(1);
  }
})();
