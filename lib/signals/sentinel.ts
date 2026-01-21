/**
 * Sentinel 实时监听模块
 * 实时监听 Flow-Radar 信号，信号到达时立即处理
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { getMarketContext } from '../market/marketContext';
import { getFlowRadarPath } from '../flowRadar/pathDetector';
import { NormalizedSignal, SignalDirection } from '../flowRadar/types';
import { getPositionStateMachine } from '../trading/positionStateMachine';
import { getOKXClient } from '../okxClient';

// 配置
const SENTINEL_CONFIG = {
  // ========== v1.4 参数升级 ==========

  // 主通道置信度门槛
  MIN_CONFIDENCE: 50,  // v1.3: 从 60% 降至 50%

  // 例外通道配置
  EXCEPTION_CHANNEL: {
    MIN_CONFIDENCE: 40,      // 例外通道最低置信度
    MIN_CONFIRM_RATIO: 0.75, // 最低确认比
    MAX_AGE_SEC: 30,         // 最大信号年龄（秒）
    REQUIRE_CONFIRMED: true, // 必须是 CONFIRMED 级别
  },

  // TTL（秒）
  TTL: {
    ICEBERG_CONFIRMED: 60,
    ICEBERG_DETECTED: 45,
    KKING: 180,
  },

  // 高置信度阈值（用于逆势交易）
  HIGH_CONFIDENCE: 75,

  // 最大滑点
  MAX_SLIPPAGE: 0.003, // 0.3%

  // 文件监听间隔（毫秒）
  WATCH_INTERVAL_MS: 1000,

  // 信号处理冷却（毫秒）
  SIGNAL_COOLDOWN_MS: 30000,

  // 双信号检测配置
  DUAL_SIGNAL: {
    TIME_WINDOW_SEC: 60,
    MIN_CONFIDENCE: 50,  // v1.3: 降至 50%
  },

  // v1.3: 仓位配置
  POSITION: {
    TRIAL_DAY_1_3_PCT: 3,  // 试运行 1-3 天：3%
    TRIAL_DAY_4_7_PCT: 4,  // 试运行 4-7 天：4%
    KGOD_BONUS_PCT: 1,     // v1.4: K神看多加分 +1%
  },

  // v1.3: 试运行开始日期（用于计算当前是第几天）
  TRIAL_START_DATE: '2026-01-19',

  // ========== v1.4 新增配置 ==========

  // EMA20 趋势过滤
  EMA: {
    PERIOD: 20,           // EMA 周期
    MIN_CANDLES: 25,      // 最少需要的 K 线数量
  },

  // 价格确认（止跌反弹）
  PRICE_CONFIRM: {
    OBSERVATION_SEC: 120,    // 观察期最长 120 秒
    REBOUND_PCT: 0.3,        // 反弹 0.3% 确认止跌
    CHECK_INTERVAL_MS: 1000, // 每秒检查一次
  },

  // 反抖动保护
  ANTI_JITTER: {
    PROTECTION_SEC: 15,        // 开仓后 15 秒保护期
    WEAK_BEARISH_THRESHOLD: 90, // 弱 bearish 阈值（<90% 视为弱信号）
  },

  // 下跌速度过滤
  SPEED_FILTER: {
    WINDOW_SEC: 60,       // 60 秒窗口
    MAX_DROP_PCT: 1.5,    // 最大允许跌幅 1.5%
  },
};

// 信号类型
type SignalType = 'ICEBERG_CONFIRMED' | 'ICEBERG_DETECTED' | 'KKING' | 'UNKNOWN';

// K神状态类型
type KGodStatus = 'normal' | 'caution' | 'no_entry' | 'no_entry_close';

// 解析后的信号
interface ParsedSignal {
  type: SignalType;
  direction: SignalDirection;
  confidence: number;
  confirmRatio: number;  // v1.3: 确认比
  kGodStatus: KGodStatus; // v1.3: K神状态
  price: number;
  amount: number;
  timestamp: number;
  raw: any;
}

// 三道闸检查结果
interface GateCheckResult {
  passed: boolean;
  gate: 'signal' | 'execution' | 'environment';
  reason: string;
}

// 交易动作类型
type TradeAction = 'OPEN_LONG' | 'CLOSE_ALL' | 'CLOSE_HALF' | 'TIGHTEN_STOP' | 'NONE';

// 交易决策
interface TradeDecision {
  execute: boolean;
  direction: SignalDirection;
  positionMultiplier: number;
  positionPct?: number;      // v1.3: 实际仓位百分比
  kGodDowngrade?: boolean;   // v1.3: 是否K神降档
  leverage: number;
  reason: string;
  signal: ParsedSignal;
  gateResults: GateCheckResult[];
  action?: TradeAction; // 具体动作类型
}

// 信号历史记录（用于双信号检测）
interface SignalHistoryEntry {
  type: SignalType;
  direction: SignalDirection;
  confidence: number;
  timestamp: number;
}

// v1.3: 冰山统计（用于计算确认比）
interface IcebergStats {
  buyCount: number;
  sellCount: number;
  buyConfirmedCount: number;
  sellConfirmedCount: number;
  lastUpdated: number;
}

// v1.4: 待确认信号（观察模式）
interface PendingSignal {
  timestamp: number;
  triggerPrice: number;
  lowestPrice: number;
  expiresAt: number;
  signal: ParsedSignal;
}

// v1.4: 价格历史记录（用于速度过滤和 EMA 计算）
interface PricePoint {
  price: number;
  timestamp: number;
}

/**
 * Sentinel 实时监听器
 */
class Sentinel {
  private isRunning: boolean = false;
  private watchInterval: NodeJS.Timeout | null = null;
  private lastFileSize: number = 0;
  private lastSignalTime: number = 0;
  private signalFilePath: string | null = null;
  private onTradeCallback: ((decision: TradeDecision) => Promise<void>) | null = null;

  // 🔧 FIX: 信号历史缓冲区（用于双信号检测）
  private signalHistory: SignalHistoryEntry[] = [];

  // v1.3: 冰山统计（用于计算确认比）
  private icebergStats: IcebergStats = {
    buyCount: 0,
    sellCount: 0,
    buyConfirmedCount: 0,
    sellConfirmedCount: 0,
    lastUpdated: 0,
  };
  private readonly ICEBERG_STATS_WINDOW_MS = 5 * 60 * 1000; // 5分钟窗口

  // v1.4: 价格历史（用于 EMA 和速度过滤）
  private priceHistory: PricePoint[] = [];
  private readonly PRICE_HISTORY_MAX_AGE_MS = 5 * 60 * 1000; // 保留 5 分钟

  // v1.4: 待确认信号（观察模式）
  private pendingSignal: PendingSignal | null = null;
  private pendingSignalCheckInterval: NodeJS.Timeout | null = null;

  // v1.4: 上次开仓时间（用于反抖动）
  private lastOpenTime: number = 0;

  // v1.4: EMA20 缓存
  private cachedEMA20: number = 0;
  private ema20LastUpdate: number = 0;

  /**
   * 启动监听
   */
  start(onTrade: (decision: TradeDecision) => Promise<void>): void {
    console.log('\n' + '='.repeat(50));
    console.log('[Sentinel] 🚀 启动信号监听...');
    console.log('='.repeat(50));

    if (this.isRunning) {
      console.log('[Sentinel] ⚠️ 已经在运行');
      return;
    }

    this.onTradeCallback = onTrade;

    // 获取 Flow-Radar 信号文件路径
    console.log('[Sentinel] 🔍 检测 Flow-Radar 路径...');
    const flowRadarPath = getFlowRadarPath();

    if (!flowRadarPath.found) {
      console.error('[Sentinel] ❌ 无法找到 Flow-Radar 项目路径');
      console.error('[Sentinel] 💡 请确保 Flow-Radar 项目存在于以下位置之一:');
      console.error('[Sentinel]    - D:/onedrive/文档/ProjectS/flow-radar');
      console.error('[Sentinel]    - 或设置环境变量 FLOW_RADAR_PATH');
      return;
    }

    console.log(`[Sentinel] 📂 Flow-Radar 路径: ${flowRadarPath.path}`);
    console.log(`[Sentinel]    signals 目录: ${flowRadarPath.signalsPath || '无'}`);
    console.log(`[Sentinel]    events 目录: ${flowRadarPath.eventsPath || '无'}`);

    // 🔧 FIX: 优先使用 signalsPath（schema v2 格式），回退到 eventsPath
    // 🔧 FIX: 使用本地时间而不是 UTC 时间
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (flowRadarPath.signalsPath) {
      const signalFile = `${today}.jsonl`;
      this.signalFilePath = path.join(flowRadarPath.signalsPath, signalFile);
      console.log(`[Sentinel] 📁 使用 signals 目录 (schema v2)`);
    } else if (flowRadarPath.eventsPath) {
      const signalFile = `DOGE_USDT_${today}.jsonl`;
      this.signalFilePath = path.join(flowRadarPath.eventsPath, signalFile);
      console.log(`[Sentinel] 📁 使用 events 目录 (旧格式)`);
    } else {
      console.error('[Sentinel] ❌ 无法找到 Flow-Radar 信号路径');
      return;
    }

    // 检查文件是否存在并统计信号数量
    let signalCount = 0;
    if (fs.existsSync(this.signalFilePath)) {
      try {
        const content = fs.readFileSync(this.signalFilePath, 'utf-8');
        signalCount = content.split('\n').filter(line => line.trim()).length;
        console.log(`[Sentinel] 📊 读取到 ${signalCount} 条历史信号`);
      } catch (e) {
        console.log(`[Sentinel] ⚠️ 读取信号文件失败: ${e}`);
      }
    } else {
      // 尝试 .gz 文件
      const gzFile = this.signalFilePath + '.gz';
      if (fs.existsSync(gzFile)) {
        console.log(`[Sentinel] 📁 找到压缩信号文件: ${gzFile}`);
        console.log(`[Sentinel] ⚠️ 暂不支持 .gz 文件，等待非压缩文件`);
      } else {
        console.log(`[Sentinel] ⚠️ 未找到信号文件: ${this.signalFilePath}`);
        console.log(`[Sentinel] ⏳ 将等待新信号文件创建...`);
      }
    }

    this.isRunning = true;
    console.log(`[Sentinel] ✅ 信号监听已启动`);
    console.log(`[Sentinel] 📁 监听文件: ${this.signalFilePath}`);
    console.log(`[Sentinel] ⏱️  检查间隔: ${SENTINEL_CONFIG.WATCH_INTERVAL_MS}ms`);
    console.log(`[Sentinel] ❄️  信号冷却: ${SENTINEL_CONFIG.SIGNAL_COOLDOWN_MS}ms`);
    console.log('='.repeat(50) + '\n');

    // 🔧 FIX: 启动时处理最近的信号（最后 10 条）
    try {
      const stats = fs.statSync(this.signalFilePath);
      this.lastFileSize = stats.size;

      // 读取最后 10KB 的数据来获取最近的信号
      const readSize = Math.min(10240, stats.size); // 最多 10KB
      const startPos = Math.max(0, stats.size - readSize);

      console.log(`[Sentinel] 🔄 处理启动前的最近信号...`);
      const fd = fs.openSync(this.signalFilePath, 'r');
      const buffer = Buffer.alloc(readSize);
      fs.readSync(fd, buffer, 0, readSize, startPos);
      fs.closeSync(fd);

      const content = buffer.toString('utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      // 只处理最后 5 条信号
      const recentLines = lines.slice(-5);
      console.log(`[Sentinel] 📊 找到 ${recentLines.length} 条最近信号`);

      for (const line of recentLines) {
        try {
          const rawSignal = JSON.parse(line);
          // 检查是否是最近 60 秒内的信号
          const signalTime = new Date(rawSignal.timestamp).getTime();
          const age = (Date.now() - signalTime) / 1000;

          if (age < 60) {
            console.log(`[Sentinel] 🔔 处理启动前信号 (${age.toFixed(0)}秒前)`);
            // 异步处理，不阻塞启动
            this.processSignalLine(line).catch(e => console.error('[Sentinel] 处理信号失败:', e));
          } else {
            console.log(`[Sentinel] ⏭️ 跳过旧信号 (${age.toFixed(0)}秒前)`);
          }
        } catch (e) {
          // 解析失败，跳过
        }
      }
    } catch (e) {
      this.lastFileSize = 0;
      console.log(`[Sentinel] ⚠️ 无法读取历史信号: ${e}`);
    }

    // 开始监听
    this.watchInterval = setInterval(() => {
      this.checkForNewSignals();
    }, SENTINEL_CONFIG.WATCH_INTERVAL_MS);
  }

  /**
   * 停止监听
   */
  stop(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    this.isRunning = false;
    console.log('[Sentinel] 🛑 监听已停止');
  }

  /**
   * 检查新信号
   */
  private async checkForNewSignals(): Promise<void> {
    if (!this.signalFilePath) return;

    try {
      // 检查文件是否存在
      if (!fs.existsSync(this.signalFilePath)) {
        return;
      }

      const stats = fs.statSync(this.signalFilePath);
      const currentSize = stats.size;

      // 文件没有变化
      if (currentSize <= this.lastFileSize) {
        return;
      }

      // 读取新增的内容
      const newLines = await this.readNewLines(this.lastFileSize, currentSize);
      this.lastFileSize = currentSize;

      // 处理每行信号
      for (const line of newLines) {
        if (line.trim()) {
          await this.processSignalLine(line);
        }
      }
    } catch (error) {
      // 文件可能正在写入，忽略错误
    }
  }

  /**
   * 读取文件新增的行
   */
  private async readNewLines(startPos: number, endPos: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const lines: string[] = [];
      let isFirstLine = startPos > 0; // 如果不是从头读，第一行可能是部分行

      const stream = fs.createReadStream(this.signalFilePath!, {
        start: startPos,
        end: endPos - 1,
        encoding: 'utf-8',
      });

      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        // 🔧 FIX: 跳过第一行（可能是部分行）和不以 { 开头的行
        if (isFirstLine) {
          isFirstLine = false;
          // 检查是否是完整的 JSON 行（以 { 开头）
          if (!line.trim().startsWith('{')) {
            console.log(`[Sentinel] ⏭️ 跳过部分行: ${line.substring(0, 50)}...`);
            return;
          }
        }
        lines.push(line);
      });

      rl.on('close', () => {
        resolve(lines);
      });

      rl.on('error', reject);
    });
  }

  // 🔧 交易相关的信号类型（只处理这些）
  private static TRADING_SIGNAL_TYPES = [
    'iceberg_detected',
    'iceberg_confirmed',
    'iceberg',
    'k_god_buy',
    'k_god_sell',
    'kking',
    'state',
  ];

  /**
   * 处理信号行
   */
  private async processSignalLine(line: string): Promise<void> {
    try {
      const rawSignal = JSON.parse(line);

      // 🔧 FIX: 早期过滤非交易信号（静默跳过，不打印日志）
      const signalType = rawSignal.signal_type || rawSignal.type || '';
      const isTradingSignal = Sentinel.TRADING_SIGNAL_TYPES.some(t =>
        signalType.toLowerCase().includes(t.toLowerCase())
      );
      if (!isTradingSignal) {
        return; // 静默跳过 price_tracking 等非交易信号
      }

      // 🔍 DEBUG: 只对交易信号打印日志
      console.log(`[Sentinel] 📨 交易信号: type=${signalType}, dir=${rawSignal.direction}, conf=${rawSignal.confidence}, level=${rawSignal.data?.level}`);

      const signal = this.parseSignal(rawSignal);

      if (!signal) {
        console.log(`[Sentinel] ⏭️ 信号被过滤 (非DOGE或类型无效)`);
        return;
      }

      console.log(`[Sentinel] ✅ 解析成功: type=${signal.type}, dir=${signal.direction}, conf=${signal.confidence}%`);

      // v1.3: 更新冰山统计（即使在冷却期也要更新）
      this.updateIcebergStats(signal);

      // v1.3: 如果信号没有 confirmRatio，使用计算值
      if (!signal.confirmRatio || signal.confirmRatio === 0) {
        signal.confirmRatio = this.calculateConfirmRatio();
      }

      // 检查冷却期
      const now = Date.now();
      if (now - this.lastSignalTime < SENTINEL_CONFIG.SIGNAL_COOLDOWN_MS) {
        console.log(`[Sentinel] ⏳ 信号冷却中，跳过 (确认比: ${signal.confirmRatio.toFixed(2)})`);
        return;
      }

      // 记录信号
      console.log(`[Sentinel] 📡 收到信号: ${signal.type} ${signal.direction} @ ${signal.price}`);
      console.log(`[Sentinel]    置信度: ${signal.confidence}%, 确认比: ${signal.confirmRatio.toFixed(2)}, K神: ${signal.kGodStatus}`);

      // 运行三道闸检查
      const decision = await this.evaluateSignal(signal);

      // 记录决策
      this.logDecision(decision);

      // 如果决策是执行，触发回调
      if (decision.execute && this.onTradeCallback) {
        this.lastSignalTime = now;
        await this.onTradeCallback(decision);
      }
    } catch (error) {
      // 🔧 FIX: 打印解析错误用于调试
      console.log(`[Sentinel] ❌ JSON解析失败: ${(error as Error).message}`);
      console.log(`[Sentinel] ❌ 原始内容: ${line.substring(0, 100)}...`);
    }
  }

  /**
   * 解析原始信号
   */
  private parseSignal(raw: any): ParsedSignal | null {
    // 🔧 FIX: 支持两种格式
    // Schema v2 (signals/): {"signal_type": "iceberg_detected", "direction": "bullish", "confidence": 85, ...}
    // 旧格式 (events/): {"type": "iceberg", "ts": ..., "data": {...}}

    // 过滤非 DOGE 信号（signals 文件包含多个币种）
    const symbol = raw.symbol || '';
    if (symbol && !symbol.includes('DOGE')) {
      return null; // 跳过非 DOGE 信号
    }

    const eventType = raw.signal_type || raw.event_type || raw.type || '';
    const data = raw.data || {};

    let type: SignalType = 'UNKNOWN';
    let direction: SignalDirection = 'NEUTRAL';
    let confidence = raw.confidence || 0; // Schema v2 的 confidence 在顶层

    // 🔧 FIX: Schema v2 的 direction 字段直接是 "bullish"/"bearish"
    const rawDirection = raw.direction || '';
    if (rawDirection === 'bullish') {
      direction = 'LONG';
    } else if (rawDirection === 'bearish') {
      direction = 'SHORT';
    }

    // 冰山单信号
    if (eventType === 'iceberg' || eventType.includes('iceberg') || eventType.includes('ICEBERG')) {
      // 检查 level 字段（在 data 中）
      const level = data.level || raw.level || '';
      if (level === 'CONFIRMED' || level === 'confirmed_iceberg' || eventType.includes('CONFIRMED')) {
        type = 'ICEBERG_CONFIRMED';
        if (!confidence) confidence = data.confidence || 70;
      } else {
        type = 'ICEBERG_DETECTED';
        if (!confidence) confidence = data.confidence || 50;
      }

      // 判断方向（如果还没从 rawDirection 获取）
      if (direction === 'NEUTRAL') {
        const side = data.side || raw.side || '';
        if (side === 'buy' || side === 'BUY' || eventType.includes('BUY')) {
          direction = 'LONG';
        } else if (side === 'sell' || side === 'SELL' || eventType.includes('SELL')) {
          direction = 'SHORT';
        }
      }
    }

    // 状态机信号（K神战法）
    if (eventType === 'state') {
      type = 'KKING';
      confidence = data.confidence || 50;

      // 从状态判断方向
      const state = data.state || '';
      if (state === 'trend_up' || state === 'accumulating' || state === 'wash_accumulate') {
        direction = 'LONG';
      } else if (state === 'trend_down' || state === 'distributing' || state === 'trap_distribution') {
        direction = 'SHORT';
      }
      // neutral 状态保持 NEUTRAL
    }

    // K神战法信号（旧格式兼容）
    if (eventType.includes('kking') || eventType.includes('KKING') || eventType.includes('K神')) {
      type = 'KKING';
      confidence = raw.confidence || data.confidence || 60;

      if (raw.direction === 'bullish' || raw.signal === 'BUY') {
        direction = 'LONG';
      } else if (raw.direction === 'bearish' || raw.signal === 'SELL') {
        direction = 'SHORT';
      }
    }

    // 综合判断信号
    if (eventType.includes('综合') || eventType.includes('alert')) {
      // 从综合信号中提取置信度
      confidence = raw.confidence || data.confidence || raw.置信度 || 50;

      if (raw.bias === 'bullish' || raw.direction === 'bullish' || raw.建议?.includes('买') || raw.建议?.includes('多')) {
        direction = 'LONG';
        type = 'ICEBERG_CONFIRMED';
      } else if (raw.bias === 'bearish' || raw.direction === 'bearish' || raw.建议?.includes('卖') || raw.建议?.includes('空')) {
        direction = 'SHORT';
        type = 'ICEBERG_CONFIRMED';
      }
    }

    if (type === 'UNKNOWN' || direction === 'NEUTRAL') {
      return null;
    }

    // 🔧 FIX: 解析 timestamp（支持 Unix 时间戳和 ISO 字符串）
    let timestamp: number;
    if (raw.ts) {
      // 旧格式：Unix 秒级时间戳
      timestamp = raw.ts * 1000;
    } else if (raw.timestamp) {
      // Schema v2：ISO 字符串格式 "2026-01-19T22:27:32.879217+00:00"
      timestamp = typeof raw.timestamp === 'string'
        ? new Date(raw.timestamp).getTime()
        : raw.timestamp;
    } else {
      timestamp = Date.now();
    }

    // v1.3: 提取确认比
    const confirmRatio = raw.confirm_ratio || raw.confirmRatio || data.confirm_ratio || 0;

    // v1.3: 提取K神状态
    let kGodStatus: KGodStatus = 'normal';
    const kGodRaw = raw.k_god_status || raw.kgod_status || raw.kGodStatus || data.k_god_status || '';
    if (kGodRaw.includes('禁入/平仓') || kGodRaw === 'no_entry_close') {
      kGodStatus = 'no_entry_close';
    } else if (kGodRaw.includes('禁入') || kGodRaw === 'no_entry') {
      kGodStatus = 'no_entry';
    } else if (kGodRaw.includes('谨慎') || kGodRaw === 'caution') {
      kGodStatus = 'caution';
    }

    return {
      type,
      direction,
      confidence,
      confirmRatio,
      kGodStatus,
      price: data.price || raw.price || raw.价格 || 0,
      amount: data.amount || data.cumulative_volume || raw.amount || raw.金额 || 0,
      timestamp,
      raw,
    };
  }

  /**
   * 🔧 FIX: 记录信号到历史缓冲区
   */
  private recordSignalToHistory(signal: ParsedSignal): void {
    const entry: SignalHistoryEntry = {
      type: signal.type,
      direction: signal.direction,
      confidence: signal.confidence,
      timestamp: signal.timestamp,
    };

    this.signalHistory.push(entry);

    // 清理过期的历史记录（保留最近 2 分钟的）
    const cutoffTime = Date.now() - 120 * 1000;
    this.signalHistory = this.signalHistory.filter(s => s.timestamp >= cutoffTime);
  }

  /**
   * 🔧 FIX: 检测双信号（冰山+K神在时间窗口内同向）
   *
   * 正确逻辑：
   * - "双信号"指的是：冰山信号和K神信号在 60 秒时间窗口内同时出现且方向相同
   * - 需要检查历史记录中是否有另一类型的同向信号
   *
   * @param currentSignal 当前信号
   * @returns { isDualSignal: boolean, details: string }
   */
  private checkDualSignal(currentSignal: ParsedSignal): {
    isDualSignal: boolean;
    details: string;
    icebergSignal?: SignalHistoryEntry;
    kkingSignal?: SignalHistoryEntry;
  } {
    const now = Date.now();
    const timeWindow = SENTINEL_CONFIG.DUAL_SIGNAL.TIME_WINDOW_SEC * 1000;
    const minConfidence = SENTINEL_CONFIG.DUAL_SIGNAL.MIN_CONFIDENCE;

    // 获取时间窗口内的同向信号
    const recentSignals = this.signalHistory.filter(s =>
      s.direction === currentSignal.direction &&
      s.confidence >= minConfidence &&
      (now - s.timestamp) <= timeWindow
    );

    // 检查是否有冰山信号
    const hasIceberg = recentSignals.some(s =>
      s.type === 'ICEBERG_CONFIRMED'
    ) || currentSignal.type === 'ICEBERG_CONFIRMED';

    // 检查是否有K神信号
    const hasKKing = recentSignals.some(s =>
      s.type === 'KKING'
    ) || currentSignal.type === 'KKING';

    // 获取具体的信号记录（用于日志）
    const icebergSignal = currentSignal.type === 'ICEBERG_CONFIRMED'
      ? { type: currentSignal.type, direction: currentSignal.direction, confidence: currentSignal.confidence, timestamp: currentSignal.timestamp }
      : recentSignals.find(s => s.type === 'ICEBERG_CONFIRMED');

    const kkingSignal = currentSignal.type === 'KKING'
      ? { type: currentSignal.type, direction: currentSignal.direction, confidence: currentSignal.confidence, timestamp: currentSignal.timestamp }
      : recentSignals.find(s => s.type === 'KKING');

    const isDualSignal = hasIceberg && hasKKing;

    // 构建详细信息
    let details = '';
    if (isDualSignal) {
      const icebergAge = icebergSignal ? ((now - icebergSignal.timestamp) / 1000).toFixed(0) : '?';
      const kkingAge = kkingSignal ? ((now - kkingSignal.timestamp) / 1000).toFixed(0) : '?';
      details = `冰山(${icebergAge}s前, ${icebergSignal?.confidence}%) + K神(${kkingAge}s前, ${kkingSignal?.confidence}%) 同向 ${currentSignal.direction}`;
    } else if (hasIceberg && !hasKKing) {
      details = `仅冰山信号，无K神配合 (窗口内${recentSignals.length}条同向信号)`;
    } else if (!hasIceberg && hasKKing) {
      details = `仅K神信号，无冰山配合 (窗口内${recentSignals.length}条同向信号)`;
    } else {
      details = `无有效信号 (窗口内${recentSignals.length}条同向信号)`;
    }

    // 📊 记录双信号检测日志
    console.log(`[Sentinel] 🔍 双信号检测: ${isDualSignal ? '✅ 是' : '❌ 否'} - ${details}`);

    return {
      isDualSignal,
      details,
      icebergSignal,
      kkingSignal,
    };
  }

  /**
   * 评估信号（三道闸 + 只做多规则）
   * Phase 1：只做多，bearish 信号只记录影子空单
   */
  private async evaluateSignal(signal: ParsedSignal): Promise<TradeDecision> {
    const gateResults: GateCheckResult[] = [];
    const ctx = getMarketContext();
    const stateMachine = getPositionStateMachine();

    // 🔧 FIX: 先记录信号到历史（用于双信号检测）
    this.recordSignalToHistory(signal);

    // 更新价格（用于防追涨和影子空单）
    if (signal.price > 0) {
      stateMachine.updatePrice(signal.price);
    }

    // ========== 方向分流：Phase 1 只做多 ==========
    if (signal.direction === 'NEUTRAL') {
      return {
        execute: false,
        direction: signal.direction,
        positionMultiplier: 0,
        leverage: 2,
        reason: '信号方向为 NEUTRAL，跳过',
        signal,
        gateResults,
      };
    }

    // ========== SHORT 信号：不开空，交给状态机处理（可能平仓或记录影子空单）==========
    if (signal.direction === 'SHORT') {
      // v1.4: 反抖动保护检查
      const antiJitterCheck = this.checkAntiJitter(signal.confidence);
      if (!antiJitterCheck.allowed) {
        console.log(`[Sentinel] 🛡️ 反抖动保护: ${antiJitterCheck.reason}`);
        return {
          execute: false,
          direction: signal.direction,
          positionMultiplier: 0,
          leverage: 2,
          reason: `[反抖动保护] ${antiJitterCheck.reason}`,
          signal,
          gateResults,
        };
      }

      // 🔧 FIX: 正确的双信号检测逻辑
      // 旧代码 BUG: const isDualSignal = signal.type === 'ICEBERG_CONFIRMED' && signal.confidence >= 70;
      // 这把单个高置信度信号误判为"双信号"，导致状态机疯狂震荡
      // 正确逻辑: 检查时间窗口内是否有冰山+K神同向信号
      const dualSignalCheck = this.checkDualSignal(signal);
      const isDualSignal = dualSignalCheck.isDualSignal;

      console.log(`[Sentinel] 📊 Bearish 信号处理: type=${signal.type}, confidence=${signal.confidence}%, isDualSignal=${isDualSignal}`);
      if (isDualSignal) {
        console.log(`[Sentinel] ⚠️ 双信号确认: ${dualSignalCheck.details}`);
      }

      const bearishResult = stateMachine.handleBearishSignal(signal.price, {
        type: signal.type,
        confidence: signal.confidence,
        isDualSignal,
      });

      // 如果需要平仓，返回平仓决策
      if (bearishResult.action === 'CLOSE_ALL' || bearishResult.action === 'CLOSE_HALF') {
        return {
          execute: true,
          direction: 'SHORT', // 表示平多方向
          positionMultiplier: bearishResult.action === 'CLOSE_ALL' ? 1.0 : 0.5,
          leverage: 2,
          reason: `[平仓] ${bearishResult.reason}`,
          signal,
          gateResults,
          action: bearishResult.action, // 附加动作类型
        };
      }

      // 不需要操作，仅记录
      return {
        execute: false,
        direction: signal.direction,
        positionMultiplier: 0,
        leverage: 2,
        reason: `[Phase 1 只做多] ${bearishResult.reason}`,
        signal,
        gateResults,
      };
    }

    // ========== LONG 信号：v1.4 增强检查 ==========

    // v1.4: 更新价格历史
    if (signal.price > 0) {
      this.updatePriceHistory(signal.price);
    }

    // v1.4: 检查是否已有待确认信号
    if (this.pendingSignal) {
      console.log(`[Signal] ⏳ 已有待确认信号，忽略新信号`);
      return {
        execute: false,
        direction: signal.direction,
        positionMultiplier: 0,
        leverage: 2,
        reason: '已有待确认信号在观察中',
        signal,
        gateResults,
      };
    }

    // 闸 1: 信号闸
    const gate1 = this.checkGate1_Signal(signal);
    gateResults.push(gate1);

    if (!gate1.passed) {
      return {
        execute: false,
        direction: signal.direction,
        positionMultiplier: 0,
        leverage: 2,
        reason: gate1.reason,
        signal,
        gateResults,
      };
    }

    // 闸 2: 执行闸
    const gate2 = await this.checkGate2_Execution(signal);
    gateResults.push(gate2);

    if (!gate2.passed) {
      return {
        execute: false,
        direction: signal.direction,
        positionMultiplier: 0,
        leverage: 2,
        reason: gate2.reason,
        signal,
        gateResults,
      };
    }

    // 闸 3: 环境闸
    const gate3 = this.checkGate3_Environment();
    gateResults.push(gate3);

    if (!gate3.passed) {
      return {
        execute: false,
        direction: signal.direction,
        positionMultiplier: 0,
        leverage: 2,
        reason: gate3.reason,
        signal,
        gateResults,
      };
    }

    // ========== v1.4: EMA20 趋势过滤 ==========
    const currentPrice = signal.price;
    const ema20 = await this.calculateEMA20();

    if (ema20 !== null) {
      console.log(`[EMA] 📊 DOGE EMA20: $${ema20.toFixed(5)}, 当前价: $${currentPrice.toFixed(5)}`);

      if (currentPrice < ema20) {
        console.log(`[EMA] ❌ 价格低于 EMA20，不允许开多`);
        return {
          execute: false,
          direction: signal.direction,
          positionMultiplier: 0,
          leverage: 2,
          reason: `价格 $${currentPrice.toFixed(5)} < EMA20 $${ema20.toFixed(5)}，趋势向下，不允许开多`,
          signal,
          gateResults,
        };
      }
      console.log(`[EMA] ✅ 价格高于 EMA20，趋势过滤通过`);
    } else {
      console.log(`[EMA] ⚠️ 无法计算 EMA20，跳过趋势检查`);
    }

    // ========== v1.4: 下跌速度过滤 ==========
    const speedCheck = this.checkSpeedFilter(currentPrice);
    if (!speedCheck.allowed) {
      return {
        execute: false,
        direction: signal.direction,
        positionMultiplier: 0,
        leverage: 2,
        reason: speedCheck.reason,
        signal,
        gateResults,
      };
    }

    // ========== 🔧 FIX: 开仓前验证 OKX 实际仓位 ==========
    console.log(`[Sentinel] 🔄 验证 OKX 实际仓位...`);
    console.log(`[Sentinel] 📊 状态机当前状态: ${stateMachine.getState()}`);

    // 如果状态机显示 LONG，验证 OKX 是否真的有仓位
    if (stateMachine.getState() === 'LONG') {
      try {
        const okxClient = getOKXClient();
        if (okxClient.isAvailable()) {
          const positions = await okxClient.getPositions();
          const dogePositions = positions.filter((p: any) =>
            p.instId?.includes('DOGE') && Math.abs(parseFloat(p.pos || '0')) > 0
          );

          if (dogePositions.length === 0) {
            console.log(`[Sentinel] ⚠️ 状态不同步! 状态机=LONG 但 OKX 无仓位，重置为 FLAT`);
            stateMachine.reset('OKX 验证: 实际无仓位');
          } else {
            console.log(`[Sentinel] ✅ OKX 确认有仓位，状态机 LONG 正确`);
          }
        }
      } catch (e) {
        console.log(`[Sentinel] ⚠️ OKX 验证失败: ${(e as Error).message}，假设状态机正确`);
      }
    }

    // ========== 状态机检查：是否可以开多 ==========
    const canOpen = stateMachine.canOpenLong(signal.price, {
      confidence: signal.confidence,
      type: signal.type,
    });

    console.log(`[Sentinel] 📊 canOpenLong 结果: allowed=${canOpen.allowed}, reason=${canOpen.reason}`);

    if (!canOpen.allowed) {
      return {
        execute: false,
        direction: signal.direction,
        positionMultiplier: 0,
        leverage: 2,
        reason: canOpen.reason,
        signal,
        gateResults,
      };
    }

    // ========== v1.4: 进入观察模式（等待止跌反弹） ==========
    // 不立即开仓，而是进入观察模式等待确认
    console.log(`[Signal] 🎯 信号通过所有检查，进入观察模式等待止跌反弹确认`);
    this.enterObservationMode(signal, currentPrice);

    // 返回不执行（实际开仓在 checkPendingSignal 确认后触发）
    return {
      execute: false,
      direction: signal.direction,
      positionMultiplier: 0,
      leverage: 2,
      reason: `进入观察模式，等待 ${SENTINEL_CONFIG.PRICE_CONFIRM.REBOUND_PCT}% 反弹确认`,
      signal,
      gateResults,
    };
  }

  /**
   * 闸 1: 信号闸 (v1.3 升级)
   */
  private checkGate1_Signal(signal: ParsedSignal): GateCheckResult & { channel?: string } {
    const age = (Date.now() - signal.timestamp) / 1000;
    const exc = SENTINEL_CONFIG.EXCEPTION_CHANNEL;

    // ========== v1.3: 双通道置信度检查 ==========

    // 主通道：confidence >= 50%
    const mainChannelPass = signal.confidence >= SENTINEL_CONFIG.MIN_CONFIDENCE;

    // 例外通道：confidence >= 40% AND confirmRatio > 0.75 AND CONFIRMED AND age < 30s
    const exceptionChannelPass =
      signal.confidence >= exc.MIN_CONFIDENCE &&
      signal.confirmRatio > exc.MIN_CONFIRM_RATIO &&
      signal.type === 'ICEBERG_CONFIRMED' &&
      age < exc.MAX_AGE_SEC;

    // 📊 v1.3: 详细日志
    console.log(`[Signal] 📊 置信度: ${signal.confidence}%, 确认比: ${signal.confirmRatio.toFixed(2)}, 年龄: ${age.toFixed(0)}s`);
    console.log(`[Signal] 📊 主通道: ${mainChannelPass ? '✅ 通过' : '❌ 不通过'} (需要 ${SENTINEL_CONFIG.MIN_CONFIDENCE}%+)`);
    console.log(`[Signal] 📊 例外通道: ${exceptionChannelPass ? '✅ 通过' : '❌ 不通过'} (需要 ${exc.MIN_CONFIDENCE}%+, 确认比>${exc.MIN_CONFIRM_RATIO}, CONFIRMED, <${exc.MAX_AGE_SEC}s)`);

    // 检查是否通过任一通道
    if (!mainChannelPass && !exceptionChannelPass) {
      return {
        passed: false,
        gate: 'signal',
        reason: `置信度不足: ${signal.confidence}% (主通道需 ${SENTINEL_CONFIG.MIN_CONFIDENCE}%+, 例外通道需确认比 ${exc.MIN_CONFIRM_RATIO}+)`,
      };
    }

    const channelUsed = mainChannelPass ? '主通道' : '例外通道';
    console.log(`[Signal] ✅ 通过 ${channelUsed}`);

    // 检查 TTL
    let maxTTL = SENTINEL_CONFIG.TTL.ICEBERG_DETECTED;

    if (signal.type === 'ICEBERG_CONFIRMED') {
      maxTTL = SENTINEL_CONFIG.TTL.ICEBERG_CONFIRMED;
    } else if (signal.type === 'KKING') {
      maxTTL = SENTINEL_CONFIG.TTL.KKING;
    }

    if (age > maxTTL) {
      return {
        passed: false,
        gate: 'signal',
        reason: `信号已过期: ${age.toFixed(0)}s > ${maxTTL}s`,
      };
    }

    // v1.3: 主通道允许 DETECTED 和 CONFIRMED
    // 例外通道只允许 CONFIRMED（已在 exceptionChannelPass 条件中检查）
    // 🔧 FIX: 主通道通过时，不管 level 是什么都允许
    if (signal.type === 'ICEBERG_DETECTED' && !mainChannelPass) {
      return {
        passed: false,
        gate: 'signal',
        reason: `冰山 DETECTED 级别需要主通道置信度 ${SENTINEL_CONFIG.MIN_CONFIDENCE}%+ (当前 ${signal.confidence}%)`,
      };
    }

    return {
      passed: true,
      gate: 'signal',
      reason: `信号闸通过 (${channelUsed})`,
      channel: channelUsed,
    };
  }

  /**
   * 闸 2: 执行闸
   */
  private async checkGate2_Execution(signal: ParsedSignal): Promise<GateCheckResult> {
    // TODO: 检查滑点和流动性
    // 这里需要实际的订单簿数据

    // 暂时默认通过
    return {
      passed: true,
      gate: 'execution',
      reason: '执行闸通过',
    };
  }

  /**
   * 闸 3: 环境闸
   */
  private checkGate3_Environment(): GateCheckResult {
    const ctx = getMarketContext();
    const ctxData = ctx.get();

    // 检查是否允许交易
    if (!ctxData.trade_allowed) {
      return {
        passed: false,
        gate: 'environment',
        reason: `交易已禁止 (风险模式: ${ctxData.risk_mode})`,
      };
    }

    // 检查风险模式
    if (ctxData.risk_mode === 'paused') {
      return {
        passed: false,
        gate: 'environment',
        reason: '系统处于 PAUSED 状态',
      };
    }

    // 检查 FlowRadar 心跳
    try {
      const { getFlowRadarHeartbeat } = require('../flowRadar/heartbeat');
      const heartbeat = getFlowRadarHeartbeat();

      if (!heartbeat.canOpenPosition()) {
        return {
          passed: false,
          gate: 'environment',
          reason: `心跳状态不允许开仓: ${heartbeat.getStatusDescription()}`,
        };
      }
    } catch (e) {
      // 忽略，继续
    }

    return {
      passed: true,
      gate: 'environment',
      reason: '环境闸通过',
    };
  }

  /**
   * 记录决策日志
   */
  private logDecision(decision: TradeDecision): void {
    const ctx = getMarketContext();
    const timestamp = new Date().toISOString();
    const localTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log(`[Sentinel] 📋 信号决策报告 @ ${localTime}`);
    console.log('───────────────────────────────────────');
    console.log(`信号类型: ${decision.signal.type}`);
    console.log(`信号方向: ${decision.signal.direction}`);
    console.log(`置信度: ${decision.signal.confidence}%`);
    console.log(`价格: ${decision.signal.price}`);
    console.log('───────────────────────────────────────');
    console.log(`三道闸检查:`);
    decision.gateResults.forEach((gate, i) => {
      console.log(`  闸${i + 1} [${gate.gate}]: ${gate.passed ? '✅ 通过' : '❌ 未通过'} - ${gate.reason}`);
    });
    console.log('───────────────────────────────────────');
    console.log(`市场上下文: ${ctx.getSummary()}`);
    console.log('───────────────────────────────────────');
    console.log(`最终决策: ${decision.execute ? '✅ 执行' : '❌ 跳过'}`);
    console.log(`原因: ${decision.reason}`);
    if (decision.execute) {
      console.log(`仓位比例: ${(decision.positionMultiplier * 100).toFixed(0)}%`);
      console.log(`杠杆: ${decision.leverage}x`);
    }
    console.log('═══════════════════════════════════════');
    console.log('');

    // 📝 持久化日志到文件
    this.writeLogToFile(decision, timestamp, localTime);
  }

  /**
   * 📝 写入日志到文件
   */
  private writeLogToFile(decision: TradeDecision, timestamp: string, localTime: string): void {
    try {
      const logDir = path.join(process.cwd(), 'storage', 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(logDir, `sentinel_${today}.jsonl`);

      const logEntry = {
        timestamp,
        localTime,
        signal: {
          type: decision.signal.type,
          direction: decision.signal.direction,
          confidence: decision.signal.confidence,
          price: decision.signal.price,
        },
        gates: decision.gateResults.map(g => ({
          gate: g.gate,
          passed: g.passed,
          reason: g.reason,
        })),
        decision: {
          execute: decision.execute,
          reason: decision.reason,
          action: decision.action || null,
          positionMultiplier: decision.positionMultiplier,
          leverage: decision.leverage,
        },
      };

      fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('[Sentinel] ⚠️ 写入日志失败:', error);
    }
  }

  /**
   * 检查是否在运行
   */
  isActive(): boolean {
    return this.isRunning;
  }

  // ========== v1.4: 新增方法 ==========

  /**
   * v1.4: 更新价格历史
   */
  updatePriceHistory(price: number): void {
    const now = Date.now();
    this.priceHistory.push({ price, timestamp: now });

    // 清理过期数据
    const cutoff = now - this.PRICE_HISTORY_MAX_AGE_MS;
    this.priceHistory = this.priceHistory.filter(p => p.timestamp >= cutoff);
  }

  /**
   * v1.4: 计算 EMA20
   * 使用最近的价格数据计算 EMA20
   */
  async calculateEMA20(): Promise<number | null> {
    // 如果缓存有效（10秒内），直接返回
    if (this.cachedEMA20 > 0 && Date.now() - this.ema20LastUpdate < 10000) {
      return this.cachedEMA20;
    }

    try {
      // 尝试从 OKX API 获取 K 线数据
      const okxClient = getOKXClient();
      if (!okxClient.isAvailable()) {
        console.log('[EMA] ⚠️ OKX 客户端不可用，使用本地价格计算');
        return this.calculateEMA20FromLocal();
      }

      // 获取最近 30 根 1 分钟 K 线
      const candles = await okxClient.getCandles('DOGE-USDT-SWAP', '1m', 30);

      if (!candles || candles.length < SENTINEL_CONFIG.EMA.MIN_CANDLES) {
        console.log(`[EMA] ⚠️ K 线数据不足 (${candles?.length || 0} < ${SENTINEL_CONFIG.EMA.MIN_CANDLES})`);
        return this.calculateEMA20FromLocal();
      }

      // 计算 EMA20
      const period = SENTINEL_CONFIG.EMA.PERIOD;
      const multiplier = 2 / (period + 1);

      // 使用收盘价计算
      const prices = candles.map((c: any) => parseFloat(c[4])); // [4] = 收盘价

      // 初始 SMA
      let ema = prices.slice(0, period).reduce((a: number, b: number) => a + b, 0) / period;

      // 计算 EMA
      for (let i = period; i < prices.length; i++) {
        ema = (prices[i] - ema) * multiplier + ema;
      }

      this.cachedEMA20 = ema;
      this.ema20LastUpdate = Date.now();

      console.log(`[EMA] 📊 DOGE EMA20: $${ema.toFixed(5)}`);
      return ema;
    } catch (error) {
      console.log(`[EMA] ⚠️ 获取 K 线失败: ${(error as Error).message}`);
      return this.calculateEMA20FromLocal();
    }
  }

  /**
   * v1.4: 从本地价格历史计算 EMA20（备用方案）
   */
  private calculateEMA20FromLocal(): number | null {
    if (this.priceHistory.length < 20) {
      console.log(`[EMA] ⚠️ 本地价格历史不足 (${this.priceHistory.length} < 20)`);
      return null;
    }

    const period = 20;
    const multiplier = 2 / (period + 1);
    const prices = this.priceHistory.map(p => p.price);

    // 初始 SMA
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // 计算 EMA
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    this.cachedEMA20 = ema;
    this.ema20LastUpdate = Date.now();

    console.log(`[EMA] 📊 DOGE EMA20 (本地): $${ema.toFixed(5)}`);
    return ema;
  }

  /**
   * v1.4: 检查下跌速度是否过快
   * @returns true = 速度正常可以开仓, false = 跌太快不开仓
   */
  checkSpeedFilter(currentPrice: number): { allowed: boolean; dropPct: number; reason: string } {
    const windowMs = SENTINEL_CONFIG.SPEED_FILTER.WINDOW_SEC * 1000;
    const maxDrop = SENTINEL_CONFIG.SPEED_FILTER.MAX_DROP_PCT;
    const now = Date.now();

    // 找到 60 秒前的价格
    const cutoff = now - windowMs;
    const oldPrices = this.priceHistory.filter(p => p.timestamp <= cutoff + 5000 && p.timestamp >= cutoff - 5000);

    if (oldPrices.length === 0) {
      // 没有足够的历史数据，允许开仓
      return { allowed: true, dropPct: 0, reason: '价格历史不足，跳过速度检查' };
    }

    // 取最早的价格作为参考
    const oldPrice = oldPrices[0].price;
    const dropPct = ((oldPrice - currentPrice) / oldPrice) * 100;

    if (dropPct > maxDrop) {
      console.log(`[Speed] ❌ 60秒跌幅 ${dropPct.toFixed(2)}% > ${maxDrop}%，暂停开仓`);
      return {
        allowed: false,
        dropPct,
        reason: `60秒跌幅 ${dropPct.toFixed(2)}% 超过限制 ${maxDrop}%`,
      };
    }

    console.log(`[Speed] ✅ 60秒跌幅 ${dropPct.toFixed(2)}%，速度正常`);
    return { allowed: true, dropPct, reason: '速度正常' };
  }

  /**
   * v1.4: 检查反抖动保护
   * @returns true = 可以平仓, false = 在保护期内
   */
  checkAntiJitter(bearishConfidence: number): { allowed: boolean; reason: string } {
    const protectionMs = SENTINEL_CONFIG.ANTI_JITTER.PROTECTION_SEC * 1000;
    const weakThreshold = SENTINEL_CONFIG.ANTI_JITTER.WEAK_BEARISH_THRESHOLD;
    const timeSinceOpen = Date.now() - this.lastOpenTime;

    // 如果不在保护期内，允许平仓
    if (timeSinceOpen > protectionMs) {
      return { allowed: true, reason: '已过保护期' };
    }

    // 如果是强 bearish 信号（>= 90%），允许平仓
    if (bearishConfidence >= weakThreshold) {
      return { allowed: true, reason: `强 bearish 信号 (${bearishConfidence}% >= ${weakThreshold}%)` };
    }

    // 在保护期内且是弱信号，不允许平仓
    const remainingSec = ((protectionMs - timeSinceOpen) / 1000).toFixed(0);
    console.log(`[AntiJitter] ⏳ 反抖动保护中，剩余 ${remainingSec}秒 (弱信号 ${bearishConfidence}% < ${weakThreshold}%)`);
    return {
      allowed: false,
      reason: `反抖动保护期内 (剩余 ${remainingSec}秒)，弱信号被过滤`,
    };
  }

  /**
   * v1.4: 记录开仓时间（供反抖动使用）
   */
  recordOpenTime(): void {
    this.lastOpenTime = Date.now();
    console.log(`[AntiJitter] 📝 记录开仓时间，15秒保护期开始`);
  }

  /**
   * v1.4: 进入观察模式（等待止跌反弹）
   */
  enterObservationMode(signal: ParsedSignal, currentPrice: number): void {
    const expiresAt = Date.now() + SENTINEL_CONFIG.PRICE_CONFIRM.OBSERVATION_SEC * 1000;

    this.pendingSignal = {
      timestamp: Date.now(),
      triggerPrice: currentPrice,
      lowestPrice: currentPrice,
      expiresAt,
      signal,
    };

    console.log(`[Signal] ⏳ 进入观察模式，等待止跌反弹确认`);
    console.log(`[Signal] 📊 触发价: $${currentPrice.toFixed(5)}, 最长等待 ${SENTINEL_CONFIG.PRICE_CONFIRM.OBSERVATION_SEC}秒`);

    // 启动检查定时器
    if (!this.pendingSignalCheckInterval) {
      this.pendingSignalCheckInterval = setInterval(() => {
        this.checkPendingSignal();
      }, SENTINEL_CONFIG.PRICE_CONFIRM.CHECK_INTERVAL_MS);
    }
  }

  /**
   * v1.4: 检查待确认信号
   */
  private async checkPendingSignal(): Promise<void> {
    if (!this.pendingSignal) {
      return;
    }

    const now = Date.now();
    const pending = this.pendingSignal;

    // 获取当前价格
    let currentPrice = 0;
    if (this.priceHistory.length > 0) {
      currentPrice = this.priceHistory[this.priceHistory.length - 1].price;
    }

    if (currentPrice <= 0) {
      return;
    }

    // 更新最低价
    if (currentPrice < pending.lowestPrice) {
      pending.lowestPrice = currentPrice;
      console.log(`[Signal] 📉 更新最低价: $${currentPrice.toFixed(5)}`);
    }

    // 计算反弹幅度
    const reboundPct = ((currentPrice - pending.lowestPrice) / pending.lowestPrice) * 100;

    // 检查是否反弹确认
    if (reboundPct >= SENTINEL_CONFIG.PRICE_CONFIRM.REBOUND_PCT) {
      console.log(`[Signal] ✅ 止跌反弹确认！反弹 ${reboundPct.toFixed(2)}% >= ${SENTINEL_CONFIG.PRICE_CONFIRM.REBOUND_PCT}%`);

      // 触发开仓
      if (this.onTradeCallback) {
        const decision = await this.buildOpenDecision(pending.signal, currentPrice);
        if (decision.execute) {
          await this.onTradeCallback(decision);
        }
      }

      // 清除待确认信号
      this.clearPendingSignal();
      return;
    }

    // 检查是否过期
    if (now > pending.expiresAt) {
      console.log(`[Signal] ❌ 信号失效，${SENTINEL_CONFIG.PRICE_CONFIRM.OBSERVATION_SEC}秒内未确认反弹`);
      console.log(`[Signal] 📊 触发价: $${pending.triggerPrice.toFixed(5)}, 最低价: $${pending.lowestPrice.toFixed(5)}, 当前: $${currentPrice.toFixed(5)}`);
      this.clearPendingSignal();
      return;
    }

    // 定期输出状态
    const elapsed = ((now - pending.timestamp) / 1000).toFixed(0);
    if (parseInt(elapsed) % 10 === 0) {
      console.log(`[Signal] 📊 观察中... ${elapsed}秒, 触发价: $${pending.triggerPrice.toFixed(5)}, 最低: $${pending.lowestPrice.toFixed(5)}, 当前: $${currentPrice.toFixed(5)}, 反弹: ${reboundPct.toFixed(2)}%`);
    }
  }

  /**
   * v1.4: 清除待确认信号
   */
  private clearPendingSignal(): void {
    this.pendingSignal = null;
    if (this.pendingSignalCheckInterval) {
      clearInterval(this.pendingSignalCheckInterval);
      this.pendingSignalCheckInterval = null;
    }
  }

  /**
   * v1.4: 构建开仓决策
   */
  private async buildOpenDecision(signal: ParsedSignal, currentPrice: number): Promise<TradeDecision> {
    const ctx = getMarketContext();
    const stateMachine = getPositionStateMachine();
    const gateResults: GateCheckResult[] = [];

    // 三道闸检查
    const gate1 = this.checkGate1_Signal(signal);
    gateResults.push(gate1);
    if (!gate1.passed) {
      return { execute: false, direction: signal.direction, positionMultiplier: 0, leverage: 2, reason: gate1.reason, signal, gateResults };
    }

    const gate2 = await this.checkGate2_Execution(signal);
    gateResults.push(gate2);
    if (!gate2.passed) {
      return { execute: false, direction: signal.direction, positionMultiplier: 0, leverage: 2, reason: gate2.reason, signal, gateResults };
    }

    const gate3 = this.checkGate3_Environment();
    gateResults.push(gate3);
    if (!gate3.passed) {
      return { execute: false, direction: signal.direction, positionMultiplier: 0, leverage: 2, reason: gate3.reason, signal, gateResults };
    }

    // 状态机检查
    const canOpen = stateMachine.canOpenLong(currentPrice, { confidence: signal.confidence, type: signal.type });
    if (!canOpen.allowed) {
      return { execute: false, direction: signal.direction, positionMultiplier: 0, leverage: 2, reason: canOpen.reason, signal, gateResults };
    }

    // 计算仓位
    const trialDays = this.getTrialDays();
    let basePositionPct = trialDays <= 3
      ? SENTINEL_CONFIG.POSITION.TRIAL_DAY_1_3_PCT
      : SENTINEL_CONFIG.POSITION.TRIAL_DAY_4_7_PCT;

    // v1.4: K神看多加分
    let kGodBonus = false;
    if (signal.kGodStatus === 'normal') {
      basePositionPct += SENTINEL_CONFIG.POSITION.KGOD_BONUS_PCT;
      kGodBonus = true;
      console.log(`[Signal] ✨ K神看多加分 +${SENTINEL_CONFIG.POSITION.KGOD_BONUS_PCT}%`);
    }

    console.log(`[Signal] ✅ 止跌反弹后开仓, 仓位: ${basePositionPct}%`);

    return {
      execute: true,
      direction: 'LONG',
      positionMultiplier: 1.0,
      positionPct: basePositionPct,
      kGodDowngrade: false,
      leverage: 2,
      reason: `止跌反弹确认，三道闸通过${kGodBonus ? ' (K神加分)' : ''}`,
      signal,
      gateResults,
      action: 'OPEN_LONG',
    };
  }

  /**
   * v1.3: 计算试运行天数
   */
  private getTrialDays(): number {
    const startDate = new Date(SENTINEL_CONFIG.TRIAL_START_DATE);
    const now = new Date();
    const diffTime = now.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, Math.min(diffDays, 7)); // 限制在 1-7 天
  }

  /**
   * v1.3: 更新冰山统计
   */
  private updateIcebergStats(signal: ParsedSignal): void {
    const now = Date.now();

    // 每 5 分钟重置统计
    if (now - this.icebergStats.lastUpdated > this.ICEBERG_STATS_WINDOW_MS) {
      this.icebergStats = {
        buyCount: 0,
        sellCount: 0,
        buyConfirmedCount: 0,
        sellConfirmedCount: 0,
        lastUpdated: now,
      };
    }

    // 只统计冰山信号
    if (signal.type !== 'ICEBERG_CONFIRMED' && signal.type !== 'ICEBERG_DETECTED') {
      return;
    }

    if (signal.direction === 'LONG') {
      this.icebergStats.buyCount++;
      if (signal.type === 'ICEBERG_CONFIRMED') {
        this.icebergStats.buyConfirmedCount++;
      }
    } else if (signal.direction === 'SHORT') {
      this.icebergStats.sellCount++;
      if (signal.type === 'ICEBERG_CONFIRMED') {
        this.icebergStats.sellConfirmedCount++;
      }
    }

    this.icebergStats.lastUpdated = now;
  }

  /**
   * v1.3: 计算确认比 (买方主导为正, 卖方主导为负)
   * 确认比 = 买单确认数 / (买单确认数 + 卖单确认数)
   */
  private calculateConfirmRatio(): number {
    const { buyConfirmedCount, sellConfirmedCount } = this.icebergStats;
    const total = buyConfirmedCount + sellConfirmedCount;

    if (total === 0) {
      return 0.5; // 默认中性
    }

    return buyConfirmedCount / total;
  }
}

// 单例
let sentinelInstance: Sentinel | null = null;

export function getSentinel(): Sentinel {
  if (!sentinelInstance) {
    sentinelInstance = new Sentinel();
  }
  return sentinelInstance;
}

export { Sentinel, SENTINEL_CONFIG };
export type { TradeDecision, ParsedSignal, GateCheckResult };
