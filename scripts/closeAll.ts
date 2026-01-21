/**
 * 紧急平仓脚本
 * 用法: npx ts-node scripts/closeAll.ts
 */

import { getOKXClient } from '../lib/okxClient';

async function closeAllPositions() {
  console.log('='.repeat(50));
  console.log('🚨 紧急平仓脚本');
  console.log('='.repeat(50));

  const okxClient = getOKXClient();

  if (!okxClient.isAvailable()) {
    console.error('❌ OKX 客户端未初始化');
    process.exit(1);
  }

  try {
    // 获取所有仓位
    console.log('\n📊 获取当前仓位...');
    const positions = await okxClient.getPositions();

    if (positions.length === 0) {
      console.log('✅ 没有持仓');
      process.exit(0);
    }

    console.log(`📊 发现 ${positions.length} 个仓位:`);
    for (const pos of positions) {
      const size = parseFloat(pos.pos || '0');
      if (Math.abs(size) > 0) {
        console.log(`  - ${pos.instId}: ${size > 0 ? 'LONG' : 'SHORT'} ${Math.abs(size)} 张`);
      }
    }

    // 平掉 DOGE 仓位
    console.log('\n🔴 开始平仓 DOGE...');
    const result = await okxClient.closePosition('DOGE');
    console.log('📥 OKX 返回:', JSON.stringify(result, null, 2));

    console.log('\n✅ 平仓指令已发送！');
    console.log('请检查 OKX 确认仓位已平。');

  } catch (error) {
    console.error('❌ 平仓失败:', error);
    process.exit(1);
  }
}

closeAllPositions();
