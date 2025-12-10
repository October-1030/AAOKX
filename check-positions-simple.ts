/**
 * 检查OKX当前持仓 - 简化版
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import crypto from 'crypto';

// 先加载 .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const key in envConfig) {
    process.env[key] = envConfig[key];
  }
}

const API_KEY = process.env.OKX_API_KEY!;
const SECRET_KEY = process.env.OKX_SECRET_KEY!;
const PASSPHRASE = process.env.OKX_PASSPHRASE!;
const IS_SANDBOX = process.env.OKX_SANDBOX === 'true';
const BASE_URL = 'https://www.okx.com';

// 生成签名
function sign(timestamp: string, method: string, requestPath: string, body: string = '') {
  const message = timestamp + method + requestPath + body;
  return crypto.createHmac('sha256', SECRET_KEY).update(message).digest('base64');
}

// 发送请求
async function request(method: string, endpoint: string) {
  const timestamp = new Date().toISOString();
  const signature = sign(timestamp, method, endpoint);

  const headers = {
    'OK-ACCESS-KEY': API_KEY,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': PASSPHRASE,
    'Content-Type': 'application/json',
  };

  const url = BASE_URL + endpoint;
  console.log(`📡 请求: ${method} ${url}`);

  const response = await fetch(url, {
    method,
    headers,
  });

  const data = await response.json();

  if (data.code !== '0') {
    throw new Error(`OKX API Error [${data.code}]: ${data.msg}`);
  }

  return data.data;
}

async function checkPositions() {
  console.log('========================================');
  console.log('   检查OKX实际持仓');
  console.log('========================================\n');
  console.log(`🔧 配置信息:`);
  console.log(`   环境: ${IS_SANDBOX ? '🧪 模拟' : '🔴 实盘'}`);
  console.log(`   API Key: ${API_KEY.substring(0, 12)}...`);
  console.log('');

  try {
    // 获取所有持仓
    console.log('🔍 正在查询持仓...\n');
    const positions = await request('GET', '/api/v5/account/positions');

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
      const margin = parseFloat(pos.margin || '0');

      totalNotional += notionalUsd;
      totalUnrealizedPnL += upl;

      console.log(`\n${index + 1}. ${instId}`);
      console.log(`   方向: ${posSide === 'long' ? '做多 (LONG)' : posSide === 'short' ? '做空 (SHORT)' : posSide}`);
      console.log(`   持仓量: ${pos_size} 张`);
      console.log(`   开仓均价: $${avgPx.toFixed(2)}`);
      console.log(`   当前标记价: $${markPx.toFixed(2)}`);
      console.log(`   杠杆: ${lever}x`);
      console.log(`   保证金: $${margin.toFixed(2)}`);
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
    if (totalNotional > 0) {
      console.log(`   平均收益率: ${((totalUnrealizedPnL / totalNotional) * 100).toFixed(2)}%`);
    }

    console.log('\n========================================\n');

  } catch (error: any) {
    console.error('❌ 查询持仓失败:', error.message);
  }
}

// 运行
checkPositions().catch(console.error);
