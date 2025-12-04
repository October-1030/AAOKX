/**
 * 高性能日志系统
 * 使用 Pino 替代 console.log，提供结构化日志和极速性能
 * 专为量化交易系统设计
 */

import pino from 'pino';
import fs from 'fs';
import path from 'path';

// 日志级别定义
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// 交易相关日志标签
export type TradingContext = 
  | 'ARBITRAGE'     // 套利相关
  | 'EXECUTION'     // 交易执行
  | 'RISK'          // 风险管理
  | 'MARKET_DATA'   // 市场数据
  | 'PERFORMANCE'   // 性能监控
  | 'API'           // API调用
  | 'SYSTEM'        // 系统事件
  | 'ERROR'         // 错误处理
  | 'AUDIT'         // 审计跟踪

// 日志配置接口
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logDir?: string;
  maxFileSize?: number;
  maxFiles?: number;
  enableStructuredLogs?: boolean;
}

/**
 * 高性能日志器
 */
export class TradingLogger {
  private logger: pino.Logger;
  private config: LoggerConfig;
  private logDir: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level || 'info',
      enableConsole: config.enableConsole ?? true,
      enableFile: config.enableFile ?? true,
      logDir: config.logDir || './logs',
      maxFileSize: config.maxFileSize || 100 * 1024 * 1024, // 100MB
      maxFiles: config.maxFiles || 10,
      enableStructuredLogs: config.enableStructuredLogs ?? true
    };

    this.logDir = path.resolve(this.config.logDir!);
    this.ensureLogDirectory();
    this.logger = this.createLogger();
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('创建日志目录失败:', error);
    }
  }

  /**
   * 创建 Pino 日志器 (简化版本)
   */
  private createLogger(): pino.Logger {
    // 简化配置，避免序列化问题
    const loggerOptions: pino.LoggerOptions = {
      level: this.config.level,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (level) => ({ level })
      },
      serializers: {
        error: pino.stdSerializers.err
      }
    };

    if (this.config.enableConsole && !this.config.enableFile) {
      // 仅控制台输出
      return pino(loggerOptions);
    } else if (this.config.enableFile && !this.config.enableConsole) {
      // 仅文件输出
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `trading-${today}.log`);
      return pino(loggerOptions, pino.destination(logFile));
    } else {
      // 默认控制台输出
      return pino(loggerOptions);
    }
  }

  /**
   * 创建带上下文的日志器
   */
  context(context: TradingContext): pino.Logger {
    return this.logger.child({ context });
  }

  /**
   * 交易特定的日志方法
   */
  
  // 套利日志
  arbitrage(message: string, data?: any): void {
    this.logger.info({ context: 'ARBITRAGE', ...data }, message);
  }

  // 交易执行日志
  execution(message: string, data?: any): void {
    this.logger.info({ context: 'EXECUTION', ...data }, message);
  }

  // 风险管理日志
  risk(message: string, data?: any): void {
    this.logger.warn({ context: 'RISK', ...data }, message);
  }

  // 市场数据日志
  marketData(message: string, data?: any): void {
    this.logger.debug({ context: 'MARKET_DATA', ...data }, message);
  }

  // 性能日志
  performance(message: string, metrics?: any): void {
    this.logger.info({ context: 'PERFORMANCE', metrics }, message);
  }

  // API 调用日志
  api(message: string, data?: any): void {
    this.logger.debug({ context: 'API', ...data }, message);
  }

  // 审计日志（重要事件必须记录）
  audit(message: string, data?: any): void {
    this.logger.info({ context: 'AUDIT', ...data }, message);
  }

  // 标准日志级别方法
  trace(message: string, data?: any): void {
    this.logger.trace(data, message);
  }

  debug(message: string, data?: any): void {
    this.logger.debug(data, message);
  }

  info(message: string, data?: any): void {
    this.logger.info(data, message);
  }

  warn(message: string, data?: any): void {
    this.logger.warn(data, message);
  }

  error(message: string, error?: Error | any): void {
    this.logger.error({ error }, message);
  }

  fatal(message: string, error?: Error | any): void {
    this.logger.fatal({ error }, message);
  }

  /**
   * 性能测量装饰器
   */
  time<T>(label: string, fn: () => Promise<T>): Promise<T>;
  time<T>(label: string, fn: () => T): T;
  time<T>(label: string, fn: () => T | Promise<T>): T | Promise<T> {
    const start = performance.now();
    
    const logTiming = (duration: number) => {
      this.performance(`${label} completed`, { 
        duration: `${duration.toFixed(2)}ms`,
        label
      });
    };

    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result.finally(() => {
          logTiming(performance.now() - start);
        });
      } else {
        logTiming(performance.now() - start);
        return result;
      }
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`${label} failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }

  /**
   * 批量日志输出（高频场景使用）
   */
  batch(entries: Array<{ level: LogLevel; message: string; data?: any }>): void {
    for (const entry of entries) {
      this.logger[entry.level](entry.data, entry.message);
    }
  }

  /**
   * 交易会话日志
   */
  session(sessionId: string): pino.Logger {
    return this.logger.child({ sessionId, context: 'SESSION' });
  }

  /**
   * 获取日志统计
   */
  getStats(): {
    logDir: string;
    config: LoggerConfig;
    logFiles: string[];
  } {
    let logFiles: string[] = [];
    
    try {
      if (fs.existsSync(this.logDir)) {
        logFiles = fs.readdirSync(this.logDir).filter(file => file.endsWith('.log'));
      }
    } catch (error) {
      this.error('获取日志文件列表失败', error);
    }

    return {
      logDir: this.logDir,
      config: this.config,
      logFiles
    };
  }

  /**
   * 清理旧日志文件
   */
  cleanup(daysToKeep: number = 30): void {
    try {
      if (!fs.existsSync(this.logDir)) return;

      const files = fs.readdirSync(this.logDir);
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(filePath);
            this.info(`清理旧日志文件: ${file}`);
          }
        }
      }
    } catch (error) {
      this.error('清理日志文件失败', error);
    }
  }

  /**
   * 立即刷新所有日志缓冲区
   */
  flush(): void {
    // Pino 自动处理缓冲区刷新，这里主要用于确保所有日志都写入
    this.logger.info('日志缓冲区刷新');
  }

  /**
   * 关闭日志器
   */
  close(): void {
    // 强制刷新并关闭
    this.flush();
    // Pino 会自动处理资源清理
  }
}

// 创建默认实例
export const logger = new TradingLogger({
  level: 'debug',
  enableConsole: true,
  enableFile: true,
  enableStructuredLogs: true
});

// 便捷方法
export const createLogger = (config?: Partial<LoggerConfig>) => new TradingLogger(config);

// 导出日志方法（兼容现有代码）
export const log = {
  trace: (message: string, data?: any) => logger.trace(message, data),
  debug: (message: string, data?: any) => logger.debug(message, data),
  info: (message: string, data?: any) => logger.info(message, data),
  warn: (message: string, data?: any) => logger.warn(message, data),
  error: (message: string, error?: any) => logger.error(message, error),
  fatal: (message: string, error?: any) => logger.fatal(message, error),
  
  // 交易专用
  arbitrage: (message: string, data?: any) => logger.arbitrage(message, data),
  execution: (message: string, data?: any) => logger.execution(message, data),
  risk: (message: string, data?: any) => logger.risk(message, data),
  marketData: (message: string, data?: any) => logger.marketData(message, data),
  performance: (message: string, metrics?: any) => logger.performance(message, metrics),
  audit: (message: string, data?: any) => logger.audit(message, data),
};