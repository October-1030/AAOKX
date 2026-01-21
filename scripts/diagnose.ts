/**
 * 诊断脚本 - 检查为什么不下单
 */

import * as fs from 'fs';
import * as path from 'path';

console.log('='.repeat(60));
console.log('🔍 AAOKX 诊断报告');
console.log('='.repeat(60));
console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);
console.log('');

// 1. 检查 Flow-Radar 路径
console.log('【1】Flow-Radar 路径检测');
console.log('-'.repeat(40));

import { getFlowRadarPath } from '../lib/flowRadar/pathDetector';
const flowRadarPath = getFlowRadarPath();

console.log(`找到: ${flowRadarPath.found}`);
console.log(`路径: ${flowRadarPath.path}`);
console.log(`signals 目录: ${flowRadarPath.signalsPath}`);
console.log(`events 目录: ${flowRadarPath.eventsPath}`);
console.log('');

// 2. 检查今日信号文件
console.log('【2】信号文件检测');
console.log('-'.repeat(40));

const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
console.log(`今日日期 (本地): ${today}`);

if (flowRadarPath.signalsPath) {
  const signalFile = path.join(flowRadarPath.signalsPath, `${today}.jsonl`);
  console.log(`信号文件路径: ${signalFile}`);

  if (fs.existsSync(signalFile)) {
    const stats = fs.statSync(signalFile);
    console.log(`文件存在: ✅`);
    console.log(`文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`最后修改: ${stats.mtime.toLocaleString('zh-CN')}`);

    // 读取最后几行
    const content = fs.readFileSync(signalFile, 'utf-8');
    const lines = content.trim().split('\n');
    console.log(`信号总数: ${lines.length}`);

    // 最后 3 条信号
    console.log('');
    console.log('最近 3 条信号:');
    const lastLines = lines.slice(-3);
    lastLines.forEach((line, i) => {
      try {
        const sig = JSON.parse(line);
        console.log(`  [${i+1}] type=${sig.signal_type}, dir=${sig.direction}, conf=${sig.confidence}, level=${sig.data?.level}, symbol=${sig.symbol}`);
      } catch (e) {
        console.log(`  [${i+1}] 解析失败`);
      }
    });

    // 统计 DOGE CONFIRMED 信号
    let dogeConfirmedCount = 0;
    let dogeBullishConfirmedCount = 0;
    lines.forEach(line => {
      try {
        const sig = JSON.parse(line);
        if (sig.symbol?.includes('DOGE') && sig.data?.level === 'CONFIRMED') {
          dogeConfirmedCount++;
          if (sig.direction === 'bullish') {
            dogeBullishConfirmedCount++;
          }
        }
      } catch (e) {}
    });
    console.log('');
    console.log(`DOGE CONFIRMED 信号: ${dogeConfirmedCount}`);
    console.log(`DOGE CONFIRMED bullish: ${dogeBullishConfirmedCount}`);
  } else {
    console.log(`文件存在: ❌ 未找到!`);

    // 列出目录中的文件
    const files = fs.readdirSync(flowRadarPath.signalsPath);
    console.log(`目录中的文件: ${files.slice(-5).join(', ')}`);
  }
}

console.log('');

// 3. 测试信号解析
console.log('【3】信号解析测试');
console.log('-'.repeat(40));

// 模拟一个信号
const testSignal = {
  signal_type: 'iceberg_detected',
  direction: 'bullish',
  confidence: 75,
  symbol: 'DOGE/USDT',
  data: {
    level: 'CONFIRMED',
    side: 'BUY',
    price: 0.128
  }
};

console.log('测试信号:', JSON.stringify(testSignal, null, 2));

// 检查解析逻辑
const eventType = testSignal.signal_type;
const rawDirection = testSignal.direction;
const level = testSignal.data.level;
const confidence = testSignal.confidence;

console.log('');
console.log('解析结果:');
console.log(`  eventType: ${eventType} (包含 "iceberg": ${eventType.includes('iceberg')})`);
console.log(`  rawDirection: ${rawDirection} → ${rawDirection === 'bullish' ? 'LONG' : 'SHORT'}`);
console.log(`  level: ${level} → ${level === 'CONFIRMED' ? 'ICEBERG_CONFIRMED' : 'ICEBERG_DETECTED'}`);
console.log(`  confidence: ${confidence}%`);

// 检查置信度门槛
const MIN_CONFIDENCE = 50;
const mainChannelPass = confidence >= MIN_CONFIDENCE;
console.log('');
console.log('门槛检查:');
console.log(`  主通道 (${confidence}% >= ${MIN_CONFIDENCE}%): ${mainChannelPass ? '✅ 通过' : '❌ 不通过'}`);

console.log('');

// 4. 检查 Sentinel 配置
console.log('【4】Sentinel 配置');
console.log('-'.repeat(40));

try {
  // 动态导入会触发模块加载
  const sentinelModule = require('../lib/signals/sentinel');
  const config = sentinelModule.SENTINEL_CONFIG;

  console.log(`MIN_CONFIDENCE: ${config.MIN_CONFIDENCE}%`);
  console.log(`EXCEPTION_CHANNEL.MIN_CONFIDENCE: ${config.EXCEPTION_CHANNEL?.MIN_CONFIDENCE}%`);
  console.log(`EXCEPTION_CHANNEL.MIN_CONFIRM_RATIO: ${config.EXCEPTION_CHANNEL?.MIN_CONFIRM_RATIO}`);
  console.log(`SIGNAL_COOLDOWN_MS: ${config.SIGNAL_COOLDOWN_MS}ms`);
  console.log(`TRIAL_START_DATE: ${config.TRIAL_START_DATE}`);
  console.log(`POSITION.TRIAL_DAY_1_3_PCT: ${config.POSITION?.TRIAL_DAY_1_3_PCT}%`);
} catch (e) {
  console.log(`加载 Sentinel 配置失败: ${e}`);
}

console.log('');
console.log('='.repeat(60));
console.log('诊断完成');
console.log('='.repeat(60));
