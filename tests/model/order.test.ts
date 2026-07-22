/**
 * Order 接口和 JSON 序列化测试
 * 验证字段名 camelCase 与 API JSON 一致
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Order, OrderLeg, AlgoParams } from '../../src/model/order';

describe('Order JSON 序列化', () => {
  it('基本市价单 JSON round-trip', () => {
    const order: Order = {
      account: 'DU123456',
      symbol: 'AAPL',
      secType: 'STK',
      action: 'BUY',
      orderType: 'MKT',
      quantity: 100,
      timeInForce: 'DAY',
      outsideRth: false,
    };
    const json = JSON.stringify(order);
    const parsed: Order = JSON.parse(json);
    expect(parsed).toEqual(order);
  });

  it('完整限价单 JSON round-trip', () => {
    const order: Order = {
      account: 'DU123456',
      id: 1001,
      orderId: 2001,
      symbol: 'AAPL',
      secType: 'STK',
      action: 'BUY',
      orderType: 'LMT',
      quantity: 100,
      limitPrice: 150.5,
      status: 'Submitted',
      filled: 50,
      avgFillPrice: 150.25,
      timeInForce: 'GTC',
      outsideRth: true,
      market: 'US',
      currency: 'USD',
    };
    const json = JSON.stringify(order);
    const parsed: Order = JSON.parse(json);
    expect(parsed).toEqual(order);
  });

  it('包含 orderLegs 的订单 JSON round-trip', () => {
    const order: Order = {
      account: 'DU123456',
      symbol: 'AAPL',
      secType: 'STK',
      action: 'BUY',
      orderType: 'LMT',
      quantity: 100,
      limitPrice: 150.0,
      timeInForce: 'DAY',
      outsideRth: false,
      orderLegs: [
        { legType: 'PROFIT', price: 160.0, timeInForce: 'GTC' },
        { legType: 'LOSS', price: 140.0, timeInForce: 'GTC' },
      ],
    };
    const json = JSON.stringify(order);
    const parsed: Order = JSON.parse(json);
    expect(parsed).toEqual(order);
  });

  it('包含 algoParams 的算法订单 JSON round-trip', () => {
    const order: Order = {
      account: 'DU123456',
      symbol: 'AAPL',
      secType: 'STK',
      action: 'BUY',
      orderType: 'TWAP',
      quantity: 1000,
      limitPrice: 150.0,
      timeInForce: 'DAY',
      outsideRth: false,
      algoParams: {
        algoStrategy: 'TWAP',
        startTime: '09:30:00',
        endTime: '16:00:00',
        participationRate: 0.1,
      },
    };
    const json = JSON.stringify(order);
    const parsed: Order = JSON.parse(json);
    expect(parsed).toEqual(order);
  });

  it('期权订单 JSON 字段名应保持 right 不改为 putCall', () => {
    const order: Order = {
      account: 'DU123456',
      symbol: 'AAPL',
      secType: 'OPT',
      action: 'BUY',
      orderType: 'LMT',
      quantity: 1,
      limitPrice: 5.0,
      timeInForce: 'DAY',
      outsideRth: false,
      expiry: '20250620',
      strike: 150.0,
      right: 'CALL',
    };
    const json = JSON.stringify(order);
    const obj = JSON.parse(json);
    expect(obj).toHaveProperty('right');
    expect(obj).not.toHaveProperty('putCall');
    expect(obj.right).toBe('CALL');
  });

  it('从 API JSON 字符串反序列化', () => {
    const apiJson = `{
      "account": "DU999",
      "id": 500,
      "orderId": 600,
      "symbol": "TSLA",
      "secType": "STK",
      "action": "SELL",
      "orderType": "LMT",
      "quantity": 50,
      "limitPrice": 200.0,
      "status": "Filled",
      "filled": 50,
      "avgFillPrice": 200.5,
      "timeInForce": "DAY",
      "outsideRth": false,
      "market": "US",
      "currency": "USD"
    }`;
    const order: Order = JSON.parse(apiJson);
    expect(order.account).toBe('DU999');
    expect(order.id).toBe(500);
    expect(order.orderId).toBe(600);
    expect(order.avgFillPrice).toBe(200.5);
    expect(order.outsideRth).toBe(false);
  });
});

/**
 * Property 7 属性测试：Order JSON round-trip
 * 对于任意有效的 Order 对象，序列化为 JSON 后再反序列化，
 * 得到的对象应与原始对象等价。
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.7**
 */
describe('Property 7: Order JSON round-trip', () => {
  const orderLegArb: fc.Arbitrary<OrderLeg> = fc.record({
    legType: fc.constantFrom('PROFIT', 'LOSS'),
    price: fc.option(fc.double({ min: 0.01, max: 99999, noNaN: true }), { nil: undefined }),
    timeInForce: fc.option(fc.constantFrom('DAY', 'GTC', 'OPG'), { nil: undefined }),
    quantity: fc.option(fc.integer({ min: 1, max: 100000 }), { nil: undefined }),
  });

  const algoParamsArb: fc.Arbitrary<AlgoParams> = fc.record({
    algoStrategy: fc.constantFrom('TWAP', 'VWAP'),
    startTime: fc.option(fc.stringMatching(/^[0-2][0-9]:[0-5][0-9]:[0-5][0-9]$/), { nil: undefined }),
    endTime: fc.option(fc.stringMatching(/^[0-2][0-9]:[0-5][0-9]:[0-5][0-9]$/), { nil: undefined }),
    participationRate: fc.option(fc.double({ min: 0.01, max: 1, noNaN: true }), { nil: undefined }),
  });

  const orderArb: fc.Arbitrary<Order> = fc.record({
    account: fc.stringMatching(/^[A-Z]{2}[0-9]{4,8}$/),
    id: fc.option(fc.integer({ min: 1, max: 999999999 }), { nil: undefined }),
    orderId: fc.option(fc.integer({ min: 1, max: 999999999 }), { nil: undefined }),
    symbol: fc.stringMatching(/^[A-Z]{1,10}$/),
    secType: fc.constantFrom('STK', 'OPT', 'FUT', 'WAR', 'CASH', 'FUND'),
    action: fc.constantFrom('BUY', 'SELL'),
    orderType: fc.constantFrom('MKT', 'LMT', 'STP', 'STP_LMT', 'TRAIL', 'AM', 'AL', 'TWAP', 'VWAP'),
    quantity: fc.integer({ min: 1, max: 100000 }),
    limitPrice: fc.option(fc.double({ min: 0.01, max: 99999, noNaN: true }), { nil: undefined }),
    auxPrice: fc.option(fc.double({ min: 0.01, max: 99999, noNaN: true }), { nil: undefined }),
    trailingPercent: fc.option(fc.double({ min: 0.01, max: 100, noNaN: true }), { nil: undefined }),
    status: fc.option(fc.constantFrom('PendingNew', 'Initial', 'Submitted', 'Filled', 'Cancelled'), { nil: undefined }),
    filled: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: undefined }),
    avgFillPrice: fc.option(fc.double({ min: 0, max: 99999, noNaN: true }), { nil: undefined }),
    timeInForce: fc.constantFrom('DAY', 'GTC', 'OPG'),
    outsideRth: fc.boolean(),
    orderLegs: fc.option(fc.array(orderLegArb, { minLength: 0, maxLength: 3 }), { nil: undefined }),
    algoParams: fc.option(algoParamsArb, { nil: undefined }),
    market: fc.option(fc.constantFrom('US', 'HK', 'CN', 'SG'), { nil: undefined }),
    currency: fc.option(fc.constantFrom('USD', 'HKD', 'CNH', 'SGD'), { nil: undefined }),
    expiry: fc.option(fc.stringMatching(/^20[2-3][0-9](0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$/), { nil: undefined }),
    strike: fc.option(fc.double({ min: 0.01, max: 99999, noNaN: true }), { nil: undefined }),
    right: fc.option(fc.constantFrom('PUT', 'CALL'), { nil: undefined }),
  });

  // Feature: multi-language-sdks, Property 7: 数据模型 JSON 序列化 round-trip
  it('Order JSON round-trip 应保持等价', () => {
    fc.assert(
      fc.property(orderArb, (order) => {
        const json = JSON.stringify(order);
        const parsed: Order = JSON.parse(json);
        const cleanOriginal = JSON.parse(JSON.stringify(order));
        expect(parsed).toEqual(cleanOriginal);

        // 验证关键字段名保持 API 原始名
        const obj = JSON.parse(json);
        if (order.right !== undefined) {
          expect(obj).toHaveProperty('right');
          expect(obj).not.toHaveProperty('putCall');
        }
        expect(obj).toHaveProperty('outsideRth');
        expect(obj).toHaveProperty('timeInForce');
      }),
      { numRuns: 100 },
    );
  });
});
