import { NextResponse } from 'next/server';
import { getOKXClient } from '@/lib/okxClient';

export async function GET() {
  try {
    console.log('[OKX Test] 🧪 开始测试OKX连接...');
    
    const okx = getOKXClient();
    
    if (!okx.isAvailable()) {
      console.log('[OKX Test] ❌ OKX客户端未初始化');
      return NextResponse.json({
        success: false,
        error: 'OKX客户端未初始化',
        message: '请检查API密钥配置'
      });
    }

    // 测试获取市场价格
    console.log('[OKX Test] 📊 测试获取市场价格...');
    const prices = await okx.getAllMarketPrices();
    
    if (!prices) {
      return NextResponse.json({
        success: false,
        error: 'API请求失败',
        message: '无法获取市场数据'
      });
    }

    // 测试获取账户信息（可能需要有效的API密钥）
    console.log('[OKX Test] 👛 测试获取账户信息...');
    let accountInfo = null;
    try {
      accountInfo = await okx.getAccountInfo();
    } catch (error) {
      console.log('[OKX Test] ⚠️ 账户信息获取失败（可能是API密钥问题）:', error);
      accountInfo = { error: '需要有效的API密钥' };
    }

    console.log('[OKX Test] ✅ OKX测试完成');
    
    return NextResponse.json({
      success: true,
      message: 'OKX连接测试成功',
      data: {
        prices,
        accountInfo,
        config: {
          sandbox: process.env.OKX_SANDBOX !== 'false',
          hasApiKey: !!process.env.OKX_API_KEY,
          hasSecretKey: !!process.env.OKX_SECRET_KEY,
          hasPassphrase: !!process.env.OKX_PASSPHRASE,
        }
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('[OKX Test] ❌ 测试失败:', error);
    
    return NextResponse.json({
      success: false,
      error: 'OKX测试失败',
      details: (error as Error).message,
      timestamp: Date.now()
    }, { status: 500 });
  }
}