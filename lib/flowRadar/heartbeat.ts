/**
 * Flow-Radar 信号心跳检查和恢复机制
 */

import { FlowRadarStatus, HeartbeatState } from './types';
import { getFlowRadarAdapter, FlowRadarSignalAdapter } from './signalAdapter';

// 心跳配置
const HEARTBEAT_CONFIG = {
  // 进入 PAUSED 的条件：连续无信号时间（秒）
  PAUSE_THRESHOLD_SEC: 300, // 5分钟

  // 恢复条件
  RECOVERY_MIN_SIGNALS: 3, // 连续收到 ≥3 条合法信号
  RECOVERY_MIN_DURATION_SEC: 30, // 或持续 ≥30 秒有信号流

  // 恢复冷却时间（秒）
  RECOVERY_COOLDOWN_SEC: 60,

  // 检查间隔（毫秒）
  CHECK_INTERVAL_MS: 10000, // 10秒
};

/**
 * 信号心跳监控器
 */
export class FlowRadarHeartbeat {
  private adapter: FlowRadarSignalAdapter;
  private state: HeartbeatState;
  private checkInterval: NodeJS.Timeout | null = null;
  private listeners: ((state: HeartbeatState) => void)[] = [];

  constructor() {
    this.adapter = getFlowRadarAdapter();
    this.state = {
      status: FlowRadarStatus.RUNNING,
      last_signal_time: Date.now(),
      consecutive_signals: 0,
      signal_start_time: 0,
      cooldown_until: 0,
    };
  }

  /**
   * 启动心跳监控
   */
  start(): void {
    if (this.checkInterval) {
      return;
    }

    console.log('[FlowRadar Heartbeat] 🫀 启动心跳监控');

    this.checkInterval = setInterval(() => {
      this.checkHeartbeat();
    }, HEARTBEAT_CONFIG.CHECK_INTERVAL_MS);

    // 立即检查一次
    this.checkHeartbeat();
  }

  /**
   * 停止心跳监控
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[FlowRadar Heartbeat] 🛑 停止心跳监控');
    }
  }

  /**
   * 执行心跳检查
   */
  private async checkHeartbeat(): Promise<void> {
    const now = Date.now();
    const previousStatus = this.state.status;

    // 获取最新信号
    const summary = await this.adapter.getSignals();
    const signalCount = summary?.signals.length || 0;
    const lastReadTime = this.adapter.getLastReadTime();

    // 更新信号时间
    if (signalCount > 0) {
      this.state.last_signal_time = now;

      // 累计连续信号
      if (this.state.consecutive_signals === 0) {
        this.state.signal_start_time = now;
      }
      this.state.consecutive_signals += signalCount;
    } else {
      // 无信号，重置计数
      this.state.consecutive_signals = 0;
      this.state.signal_start_time = 0;
    }

    // 状态机逻辑
    switch (this.state.status) {
      case FlowRadarStatus.RUNNING:
        this.checkPauseCondition(now);
        break;

      case FlowRadarStatus.PAUSED:
        this.checkRecoveryCondition(now);
        break;

      case FlowRadarStatus.COOLDOWN:
        this.checkCooldownEnd(now);
        break;

      case FlowRadarStatus.ERROR:
        // 错误状态需要手动恢复
        break;
    }

    // 状态变化通知
    if (previousStatus !== this.state.status) {
      console.log(
        `[FlowRadar Heartbeat] 📢 状态变化: ${previousStatus} → ${this.state.status}`
      );
      this.notifyListeners();
    }
  }

  /**
   * 检查是否需要进入 PAUSED 状态
   */
  private checkPauseCondition(now: number): void {
    const timeSinceLastSignal = (now - this.state.last_signal_time) / 1000;

    if (timeSinceLastSignal >= HEARTBEAT_CONFIG.PAUSE_THRESHOLD_SEC) {
      this.state.status = FlowRadarStatus.PAUSED;
      this.state.pause_reason = `连续 ${Math.floor(timeSinceLastSignal)} 秒无信号`;
      console.log(
        `[FlowRadar Heartbeat] ⏸️ 进入 PAUSED 状态: ${this.state.pause_reason}`
      );
    }
  }

  /**
   * 检查是否满足恢复条件
   */
  private checkRecoveryCondition(now: number): void {
    // 条件1：连续收到 ≥3 条合法信号
    if (this.state.consecutive_signals >= HEARTBEAT_CONFIG.RECOVERY_MIN_SIGNALS) {
      this.enterCooldown(now, '连续信号恢复');
      return;
    }

    // 条件2：持续 ≥30 秒有信号流
    if (this.state.signal_start_time > 0) {
      const signalDuration = (now - this.state.signal_start_time) / 1000;
      if (signalDuration >= HEARTBEAT_CONFIG.RECOVERY_MIN_DURATION_SEC) {
        this.enterCooldown(now, '持续信号流恢复');
        return;
      }
    }
  }

  /**
   * 进入冷却状态
   */
  private enterCooldown(now: number, reason: string): void {
    this.state.status = FlowRadarStatus.COOLDOWN;
    this.state.cooldown_until = now + HEARTBEAT_CONFIG.RECOVERY_COOLDOWN_SEC * 1000;
    this.state.pause_reason = undefined;
    console.log(
      `[FlowRadar Heartbeat] ❄️ 进入 COOLDOWN 状态 (${reason}), 冷却 ${HEARTBEAT_CONFIG.RECOVERY_COOLDOWN_SEC} 秒`
    );
  }

  /**
   * 检查冷却是否结束
   */
  private checkCooldownEnd(now: number): void {
    if (now >= this.state.cooldown_until) {
      this.state.status = FlowRadarStatus.RUNNING;
      this.state.cooldown_until = 0;
      this.state.consecutive_signals = 0;
      console.log('[FlowRadar Heartbeat] ✅ 冷却结束，恢复 RUNNING 状态');
    }
  }

  /**
   * 获取当前状态
   */
  getState(): HeartbeatState {
    return { ...this.state };
  }

  /**
   * 检查是否允许开仓
   */
  canOpenPosition(): boolean {
    return this.state.status === FlowRadarStatus.RUNNING;
  }

  /**
   * 检查是否允许平仓
   */
  canClosePosition(): boolean {
    // PAUSED 和 COOLDOWN 状态允许平仓
    return (
      this.state.status === FlowRadarStatus.RUNNING ||
      this.state.status === FlowRadarStatus.PAUSED ||
      this.state.status === FlowRadarStatus.COOLDOWN
    );
  }

  /**
   * 获取冷却剩余时间（秒）
   */
  getCooldownRemaining(): number {
    if (this.state.status !== FlowRadarStatus.COOLDOWN) {
      return 0;
    }
    const remaining = (this.state.cooldown_until - Date.now()) / 1000;
    return Math.max(0, Math.ceil(remaining));
  }

  /**
   * 获取无信号时长（秒）
   */
  getTimeSinceLastSignal(): number {
    return Math.floor((Date.now() - this.state.last_signal_time) / 1000);
  }

  /**
   * 手动恢复（从 ERROR 状态）
   */
  manualRecover(): void {
    if (this.state.status === FlowRadarStatus.ERROR) {
      this.state.status = FlowRadarStatus.RUNNING;
      this.state.last_signal_time = Date.now();
      this.state.consecutive_signals = 0;
      this.state.pause_reason = undefined;
      console.log('[FlowRadar Heartbeat] 🔄 手动恢复');
      this.notifyListeners();
    }
  }

  /**
   * 设置错误状态
   */
  setError(reason: string): void {
    this.state.status = FlowRadarStatus.ERROR;
    this.state.pause_reason = reason;
    console.log(`[FlowRadar Heartbeat] ❌ 进入 ERROR 状态: ${reason}`);
    this.notifyListeners();
  }

  /**
   * 添加状态变化监听器
   */
  addListener(callback: (state: HeartbeatState) => void): void {
    this.listeners.push(callback);
  }

  /**
   * 移除监听器
   */
  removeListener(callback: (state: HeartbeatState) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const stateCopy = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(stateCopy);
      } catch (error) {
        console.error('[FlowRadar Heartbeat] 监听器错误:', error);
      }
    }
  }

  /**
   * 获取状态描述
   */
  getStatusDescription(): string {
    switch (this.state.status) {
      case FlowRadarStatus.RUNNING:
        return '✅ 正常运行';
      case FlowRadarStatus.PAUSED:
        return `⏸️ 已暂停 (${this.state.pause_reason || '无信号'})`;
      case FlowRadarStatus.COOLDOWN:
        return `❄️ 冷却中 (剩余 ${this.getCooldownRemaining()} 秒)`;
      case FlowRadarStatus.ERROR:
        return `❌ 错误 (${this.state.pause_reason || '未知'})`;
      default:
        return '❓ 未知状态';
    }
  }
}

// 单例
let heartbeatInstance: FlowRadarHeartbeat | null = null;

export function getFlowRadarHeartbeat(): FlowRadarHeartbeat {
  if (!heartbeatInstance) {
    heartbeatInstance = new FlowRadarHeartbeat();
  }
  return heartbeatInstance;
}
