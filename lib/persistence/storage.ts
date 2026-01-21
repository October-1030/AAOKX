/**
 * 数据持久化服务 - 基于JSON文件的轻量级存储
 * 替代 Prisma ORM，提供简单可靠的本地存储
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CompletedTrade,
  Position,
  AccountStatus,
  TradingDecision,
} from '@/types/trading';

// 存储目录配置
const DATA_DIR = path.join(process.cwd(), 'data');
const TRADES_FILE = path.join(DATA_DIR, 'trades.json');
const POSITIONS_FILE = path.join(DATA_DIR, 'positions.json');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const DECISIONS_FILE = path.join(DATA_DIR, 'decisions.json');
const EQUITY_FILE = path.join(DATA_DIR, 'equity_history.json');

// 数据结构定义
interface StoredTrade extends CompletedTrade {
  storedAt: number;
}

interface StoredPosition {
  modelName: string;
  position: Position;
  timestamp: number;
}

interface StoredAccount {
  modelName: string;
  account: AccountStatus;
  timestamp: number;
}

interface StoredDecision {
  modelName: string;
  decision: TradingDecision;
  chainOfThought: string;
  executed: boolean;
  result: string;
  timestamp: number;
}

interface StoredEquityPoint {
  modelName: string;
  equity: number;
  timestamp: number;
}

/**
 * 交易持久化服务 - JSON文件存储版本
 */
export class TradingStorage {
  private initialized = false;

  constructor() {
    this.initStorage();
  }

  /**
   * 初始化存储目录和文件
   */
  private initStorage(): void {
    try {
      // 创建数据目录
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log('[Storage] 📁 已创建数据目录:', DATA_DIR);
      }

      // 初始化各数据文件
      const files = [TRADES_FILE, POSITIONS_FILE, ACCOUNTS_FILE, DECISIONS_FILE, EQUITY_FILE];
      for (const file of files) {
        if (!fs.existsSync(file)) {
          fs.writeFileSync(file, '[]', 'utf-8');
        }
      }

      this.initialized = true;
      console.log('[Storage] ✅ 数据持久化服务已初始化');
    } catch (error) {
      console.error('[Storage] ❌ 初始化失败:', error);
    }
  }

  /**
   * 读取JSON文件
   */
  private readJson<T>(filePath: string): T[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T[];
    } catch {
      return [];
    }
  }

  /**
   * 写入JSON文件
   */
  private writeJson<T>(filePath: string, data: T[]): void {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[Storage] 写入失败:', filePath, error);
    }
  }

  /**
   * 追加数据到JSON文件
   */
  private appendJson<T>(filePath: string, item: T): void {
    const data = this.readJson<T>(filePath);
    data.push(item);

    // 限制文件大小，保留最近1000条记录
    if (data.length > 1000) {
      data.splice(0, data.length - 1000);
    }

    this.writeJson(filePath, data);
  }

  /**
   * 保存交易记录
   */
  async saveTrade(trade: CompletedTrade): Promise<void> {
    const storedTrade: StoredTrade = {
      ...trade,
      storedAt: Date.now(),
    };
    this.appendJson(TRADES_FILE, storedTrade);
    console.log(`[Storage] 💾 交易已保存: ${trade.coin} ${trade.side} PnL: $${trade.pnl.toFixed(2)}`);
  }

  /**
   * 保存持仓快照
   */
  async savePositionSnapshot(modelName: string, position: Position): Promise<void> {
    const stored: StoredPosition = {
      modelName,
      position,
      timestamp: Date.now(),
    };
    this.appendJson(POSITIONS_FILE, stored);
  }

  /**
   * 保存账户快照
   */
  async saveAccountSnapshot(modelName: string, account: AccountStatus): Promise<void> {
    const stored: StoredAccount = {
      modelName,
      account,
      timestamp: Date.now(),
    };
    this.appendJson(ACCOUNTS_FILE, stored);
  }

  /**
   * 保存AI决策记录
   */
  async saveAIDecision(
    modelName: string,
    decision: TradingDecision,
    chainOfThought: string,
    executed: boolean,
    result: string
  ): Promise<void> {
    const stored: StoredDecision = {
      modelName,
      decision,
      chainOfThought,
      executed,
      result,
      timestamp: Date.now(),
    };
    this.appendJson(DECISIONS_FILE, stored);
  }

  /**
   * 保存权益点
   */
  async saveEquityPoint(modelName: string, equity: number): Promise<void> {
    const stored: StoredEquityPoint = {
      modelName,
      equity,
      timestamp: Date.now(),
    };
    this.appendJson(EQUITY_FILE, stored);
  }

  /**
   * 获取所有交易记录
   */
  async getAllTrades(modelName?: string): Promise<CompletedTrade[]> {
    const trades = this.readJson<StoredTrade>(TRADES_FILE);
    if (modelName) {
      return trades.filter(t => t.modelName === modelName);
    }
    return trades;
  }

  /**
   * 获取权益历史
   */
  async getEquityHistory(modelName: string, limit: number = 1000): Promise<{ timestamp: number; equity: number }[]> {
    const points = this.readJson<StoredEquityPoint>(EQUITY_FILE);
    return points
      .filter(p => p.modelName === modelName)
      .slice(-limit)
      .map(p => ({ timestamp: p.timestamp, equity: p.equity }));
  }

  /**
   * 获取最新账户快照
   */
  async getLatestAccountSnapshot(modelName: string): Promise<AccountStatus | null> {
    const accounts = this.readJson<StoredAccount>(ACCOUNTS_FILE);
    const filtered = accounts.filter(a => a.modelName === modelName);
    if (filtered.length === 0) return null;
    return filtered[filtered.length - 1].account;
  }

  /**
   * 获取交易统计
   */
  async getTradingStats(modelName: string): Promise<{
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    winRate: number;
    avgProfit: number;
    avgLoss: number;
    profitFactor: number;
  }> {
    const trades = await this.getAllTrades(modelName);

    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalPnL: 0,
        winRate: 0,
        avgProfit: 0,
        avgLoss: 0,
        profitFactor: 0,
      };
    }

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      totalPnL,
      winRate: trades.length > 0 ? winningTrades.length / trades.length : 0,
      avgProfit: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0,
    };
  }

  /**
   * 清理旧数据
   */
  async cleanOldData(daysToKeep: number = 30): Promise<void> {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    // 清理交易记录
    const trades = this.readJson<StoredTrade>(TRADES_FILE);
    const filteredTrades = trades.filter(t => t.storedAt > cutoffTime);
    this.writeJson(TRADES_FILE, filteredTrades);

    // 清理权益历史
    const equity = this.readJson<StoredEquityPoint>(EQUITY_FILE);
    const filteredEquity = equity.filter(e => e.timestamp > cutoffTime);
    this.writeJson(EQUITY_FILE, filteredEquity);

    console.log(`[Storage] 🧹 已清理 ${daysToKeep} 天前的数据`);
  }

  /**
   * 导出所有数据
   */
  async exportAllData(): Promise<{
    trades: CompletedTrade[];
    equity: { modelName: string; equity: number; timestamp: number }[];
    accounts: StoredAccount[];
    decisions: StoredDecision[];
  }> {
    return {
      trades: this.readJson<StoredTrade>(TRADES_FILE),
      equity: this.readJson<StoredEquityPoint>(EQUITY_FILE),
      accounts: this.readJson<StoredAccount>(ACCOUNTS_FILE),
      decisions: this.readJson<StoredDecision>(DECISIONS_FILE),
    };
  }

  /**
   * 关闭存储（兼容接口）
   */
  async close(): Promise<void> {
    console.log('[Storage] 👋 存储服务已关闭');
  }
}

// 全局单例
let storageInstance: TradingStorage | null = null;

export function getTradingStorage(): TradingStorage {
  if (!storageInstance) {
    storageInstance = new TradingStorage();
  }
  return storageInstance;
}
