/**
 * 区块链透明度系统测试 - 演示所有功能
 *
 * 运行方法：
 * npx ts-node test-blockchain-transparency.ts
 *
 * 或者直接复制到你的代码中使用！
 */

import {
  generateTradeHash,
  verifyTradeHash,
  addHashesToTrades,
  generateTradeBlock,
  verifyBlockchain,
  exportTransparencyData,
  generateTransparencyReport,
} from './lib/blockchainTransparency';
import { CompletedTrade } from './types/trading';

// ========== 模拟交易数据 ==========

const mockTrades: CompletedTrade[] = [
  {
    id: 'trade-001',
    modelName: 'DeepSeek V3.1',
    coin: 'BTC',
    side: 'LONG',
    entryPrice: 67000,
    exitPrice: 68000,
    leverage: 10,
    notional: 5000,
    pnl: 746.27,
    pnlPercent: 14.93,
    openedAt: Date.now() - 3600000,
    closedAt: Date.now() - 1800000,
    exitReason: 'Take profit target reached',
  },
  {
    id: 'trade-002',
    modelName: 'GPT-4 Turbo',
    coin: 'ETH',
    side: 'SHORT',
    entryPrice: 3500,
    exitPrice: 3450,
    leverage: 15,
    notional: 3000,
    pnl: 642.86,
    pnlPercent: 21.43,
    openedAt: Date.now() - 7200000,
    closedAt: Date.now() - 3600000,
    exitReason: 'Technical indicators confirmed exit',
  },
  {
    id: 'trade-003',
    modelName: 'Claude 3.5 Sonnet',
    coin: 'SOL',
    side: 'LONG',
    entryPrice: 180,
    exitPrice: 185,
    leverage: 12,
    notional: 4000,
    pnl: 1333.33,
    pnlPercent: 33.33,
    openedAt: Date.now() - 10800000,
    closedAt: Date.now() - 7200000,
    exitReason: 'Strong uptrend continuation',
  },
];

// ========== 测试 1: 生成交易哈希 ==========

console.log('==========================================');
console.log('🔗 测试 1: 生成交易哈希');
console.log('==========================================\n');

const trade1 = mockTrades[0];
const hash1 = generateTradeHash(trade1);

console.log(`交易 ID: ${trade1.id}`);
console.log(`币种: ${trade1.coin} ${trade1.side}`);
console.log(`入场价: $${trade1.entryPrice.toLocaleString()}`);
console.log(`出场价: $${trade1.exitPrice.toLocaleString()}`);
console.log(`盈亏: $${trade1.pnl.toFixed(2)} (${trade1.pnlPercent.toFixed(2)}%)`);
console.log(`\n📝 生成的哈希:`);
console.log(`0x${hash1}`);
console.log(`\n✅ 这个哈希是唯一的，任何人都可以用相同数据重新计算来验证！\n`);

// ========== 测试 2: 验证交易哈希 ==========

console.log('==========================================');
console.log('🔍 测试 2: 验证交易哈希');
console.log('==========================================\n');

const isValid = verifyTradeHash(trade1, hash1);
console.log(`验证结果: ${isValid ? '✅ 通过' : '❌ 失败'}\n`);

// 尝试篡改数据
const tamperedTrade = { ...trade1, pnl: 999999 }; // 篡改盈亏数据
const isTamperedValid = verifyTradeHash(tamperedTrade, hash1);
console.log('🚨 尝试验证被篡改的交易（盈亏改为 $999,999）:');
console.log(`验证结果: ${isTamperedValid ? '✅ 通过' : '❌ 失败（数据已被篡改！）'}\n`);

// ========== 测试 3: 批量添加哈希 ==========

console.log('==========================================');
console.log('📦 测试 3: 批量为交易添加哈希');
console.log('==========================================\n');

const tradesWithHashes = addHashesToTrades(mockTrades);
console.log(`处理了 ${tradesWithHashes.length} 笔交易:\n`);

tradesWithHashes.forEach((trade, i) => {
  console.log(`${i + 1}. ${trade.coin} ${trade.side} - $${trade.pnl.toFixed(2)}`);
  console.log(`   哈希: 0x${trade.tradeHash?.substring(0, 16)}...`);
  console.log(`   验证: ${trade.verified ? '✅' : '❌'}\n`);
});

// ========== 测试 4: 生成交易区块 ==========

console.log('==========================================');
console.log('⛓️  测试 4: 生成交易区块（类似区块链）');
console.log('==========================================\n');

const block1 = generateTradeBlock(1, tradesWithHashes.slice(0, 2));
const block2 = generateTradeBlock(2, tradesWithHashes.slice(2), block1.blockHash);

console.log(`区块 #${block1.blockNumber}:`);
console.log(`- 交易数量: ${block1.trades.length}`);
console.log(`- 区块哈希: 0x${block1.blockHash.substring(0, 16)}...`);
console.log(`- 前一区块: 0x${block1.previousBlockHash.substring(0, 16)}...`);
console.log(`- Merkle Root: 0x${block1.merkleRoot.substring(0, 16)}...`);
console.log(`- 时间戳: ${new Date(block1.timestamp).toLocaleString()}\n`);

console.log(`区块 #${block2.blockNumber}:`);
console.log(`- 交易数量: ${block2.trades.length}`);
console.log(`- 区块哈希: 0x${block2.blockHash.substring(0, 16)}...`);
console.log(`- 前一区块: 0x${block2.previousBlockHash.substring(0, 16)}...`);
console.log(`  ↑ 链接到区块 #${block1.blockNumber} ✅`);
console.log(`- Merkle Root: 0x${block2.merkleRoot.substring(0, 16)}...`);
console.log(`- 时间戳: ${new Date(block2.timestamp).toLocaleString()}\n`);

// ========== 测试 5: 验证区块链完整性 ==========

console.log('==========================================');
console.log('✅ 测试 5: 验证区块链完整性');
console.log('==========================================\n');

const blockchain = [block1, block2];
const verification = verifyBlockchain(blockchain);

console.log(verification.message);
console.log(`\n区块链状态: ${verification.isValid ? '✅ 完整' : '❌ 损坏'}`);
console.log(`损坏的区块: ${verification.invalidBlocks.length > 0 ? verification.invalidBlocks.join(', ') : '无'}\n`);

// ========== 测试 6: 导出透明度数据 ==========

console.log('==========================================');
console.log('📤 测试 6: 导出透明度数据');
console.log('==========================================\n');

const exportData = exportTransparencyData(tradesWithHashes, {
  initialCapital: 10000,
  finalEquity: 12722.46,
  totalReturn: 27.22,
  timeRange: {
    start: Date.now() - 10800000,
    end: Date.now(),
  },
});

console.log('导出数据摘要:');
console.log(`- 格式版本: ${exportData.exportVersion}`);
console.log(`- 导出时间: ${new Date(exportData.exportTimestamp).toLocaleString()}`);
console.log(`- 总交易数: ${exportData.totalTrades}`);
console.log(`- 区块数量: ${exportData.blocks.length}`);
console.log(`- 初始资金: $${exportData.metadata.initialCapital.toLocaleString()}`);
console.log(`- 最终资产: $${exportData.metadata.finalEquity.toLocaleString()}`);
console.log(`- 总收益率: ${exportData.metadata.totalReturn.toFixed(2)}%\n`);

// 可选：保存为 JSON 文件
// import fs from 'fs';
// fs.writeFileSync('transparency.json', JSON.stringify(exportData, null, 2));
// console.log('✅ 已保存到 transparency.json\n');

// ========== 测试 7: 生成透明度报告 ==========

console.log('==========================================');
console.log('📊 测试 7: 生成人类可读的透明度报告');
console.log('==========================================\n');

const report = generateTransparencyReport(exportData);
console.log(report);

// ========== 总结 ==========

console.log('\n==========================================');
console.log('🎉 所有测试完成！');
console.log('==========================================\n');

console.log('✅ 已实现的功能:');
console.log('   1. 交易哈希生成（SHA-256）');
console.log('   2. 哈希验证（防篡改）');
console.log('   3. 批量哈希处理');
console.log('   4. 区块生成（链式结构）');
console.log('   5. 区块链验证');
console.log('   6. 数据导出（JSON 格式）');
console.log('   7. 透明度报告生成\n');

console.log('📝 如何在实际项目中使用:');
console.log('   1. 在交易完成时调用 generateTradeHash()');
console.log('   2. 将哈希存储到数据库');
console.log('   3. 定期生成区块（例如每100笔交易）');
console.log('   4. 导出数据供公众验证\n');

console.log('🌟 这就是链上透明度的力量：');
console.log('   - 完全透明：所有交易可查');
console.log('   - 无法作弊：数据无法篡改');
console.log('   - 可验证性：任何人都能验证\n');

console.log('🚀 下一步：集成到 tradingEngine.ts 中！\n');
