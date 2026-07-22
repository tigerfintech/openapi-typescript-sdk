/**
 * HttpClient 测试
 *
 * 包含 Property 6（API 响应解析与错误处理）和 Property 8（错误码分类正确性）的属性测试。
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseApiResponse } from '../../src/client/api-response';
import { TigerError, classifyErrorCode, type ErrorCategory } from '../../src/client/errors';

/**
 * Feature: multi-language-sdks, Property 6: API 响应解析与错误处理
 *
 * 对于任意有效的 JSON 响应字符串（包含 code、message、data 字段），
 * 当 code 为 0 时解析应成功返回 data；
 * 当 code 不为 0 时应返回包含对应 code 和 message 的结构化错误。
 *
 * **Validates: Requirements 3.5, 3.6**
 */
describe('Property 6: API 响应解析与错误处理', () => {
  it('code=0 时解析成功返回 data', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.jsonValue(),
        fc.integer({ min: 1000, max: 9999 }),
        (message, data, timestamp) => {
          const body = JSON.stringify({ code: 0, message, data, timestamp });
          const resp = parseApiResponse(body);
          expect(resp.code).toBe(0);
          // Compare via JSON round-trip so -0 vs +0 (not preserved by
          // JSON.stringify) doesn't cause a false negative.
          expect(JSON.stringify(resp.data)).toBe(JSON.stringify(data));
          expect(resp.message).toBe(message);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('code!=0 时抛出 TigerError', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9999 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.jsonValue(),
        fc.integer({ min: 1000, max: 9999 }),
        (code, message, data, timestamp) => {
          const body = JSON.stringify({ code, message, data, timestamp });
          try {
            parseApiResponse(body);
            expect.unreachable('应该抛出 TigerError');
          } catch (e) {
            expect(e).toBeInstanceOf(TigerError);
            const err = e as TigerError;
            expect(err.code).toBe(code);
            expect(err.message).toBe(message);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: multi-language-sdks, Property 8: 错误码分类正确性
 *
 * 对于任意已知的 API 错误码，SDK 返回的错误类别应与错误码对应的预定义分类一致。
 *
 * **Validates: Requirements 8.2, 8.3, 8.4, 8.5**
 */
describe('Property 8: 错误码分类正确性', () => {
  /** 错误码 → 预期分类映射 */
  const codeToCategory: Array<[number, ErrorCategory]> = [
    [0, 'success'],
    [5, 'rate_limit'],
    [1000, 'common_param_error'],
    [1005, 'common_param_error'],
    [1010, 'biz_param_error'],
    [1050, 'biz_param_error'],
    [1100, 'trade_global_error'],
    [1150, 'trade_global_error'],
    [1200, 'trade_prime_error'],
    [1250, 'trade_prime_error'],
    [1300, 'trade_simulation_error'],
    [1500, 'trade_simulation_error'],
    [2100, 'quote_stock_error'],
    [2150, 'quote_stock_error'],
    [2200, 'quote_option_error'],
    [2250, 'quote_option_error'],
    [2300, 'quote_future_error'],
    [2350, 'quote_future_error'],
    [2400, 'token_error'],
    [3000, 'token_error'],
    [4000, 'permission_error'],
    [4500, 'permission_error'],
  ];

  it('已知错误码分类正确', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...codeToCategory),
        ([code, expected]) => {
          expect(classifyErrorCode(code)).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('1000-1009 范围为公共参数错误', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1009 }),
        (code) => {
          expect(classifyErrorCode(code)).toBe('common_param_error');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('1010-1099 范围为业务参数错误', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1010, max: 1099 }),
        (code) => {
          expect(classifyErrorCode(code)).toBe('biz_param_error');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('TigerError 构造时自动分类', () => {
    const err = new TigerError(1000, '公共参数错误');
    expect(err.category).toBe('common_param_error');
    expect(err.code).toBe(1000);
    expect(err.message).toBe('公共参数错误');

    const err2 = new TigerError(5, '频率限制');
    expect(err2.category).toBe('rate_limit');
  });
});
