/**
 * 检查 Hyperliquid 测试网账户余额
 */

const { Hyperliquid } = require('hyperliquid');
require('dotenv').config({ path: '.env.local' });

async function checkBalance() {
  console.log('🔍 正在检查 Hyperliquid 测试网账户余额...\n');

  // 读取配置
  const mainWallet = process.env.HYPERLIQUID_MAIN_WALLET;
  const apiSecret = process.env.HYPERLIQUID_API_SECRET;
  const isTestnet = process.env.HYPERLIQUID_TESTNET === 'true';

  console.log('📊 配置信息:');
  console.log(`   主钱包地址: ${mainWallet}`);
  console.log(`   网络模式: ${isTestnet ? '测试网 (Testnet)' : '主网 (Mainnet)'}`);
  console.log('');

  if (!mainWallet || !apiSecret) {
    console.error('❌ 错误: 未找到 Hyperliquid 配置');
    console.log('请确认 .env.local 文件中包含:');
    console.log('  - HYPERLIQUID_MAIN_WALLET');
    console.log('  - HYPERLIQUID_API_SECRET');
    return;
  }

  try {
    // 初始化客户端
    const client = new Hyperliquid({
      privateKey: apiSecret,
      testnet: isTestnet,
      walletAddress: mainWallet,
    });

    console.log('✅ 客户端初始化成功\n');

    // 获取账户信息
    console.log('📡 正在查询账户状态...');
    const accountState = await client.info.perpetuals.getClearinghouseState(mainWallet);

    // 解析余额信息
    const marginUsed = parseFloat(accountState.marginUsed || 0);
    const withdrawable = parseFloat(accountState.withdrawable || 0);
    const accountValue = parseFloat(accountState.marginSummary?.accountValue || accountState.accountValue || 0);

    console.log('\n💰 账户余额信息:');
    console.log('='.repeat(50));
    console.log(`   账户总价值: $${accountValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`   可用余额:   $${withdrawable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`   已用保证金: $${marginUsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log('='.repeat(50));

    // 检查持仓
    const positions = accountState.assetPositions || [];
    if (positions.length > 0) {
      console.log('\n📊 当前持仓:');
      positions.forEach((pos, index) => {
        const coin = pos.position.coin;
        const size = parseFloat(pos.position.szi);
        const side = size > 0 ? 'LONG' : 'SHORT';
        const entryPrice = parseFloat(pos.position.entryPx || 0);
        const unrealizedPnl = parseFloat(pos.position.unrealizedPnl || 0);
        const leverage = parseFloat(pos.position.leverage?.value || 1);

        console.log(`   ${index + 1}. ${coin} ${side} ${Math.abs(size).toFixed(4)}`);
        console.log(`      入场价格: $${entryPrice.toLocaleString()}`);
        console.log(`      未实现盈亏: $${unrealizedPnl.toFixed(2)} ${unrealizedPnl >= 0 ? '✅' : '❌'}`);
        console.log(`      杠杆: ${leverage}x`);
      });
    } else {
      console.log('\n📊 当前持仓: 无持仓');
    }

    console.log('\n✅ 查询完成！\n');

    // 判断是否有资金
    if (accountValue === 0) {
      console.log('⚠️  检测到账户余额为 $0');
      console.log('');
      console.log('💡 如何获取测试网资金:');
      console.log('   1. 加入 Hyperliquid Discord: https://discord.gg/hyperliquid');
      console.log('   2. 进入 #testnet-faucet 频道');
      console.log(`   3. 发送命令: /faucet ${mainWallet}`);
      console.log('   4. 等待 1-2 分钟');
      console.log('   5. 重新运行此脚本查看余额');
    }

  } catch (error) {
    console.error('\n❌ 查询失败:', error.message);
    console.log('\n可能的原因:');
    console.log('   - API 密钥配置错误');
    console.log('   - 网络连接问题');
    console.log('   - Hyperliquid API 暂时不可用');
  }
}

// 运行查询
checkBalance().catch(console.error);
