/**
 * 高性能监控模块
 * 监控 Node.js Event Loop 延迟、内存使用、CPU 性能
 * 为量化交易系统提供实时性能指标
 */

import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';
import { cpuUsage, memoryUsage } from 'process';

// 性能指标接口
export interface PerformanceMetrics {
  eventLoopLag: number;          // Event Loop 延迟 (ms)
  cpuUsagePercent: number;       // CPU 使用率 (%)
  memoryUsageMB: number;         // 内存使用 (MB)
  heapUsedPercent: number;       // 堆内存使用率 (%)
  gcCount: number;               // GC 次数
  gcDuration: number;            // GC 总时长 (ms)
  timestamp: number;             // 时间戳
}

// 性能告警配置
export interface AlertThresholds {
  eventLoopLagMs?: number;       // Event Loop 延迟阈值 (默认 10ms)
  cpuUsagePercent?: number;      // CPU 使用率阈值 (默认 80%)
  memoryUsagePercent?: number;   // 内存使用率阈值 (默认 90%)
}

// 性能历史统计
export interface PerformanceStats {
  avgEventLoopLag: number;
  maxEventLoopLag: number;
  avgCpuUsage: number;
  maxCpuUsage: number;
  avgMemoryUsage: number;
  maxMemoryUsage: number;
  totalGcCount: number;
  totalGcDuration: number;
  sampleCount: number;
  startTime: number;
  uptime: number;
}

/**
 * 性能监控器
 */
export class PerformanceMonitor extends EventEmitter {
  private isRunning = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private metricsHistory: PerformanceMetrics[] = [];
  private alertThresholds: Required<AlertThresholds>;
  
  // Event Loop 延迟测量
  private eventLoopDelayHistogram: any;
  private lastEventLoopCheck = performance.now();
  
  // CPU 使用率测量
  private lastCpuUsage = cpuUsage();
  private lastCpuTime = performance.now();
  
  // GC 监控
  private gcObserver: PerformanceObserver | null = null;
  private gcMetrics = {
    count: 0,
    totalDuration: 0
  };
  
  // 历史数据限制 (保留最近1000条记录)
  private readonly maxHistorySize = 1000;
  private readonly updateIntervalMs = 1000; // 1秒更新一次

  constructor(alertThresholds: AlertThresholds = {}) {
    super();
    
    this.alertThresholds = {
      eventLoopLagMs: alertThresholds.eventLoopLagMs ?? 10,
      cpuUsagePercent: alertThresholds.cpuUsagePercent ?? 80,
      memoryUsagePercent: alertThresholds.memoryUsagePercent ?? 90
    };

    this.initializeMonitoring();
  }

  /**
   * 初始化监控组件
   */
  private initializeMonitoring(): void {
    try {
      // 初始化 Event Loop 延迟监控
      const { monitorEventLoopDelay } = require('perf_hooks');
      this.eventLoopDelayHistogram = monitorEventLoopDelay({ resolution: 20 });
      
      // 初始化 GC 监控
      this.initializeGCMonitoring();
      
      console.log('✅ [PerformanceMonitor] 监控组件初始化完成');
    } catch (error) {
      console.error('❌ [PerformanceMonitor] 初始化失败:', error);
    }
  }

  /**
   * 初始化 GC 监控
   */
  private initializeGCMonitoring(): void {
    try {
      this.gcObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'gc') {
            this.gcMetrics.count++;
            this.gcMetrics.totalDuration += entry.duration;
          }
        }
      });
      
      this.gcObserver.observe({ entryTypes: ['gc'] });
      console.log('✅ [PerformanceMonitor] GC 监控已启用');
    } catch (error) {
      console.warn('⚠️ [PerformanceMonitor] GC 监控不可用:', error.message);
    }
  }

  /**
   * 启动性能监控
   */
  start(): void {
    if (this.isRunning) return;

    console.log('🚀 [PerformanceMonitor] 启动性能监控...');
    this.isRunning = true;

    // 启动 Event Loop 监控
    if (this.eventLoopDelayHistogram) {
      this.eventLoopDelayHistogram.enable();
    }

    // 定期收集性能指标
    this.monitorInterval = setInterval(() => {
      this.collectMetrics();
    }, this.updateIntervalMs);

    console.log(`✅ [PerformanceMonitor] 性能监控已启动 (${this.updateIntervalMs}ms 间隔)`);
  }

  /**
   * 停止性能监控
   */
  stop(): void {
    if (!this.isRunning) return;

    console.log('⏹️ [PerformanceMonitor] 停止性能监控...');
    this.isRunning = false;

    // 停止定时器
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    // 停止 Event Loop 监控
    if (this.eventLoopDelayHistogram) {
      this.eventLoopDelayHistogram.disable();
    }

    // 停止 GC 监控
    if (this.gcObserver) {
      this.gcObserver.disconnect();
    }

    console.log('✅ [PerformanceMonitor] 性能监控已停止');
  }

  /**
   * 收集性能指标
   */
  private collectMetrics(): void {
    try {
      const now = performance.now();
      
      // 1. Event Loop 延迟
      const eventLoopLag = this.measureEventLoopLag();
      
      // 2. CPU 使用率
      const cpuUsagePercent = this.measureCpuUsage(now);
      
      // 3. 内存使用情况
      const memory = memoryUsage();
      const memoryUsageMB = memory.heapUsed / 1024 / 1024;
      const heapUsedPercent = (memory.heapUsed / memory.heapTotal) * 100;
      
      // 4. GC 指标
      const { gcCount, gcDuration } = this.gcMetrics;

      const metrics: PerformanceMetrics = {
        eventLoopLag,
        cpuUsagePercent,
        memoryUsageMB,
        heapUsedPercent,
        gcCount,
        gcDuration,
        timestamp: Date.now()
      };

      // 添加到历史记录
      this.addToHistory(metrics);
      
      // 检查告警条件
      this.checkAlerts(metrics);
      
      // 发出指标更新事件
      this.emit('metrics', metrics);

    } catch (error) {
      console.error('❌ [PerformanceMonitor] 收集指标失败:', error);
    }
  }

  /**
   * 测量 Event Loop 延迟
   */
  private measureEventLoopLag(): number {
    if (!this.eventLoopDelayHistogram) {
      // 降级方案：简单的延迟测量
      const now = performance.now();
      const lag = now - this.lastEventLoopCheck - this.updateIntervalMs;
      this.lastEventLoopCheck = now;
      return Math.max(lag, 0);
    }

    // 使用专用的 Event Loop 延迟直方图
    const lag = this.eventLoopDelayHistogram.mean / 1000000; // 转换为毫秒
    this.eventLoopDelayHistogram.reset();
    return lag;
  }

  /**
   * 测量 CPU 使用率
   */
  private measureCpuUsage(now: number): number {
    const currentCpuUsage = cpuUsage(this.lastCpuUsage);
    const timeDiff = now - this.lastCpuTime;
    
    // 计算 CPU 使用率百分比
    const totalCpuTime = currentCpuUsage.user + currentCpuUsage.system;
    const cpuPercent = (totalCpuTime / (timeDiff * 1000)) * 100; // timeDiff 转换为微秒
    
    this.lastCpuUsage = cpuUsage();
    this.lastCpuTime = now;
    
    return Math.min(cpuPercent, 100); // 限制在 100% 以内
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(metrics: PerformanceMetrics): void {
    this.metricsHistory.push(metrics);
    
    // 限制历史记录大小
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * 检查告警条件
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    const alerts: string[] = [];

    // Event Loop 延迟告警
    if (metrics.eventLoopLag > this.alertThresholds.eventLoopLagMs) {
      alerts.push(`Event Loop 延迟过高: ${metrics.eventLoopLag.toFixed(2)}ms`);
    }

    // CPU 使用率告警
    if (metrics.cpuUsagePercent > this.alertThresholds.cpuUsagePercent) {
      alerts.push(`CPU 使用率过高: ${metrics.cpuUsagePercent.toFixed(1)}%`);
    }

    // 内存使用率告警
    if (metrics.heapUsedPercent > this.alertThresholds.memoryUsagePercent) {
      alerts.push(`内存使用率过高: ${metrics.heapUsedPercent.toFixed(1)}%`);
    }

    // 发送告警
    if (alerts.length > 0) {
      console.warn(`🚨 [PerformanceMonitor] 性能告警: ${alerts.join(', ')}`);
      this.emit('alert', { alerts, metrics });
    }
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metricsHistory.length > 0 
      ? this.metricsHistory[this.metricsHistory.length - 1] 
      : null;
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): PerformanceStats {
    if (this.metricsHistory.length === 0) {
      return {
        avgEventLoopLag: 0,
        maxEventLoopLag: 0,
        avgCpuUsage: 0,
        maxCpuUsage: 0,
        avgMemoryUsage: 0,
        maxMemoryUsage: 0,
        totalGcCount: 0,
        totalGcDuration: 0,
        sampleCount: 0,
        startTime: Date.now(),
        uptime: 0
      };
    }

    const history = this.metricsHistory;
    const firstMetric = history[0];
    const lastMetric = history[history.length - 1];

    return {
      avgEventLoopLag: history.reduce((sum, m) => sum + m.eventLoopLag, 0) / history.length,
      maxEventLoopLag: Math.max(...history.map(m => m.eventLoopLag)),
      avgCpuUsage: history.reduce((sum, m) => sum + m.cpuUsagePercent, 0) / history.length,
      maxCpuUsage: Math.max(...history.map(m => m.cpuUsagePercent)),
      avgMemoryUsage: history.reduce((sum, m) => sum + m.memoryUsageMB, 0) / history.length,
      maxMemoryUsage: Math.max(...history.map(m => m.memoryUsageMB)),
      totalGcCount: lastMetric.gcCount,
      totalGcDuration: lastMetric.gcDuration,
      sampleCount: history.length,
      startTime: firstMetric.timestamp,
      uptime: lastMetric.timestamp - firstMetric.timestamp
    };
  }

  /**
   * 获取监控状态
   */
  getStatus(): {
    isRunning: boolean;
    alertThresholds: Required<AlertThresholds>;
    metricsCollected: number;
    uptime: number;
  } {
    const stats = this.getPerformanceStats();
    return {
      isRunning: this.isRunning,
      alertThresholds: this.alertThresholds,
      metricsCollected: this.metricsHistory.length,
      uptime: stats.uptime
    };
  }

  /**
   * 重置统计数据
   */
  reset(): void {
    this.metricsHistory = [];
    this.gcMetrics.count = 0;
    this.gcMetrics.totalDuration = 0;
    console.log('✅ [PerformanceMonitor] 统计数据已重置');
  }
}

// 导出单例
export const performanceMonitor = new PerformanceMonitor({
  eventLoopLagMs: 5,    // 交易系统更严格的延迟要求
  cpuUsagePercent: 70,  // 更低的 CPU 告警阈值
  memoryUsagePercent: 85 // 更低的内存告警阈值
});