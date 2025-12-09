import { NextResponse } from 'next/server';

/**
 * Hyperliquid 账户 API（已废弃）
 * NOTE: 系统已重构为 OKX-only 架构，此 API 不再可用
 * 请使用 /api/okx-account 代替
 */
export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Hyperliquid API is deprecated',
    message: '系统已重构为 OKX-only 架构，Hyperliquid 支持已移除。请使用 /api/okx-account',
    redirect: '/api/okx-account',
    timestamp: Date.now(),
  }, { status: 410 }); // 410 Gone - 资源已被永久移除
}
