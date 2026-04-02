/**
 * getSignContent 模块测试
 *
 * 测试请求参数按字母序排列拼接功能。
 */
import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { getSignContent } from '../../src/signer/sign-content';

describe('getSignContent', () => {
  test('基本参数排序拼接', () => {
    const params: Record<string, string> = {
      tiger_id: 'test123',
      method: 'market_state',
      charset: 'UTF-8',
      sign_type: 'RSA',
    };
    const result = getSignContent(params);
    expect(result).toBe('charset=UTF-8&method=market_state&sign_type=RSA&tiger_id=test123');
  });

  test('单个参数', () => {
    expect(getSignContent({ key: 'value' })).toBe('key=value');
  });

  test('空参数映射返回空字符串', () => {
    expect(getSignContent({})).toBe('');
  });

  test('参数严格按字母序排列', () => {
    const params: Record<string, string> = {
      zebra: 'z',
      apple: 'a',
      mango: 'm',
      banana: 'b',
    };
    expect(getSignContent(params)).toBe('apple=a&banana=b&mango=m&zebra=z');
  });

  test('完整 API 请求参数排序', () => {
    const params: Record<string, string> = {
      tiger_id: '20150001',
      method: 'market_state',
      charset: 'UTF-8',
      sign_type: 'RSA',
      timestamp: '2024-01-01 00:00:00',
      version: '3.0',
      biz_content: '{"market":"US"}',
    };
    const result = getSignContent(params);
    expect(result).toBe(
      'biz_content={"market":"US"}&charset=UTF-8&method=market_state&sign_type=RSA&tiger_id=20150001&timestamp=2024-01-01 00:00:00&version=3.0'
    );
  });

  test('值中包含特殊字符', () => {
    const params: Record<string, string> = {
      key1: 'value with spaces',
      key2: 'value=with=equals',
      key3: 'value&with&ampersand',
    };
    expect(getSignContent(params)).toBe(
      'key1=value with spaces&key2=value=with=equals&key3=value&with&ampersand'
    );
  });
});

/**
 * Feature: multi-language-sdks, Property 5: 请求参数按字母序排列
 *
 * 对于任意参数名-值的映射，getSignContent 函数输出的字符串中，
 * 参数应严格按参数名的字母序排列，格式为 key1=value1&key2=value2&...
 *
 * **Validates: Requirements 3.3**
 */
describe('Property 5: 请求参数按字母序排列', () => {
  // 生成合法的参数名（字母开头，不含 = 和 &）
  const paramKeyArb = fc.string({ minLength: 1, maxLength: 20 })
    .filter((s) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s));
  // 生成参数值（非空字符串）
  const paramValueArb = fc.string({ minLength: 1, maxLength: 50 })
    .filter((s) => s.length > 0);

  // 生成参数映射
  const paramsArb = fc.array(
    fc.tuple(paramKeyArb, paramValueArb),
    { minLength: 1, maxLength: 10 },
  ).map((pairs) => {
    const map: Record<string, string> = {};
    for (const [k, v] of pairs) {
      map[k] = v;
    }
    return map;
  });

  test('输出中参数严格按参数名字母序排列', () => {
    fc.assert(
      fc.property(paramsArb, (params) => {
        const result = getSignContent(params);
        const sortedKeys = Object.keys(params).sort();

        // 验证输出等于按排序键手动拼接的结果
        const expected = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');
        expect(result).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});
