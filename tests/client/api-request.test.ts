/**
 * API 请求构造测试
 *
 * 包含 Property 11（API 请求构造正确性）的属性测试。
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createApiRequest } from '../../src/client/api-request';

/**
 * Feature: multi-language-sdks, Property 11: API 请求构造正确性
 *
 * 对于任意有效的业务参数和 API 方法名，构造的请求对象应包含正确的 method 字段，
 * 且 biz_content 字段为业务参数的 JSON 序列化结果。
 *
 * **Validates: Requirements 4.1-4.12, 5.1-5.12**
 */
describe('Property 11: API 请求构造正确性', () => {
  it('请求对象包含正确的 method 和 biz_content', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z_]\w*$/.test(s)),
          fc.oneof(fc.string({ maxLength: 20 }), fc.integer(), fc.boolean()),
          { minKeys: 0, maxKeys: 5 },
        ),
        (method, bizParams) => {
          const request = createApiRequest(method, bizParams);
          expect(request.method).toBe(method);
          // biz_content 应为有效 JSON
          const parsed = JSON.parse(request.bizContent);
          expect(parsed).toEqual(bizParams);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('字符串类型 bizParams 直接作为 bizContent', () => {
    const request = createApiRequest('market_state', '{"market":"US"}');
    expect(request.method).toBe('market_state');
    expect(request.bizContent).toBe('{"market":"US"}');
  });

  it('null/undefined bizParams 生成空对象 JSON', () => {
    const request = createApiRequest('market_state', null);
    expect(request.bizContent).toBe('{}');

    const request2 = createApiRequest('market_state', undefined);
    expect(request2.bizContent).toBe('{}');
  });

  it('对象类型 bizParams 序列化为 JSON', () => {
    const params = { market: 'US', symbols: ['AAPL', 'GOOG'] };
    const request = createApiRequest('brief', params);
    expect(request.method).toBe('brief');
    expect(JSON.parse(request.bizContent)).toEqual(params);
  });
});
