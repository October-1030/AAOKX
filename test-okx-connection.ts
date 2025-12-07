/**
 * OKX API 连接测试
 * 测试API密钥是否正确配置
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║              🏦 OKX API 连接测试                          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

// 检查环境变量
console.log('📋 步骤1: 检查环境变量配置\n');

const config = {
  apiKey: process.env.OKX_API_KEY,
  secretKey: process.env.OKX_SECRET_KEY,
  passphrase: process.env.OKX_PASSPHRASE,
  sandbox: process.env.OKX_SANDBOX === 'true',
};

console.log(`   API Key: ${config.apiKey ? '✅ 已配置 (' + config.apiKey.substring(0, 8) + '...)' : '❌ 未配置'}`);
console.log(`   Secret Key: ${config.secretKey ? '✅ 已配置 (' + config.secretKey.substring(0, 8) + '...)' : '❌ 未配置'}`);
console.log(`   Passphrase: ${config.passphrase && config.passphrase !== 'YOUR_PASSPHRASE_HERE' ? '✅ 已配置' : '❌ 未配置（需要填写）'}`);
console.log(`   环境: ${config.sandbox ? '🧪 模拟盘' : '💰 实盘'}\n`);

// 检查是否缺少必要参数
if (!config.apiKey || !config.secretKey || !config.passphrase || config.passphrase === 'YOUR_PASSPHRASE_HERE') {
  console.log('❌ 配置不完整！\n');

  if (config.passphrase === 'YOUR_PASSPHRASE_HERE' || !config.passphrase) {
    console.log('⚠️  缺少 OKX_PASSPHRASE（API密码）\n');
    console.log('🔍 如何找到Passphrase？\n');
    console.log('   Passphrase是你在创建OKX API密钥时自己设置的密码（4-32位字符）\n');
    console.log('   📝 方法1: 回忆你创建API密钥时设置的密码');
    console.log('   📝 方法2: 如果忘记了，需要：');
    console.log('      1. 访问 https://www.okx.com/account/api');
    console.log('      2. 删除当前的API密钥');
    console.log('      3. 重新创建API密钥，并记住新的Passphrase\n');
    console.log('   💡 Passphrase示例: MyPass123, OKX2024, 或任何你设置的密码\n');
  }

  console.log('📝 请在 .env.local 文件中填写缺失的参数\n');
  process.exit(1);
}

// 测试OKX连接
console.log('🔌 步骤2: 测试OKX API连接\n');

async function testOKXConnection() {
  try {
    const crypto = require('crypto');

    // OKX API 签名方法
    function sign(timestamp: string, method: string, requestPath: string, body: string = '') {
      const message = timestamp + method + requestPath + body;
      const hmac = crypto.createHmac('sha256', config.secretKey);
      return hmac.update(message).digest('base64');
    }

    // 准备请求
    const timestamp = new Date().toISOString();
    const method = 'GET';
    const requestPath = '/api/v5/account/balance';
    const signature = sign(timestamp, method, requestPath);

    // 使用模拟盘或实盘的URL
    const baseUrl = config.sandbox
      ? 'https://www.okx.com' // OKX模拟盘和实盘用同一个URL，通过x-simulated-trading区分
      : 'https://www.okx.com';

    console.log(`   连接到: ${baseUrl}`);
    console.log(`   环境: ${config.sandbox ? '模拟盘' : '实盘'}\n`);

    // 发送请求
    const response = await fetch(baseUrl + requestPath, {
      method: method,
      headers: {
        'OK-ACCESS-KEY': config.apiKey!,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': config.passphrase!,
        'x-simulated-trading': config.sandbox ? '1' : '0', // 模拟盘标志
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.code === '0') {
      console.log('✅ API连接成功！\n');
      console.log('📊 账户信息:');

      if (data.data && data.data.length > 0) {
        const details = data.data[0].details || [];
        console.log(`\n   总资产价值: ${data.data[0].totalEq || 'N/A'} USDT\n`);

        if (details.length > 0) {
          console.log('   资产明细:');
          details.slice(0, 5).forEach((asset: any) => {
            if (parseFloat(asset.eq) > 0) {
              console.log(`   - ${asset.ccy}: ${asset.eq} (可用: ${asset.availEq})`);
            }
          });
          if (details.length > 5) {
            console.log(`   ... 还有 ${details.length - 5} 种资产\n`);
          }
        } else {
          console.log('   账户为空或无可用资产\n');
        }
      }

      console.log('✅ OKX配置正确，可以开始交易！\n');
      return true;
    } else {
      console.log('❌ API连接失败\n');
      console.log(`   错误码: ${data.code}`);
      console.log(`   错误信息: ${data.msg}\n`);

      // 常见错误提示
      if (data.code === '50113') {
        console.log('💡 可能的原因: Passphrase不正确');
        console.log('   请检查 .env.local 中的 OKX_PASSPHRASE 是否正确\n');
      } else if (data.code === '50111') {
        console.log('💡 可能的原因: API Key 不正确\n');
      } else if (data.code === '50112') {
        console.log('💡 可能的原因: 时间戳错误或签名错误\n');
      }

      return false;
    }
  } catch (error: any) {
    console.log('❌ 连接失败\n');
    console.log(`   错误: ${error.message}\n`);
    return false;
  }
}

testOKXConnection().then(success => {
  if (success) {
    console.log('🎉 测试完成！OKX API配置成功！');
  } else {
    console.log('❌ 测试失败，请检查配置');
  }
});
