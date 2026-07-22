/**
 * 重试策略测试
 *
 * 包含 Property 9（指数退避时间计算）和 Property 10（交易操作跳过重试）的属性测试。
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { RetryPolicy, defaultRetryPolicy, isTradeOperation } from '../../src/client/retry';

/**
 * Feature: multi-language-sdks, Property 9: 指数退避时间计算
 *
 * 对于任意重试次数 n（0 ≤ n < 最大重试次数），
 * 计算的退避等待时间应等于 min(2^n * baseDelay, maxDelay) 毫秒。
 *
 * **Validates: Requirements 11.3**
 */
describe('Property 9: 指数退避时间计算', () => {
  it('退避时间 = min(2^n * baseDelay, maxDelay)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        (retryCount) => {
          const policy = defaultRetryPolicy();
          const backoff = policy.calculateBackoff(retryCount);
          const expected = Math.min(
            Math.pow(2, retryCount) * policy.baseDelay,
            policy.maxDelay,
          );
          expect(backoff).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('默认策略退避序列：1s→2s→4s→8s→16s', () => {
    const policy = defaultRetryPolicy();
    expect(policy.calculateBackoff(0)).toBe(1000);
    expect(policy.calculateBackoff(1)).toBe(2000);
    expect(policy.calculateBackoff(2)).toBe(4000);
    expect(policy.calculateBackoff(3)).toBe(8000);
    expect(policy.calculateBackoff(4)).toBe(16000);
  });

  it('退避时间不超过 maxDelay', () => {
    const policy = defaultRetryPolicy();
    expect(policy.calculateBackoff(10)).toBe(policy.maxDelay);
  });

  it('负数重试次数返回 baseDelay', () => {
    const policy = defaultRetryPolicy();
    expect(policy.calculateBackoff(-1)).toBe(policy.baseDelay);
  });
});

/**
 * Feature: multi-language-sdks, Property 10: 交易操作跳过重试
 *
 * 对于任意服务类型标识，当且仅当该标识属于 {place_order, modify_order, cancel_order} 时，
 * 重试策略应返回"不重试"。
 *
 * **Validates: Requirements 11.4**
 */
describe('Property 10: 交易操作跳过重试', () => {
  const tradeOps = ['place_order', 'modify_order', 'cancel_order'];
  const nonTradeOps = [
    'market_state', 'brief', 'kline', 'timeline',
    'trade_tick', 'quote_depth', 'positions', 'assets',
    'option_expiration', 'future_contracts',
  ];

  it('交易操作不应重试', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...tradeOps),
        (method) => {
          const policy = defaultRetryPolicy();
          expect(policy.shouldRetry(method)).toBe(false);
          expect(isTradeOperation(method)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('非交易操作应重试', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...nonTradeOps),
        (method) => {
          const policy = defaultRetryPolicy();
          expect(policy.shouldRetry(method)).toBe(true);
          expect(isTradeOperation(method)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('任意非交易方法名应重试', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(
          (s) => !tradeOps.includes(s),
        ),
        (method) => {
          const policy = defaultRetryPolicy();
          expect(policy.shouldRetry(method)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
