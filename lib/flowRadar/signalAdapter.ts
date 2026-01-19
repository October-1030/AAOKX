/**
 * Flow-Radar 信号读取适配器
 * 从 JSONL.gz 文件读取和处理信号
 */

import * as fs from 'fs';
import * as zlib from 'zlib';
import * as readline from 'readline';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import {
  RawSignalEvent,
  NormalizedSignal,
  FlowRadarSummary,
  SignalPriority,
  SignalStatus,
  IcebergLevel,
  MarketState,
  SignalDirection,
  SIGNAL_TYPES,
  SignalType,
} from './types';
import { getFlowRadarPath, getTodayEventFile, getLatestEventFiles } from './pathDetector';

// 配置常量
const CONFIG = {
  // 信号有效窗口（秒）
  SIGNAL_WINDOW_SEC: 300, // 5分钟

  // TTL 规则（秒）
  TTL: {
    ICEBERG_CONFIRMED: 60, // 确认冰山 45-60秒
    ICEBERG_ACTIVITY: 45,
    KKING_STATE: 180, // K神信号 120-180秒
    DEFAULT: 120,
  },

  // 最小置信度
  MIN_CONFIDENCE: 60,

  // 目标交易对
  TARGET_SYMBOL: 'DOGE/USDT',

  // Checkpoint 文件
  CHECKPOINT_FILE: 'flow_radar_checkpoint.json',
};

// Checkpoint 数据
interface Checkpoint {
  filePath: string;
  lastOffset: number;
  lastTimestamp: number;
  processedCount: number;
}

/**
 * 信号读取适配器
 */
export class FlowRadarSignalAdapter {
  private eventsPath: string | null = null;
  private checkpoint: Checkpoint | null = null;
  private signals: NormalizedSignal[] = [];
  private lastReadTime: number = 0;
  private initialized: boolean = false;

  constructor() {
    this.init();
  }

  /**
   * 初始化适配器
   */
  private init(): void {
    const pathResult = getFlowRadarPath();
    if (pathResult.found && pathResult.eventsPath) {
      this.eventsPath = pathResult.eventsPath;
      this.loadCheckpoint();
      this.initialized = true;
      console.log(`[FlowRadar Adapter] ✅ 初始化成功: ${this.eventsPath}`);
    } else {
      console.log(`[FlowRadar Adapter] ⚠️ 初始化失败: ${pathResult.error}`);
    }
  }

  /**
   * 检查是否可用
   */
  isAvailable(): boolean {
    return this.initialized && this.eventsPath !== null;
  }

  /**
   * 加载 checkpoint
   */
  private loadCheckpoint(): void {
    try {
      const checkpointPath = this.getCheckpointPath();
      if (fs.existsSync(checkpointPath)) {
        const data = fs.readFileSync(checkpointPath, 'utf-8');
        this.checkpoint = JSON.parse(data);
        console.log(`[FlowRadar Adapter] 📄 加载 checkpoint: offset=${this.checkpoint?.lastOffset}`);
      }
    } catch {
      this.checkpoint = null;
    }
  }

  /**
   * 保存 checkpoint
   */
  private saveCheckpoint(): void {
    try {
      const checkpointPath = this.getCheckpointPath();
      fs.writeFileSync(checkpointPath, JSON.stringify(this.checkpoint, null, 2), 'utf-8');
    } catch (error) {
      console.error('[FlowRadar Adapter] 保存 checkpoint 失败:', error);
    }
  }

  /**
   * 获取 checkpoint 文件路径
   */
  private getCheckpointPath(): string {
    return `${process.cwd()}/data/${CONFIG.CHECKPOINT_FILE}`;
  }

  /**
   * 读取 JSONL.gz 文件
   */
  private async readJsonlGz(filePath: string, startOffset: number = 0): Promise<RawSignalEvent[]> {
    const events: RawSignalEvent[] = [];

    return new Promise((resolve, reject) => {
      try {
        const gunzip = zlib.createGunzip();
        const stream = createReadStream(filePath);
        const rl = readline.createInterface({
          input: stream.pipe(gunzip),
          crlfDelay: Infinity,
        });

        let lineNumber = 0;

        rl.on('line', (line) => {
          lineNumber++;
          if (lineNumber <= startOffset) return;

          try {
            const event = JSON.parse(line) as RawSignalEvent;
            // 只处理 signal 和 state 类型
            if (event.type === 'signal' || event.type === 'state') {
              events.push(event);
            }
          } catch {
            // 跳过解析失败的行，记录日志
            console.log(`[FlowRadar Adapter] ⚠️ 跳过无效行 ${lineNumber}`);
          }
        });

        rl.on('close', () => {
          // 更新 checkpoint
          this.checkpoint = {
            filePath,
            lastOffset: lineNumber,
            lastTimestamp: Date.now(),
            processedCount: events.length,
          };
          this.saveCheckpoint();
          resolve(events);
        });

        rl.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 读取普通 JSONL 文件
   */
  private async readJsonl(filePath: string, startOffset: number = 0): Promise<RawSignalEvent[]> {
    const events: RawSignalEvent[] = [];

    return new Promise((resolve, reject) => {
      try {
        const stream = createReadStream(filePath);
        const rl = readline.createInterface({
          input: stream,
          crlfDelay: Infinity,
        });

        let lineNumber = 0;

        rl.on('line', (line) => {
          lineNumber++;
          if (lineNumber <= startOffset) return;

          try {
            const event = JSON.parse(line) as RawSignalEvent;
            if (event.type === 'signal' || event.type === 'state') {
              events.push(event);
            }
          } catch {
            console.log(`[FlowRadar Adapter] ⚠️ 跳过无效行 ${lineNumber}`);
          }
        });

        rl.on('close', () => {
          this.checkpoint = {
            filePath,
            lastOffset: lineNumber,
            lastTimestamp: Date.now(),
            processedCount: events.length,
          };
          this.saveCheckpoint();
          resolve(events);
        });

        rl.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 标准化信号
   */
  private normalizeSignal(event: RawSignalEvent): NormalizedSignal | null {
    try {
      const data = event.data;

      // 过滤 symbol
      if (event.symbol !== CONFIG.TARGET_SYMBOL && event.symbol !== 'DOGE_USDT') {
        return null;
      }

      // 判断信号类型
      let type: 'iceberg' | 'kking' | 'resonance' | 'state';
      let signalType = data.signal_type || '';
      let direction: SignalDirection = data.direction || 'NEUTRAL';
      let priority = SignalPriority.P4;
      let ttl = CONFIG.TTL.DEFAULT;

      // 冰山信号
      if (data.side && (data.cumulative_volume !== undefined || data.refill_count !== undefined)) {
        type = 'iceberg';
        signalType = data.side === 'BUY' ? 'ICEBERG_BUY' : 'ICEBERG_SELL';
        direction = data.side === 'BUY' ? 'LONG' : 'SHORT';
        priority = SignalPriority.P2;

        // 根据冰山级别调整 TTL
        if (data.level === IcebergLevel.CONFIRMED) {
          ttl = CONFIG.TTL.ICEBERG_CONFIRMED;
          priority = SignalPriority.P1; // 确认冰山优先级提升
        } else {
          ttl = CONFIG.TTL.ICEBERG_ACTIVITY;
        }
      }
      // 状态机信号（K神战法）
      else if (data.state || event.type === 'state') {
        type = 'state';
        signalType = data.state || 'unknown';
        ttl = CONFIG.TTL.KKING_STATE;
        priority = SignalPriority.P2;

        // 根据状态判断方向
        switch (data.state) {
          case MarketState.TREND_UP:
          case MarketState.ACCUMULATING:
          case MarketState.WASH_ACCUMULATE:
            direction = 'LONG';
            break;
          case MarketState.TREND_DOWN:
          case MarketState.DISTRIBUTING:
          case MarketState.TRAP_DISTRIBUTION:
            direction = 'SHORT';
            break;
          default:
            direction = 'NEUTRAL';
        }
      }
      // 普通系统信号
      else if (data.signal_type && SIGNAL_TYPES[data.signal_type as SignalType]) {
        type = 'kking';
        signalType = data.signal_type;
        const signalInfo = SIGNAL_TYPES[data.signal_type as SignalType];
        direction = signalInfo.direction;
        priority = signalInfo.priority;
        ttl = CONFIG.TTL.KKING_STATE;
      }
      // 共振信号
      else if (data.source === 'C') {
        type = 'resonance';
        signalType = data.signal_type || 'resonance';
        ttl = CONFIG.TTL.KKING_STATE;
        priority = SignalPriority.P1;
      }
      // 未知类型
      else {
        return null;
      }

      const normalized: NormalizedSignal = {
        id: data.id || `sig_${event.ts}_${Math.random().toString(36).slice(2, 8)}`,
        type,
        signal_type: signalType,
        direction,
        source: data.source || (type === 'iceberg' ? 'I' : 'M'),
        priority,
        strength: data.strength || 50,
        confidence: data.confidence || 50,
        timestamp: event.ts * 1000, // 转换为毫秒
        price: data.price_at_signal || data.price || 0,
        symbol: event.symbol,
        ttl,
        details: data.details || {},
        status: (data.status as SignalStatus) || SignalStatus.ACTIVE,
        // 冰山特有
        iceberg_level: data.level,
        refill_count: data.refill_count,
        // K神特有
        market_state: data.state as MarketState,
      };

      return normalized;
    } catch (error) {
      console.log('[FlowRadar Adapter] ⚠️ 信号标准化失败:', error);
      return null;
    }
  }

  /**
   * 过滤过期信号
   */
  private filterExpiredSignals(signals: NormalizedSignal[]): NormalizedSignal[] {
    const now = Date.now();
    const windowStart = now - CONFIG.SIGNAL_WINDOW_SEC * 1000;

    return signals.filter((signal) => {
      // 检查是否在时间窗口内
      if (signal.timestamp < windowStart) {
        return false;
      }

      // 检查 TTL
      const age = (now - signal.timestamp) / 1000;
      if (age > signal.ttl) {
        return false;
      }

      // 检查最小置信度
      if (signal.confidence < CONFIG.MIN_CONFIDENCE) {
        return false;
      }

      // 检查状态
      if (signal.status === SignalStatus.EXPIRED || signal.status === SignalStatus.INVALIDATED) {
        return false;
      }

      return true;
    });
  }

  /**
   * 计算信号评分
   */
  private calculateSignalScore(signal: NormalizedSignal): number {
    let score = 0;

    // 基础分：置信度
    score += signal.confidence;

    // 优先级加分
    score += (5 - signal.priority) * 10;

    // 冰山 CONFIRMED 加分
    if (signal.iceberg_level === IcebergLevel.CONFIRMED) {
      score += 30;
    }

    // 强度加分
    score += signal.strength * 0.3;

    // 补单次数加分（冰山）
    if (signal.refill_count && signal.refill_count > 2) {
      score += Math.min(signal.refill_count * 5, 25);
    }

    return score;
  }

  /**
   * 排序信号（按优先级和评分）
   */
  private sortSignals(signals: NormalizedSignal[]): NormalizedSignal[] {
    return signals.sort((a, b) => {
      const scoreA = this.calculateSignalScore(a);
      const scoreB = this.calculateSignalScore(b);
      return scoreB - scoreA;
    });
  }

  /**
   * 计算共识
   */
  private calculateConsensus(signals: NormalizedSignal[]): {
    bias: 'bullish' | 'bearish' | 'neutral';
    conflict: boolean;
  } {
    const longSignals = signals.filter((s) => s.direction === 'LONG');
    const shortSignals = signals.filter((s) => s.direction === 'SHORT');

    const longScore = longSignals.reduce((sum, s) => sum + this.calculateSignalScore(s), 0);
    const shortScore = shortSignals.reduce((sum, s) => sum + this.calculateSignalScore(s), 0);

    // 检测冲突：同时有强多和强空信号
    const hasStrongLong = longSignals.some(
      (s) => s.priority <= SignalPriority.P2 && s.confidence >= 70
    );
    const hasStrongShort = shortSignals.some(
      (s) => s.priority <= SignalPriority.P2 && s.confidence >= 70
    );
    const conflict = hasStrongLong && hasStrongShort;

    // 判断偏向
    let bias: 'bullish' | 'bearish' | 'neutral';
    if (conflict) {
      bias = 'neutral';
    } else if (longScore > shortScore * 1.2) {
      bias = 'bullish';
    } else if (shortScore > longScore * 1.2) {
      bias = 'bearish';
    } else {
      bias = 'neutral';
    }

    return { bias, conflict };
  }

  /**
   * 检查趋势一致性
   */
  private checkTrendCongruence(signals: NormalizedSignal[]): boolean {
    // 冰山信号
    const icebergSignals = signals.filter(
      (s) => s.type === 'iceberg' && s.iceberg_level === IcebergLevel.CONFIRMED
    );
    // K神状态信号
    const stateSignals = signals.filter((s) => s.type === 'state');

    if (icebergSignals.length === 0 || stateSignals.length === 0) {
      return false;
    }

    // 获取主要方向
    const icebergDirection = icebergSignals[0]?.direction;
    const stateDirection = stateSignals[0]?.direction;

    // 方向一致 = 趋势共振
    return icebergDirection === stateDirection && icebergDirection !== 'NEUTRAL';
  }

  /**
   * 读取并处理最新信号
   */
  async getSignals(): Promise<FlowRadarSummary | null> {
    if (!this.isAvailable() || !this.eventsPath) {
      return null;
    }

    try {
      // 获取今日事件文件
      let eventFile = getTodayEventFile(this.eventsPath, 'DOGE_USDT');

      // 如果今日没有，获取最新的文件
      if (!eventFile) {
        const latestFiles = getLatestEventFiles(this.eventsPath, 1);
        if (latestFiles.length > 0) {
          eventFile = latestFiles[0];
        }
      }

      if (!eventFile) {
        console.log('[FlowRadar Adapter] ⚠️ 未找到事件文件');
        return null;
      }

      // 确定起始 offset
      let startOffset = 0;
      if (this.checkpoint && this.checkpoint.filePath === eventFile) {
        startOffset = this.checkpoint.lastOffset;
      }

      // 读取事件
      const events = eventFile.endsWith('.gz')
        ? await this.readJsonlGz(eventFile, startOffset)
        : await this.readJsonl(eventFile, startOffset);

      console.log(`[FlowRadar Adapter] 📖 读取 ${events.length} 条新事件`);

      // 标准化信号
      const normalizedSignals = events
        .map((e) => this.normalizeSignal(e))
        .filter((s): s is NormalizedSignal => s !== null);

      // 合并已有信号
      this.signals = [...this.signals, ...normalizedSignals];

      // 过滤过期信号
      this.signals = this.filterExpiredSignals(this.signals);

      // 排序
      this.signals = this.sortSignals(this.signals);

      // 构建摘要
      const summary = this.buildSummary();

      this.lastReadTime = Date.now();
      return summary;
    } catch (error) {
      console.error('[FlowRadar Adapter] ❌ 读取信号失败:', error);
      return null;
    }
  }

  /**
   * 构建信号摘要
   */
  private buildSummary(): FlowRadarSummary {
    const consensus = this.calculateConsensus(this.signals);
    const trendCongruence = this.checkTrendCongruence(this.signals);

    // 冰山摘要
    const icebergSignals = this.signals.filter((s) => s.type === 'iceberg');
    const icebergSummary = icebergSignals.length > 0 ? {
      buy_signals: icebergSignals.filter((s) => s.direction === 'LONG').length,
      sell_signals: icebergSignals.filter((s) => s.direction === 'SHORT').length,
      confirmed_buy: icebergSignals.some(
        (s) => s.direction === 'LONG' && s.iceberg_level === IcebergLevel.CONFIRMED
      ),
      confirmed_sell: icebergSignals.some(
        (s) => s.direction === 'SHORT' && s.iceberg_level === IcebergLevel.CONFIRMED
      ),
    } : undefined;

    // K神摘要
    const stateSignals = this.signals.filter((s) => s.type === 'state');
    const latestState = stateSignals[0];
    const kkingSummary = latestState ? {
      state: latestState.market_state || MarketState.NEUTRAL,
      state_name: this.getStateName(latestState.market_state),
      confidence: latestState.confidence,
      recommendation: this.getStateRecommendation(latestState.market_state),
    } : undefined;

    return {
      as_of: new Date().toISOString(),
      symbol: CONFIG.TARGET_SYMBOL,
      window_sec: CONFIG.SIGNAL_WINDOW_SEC,
      signals: this.signals,
      consensus,
      trend_congruence: trendCongruence,
      iceberg_summary: icebergSummary,
      kking_summary: kkingSummary,
    };
  }

  /**
   * 获取状态名称
   */
  private getStateName(state?: MarketState): string {
    const names: Record<MarketState, string> = {
      [MarketState.NEUTRAL]: '多空博弈',
      [MarketState.ACCUMULATING]: '暗中吸筹',
      [MarketState.DISTRIBUTING]: '暗中出货',
      [MarketState.TREND_UP]: '真实上涨',
      [MarketState.TREND_DOWN]: '真实下跌',
      [MarketState.WASH_ACCUMULATE]: '洗盘吸筹',
      [MarketState.TRAP_DISTRIBUTION]: '诱多出货',
    };
    return state ? names[state] : '未知';
  }

  /**
   * 获取状态建议
   */
  private getStateRecommendation(state?: MarketState): string {
    const recommendations: Record<MarketState, string> = {
      [MarketState.NEUTRAL]: '观望',
      [MarketState.ACCUMULATING]: '可以关注',
      [MarketState.DISTRIBUTING]: '小心',
      [MarketState.TREND_UP]: '可以买入',
      [MarketState.TREND_DOWN]: '不要抄底',
      [MarketState.WASH_ACCUMULATE]: '可以关注',
      [MarketState.TRAP_DISTRIBUTION]: '不要追高',
    };
    return state ? recommendations[state] : '观望';
  }

  /**
   * 获取最后读取时间
   */
  getLastReadTime(): number {
    return this.lastReadTime;
  }

  /**
   * 获取当前信号数量
   */
  getSignalCount(): number {
    return this.signals.length;
  }

  /**
   * 清空信号缓存
   */
  clearSignals(): void {
    this.signals = [];
  }
}

// 单例
let adapterInstance: FlowRadarSignalAdapter | null = null;

export function getFlowRadarAdapter(): FlowRadarSignalAdapter {
  if (!adapterInstance) {
    adapterInstance = new FlowRadarSignalAdapter();
  }
  return adapterInstance;
}
