/**
 * 测试 Sentinel 启动和信号监听
 */

import * as fs from 'fs';
import * as path from 'path';
import { getFlowRadarPath, clearPathCache } from '../lib/flowRadar/pathDetector';

async function main() {
  console.log('='.repeat(60));
  console.log('Sentinel 启动测试');
  console.log('='.repeat(60));
  console.log('');

  // 清除缓存
  clearPathCache();

  // 模拟 Sentinel.start() 逻辑
  console.log('【模拟 Sentinel.start() 逻辑】');
  console.log('-'.repeat(40));

  // 获取 Flow-Radar 信号文件路径
  const flowRadarPath = getFlowRadarPath();

  if (!flowRadarPath.found || !flowRadarPath.eventsPath) {
    console.error('[Sentinel] ❌ 无法找到 Flow-Radar 信号路径');
    console.error(`  错误: ${flowRadarPath.error}`);
    return;
  }

  console.log(`[Sentinel] ✅ 找到 Flow-Radar 路径: ${flowRadarPath.path}`);

  // 找到今天的信号文件
  const today = new Date().toISOString().split('T')[0];
  const signalFile = `DOGE_USDT_${today}.jsonl`;
  const signalFilePath = path.join(flowRadarPath.eventsPath, signalFile);

  console.log(`[Sentinel] 查找文件: ${signalFile}`);
  console.log(`[Sentinel] 完整路径: ${signalFilePath}`);

  // 检查文件是否存在
  if (!fs.existsSync(signalFilePath)) {
    // 尝试 .gz 文件
    const gzFile = signalFilePath + '.gz';
    if (fs.existsSync(gzFile)) {
      console.log(`[Sentinel] 📁 找到压缩信号文件: ${gzFile}`);
      console.log(`[Sentinel] ⚠️ 压缩文件需要特殊处理（当前 Sentinel 不支持实时读取 .gz）`);
    } else {
      console.log(`[Sentinel] ⏳ 等待信号文件: ${signalFilePath}`);
      console.log(`[Sentinel] ❌ 文件不存在！`);
    }
    return;
  }

  console.log(`[Sentinel] ✅ 信号文件存在`);

  // 获取当前文件大小
  const stats = fs.statSync(signalFilePath);
  console.log(`[Sentinel] 📊 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[Sentinel] 📊 最后修改: ${stats.mtime.toISOString()}`);

  // 检查文件内容
  console.log('');
  console.log('【文件内容检查】');
  console.log('-'.repeat(40));

  // 统计信号类型
  const content = fs.readFileSync(signalFilePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  let icebergCount = 0;
  let stateCount = 0;
  let kkingCount = 0;
  let otherCount = 0;
  let parseErrors = 0;

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      const eventType = event.type || event.event_type || '';

      if (eventType === 'iceberg' || eventType.includes('iceberg')) {
        icebergCount++;
      } else if (eventType === 'state') {
        stateCount++;
      } else if (eventType.includes('kking') || eventType.includes('K神')) {
        kkingCount++;
      } else {
        otherCount++;
      }
    } catch (e) {
      parseErrors++;
    }
  }

  console.log(`  总行数: ${lines.length}`);
  console.log(`  冰山信号: ${icebergCount}`);
  console.log(`  状态信号: ${stateCount}`);
  console.log(`  K神信号: ${kkingCount}`);
  console.log(`  其他类型: ${otherCount}`);
  console.log(`  解析错误: ${parseErrors}`);

  // 检查 Sentinel 的信号解析逻辑
  console.log('');
  console.log('【Sentinel 信号解析模拟】');
  console.log('-'.repeat(40));

  // 取最近 10 条信号，模拟 Sentinel 的 parseSignal 逻辑
  const recentLines = lines.slice(-10);
  let parsedCount = 0;
  let skippedCount = 0;

  for (const line of recentLines) {
    try {
      const raw = JSON.parse(line);
      const result = simulateParseSignal(raw);

      if (result) {
        parsedCount++;
        console.log(`  ✅ 解析成功: ${result.type} ${result.direction} (置信度: ${result.confidence}%)`);
      } else {
        skippedCount++;
        console.log(`  ⏭️  跳过: ${raw.type || 'unknown'} (无法识别)`);
      }
    } catch (e) {
      console.log(`  ❌ 解析失败`);
    }
  }

  console.log('');
  console.log(`  解析成功: ${parsedCount}`);
  console.log(`  跳过: ${skippedCount}`);

  console.log('');
  console.log('='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
}

/**
 * 模拟修复后的 Sentinel parseSignal 逻辑
 */
function simulateParseSignal(raw: any): { type: string; direction: string; confidence: number } | null {
  const eventType = raw.event_type || raw.type || '';
  const data = raw.data || {};

  let type = 'UNKNOWN';
  let direction = 'NEUTRAL';
  let confidence = 0;

  // 冰山单信号
  if (eventType === 'iceberg' || eventType.includes('iceberg') || eventType.includes('ICEBERG')) {
    const level = data.level || raw.level || '';
    if (level === 'CONFIRMED' || level === 'confirmed_iceberg' || eventType.includes('CONFIRMED')) {
      type = 'ICEBERG_CONFIRMED';
      confidence = data.confidence || 70;
    } else {
      type = 'ICEBERG_DETECTED';
      confidence = data.confidence || 50;
    }

    const side = data.side || raw.side || '';
    if (side === 'buy' || side === 'BUY') {
      direction = 'LONG';
    } else if (side === 'sell' || side === 'SELL') {
      direction = 'SHORT';
    }
  }

  // 状态机信号（K神战法）
  if (eventType === 'state') {
    type = 'KKING';
    confidence = data.confidence || 50;

    const state = data.state || '';
    if (state === 'trend_up' || state === 'accumulating' || state === 'wash_accumulate') {
      direction = 'LONG';
    } else if (state === 'trend_down' || state === 'distributing' || state === 'trap_distribution') {
      direction = 'SHORT';
    }
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
    confidence = raw.confidence || data.confidence || raw.置信度 || 50;

    if (raw.bias === 'bullish' || raw.direction === 'bullish') {
      direction = 'LONG';
      type = 'ICEBERG_CONFIRMED';
    } else if (raw.bias === 'bearish' || raw.direction === 'bearish') {
      direction = 'SHORT';
      type = 'ICEBERG_CONFIRMED';
    }
  }

  if (type === 'UNKNOWN' || direction === 'NEUTRAL') {
    return null;
  }

  return { type, direction, confidence };
}

main().catch(console.error);
