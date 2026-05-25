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
  /** 自定义 token 加载函数，优先于文件加载 */
  tokenLoader?: () => Promise<string> | string;
  /** token 写入后的回调（SetToken 成功后触发，SyncToken 不触发） */
  tokenWriter?: (token: string) => void;
}

/** Token 刷新函数类型 */
export type RefreshFn = () => Promise<string>;

/**
 * Token 管理器
 */
export class TokenManager {
  private token = '';
  private filePath: string;
  /** 仅当显式传入 filePath 时才写文件（fileEnabled = true） */
  private fileEnabled: boolean;
  private refreshInterval: number;
  private refreshDuration: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tokenLoader: (() => Promise<string> | string) | undefined;
  private tokenWriter: ((token: string) => void) | undefined;

  constructor(options?: TokenManagerOptions) {
    this.fileEnabled = options?.filePath !== undefined;
    this.filePath = options?.filePath ?? DEFAULT_TOKEN_FILE;
    this.refreshInterval = options?.refreshInterval ?? DEFAULT_REFRESH_INTERVAL;
    let dur = options?.refreshDuration ?? 0;
    if (dur > 0 && dur < 30) {
      dur = 30;
    }
    this.refreshDuration = dur;
    this.tokenLoader = options?.tokenLoader;
    this.tokenWriter = options?.tokenWriter;
  }

  /**
   * 从 properties 文件（或自定义 tokenLoader）加载 Token。
   * 若设置了 tokenLoader，优先调用；否则从 properties 文件读取。
   */
  async loadToken(): Promise<string> {
    if (this.tokenLoader) {
      const token = await this.tokenLoader();
      if (!token) {
        throw new Error('自定义 tokenLoader 返回空值');
      }
      this.token = token;
      return token;
    }
    const content = readFileSync(this.filePath, 'utf-8');
    const props = parsePropertiesString(content);
    const token = props['token'];
    if (!token) {
      throw new Error('Token 文件中未找到 token 字段');
    }
    this.token = token;
    return token;
  }

  /**
   * 同步版文件加载（仅用于无 tokenLoader 时的兼容入口）。
   * 建议优先使用 loadToken()（异步）。
   */
  loadTokenSync(): string {
    if (this.tokenLoader) {
      throw new Error('tokenLoader 是异步函数，请使用 loadToken()');
    }
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

  /**
   * 设置 Token；若启用了文件持久化（显式传入 filePath），则同步写文件。
   * 成功后触发 tokenWriter 回调（如有）。
   */
  setToken(token: string): void {
    this.token = token;
    if (this.fileEnabled) {
      this.saveTokenToFile(token);
    }
    if (this.tokenWriter) {
      this.tokenWriter(token);
    }
  }

  /**
   * 仅更新内存中的 token，不写文件，不触发 tokenWriter 回调。
   * 用于多个组件共享 token 时的内部同步。
   */
  syncToken(token: string): void {
    this.token = token;
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
    // 防止 timer 阻止 Node.js 进程退出
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /** 停止后台刷新 */
  stopAutoRefresh(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
