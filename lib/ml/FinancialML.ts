/**
 * Financial Machine Learning 策略实现
 * 基于 Marcos Lopez de Prado 的《Advances in Financial Machine Learning》
 * 实现三重屏障标签法、分数差分和元标签
 */

import { EventEmitter } from 'events';
import { SafePrice, TradingMath } from '../advanced/precisionMath';
import { logger } from '../advanced/logger';

/**
 * 三重屏障标签法
 * Triple Barrier Method - 更真实的金融数据标签方法
 */
export class TripleBarrierLabeler {
  private profitMultiplier: number;
  private lossMultiplier: number;
  private maxHoldingPeriod: number;
  
  constructor(
    profitMultiplier: number = 2,    // 盈利倍数
    lossMultiplier: number = 1,      // 止损倍数
    maxHoldingPeriod: number = 100   // 最大持有期（时间单位）
  ) {
    this.profitMultiplier = profitMultiplier;
    this.lossMultiplier = lossMultiplier;
    this.maxHoldingPeriod = maxHoldingPeriod;
  }

  /**
   * 为价格序列生成三重屏障标签
   * @param prices 价格序列
   * @param volatility 每个时间点的波动率
   * @param timestamps 时间戳
   * @returns 标签序列 {-1: 卖出, 0: 中性, 1: 买入}
   */
  label(
    prices: SafePrice[],
    volatility: SafePrice[],
    timestamps: number[]
  ): BarrierLabel[] {
    const labels: BarrierLabel[] = [];
    
    for (let i = 0; i < prices.length - this.maxHoldingPeriod; i++) {
      const entryPrice = prices[i];
      const entryVol = volatility[i];
      
      // 计算动态屏障（基于波动率）
      const upperBarrier = entryPrice.plus(
        entryVol.multipliedBy(this.profitMultiplier)
      );
      const lowerBarrier = entryPrice.minus(
        entryVol.multipliedBy(this.lossMultiplier)
      );
      
      let label: BarrierLabel = {
        index: i,
        timestamp: timestamps[i],
        entryPrice,
        exitPrice: null,
        exitIndex: null,
        label: 0,
        barrier: 'time',
        returnPct: new SafePrice(0)
      };
      
      // 检查每个未来时间点
      for (let j = i + 1; j <= Math.min(i + this.maxHoldingPeriod, prices.length - 1); j++) {
        const currentPrice = prices[j];
        
        // 检查上屏障（盈利）
        if (currentPrice.greaterThanOrEqualTo(upperBarrier)) {
          label = {
            ...label,
            exitPrice: currentPrice,
            exitIndex: j,
            label: 1,
            barrier: 'profit',
            returnPct: currentPrice.minus(entryPrice).dividedBy(entryPrice).multipliedBy(100)
          };
          break;
        }
        
        // 检查下屏障（止损）
        if (currentPrice.lessThanOrEqualTo(lowerBarrier)) {
          label = {
            ...label,
            exitPrice: currentPrice,
            exitIndex: j,
            label: -1,
            barrier: 'loss',
            returnPct: currentPrice.minus(entryPrice).dividedBy(entryPrice).multipliedBy(100)
          };
          break;
        }
        
        // 时间屏障
        if (j === i + this.maxHoldingPeriod) {
          const finalReturn = currentPrice.minus(entryPrice).dividedBy(entryPrice);
          label = {
            ...label,
            exitPrice: currentPrice,
            exitIndex: j,
            label: finalReturn.greaterThan(0) ? 1 : finalReturn.lessThan(0) ? -1 : 0,
            barrier: 'time',
            returnPct: finalReturn.multipliedBy(100)
          };
        }
      }
      
      labels.push(label);
    }
    
    logger.info('三重屏障标签生成完成', {
      total: labels.length,
      buy: labels.filter(l => l.label === 1).length,
      sell: labels.filter(l => l.label === -1).length,
      neutral: labels.filter(l => l.label === 0).length
    });
    
    return labels;
  }

  /**
   * 获取标签统计
   */
  getStatistics(labels: BarrierLabel[]): BarrierStatistics {
    const stats: BarrierStatistics = {
      totalLabels: labels.length,
      buyLabels: labels.filter(l => l.label === 1).length,
      sellLabels: labels.filter(l => l.label === -1).length,
      neutralLabels: labels.filter(l => l.label === 0).length,
      profitBarrierHits: labels.filter(l => l.barrier === 'profit').length,
      lossBarrierHits: labels.filter(l => l.barrier === 'loss').length,
      timeBarrierHits: labels.filter(l => l.barrier === 'time').length,
      avgReturnBuy: this.calculateAvgReturn(labels.filter(l => l.label === 1)),
      avgReturnSell: this.calculateAvgReturn(labels.filter(l => l.label === -1)),
      avgHoldingPeriod: this.calculateAvgHoldingPeriod(labels)
    };
    
    return stats;
  }

  private calculateAvgReturn(labels: BarrierLabel[]): SafePrice {
    if (labels.length === 0) return new SafePrice(0);
    
    const totalReturn = labels.reduce(
      (sum, label) => sum.plus(label.returnPct),
      new SafePrice(0)
    );
    
    return totalReturn.dividedBy(labels.length);
  }

  private calculateAvgHoldingPeriod(labels: BarrierLabel[]): number {
    const validLabels = labels.filter(l => l.exitIndex !== null);
    if (validLabels.length === 0) return 0;
    
    const totalPeriod = validLabels.reduce(
      (sum, label) => sum + (label.exitIndex! - label.index),
      0
    );
    
    return totalPeriod / validLabels.length;
  }
}

/**
 * 分数差分 (Fractional Differentiation)
 * 保持时间序列平稳性的同时最大化保留内存
 */
export class FractionalDifferentiation {
  private d: number; // 差分阶数 (0 < d < 1)
  private threshold: number; // 权重阈值
  
  constructor(d: number = 0.5, threshold: number = 1e-5) {
    this.d = d;
    this.threshold = threshold;
  }

  /**
   * 计算分数差分权重
   */
  private getWeights(size: number): number[] {
    const weights: number[] = [1];
    
    for (let k = 1; k < size; k++) {
      const weight = -weights[k - 1] * (this.d - k + 1) / k;
      
      if (Math.abs(weight) < this.threshold) {
        break;
      }
      
      weights.push(weight);
    }
    
    return weights;
  }

  /**
   * 应用分数差分变换
   * @param series 原始时间序列
   * @returns 分数差分后的序列
   */
  transform(series: SafePrice[]): SafePrice[] {
    const weights = this.getWeights(series.length);
    const diffSeries: SafePrice[] = [];
    
    for (let i = weights.length - 1; i < series.length; i++) {
      let value = new SafePrice(0);
      
      for (let j = 0; j < weights.length; j++) {
        value = value.plus(
          series[i - j].multipliedBy(weights[j])
        );
      }
      
      diffSeries.push(value);
    }
    
    logger.debug('分数差分变换完成', {
      originalLength: series.length,
      transformedLength: diffSeries.length,
      d: this.d,
      weightsUsed: weights.length
    });
    
    return diffSeries;
  }

  /**
   * 自动寻找最优差分阶数
   * 通过 ADF 测试找到最小的 d 使序列平稳
   */
  findOptimalD(series: SafePrice[], maxD: number = 1, step: number = 0.01): number {
    let optimalD = 0;
    
    for (let d = 0; d <= maxD; d += step) {
      this.d = d;
      const transformed = this.transform(series);
      
      // 这里应该执行 ADF 测试
      // 简化版：检查方差变化
      if (this.isStationary(transformed)) {
        optimalD = d;
        break;
      }
    }
    
    logger.info('找到最优差分阶数', { optimalD });
    return optimalD;
  }

  /**
   * 简化的平稳性检验
   */
  private isStationary(series: SafePrice[]): boolean {
    // 实际应该使用 ADF 测试
    // 这里用简化版：检查滚动方差是否稳定
    const windowSize = Math.min(20, Math.floor(series.length / 5));
    const variances: SafePrice[] = [];
    
    for (let i = windowSize; i < series.length; i++) {
      const window = series.slice(i - windowSize, i);
      const variance = this.calculateVariance(window);
      variances.push(variance);
    }
    
    // 检查方差的方差（应该很小）
    const varOfVar = this.calculateVariance(variances);
    const meanVar = variances.reduce((sum, v) => sum.plus(v), new SafePrice(0))
      .dividedBy(variances.length);
    
    // 如果方差的方差相对于平均方差很小，认为是平稳的
    return varOfVar.dividedBy(meanVar).lessThan(0.1);
  }

  private calculateVariance(series: SafePrice[]): SafePrice {
    const mean = series.reduce((sum, v) => sum.plus(v), new SafePrice(0))
      .dividedBy(series.length);
    
    const squaredDiffs = series.map(v => v.minus(mean).pow(2));
    return squaredDiffs.reduce((sum, v) => sum.plus(v), new SafePrice(0))
      .dividedBy(series.length);
  }
}

/**
 * 元标签 (Meta Labeling)
 * 二级模型：决定交易规模
 */
export class MetaLabeler extends EventEmitter {
  private primaryModel: any; // 主模型（方向预测）
  private features: string[] = [];
  
  constructor() {
    super();
  }

  /**
   * 训练元标签模型
   * @param primaryPredictions 主模型的预测（方向）
   * @param actualOutcomes 实际结果
   * @param features 额外特征
   */
  train(
    primaryPredictions: number[],
    actualOutcomes: number[],
    features: SafePrice[][]
  ): void {
    // 生成元标签：主模型预测是否正确
    const metaLabels = primaryPredictions.map((pred, i) => 
      pred * actualOutcomes[i] > 0 ? 1 : 0
    );
    
    logger.info('元标签训练', {
      samples: metaLabels.length,
      accuracy: metaLabels.filter(l => l === 1).length / metaLabels.length
    });
    
    // 这里应该训练实际的 ML 模型（如 XGBoost）
    // 简化版：存储统计信息
    this.emit('trained', {
      samples: metaLabels.length,
      positiveRate: metaLabels.filter(l => l === 1).length / metaLabels.length
    });
  }

  /**
   * 预测交易规模
   * @param primaryPrediction 主模型预测的方向
   * @param features 当前特征
   * @returns 建议的仓位大小 (0-1)
   */
  predictSize(primaryPrediction: number, features: SafePrice[]): SafePrice {
    // 简化版：基于置信度返回仓位大小
    // 实际应该使用训练好的模型
    
    const baseSize = new SafePrice(0.1); // 基础仓位 10%
    const confidence = new SafePrice(Math.random()); // 模拟置信度
    
    // 仓位 = 基础仓位 * 置信度 * 方向
    const size = baseSize.multipliedBy(confidence);
    
    logger.debug('元标签预测', {
      direction: primaryPrediction,
      confidence: confidence.toString(),
      size: size.toString()
    });
    
    return size;
  }
}

/**
 * CUSUM 过滤器
 * 检测时间序列中的结构性变化
 */
export class CUSUMFilter {
  private threshold: SafePrice;
  
  constructor(threshold: SafePrice) {
    this.threshold = threshold;
  }

  /**
   * 应用 CUSUM 过滤器检测事件
   * @param series 时间序列
   * @returns 事件索引数组
   */
  detectEvents(series: SafePrice[]): number[] {
    const events: number[] = [];
    let posSum = new SafePrice(0);
    let negSum = new SafePrice(0);
    
    for (let i = 1; i < series.length; i++) {
      const diff = series[i].minus(series[i - 1]);
      
      posSum = TradingMath.max(new SafePrice(0), posSum.plus(diff));
      negSum = TradingMath.min(new SafePrice(0), negSum.plus(diff));
      
      // 检测突破阈值
      if (posSum.greaterThan(this.threshold)) {
        events.push(i);
        posSum = new SafePrice(0);
      } else if (negSum.abs().greaterThan(this.threshold)) {
        events.push(i);
        negSum = new SafePrice(0);
      }
    }
    
    logger.info('CUSUM 事件检测', {
      totalPoints: series.length,
      eventsDetected: events.length,
      eventRate: events.length / series.length
    });
    
    return events;
  }
}

/**
 * 微结构特征提取
 * Market Microstructure Features
 */
export class MicrostructureFeatures {
  /**
   * 计算 Tick 不平衡
   */
  static calculateTickImbalance(ticks: number[]): SafePrice {
    let buyTicks = 0;
    let sellTicks = 0;
    
    for (let i = 1; i < ticks.length; i++) {
      if (ticks[i] > ticks[i - 1]) {
        buyTicks++;
      } else if (ticks[i] < ticks[i - 1]) {
        sellTicks++;
      }
    }
    
    const total = buyTicks + sellTicks;
    if (total === 0) return new SafePrice(0);
    
    return new SafePrice((buyTicks - sellTicks) / total);
  }

  /**
   * 计算成交量加权平均价格 (VWAP)
   */
  static calculateVWAP(
    prices: SafePrice[],
    volumes: SafePrice[]
  ): SafePrice {
    let sumPV = new SafePrice(0);
    let sumV = new SafePrice(0);
    
    for (let i = 0; i < prices.length; i++) {
      sumPV = sumPV.plus(prices[i].multipliedBy(volumes[i]));
      sumV = sumV.plus(volumes[i]);
    }
    
    return sumV.isZero() ? new SafePrice(0) : sumPV.dividedBy(sumV);
  }

  /**
   * 计算 Kyle's Lambda (价格影响系数)
   */
  static calculateKyleLambda(
    priceChanges: SafePrice[],
    volumes: SafePrice[]
  ): SafePrice {
    // 简化版：价格变化 / 成交量
    const avgPriceChange = priceChanges.reduce(
      (sum, p) => sum.plus(p.abs()),
      new SafePrice(0)
    ).dividedBy(priceChanges.length);
    
    const avgVolume = volumes.reduce(
      (sum, v) => sum.plus(v),
      new SafePrice(0)
    ).dividedBy(volumes.length);
    
    return avgVolume.isZero() ? new SafePrice(0) : avgPriceChange.dividedBy(avgVolume);
  }
}

// 类型定义
export interface BarrierLabel {
  index: number;
  timestamp: number;
  entryPrice: SafePrice;
  exitPrice: SafePrice | null;
  exitIndex: number | null;
  label: -1 | 0 | 1;
  barrier: 'profit' | 'loss' | 'time';
  returnPct: SafePrice;
}

export interface BarrierStatistics {
  totalLabels: number;
  buyLabels: number;
  sellLabels: number;
  neutralLabels: number;
  profitBarrierHits: number;
  lossBarrierHits: number;
  timeBarrierHits: number;
  avgReturnBuy: SafePrice;
  avgReturnSell: SafePrice;
  avgHoldingPeriod: number;
}

// 导出主类
export class FinancialMLEngine extends EventEmitter {
  private tripleBarrier: TripleBarrierLabeler;
  private fracDiff: FractionalDifferentiation;
  private metaLabeler: MetaLabeler;
  private cusumFilter: CUSUMFilter;
  
  constructor() {
    super();
    this.tripleBarrier = new TripleBarrierLabeler();
    this.fracDiff = new FractionalDifferentiation();
    this.metaLabeler = new MetaLabeler();
    this.cusumFilter = new CUSUMFilter(new SafePrice(0.01));
  }

  /**
   * 完整的 ML 管道
   */
  async processData(
    prices: SafePrice[],
    volumes: SafePrice[],
    timestamps: number[]
  ): Promise<{
    labels: BarrierLabel[];
    features: SafePrice[][];
    events: number[];
  }> {
    logger.info('开始金融 ML 处理管道');
    
    // 1. 事件检测
    const events = this.cusumFilter.detectEvents(prices);
    
    // 2. 特征工程
    const stationaryPrices = this.fracDiff.transform(prices);
    const tickImbalance = MicrostructureFeatures.calculateTickImbalance(
      prices.map(p => p.toNumber())
    );
    const vwap = MicrostructureFeatures.calculateVWAP(prices, volumes);
    
    // 3. 标签生成
    const volatility = this.calculateVolatility(prices);
    const labels = this.tripleBarrier.label(prices, volatility, timestamps);
    
    // 4. 统计信息
    const stats = this.tripleBarrier.getStatistics(labels);
    logger.performance('ML 管道统计', stats);
    
    this.emit('processingComplete', {
      labels: labels.length,
      features: 3,
      events: events.length,
      stats
    });
    
    return {
      labels,
      features: [stationaryPrices],
      events
    };
  }

  private calculateVolatility(prices: SafePrice[]): SafePrice[] {
    const volatility: SafePrice[] = [];
    const window = 20;
    
    for (let i = 0; i < prices.length; i++) {
      if (i < window) {
        volatility.push(new SafePrice(0.01)); // 默认 1% 波动
      } else {
        const windowPrices = prices.slice(i - window, i);
        const returns = [];
        
        for (let j = 1; j < windowPrices.length; j++) {
          const ret = windowPrices[j].minus(windowPrices[j - 1])
            .dividedBy(windowPrices[j - 1]);
          returns.push(ret);
        }
        
        // 计算标准差作为波动率
        const mean = returns.reduce((sum, r) => sum.plus(r), new SafePrice(0))
          .dividedBy(returns.length);
        
        const variance = returns.reduce(
          (sum, r) => sum.plus(r.minus(mean).pow(2)),
          new SafePrice(0)
        ).dividedBy(returns.length);
        
        volatility.push(variance.sqrt());
      }
    }
    
    return volatility;
  }
}