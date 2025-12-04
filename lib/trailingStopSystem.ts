/**
 * 移动止损系统（Trailing Stop Loss）
 * 根据最高盈利点动态调整止损位置
 */

export interface PositionTracker {
  coin: string;
  entryPrice: number;
  entryTime: number;
  side: 'LONG' | 'SHORT';
  highestPrice: number;      // 最高价（做多）
  lowestPrice: number;       // 最低价（做空）
  maxProfit: number;         // 最大盈利百分比
  currentProfit: number;     // 当前盈利百分比
  stopLossPrice: number;     // 当前止损价
  isBreakeven: boolean;      // 是否已保本
  isProfitLocked: boolean;  // 是否已锁定利润
}

export class TrailingStopSystem {
  private positions: Map<string, PositionTracker> = new Map();
  
  /**
   * 更新仓位跟踪
   */
  updatePosition(
    coin: string,
    currentPrice: number,
    position: any
  ): {
    shouldClose: boolean;
    reason: string;
    stopLossPrice: number;
  } {
    // 获取或创建跟踪器
    let tracker = this.positions.get(coin);
    
    if (!tracker) {
      // 新仓位，初始化跟踪器
      tracker = {
        coin,
        entryPrice: position.entryPrice,
        entryTime: position.entryTime || Date.now(),
        side: position.side,
        highestPrice: position.side === 'LONG' ? currentPrice : position.entryPrice,
        lowestPrice: position.side === 'SHORT' ? currentPrice : position.entryPrice,
        maxProfit: 0,
        currentProfit: 0,
        stopLossPrice: this.getInitialStopLoss(position),
        isBreakeven: false,
        isProfitLocked: false
      };
      this.positions.set(coin, tracker);
    }
    
    // 更新价格和盈利
    this.updatePriceTracking(tracker, currentPrice);
    
    // 计算动态止损
    const stopLossUpdate = this.calculateDynamicStopLoss(tracker, currentPrice);
    
    // 更新止损价
    tracker.stopLossPrice = stopLossUpdate.newStopLoss;
    
    // 检查是否触发止损
    const shouldClose = this.checkStopLossTriggered(tracker, currentPrice);
    
    return {
      shouldClose,
      reason: stopLossUpdate.reason,
      stopLossPrice: tracker.stopLossPrice
    };
  }
  
  /**
   * 获取初始止损价
   */
  private getInitialStopLoss(position: any): number {
    const entryPrice = position.entryPrice;
    const initialStopPercent = 0.03; // 初始止损3%
    
    if (position.side === 'LONG') {
      return entryPrice * (1 - initialStopPercent);
    } else {
      return entryPrice * (1 + initialStopPercent);
    }
  }
  
  /**
   * 更新价格跟踪
   */
  private updatePriceTracking(tracker: PositionTracker, currentPrice: number) {
    // 更新最高/最低价
    if (tracker.side === 'LONG') {
      tracker.highestPrice = Math.max(tracker.highestPrice, currentPrice);
      tracker.currentProfit = ((currentPrice - tracker.entryPrice) / tracker.entryPrice) * 100;
      tracker.maxProfit = ((tracker.highestPrice - tracker.entryPrice) / tracker.entryPrice) * 100;
    } else {
      tracker.lowestPrice = Math.min(tracker.lowestPrice, currentPrice);
      tracker.currentProfit = ((tracker.entryPrice - currentPrice) / tracker.entryPrice) * 100;
      tracker.maxProfit = ((tracker.entryPrice - tracker.lowestPrice) / tracker.entryPrice) * 100;
    }
  }
  
  /**
   * 计算动态止损
   */
  private calculateDynamicStopLoss(
    tracker: PositionTracker,
    currentPrice: number
  ): {
    newStopLoss: number;
    reason: string;
  } {
    let newStopLoss = tracker.stopLossPrice;
    let reason = 'Initial stop loss';
    
    // 🔥 核心逻辑：根据最高盈利动态调整止损
    
    if (tracker.maxProfit >= 10) {
      // 盈利超过10%：锁定5%利润
      const profitToLock = 5;
      if (tracker.side === 'LONG') {
        newStopLoss = tracker.entryPrice * (1 + profitToLock / 100);
      } else {
        newStopLoss = tracker.entryPrice * (1 - profitToLock / 100);
      }
      tracker.isProfitLocked = true;
      reason = 'Profit locked at 5%';
      
    } else if (tracker.maxProfit >= 5) {
      // 盈利5-10%：锁定2%利润
      const profitToLock = 2;
      if (tracker.side === 'LONG') {
        newStopLoss = Math.max(
          tracker.entryPrice * (1 + profitToLock / 100),
          tracker.stopLossPrice
        );
      } else {
        newStopLoss = Math.min(
          tracker.entryPrice * (1 - profitToLock / 100),
          tracker.stopLossPrice
        );
      }
      tracker.isProfitLocked = true;
      reason = 'Profit locked at 2%';
      
    } else if (tracker.maxProfit >= 3) {
      // 盈利3-5%：移动到保本
      if (!tracker.isBreakeven) {
        newStopLoss = tracker.entryPrice;
        tracker.isBreakeven = true;
        reason = 'Moved to breakeven';
      }
      
    } else if (tracker.maxProfit >= 1.5) {
      // 盈利1.5-3%：收紧止损到-1.5%
      if (tracker.side === 'LONG') {
        newStopLoss = Math.max(
          tracker.entryPrice * 0.985,
          tracker.stopLossPrice
        );
      } else {
        newStopLoss = Math.min(
          tracker.entryPrice * 1.015,
          tracker.stopLossPrice
        );
      }
      reason = 'Tightened stop loss';
    }
    
    // 🎯 移动止损：从最高点回撤
    const trailingPercent = this.getTrailingPercent(tracker.maxProfit);
    
    if (tracker.side === 'LONG') {
      const trailingStop = tracker.highestPrice * (1 - trailingPercent / 100);
      if (trailingStop > newStopLoss) {
        newStopLoss = trailingStop;
        reason = `Trailing stop (${trailingPercent}% from high)`;
      }
    } else {
      const trailingStop = tracker.lowestPrice * (1 + trailingPercent / 100);
      if (trailingStop < newStopLoss) {
        newStopLoss = trailingStop;
        reason = `Trailing stop (${trailingPercent}% from low)`;
      }
    }
    
    return { newStopLoss, reason };
  }
  
  /**
   * 获取移动止损百分比
   */
  private getTrailingPercent(maxProfit: number): number {
    if (maxProfit >= 20) return 3;      // 盈利20%+：3%回撤
    if (maxProfit >= 15) return 4;      // 盈利15-20%：4%回撤
    if (maxProfit >= 10) return 5;      // 盈利10-15%：5%回撤
    if (maxProfit >= 5) return 6;       // 盈利5-10%：6%回撤
    if (maxProfit >= 3) return 7;       // 盈利3-5%：7%回撤
    return 8;                            // 盈利<3%：8%回撤
  }
  
  /**
   * 检查是否触发止损
   */
  private checkStopLossTriggered(
    tracker: PositionTracker,
    currentPrice: number
  ): boolean {
    if (tracker.side === 'LONG') {
      return currentPrice <= tracker.stopLossPrice;
    } else {
      return currentPrice >= tracker.stopLossPrice;
    }
  }
  
  /**
   * 获取仓位状态报告
   */
  getPositionStatus(coin: string): string {
    const tracker = this.positions.get(coin);
    if (!tracker) return 'No position tracked';
    
    return `
📊 ${coin} Position Status:
- Entry: $${tracker.entryPrice.toFixed(2)}
- Highest: $${tracker.highestPrice.toFixed(2)}
- Max Profit: ${tracker.maxProfit.toFixed(2)}%
- Current Profit: ${tracker.currentProfit.toFixed(2)}%
- Stop Loss: $${tracker.stopLossPrice.toFixed(2)}
- Status: ${tracker.isProfitLocked ? '✅ Profit Locked' : tracker.isBreakeven ? '🔒 Breakeven' : '🔴 Risk'}
    `;
  }
  
  /**
   * 重置仓位跟踪
   */
  resetPosition(coin: string) {
    this.positions.delete(coin);
    console.log(`[TrailingStop] 重置 ${coin} 跟踪器`);
  }
  
  /**
   * 获取所有跟踪的仓位
   */
  getAllTrackers(): Map<string, PositionTracker> {
    return this.positions;
  }
}

// 导出单例
export const trailingStopSystem = new TrailingStopSystem();

/**
 * 止损策略说明：
 * 
 * 1. 初始止损：-3%
 * 
 * 2. 保本阶段：
 *    - 盈利达到 1.5%：止损收紧到 -1.5%
 *    - 盈利达到 3%：止损移动到入场价（保本）
 * 
 * 3. 锁利阶段：
 *    - 盈利达到 5%：锁定 2% 利润
 *    - 盈利达到 10%：锁定 5% 利润
 * 
 * 4. 移动止损：
 *    - 始终保持从最高点一定百分比的回撤保护
 *    - 盈利越高，允许回撤越小（3-8%）
 * 
 * 例如：
 * - ETH 入场 $2900
 * - 最高涨到 $3190（+10%）
 * - 止损会移动到 $3045（锁定5%利润）
 * - 如果回落到 $3045，自动平仓，确保5%利润
 */