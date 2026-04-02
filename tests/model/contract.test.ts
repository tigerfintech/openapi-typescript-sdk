/**
 * Contract 接口和 JSON 序列化测试
 * 验证字段名 camelCase 与 API JSON 一致，不改名
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Contract, TickSize } from '../../src/model/contract';

describe('Contract JSON 序列化', () => {
  it('基本股票合约 JSON round-trip', () => {
    const contract: Contract = {
      symbol: 'AAPL',
      secType: 'STK',
      currency: 'USD',
    };
    const json = JSON.stringify(contract);
    const parsed: Contract = JSON.parse(json);
    expect(parsed).toEqual(contract);
  });

  it('完整期权合约 JSON round-trip', () => {
    const contract: Contract = {
      contractId: 123456,
      symbol: 'AAPL',
      secType: 'OPT',
      currency: 'USD',
      exchange: 'CBOE',
      expiry: '20250620',
      strike: 150.0,
      right: 'CALL',
      multiplier: 100,
      identifier: 'AAPL 250620C00150000',
      name: 'Apple Inc Call',
      market: 'US',
      tradeable: true,
      conid: 789012,
    };
    const json = JSON.stringify(contract);
    const parsed: Contract = JSON.parse(json);
    expect(parsed).toEqual(contract);
  });

  it('JSON 字段名应保持 API 原始名（right 不改为 putCall）', () => {
    const contract: Contract = {
      symbol: 'AAPL',
      secType: 'OPT',
      right: 'PUT',
    };
    const json = JSON.stringify(contract);
    const obj = JSON.parse(json);
    expect(obj).toHaveProperty('right');
    expect(obj).not.toHaveProperty('putCall');
    expect(obj.right).toBe('PUT');
  });

  it('JSON 字段名应保持 API 原始名（conid 不改为 contractId 的别名）', () => {
    const contract: Contract = {
      symbol: 'AAPL',
      secType: 'STK',
      conid: 12345,
      contractId: 67890,
    };
    const json = JSON.stringify(contract);
    const obj = JSON.parse(json);
    expect(obj).toHaveProperty('conid');
    expect(obj).toHaveProperty('contractId');
    expect(obj.conid).toBe(12345);
    expect(obj.contractId).toBe(67890);
  });

  it('JSON 字段名应保持 API 原始名（tradeable 不改为 trade）', () => {
    const contract: Contract = {
      symbol: 'AAPL',
      secType: 'STK',
      tradeable: true,
    };
    const json = JSON.stringify(contract);
    const obj = JSON.parse(json);
    expect(obj).toHaveProperty('tradeable');
    expect(obj).not.toHaveProperty('trade');
    expect(obj.tradeable).toBe(true);
  });

  it('包含 tickSizes 的合约 JSON round-trip', () => {
    const contract: Contract = {
      symbol: 'AAPL',
      secType: 'STK',
      tickSizes: [
        { begin: 0, end: 1, tickSize: 0.0001, type: 'PRICE' },
        { begin: 1, end: 10000, tickSize: 0.01, type: 'PRICE' },
      ],
      lotSize: 1,
    };
    const json = JSON.stringify(contract);
    const parsed: Contract = JSON.parse(json);
    expect(parsed).toEqual(contract);
  });

  it('包含保证金字段的合约 JSON round-trip', () => {
    const contract: Contract = {
      symbol: 'AAPL',
      secType: 'STK',
      shortMargin: 0.3,
      shortInitialMargin: 0.5,
      shortMaintenanceMargin: 0.25,
      longInitialMargin: 0.5,
      longMaintenanceMargin: 0.25,
    };
    const json = JSON.stringify(contract);
    const parsed: Contract = JSON.parse(json);
    expect(parsed).toEqual(contract);
  });

  it('从 API JSON 字符串反序列化', () => {
    const apiJson = `{
      "contractId": 100,
      "symbol": "TSLA",
      "secType": "STK",
      "currency": "USD",
      "exchange": "NASDAQ",
      "market": "US",
      "tradeable": true,
      "conid": 200
    }`;
    const contract: Contract = JSON.parse(apiJson);
    expect(contract.contractId).toBe(100);
    expect(contract.symbol).toBe('TSLA');
    expect(contract.secType).toBe('STK');
    expect(contract.tradeable).toBe(true);
    expect(contract.conid).toBe(200);
  });
});

/**
 * Property 7 属性测试：Contract JSON round-trip
 * 对于任意有效的 Contract 对象，序列化为 JSON 后再反序列化，
 * 得到的对象应与原始对象等价，且 JSON 字段名与 API 一致。
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.7**
 */
describe('Property 7: Contract JSON round-trip', () => {
  // 生成有效的 TickSize 对象
  const tickSizeArb: fc.Arbitrary<TickSize> = fc.record({
    begin: fc.double({ min: 0, max: 10000, noNaN: true }),
    end: fc.double({ min: 0, max: 10000, noNaN: true }),
    tickSize: fc.double({ min: 0.0001, max: 100, noNaN: true }),
    type: fc.constantFrom('PRICE', 'VOLUME'),
  });

  // 生成有效的 Contract 对象
  const contractArb: fc.Arbitrary<Contract> = fc.record({
    contractId: fc.option(fc.integer({ min: 1, max: 999999999 }), { nil: undefined }),
    symbol: fc.stringMatching(/^[A-Z]{1,10}$/),
    secType: fc.constantFrom('STK', 'OPT', 'FUT', 'WAR', 'CASH', 'FUND', 'IOPT', 'FOP', 'MLEG'),
    currency: fc.option(fc.constantFrom('USD', 'HKD', 'CNH', 'SGD'), { nil: undefined }),
    exchange: fc.option(fc.constantFrom('NYSE', 'NASDAQ', 'CBOE', 'SEHK'), { nil: undefined }),
    expiry: fc.option(fc.stringMatching(/^20[2-3][0-9](0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$/), { nil: undefined }),
    strike: fc.option(fc.double({ min: 0.01, max: 99999, noNaN: true }), { nil: undefined }),
    right: fc.option(fc.constantFrom('PUT', 'CALL'), { nil: undefined }),
    multiplier: fc.option(fc.double({ min: 1, max: 10000, noNaN: true }), { nil: undefined }),
    identifier: fc.option(fc.stringMatching(/^[A-Z0-9 ]{1,30}$/), { nil: undefined }),
    name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    market: fc.option(fc.constantFrom('US', 'HK', 'CN', 'SG'), { nil: undefined }),
    tradeable: fc.option(fc.boolean(), { nil: undefined }),
    conid: fc.option(fc.integer({ min: 1, max: 999999999 }), { nil: undefined }),
    shortMargin: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
    shortInitialMargin: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
    shortMaintenanceMargin: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
    longInitialMargin: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
    longMaintenanceMargin: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
    tickSizes: fc.option(fc.array(tickSizeArb, { minLength: 0, maxLength: 5 }), { nil: undefined }),
    lotSize: fc.option(fc.double({ min: 1, max: 10000, noNaN: true }), { nil: undefined }),
  });

  // Feature: multi-language-sdks, Property 7: 数据模型 JSON 序列化 round-trip
  it('Contract JSON round-trip 应保持等价', () => {
    fc.assert(
      fc.property(contractArb, (contract) => {
        const json = JSON.stringify(contract);
        const parsed: Contract = JSON.parse(json);

        // 过滤掉 undefined 字段后比较
        const cleanOriginal = JSON.parse(JSON.stringify(contract));
        expect(parsed).toEqual(cleanOriginal);

        // 验证 JSON 字段名保持 API 原始名
        const obj = JSON.parse(json);
        if (contract.right !== undefined) {
          expect(obj).toHaveProperty('right');
          expect(obj).not.toHaveProperty('putCall');
        }
        if (contract.conid !== undefined) {
          expect(obj).toHaveProperty('conid');
        }
        if (contract.tradeable !== undefined) {
          expect(obj).toHaveProperty('tradeable');
          expect(obj).not.toHaveProperty('trade');
        }
      }),
      { numRuns: 100 },
    );
  });
});
