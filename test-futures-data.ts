/**
 * 合约数据（Open Interest & Funding Rate）测试
 *
 * 完全免费，无需注册，无需 API Key！
 *
 * 运行方法：
 * npx tsx test-futures-data.ts
 */

import {
  getFuturesData,
  getAllFuturesData,
  explainFundingRate,
  explainOpenInterest,
} from './lib/futuresData';
import { Coin } from './types/trading';

console.log('==========================================');
console.log('📊 测试合约数据获取（完全免费！）');
console.log('==========================================\n');

console.log('✨ 数据来源: Binance Futures 公开 API');
console.log('✅ 完全免费');
console.log('✅ 无需注册');
console.log('✅ 无需 API Key\n');

(async () => {
  try {
    // ========== 测试 1: 获取单个币种数据 ==========

    console.log('==========================================');
    console.log('🪙 测试 1: 获取 BTC 合约数据');
    console.log('==========================================\n');

    const btcData = await getFuturesData('BTC');

    console.log('\n📊 BTC 完整数据:');
    console.log(`  - 币种: ${btcData.coin}`);
    console.log(`  - 持仓量: ${btcData.openInterest.toLocaleString()} USDT`);
    console.log(`  - 资金费率: ${(btcData.fundingRate * 100).toFixed(4)}%`);
    console.log(`  - 标记价格: $${btcData.markPrice.toLocaleString()}`);
    console.log(`  - 指数价格: $${btcData.indexPrice.toLocaleString()}`);
    console.log(
      `  - 下次资金费: ${new Date(btcData.nextFundingTime).toLocaleString()}`
    );

    // 解释资金费率
    console.log('\n💡 资金费率分析:');
    const frExplain = explainFundingRate(btcData.fundingRate);
    console.log(`  - 市场情绪: ${frExplain.sentiment}`);
    console.log(`  - 强度: ${frExplain.strength}`);
    console.log(`  - 说明: ${frExplain.description}`);

    // 解释持仓量
    console.log('\n💡 持仓量分析:');
    const oiExplain = explainOpenInterest(btcData.openInterest);
    console.log(`  - 水平: ${oiExplain.level}`);
    console.log(`  - 说明: ${oiExplain.description}\n`);

    // ========== 测试 2: 批量获取所有币种 ==========

    console.log('==========================================');
    console.log('📦 测试 2: 批量获取所有币种数据');
    console.log('==========================================\n');

    const coins: Coin[] = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP'];
    const allData = await getAllFuturesData(coins);

    console.log('📊 所有币种数据汇总:\n');
    console.log(
      '┌─────────┬──────────────────┬──────────────┬──────────────┐'
    );
    console.log(
      '│ 币种    │ 持仓量 (USDT)    │ 资金费率 (%) │ 标记价格 ($) │'
    );
    console.log(
      '├─────────┼──────────────────┼──────────────┼──────────────┤'
    );

    allData.forEach((data) => {
      const oi = (data.openInterest / 1_000_000_000).toFixed(2) + 'B'; // 转换为 B (十亿)
      const fr = (data.fundingRate * 100).toFixed(4);
      const price = data.markPrice.toFixed(2);

      console.log(
        `│ ${data.coin.padEnd(7)} │ ${oi.padStart(16)} │ ${fr.padStart(12)} │ ${price.padStart(12)} │`
      );
    });

    console.log(
      '└─────────┴──────────────────┴──────────────┴──────────────┘\n'
    );

    // ========== 测试 3: 资金费率详细分析 ==========

    console.log('==========================================');
    console.log('💰 测试 3: 资金费率详细分析');
    console.log('==========================================\n');

    console.log('📈 资金费率排行榜（从多头到空头）:\n');

    const sorted = allData.sort((a, b) => b.fundingRate - a.fundingRate);

    sorted.forEach((data, index) => {
      const fr = (data.fundingRate * 100).toFixed(4);
      const explain = explainFundingRate(data.fundingRate);

      let emoji = '😐';
      if (explain.sentiment === 'BULLISH') emoji = '📈';
      else if (explain.sentiment === 'BEARISH') emoji = '📉';

      console.log(
        `${index + 1}. ${emoji} ${data.coin} - ${fr}% (${explain.sentiment})`
      );
      console.log(`   ${explain.description}\n`);
    });

    // ========== 测试 4: 持仓量详细分析 ==========

    console.log('==========================================');
    console.log('📊 测试 4: 持仓量详细分析');
    console.log('==========================================\n');

    console.log('🏆 持仓量排行榜（从高到低）:\n');

    const sortedByOI = allData.sort((a, b) => b.openInterest - a.openInterest);

    sortedByOI.forEach((data, index) => {
      const oi = (data.openInterest / 1_000_000_000).toFixed(2);
      const explain = explainOpenInterest(data.openInterest);

      console.log(`${index + 1}. ${data.coin} - ${oi}B USDT (${explain.level})`);
      console.log(`   ${explain.description}\n`);
    });

    // ========== 测试 5: 交易信号分析 ==========

    console.log('==========================================');
    console.log('🚦 测试 5: 交易信号分析');
    console.log('==========================================\n');

    console.log('基于 Funding Rate 的交易建议:\n');

    allData.forEach((data) => {
      const fr = data.fundingRate;
      const explain = explainFundingRate(fr);

      let signal = '';
      if (fr > 0.05) {
        signal = '⚠️  极度多头拥挤，考虑做空';
      } else if (fr > 0.02) {
        signal = '📈 多头倾向，谨慎追多';
      } else if (fr < -0.05) {
        signal = '⚠️  极度空头拥挤，考虑做多';
      } else if (fr < -0.02) {
        signal = '📉 空头倾向，谨慎追空';
      } else {
        signal = '😐 市场中性，等待信号';
      }

      console.log(`${data.coin}:`);
      console.log(`  资金费率: ${(fr * 100).toFixed(4)}%`);
      console.log(`  市场情绪: ${explain.sentiment}`);
      console.log(`  建议: ${signal}\n`);
    });

    // ========== 完成 ==========

    console.log('==========================================');
    console.log('🎉 所有测试完成！');
    console.log('==========================================\n');

    console.log('✅ 测试结果:');
    console.log(`   ✅ 单个币种数据获取 - 成功`);
    console.log(`   ✅ 批量获取 ${coins.length} 个币种 - 成功`);
    console.log(`   ✅ 资金费率分析 - 成功`);
    console.log(`   ✅ 持仓量分析 - 成功`);
    console.log(`   ✅ 交易信号生成 - 成功\n`);

    console.log('💡 这些数据如何使用:');
    console.log('   1. 资金费率极端值 → 市场情绪指标');
    console.log('   2. 持仓量变化 → 趋势确认');
    console.log('   3. 标记价格 vs 指数价格 → 溢价/折价');
    console.log('   4. 结合技术指标 → 更准确的交易决策\n');

    console.log('🔗 数据来源:');
    console.log('   - Binance Futures 公开 API');
    console.log('   - 完全免费，无需注册');
    console.log('   - 实时更新（每秒）\n');

    console.log('📊 API 端点示例:');
    console.log('   - Open Interest:');
    console.log('     https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT');
    console.log('   - Funding Rate:');
    console.log('     https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT');
    console.log('   - Mark Price:');
    console.log('     https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT\n');

    console.log('🚀 下一步:');
    console.log('   1. 集成到 tradingEngine.ts');
    console.log('   2. 在 AI 提示词中包含这些数据');
    console.log('   3. AI 可以根据资金费率和持仓量做更明智的决策\n');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.log('\n如果遇到网络错误，请检查:');
    console.log('1. 网络连接是否正常');
    console.log('2. 是否能访问 Binance API（可能需要代理）');
    console.log('3. 防火墙是否阻止了请求\n');
    process.exit(1);
  }
})();
