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
 * 所有AI模型的统一元数据配置
 * 在此统一管理品牌色、Logo、描述等信息
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

  'claude-4.5': {
    id: 'claude-4.5',
    name: 'claude-4.5',
    displayName: 'Claude 4.5 Sonnet',
    provider: 'Anthropic',
    strategy: 'Conservative value investing approach',
    color: '#8b5cf6', // 紫色
    description: 'Anthropic\'s flagship model with careful, methodical trading',
    website: 'https://www.anthropic.com',
    apiDocs: 'https://docs.anthropic.com',
  },

  'gpt-5': {
    id: 'gpt-5',
    name: 'gpt-5',
    displayName: 'GPT-5',
    provider: 'OpenAI',
    strategy: 'Balanced multi-asset strategy',
    color: '#10b981', // 绿色
    description: 'OpenAI\'s latest model with balanced risk-reward approach',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs',
  },

  'gemini-2.5': {
    id: 'gemini-2.5',
    name: 'gemini-2.5',
    displayName: 'Gemini 2.5 Pro',
    provider: 'Google DeepMind',
    strategy: 'Reactive trading with variable positions',
    color: '#ef4444', // 红色
    description: 'Google\'s experimental high-frequency trading approach',
    website: 'https://deepmind.google',
    apiDocs: 'https://ai.google.dev/docs',
  },

  'qwen-3': {
    id: 'qwen-3',
    name: 'qwen-3',
    displayName: 'Qwen 3 Max',
    provider: 'Alibaba Cloud',
    strategy: 'Medium-amplitude swing trading method',
    color: '#f59e0b', // 橙色
    description: 'Alibaba\'s model optimized for Asian trading hours',
    website: 'https://www.alibabacloud.com',
    apiDocs: 'https://help.aliyun.com/zh/dashscope',
  },

  'grok-4': {
    id: 'grok-4',
    name: 'grok-4',
    displayName: 'Grok 4',
    provider: 'xAI',
    strategy: 'High-frequency scalping attempts',
    color: '#ec4899', // 粉色
    description: 'Elon Musk\'s xAI with aggressive scalping strategy',
    website: 'https://x.ai',
    apiDocs: 'https://docs.x.ai',
  },
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
