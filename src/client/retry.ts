/**
 * 重试策略模块
 *
 * 提供指数退避重试策略，交易操作（place_order/modify_order/cancel_order）跳过重试。
 */

/** 交易操作方法名集合 */
const TRADE_OPERATIONS = new Set(['place_order', 'modify_order', 'cancel_order']);

/**
 * 判断是否为交易操作
 */
export function isTradeOperation(apiMethod: string): boolean {
  return TRADE_OPERATIONS.has(apiMethod);
}

/**
 * 重试策略
 */
export class RetryPolicy {
  /** 最大重试次数，默认 5 */
  maxRetries: number;
  /** 最大重试总时间（毫秒），默认 60000 */
  maxRetryTime: number;
  /** 基础退避时间（毫秒），默认 1000 */
  baseDelay: number;
  /** 最大单次退避时间（毫秒），默认 16000 */
  maxDelay: number;

  constructor(options?: Partial<RetryPolicy>) {
    this.maxRetries = options?.maxRetries ?? 5;
    this.maxRetryTime = options?.maxRetryTime ?? 60000;
    this.baseDelay = options?.baseDelay ?? 1000;
    this.maxDelay = options?.maxDelay ?? 16000;
  }

  /**
   * 判断指定的 API 方法是否应该重试。
   * 交易操作跳过重试。
   */
  shouldRetry(apiMethod: string): boolean {
    return !isTradeOperation(apiMethod);
  }

  /**
   * 计算第 n 次重试的退避等待时间（毫秒，从 0 开始计数）。
   * 退避公式：min(2^n * baseDelay, maxDelay)
   */
  calculateBackoff(retryCount: number): number {
    if (retryCount < 0) {
      return this.baseDelay;
    }
    const delay = Math.pow(2, retryCount) * this.baseDelay;
    return Math.min(delay, this.maxDelay);
  }
}

/**
 * 返回默认重试策略
 */
export function defaultRetryPolicy(): RetryPolicy {
  return new RetryPolicy();
}
