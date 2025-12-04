/**
 * DEX 聚合器机器人
 * 跨 Uniswap/1inch/SushiSwap 等协议寻找最优价格
 * 实现智能路由和批量交易优化
 */

import { EventEmitter } from 'events';
import {
  createPublicClient,
  http,
  Address,
  formatEther,
  parseEther,
  encodeFunctionData,
  parseAbi
} from 'viem';
import { mainnet, arbitrum, polygon } from 'viem/chains';
import { SafePrice, TradingMath } from '../advanced/precisionMath';
import { logger } from '../advanced/logger';
import fetch from 'node-fetch';

// DEX 协议接口
export interface DEXProtocol {
  name: string;
  chain: string;
  routerAddress: Address;
  factoryAddress: Address;
  feePercent: SafePrice;
  gasEstimate: SafePrice;
  isActive: boolean;
}

// 报价信息
export interface DEXQuote {
  protocol: string;
  chain: string;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: SafePrice;
  amountOut: SafePrice;
  price: SafePrice;
  fee: SafePrice;
  gasEstimate: SafePrice;
  path: Address[];
  priceImpact: SafePrice;
  confidence: number;
  timestamp: number;
}

// 聚合路由
export interface AggregatedRoute {
  id: string;
  tokenIn: Address;
  tokenOut: Address;
  totalAmountIn: SafePrice;
  totalAmountOut: SafePrice;
  bestPrice: SafePrice;
  totalFees: SafePrice;
  totalGas: SafePrice;
  routes: {
    protocol: string;
    percentage: number;
    amountIn: SafePrice;
    amountOut: SafePrice;
    quote: DEXQuote;
  }[];
  savingsPercent: SafePrice;
  executionComplexity: 'SIMPLE' | 'MEDIUM' | 'COMPLEX';
  estimatedTime: number;
  confidence: number;
}

// 1inch API 响应接口
interface OneInchQuote {
  toTokenAmount: string;
  protocols: any[];
  estimatedGas: number;
}

/**
 * DEX 聚合器机器人
 */
export class DEXAggregatorBot extends EventEmitter {
  private publicClients = new Map<string, any>();
  private protocols: DEXProtocol[] = [];
  private isRunning = false;
  private priceCache = new Map<string, DEXQuote[]>();
  
  // 配置
  private config = {
    refreshIntervalMs: 30000,      // 价格刷新间隔 30秒
    quoteCacheExpiry: 60000,       // 报价缓存 1分钟
    minSavingsPercent: 0.1,        // 最小节省 0.1%
    maxPriceImpact: 3,             // 最大价格影响 3%
    maxGasETH: 0.01,              // 最大 Gas 费 0.01 ETH
    oneInchAPI: 'https://api.1inch.dev/swap/v5.2',
    supportedChains: ['mainnet', 'arbitrum', 'polygon']
  };

  // 统计
  private stats = {
    totalQuotes: 0,
    totalRoutes: 0,
    totalSavings: 0,
    avgSavingsPercent: 0,
    bestSavingPercent: 0,
    protocolUsage: {} as Record<string, number>
  };

  constructor() {
    super();
    this.initializeClients();
    this.initializeProtocols();
    logger.info('📊 DEX 聚合器机器人初始化完成');
  }

  /**
   * 初始化区块链客户端
   */
  private initializeClients(): void {
    const chains = {
      mainnet: { chain: mainnet, rpc: 'https://eth.llamarpc.com' },
      arbitrum: { chain: arbitrum, rpc: 'https://arbitrum.llamarpc.com' },
      polygon: { chain: polygon, rpc: 'https://polygon.llamarpc.com' }
    };

    for (const [name, config] of Object.entries(chains)) {
      const client = createPublicClient({
        chain: config.chain,
        transport: http(config.rpc)
      });
      this.publicClients.set(name, client);
    }
  }

  /**
   * 初始化 DEX 协议
   */
  private initializeProtocols(): void {
    this.protocols = [
      // Mainnet 协议
      {
        name: 'Uniswap V2',
        chain: 'mainnet',
        routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
        feePercent: new SafePrice(0.3),
        gasEstimate: new SafePrice(0.003),
        isActive: true
      },
      {
        name: 'Uniswap V3',
        chain: 'mainnet',
        routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        feePercent: new SafePrice(0.05),
        gasEstimate: new SafePrice(0.004),
        isActive: true
      },
      {
        name: 'SushiSwap',
        chain: 'mainnet',
        routerAddress: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
        factoryAddress: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
        feePercent: new SafePrice(0.3),
        gasEstimate: new SafePrice(0.0035),
        isActive: true
      },
      // Arbitrum 协议
      {
        name: 'Uniswap V3 (Arbitrum)',
        chain: 'arbitrum',
        routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        feePercent: new SafePrice(0.05),
        gasEstimate: new SafePrice(0.0008),
        isActive: true
      }
    ];

    logger.debug(`初始化 ${this.protocols.length} 个 DEX 协议`);
  }

  /**
   * 启动聚合器
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    logger.info('🚀 启动 DEX 聚合器...');
    this.isRunning = true;

    // 定期清理过期缓存
    setInterval(() => {
      this.cleanupExpiredQuotes();
    }, this.config.refreshIntervalMs);

    logger.info('✅ DEX 聚合器已启动');
  }

  /**
   * 停止聚合器
   */
  stop(): void {
    if (!this.isRunning) return;

    logger.info('⏹️ 停止 DEX 聚合器...');
    this.isRunning = false;
    logger.info('✅ DEX 聚合器已停止');
  }

  /**
   * 获取最佳交易路由
   */
  async getBestRoute(
    tokenIn: Address,
    tokenOut: Address,
    amountIn: SafePrice,
    chains: string[] = ['mainnet']
  ): Promise<AggregatedRoute | null> {
    logger.performance('开始聚合 DEX 报价');

    try {
      const allQuotes: DEXQuote[] = [];

      // 从各协议获取报价
      for (const chain of chains) {
        const chainQuotes = await this.getChainQuotes(chain, tokenIn, tokenOut, amountIn);
        allQuotes.push(...chainQuotes);
      }

      if (allQuotes.length === 0) {
        logger.warn('未找到任何有效报价');
        return null;
      }

      // 生成聚合路由
      const route = await this.generateAggregatedRoute(tokenIn, tokenOut, amountIn, allQuotes);
      
      if (route) {
        logger.arbitrage('生成最佳路由', {
          tokenPair: `${tokenIn} -> ${tokenOut}`,
          savings: route.savingsPercent.toFixed(3) + '%',
          protocols: route.routes.length
        });

        this.stats.totalRoutes++;
        this.updateProtocolUsage(route);
        this.emit('bestRoute', route);
      }

      return route;

    } catch (error) {
      logger.error('获取最佳路由失败', error);
      return null;
    }
  }

  /**
   * 获取特定链的报价
   */
  private async getChainQuotes(
    chain: string,
    tokenIn: Address,
    tokenOut: Address,
    amountIn: SafePrice
  ): Promise<DEXQuote[]> {
    const quotes: DEXQuote[] = [];
    const chainProtocols = this.protocols.filter(p => p.chain === chain && p.isActive);

    // 并行获取所有协议的报价
    const quotePromises = [
      ...chainProtocols.map(protocol => this.getProtocolQuote(protocol, tokenIn, tokenOut, amountIn)),
      this.get1InchQuote(chain, tokenIn, tokenOut, amountIn) // 1inch 聚合报价
    ];

    const results = await Promise.allSettled(quotePromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        quotes.push(result.value);
      }
    }

    return quotes;
  }

  /**
   * 获取协议报价
   */
  private async getProtocolQuote(
    protocol: DEXProtocol,
    tokenIn: Address,
    tokenOut: Address,
    amountIn: SafePrice
  ): Promise<DEXQuote | null> {
    try {
      const client = this.publicClients.get(protocol.chain);
      if (!client) return null;

      // Uniswap V2/V3 ABI
      const routerABI = parseAbi([
        'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
        'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'
      ]);

      let amountOut: bigint;
      const path = [tokenIn, tokenOut];

      if (protocol.name.includes('V3')) {
        // Uniswap V3 报价
        amountOut = await client.readContract({
          address: protocol.routerAddress,
          abi: routerABI,
          functionName: 'quoteExactInputSingle',
          args: [
            tokenIn,
            tokenOut,
            3000, // 0.3% fee tier
            parseEther(amountIn.toString()),
            0n
          ]
        });
      } else {
        // Uniswap V2 兼容报价
        const amounts = await client.readContract({
          address: protocol.routerAddress,
          abi: routerABI,
          functionName: 'getAmountsOut',
          args: [parseEther(amountIn.toString()), path]
        });
        amountOut = amounts[1];
      }

      const outputAmount = new SafePrice(formatEther(amountOut));
      const price = outputAmount.div(amountIn);
      const priceImpact = this.calculatePriceImpact(amountIn, outputAmount);

      const quote: DEXQuote = {
        protocol: protocol.name,
        chain: protocol.chain,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut: outputAmount,
        price,
        fee: protocol.feePercent,
        gasEstimate: protocol.gasEstimate,
        path,
        priceImpact,
        confidence: this.calculateQuoteConfidence(protocol, priceImpact),
        timestamp: Date.now()
      };

      this.stats.totalQuotes++;
      return quote;

    } catch (error) {
      logger.debug(`${protocol.name} 报价失败`, error);
      return null;
    }
  }

  /**
   * 获取 1inch 聚合报价
   */
  private async get1InchQuote(
    chain: string,
    tokenIn: Address,
    tokenOut: Address,
    amountIn: SafePrice
  ): Promise<DEXQuote | null> {
    try {
      const chainId = this.getChainId(chain);
      if (!chainId) return null;

      const url = `${this.config.oneInchAPI}/${chainId}/quote`;
      const params = new URLSearchParams({
        src: tokenIn,
        dst: tokenOut,
        amount: parseEther(amountIn.toString()).toString()
      });

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Accept': 'application/json',
          // 'Authorization': 'Bearer YOUR_1INCH_API_KEY' // 生产环境需要
        }
      });

      if (!response.ok) return null;

      const data = await response.json() as OneInchQuote;
      const outputAmount = new SafePrice(formatEther(BigInt(data.toTokenAmount)));
      const price = outputAmount.div(amountIn);

      const quote: DEXQuote = {
        protocol: '1inch Aggregator',
        chain,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut: outputAmount,
        price,
        fee: new SafePrice(0.1), // 1inch 费用估算
        gasEstimate: new SafePrice(formatEther(BigInt(data.estimatedGas * 2500000000))), // 估算 Gas
        path: [tokenIn, tokenOut],
        priceImpact: this.calculatePriceImpact(amountIn, outputAmount),
        confidence: 85, // 1inch 置信度较高
        timestamp: Date.now()
      };

      return quote;

    } catch (error) {
      logger.debug('1inch 报价失败', error);
      return null;
    }
  }

  /**
   * 生成聚合路由
   */
  private async generateAggregatedRoute(
    tokenIn: Address,
    tokenOut: Address,
    amountIn: SafePrice,
    quotes: DEXQuote[]
  ): Promise<AggregatedRoute | null> {
    if (quotes.length === 0) return null;

    // 按价格排序，选择最佳报价
    quotes.sort((a, b) => b.price.minus(a.price).toNumber());
    
    const bestQuote = quotes[0];
    const worstQuote = quotes[quotes.length - 1];
    
    // 计算节省百分比
    const savings = TradingMath.calculateSpreadPercent(bestQuote.price, worstQuote.price);
    
    if (savings.lt(this.config.minSavingsPercent)) return null;

    // 简化路由：选择最佳单一协议
    const route: AggregatedRoute = {
      id: `route_${Date.now()}`,
      tokenIn,
      tokenOut,
      totalAmountIn: amountIn,
      totalAmountOut: bestQuote.amountOut,
      bestPrice: bestQuote.price,
      totalFees: bestQuote.fee,
      totalGas: bestQuote.gasEstimate,
      routes: [{
        protocol: bestQuote.protocol,
        percentage: 100,
        amountIn: amountIn,
        amountOut: bestQuote.amountOut,
        quote: bestQuote
      }],
      savingsPercent: savings,
      executionComplexity: 'SIMPLE',
      estimatedTime: 30000, // 30秒
      confidence: bestQuote.confidence
    };

    return route;
  }

  /**
   * 计算价格影响
   */
  private calculatePriceImpact(amountIn: SafePrice, amountOut: SafePrice): SafePrice {
    // 简化的价格影响计算
    const impact = amountIn.div(amountOut.times(1000)).times(100);
    return new SafePrice(Math.min(impact.toNumber(), 100));
  }

  /**
   * 计算报价置信度
   */
  private calculateQuoteConfidence(protocol: DEXProtocol, priceImpact: SafePrice): number {
    let confidence = 70;

    // 协议可靠性
    if (protocol.name.includes('Uniswap')) confidence += 15;
    if (protocol.name.includes('V3')) confidence += 5;

    // 价格影响
    if (priceImpact.lt(1)) confidence += 10;
    else if (priceImpact.gt(5)) confidence -= 20;

    return Math.max(Math.min(confidence, 100), 0);
  }

  /**
   * 获取链 ID
   */
  private getChainId(chain: string): number | null {
    const chainIds: Record<string, number> = {
      'mainnet': 1,
      'arbitrum': 42161,
      'polygon': 137
    };
    return chainIds[chain] || null;
  }

  /**
   * 更新协议使用统计
   */
  private updateProtocolUsage(route: AggregatedRoute): void {
    for (const r of route.routes) {
      this.stats.protocolUsage[r.protocol] = (this.stats.protocolUsage[r.protocol] || 0) + 1;
    }
    
    const totalSavings = Number(route.savingsPercent);
    this.stats.totalSavings += totalSavings;
    this.stats.avgSavingsPercent = this.stats.totalSavings / this.stats.totalRoutes;
    
    if (totalSavings > this.stats.bestSavingPercent) {
      this.stats.bestSavingPercent = totalSavings;
    }
  }

  /**
   * 清理过期报价
   */
  private cleanupExpiredQuotes(): void {
    const now = Date.now();
    for (const [key, quotes] of this.priceCache) {
      const validQuotes = quotes.filter(quote => 
        now - quote.timestamp < this.config.quoteCacheExpiry
      );
      
      if (validQuotes.length === 0) {
        this.priceCache.delete(key);
      } else {
        this.priceCache.set(key, validQuotes);
      }
    }
  }

  /**
   * 获取支持的协议
   */
  getSupportedProtocols(): DEXProtocol[] {
    return this.protocols.filter(p => p.isActive);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      supportedProtocols: this.protocols.length,
      isRunning: this.isRunning
    };
  }
}

// 导出单例
export const dexAggregatorBot = new DEXAggregatorBot();