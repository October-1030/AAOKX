// 统一的AI模型元数据管理（参考nof0架构）

export interface ModelMetadata {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  strategy: string;
  color: string;        // 品牌色
  logoUrl?: string;     // Logo URL
  description: string;
  website?: string;
  apiDocs?: string;
}

/**
 * AI模型元数据配置
 *
 * NOTE: 系统已重构为 DeepSeek 单模型架构
 * 原来的多模型对战逻辑（Claude/GPT-5/Gemini/Qwen/Grok）已移除
 *
 * 唯一有效模型：DeepSeek V3.1
 */
export const MODEL_METADATA: Record<string, ModelMetadata> = {
  'deepseek-v3': {
    id: 'deepseek-v3',
    name: 'deepseek-v3',
    displayName: 'DeepSeek V3.1',
    provider: 'DeepSeek',
    strategy: 'Conservative momentum with detailed stop-loss strategies',
    color: '#3b82f6', // 蓝色
    description: 'DeepSeek excels at market timing with detailed risk management',
    website: 'https://www.deepseek.com',
    apiDocs: 'https://platform.deepseek.com/api-docs',
  },

  // NOTE: 以下模型配置已移除，系统现在只使用 DeepSeek 单模型
  // 原多模型对战包括：Claude 4.5, GPT-5, Gemini 2.5, Qwen 3, Grok 4
};

/**
 * 获取模型元数据
 */
export function getModelMeta(modelId: string): ModelMetadata | null {
  return MODEL_METADATA[modelId] || null;
}

/**
 * 获取所有模型
 */
export function getAllModels(): ModelMetadata[] {
  return Object.values(MODEL_METADATA);
}

/**
 * 获取模型颜色
 */
export function getModelColor(modelId: string): string {
  return MODEL_METADATA[modelId]?.color || '#9ca3af';
}

/**
 * 获取模型显示名称
 */
export function getModelDisplayName(modelId: string): string {
  return MODEL_METADATA[modelId]?.displayName || modelId;
}
