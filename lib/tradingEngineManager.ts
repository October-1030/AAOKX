/**
 * 交易引擎全局实例管理器
 * 用于在不同API端点之间共享交易引擎状态
 */

import { TradingEngineState } from './tradingEngine';
import { AI_MODELS } from './aiModels';

// 全局交易引擎实例
let tradingEngine: TradingEngineState | null = null;

/**
 * 获取交易引擎实例（如果不存在则创建）
 */
export function getTradingEngine(): TradingEngineState {
  if (!tradingEngine) {
    tradingEngine = new TradingEngineState(AI_MODELS);
  }
  return tradingEngine;
}

/**
 * 重置交易引擎实例
 */
export function resetTradingEngine(): void {
  tradingEngine = null;
}
