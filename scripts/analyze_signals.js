const fs = require('fs');
const path = require('path');

// 读取信号文件
const filePath = 'D:\\onedrive\\文档\\ProjectS\\flow-radar\\storage\\events\\DOGE_USDT_2026-01-19.jsonl';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.trim().split('\n');

// 统计变量
let bullishSignals = [];
let bearishSignals = [];
let neutralSignals = [];

// 解析每一行
for (const line of lines) {
  try {
    const event = JSON.parse(line);
    const type = event.type;
    const data = event.data || {};
    const ts = event.ts;

    // 只分析 iceberg 和 state 类型的信号
    if (type === 'iceberg') {
      const side = data.side;
      const level = data.level;
      const confidence = data.confidence || 0;
      const price = data.price || 0;

      // 只统计 CONFIRMED 级别
      if (level === 'CONFIRMED') {
        const signal = {
          type: 'ICEBERG_CONFIRMED',
          side,
          confidence,
          price,
          timestamp: ts,
          time: new Date(ts * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
        };

        if (side === 'BUY') {
          bullishSignals.push(signal);
        } else if (side === 'SELL') {
          bearishSignals.push(signal);
        }
      }
    }

    if (type === 'state') {
      const state = data.state;
      const confidence = data.confidence || 0;
      const price = data.price || 0;

      const signal = {
        type: 'KKING',
        state,
        confidence,
        price,
        timestamp: ts,
        time: new Date(ts * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
      };

      // 判断方向
      if (state === 'trend_up' || state === 'accumulating' || state === 'wash_accumulate') {
        signal.side = 'BUY';
        bullishSignals.push(signal);
      } else if (state === 'trend_down' || state === 'distributing' || state === 'trap_distribution') {
        signal.side = 'SELL';
        bearishSignals.push(signal);
      } else {
        signal.side = 'NEUTRAL';
        neutralSignals.push(signal);
      }
    }
  } catch (e) {
    // 忽略解析错误
  }
}

// 置信度分布统计
function getConfidenceStats(signals) {
  const total = signals.length;
  const gte60 = signals.filter(s => s.confidence >= 60).length;
  const gte75 = signals.filter(s => s.confidence >= 75).length;
  const gte90 = signals.filter(s => s.confidence >= 90).length;
  return { total, gte60, gte75, gte90 };
}

// 输出结果
console.log('===================================================================');
console.log('       DOGE/USDT Flow-Radar 信号分析报告 (2026-01-19)');
console.log('===================================================================');
console.log('');

console.log('📊 总体统计');
console.log('-------------------------------------------------------------------');
console.log(`总信号行数: ${lines.length}`);
console.log(`Bullish (看涨) 信号: ${bullishSignals.length} 次`);
console.log(`Bearish (看跌) 信号: ${bearishSignals.length} 次`);
console.log(`Neutral (中性) 信号: ${neutralSignals.length} 次`);
console.log(`Bullish : Bearish 比例: ${(bullishSignals.length / (bearishSignals.length || 1)).toFixed(2)} : 1`);
console.log('');

// Bullish 按类型分
const bullishIceberg = bullishSignals.filter(s => s.type === 'ICEBERG_CONFIRMED');
const bullishKKing = bullishSignals.filter(s => s.type === 'KKING');

console.log('📈 Bullish (看涨) 信号详情');
console.log('-------------------------------------------------------------------');
console.log(`  冰山单 CONFIRMED: ${bullishIceberg.length} 次`);
console.log(`  K神状态机 (trend_up/accumulating): ${bullishKKing.length} 次`);

const bullishStats = getConfidenceStats(bullishSignals);
if (bullishStats.total > 0) {
  console.log(`  置信度 >= 60%: ${bullishStats.gte60} 次 (${(bullishStats.gte60/bullishStats.total*100).toFixed(1)}%)`);
  console.log(`  置信度 >= 75%: ${bullishStats.gte75} 次 (${(bullishStats.gte75/bullishStats.total*100).toFixed(1)}%)`);
  console.log(`  置信度 >= 90%: ${bullishStats.gte90} 次 (${(bullishStats.gte90/bullishStats.total*100).toFixed(1)}%)`);
}
console.log('');

// Bearish 按类型分
const bearishIceberg = bearishSignals.filter(s => s.type === 'ICEBERG_CONFIRMED');
const bearishKKing = bearishSignals.filter(s => s.type === 'KKING');

console.log('📉 Bearish (看跌) 信号详情');
console.log('-------------------------------------------------------------------');
console.log(`  冰山单 CONFIRMED: ${bearishIceberg.length} 次`);
console.log(`  K神状态机 (trend_down/distributing): ${bearishKKing.length} 次`);

const bearishStats = getConfidenceStats(bearishSignals);
if (bearishStats.total > 0) {
  console.log(`  置信度 >= 60%: ${bearishStats.gte60} 次 (${(bearishStats.gte60/bearishStats.total*100).toFixed(1)}%)`);
  console.log(`  置信度 >= 75%: ${bearishStats.gte75} 次 (${(bearishStats.gte75/bearishStats.total*100).toFixed(1)}%)`);
  console.log(`  置信度 >= 90%: ${bearishStats.gte90} 次 (${(bearishStats.gte90/bearishStats.total*100).toFixed(1)}%)`);
}
console.log('');

// 最近的 bullish 信号
if (bullishSignals.length > 0) {
  const lastBullish = bullishSignals[bullishSignals.length - 1];
  console.log('🕐 最近一次 Bullish 信号');
  console.log('-------------------------------------------------------------------');
  console.log(`  时间: ${lastBullish.time}`);
  console.log(`  类型: ${lastBullish.type}`);
  console.log(`  置信度: ${lastBullish.confidence.toFixed(1)}%`);
  console.log(`  价格: $${lastBullish.price}`);
  if (lastBullish.state) {
    console.log(`  状态: ${lastBullish.state}`);
  }
  console.log('');
}

// 最近的 bearish 信号
if (bearishSignals.length > 0) {
  const lastBearish = bearishSignals[bearishSignals.length - 1];
  console.log('🕐 最近一次 Bearish 信号');
  console.log('-------------------------------------------------------------------');
  console.log(`  时间: ${lastBearish.time}`);
  console.log(`  类型: ${lastBearish.type}`);
  console.log(`  置信度: ${lastBearish.confidence.toFixed(1)}%`);
  console.log(`  价格: $${lastBearish.price}`);
  if (lastBearish.state) {
    console.log(`  状态: ${lastBearish.state}`);
  }
  console.log('');
}

// 高置信度 bullish 信号列表
const highConfBullish = bullishSignals.filter(s => s.confidence >= 75);
if (highConfBullish.length > 0) {
  console.log('⭐ 高置信度 (>=75%) Bullish 信号列表 (最近20条)');
  console.log('-------------------------------------------------------------------');
  console.log('时间                    | 类型             | 置信度  | 价格');
  console.log('------------------------|------------------|---------|--------');
  for (const s of highConfBullish.slice(-20)) {
    const typeStr = s.type.padEnd(16);
    const confStr = (s.confidence.toFixed(1) + '%').padStart(7);
    console.log(`${s.time} | ${typeStr} | ${confStr} | $${s.price}`);
  }
  console.log('');
}

// 高置信度 bearish 信号列表
const highConfBearish = bearishSignals.filter(s => s.confidence >= 75);
if (highConfBearish.length > 0) {
  console.log('⭐ 高置信度 (>=75%) Bearish 信号列表 (最近20条)');
  console.log('-------------------------------------------------------------------');
  console.log('时间                    | 类型             | 置信度  | 价格');
  console.log('------------------------|------------------|---------|--------');
  for (const s of highConfBearish.slice(-20)) {
    const typeStr = s.type.padEnd(16);
    const confStr = (s.confidence.toFixed(1) + '%').padStart(7);
    console.log(`${s.time} | ${typeStr} | ${confStr} | $${s.price}`);
  }
  console.log('');
}

// 统计时间分布
console.log('📅 信号时间分布 (按小时)');
console.log('-------------------------------------------------------------------');
const hourBuckets = {};
for (const s of [...bullishSignals, ...bearishSignals]) {
  const hour = new Date(s.timestamp * 1000).getHours();
  if (!hourBuckets[hour]) hourBuckets[hour] = { bullish: 0, bearish: 0 };
  if (s.side === 'BUY') hourBuckets[hour].bullish++;
  else hourBuckets[hour].bearish++;
}

const hours = Object.keys(hourBuckets).sort((a, b) => Number(a) - Number(b));
console.log('小时 | Bullish | Bearish | 比例');
console.log('-----|---------|---------|------');
for (const h of hours) {
  const b = hourBuckets[h];
  const ratio = b.bearish > 0 ? (b.bullish / b.bearish).toFixed(2) : 'N/A';
  console.log(`${h.padStart(4)} | ${String(b.bullish).padStart(7)} | ${String(b.bearish).padStart(7)} | ${ratio}`);
}

console.log('');
console.log('===================================================================');
console.log('分析完成！');
console.log('===================================================================');
