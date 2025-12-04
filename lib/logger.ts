/**
 * 交易日志系统
 * 将所有重要交易信息保存到本地文件
 */

import fs from 'fs';
import path from 'path';

export class TradingLogger {
  private logDir: string;
  private currentLogFile: string;
  
  constructor() {
    // 创建 logs 目录
    this.logDir = path.join(process.cwd(), 'trading-logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // 每天创建新的日志文件
    const today = new Date().toISOString().split('T')[0];
    this.currentLogFile = path.join(this.logDir, `trading-${today}.log`);
  }
  
  /**
   * 写入日志
   */
  log(level: 'INFO' | 'WARN' | 'ERROR' | 'TRADE', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: data || {},
    };
    
    // 同时输出到控制台
    console.log(`[${level}] ${message}`, data || '');
    
    // 追加到文件
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(this.currentLogFile, logLine, 'utf8');
  }
  
  /**
   * 记录交易决策
   */
  logTradeDecision(modelName: string, decision: any, accountBalance: number) {
    this.log('TRADE', `${modelName} 交易决策`, {
      model: modelName,
      decision,
      accountBalance,
      timestamp: Date.now(),
    });
  }
  
  /**
   * 记录交易执行
   */
  logTradeExecution(result: any) {
    this.log('TRADE', '交易执行结果', {
      ...result,
      timestamp: Date.now(),
    });
  }
  
  /**
   * 记录账户状态
   */
  logAccountStatus(status: any) {
    this.log('INFO', '账户状态更新', {
      balance: status.accountValue,
      positions: status.positions,
      unrealizedPnL: status.unrealizedPnL,
      timestamp: Date.now(),
    });
  }
  
  /**
   * 记录错误
   */
  logError(error: Error, context?: string) {
    this.log('ERROR', `错误: ${context || 'Unknown'}`, {
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
    });
  }
  
  /**
   * 记录策略切换
   */
  logStrategyChange(oldStrategy: string, newStrategy: string, reason: string) {
    this.log('INFO', '策略切换', {
      from: oldStrategy,
      to: newStrategy,
      reason,
      timestamp: Date.now(),
    });
  }
  
  /**
   * 记录市场分析
   */
  logMarketAnalysis(analysis: any) {
    this.log('INFO', '市场分析', {
      ...analysis,
      timestamp: Date.now(),
    });
  }
  
  /**
   * 生成日报
   */
  async generateDailyReport(): Promise<string> {
    const logContent = fs.readFileSync(this.currentLogFile, 'utf8');
    const logs = logContent.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
    
    // 统计交易
    const trades = logs.filter(log => log.level === 'TRADE');
    const errors = logs.filter(log => log.level === 'ERROR');
    
    // 计算盈亏
    const startBalance = logs[0]?.data?.accountBalance || 0;
    const endBalance = logs[logs.length - 1]?.data?.accountBalance || 0;
    const profit = endBalance - startBalance;
    const profitPercent = startBalance > 0 ? (profit / startBalance) * 100 : 0;
    
    const report = `
=== 📊 每日交易报告 ===
日期: ${new Date().toISOString().split('T')[0]}

📈 账户表现:
- 起始余额: $${startBalance.toFixed(2)}
- 结束余额: $${endBalance.toFixed(2)}
- 盈亏: ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)} (${profitPercent.toFixed(2)}%)

🔄 交易统计:
- 总交易数: ${trades.length}
- 错误数: ${errors.length}

📝 详细日志: ${this.currentLogFile}
========================
    `;
    
    // 保存报告
    const reportFile = path.join(this.logDir, `report-${new Date().toISOString().split('T')[0]}.txt`);
    fs.writeFileSync(reportFile, report, 'utf8');
    
    return report;
  }
  
  /**
   * 清理旧日志（保留最近30天）
   */
  cleanOldLogs(daysToKeep: number = 30) {
    const files = fs.readdirSync(this.logDir);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
    
    files.forEach(file => {
      const filePath = path.join(this.logDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`[Logger] 删除旧日志: ${file}`);
      }
    });
  }
}

// 导出单例
export const tradingLogger = new TradingLogger();