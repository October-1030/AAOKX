/**
 * 检查OKX当前持仓
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// 先加载 .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const key in envConfig) {
    process.env[key] = envConfig[key];
  }
  console.log('✅ 已加载 .env.local 环境变量');
  console.log(`   OKX_SANDBOX: ${process.env.OKX_SANDBOX}`);
  console.log(`   OKX_API_KEY: ${process.env.OKX_API_KEY?.substring(0, 12)}...`);
  console.log('');
}

import { getOKXClient } from './lib/okxClient';

async function checkPositions() {
  console.log('========================================');
  console.log('   检查OKX实际持仓');
  console.log('========================================\n');

  try {
    const okx = getOKXClient();

    // 获取所有持仓
    console.log('🔍 正在查询持仓...\n');
    const positions = await okx.getPositions();

    if (!positions || positions.length === 0) {
      console.log('✅ 当前无持仓\n');
      return;
    }

    console.log(`📊 当前持仓数量: ${positions.length}\n`);
    console.log('详细信息:');
    console.log('─'.repeat(80));

    let totalNotional = 0;
    let totalUnrealizedPnL = 0;

    positions.forEach((pos: any, index: number) => {
      const instId = pos.instId || 'Unknown';
      const posSide = pos.posSide || 'Unknown';
      const pos_size = parseFloat(pos.pos || '0');
      const avgPx = parseFloat(pos.avgPx || '0');
      const markPx = parseFloat(pos.markPx || '0');
      const lever = parseFloat(pos.lever || '0');
      const notionalUsd = parseFloat(pos.notionalUsd || '0');
      const upl = parseFloat(pos.upl || '0');
      const uplRatio = parseFloat(pos.uplRatio || '0');
      const liqPx = parseFloat(pos.liqPx || '0');

      totalNotional += notionalUsd;
      totalUnrealizedPnL += upl;

      console.log(`\n${index + 1}. ${instId}`);
      console.log(`   方向: ${posSide === 'long' ? '做多 (LONG)' : posSide === 'short' ? '做空 (SHORT)' : posSide}`);
      console.log(`   持仓量: ${pos_size} 张`);
      console.log(`   开仓均价: $${avgPx.toFixed(2)}`);
      console.log(`   当前标记价: $${markPx.toFixed(2)}`);
      console.log(`   杠杆: ${lever}x`);
      console.log(`   名义价值: $${notionalUsd.toFixed(2)}`);
      console.log(`   未实现盈亏: $${upl.toFixed(2)} (${(uplRatio * 100).toFixed(2)}%)`);
      if (liqPx > 0) {
        console.log(`   爆仓价: $${liqPx.toFixed(2)}`);
      }
    });

    console.log('\n' + '─'.repeat(80));
    console.log(`\n💰 总计:`);
    console.log(`   总名义价值: $${totalNotional.toFixed(2)}`);
    console.log(`   总未实现盈亏: $${totalUnrealizedPnL.toFixed(2)}`);
    console.log(`   平均收益率: ${totalNotional > 0 ? ((totalUnrealizedPnL / totalNotional) * 100).toFixed(2) : 0}%`);

    console.log('\n========================================\n');

  } catch (error: any) {
    console.error('❌ 查询持仓失败:', error.message);
    if (error.response) {
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// 运行
checkPositions().catch(console.error);
