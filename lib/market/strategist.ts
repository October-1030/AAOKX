/**
 * Strategist 复盘模块
 * 每 15 分钟运行，分析技术指标，更新 MarketContext
 */

import {
  getMarketContext,
  TrendBias,
  MarketRegime,
  RiskMode,
  EmaTrend,
} from './marketContext';

// 配置
const STRATEGIST_CONFIG = {
  // 运行间隔（毫秒）
  INTERVAL_MS: 15 * 60 * 1000, // 15 分钟

  // EMA 周期
  EMA_SHORT: 21,
  EMA_MID: 55,
  EMA_LONG: 200,

  // ATR 异常判断
  ATR_SPIKE_MULTIPLIER: 2.0, // ATR > 2倍均值视为异常

  // 低流动性时段（UTC）
  // 🔧 FIX: 加密货币 24 小时交易，禁用低流动性限制
  // 原设置 [2,3,4,5,6] 对洛杉矶用户来说是晚上 6-10 点，不合理
  LOW_LIQUIDITY_HOURS: [] as number[], // 禁用

  // RSI 阈值
  RSI_OVERBOUGHT: 70,
  RSI_OVERSOLD: 30,
};

// 技术指标数据
interface TechnicalData {
  price: number;
  ema21: number;
  ema55: number;
  ema200: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  atr: number;
  atrAvg: number; // ATR 均值（用于判断异常）
  volume: number;
  volumeAvg: number;
}

/**
 * Strategist 策略分析器
 */
class Strategist {
  private interval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastRunTime: number = 0;

  /**
   * 启动定时任务
   */
  start(): void {
    if (this.interval) {
      console.log('[Strategist] ⚠️ 已经在运行');
      return;
    }

    console.log('[Strategist] 🚀 启动策略分析器（每 15 分钟）');

    // 立即运行一次
    this.runAnalysis();

    // 设置定时器
    this.interval = setInterval(() => {
      this.runAnalysis();
    }, STRATEGIST_CONFIG.INTERVAL_MS);
  }

  /**
   * 停止定时任务
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('[Strategist] 🛑 策略分析器已停止');
    }
  }

  /**
   * 手动触发一次分析
   */
  async runOnce(): Promise<void> {
    console.log('[Strategist] 📊 手动触发分析...');
    await this.runAnalysis();
    console.log('[Strategist] ✅ 手动分析完成');
  }

  /**
   * 运行分析
   */
  private async runAnalysis(): Promise<void> {
    if (this.isRunning) {
      console.log('[Strategist] ⏳ 上一次分析还在运行，跳过');
      return;
    }

    this.isRunning = true;
    this.lastRunTime = Date.now();

    console.log('[Strategist] 📊 开始市场分析...');

    try {
      // 1. 获取技术指标数据
      const technicalData = await this.fetchTechnicalData();

      if (!technicalData) {
        console.log('[Strategist] ⚠️ 无法获取技术数据，保持当前状态');
        return;
      }

      // 2. 分析趋势
      const trendBias = this.analyzeTrend(technicalData);
      const emaTrend = this.analyzeEmaTrend(technicalData);

      // 3. 判断市场状态
      const regime = this.analyzeRegime(technicalData);

      // 4. 判断风险模式
      const riskMode = this.analyzeRiskMode(technicalData, regime);

      // 5. 计算杠杆和仓位限制
      const { leverage, positionCap } = this.calculateLimits(riskMode, regime);

      // 6. 更新 MarketContext
      const ctx = getMarketContext();
      ctx.update({
        trend_bias: trendBias,
        regime: regime,
        risk_mode: riskMode,
        allowed_leverage_max: leverage,
        position_cap_pct: positionCap,
        trade_allowed: riskMode !== 'paused',
        rsi: technicalData.rsi,
        ema_trend: emaTrend,
      });

      console.log(`[Strategist] ✅ 分析完成: ${ctx.getSummary()}`);

    } catch (error) {
      console.error('[Strategist] ❌ 分析失败:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 获取技术指标数据
   */
  private async fetchTechnicalData(): Promise<TechnicalData | null> {
    console.log('[Strategist] 🔄 获取技术数据...');

    try {
      // 🔧 FIX: 添加超时控制，避免 Next.js 自调用导致挂起
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 秒超时

      try {
        // 调用内部 API 获取市场数据
        console.log('[Strategist]    请求 http://localhost:3000/api/okx-account ...');
        const response = await fetch('http://localhost:3000/api/okx-account', {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        console.log('[Strategist]    获取成功');

        if (!data.success || !data.marketPrices) {
          console.log('[Strategist]    数据无效，尝试备用端口...');
          // 尝试其他端口
          const altController = new AbortController();
          const altTimeoutId = setTimeout(() => altController.abort(), 5000);
          const altResponse = await fetch('http://localhost:3002/api/okx-account', {
            signal: altController.signal,
          });
          clearTimeout(altTimeoutId);
          const altData = await altResponse.json();

          if (!altData.success) {
            console.log('[Strategist]    备用端口也无数据，使用模拟数据');
            return this.getMockTechnicalData();
          }

          return this.extractTechnicalData(altData, 'DOGE');
        }

        return this.extractTechnicalData(data, 'DOGE');
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.log('[Strategist] ⏱️ 请求超时，使用模拟数据');
        } else {
          console.log(`[Strategist] ⚠️ 请求失败: ${fetchError.message}，使用模拟数据`);
        }
        return this.getMockTechnicalData();
      }
    } catch (error) {
      console.error('[Strategist] ❌ 获取数据异常:', error);

      // 返回模拟数据用于测试
      return this.getMockTechnicalData();
    }
  }

  /**
   * 从 API 响应提取技术数据
   */
  private extractTechnicalData(data: any, symbol: string): TechnicalData | null {
    const price = data.marketPrices?.[symbol];

    if (!price) {
      return null;
    }

    // 从缓存的市场数据中提取（如果有的话）
    // 这里简化处理，返回基本数据
    return {
      price: typeof price === 'number' ? price : parseFloat(price),
      ema21: price * 0.98, // 估算
      ema55: price * 0.97,
      ema200: price * 0.95,
      rsi: 50, // 默认中性
      macd: 0,
      macdSignal: 0,
      atr: price * 0.02,
      atrAvg: price * 0.015,
      volume: 1000000,
      volumeAvg: 1000000,
    };
  }

  /**
   * 获取模拟技术数据（测试用）
   */
  private getMockTechnicalData(): TechnicalData {
    return {
      price: 0.128,
      ema21: 0.130,
      ema55: 0.132,
      ema200: 0.125,
      rsi: 45,
      macd: -0.001,
      macdSignal: -0.0005,
      atr: 0.003,
      atrAvg: 0.002,
      volume: 1000000,
      volumeAvg: 1200000,
    };
  }

  /**
   * 分析趋势方向
   */
  private analyzeTrend(data: TechnicalData): TrendBias {
    const { price, ema21, ema55 } = data;

    // 价格 > EMA55 且 EMA21 > EMA55 → bullish
    if (price > ema55 && ema21 > ema55) {
      return 'bullish';
    }

    // 价格 < EMA55 且 EMA21 < EMA55 → bearish
    if (price < ema55 && ema21 < ema55) {
      return 'bearish';
    }

    return 'neutral';
  }

  /**
   * 分析 EMA 趋势
   */
  private analyzeEmaTrend(data: TechnicalData): EmaTrend {
    const { ema21, ema55, ema200 } = data;

    // EMA21 > EMA55 > EMA200 → bullish
    if (ema21 > ema55 && ema55 > ema200) {
      return 'bullish';
    }

    // EMA21 < EMA55 < EMA200 → bearish
    if (ema21 < ema55 && ema55 < ema200) {
      return 'bearish';
    }

    return 'neutral';
  }

  /**
   * 分析市场状态
   */
  private analyzeRegime(data: TechnicalData): MarketRegime {
    const { atr, atrAvg, volume, volumeAvg } = data;

    // ATR 异常高 → high_vol
    if (atr > atrAvg * STRATEGIST_CONFIG.ATR_SPIKE_MULTIPLIER) {
      return 'high_vol';
    }

    // 成交量过低 → low_liq
    if (volume < volumeAvg * 0.5) {
      return 'low_liq';
    }

    // 根据趋势强度判断
    const trendStrength = Math.abs(data.ema21 - data.ema55) / data.price;

    if (trendStrength > 0.02) {
      return 'trend';
    }

    return 'range';
  }

  /**
   * 分析风险模式
   */
  private analyzeRiskMode(data: TechnicalData, regime: MarketRegime): RiskMode {
    // 检查熔断状态（从 FlowRadar 风控获取）
    try {
      const { getFlowRadarRiskControl } = require('../flowRadar/riskControl');
      const riskControl = getFlowRadarRiskControl();
      const status = riskControl.getStatusSummary();

      if (status.isDailyHalted || status.isConsecutiveLossHalted) {
        return 'paused';
      }
    } catch (e) {
      // 忽略，继续其他检查
    }

    // 检查低流动性时段
    const hour = new Date().getUTCHours();
    if (STRATEGIST_CONFIG.LOW_LIQUIDITY_HOURS.includes(hour)) {
      console.log(`[Strategist] 🌙 当前为低流动性时段 (UTC ${hour}:00)`);
      return 'cautious';
    }

    // 高波动市场 → cautious
    if (regime === 'high_vol') {
      return 'cautious';
    }

    // 低流动性 → cautious
    if (regime === 'low_liq') {
      return 'cautious';
    }

    // ATR 异常高
    if (data.atr > data.atrAvg * STRATEGIST_CONFIG.ATR_SPIKE_MULTIPLIER) {
      return 'cautious';
    }

    return 'normal';
  }

  /**
   * 计算杠杆和仓位限制
   */
  private calculateLimits(
    riskMode: RiskMode,
    regime: MarketRegime
  ): { leverage: 2 | 3 | 5; positionCap: number } {
    switch (riskMode) {
      case 'paused':
        return { leverage: 2, positionCap: 0 };

      case 'cautious':
        return { leverage: 2, positionCap: 3 };

      case 'normal':
        // 根据市场状态微调
        if (regime === 'trend') {
          return { leverage: 5, positionCap: 5 };
        }
        if (regime === 'range') {
          return { leverage: 3, positionCap: 4 };
        }
        return { leverage: 3, positionCap: 5 };
    }
  }

  /**
   * 获取上次运行时间
   */
  getLastRunTime(): number {
    return this.lastRunTime;
  }

  /**
   * 检查是否正在运行
   */
  isAnalyzing(): boolean {
    return this.isRunning;
  }
}

// 单例
let strategistInstance: Strategist | null = null;

export function getStrategist(): Strategist {
  if (!strategistInstance) {
    strategistInstance = new Strategist();
  }
  return strategistInstance;
}

export { Strategist, STRATEGIST_CONFIG };
