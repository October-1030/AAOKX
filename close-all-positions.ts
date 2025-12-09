/**
 * 紧急平仓脚本 - 关闭所有持仓
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 手动加载并设置环境变量
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
  console.log('✅ 环境变量已加载');
  console.log(`   HYPERLIQUID_API_SECRET: ${process.env.HYPERLIQUID_API_SECRET ? '已设置' : '未设置'}`);
  console.log(`   HYPERLIQUID_MAIN_WALLET: ${process.env.HYPERLIQUID_MAIN_WALLET}`);
}

async function closeAllPositions() {
  // 动态导入以确保环境变量已设置
  const { HyperliquidClient } = await import('./lib/hyperliquidClient');
  const hyperliquid = new HyperliquidClient();

  console.log('🚨 开始平仓所有持仓...\n');

  try {
    // 获取当前所有持仓
    const positions = await hyperliquid.getPositions();

    if (positions.length === 0) {
      console.log('✅ 没有持仓需要平仓');
      return;
    }

    console.log(`📊 当前持仓数量: ${positions.length}\n`);

    // 逐个平仓
    for (const position of positions) {
      const { coin, side, size, entryPrice, unrealizedPnL } = position;

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🔄 正在平仓: ${coin}`);
      console.log(`   方向: ${side}`);
      console.log(`   入场价: $${entryPrice.toFixed(2)}`);
      console.log(`   仓位大小: ${Math.abs(size)}`);
      console.log(`   未实现盈亏: ${unrealizedPnL >= 0 ? '+' : ''}$${unrealizedPnL.toFixed(2)}`);

      try {
        // 转换 "SOL-PERP" -> "SOL"
        const coinSymbol = coin.replace('-PERP', '') as any;
        const result = await hyperliquid.closePosition(coinSymbol);
        console.log(`✅ ${coin} 平仓成功`);
        console.log(`   返回信息:`, result);
      } catch (error) {
        console.error(`❌ ${coin} 平仓失败:`, error);
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log('✅ 所有平仓操作已完成\n');

    // 等待 2 秒后查询最新账户状态
    console.log('⏳ 等待 2 秒后查询最新账户状态...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 获取最新账户状态
    const accountInfo = await hyperliquid.getAccountInfo();
    const finalPositions = await hyperliquid.getPositions();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 最终账户状态:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`💰 账户权益: $${accountInfo.accountValue.toFixed(2)}`);
    console.log(`💵 可提现金额: $${accountInfo.withdrawable.toFixed(2)}`);
    console.log(`📊 剩余持仓: ${finalPositions.length} 个`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (finalPositions.length > 0) {
      console.warn('⚠️ 警告: 仍有持仓未平仓！');
      finalPositions.forEach((pos: any) => {
        console.log(`   - ${pos.coin}: ${pos.side} ${Math.abs(pos.size)}`);
      });
    } else {
      console.log('✅ 所有持仓已成功关闭！');
    }

  } catch (error) {
    console.error('❌ 平仓过程中发生错误:', error);
    throw error;
  }
}

// 执行
closeAllPositions()
  .then(() => {
    console.log('\n🎉 平仓脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 平仓脚本执行失败:', error);
    process.exit(1);
  });
