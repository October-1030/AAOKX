// Alpha Arena 配置文件

/**
 * 数据源配置
 */
export const CONFIG = {
  // 是否使用真实市场数据（CoinGecko API）
  // ✅ CoinGecko 完全免费，美国可访问！
  USE_REAL_MARKET_DATA: true, // ✅ 使用 CoinGecko 实时价格

  // 是否使用真实AI API
  USE_REAL_AI: true, // ✅ 使用真实 DeepSeek API

  // 是否使用真实交易（Hyperliquid）
  // ⚠️ 警告：设置为 true 将执行真实订单！
  USE_REAL_TRADING: false, // 🔒 默认禁用真实交易（安全模式）

  // 交易周期间隔（毫秒）
  TRADING_INTERVAL_MS: 180000, // 3分钟

  // 市场数据更新间隔（毫秒）
  MARKET_DATA_REFRESH_MS: 60000, // 1分钟

  // 前端数据刷新间隔（毫秒）
  FRONTEND_REFRESH_MS: 5000, // 5秒

  // 日志级别
  LOG_LEVEL: 'info' as 'debug' | 'info' | 'warn' | 'error',

  // Binance API配置
  BINANCE: {
    ENABLED: true,
    API_BASE: 'https://api.binance.com/api/v3',
    WS_BASE: 'wss://stream.binance.com:9443/ws',
    TIMEOUT_MS: 5000,
  },

  // AI API配置（需要环境变量）
  AI: {
    OPENAI: {
      ENABLED: !!process.env.OPENAI_API_KEY,
      MODEL: 'gpt-4-turbo-preview',
    },
    ANTHROPIC: {
      ENABLED: !!process.env.ANTHROPIC_API_KEY,
      MODEL: 'claude-3-5-sonnet-20241022',
    },
    DEEPSEEK: {
      ENABLED: !!process.env.DEEPSEEK_API_KEY,
      MODEL: 'deepseek-chat',
    },
  },
};

/**
 * 获取当前配置摘要
 */
export function getConfigSummary(): string {
  return `
Alpha Arena Configuration:
- Market Data: ${CONFIG.USE_REAL_MARKET_DATA ? '🌐 Real (CoinGecko)' : '🎲 Simulated'}
- AI Models: ${CONFIG.USE_REAL_AI ? '🤖 Real (DeepSeek)' : '🎭 Simulated'}
- Trading Mode: ${CONFIG.USE_REAL_TRADING ? '⚠️ LIVE TRADING (Hyperliquid)' : '🧪 Simulated (Safe)'}
- Trading Interval: ${CONFIG.TRADING_INTERVAL_MS / 1000}s
- Data Refresh: ${CONFIG.MARKET_DATA_REFRESH_MS / 1000}s
  `.trim();
}

/**
 * 验证配置
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (CONFIG.USE_REAL_AI) {
    if (!CONFIG.AI.OPENAI.ENABLED && !CONFIG.AI.ANTHROPIC.ENABLED && !CONFIG.AI.DEEPSEEK.ENABLED) {
      errors.push('USE_REAL_AI is enabled but no AI API keys are configured');
    }
  }

  if (CONFIG.TRADING_INTERVAL_MS < 10000) {
    errors.push('TRADING_INTERVAL_MS should be at least 10 seconds');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// 启动时验证配置
if (typeof window === 'undefined') {
  const validation = validateConfig();
  if (!validation.valid) {
    console.warn('⚠️ Configuration warnings:');
    validation.errors.forEach(err => console.warn(`  - ${err}`));
  }

  console.log(getConfigSummary());
}
