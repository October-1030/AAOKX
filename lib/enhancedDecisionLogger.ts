/**
 * 增强的决策日志系统
 * 借鉴 NOFX 项目的完整推理记录
 *
 * 记录内容：
 * 1. 输入数据（市场数据、账户状态、技术指标）
 * 2. AI完整推理过程（Chain of Thought）
 * 3. 决策输出（具体交易决策）
 * 4. 执行结果（成功/失败、实际价格）
 * 5. 最终结果（PnL、持仓时长）
 */

import {
  Coin,
  TradingDecision,
  TechnicalIndicators,
  Position,
  CompletedTrade,
  MarketData,
  AccountStatus,
} from '@/types/trading';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 完整的决策日志
 */
export interface DecisionLog {
  // 基础信息
  id: string;
  timestamp: number;
  timestampHuman: string;
  agent: string;  // "DeepSeek" 等

  // 输入数据
  input: {
    accountStatus: {
      equity: number;
      availableCash: number;
      totalReturn: number;
      positionsCount: number;
    };
    marketData: {
      [coin: string]: {
        price: number;
        rsi: number;
        macd: number;
        ema20: number;
        zScore?: number;
        marketRegime?: string;
      };
    };
    existingPositions: Array<{
      coin: Coin;
      side: string;
      unrealizedPnL: number;
      holdingMinutes: number;
    }>;
  };

  // AI推理过程
  reasoning: {
    chainOfThought: string;          // 完整的思考过程
    analysisHighlights: string[];    // 关键分析点
    riskAssessment: string;          // 风险评估
  };

  // 决策输出
  decisions: TradingDecision[];

  // 执行结果
  execution: {
    success: boolean;
    executedDecisions: Array<{
      coin: Coin;
      action: string;
      plannedPrice: number;
      actualPrice: number;
      slippage: number;
      size: number;
      fees: number;
    }>;
    failedDecisions: Array<{
      coin: Coin;
      action: string;
      reason: string;
    }>;
  };

  // 性能统计（回填，用于复盘）
  outcome?: {
    pnl: number;
    pnlPercent: number;
    winRate: number;
    holdingDuration: number;  // 分钟
    exitReason: string;
  };

  // 元数据
  metadata: {
    promptTokens?: number;
    responseTokens?: number;
    apiLatency?: number;
    riskLevel?: string;
  };
}

/**
 * 日志统计
 */
export interface LogStatistics {
  totalDecisions: number;
  totalTrades: number;
  successRate: number;
  avgDecisionTime: number;
  commonFailures: Array<{ reason: string; count: number }>;
  topPerformingCoins: Array<{ coin: Coin; winRate: number; trades: number }>;
}

/**
 * 增强决策日志记录器
 */
export class EnhancedDecisionLogger {
  private logDir: string;
  private currentLogFile: string;
  private logs: DecisionLog[] = [];

  constructor(logDir: string = './logs/decisions') {
    this.logDir = logDir;
    this.currentLogFile = this.getLogFileName();
    this.ensureLogDirectory();
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
        console.log(`[DecisionLogger] 📁 创建日志目录: ${this.logDir}`);
      }
    } catch (error) {
      console.error('[DecisionLogger] ❌ 创建日志目录失败:', error);
    }
  }

  /**
   * 生成日志文件名（按日期）
   */
  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `decisions-${date}.jsonl`);
  }

  /**
   * 记录决策（核心方法）
   */
  async logDecision(log: DecisionLog): Promise<void> {
    try {
      // 1. 添加到内存
      this.logs.push(log);

      // 2. 写入文件（JSONL 格式，每行一个 JSON）
      const logLine = JSON.stringify(log) + '\n';
      fs.appendFileSync(this.currentLogFile, logLine, 'utf8');

      // 3. 控制台简要输出
      const emoji = log.execution.success ? '✅' : '❌';
      console.log(`[DecisionLogger] ${emoji} 决策已记录: ${log.id} | ${log.decisions.length} 个决策 | ${log.execution.executedDecisions.length} 个执行成功`);
    } catch (error) {
      console.error('[DecisionLogger] ❌ 记录决策失败:', error);
    }
  }

  /**
   * 创建决策日志（便捷方法）
   */
  createDecisionLog(
    agent: string,
    accountStatus: AccountStatus,
    marketData: MarketData[],
    chainOfThought: string,
    decisions: TradingDecision[]
  ): DecisionLog {
    const timestamp = Date.now();
    const id = `${agent}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

    // 提取输入数据摘要
    const input = {
      accountStatus: {
        equity: accountStatus.totalEquity,
        availableCash: accountStatus.availableCash,
        totalReturn: accountStatus.totalReturn,
        positionsCount: accountStatus.positions.length,
      },
      marketData: Object.fromEntries(
        marketData.map(m => [
          m.coin,
          {
            price: m.current.price,
            rsi: m.current.rsi_14,
            macd: m.current.macd,
            ema20: m.current.ema_20,
            zScore: m.current.linear_regression.zScore,
            marketRegime: m.current.market_regime.regime,
          },
        ])
      ),
      existingPositions: accountStatus.positions.map(p => ({
        coin: p.coin,
        side: p.side,
        unrealizedPnL: p.unrealizedPnL,
        holdingMinutes: Math.floor((timestamp - p.openedAt) / 60000),
      })),
    };

    // 提取推理高亮
    const analysisHighlights = this.extractHighlights(chainOfThought);

    return {
      id,
      timestamp,
      timestampHuman: new Date(timestamp).toLocaleString(),
      agent,
      input,
      reasoning: {
        chainOfThought,
        analysisHighlights,
        riskAssessment: 'Normal',  // 可以后续增强
      },
      decisions,
      execution: {
        success: false,  // 稍后更新
        executedDecisions: [],
        failedDecisions: [],
      },
      metadata: {},
    };
  }

  /**
   * 更新执行结果
   */
  updateExecutionResult(
    logId: string,
    success: boolean,
    executedDecisions: DecisionLog['execution']['executedDecisions'],
    failedDecisions: DecisionLog['execution']['failedDecisions']
  ): void {
    const log = this.logs.find(l => l.id === logId);
    if (log) {
      log.execution = {
        success,
        executedDecisions,
        failedDecisions,
      };
      console.log(`[DecisionLogger] 📝 更新执行结果: ${logId}`);
    }
  }

  /**
   * 回填交易结果（用于分析）
   */
  updateOutcome(logId: string, outcome: DecisionLog['outcome']): void {
    const log = this.logs.find(l => l.id === logId);
    if (log) {
      log.outcome = outcome;
      console.log(`[DecisionLogger] 📊 回填交易结果: ${logId} | PnL: $${outcome?.pnl.toFixed(2)}`);
    }
  }

  /**
   * 提取推理高亮（关键信息）
   */
  private extractHighlights(chainOfThought: string): string[] {
    const highlights: string[] = [];

    // 简单的关键词提取
    const lines = chainOfThought.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.includes('Decision:') ||
        trimmed.includes('Rationale:') ||
        trimmed.includes('URGENT') ||
        trimmed.includes('CRITICAL') ||
        trimmed.includes('oversold') ||
        trimmed.includes('overbought') ||
        trimmed.includes('strong signal')
      ) {
        highlights.push(trimmed);
      }
    }

    return highlights.slice(0, 5);  // 最多5条
  }

  /**
   * 加载历史日志（用于分析）
   */
  async loadLogs(date?: string): Promise<DecisionLog[]> {
    try {
      const fileName = date
        ? path.join(this.logDir, `decisions-${date}.jsonl`)
        : this.currentLogFile;

      if (!fs.existsSync(fileName)) {
        console.log(`[DecisionLogger] ⚠️ 日志文件不存在: ${fileName}`);
        return [];
      }

      const content = fs.readFileSync(fileName, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      const logs = lines.map(line => JSON.parse(line) as DecisionLog);
      console.log(`[DecisionLogger] 📂 加载了 ${logs.length} 条日志`);
      return logs;
    } catch (error) {
      console.error('[DecisionLogger] ❌ 加载日志失败:', error);
      return [];
    }
  }

  /**
   * 生成统计报告
   */
  async generateStatistics(logs?: DecisionLog[]): Promise<LogStatistics> {
    const logsToAnalyze = logs || this.logs;

    if (logsToAnalyze.length === 0) {
      return {
        totalDecisions: 0,
        totalTrades: 0,
        successRate: 0,
        avgDecisionTime: 0,
        commonFailures: [],
        topPerformingCoins: [],
      };
    }

    // 1. 基础统计
    const totalDecisions = logsToAnalyze.length;
    const totalTrades = logsToAnalyze.reduce(
      (sum, log) => sum + log.execution.executedDecisions.length,
      0
    );
    const successCount = logsToAnalyze.filter(log => log.execution.success).length;
    const successRate = successCount / totalDecisions;

    // 2. 平均决策时间
    const latencies = logsToAnalyze
      .map(log => log.metadata.apiLatency)
      .filter(l => l !== undefined) as number[];
    const avgDecisionTime = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    // 3. 常见失败原因
    const failureReasons = new Map<string, number>();
    for (const log of logsToAnalyze) {
      for (const failure of log.execution.failedDecisions) {
        const count = failureReasons.get(failure.reason) || 0;
        failureReasons.set(failure.reason, count + 1);
      }
    }
    const commonFailures = Array.from(failureReasons.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 4. 表现最好的币种（需要outcome数据）
    const coinPerformance = new Map<Coin, { wins: number; total: number }>();
    for (const log of logsToAnalyze) {
      if (log.outcome) {
        for (const decision of log.decisions) {
          const stats = coinPerformance.get(decision.coin) || { wins: 0, total: 0 };
          stats.total++;
          if (log.outcome.pnl > 0) stats.wins++;
          coinPerformance.set(decision.coin, stats);
        }
      }
    }
    const topPerformingCoins = Array.from(coinPerformance.entries())
      .map(([coin, stats]) => ({
        coin,
        winRate: stats.total > 0 ? stats.wins / stats.total : 0,
        trades: stats.total,
      }))
      .filter(c => c.trades >= 3)  // 至少3笔交易
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 5);

    return {
      totalDecisions,
      totalTrades,
      successRate,
      avgDecisionTime,
      commonFailures,
      topPerformingCoins,
    };
  }

  /**
   * 生成决策报告（用于复盘）
   */
  async generateReport(date?: string): Promise<string> {
    const logs = date ? await this.loadLogs(date) : this.logs;
    const stats = await this.generateStatistics(logs);

    let report = `\n========================================\n`;
    report += `📊 决策日志报告\n`;
    report += `日期: ${date || '今天'}\n`;
    report += `========================================\n\n`;

    report += `📈 基础统计:\n`;
    report += `  总决策次数: ${stats.totalDecisions}\n`;
    report += `  总交易笔数: ${stats.totalTrades}\n`;
    report += `  执行成功率: ${(stats.successRate * 100).toFixed(1)}%\n`;
    report += `  平均决策时间: ${stats.avgDecisionTime.toFixed(0)}ms\n\n`;

    if (stats.commonFailures.length > 0) {
      report += `❌ 常见失败原因:\n`;
      for (const failure of stats.commonFailures) {
        report += `  - ${failure.reason}: ${failure.count} 次\n`;
      }
      report += `\n`;
    }

    if (stats.topPerformingCoins.length > 0) {
      report += `🏆 表现最好的币种:\n`;
      for (const coin of stats.topPerformingCoins) {
        report += `  - ${coin.coin}: ${(coin.winRate * 100).toFixed(0)}% 胜率 (${coin.trades} 笔交易)\n`;
      }
      report += `\n`;
    }

    report += `========================================\n`;

    return report;
  }

  /**
   * 清理旧日志（可选）
   */
  async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

      let deletedCount = 0;
      for (const file of files) {
        if (!file.startsWith('decisions-') || !file.endsWith('.jsonl')) continue;

        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`[DecisionLogger] 🗑️ 清理了 ${deletedCount} 个旧日志文件`);
      }
    } catch (error) {
      console.error('[DecisionLogger] ❌ 清理日志失败:', error);
    }
  }
}

/**
 * 单例实例
 */
let loggerInstance: EnhancedDecisionLogger | null = null;

export function getDecisionLogger(logDir?: string): EnhancedDecisionLogger {
  if (!loggerInstance) {
    loggerInstance = new EnhancedDecisionLogger(logDir);
  }
  return loggerInstance;
}
