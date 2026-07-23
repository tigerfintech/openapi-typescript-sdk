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
        // Keys must be snake_case-friendly (lowercase + underscore) so the
        // client's camelCase -> snake_case conversion is a no-op.
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 10 })
            .filter((s) => /^[a-z_][a-z0-9_]*$/.test(s))
            .filter((s) => s !== '__proto__' && s !== 'constructor' && s !== 'prototype'),
          fc.oneof(fc.string({ maxLength: 20 }), fc.integer(), fc.boolean()),
          { minKeys: 0, maxKeys: 5 },
        ),
        (method, bizParams) => {
          const request = createApiRequest(method, bizParams);
          expect(request.method).toBe(method);
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

// --- parseApiResponse int64 precision + UnmarshalData 测试 ---
import { parseApiResponse, unmarshalData } from '../../src/client/api-response';

describe('fix/bug-fixes: parseApiResponse int64 precision', () => {
  it('int64 订单 ID 在 parseApiResponse 后不丢失精度', () => {
    // 28868646234578944 超出 Number.MAX_SAFE_INTEGER，裸 JSON.parse 会截断
    const body = `{"code":0,"message":"success","data":{"orderId":28868646234578944},"timestamp":1700000000}`;
    const resp = parseApiResponse(body);
    // data.orderId 应作为字符串保留（被 patchLargeIntegers 处理）
    const data = resp.data as { orderId: string };
    expect(data.orderId).toBe('28868646234578944');
  });

  it('正常整数不受影响', () => {
    const body = `{"code":0,"message":"success","data":{"code":200},"timestamp":1700000000}`;
    const resp = parseApiResponse(body);
    const data = resp.data as { code: number };
    expect(data.code).toBe(200);
  });

  it('code != 0 时抛出 TigerError', () => {
    const body = `{"code":1000,"message":"param error","data":null,"timestamp":1700000000}`;
    expect(() => parseApiResponse(body)).toThrow('param error');
  });
});

describe('fix/bug-fixes: unmarshalData 双重编码', () => {
  it('双重编码场景正确解码', () => {
    // 服务端将 data 编码为 JSON 字符串
    const inner = JSON.stringify({ orderId: '123' });
    const data = inner; // typeof data === 'string'
    const result = unmarshalData<{ orderId: string }>(data);
    expect(result?.orderId).toBe('123');
  });

  it('null data 返回 undefined', () => {
    expect(unmarshalData(null)).toBeUndefined();
  });
});
