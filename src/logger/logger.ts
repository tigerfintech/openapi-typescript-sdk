/**
 * Logger - 日志接口和默认实现
 *
 * 定义 Logger 接口，支持注入自定义 logger 对象。
 * 默认实现使用 console 输出。
 */

/** 日志级别 */
export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

/** 日志接口 */
export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  setLevel(level: LogLevel): void;
}

/** 默认日志实现，使用 console 输出 */
export class DefaultLogger implements Logger {
  private level: LogLevel = LogLevel.Info;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(msg: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.Debug) {
      console.debug(`[tigeropen] [DEBUG] ${msg}`, ...args);
    }
  }

  info(msg: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.Info) {
      console.info(`[tigeropen] [INFO] ${msg}`, ...args);
    }
  }

  warn(msg: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.Warn) {
      console.warn(`[tigeropen] [WARN] ${msg}`, ...args);
    }
  }

  error(msg: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.Error) {
      console.error(`[tigeropen] [ERROR] ${msg}`, ...args);
    }
  }
}

/** 空日志实现，不输出任何内容 */
export class NopLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  setLevel(): void {}
}

/** 全局默认 logger */
let defaultLogger: Logger = new DefaultLogger();

/** 设置全局默认 logger */
export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}

/** 获取全局默认 logger */
export function getDefaultLogger(): Logger {
  return defaultLogger;
}
