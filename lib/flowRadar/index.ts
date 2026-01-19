/**
 * Flow-Radar 信号集成模块
 * 入口文件
 */

// 导出类型
export * from './types';

// 导出路径检测
export {
  detectFlowRadarPath,
  getFlowRadarPath,
  clearPathCache,
  getTodayEventFile,
  getLatestEventFiles,
} from './pathDetector';

// 导出信号适配器
export {
  FlowRadarSignalAdapter,
  getFlowRadarAdapter,
} from './signalAdapter';

// 导出心跳监控
export {
  FlowRadarHeartbeat,
  getFlowRadarHeartbeat,
} from './heartbeat';

// 导出风控规则
export {
  FlowRadarRiskControl,
  getFlowRadarRiskControl,
} from './riskControl';

// 便捷方法：获取信号摘要
import { getFlowRadarAdapter } from './signalAdapter';
import { getFlowRadarHeartbeat } from './heartbeat';
import type { FlowRadarSummary, FlowRadarStatus } from './types';

/**
 * 获取 Flow-Radar 信号摘要
 * @returns 信号摘要，如果不可用返回 null
 */
export async function getFlowRadarSignals(): Promise<FlowRadarSummary | null> {
  const adapter = getFlowRadarAdapter();
  if (!adapter.isAvailable()) {
    return null;
  }
  return adapter.getSignals();
}

/**
 * 获取 Flow-Radar 系统状态
 */
export function getFlowRadarStatus(): {
  available: boolean;
  status: FlowRadarStatus;
  description: string;
  canOpenPosition: boolean;
  canClosePosition: boolean;
  signalCount: number;
  timeSinceLastSignal: number;
} {
  const adapter = getFlowRadarAdapter();
  const heartbeat = getFlowRadarHeartbeat();
  const state = heartbeat.getState();

  return {
    available: adapter.isAvailable(),
    status: state.status,
    description: heartbeat.getStatusDescription(),
    canOpenPosition: heartbeat.canOpenPosition(),
    canClosePosition: heartbeat.canClosePosition(),
    signalCount: adapter.getSignalCount(),
    timeSinceLastSignal: heartbeat.getTimeSinceLastSignal(),
  };
}

/**
 * 启动 Flow-Radar 监控
 */
export function startFlowRadarMonitor(): boolean {
  const adapter = getFlowRadarAdapter();
  if (!adapter.isAvailable()) {
    console.log('[FlowRadar] ⚠️ 无法启动监控：适配器不可用');
    return false;
  }

  const heartbeat = getFlowRadarHeartbeat();
  heartbeat.start();
  console.log('[FlowRadar] 🚀 监控已启动');
  return true;
}

/**
 * 停止 Flow-Radar 监控
 */
export function stopFlowRadarMonitor(): void {
  const heartbeat = getFlowRadarHeartbeat();
  heartbeat.stop();
  console.log('[FlowRadar] 🛑 监控已停止');
}
