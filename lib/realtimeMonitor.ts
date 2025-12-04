/**
 * 实时监控系统
 * 独立于交易周期，持续监控仓位风险
 */

import { getRealTradingExecutor } from './realTradingExecutor';
import { getHyperliquidClient } from './hyperliquidClient';
import { getCurrentPrice } from './marketData';
import { tradingLogger } from './logger';

export class RealtimeMonitor {
  private monitorInterval: NodeJS.Timeout | null = null;
  private executor = getRealTradingExecutor();
  private hyperliquid = getHyperliquidClient();
  
  /**
   * 启动实时监控
   */
  startMonitoring(intervalSeconds: number = 30) {
    console.log(`[Monitor] 🔍 启动实时监控，每 ${intervalSeconds} 秒检查一次`);
    
    // 立即检查一次
    this.checkPositions();
    
    // 定时检查
    this.monitorInterval = setInterval(() => {
      this.checkPositions();
    }, intervalSeconds * 1000);
  }
  
  /**
   * 停止监控
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      console.log('[Monitor] ⏸️ 实时监控已停止');
    }
  }
  
  /**
   * 检查所有持仓
   */
  async checkPositions() {
    try {
      // 获取当前持仓
      const positions = await this.executor.getCurrentPositions();
      
      if (positions.length === 0) {
        return;
      }
      
      for (const position of positions) {
        await this.checkSinglePosition(position);
      }
    } catch (error) {
      console.error('[Monitor] ❌ 监控出错:', error);
      tradingLogger.logError(error as Error, 'RealtimeMonitor');
    }
  }
  
  /**
   * 检查单个仓位
   */
  private async checkSinglePosition(position: any) {
    const currentPrice = getCurrentPrice(position.coin);
    const entryPrice = position.entryPrice;
    
    // 计算盈亏
    const priceChangePercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    const pnlPercent = position.side === 'LONG' 
      ? priceChangePercent 
      : -priceChangePercent;
    
    // 动态止损规则
    const stopLossRules = this.getStopLossRules(pnlPercent, position);
    
    // 检查是否需要止损
    if (this.shouldStopLoss(pnlPercent, stopLossRules)) {
      console.log(`[Monitor] 🚨 ${position.coin} 触发止损条件！`);
      console.log(`   入场价: $${entryPrice.toFixed(2)}`);
      console.log(`   当前价: $${currentPrice.toFixed(2)}`);
      console.log(`   盈亏: ${pnlPercent.toFixed(2)}%`);
      console.log(`   触发规则: ${stopLossRules.triggeredRule}`);
      
      // 执行平仓
      await this.executeEmergencyClose(position, stopLossRules.triggeredRule);
    }
    
    // 检查是否需要止盈
    if (this.shouldTakeProfit(pnlPercent, position)) {
      console.log(`[Monitor] 🎯 ${position.coin} 触发止盈条件！`);
      console.log(`   盈利: +${pnlPercent.toFixed(2)}%`);
      
      // 执行平仓
      await this.executeEmergencyClose(position, 'Take Profit');
    }
  }
  
  /**
   * 获取动态止损规则
   */
  private getStopLossRules(pnlPercent: number, position: any) {
    const rules = {
      immediate: -3,        // 立即止损：-3%
      trailing: 5,          // 移动止损：从最高点回撤5%
      emergency: -5,        // 紧急止损：-5%
      timeBasedLoss: -2,    // 时间止损：持仓超24小时且亏损-2%
      triggeredRule: ''
    };
    
    // 根据持仓时间调整
    const holdTime = Date.now() - position.entryTime;
    const hoursHeld = holdTime / (1000 * 60 * 60);
    
    if (hoursHeld > 24 && pnlPercent < 0) {
      rules.immediate = -2; // 持仓超24小时，止损更严格
      rules.triggeredRule = 'Time-based stop loss';
    } else if (pnlPercent < rules.emergency) {
      rules.triggeredRule = 'Emergency stop loss';
    } else if (pnlPercent < rules.immediate) {
      rules.triggeredRule = 'Immediate stop loss';
    }
    
    return rules;
  }
  
  /**
   * 判断是否需要止损
   */
  private shouldStopLoss(pnlPercent: number, rules: any): boolean {
    // 基础止损：-3%
    if (pnlPercent <= rules.immediate) {
      return true;
    }
    
    // 紧急止损：-5%
    if (pnlPercent <= rules.emergency) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 判断是否需要止盈
   */
  private shouldTakeProfit(pnlPercent: number, position: any): boolean {
    // 基础止盈规则
    const baseTakeProfit = 10; // 10%止盈
    
    // 动态止盈：根据持仓时间调整
    const holdTime = Date.now() - position.entryTime;
    const hoursHeld = holdTime / (1000 * 60 * 60);
    
    if (hoursHeld > 48 && pnlPercent > 5) {
      // 持仓超48小时，5%就止盈
      return true;
    }
    
    if (pnlPercent >= baseTakeProfit) {
      return true;
    }
    
    // 移动止盈：从最高点回撤3%
    if (position.maxProfit && position.maxProfit - pnlPercent > 3) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 执行紧急平仓
   */
  private async executeEmergencyClose(position: any, reason: string) {
    try {
      console.log(`[Monitor] 🔴 执行紧急平仓: ${position.coin}`);
      
      // 记录日志
      tradingLogger.log('TRADE', `紧急平仓: ${reason}`, {
        coin: position.coin,
        entryPrice: position.entryPrice,
        currentPrice: getCurrentPrice(position.coin),
        pnl: position.unrealizedPnL,
        reason
      });
      
      // 执行平仓
      const result = await this.hyperliquid.closePosition(position.coin);
      
      console.log(`[Monitor] ✅ ${position.coin} 平仓成功`);
      
      // 发送通知（如果需要）
      this.sendAlert(position, reason);
      
      return result;
    } catch (error) {
      console.error(`[Monitor] ❌ 紧急平仓失败:`, error);
      tradingLogger.logError(error as Error, 'EmergencyClose');
    }
  }
  
  /**
   * 发送警报通知
   */
  private sendAlert(position: any, reason: string) {
    const message = `
⚠️ 紧急平仓通知
币种: ${position.coin}
原因: ${reason}
盈亏: ${position.unrealizedPnLPercent?.toFixed(2)}%
时间: ${new Date().toLocaleString()}
    `;
    
    console.log(message);
    // 这里可以集成邮件、Telegram等通知服务
  }
}

// 导出单例
export const realtimeMonitor = new RealtimeMonitor();

// 自动启动监控
if (process.env.ENABLE_REALTIME_MONITOR !== 'false') {
  realtimeMonitor.startMonitoring(30); // 每30秒检查一次
}