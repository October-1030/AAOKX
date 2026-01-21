/**
 * 测试 Flow-Radar 信号路径检测和读取
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { getFlowRadarPath, getTodayEventFile, getLatestEventFiles, clearPathCache } from '../lib/flowRadar/pathDetector';

async function main() {
  console.log('='.repeat(60));
  console.log('Flow-Radar 信号路径检测测试');
  console.log('='.repeat(60));
  console.log('');

  // 清除缓存，强制重新检测
  clearPathCache();

  // 1. 检测路径
  console.log('【1】路径检测');
  console.log('-'.repeat(40));
  const pathResult = getFlowRadarPath();

  console.log(`  found: ${pathResult.found}`);
  console.log(`  path: ${pathResult.path}`);
  console.log(`  eventsPath: ${pathResult.eventsPath}`);
  console.log(`  signalsPath: ${pathResult.signalsPath}`);
  console.log(`  error: ${pathResult.error || '无'}`);
  console.log('');

  if (!pathResult.found || !pathResult.eventsPath) {
    console.log('❌ 路径检测失败！');
    return;
  }

  // 2. 检查今日事件文件
  console.log('【2】今日事件文件');
  console.log('-'.repeat(40));
  const today = new Date().toISOString().split('T')[0];
  console.log(`  今日日期: ${today}`);

  // Sentinel 使用的文件名格式
  const sentinelFileName = `DOGE_USDT_${today}.jsonl`;
  const sentinelFilePath = path.join(pathResult.eventsPath, sentinelFileName);

  console.log(`  Sentinel 查找的文件: ${sentinelFileName}`);
  console.log(`  完整路径: ${sentinelFilePath}`);
  console.log(`  文件存在: ${fs.existsSync(sentinelFilePath)}`);

  // 使用 getTodayEventFile
  const todayFile = getTodayEventFile(pathResult.eventsPath, 'DOGE_USDT');
  console.log(`  getTodayEventFile 返回: ${todayFile}`);
  console.log('');

  // 3. 最新事件文件列表
  console.log('【3】最新事件文件');
  console.log('-'.repeat(40));
  const latestFiles = getLatestEventFiles(pathResult.eventsPath, 5);
  latestFiles.forEach((f, i) => {
    const stats = fs.statSync(f);
    console.log(`  ${i + 1}. ${path.basename(f)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  });
  console.log('');

  // 4. 读取最近 5 条信号
  console.log('【4】最近 5 条信号');
  console.log('-'.repeat(40));

  const targetFile = fs.existsSync(sentinelFilePath) ? sentinelFilePath : todayFile;

  if (!targetFile) {
    console.log('  ❌ 没有找到信号文件');

    // 检查 signals 目录
    if (pathResult.signalsPath) {
      const signalsFile = path.join(pathResult.signalsPath, `${today}.jsonl`);
      console.log(`  检查 signals 目录: ${signalsFile}`);
      console.log(`  文件存在: ${fs.existsSync(signalsFile)}`);

      if (fs.existsSync(signalsFile)) {
        console.log('');
        console.log('  ⚠️  注意：signals 目录中有今日文件，但 events 目录中没有');
        console.log('  这可能是文件命名格式不一致导致的问题');
      }
    }
    return;
  }

  console.log(`  读取文件: ${targetFile}`);
  console.log('');

  // 读取最后 5 行
  const lines = await readLastLines(targetFile, 5);

  lines.forEach((line, i) => {
    try {
      const signal = JSON.parse(line);
      console.log(`  信号 ${i + 1}:`);
      console.log(`    类型: ${signal.type || signal.signal_type || 'unknown'}`);
      console.log(`    方向: ${signal.data?.side || signal.direction || 'unknown'}`);
      console.log(`    价格: ${signal.data?.price || 'N/A'}`);
      console.log(`    置信度: ${signal.data?.confidence || signal.confidence || 'N/A'}%`);
      console.log(`    时间: ${formatTimestamp(signal.ts || signal.timestamp)}`);
      console.log('');
    } catch (e) {
      console.log(`  信号 ${i + 1}: 解析失败 - ${line.substring(0, 100)}...`);
    }
  });

  console.log('='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
}

async function readLastLines(filePath: string, count: number): Promise<string[]> {
  const lines: string[] = [];

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (line.trim()) {
        lines.push(line);
        if (lines.length > count) {
          lines.shift();
        }
      }
    });

    rl.on('close', () => resolve(lines));
    rl.on('error', reject);
  });
}

function formatTimestamp(ts: number | string): string {
  if (!ts) return 'N/A';

  // Unix 时间戳（秒）
  if (typeof ts === 'number') {
    const date = new Date(ts * 1000);
    return date.toISOString();
  }

  // ISO 字符串
  return String(ts);
}

main().catch(console.error);
