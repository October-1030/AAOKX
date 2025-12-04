/**
 * 自动保存系统
 * 定时保存交易状态，防止意外关机丢失数据
 */

import fs from 'fs';
import path from 'path';
import { tradingLogger } from './logger';

export interface SystemState {
  timestamp: number;
  accountBalance: number;
  positions: any[];
  tradingHistory: any[];
  aiDecisions: any[];
  performance: {
    totalReturn: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  systemStatus: {
    isRunning: boolean;
    lastExecutionTime: number;
    totalExecutions: number;
    errors: number;
  };
}

export class AutoSaveSystem {
  private saveDir: string;
  private stateFile: string;
  private backupFile: string;
  private saveInterval: NodeJS.Timeout | null = null;
  private currentState: SystemState;
  
  constructor() {
    // 创建保存目录
    this.saveDir = path.join(process.cwd(), 'system-state');
    if (!fs.existsSync(this.saveDir)) {
      fs.mkdirSync(this.saveDir, { recursive: true });
    }
    
    this.stateFile = path.join(this.saveDir, 'current-state.json');
    this.backupFile = path.join(this.saveDir, 'backup-state.json');
    
    // 加载或初始化状态
    this.currentState = this.loadState();
  }
  
  /**
   * 加载保存的状态
   */
  private loadState(): SystemState {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = fs.readFileSync(this.stateFile, 'utf8');
        const state = JSON.parse(data);
        console.log('[AutoSave] ✅ 恢复上次保存的状态');
        tradingLogger.log('INFO', '系统状态恢复', {
          lastSave: new Date(state.timestamp).toISOString(),
          balance: state.accountBalance,
        });
        return state;
      }
    } catch (error) {
      console.error('[AutoSave] ❌ 加载状态失败:', error);
      tradingLogger.logError(error as Error, 'AutoSave.loadState');
    }
    
    // 返回初始状态
    return this.getInitialState();
  }
  
  /**
   * 获取初始状态
   */
  private getInitialState(): SystemState {
    return {
      timestamp: Date.now(),
      accountBalance: 0,
      positions: [],
      tradingHistory: [],
      aiDecisions: [],
      performance: {
        totalReturn: 0,
        winRate: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
      },
      systemStatus: {
        isRunning: false,
        lastExecutionTime: 0,
        totalExecutions: 0,
        errors: 0,
      },
    };
  }
  
  /**
   * 保存当前状态
   */
  saveState(force: boolean = false) {
    try {
      // 创建备份
      if (fs.existsSync(this.stateFile)) {
        fs.copyFileSync(this.stateFile, this.backupFile);
      }
      
      // 更新时间戳
      this.currentState.timestamp = Date.now();
      
      // 保存状态
      const data = JSON.stringify(this.currentState, null, 2);
      fs.writeFileSync(this.stateFile, data, 'utf8');
      
      if (force) {
        console.log('[AutoSave] 💾 状态已强制保存');
      }
      
      // 同时保存带时间戳的副本（每小时一个）
      const hourly = new Date().toISOString().split(':')[0].replace('T', '-');
      const hourlyFile = path.join(this.saveDir, `state-${hourly}.json`);
      if (!fs.existsSync(hourlyFile)) {
        fs.writeFileSync(hourlyFile, data, 'utf8');
        console.log(`[AutoSave] 📁 小时快照已保存: state-${hourly}.json`);
      }
      
    } catch (error) {
      console.error('[AutoSave] ❌ 保存状态失败:', error);
      tradingLogger.logError(error as Error, 'AutoSave.saveState');
    }
  }
  
  /**
   * 启动自动保存
   */
  startAutoSave(intervalMinutes: number = 5) {
    // 清除旧的定时器
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    
    // 立即保存一次
    this.saveState();
    
    // 设置定时保存
    this.saveInterval = setInterval(() => {
      this.saveState();
    }, intervalMinutes * 60 * 1000);
    
    console.log(`[AutoSave] 🔄 自动保存已启动，每 ${intervalMinutes} 分钟保存一次`);
    tradingLogger.log('INFO', '自动保存系统启动', { intervalMinutes });
    
    // 注册退出时保存
    this.registerExitHandlers();
  }
  
  /**
   * 停止自动保存
   */
  stopAutoSave() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
      console.log('[AutoSave] ⏸️ 自动保存已停止');
    }
    
    // 最后保存一次
    this.saveState(true);
  }
  
  /**
   * 更新账户状态
   */
  updateAccountStatus(balance: number, positions: any[]) {
    this.currentState.accountBalance = balance;
    this.currentState.positions = positions;
    this.currentState.systemStatus.lastExecutionTime = Date.now();
  }
  
  /**
   * 记录交易
   */
  recordTrade(trade: any) {
    this.currentState.tradingHistory.push({
      ...trade,
      timestamp: Date.now(),
    });
    
    // 保持历史记录不超过1000条
    if (this.currentState.tradingHistory.length > 1000) {
      this.currentState.tradingHistory = this.currentState.tradingHistory.slice(-1000);
    }
  }
  
  /**
   * 记录 AI 决策
   */
  recordAIDecision(decision: any) {
    this.currentState.aiDecisions.push({
      ...decision,
      timestamp: Date.now(),
    });
    
    // 保持决策记录不超过500条
    if (this.currentState.aiDecisions.length > 500) {
      this.currentState.aiDecisions = this.currentState.aiDecisions.slice(-500);
    }
    
    this.currentState.systemStatus.totalExecutions++;
  }
  
  /**
   * 更新性能指标
   */
  updatePerformance(metrics: Partial<SystemState['performance']>) {
    this.currentState.performance = {
      ...this.currentState.performance,
      ...metrics,
    };
  }
  
  /**
   * 记录错误
   */
  recordError(error: Error) {
    this.currentState.systemStatus.errors++;
    tradingLogger.logError(error, 'System Error');
    
    // 错误过多时强制保存
    if (this.currentState.systemStatus.errors % 10 === 0) {
      this.saveState(true);
    }
  }
  
  /**
   * 获取系统状态
   */
  getState(): SystemState {
    return { ...this.currentState };
  }
  
  /**
   * 注册退出处理器
   */
  private registerExitHandlers() {
    // 正常退出
    process.on('exit', () => {
      console.log('[AutoSave] 🔚 程序退出，保存最终状态...');
      this.saveState(true);
    });
    
    // Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n[AutoSave] 🛑 收到中断信号，保存状态...');
      this.saveState(true);
      process.exit(0);
    });
    
    // 终止信号
    process.on('SIGTERM', () => {
      console.log('[AutoSave] 🛑 收到终止信号，保存状态...');
      this.saveState(true);
      process.exit(0);
    });
    
    // 未捕获的异常
    process.on('uncaughtException', (error) => {
      console.error('[AutoSave] 💥 未捕获的异常:', error);
      this.recordError(error);
      this.saveState(true);
      process.exit(1);
    });
    
    // 未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[AutoSave] 💥 未处理的 Promise 拒绝:', reason);
      this.recordError(new Error(String(reason)));
      this.saveState(true);
    });
  }
  
  /**
   * 清理旧文件
   */
  cleanOldFiles(daysToKeep: number = 7) {
    const files = fs.readdirSync(this.saveDir);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
    
    files.forEach(file => {
      if (file.startsWith('state-') && file.endsWith('.json')) {
        const filePath = path.join(this.saveDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`[AutoSave] 🗑️ 删除旧状态文件: ${file}`);
        }
      }
    });
  }
}

// 导出单例
export const autoSaveSystem = new AutoSaveSystem();

// 启动自动保存（每5分钟）
autoSaveSystem.startAutoSave(5);