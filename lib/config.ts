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

  // 是否使用真实交易（OKX）
  // ⚠️ 警告：设置为 true 将执行真实订单！
  USE_REAL_TRADING: true, // ✅ 启用 OKX 真实交易

  // 交易周期间隔（毫秒）
  TRADING_INTERVAL_MS: 180000, // 3分钟

  // 市场数据更新间隔（毫秒）
  MARKET_DATA_REFRESH_MS: 60000, // 1分钟

  // 前端数据刷新间隔（毫秒）
  FRONTEND_REFRESH_MS: 5000, // 5秒

  // 日志级别
  LOG_LEVEL: 'info' as 'debug' | 'info' | 'warn' | 'error',

  // 🛡️ 安全保护配置（方案A）
  SAFETY: {
    // 总亏损熔断：账户总亏损超过此百分比时，自动停止交易
    MAX_TOTAL_LOSS_PERCENT: 15, // ✅ 降低至 -15% 触发熔断（更保守）

    // 单日亏损限制：单日亏损超过此百分比时，暂停当天交易
    MAX_DAILY_LOSS_PERCENT: 5, // 🔒 三方共识 v1.2：-5% 暂停当天

    // 高风险交易审核：超过以下阈值需要确认（暂时禁用，设为false）
    HIGH_RISK_REVIEW_ENABLED: false,
    HIGH_RISK_LEVERAGE_THRESHOLD: 10, // ✅ 降低至 10x 需要审核
    HIGH_RISK_NOTIONAL_THRESHOLD: 3000, // ✅ 降低至 $3000 需要审核

    // 启动资金（用于计算亏损百分比）
    // ⚠️ 重要：改成你的实际测试网起始金额！
    INITIAL_CAPITAL: 1000, // ✅ 修复：$1,000（实际测试网起始金额）
  },

  // 🛡️ 风险管理配置（借鉴 Nautilus Trader）
  RISK_MANAGEMENT: {
    // 启用风险管理系统
    ENABLED: true,

    // 单币种风险限制
    MAX_COIN_LOSS_PERCENT: 10, // 单币种最大亏损10%
    MAX_COIN_EXPOSURE_PERCENT: 30, // 单币种最大仓位占比30%

    // 相关性限制
    MAX_CORRELATED_EXPOSURE: 50, // 高相关币种总仓位不超过50%

    // Kelly公式配置
    KELLY_ENABLED: true, // 是否启用Kelly公式计算仓位
    KELLY_FRACTION: 0.25, // 使用25% Kelly（保守）

    // 持仓限制
    MAX_TOTAL_POSITIONS: 6, // 最多6个持仓
    MAX_SINGLE_POSITION_PERCENT: 20, // 单笔交易最大占比20%
  },

  // Binance API配置
  BINANCE: {
    ENABLED: true,
    API_BASE: 'https://api.binance.com/api/v3',
    WS_BASE: 'wss://stream.binance.com:9443/ws',
    TIMEOUT_MS: 5000,
  },

  // AI API配置（需要环境变量）
  // NOTE: 系统已重构为 DeepSeek 单模型架构，其他模型配置已移除
  AI: {
    // NOTE: OpenAI 配置已移除，原来是多模型对战系统的一部分
    // NOTE: Anthropic 配置已移除，原来是多模型对战系统的一部分
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
- Trading Mode: ${CONFIG.USE_REAL_TRADING ? '⚠️ LIVE TRADING (OKX)' : '🧪 Simulated (Safe)'}
- Trading Interval: ${CONFIG.TRADING_INTERVAL_MS / 1000}s
- Data Refresh: ${CONFIG.MARKET_DATA_REFRESH_MS / 1000}s
  `.trim();
}

/**
 * 验证配置
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // NOTE: 系统已重构为 DeepSeek 单模型，只检查 DeepSeek API Key
  if (CONFIG.USE_REAL_AI) {
    if (!CONFIG.AI.DEEPSEEK.ENABLED) {
      errors.push('USE_REAL_AI is enabled but DEEPSEEK_API_KEY is not configured');
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
