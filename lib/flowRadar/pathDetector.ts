/**
 * Flow-Radar 路径自动检测模块
 * 自动查找 Flow-Radar 项目位置
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 检测结果
export interface PathDetectionResult {
  found: boolean;
  path: string | null;
  signalsPath: string | null;
  eventsPath: string | null;
  error?: string;
}

// 常见路径候选
const CANDIDATE_PATHS = [
  // 相对路径
  '../flow-radar',
  '../../flow-radar',
  '../Flow-Radar',
  '../../Flow-Radar',
  // 同级目录
  '../flow-radar',
  // 绝对路径（Windows）
  'D:/projects/flow-radar',
  'D:/projects/Flow-Radar',
  'C:/projects/flow-radar',
  'E:/projects/flow-radar',
];

// OneDrive 路径候选
function getOneDrivePaths(): string[] {
  const home = os.homedir();
  const candidates: string[] = [];

  // Windows OneDrive 常见路径
  const oneDrivePaths = [
    path.join(home, 'OneDrive'),
    path.join(home, 'OneDrive - Personal'),
    path.join(home, 'OneDrive - Business'),
    path.join(home, 'OneDrive - 个人'),
    process.env.OneDrive || '',
    process.env.OneDriveConsumer || '',
    process.env.OneDriveCommercial || '',
  ].filter(Boolean);

  for (const oneDrive of oneDrivePaths) {
    if (oneDrive) {
      candidates.push(path.join(oneDrive, 'projects', 'flow-radar'));
      candidates.push(path.join(oneDrive, 'Projects', 'flow-radar'));
      candidates.push(path.join(oneDrive, 'flow-radar'));
      // 中文路径
      candidates.push(path.join(oneDrive, '文档', 'ProjectS', 'flow-radar'));
      candidates.push(path.join(oneDrive, '文档', 'projects', 'flow-radar'));
    }
  }

  // 直接添加已知的 OneDrive 路径
  candidates.push('D:/onedrive/文档/ProjectS/flow-radar');

  return candidates;
}

/**
 * 验证 Flow-Radar 路径是否有效
 */
function validateFlowRadarPath(basePath: string): PathDetectionResult {
  try {
    const normalizedPath = path.resolve(basePath);

    // 检查基础目录
    if (!fs.existsSync(normalizedPath)) {
      return { found: false, path: null, signalsPath: null, eventsPath: null };
    }

    // 检查 storage 目录
    const storagePath = path.join(normalizedPath, 'storage');
    if (!fs.existsSync(storagePath)) {
      return { found: false, path: null, signalsPath: null, eventsPath: null };
    }

    // 检查 events 目录（主要信号存储位置）
    const eventsPath = path.join(storagePath, 'events');
    const signalsPath = path.join(storagePath, 'signals');

    // events 目录必须存在
    if (!fs.existsSync(eventsPath)) {
      return { found: false, path: null, signalsPath: null, eventsPath: null };
    }

    // 验证是否有 config/settings.py（确认是 Flow-Radar 项目）
    const configPath = path.join(normalizedPath, 'config', 'settings.py');
    if (!fs.existsSync(configPath)) {
      return {
        found: false,
        path: null,
        signalsPath: null,
        eventsPath: null,
        error: '目录存在但不是有效的 Flow-Radar 项目',
      };
    }

    return {
      found: true,
      path: normalizedPath,
      signalsPath: fs.existsSync(signalsPath) ? signalsPath : null,
      eventsPath,
    };
  } catch {
    return { found: false, path: null, signalsPath: null, eventsPath: null };
  }
}

/**
 * 自动检测 Flow-Radar 路径
 */
export function detectFlowRadarPath(): PathDetectionResult {
  console.log('[FlowRadar] 🔍 开始自动检测 Flow-Radar 路径...');

  // 1. 首先检查环境变量
  const envPath = process.env.FLOW_RADAR_PATH;
  if (envPath) {
    console.log(`[FlowRadar] 📁 检查环境变量路径: ${envPath}`);
    const result = validateFlowRadarPath(envPath);
    if (result.found) {
      console.log(`[FlowRadar] ✅ 通过环境变量找到: ${result.path}`);
      return result;
    } else {
      console.log(`[FlowRadar] ⚠️ 环境变量路径无效: ${envPath}`);
    }
  }

  // 2. 检查常见相对路径
  const cwd = process.cwd();
  for (const candidate of CANDIDATE_PATHS) {
    const fullPath = path.resolve(cwd, candidate);
    const result = validateFlowRadarPath(fullPath);
    if (result.found) {
      console.log(`[FlowRadar] ✅ 在相对路径找到: ${result.path}`);
      return result;
    }
  }

  // 3. 检查 OneDrive 路径
  const oneDrivePaths = getOneDrivePaths();
  for (const candidate of oneDrivePaths) {
    if (candidate) {
      const result = validateFlowRadarPath(candidate);
      if (result.found) {
        console.log(`[FlowRadar] ✅ 在 OneDrive 找到: ${result.path}`);
        return result;
      }
    }
  }

  // 4. 未找到
  console.log('[FlowRadar] ❌ 未找到 Flow-Radar 项目');
  console.log('[FlowRadar] 💡 提示: 设置环境变量 FLOW_RADAR_PATH 指定路径');

  return {
    found: false,
    path: null,
    signalsPath: null,
    eventsPath: null,
    error: '未找到 Flow-Radar 项目。请设置 FLOW_RADAR_PATH 环境变量。',
  };
}

/**
 * 获取最新的事件文件列表
 */
export function getLatestEventFiles(eventsPath: string, limit: number = 3): string[] {
  try {
    const files = fs.readdirSync(eventsPath)
      .filter(f => f.endsWith('.jsonl.gz') || f.endsWith('.jsonl'))
      .map(f => ({
        name: f,
        path: path.join(eventsPath, f),
        mtime: fs.statSync(path.join(eventsPath, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, limit)
      .map(f => f.path);

    return files;
  } catch {
    return [];
  }
}

/**
 * 获取今日事件文件路径
 */
export function getTodayEventFile(eventsPath: string, symbol: string = 'DOGE_USDT'): string | null {
  const today = new Date().toISOString().split('T')[0];
  const filename = `${symbol}_${today}.jsonl.gz`;
  const filepath = path.join(eventsPath, filename);

  if (fs.existsSync(filepath)) {
    return filepath;
  }

  // 尝试未压缩版本
  const uncompressedPath = filepath.replace('.gz', '');
  if (fs.existsSync(uncompressedPath)) {
    return uncompressedPath;
  }

  return null;
}

// 单例缓存
let cachedPath: PathDetectionResult | null = null;

/**
 * 获取 Flow-Radar 路径（带缓存）
 */
export function getFlowRadarPath(): PathDetectionResult {
  if (!cachedPath) {
    cachedPath = detectFlowRadarPath();
  }
  return cachedPath;
}

/**
 * 清除缓存（用于测试或重新检测）
 */
export function clearPathCache(): void {
  cachedPath = null;
}
