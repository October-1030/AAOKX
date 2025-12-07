import { NextResponse } from 'next/server';
import { getOKXClient } from '@/lib/okxClient';

export async function GET() {
  try {
    const okx = getOKXClient();

    if (!okx.isAvailable()) {
      return NextResponse.json({
        success: false,
        error: 'OKX客户端未初始化',
        message: '请检查.env.local中的API密钥配置'
      }, { status: 500 });
    }

    // 获取所有账户信息（包括资金账户、交易账户等）
    const accountInfo = await okx.getAccountInfo();
    const fundingBalance = await okx.getFundingBalance();

    // 获取持仓信息
    let positions = [];
    try {
      positions = await okx.getPositions();
    } catch (error) {
      console.error('[OKX Account] 获取持仓失败:', error);
    }

    // 获取市场价格
    const prices = await okx.getAllMarketPrices();

    return NextResponse.json({
      success: true,
      account: accountInfo,
      fundingAccount: fundingBalance,
      positions: positions || [],
      marketPrices: prices,
      config: {
        sandbox: process.env.OKX_SANDBOX !== 'false',
        hasApiKey: !!process.env.OKX_API_KEY,
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('[OKX Account] API错误:', error);

    return NextResponse.json({
      success: false,
      error: 'OKX API请求失败',
      details: (error as Error).message,
      timestamp: Date.now()
    }, { status: 500 });
  }
}
