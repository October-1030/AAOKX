/**
 * Flow-Radar 日志系统
 * 支持持久化保存、按日期分割、多级别日志
 */

import * as fs from 'fs';
import * as path from 'path';

// 日志级别
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// 日志配置
const LOG_CONFIG = {
  // 日志目录
  LOG_DIR: path.join(process.cwd(), 'logs', 'flowRadar'),

  // 最小日志级别（低于此级别的不记录）
  MIN_LEVEL: LogLevel.DEBUG,

  // 是否同时输出到控制台
  CONSOLE_OUTPUT: true,

  // 单个日志文件最大大小（字节）
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB

  // 保留日志文件天数
  RETENTION_DAYS: 30,
};

// 日志条目
interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  message: string;
  data?: any;
}

/**
 * Flow-Radar 日志记录器
 */
export class FlowRadarLogger {
  private logDir: string;
  private currentDate: string = '';
  private logStream: fs.WriteStream | null = null;
  private minLevel: LogLevel;
  private consoleOutput: boolean;

  constructor(options?: {
    logDir?: string;
    minLevel?: LogLevel;
    consoleOutput?: boolean;
  }) {
    this.logDir = options?.logDir || LOG_CONFIG.LOG_DIR;
    this.minLevel = options?.minLevel ?? LOG_CONFIG.MIN_LEVEL;
    this.consoleOutput = options?.consoleOutput ?? LOG_CONFIG.CONSOLE_OUTPUT;

    this.ensureLogDir();
    this.cleanOldLogs();
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDir(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('[FlowRadar Logger] 创建日志目录失败:', error);
    }
  }

  /**
   * 获取当前日期字符串
   */
  private getDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * 获取日志文件路径
   */
  private getLogFilePath(): string {
    const date = this.getDateString();
    return path.join(this.logDir, `flowradar_${date}.log`);
  }

  /**
   * 确保日志流可用
   */
  private ensureLogStream(): void {
    const today = this.getDateString();

    // 日期变化时，关闭旧流并创建新流
    if (today !== this.currentDate) {
      this.closeStream();
      this.currentDate = today;
    }

    if (!this.logStream) {
      try {
        const logPath = this.getLogFilePath();
        this.logStream = fs.createWriteStream(logPath, { flags: 'a' });
        this.logStream.on('error', (err) => {
          console.error('[FlowRadar Logger] 写入日志失败:', err);
        });
      } catch (error) {
        console.error('[FlowRadar Logger] 创建日志流失败:', error);
      }
    }
  }

  /**
   * 关闭日志流
   */
  private closeStream(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }

  /**
   * 清理过期日志文件
   */
  private cleanOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffTime = Date.now() - LOG_CONFIG.RETENTION_DAYS * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (!file.startsWith('flowradar_') || !file.endsWith('.log')) {
          continue;
        }

        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(filePath);
          console.log(`[FlowRadar Logger] 清理过期日志: ${file}`);
        }
      }
    } catch (error) {
      // 静默处理清理失败
    }
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(entry: LogEntry): string {
    const base = `[${entry.timestamp}] [${entry.level}] [${entry.module}] ${entry.message}`;
    if (entry.data !== undefined) {
      return `${base} | ${JSON.stringify(entry.data)}`;
    }
    return base;
  }

  /**
   * 写入日志
   */
  private write(level: LogLevel, module: string, message: string, data?: any): void {
    if (level < this.minLevel) {
      return;
    }

    const levelName = LogLevel[level];
    const timestamp = new Date().toISOString();

    const entry: LogEntry = {
      timestamp,
      level: levelName,
      module,
      message,
      data,
    };

    const formattedMessage = this.formatMessage(entry);

    // 输出到控制台
    if (this.consoleOutput) {
      const prefix = `[FlowRadar ${module}]`;
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(`${prefix} ${message}`, data !== undefined ? data : '');
          break;
        case LogLevel.INFO:
          console.log(`${prefix} ${message}`, data !== undefined ? data : '');
          break;
        case LogLevel.WARN:
          console.warn(`${prefix} ⚠️ ${message}`, data !== undefined ? data : '');
          break;
        case LogLevel.ERROR:
          console.error(`${prefix} ❌ ${message}`, data !== undefined ? data : '');
          break;
      }
    }

    // 写入文件
    this.ensureLogStream();
    if (this.logStream) {
      this.logStream.write(formattedMessage + '\n');
    }
  }

  /**
   * 创建模块专用 logger
   */
  createModuleLogger(module: string): ModuleLogger {
    return new ModuleLogger(this, module);
  }

  // 公共日志方法
  debug(module: string, message: string, data?: any): void {
    this.write(LogLevel.DEBUG, module, message, data);
  }

  info(module: string, message: string, data?: any): void {
    this.write(LogLevel.INFO, module, message, data);
  }

  warn(module: string, message: string, data?: any): void {
    this.write(LogLevel.WARN, module, message, data);
  }

  error(module: string, message: string, data?: any): void {
    this.write(LogLevel.ERROR, module, message, data);
  }

  /**
   * 记录信号事件
   */
  logSignal(signal: {
    type: string;
    direction: string;
    confidence: number;
    price?: number;
  }): void {
    this.info('Signal', `收到信号: ${signal.type} ${signal.direction}`, signal);
  }

  /**
   * 记录风控事件
   */
  logRiskEvent(event: {
    type: 'daily_halt' | 'consecutive_halt' | 'cooldown' | 'leverage_change';
    details: any;
  }): void {
    const messages: Record<string, string> = {
      daily_halt: '日亏损熔断触发',
      consecutive_halt: '连亏熔断触发',
      cooldown: '进入冷却期',
      leverage_change: '杠杆调整',
    };
    this.warn('RiskControl', messages[event.type] || '风控事件', event.details);
  }

  /**
   * 记录交易事件
   */
  logTrade(trade: {
    action: 'open' | 'close';
    side: 'LONG' | 'SHORT';
    size?: number;
    price?: number;
    pnl?: number;
    reason?: string;
  }): void {
    const actionText = trade.action === 'open' ? '开仓' : '平仓';
    this.info('Trade', `${actionText}: ${trade.side}`, trade);
  }

  /**
   * 记录心跳状态变化
   */
  logHeartbeat(status: {
    from: string;
    to: string;
    reason?: string;
  }): void {
    this.info('Heartbeat', `状态变化: ${status.from} → ${status.to}`, status);
  }

  /**
   * 关闭 logger
   */
  close(): void {
    this.closeStream();
  }
}

/**
 * 模块专用 Logger
 */
export class ModuleLogger {
  constructor(
    private logger: FlowRadarLogger,
    private module: string
  ) {}

  debug(message: string, data?: any): void {
    this.logger.debug(this.module, message, data);
  }

  info(message: string, data?: any): void {
    this.logger.info(this.module, message, data);
  }

  warn(message: string, data?: any): void {
    this.logger.warn(this.module, message, data);
  }

  error(message: string, data?: any): void {
    this.logger.error(this.module, message, data);
  }
}

// 单例
let loggerInstance: FlowRadarLogger | null = null;

export function getFlowRadarLogger(): FlowRadarLogger {
  if (!loggerInstance) {
    loggerInstance = new FlowRadarLogger();
  }
  return loggerInstance;
}

// 便捷方法：获取模块 logger
export function createLogger(module: string): ModuleLogger {
  return getFlowRadarLogger().createModuleLogger(module);
}
