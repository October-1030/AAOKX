import { NextResponse } from 'next/server';
import { getAllMarketData } from '@/lib/marketData';
import { CryptoPricesResponse } from '@/types/trading';

/**
 * GET /api/crypto-prices
 * 返回所有加密货币的当前价格（nof1.ai 格式）
 */
export async function GET() {
  try {
    const marketData = getAllMarketData();
    const serverTime = Date.now();

    const response: CryptoPricesResponse = {
      prices: {},
      serverTime,
    };

    // 将市场数据转换为 nof1.ai 格式
    marketData.forEach((data) => {
      response.prices[data.coin] = {
        symbol: data.coin,
        price: data.current.price || 0,  // ✅ 确保返回价格
        timestamp: serverTime,
      };
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ /api/crypto-prices error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
