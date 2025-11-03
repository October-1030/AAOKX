/**
 * DeepSeek AI 客户端
 *
 * DeepSeek 是一家中国的 AI 公司，提供高性价比的 AI 模型
 * 成本比 GPT-4 便宜 30 倍，性能接近！
 *
 * API 文档: https://platform.deepseek.com/api-docs/
 */

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  id: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  created: number;
  model: string;
}

/**
 * 调用 DeepSeek API
 *
 * @param systemPrompt - 系统提示词（定义 AI 的角色和规则）
 * @param userPrompt - 用户提示词（提供市场数据和当前状态）
 * @param modelName - 模型名称（用于区分不同的交易策略）
 * @returns AI 的完整响应
 *
 * @example
 * const response = await callDeepSeek(
 *   generateNOF1SystemPrompt(strategy),
 *   generateNOF1UserPrompt(accountStatus, marketData),
 *   "DeepSeek V3.1"
 * );
 */
export async function callDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  modelName: string = 'DeepSeek'
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error(
      '❌ DEEPSEEK_API_KEY 未设置！\n' +
      '请在 .env.local 文件中添加：\n' +
      'DEEPSEEK_API_KEY=sk-or-v1-your-openrouter-key\n\n' +
      '获取 API Key: https://openrouter.ai/keys'
    );
  }

  // 检测是否使用 OpenRouter（API Key 以 sk-or- 开头）
  const isOpenRouter = apiKey.startsWith('sk-or-');
  const baseUrl = isOpenRouter
    ? 'https://openrouter.ai/api/v1'
    : 'https://api.deepseek.com';

  const messages: DeepSeekMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: userPrompt,
    },
  ];

  try {
    const provider = isOpenRouter ? 'OpenRouter' : 'DeepSeek';
    console.log(`[${modelName}] 📤 调用 ${provider} API...`);
    console.log(`[${modelName}] 📊 提示词长度: ${systemPrompt.length + userPrompt.length} 字符`);

    // OpenRouter 使用的模型名称
    const modelId = isOpenRouter
      ? 'deepseek/deepseek-chat' // OpenRouter 的 DeepSeek 模型
      : 'deepseek-chat'; // 直接 DeepSeek API

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    // OpenRouter 特有的请求头
    if (isOpenRouter) {
      headers['HTTP-Referer'] = 'https://alpha-arena.com'; // 可选：用于 OpenRouter 统计
      headers['X-Title'] = 'Alpha Arena Trading Bot'; // 可选：显示在 OpenRouter 面板
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${modelName}] ❌ API 错误:`, errorText);

      // 解析常见错误
      if (response.status === 401) {
        throw new Error(
          '❌ API Key 无效！\n' +
          '请检查 .env.local 中的 DEEPSEEK_API_KEY 是否正确。\n' +
          '获取新的 API Key: https://platform.deepseek.com/api_keys'
        );
      } else if (response.status === 429) {
        throw new Error(
          '❌ API 调用频率超限！\n' +
          '请稍后再试，或升级你的 DeepSeek 账户。'
        );
      } else if (response.status === 402) {
        throw new Error(
          '❌ DeepSeek 账户余额不足！\n' +
          '请前往 https://platform.deepseek.com 充值。'
        );
      }

      throw new Error(`DeepSeek API 错误 (${response.status}): ${errorText}`);
    }

    const data: DeepSeekResponse = await response.json();
    const aiResponse = data.choices[0].message.content;

    // 记录使用情况
    const usage = data.usage;
    const cost = calculateCost(usage.total_tokens);

    console.log(`[${modelName}] ✅ API 调用成功`);
    console.log(`[${modelName}] 📊 使用情况:`);
    console.log(`   - 输入 Tokens: ${usage.prompt_tokens.toLocaleString()}`);
    console.log(`   - 输出 Tokens: ${usage.completion_tokens.toLocaleString()}`);
    console.log(`   - 总计 Tokens: ${usage.total_tokens.toLocaleString()}`);
    console.log(`   - 本次成本: $${cost.toFixed(6)} 💰`);
    console.log(`[${modelName}] 📝 响应长度: ${aiResponse.length} 字符\n`);

    return aiResponse;
  } catch (error) {
    console.error(`[${modelName}] ❌ 调用 DeepSeek 失败:`, error);
    throw error;
  }
}

/**
 * 计算 DeepSeek API 调用成本
 *
 * DeepSeek 定价（2025年1月）:
 * - 输入: $0.00014 / 1K tokens
 * - 输出: $0.00028 / 1K tokens
 * - 缓存输入: $0.000014 / 1K tokens (10倍便宜)
 *
 * 对比 GPT-4 Turbo:
 * - 输入: $0.01 / 1K tokens (70倍更贵)
 * - 输出: $0.03 / 1K tokens (107倍更贵)
 *
 * @param totalTokens - 总 token 数
 * @returns 估算成本（美元）
 */
function calculateCost(totalTokens: number): number {
  // 简化计算：假设输入输出各占一半
  // 实际成本 = (输入 tokens * $0.00014 + 输出 tokens * $0.00028) / 1000
  // 简化 = 总 tokens * $0.00021 / 1000
  return (totalTokens * 0.00021) / 1000;
}

/**
 * 批量调用 DeepSeek（用于多个模型同时交易）
 *
 * @param requests - 请求列表
 * @returns 响应列表
 */
export async function batchCallDeepSeek(
  requests: {
    systemPrompt: string;
    userPrompt: string;
    modelName: string;
  }[]
): Promise<{ modelName: string; response: string; error?: string }[]> {
  console.log(`🚀 批量调用 DeepSeek API (${requests.length} 个模型)...\n`);

  // 并行调用所有请求
  const results = await Promise.allSettled(
    requests.map(async (req) => {
      try {
        const response = await callDeepSeek(
          req.systemPrompt,
          req.userPrompt,
          req.modelName
        );
        return {
          modelName: req.modelName,
          response,
        };
      } catch (error) {
        return {
          modelName: req.modelName,
          response: '',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  // 处理结果
  const processed = results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        modelName: 'Unknown',
        response: '',
        error: result.reason,
      };
    }
  });

  // 统计
  const successful = processed.filter((r) => !r.error).length;
  const failed = processed.filter((r) => r.error).length;

  console.log('\n📊 批量调用完成:');
  console.log(`   ✅ 成功: ${successful} 个`);
  console.log(`   ❌ 失败: ${failed} 个\n`);

  return processed;
}

/**
 * 测试 DeepSeek API 连接
 *
 * @returns 连接是否正常
 */
export async function testDeepSeekConnection(): Promise<boolean> {
  try {
    console.log('🔍 测试 DeepSeek API 连接...\n');

    const response = await callDeepSeek(
      'You are a helpful assistant.',
      'Say "Hello! DeepSeek API is working!" in one sentence.',
      'Test'
    );

    if (response.toLowerCase().includes('working')) {
      console.log('✅ DeepSeek API 连接成功！\n');
      return true;
    } else {
      console.log('⚠️  DeepSeek API 响应异常:', response);
      return false;
    }
  } catch (error) {
    console.error('❌ DeepSeek API 连接失败:', error);
    return false;
  }
}
