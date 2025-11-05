import { NextResponse } from 'next/server';
import { SinceInceptionValuesResponse } from '@/types/trading';
import { getTradingEngine } from '../trading/route';

/**
 * GET /api/since-inception-values
 * 返回所有模型的历史权益数据（用于绘制权益曲线）
 */
export async function GET() {
  try {
    // 获取引擎实例
    const tradingEngine = getTradingEngine();

    // 如果没有引擎实例，返回空对象
    if (!tradingEngine) {
      return NextResponse.json({
        values: {},
      } as SinceInceptionValuesResponse);
    }

    const snapshots = tradingEngine.getAllAccountSnapshots();

    // 构建 values 对象
    const values: { [model_id: string]: { timestamp: number; equity: number }[] } = {};

    snapshots.forEach((snapshot) => {
      const modelId = snapshot.model_id;

      // 使用权益历史数据
      values[modelId] = snapshot.equityHistory.map((point) => ({
        timestamp: point.timestamp,
        equity: point.equity,
      }));
    });

    const response: SinceInceptionValuesResponse = {
      values,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ /api/since-inception-values error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
