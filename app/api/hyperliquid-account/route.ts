import { NextResponse } from 'next/server';
import { getHyperliquidClient } from '@/lib/hyperliquidClient';

/**
 * 获取 Hyperliquid 真实账户状态
 */
export async function GET() {
  try {
    const client = getHyperliquidClient();

    if (!client.isAvailable()) {
      return NextResponse.json({
        error: 'Hyperliquid client not available',
      }, { status: 503 });
    }

    // 获取账户信息
    const accountInfo = await client.getAccountInfo();

    // 获取持仓
    const positions = await client.getPositions();

    return NextResponse.json({
      success: true,
      account: {
        address: accountInfo.address,
        accountValue: accountInfo.accountValue,
        withdrawable: accountInfo.withdrawable,
        marginUsed: accountInfo.marginUsed,
      },
      positions: positions,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[HyperliquidAccount] Error:', error);
    return NextResponse.json({
      error: 'Failed to fetch account info',
      details: (error as Error).message,
    }, { status: 500 });
  }
}
