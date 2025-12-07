import { NextResponse } from 'next/server';
import { getOKXClient } from '@/lib/okxClient';

export async function POST() {
  try {
    const okx = getOKXClient();

    if (!okx.isAvailable()) {
      return NextResponse.json({
        success: false,
        error: 'OKX客户端未初始化',
      }, { status: 500 });
    }

    console.log('[OKX Transfer API] 开始批量划转资金到交易账户...');

    // 批量划转所有资金到交易账户
    const results = await okx.transferAllToTrading();

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `划转完成：成功 ${successCount} 个，失败 ${failCount} 个`,
      results,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('[OKX Transfer API] 划转失败:', error);

    return NextResponse.json({
      success: false,
      error: '资金划转失败',
      details: (error as Error).message,
      timestamp: Date.now()
    }, { status: 500 });
  }
}
