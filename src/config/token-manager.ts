/**
 * TokenManager - Token 管理器
 *
 * 从 tiger_openapi_token.properties 文件加载 Token，
 * 支持后台定期刷新，更新内存和文件中的 Token。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { parsePropertiesString } from './config-parser';

/** 默认 Token 文件名 */
const DEFAULT_TOKEN_FILE = 'tiger_openapi_token.properties';
/** 默认刷新间隔（毫秒）：24 小时 */
const DEFAULT_REFRESH_INTERVAL = 24 * 60 * 60 * 1000;

/** TokenManager 配置选项 */
export interface TokenManagerOptions {
  filePath?: string;
  refreshInterval?: number;
  /** Token 刷新阈值（秒），0 表示不刷新，最小 30 秒 */
  refreshDuration?: number;
}

/** Token 刷新函数类型 */
export type RefreshFn = () => Promise<string>;

/**
 * Token 管理器
 */
export class TokenManager {
  private token = '';
  private filePath: string;
  private refreshInterval: number;
  private refreshDuration: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: TokenManagerOptions) {
    this.filePath = options?.filePath ?? DEFAULT_TOKEN_FILE;
    this.refreshInterval = options?.refreshInterval ?? DEFAULT_REFRESH_INTERVAL;
    let dur = options?.refreshDuration ?? 0;
    if (dur > 0 && dur < 30) {
      dur = 30;
    }
    this.refreshDuration = dur;
  }

  /** 从 properties 文件加载 Token */
  loadToken(): string {
    const content = readFileSync(this.filePath, 'utf-8');
    const props = parsePropertiesString(content);
    const token = props['token'];
    if (!token) {
      throw new Error('Token 文件中未找到 token 字段');
    }
    this.token = token;
    return token;
  }

  /** 获取当前 Token */
  getToken(): string {
    return this.token;
  }

  /** 设置 Token 并更新文件 */
  setToken(token: string): void {
    this.token = token;
    this.saveTokenToFile(token);
  }

  /** 将 Token 保存到 properties 文件 */
  private saveTokenToFile(token: string): void {
    const dir = dirname(this.filePath);
    if (dir && dir !== '.') {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, `token=${token}\n`, 'utf-8');
  }

  /**
   * 判断 Token 是否需要刷新。
   * 解码 base64 token，提取前 27 字符中的 gen_ts，
   * 当 (当前时间秒 - gen_ts/1000) > refreshDuration 时返回 true。
   */
  shouldTokenRefresh(): boolean {
    if (!this.token || this.refreshDuration === 0) {
      return false;
    }
    try {
      const decoded = Buffer.from(this.token, 'base64');
      if (decoded.length < 27) {
        return false;
      }
      const header = decoded.subarray(0, 27).toString('utf-8');
      const parts = header.split(',');
      if (parts.length < 2) {
        return false;
      }
      const genTs = parseInt(parts[0].trim(), 10);
      if (isNaN(genTs)) {
        return false;
      }
      return (Math.floor(Date.now() / 1000) - Math.floor(genTs / 1000)) > this.refreshDuration;
    } catch {
      return false;
    }
  }

  /** 启动后台定期刷新 */
  startAutoRefresh(refreshFn: RefreshFn): void {
    this.stopAutoRefresh();
    this.timer = setInterval(async () => {
      try {
        // 先检查是否需要刷新
        if (!this.shouldTokenRefresh()) {
          return;
        }
        const newToken = await refreshFn();
        if (newToken) {
          this.setToken(newToken);
        }
      } catch {
        // 刷新失败时静默跳过
      }
    }, this.refreshInterval);
  }

  /** 停止后台刷新 */
  stopAutoRefresh(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
