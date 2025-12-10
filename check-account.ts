/**
 * 快速检查OKX账户信息
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
const BASE_URL = 'https://www.okx.com';

function sign(timestamp: string, method: string, requestPath: string, body: string = '') {
  const message = timestamp + method + requestPath + body;
  return crypto.createHmac('sha256', SECRET_KEY).update(message).digest('base64');
}

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

  const response = await fetch(BASE_URL + endpoint, { method, headers });
  const data = await response.json();

  if (data.code !== '0') {
    throw new Error(`OKX API Error [${data.code}]: ${data.msg}`);
  }

  return data.data;
}

async function checkAccount() {
  console.log('═══════════════════════════════════════');
  console.log('   OKX 账户总览');
  console.log('═══════════════════════════════════════\n');

  try {
    // 获取账户余额
    const balance = await request('GET', '/api/v5/account/balance');
    const details = balance[0]?.details || [];

    console.log('💰 账户余额:');
    console.log('─'.repeat(50));

    const usdtDetail = details.find((d: any) => d.ccy === 'USDT');
    if (usdtDetail) {
      const availBal = parseFloat(usdtDetail.availBal || '0');
      const frozenBal = parseFloat(usdtDetail.frozenBal || '0');
      const eq = parseFloat(usdtDetail.eq || '0');

      console.log(`   USDT 可用: $${availBal.toFixed(2)}`);
      console.log(`   USDT 冻结: $${frozenBal.toFixed(2)}`);
      console.log(`   USDT 总计: $${eq.toFixed(2)}`);
    }

    // 获取账户配置
    const config = await request('GET', '/api/v5/account/config');
    const acctLv = config[0]?.acctLv || 'Unknown';
    const posMode = config[0]?.posMode || 'Unknown';

    console.log('\n⚙️  账户配置:');
    console.log('─'.repeat(50));
    console.log(`   账户等级: ${acctLv === '2' ? '统一账户' : acctLv}`);
    console.log(`   持仓模式: ${posMode === 'net_mode' ? '单向持仓' : posMode}`);

    // 获取持仓
    const positions = await request('GET', '/api/v5/account/positions');

    console.log('\n📊 持仓统计:');
    console.log('─'.repeat(50));
    console.log(`   持仓数量: ${positions.length} 个`);

    if (positions.length > 0) {
      let totalNotional = 0;
      let totalUpl = 0;

      positions.forEach((pos: any) => {
        totalNotional += parseFloat(pos.notionalUsd || '0');
        totalUpl += parseFloat(pos.upl || '0');
      });

      console.log(`   总名义价值: $${totalNotional.toFixed(2)}`);
      console.log(`   总未实现盈亏: ${totalUpl >= 0 ? '+' : ''}$${totalUpl.toFixed(2)}`);
      console.log(`   收益率: ${totalNotional > 0 ? ((totalUpl / totalNotional) * 100).toFixed(2) : '0.00'}%`);
    }

    console.log('\n═══════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ 查询失败:', error.message);
  }
}

checkAccount().catch(console.error);
