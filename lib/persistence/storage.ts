/**
 * 数据持久化服务（暂时禁用）
 * ⚠️ Prisma 7.0配置问题，数据库功能暂时禁用
 * TODO: 配置 @prisma/adapter-libsql 以支持 Next.js
 */

// NOTE: PrismaClient 导入已移除，因为数据库功能暂时禁用
// import { PrismaClient } from '@prisma/client';
import {
  CompletedTrade,
  Position,
  AccountStatus,
  TradingDecision,
} from '@/types/trading';

/**
 * 交易持久化服务（Stub版本 - 所有方法都是空操作）
 */
export class TradingStorage {
  constructor() {
    console.log('[Storage] ⚠️  数据持久化暂时禁用（Prisma配置问题）');
  }

  async saveTrade(trade: CompletedTrade): Promise<void> {
    // Stub: 不执行任何操作
  }

  async savePositionSnapshot(modelName: string, position: Position): Promise<void> {
    // Stub: 不执行任何操作
  }

  async saveAccountSnapshot(modelName: string, account: AccountStatus): Promise<void> {
    // Stub: 不执行任何操作
  }

  async saveAIDecision(
    modelName: string,
    decision: TradingDecision,
    chainOfThought: string,
    executed: boolean,
    result: string
  ): Promise<void> {
    // Stub: 不执行任何操作
  }

  async saveEquityPoint(modelName: string, equity: number): Promise<void> {
    // Stub: 不执行任何操作
  }

  async getAllTrades(modelName?: string): Promise<CompletedTrade[]> {
    return [];
  }

  async getEquityHistory(modelName: string, limit: number = 1000): Promise<{ timestamp: number; equity: number }[]> {
    return [];
  }

  async getLatestAccountSnapshot(modelName: string): Promise<AccountStatus | null> {
    return null;
  }

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

  async cleanOldData(daysToKeep: number = 30): Promise<void> {
    // Stub: 不执行任何操作
  }

  async close(): Promise<void> {
    // Stub: 不执行任何操作
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
