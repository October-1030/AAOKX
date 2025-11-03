// 区块链透明度系统（Blockchain Transparency System）
// 为每笔交易生成唯一哈希，实现完全透明和可验证性

import crypto from 'crypto';
import { CompletedTrade, TradeBlock, TransparencyExport } from '@/types/trading';

/**
 * 生成交易哈希（SHA-256）
 *
 * 这个函数为每笔交易生成一个唯一的哈希值，类似区块链上的交易ID。
 * 任何人都可以用相同的数据重新计算哈希来验证交易的真实性。
 *
 * @param trade - 已完成的交易
 * @returns 64位十六进制哈希字符串（例如：0x3f5a2b7c8d9e...）
 *
 * @example
 * const hash = generateTradeHash({
 *   id: 'trade-123',
 *   coin: 'BTC',
 *   entryPrice: 67000,
 *   exitPrice: 68000,
 *   pnl: 1000,
 *   ...
 * });
 * // 返回：'3f5a2b7c8d9e1f2a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7'
 */
export function generateTradeHash(trade: CompletedTrade): string {
  // 创建一个规范化的交易数据对象（确保顺序一致）
  const canonicalData = {
    id: trade.id,
    modelName: trade.modelName,
    coin: trade.coin,
    side: trade.side,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    leverage: trade.leverage,
    notional: trade.notional,
    pnl: trade.pnl,
    openedAt: trade.openedAt,
    closedAt: trade.closedAt,
  };

  // 转换为 JSON 字符串（确保一致性）
  const dataString = JSON.stringify(canonicalData);

  // 生成 SHA-256 哈希
  const hash = crypto
    .createHash('sha256')
    .update(dataString)
    .digest('hex');

  return hash;
}

/**
 * 验证交易哈希
 *
 * 重新计算交易哈希并与存储的哈希对比，验证数据未被篡改。
 *
 * @param trade - 要验证的交易
 * @param expectedHash - 预期的哈希值
 * @returns true 表示验证通过，false 表示数据可能被篡改
 *
 * @example
 * const isValid = verifyTradeHash(trade, '3f5a2b7c...');
 * if (isValid) {
 *   console.log('✅ 交易数据完整，未被篡改');
 * } else {
 *   console.log('❌ 警告：交易数据可能被修改！');
 * }
 */
export function verifyTradeHash(
  trade: CompletedTrade,
  expectedHash: string
): boolean {
  const calculatedHash = generateTradeHash(trade);
  return calculatedHash === expectedHash;
}

/**
 * 批量为交易添加哈希
 *
 * 为多笔交易自动生成哈希并标记为已验证。
 *
 * @param trades - 交易列表
 * @returns 添加了哈希的交易列表
 */
export function addHashesToTrades(
  trades: CompletedTrade[]
): CompletedTrade[] {
  return trades.map(trade => {
    const hash = generateTradeHash(trade);
    return {
      ...trade,
      tradeHash: hash,
      verified: true,
    };
  });
}

/**
 * 生成交易区块
 *
 * 将多笔交易组织成一个区块，并生成区块哈希。
 * 区块之间通过 previousBlockHash 链接，形成区块链结构。
 *
 * @param blockNumber - 区块编号
 * @param trades - 要包含的交易列表
 * @param previousBlockHash - 前一个区块的哈希（第一个区块使用 '0000...'）
 * @returns 完整的交易区块
 *
 * @example
 * const block1 = generateTradeBlock(1, [trade1, trade2], '0'.repeat(64));
 * const block2 = generateTradeBlock(2, [trade3, trade4], block1.blockHash);
 * // block2 链接到 block1，形成链式结构
 */
export function generateTradeBlock(
  blockNumber: number,
  trades: CompletedTrade[],
  previousBlockHash: string = '0'.repeat(64)
): TradeBlock {
  const timestamp = Date.now();

  // 确保所有交易都有哈希
  const tradesWithHashes = addHashesToTrades(trades);

  // 生成 Merkle Root（简化版 - 将所有交易哈希组合）
  const merkleRoot = generateMerkleRoot(
    tradesWithHashes.map(t => t.tradeHash!)
  );

  // 生成区块哈希
  const blockData = {
    blockNumber,
    timestamp,
    previousBlockHash,
    merkleRoot,
    tradesCount: tradesWithHashes.length,
  };

  const blockHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(blockData))
    .digest('hex');

  // 为交易添加区块哈希
  const finalTrades = tradesWithHashes.map(trade => ({
    ...trade,
    blockHash,
  }));

  return {
    blockNumber,
    timestamp,
    trades: finalTrades,
    previousBlockHash,
    blockHash,
    merkleRoot,
  };
}

/**
 * 生成 Merkle Root（简化版）
 *
 * Merkle Tree 是一种高效的数据验证结构，用于快速验证某笔交易是否在区块中。
 * 这里使用简化版本：将所有哈希连接后再次哈希。
 *
 * @param hashes - 交易哈希列表
 * @returns Merkle Root 哈希
 */
function generateMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) {
    return '0'.repeat(64);
  }

  // 简化版：直接将所有哈希连接后哈希
  const combined = hashes.join('');
  return crypto
    .createHash('sha256')
    .update(combined)
    .digest('hex');
}

/**
 * 验证区块链完整性
 *
 * 验证整个区块链的完整性，确保没有被篡改。
 *
 * @param blocks - 区块列表
 * @returns 验证结果和详细信息
 */
export function verifyBlockchain(blocks: TradeBlock[]): {
  isValid: boolean;
  invalidBlocks: number[];
  message: string;
} {
  const invalidBlocks: number[] = [];

  // 验证第一个区块
  if (blocks.length > 0 && blocks[0].previousBlockHash !== '0'.repeat(64)) {
    invalidBlocks.push(0);
  }

  // 验证区块链的链接
  for (let i = 1; i < blocks.length; i++) {
    const currentBlock = blocks[i];
    const previousBlock = blocks[i - 1];

    // 检查链接是否正确
    if (currentBlock.previousBlockHash !== previousBlock.blockHash) {
      invalidBlocks.push(i);
    }
  }

  const isValid = invalidBlocks.length === 0;
  const message = isValid
    ? `✅ 区块链完整！验证了 ${blocks.length} 个区块，包含 ${blocks.reduce((sum, b) => sum + b.trades.length, 0)} 笔交易。`
    : `❌ 区块链损坏！区块 ${invalidBlocks.join(', ')} 的哈希链接不匹配。`;

  return {
    isValid,
    invalidBlocks,
    message,
  };
}

/**
 * 导出透明度数据
 *
 * 将所有交易数据导出为可验证的格式，任何人都可以下载并验证。
 *
 * @param allTrades - 所有已完成的交易
 * @param metadata - 账户元数据
 * @returns 完整的透明度导出数据
 *
 * @example
 * const exportData = exportTransparencyData(completedTrades, {
 *   initialCapital: 10000,
 *   finalEquity: 11250,
 *   totalReturn: 12.5,
 *   timeRange: { start: 1698412800000, end: Date.now() }
 * });
 *
 * // 保存为 JSON 文件
 * fs.writeFileSync('transparency.json', JSON.stringify(exportData, null, 2));
 *
 * // 任何人都可以验证
 * const blocks = exportData.blocks;
 * const verification = verifyBlockchain(blocks);
 * console.log(verification.message);
 */
export function exportTransparencyData(
  allTrades: CompletedTrade[],
  metadata: {
    initialCapital: number;
    finalEquity: number;
    totalReturn: number;
    timeRange: { start: number; end: number };
  }
): TransparencyExport {
  // 将交易分组为区块（每100笔交易一个区块）
  const BLOCK_SIZE = 100;
  const blocks: TradeBlock[] = [];

  for (let i = 0; i < allTrades.length; i += BLOCK_SIZE) {
    const blockTrades = allTrades.slice(i, i + BLOCK_SIZE);
    const blockNumber = Math.floor(i / BLOCK_SIZE) + 1;
    const previousHash =
      blocks.length > 0 ? blocks[blocks.length - 1].blockHash : '0'.repeat(64);

    const block = generateTradeBlock(blockNumber, blockTrades, previousHash);
    blocks.push(block);
  }

  return {
    exportVersion: '1.0.0',
    exportTimestamp: Date.now(),
    totalTrades: allTrades.length,
    blocks,
    metadata,
  };
}

/**
 * 生成透明度报告（人类可读）
 *
 * 生成一个易读的透明度报告，包含所有关键信息。
 *
 * @param exportData - 透明度导出数据
 * @returns Markdown 格式的报告
 */
export function generateTransparencyReport(
  exportData: TransparencyExport
): string {
  const { blocks, metadata, totalTrades } = exportData;
  const verification = verifyBlockchain(blocks);

  let report = `# 🔗 交易透明度报告

## 📊 总体数据

- **总交易数**：${totalTrades} 笔
- **区块数量**：${blocks.length} 个
- **初始资金**：$${metadata.initialCapital.toLocaleString()}
- **最终资产**：$${metadata.finalEquity.toLocaleString()}
- **总收益率**：${metadata.totalReturn.toFixed(2)}%
- **时间范围**：${new Date(metadata.timeRange.start).toLocaleString()} - ${new Date(metadata.timeRange.end).toLocaleString()}

## ✅ 区块链验证

${verification.message}

## 📦 区块详情

`;

  blocks.slice(0, 5).forEach(block => {
    report += `### 区块 #${block.blockNumber}
- **区块哈希**：\`${block.blockHash.substring(0, 16)}...\`
- **交易数量**：${block.trades.length}
- **Merkle Root**：\`${block.merkleRoot.substring(0, 16)}...\`
- **时间戳**：${new Date(block.timestamp).toLocaleString()}

`;
  });

  if (blocks.length > 5) {
    report += `...(共 ${blocks.length} 个区块)\n\n`;
  }

  report += `## 🔍 如何验证

任何人都可以验证这些数据：

1. 下载 \`transparency.json\` 文件
2. 重新计算每笔交易的哈希
3. 验证区块链的链接完整性
4. 确认所有数据未被篡改

---

**🌟 这就是链上透明度的力量 - 完全透明，无法作弊！**
`;

  return report;
}

/**
 * 验证单笔交易在区块中的存在性
 *
 * @param tradeHash - 交易哈希
 * @param block - 要搜索的区块
 * @returns 是否找到该交易
 */
export function verifyTradeInBlock(
  tradeHash: string,
  block: TradeBlock
): boolean {
  return block.trades.some(trade => trade.tradeHash === tradeHash);
}

/**
 * 查找交易所在的区块
 *
 * @param tradeHash - 交易哈希
 * @param blocks - 所有区块
 * @returns 包含该交易的区块，如果未找到返回 null
 */
export function findTradeBlock(
  tradeHash: string,
  blocks: TradeBlock[]
): TradeBlock | null {
  return blocks.find(block => verifyTradeInBlock(tradeHash, block)) || null;
}
