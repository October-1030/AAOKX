/**
 * OKX账户详细信息测试
 * 验证SOL等资产是否正确显示
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║              🏦 OKX 账户详细信息查询                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

async function checkAccountDetail() {
  try {
    const crypto = require('crypto');

    const config = {
      apiKey: process.env.OKX_API_KEY!,
      secretKey: process.env.OKX_SECRET_KEY!,
      passphrase: process.env.OKX_PASSPHRASE!,
      sandbox: process.env.OKX_SANDBOX === 'true',
    };

    // OKX API 签名方法
    function sign(timestamp: string, method: string, requestPath: string, body: string = '') {
      const message = timestamp + method + requestPath + body;
      const hmac = crypto.createHmac('sha256', config.secretKey);
      return hmac.update(message).digest('base64');
    }

    const baseUrl = 'https://www.okx.com';
    const timestamp = new Date().toISOString();

    console.log('📊 步骤1: 获取账户余额信息\n');

    // 1. 获取账户余额
    const balancePath = '/api/v5/account/balance';
    const balanceSign = sign(timestamp, 'GET', balancePath);

    const balanceResponse = await fetch(baseUrl + balancePath, {
      method: 'GET',
      headers: {
        'OK-ACCESS-KEY': config.apiKey,
        'OK-ACCESS-SIGN': balanceSign,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': config.passphrase,
        'x-simulated-trading': config.sandbox ? '1' : '0',
        'Content-Type': 'application/json',
      },
    });

    const balanceData = await balanceResponse.json();

    if (balanceData.code === '0') {
      console.log('✅ 账户余额查询成功\n');

      const accountData = balanceData.data[0];

      console.log('💰 账户总览:');
      console.log(`   总权益 (totalEq): ${parseFloat(accountData.totalEq).toLocaleString()} USD`);
      console.log(`   可用保证金 (availEq): ${parseFloat(accountData.availEq).toLocaleString()} USD`);
      console.log(`   已用保证金 (ordFroz): ${parseFloat(accountData.ordFroz || 0).toLocaleString()} USD`);
      console.log(`   未实现盈亏 (upl): ${parseFloat(accountData.upl || 0).toFixed(2)} USD\n`);

      // 显示各币种资产
      const details = accountData.details || [];

      if (details.length > 0) {
        console.log('🪙 各币种资产明细:\n');

        // 按权益价值排序
        const sortedDetails = details
          .map((d: any) => ({
            ccy: d.ccy,
            eq: parseFloat(d.eq),
            availEq: parseFloat(d.availEq),
            eqUsd: parseFloat(d.eqUsd || 0),
          }))
          .filter((d: any) => d.eq > 0.0001) // 过滤掉极小的余额
          .sort((a: any, b: any) => b.eqUsd - a.eqUsd); // 按USD价值降序

        let totalValue = 0;

        sortedDetails.forEach((asset: any, index: number) => {
          totalValue += asset.eqUsd;

          console.log(`   ${index + 1}. ${asset.ccy}:`);
          console.log(`      数量: ${asset.eq.toLocaleString()}`);
          console.log(`      可用: ${asset.availEq.toLocaleString()}`);
          console.log(`      价值: $${asset.eqUsd.toLocaleString()} USD`);

          // 特别标注SOL
          if (asset.ccy === 'SOL') {
            const solPrice = asset.eqUsd / asset.eq;
            console.log(`      🌟 SOL当前价格约: $${solPrice.toFixed(2)}`);
            console.log(`      💰 这些SOL可以作为保证金交易！`);
          }
          console.log('');
        });

        console.log(`   📊 资产总价值: $${totalValue.toLocaleString()} USD\n`);

        // 检查是否有SOL
        const solAsset = sortedDetails.find((d: any) => d.ccy === 'SOL');
        if (solAsset) {
          console.log('✅ 检测到SOL资产！');
          console.log(`   你有 ${solAsset.eq} SOL（价值约$${solAsset.eqUsd.toLocaleString()}）`);
          console.log(`   这些SOL在OKX统一账户中可以作为保证金使用\n`);
        } else {
          console.log('⚠️  未检测到SOL资产');
          console.log('   请确认SOL是否在统一账户中\n');
        }

      } else {
        console.log('ℹ️  账户中暂无资产\n');
      }

      console.log('📝 说明:');
      console.log('   - OKX统一账户会将所有币种自动折算成USD价值');
      console.log('   - 你可以使用账户中的任何资产作为保证金交易');
      console.log('   - 系统会自动管理保证金和风险控制\n');

    } else {
      console.log('❌ 查询失败\n');
      console.log(`   错误码: ${balanceData.code}`);
      console.log(`   错误信息: ${balanceData.msg}\n`);
    }

    console.log('📊 步骤2: 获取持仓信息\n');

    // 2. 获取持仓
    const positionsPath = '/api/v5/account/positions';
    const timestamp2 = new Date().toISOString();
    const positionsSign = sign(timestamp2, 'GET', positionsPath);

    const positionsResponse = await fetch(baseUrl + positionsPath, {
      method: 'GET',
      headers: {
        'OK-ACCESS-KEY': config.apiKey,
        'OK-ACCESS-SIGN': positionsSign,
        'OK-ACCESS-TIMESTAMP': timestamp2,
        'OK-ACCESS-PASSPHRASE': config.passphrase,
        'x-simulated-trading': config.sandbox ? '1' : '0',
        'Content-Type': 'application/json',
      },
    });

    const positionsData = await positionsResponse.json();

    if (positionsData.code === '0') {
      const positions = positionsData.data || [];

      if (positions.length > 0) {
        console.log(`✅ 当前有 ${positions.length} 个持仓\n`);

        positions.forEach((pos: any, index: number) => {
          console.log(`   ${index + 1}. ${pos.instId}:`);
          console.log(`      方向: ${pos.posSide === 'long' ? '做多 📈' : '做空 📉'}`);
          console.log(`      数量: ${pos.pos}`);
          console.log(`      杠杆: ${pos.lever}x`);
          console.log(`      未实现盈亏: ${pos.upl} USD`);
          console.log('');
        });
      } else {
        console.log('✅ 当前无持仓\n');
      }
    }

  } catch (error: any) {
    console.log('❌ 查询失败\n');
    console.log(`   错误: ${error.message}\n`);
  }
}

console.log('🔍 正在查询OKX账户详细信息...\n');

checkAccountDetail().then(() => {
  console.log('═'.repeat(60));
  console.log('🎉 查询完成！');
  console.log('═'.repeat(60));
  console.log('\n💡 下一步:');
  console.log('   1. 如果看到SOL资产，可以直接启动交易系统');
  console.log('   2. 运行命令: npm run dev');
  console.log('   3. 打开浏览器访问 http://localhost:3000');
  console.log('   4. 点击"开始交易"按钮\n');
});
