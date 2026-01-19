/**
 * AI自进化引擎 - 从历史交易中学习
 * 借鉴 NOFX 项目的自我学习系统
 *
 * 核心功能：
 * 1. 分析过去N笔交易，识别成功/失败模式
 * 2. 提取高胜率的技术指标组合
 * 3. 生成学习提示注入到下次决策
 * 4. 持续优化AI的决策质量
 */

import { CompletedTrade, TechnicalIndicators, Coin, TradeSide } from '@/types/trading';

// 交易模式（用于识别成功/失败的条件组合）
export interface TradingPattern {
  // 入场条件
  entryConditions: {
    rsi?: string;        // RSI状态："超卖 (<30)" | "超买 (>70)" | "中性"
    macd?: string;       // MACD状态："金叉" | "死叉" | "中性"
    emaAlignment?: string; // EMA排列："多头排列" | "空头排列"
    marketRegime?: string; // 市场状态："震荡" | "趋势"
    zScore?: string;     // Z-Score："极端超卖 (<-2)" | "极端超买 (>2)"
  };

  // 交易方向
  side: TradeSide;
  coin: Coin;

  // 表现统计
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgPnL: number;
  totalPnL: number;

  // 可读描述
  description: string;
}

// 学习报告
export interface LearningReport {
  analyzedTrades: number;
  totalWinRate: number;
  winningPatterns: TradingPattern[];
  losingPatterns: TradingPattern[];
  insights: string[];
  learningPrompt: string; // 注入到下次决策的prompt
}

/**
 * AI进化引擎
 */
export class AIEvolutionEngine {
  // 最小样本数（低于此数量不生成学习报告）
  private readonly MIN_SAMPLE_SIZE = 5;

  // 胜率阈值
  private readonly HIGH_WIN_RATE_THRESHOLD = 0.65; // 65%以上算高胜率
  private readonly LOW_WIN_RATE_THRESHOLD = 0.35;  // 35%以下算低胜率

  /**
   * 分析交易历史并生成学习报告
   * @param recentTrades 最近的交易记录（建议20-50笔）
   * @param currentIndicators 当前市场的技术指标（可选，用于更相关的建议）
   * @returns 学习报告
   */
  async analyzeAndLearn(
    recentTrades: CompletedTrade[],
    currentIndicators?: Map<Coin, TechnicalIndicators>
  ): Promise<LearningReport> {
    console.log(`[AIEvolution] 🧠 开始分析 ${recentTrades.length} 笔交易...`);

    if (recentTrades.length < this.MIN_SAMPLE_SIZE) {
      console.log(`[AIEvolution] ⚠️ 样本量不足（需要至少${this.MIN_SAMPLE_SIZE}笔），跳过学习`);
      return this.generateEmptyReport();
    }

    // 1. 提取交易模式
    const patterns = this.extractPatterns(recentTrades);

    // 2. 分类为成功/失败模式
    const winningPatterns = patterns.filter(p => p.winRate >= this.HIGH_WIN_RATE_THRESHOLD);
    const losingPatterns = patterns.filter(p => p.winRate <= this.LOW_WIN_RATE_THRESHOLD);

    // 3. 生成洞察
    const insights = this.generateInsights(patterns, recentTrades);

    // 4. 计算总体胜率
    const totalWins = recentTrades.filter(t => t.pnl > 0).length;
    const totalWinRate = recentTrades.length > 0 ? totalWins / recentTrades.length : 0;

    // 5. 生成学习prompt
    const learningPrompt = this.generateLearningPrompt({
      analyzedTrades: recentTrades.length,
      totalWinRate,
      winningPatterns,
      losingPatterns,
      insights,
      learningPrompt: '', // 稍后填充
    }, currentIndicators);

    console.log(`[AIEvolution] ✅ 学习完成: 总胜率 ${(totalWinRate * 100).toFixed(1)}%`);
    console.log(`[AIEvolution] 🏆 发现 ${winningPatterns.length} 个高胜率模式`);
    console.log(`[AIEvolution] ⚠️ 发现 ${losingPatterns.length} 个低胜率模式`);

    return {
      analyzedTrades: recentTrades.length,
      totalWinRate,
      winningPatterns,
      losingPatterns,
      insights,
      learningPrompt,
    };
  }

  /**
   * 从交易中提取模式
   */
  private extractPatterns(trades: CompletedTrade[]): TradingPattern[] {
    // 按 币种+方向+入场条件 分组
    const patternMap = new Map<string, CompletedTrade[]>();

    for (const trade of trades) {
      // 简化的模式key（实际应该包含更多技术指标）
      const key = `${trade.coin}_${trade.side}`;

      if (!patternMap.has(key)) {
        patternMap.set(key, []);
      }
      patternMap.get(key)!.push(trade);
    }

    // 为每组生成统计
    const patterns: TradingPattern[] = [];

    for (const [key, groupTrades] of patternMap.entries()) {
      if (groupTrades.length < 2) continue; // 样本量太小

      const [coin, side] = key.split('_') as [Coin, TradeSide];
      const winCount = groupTrades.filter(t => t.pnl > 0).length;
      const lossCount = groupTrades.length - winCount;
      const winRate = winCount / groupTrades.length;
      const totalPnL = groupTrades.reduce((sum, t) => sum + t.pnl, 0);
      const avgPnL = totalPnL / groupTrades.length;

      // 简化的入场条件分析（实际应该更详细）
      const entryConditions = this.analyzeEntryConditions(groupTrades);

      patterns.push({
        entryConditions,
        side,
        coin,
        totalTrades: groupTrades.length,
        winCount,
        lossCount,
        winRate,
        avgPnL,
        totalPnL,
        description: this.generatePatternDescription(coin, side, entryConditions, winRate),
      });
    }

    // 按胜率排序
    return patterns.sort((a, b) => b.winRate - a.winRate);
  }

  /**
   * 分析入场条件
   * 从交易记录中提取入场时的技术指标状态
   */
  private analyzeEntryConditions(trades: CompletedTrade[]): TradingPattern['entryConditions'] {
    // 统计各指标状态的出现频率
    const rsiStates: Record<string, number> = {};
    const macdStates: Record<string, number> = {};
    const emaStates: Record<string, number> = {};
    const regimeStates: Record<string, number> = {};
    const zScoreStates: Record<string, number> = {};

    for (const trade of trades) {
      const indicators = trade.entryIndicators;
      if (!indicators) continue;

      // RSI 状态分类
      const rsiState = indicators.rsi < 30 ? '超卖 (<30)' : indicators.rsi > 70 ? '超买 (>70)' : '中性';
      rsiStates[rsiState] = (rsiStates[rsiState] || 0) + 1;

      // MACD 状态分类
      const macdState = indicators.macd_histogram > 0.5 ? '金叉' : indicators.macd_histogram < -0.5 ? '死叉' : '中性';
      macdStates[macdState] = (macdStates[macdState] || 0) + 1;

      // EMA 排列分类
      const emaAligned = indicators.ema_20 > indicators.ema_50 && indicators.ema_50 > indicators.ema_200;
      const emaBearish = indicators.ema_20 < indicators.ema_50 && indicators.ema_50 < indicators.ema_200;
      const emaState = emaAligned ? '多头排列' : emaBearish ? '空头排列' : '混合';
      emaStates[emaState] = (emaStates[emaState] || 0) + 1;

      // 市场状态
      if (indicators.marketRegime) {
        const regime = indicators.marketRegime === 'TRENDING' ? '趋势' : '震荡';
        regimeStates[regime] = (regimeStates[regime] || 0) + 1;
      }

      // Z-Score 状态
      if (indicators.zScore !== undefined) {
        const zState = indicators.zScore < -2 ? '极端超卖 (<-2)' :
                       indicators.zScore > 2 ? '极端超买 (>2)' : '中性';
        zScoreStates[zState] = (zScoreStates[zState] || 0) + 1;
      }
    }

    // 找出最常见的状态
    const getMostCommon = (states: Record<string, number>): string | undefined => {
      const entries = Object.entries(states);
      if (entries.length === 0) return undefined;
      return entries.sort((a, b) => b[1] - a[1])[0][0];
    };

    return {
      rsi: getMostCommon(rsiStates),
      macd: getMostCommon(macdStates),
      emaAlignment: getMostCommon(emaStates),
      marketRegime: getMostCommon(regimeStates),
      zScore: getMostCommon(zScoreStates),
    };
  }

  /**
   * 生成模式描述
   */
  private generatePatternDescription(
    coin: Coin,
    side: TradeSide,
    conditions: TradingPattern['entryConditions'],
    winRate: number
  ): string {
    const direction = side === 'LONG' ? '做多' : '做空';
    const performance = winRate >= 0.65 ? '高胜率' : winRate <= 0.35 ? '低胜率' : '中等胜率';

    let desc = `${coin} ${direction} - ${performance} (${(winRate * 100).toFixed(0)}%)`;

    // 添加条件描述
    const condDesc: string[] = [];
    if (conditions.rsi) condDesc.push(`RSI: ${conditions.rsi}`);
    if (conditions.macd) condDesc.push(`MACD: ${conditions.macd}`);
    if (conditions.marketRegime) condDesc.push(`市场: ${conditions.marketRegime}`);

    if (condDesc.length > 0) {
      desc += ` | 条件: ${condDesc.join(', ')}`;
    }

    return desc;
  }

  /**
   * 生成洞察
   */
  private generateInsights(patterns: TradingPattern[], allTrades: CompletedTrade[]): string[] {
    const insights: string[] = [];

    // 1. 总体表现
    const totalWins = allTrades.filter(t => t.pnl > 0).length;
    const totalLosses = allTrades.length - totalWins;
    const winRate = allTrades.length > 0 ? totalWins / allTrades.length : 0;

    insights.push(`过去${allTrades.length}笔交易: ${totalWins}胜 ${totalLosses}败，胜率 ${(winRate * 100).toFixed(1)}%`);

    // 2. 最佳币种
    const coinStats = new Map<Coin, { wins: number; total: number }>();
    for (const trade of allTrades) {
      if (!coinStats.has(trade.coin)) {
        coinStats.set(trade.coin, { wins: 0, total: 0 });
      }
      const stats = coinStats.get(trade.coin)!;
      stats.total++;
      if (trade.pnl > 0) stats.wins++;
    }

    const bestCoins = Array.from(coinStats.entries())
      .filter(([_, stats]) => stats.total >= 3) // 至少3笔交易
      .map(([coin, stats]) => ({ coin, winRate: stats.wins / stats.total }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 3);

    if (bestCoins.length > 0) {
      const bestCoin = bestCoins[0];
      insights.push(`最佳币种: ${bestCoin.coin} (胜率 ${(bestCoin.winRate * 100).toFixed(0)}%)`);
    }

    // 3. 方向偏好
    const longTrades = allTrades.filter(t => t.side === 'LONG');
    const shortTrades = allTrades.filter(t => t.side === 'SHORT');
    const longWinRate = longTrades.length > 0 ? longTrades.filter(t => t.pnl > 0).length / longTrades.length : 0;
    const shortWinRate = shortTrades.length > 0 ? shortTrades.filter(t => t.pnl > 0).length / shortTrades.length : 0;

    if (longTrades.length >= 3 && shortTrades.length >= 3) {
      if (longWinRate > shortWinRate + 0.15) {
        insights.push(`做多表现更好 (${(longWinRate * 100).toFixed(0)}% vs ${(shortWinRate * 100).toFixed(0)}%)`);
      } else if (shortWinRate > longWinRate + 0.15) {
        insights.push(`做空表现更好 (${(shortWinRate * 100).toFixed(0)}% vs ${(longWinRate * 100).toFixed(0)}%)`);
      }
    }

    // 4. 杠杆分析
    const avgLeverage = allTrades.reduce((sum, t) => sum + t.leverage, 0) / allTrades.length;
    const highLevTrades = allTrades.filter(t => t.leverage >= 10);
    const highLevWinRate = highLevTrades.length > 0 ? highLevTrades.filter(t => t.pnl > 0).length / highLevTrades.length : 0;

    if (highLevTrades.length >= 3 && highLevWinRate < 0.4) {
      insights.push(`⚠️ 高杠杆(≥10x)胜率较低 (${(highLevWinRate * 100).toFixed(0)}%)，建议降低杠杆`);
    }

    return insights;
  }

  /**
   * 生成学习prompt（核心功能）
   */
  private generateLearningPrompt(
    report: LearningReport,
    currentIndicators?: Map<Coin, TechnicalIndicators>
  ): string {
    let prompt = `\n\n=== 📚 HISTORICAL LEARNING & PERFORMANCE ANALYSIS ===

You have completed ${report.analyzedTrades} trades with an overall win rate of ${(report.totalWinRate * 100).toFixed(1)}%. Below is your performance analysis to help improve future decisions.

`;

    // 高胜率模式
    if (report.winningPatterns.length > 0) {
      prompt += `✅ HIGH WIN RATE PATTERNS (Repeat These):\n`;
      report.winningPatterns.forEach((pattern, i) => {
        prompt += `${i + 1}. ${pattern.description}\n`;
        prompt += `   → Stats: ${pattern.winCount}W-${pattern.lossCount}L, Win Rate: ${(pattern.winRate * 100).toFixed(0)}%, Avg PnL: $${pattern.avgPnL.toFixed(2)}\n`;
      });
      prompt += `\n`;
    }

    // 低胜率模式
    if (report.losingPatterns.length > 0) {
      prompt += `❌ LOW WIN RATE PATTERNS (Avoid These):\n`;
      report.losingPatterns.forEach((pattern, i) => {
        prompt += `${i + 1}. ${pattern.description}\n`;
        prompt += `   → Stats: ${pattern.winCount}W-${pattern.lossCount}L, Win Rate: ${(pattern.winRate * 100).toFixed(0)}%, Avg PnL: $${pattern.avgPnL.toFixed(2)}\n`;
      });
      prompt += `\n`;
    }

    // 关键洞察
    if (report.insights.length > 0) {
      prompt += `💡 KEY INSIGHTS:\n`;
      report.insights.forEach((insight, i) => {
        prompt += `${i + 1}. ${insight}\n`;
      });
      prompt += `\n`;
    }

    // 当前市场建议（如果提供了技术指标）
    if (currentIndicators && currentIndicators.size > 0) {
      prompt += `🎯 CURRENT MARKET RECOMMENDATIONS:\n`;

      // 检查当前市场条件是否匹配高胜率模式
      for (const [coin, indicators] of currentIndicators.entries()) {
        const matchingPatterns = this.findMatchingPatterns(coin, indicators, report.winningPatterns);

        if (matchingPatterns.length > 0) {
          const pattern = matchingPatterns[0];
          prompt += `- ${coin}: Matches high win rate pattern (${(pattern.winRate * 100).toFixed(0)}% win rate) - Consider ${pattern.side}\n`;
        }
      }
      prompt += `\n`;
    }

    prompt += `⚠️ IMPORTANT: Use this historical data to inform your decisions, but always validate with current market conditions. Past performance does not guarantee future results.\n\n`;

    return prompt;
  }

  /**
   * 查找匹配当前市场条件的模式
   */
  private findMatchingPatterns(
    coin: Coin,
    indicators: TechnicalIndicators,
    patterns: TradingPattern[]
  ): TradingPattern[] {
    // 简化版本：只匹配币种
    // 实际应该匹配技术指标条件
    return patterns.filter(p => p.coin === coin);
  }

  /**
   * 生成空报告（样本不足时）
   */
  private generateEmptyReport(): LearningReport {
    return {
      analyzedTrades: 0,
      totalWinRate: 0,
      winningPatterns: [],
      losingPatterns: [],
      insights: ['样本量不足，需要更多交易数据'],
      learningPrompt: '',
    };
  }

  /**
   * 保存学习报告到日志文件
   */
  async saveReport(report: LearningReport, filename?: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      ...report,
    };

    // 保存到文件
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');

    const logsDir = path.join(process.cwd(), 'logs', 'learning');

    try {
      // 确保目录存在
      await fs.mkdir(logsDir, { recursive: true });

      // 生成文件名
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, '');
      const reportFilename = filename || `learning_report_${dateStr}_${timeStr}.json`;
      const filePath = path.join(logsDir, reportFilename);

      // 写入文件
      await fs.writeFile(filePath, JSON.stringify(logData, null, 2), 'utf-8');
      console.log(`[AIEvolution] 📄 学习报告已保存: ${filePath}`);

      // 同时保存最新报告的副本
      const latestPath = path.join(logsDir, 'latest_report.json');
      await fs.writeFile(latestPath, JSON.stringify(logData, null, 2), 'utf-8');
    } catch (error) {
      console.error('[AIEvolution] ❌ 保存报告失败:', error);
      // 回退到控制台输出
      console.log('[AIEvolution] 📄 学习报告:', JSON.stringify(logData, null, 2));
    }
  }

  /**
   * 加载最新的学习报告
   */
  async loadLatestReport(): Promise<LearningReport | null> {
    try {
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');

      const latestPath = path.join(process.cwd(), 'logs', 'learning', 'latest_report.json');
      const content = await fs.readFile(latestPath, 'utf-8');
      const data = JSON.parse(content);

      console.log(`[AIEvolution] 📖 已加载最新学习报告`);
      return data as LearningReport;
    } catch {
      console.log('[AIEvolution] ℹ️ 未找到历史学习报告');
      return null;
    }
  }
}

/**
 * 单例实例
 */
let evolutionEngineInstance: AIEvolutionEngine | null = null;

export function getAIEvolutionEngine(): AIEvolutionEngine {
  if (!evolutionEngineInstance) {
    evolutionEngineInstance = new AIEvolutionEngine();
  }
  return evolutionEngineInstance;
}
