/**
 * OKX 持仓持续监控 - 每30秒自动刷新
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import crypto from 'crypto';

// 加载环境变量
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
const REFRESH_INTERVAL = 30000; // 30秒

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

async function checkPositions() {
  console.clear();
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           OKX 持仓实时监控 - 自动刷新 (30秒)            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const now = new Date();
  console.log(`📅 时间: ${now.toLocaleString('zh-CN')}`);
  console.log(`🔴 实盘交易模式`);
  console.log(`⏰ 下次刷新: ${new Date(now.getTime() + REFRESH_INTERVAL).toLocaleTimeString('zh-CN')}\n`);
  console.log('━'.repeat(60));

  try {
    // 获取持仓
    const positions = await request('GET', '/api/v5/account/positions');

    if (!positions || positions.length === 0) {
      console.log('\n✅ 当前无持仓\n');
    } else {
      console.log(`\n📊 当前持仓数量: ${positions.length}\n`);

      let totalNotional = 0;
      let totalUnrealizedPnL = 0;

      positions.forEach((pos: any, index: number) => {
        const instId = pos.instId || 'Unknown';
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

        // 计算盈亏颜色
        const uplColor = upl >= 0 ? '🟢' : '🔴';
        const uplSign = upl >= 0 ? '+' : '';

        console.log(`${index + 1}. ${instId}`);
        console.log(`   持仓: ${Math.abs(pos_size)} 张 | 杠杆: ${lever}x`);
        console.log(`   入场: $${avgPx.toFixed(2)} → 现价: $${markPx.toFixed(2)}`);
        console.log(`   ${uplColor} 盈亏: ${uplSign}$${upl.toFixed(2)} (${(uplRatio * 100).toFixed(2)}%)`);
        console.log(`   保证金: $${margin.toFixed(2)} | 爆仓价: $${liqPx.toFixed(2)}`);
        console.log('');
      });

      console.log('─'.repeat(60));
      console.log(`\n💰 总名义价值: $${totalNotional.toFixed(2)}`);

      const totalColor = totalUnrealizedPnL >= 0 ? '🟢' : '🔴';
      const totalSign = totalUnrealizedPnL >= 0 ? '+' : '';
      const totalPercent = totalNotional > 0 ? ((totalUnrealizedPnL / totalNotional) * 100).toFixed(2) : '0.00';

      console.log(`${totalColor} 总盈亏: ${totalSign}$${totalUnrealizedPnL.toFixed(2)} (${totalPercent}%)`);
    }

    // 获取账户余额
    const balance = await request('GET', '/api/v5/account/balance');
    const details = balance[0]?.details || [];
    const usdtDetail = details.find((d: any) => d.ccy === 'USDT');

    if (usdtDetail) {
      const availBal = parseFloat(usdtDetail.availBal || '0');
      const eq = parseFloat(usdtDetail.eq || '0');

      console.log(`\n💵 账户: 可用 $${availBal.toFixed(2)} | 总资产 $${eq.toFixed(2)}`);
    }

    console.log('\n━'.repeat(60));
    console.log('\n💡 按 Ctrl+C 停止监控\n');

  } catch (error: any) {
    console.error('\n❌ 查询失败:', error.message);
    console.log('将在30秒后重试...\n');
  }
}

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n\n👋 监控已停止');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 监控已停止');
  process.exit(0);
});

// 主循环
async function startMonitoring() {
  console.log('🚀 正在启动监控...\n');

  // 立即执行第一次
  await checkPositions();

  // 每30秒执行一次
  setInterval(async () => {
    await checkPositions();
  }, REFRESH_INTERVAL);
}

startMonitoring().catch(console.error);
