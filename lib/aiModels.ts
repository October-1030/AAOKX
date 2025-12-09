/**
 * AI模型集成器
 *
 * NOTE: 系统已重构为 DeepSeek 单模型架构
 * 原来的多模型对战逻辑（Claude/GPT-5/Gemini/Qwen/Grok）已完全移除
 *
 * 唯一决策链：行情 → 指标 → DeepSeek → 风控 → RealTradingExecutor
 */

import { callDeepSeek } from './deepseekClient';

export interface AIModel {
  name: string;
  displayName: string;
  provider: string;
  strategy: string;
  callAPI: (systemPrompt: string, userPrompt: string) => Promise<string>;
}

// NOTE: 以下模拟响应函数已移除，原来用于多模型对战演示
// - simulateAIResponse()
// - generateDeepSeekResponse()
// - generateClaudeResponse()
// - generateGPTResponse()
// - generateGeminiResponse()
// - generateQwenResponse()
// - generateGrokResponse()

/**
 * 唯一的 AI 模型配置：DeepSeek V3.1
 *
 * NOTE: 系统现在只使用 DeepSeek 单模型进行交易决策
 * 所有决策都经过：行情 → 指标 → DeepSeek → 风控 → 下单
 */
export const AI_MODELS: AIModel[] = [
  {
    name: 'deepseek-v3',
    displayName: 'DeepSeek V3.1',
    provider: 'DeepSeek',
    strategy: 'Conservative value investing with multi-period technical analysis',
    callAPI: callDeepSeek,  // 使用真实的 DeepSeek API
  },
];

/**
 * 获取唯一的 AI 模型（DeepSeek）
 * 便捷函数，用于简化代码
 */
export function getActiveModel(): AIModel {
  return AI_MODELS[0];
}

/**
 * 获取活跃模型名称
 */
export const ACTIVE_MODEL = 'deepseek-v3';
