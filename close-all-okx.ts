/**
 * OKX 紧急平仓脚本 - 关闭所有持仓
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 手动加载环境变量
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
  console.log('✅ 环境变量已加载');
}

async function closeAllOKXPositions() {
  const { getOKXClient } = await import('./lib/okxClient');
  const okx = getOKXClient();

  console.log('\n🚨 开始平仓所有 OKX 持仓...\n');

  try {
    // 获取当前所有持仓
    const positions = await okx.getPositions();

    if (!positions || positions.length === 0) {
      console.log('✅ 没有持仓需要平仓');
      return;
    }

    console.log(`📊 当前持仓数量: ${positions.length}\n`);

    // 逐个平仓
    for (const position of positions) {
      const instId = position.instId;
      const pos = parseFloat(position.pos || '0');
      const avgPx = parseFloat(position.avgPx || '0');
      const upl = parseFloat(position.upl || '0');
      const side = pos > 0 ? 'LONG' : 'SHORT';

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🔄 正在平仓: ${instId}`);
      console.log(`   方向: ${side}`);
      console.log(`   入场价: $${avgPx.toFixed(2)}`);
      console.log(`   仓位大小: ${Math.abs(pos)}`);
      console.log(`   未实现盈亏: ${upl >= 0 ? '+' : ''}$${upl.toFixed(2)}`);

      try {
        // 平仓 = 反向下单
        const closeSide = pos > 0 ? 'sell' : 'buy';
        const result = await okx.request('POST', '/api/v5/trade/close-position', {
          instId: instId,
          mgnMode: 'isolated',
          ccy: 'USDT',
        });

        if (result.code === '0') {
          console.log(`✅ ${instId} 平仓成功`);
        } else {
          console.log(`⚠️ ${instId} 平仓返回: ${result.msg || result.code}`);
        }
      } catch (error) {
        console.error(`❌ ${instId} 平仓失败:`, error);
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log('✅ 所有平仓操作已完成\n');

    // 等待 2 秒后查询最新状态
    console.log('⏳ 等待 2 秒后查询最新状态...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 获取最新持仓
    const finalPositions = await okx.getPositions();
    const accountInfo = await okx.getAccountInfo();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 最终账户状态:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`💰 账户权益: $${parseFloat(accountInfo?.totalEq || '0').toFixed(2)}`);
    console.log(`📊 剩余持仓: ${finalPositions?.length || 0} 个`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (finalPositions && finalPositions.length > 0) {
      console.warn('⚠️ 警告: 仍有持仓未平仓！');
      finalPositions.forEach((pos: any) => {
        console.log(`   - ${pos.instId}: ${parseFloat(pos.pos) > 0 ? 'LONG' : 'SHORT'} ${Math.abs(parseFloat(pos.pos))}`);
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
closeAllOKXPositions()
  .then(() => {
    console.log('\n🎉 平仓脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 平仓脚本执行失败:', error);
    process.exit(1);
  });
