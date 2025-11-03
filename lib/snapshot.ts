// 数据快照功能 - 参考nof0设计

import { ModelPerformance, MarketData, CompletedTrade } from '@/types/trading';
import * as fs from 'fs';
import * as path from 'path';

export interface Snapshot {
  timestamp: number;
  date: string;
  performances: ModelPerformance[];
  marketData: MarketData[];
  completedTrades: CompletedTrade[];
  metadata: {
    version: string;
    dataSource: 'real' | 'simulated';
    totalDuration: number;
    snapshotCount: number;
  };
}

/**
 * 创建数据快照
 */
export function createSnapshot(
  performances: ModelPerformance[],
  marketData: MarketData[],
  completedTrades: CompletedTrade[] = [],
  dataSource: 'real' | 'simulated' = 'simulated'
): Snapshot {
  const now = new Date();

  return {
    timestamp: Date.now(),
    date: now.toISOString(),
    performances,
    marketData,
    completedTrades,
    metadata: {
      version: '1.0.0',
      dataSource,
      totalDuration: performances[0]?.equityHistory.length || 0,
      snapshotCount: 1,
    },
  };
}

/**
 * 保存快照到文件（仅服务端）
 */
export async function saveSnapshotToFile(snapshot: Snapshot): Promise<string> {
  if (typeof window !== 'undefined') {
    throw new Error('saveSnapshotToFile can only be called on the server');
  }

  const snapshotsDir = path.join(process.cwd(), 'snapshots');
  const dateDir = path.join(snapshotsDir, snapshot.date.split('T')[0]);

  // 创建目录
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir);
  }
  if (!fs.existsSync(dateDir)) {
    fs.mkdirSync(dateDir);
  }

  // 文件名：snapshots/2025-01-26/snapshot-14-30-45.json
  const filename = `snapshot-${new Date(snapshot.timestamp).toTimeString().split(' ')[0].replace(/:/g, '-')}.json`;
  const filepath = path.join(dateDir, filename);

  // 写入文件
  fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));

  return filepath;
}

/**
 * 加载快照
 */
export async function loadSnapshot(filepath: string): Promise<Snapshot> {
  if (typeof window !== 'undefined') {
    throw new Error('loadSnapshot can only be called on the server');
  }

  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 获取所有快照列表
 */
export async function listSnapshots(): Promise<string[]> {
  if (typeof window !== 'undefined') {
    throw new Error('listSnapshots can only be called on the server');
  }

  const snapshotsDir = path.join(process.cwd(), 'snapshots');

  if (!fs.existsSync(snapshotsDir)) {
    return [];
  }

  const snapshots: string[] = [];
  const dates = fs.readdirSync(snapshotsDir);

  for (const date of dates) {
    const dateDir = path.join(snapshotsDir, date);
    const files = fs.readdirSync(dateDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        snapshots.push(path.join(dateDir, file));
      }
    }
  }

  return snapshots.sort().reverse(); // 最新的在前
}

/**
 * 浏览器端：下载快照为JSON文件
 */
export function downloadSnapshotInBrowser(snapshot: Snapshot, filename?: string) {
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `alpha-arena-snapshot-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 浏览器端：加载快照文件
 */
export async function loadSnapshotFromFile(file: File): Promise<Snapshot> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const snapshot = JSON.parse(content);
        resolve(snapshot);
      } catch (error) {
        reject(new Error('Invalid snapshot file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
