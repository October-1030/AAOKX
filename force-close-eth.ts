/**
 * 强制平仓ETH脚本 - 使用市价单强制关闭ETH仓位
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
}

async function forceCloseETH() {
  // 动态导入以确保环境变量已设置
  const { HyperliquidClient } = await import('./lib/hyperliquidClient');
  const hyperliquid = new HyperliquidClient();

  console.log('🚨 强制平仓 ETH 仓位...\n');

  try {
    // 获取当前账户信息和持仓
    const accountInfo = await hyperliquid.getAccountInfo();
    const positions = accountInfo.positions || [];

    console.log(`📊 当前总持仓: ${positions.length} 个\n`);

    // 查找ETH仓位
    const ethPosition = positions.find((p: any) => p.position.coin === 'ETH-PERP');
    
    if (!ethPosition) {
      console.log('✅ ETH 仓位已平仓，无需操作');
      return;
    }

    console.log('🎯 发现 ETH 仓位:');
    console.log(`   Size: ${ethPosition.position.szi}`);
    console.log(`   Entry Price: $${ethPosition.position.entryPx}`);
    console.log(`   Unrealized PnL: $${ethPosition.position.unrealizedPnl}\n`);

    // 获取当前ETH价格
    const ethPrice = await hyperliquid.getMarketPrice('ETH');
    console.log(`[ETH] 当前价格: $${ethPrice}\n`);

    const size = Math.abs(parseFloat(ethPosition.position.szi));
    const isLong = parseFloat(ethPosition.position.szi) > 0;
    
    console.log(`🔄 执行强制平仓:`);
    console.log(`   方向: ${isLong ? 'LONG' : 'SHORT'}`);
    console.log(`   数量: ${size}`);
    console.log(`   需要执行: ${isLong ? 'SELL' : 'BUY'} 操作\n`);

    // 方法1: 使用placeOrder手动平仓
    console.log('📝 使用 placeOrder 执行平仓...');
    
    const isBuy = !isLong; // 如果是多头需要卖出，如果是空头需要买入
    const limitPrice = isBuy ? ethPrice * 1.02 : ethPrice * 0.98; // 2%滑点确保成交
    
    const order1 = await (hyperliquid as any).client.exchange.placeOrder({
      coin: 'ETH-PERP',
      is_buy: isBuy,
      sz: parseFloat(size.toFixed(4)), // ETH精度4位
      limit_px: parseFloat(limitPrice.toFixed(2)),
      order_type: { limit: { tif: 'Ioc' } }, // 立即成交或取消
      reduce_only: true,
    });

    console.log('✅ 平仓订单1已提交:', order1);
    
    // 等待2秒
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 再次检查仓位
    const updatedAccount = await hyperliquid.getAccountInfo();
    const remainingEthPosition = updatedAccount.positions?.find((p: any) => p.position.coin === 'ETH-PERP');
    
    if (remainingEthPosition) {
      console.log('⚠️ 仍有ETH仓位残留，尝试方法2...\n');
      
      // 方法2: 使用更激进的市价单
      const remainingSize = Math.abs(parseFloat(remainingEthPosition.position.szi));
      const newEthPrice = await hyperliquid.getMarketPrice('ETH');
      const aggressivePrice = isBuy ? newEthPrice * 1.05 : newEthPrice * 0.95; // 5%滑点
      
      console.log(`📝 使用激进市价单平仓剩余 ${remainingSize} ETH...`);
      
      const order2 = await (hyperliquid as any).client.exchange.placeOrder({
        coin: 'ETH-PERP',
        is_buy: isBuy,
        sz: parseFloat(remainingSize.toFixed(4)),
        limit_px: parseFloat(aggressivePrice.toFixed(2)),
        order_type: { limit: { tif: 'Ioc' } },
        reduce_only: false, // 尝试不使用reduce_only
      });
      
      console.log('✅ 激进平仓订单已提交:', order2);
    } else {
      console.log('🎉 ETH 仓位已完全平仓！');
    }

    // 最终状态检查
    await new Promise(resolve => setTimeout(resolve, 2000));
    const finalAccount = await hyperliquid.getAccountInfo();
    const finalPositions = finalAccount.positions || [];
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 最终账户状态:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`💰 账户权益: $${finalAccount.accountValue.toFixed(2)}`);
    console.log(`💵 可提现金额: $${finalAccount.withdrawable.toFixed(2)}`);
    console.log(`📊 剩余持仓: ${finalPositions.length} 个`);
    
    finalPositions.forEach((pos: any) => {
      console.log(`   - ${pos.position.coin}: ${parseFloat(pos.position.szi) > 0 ? 'LONG' : 'SHORT'} ${Math.abs(parseFloat(pos.position.szi))}`);
    });
    
    if (finalPositions.length === 0) {
      console.log('🎉 所有仓位已成功关闭！');
    }

  } catch (error) {
    console.error('❌ 强制平仓失败:', error);
    throw error;
  }
}

// 执行
forceCloseETH()
  .then(() => {
    console.log('\n🎉 强制平仓脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 强制平仓脚本执行失败:', error);
    process.exit(1);
  });