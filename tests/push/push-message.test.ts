/**
 * 推送消息序列化测试（含 Property 12 属性测试）
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  MessageType, SubjectType,
  createPushMessage, serializeMessage, deserializeMessage,
  type QuoteData, type TickData, type OrderData, type AssetData,
} from '../../src/push/push-message';

describe('PushMessage 序列化', () => {
  it('创建和序列化心跳消息', () => {
    const msg = createPushMessage(MessageType.Heartbeat);
    const json = serializeMessage(msg);
    const restored = deserializeMessage(json);
    expect(restored.type).toBe(MessageType.Heartbeat);
    expect(restored.data).toBeUndefined();
  });

  it('创建和序列化行情消息', () => {
    const data: QuoteData = { symbol: 'AAPL', latestPrice: 150.25, volume: 1000000 };
    const msg = createPushMessage(MessageType.Quote, SubjectType.Quote, data);
    const json = serializeMessage(msg);
    const restored = deserializeMessage(json);
    expect(restored.type).toBe(MessageType.Quote);
    expect(restored.subject).toBe(SubjectType.Quote);
    const d = restored.data as QuoteData;
    expect(d.symbol).toBe('AAPL');
    expect(d.latestPrice).toBe(150.25);
  });

  it('反序列化无效 JSON 应抛出错误', () => {
    expect(() => deserializeMessage('not json')).toThrow();
  });
});

// Feature: multi-language-sdks, Property 12: Protobuf 序列化 round-trip
// （简化为 JSON 序列化 round-trip）
// **Validates: Requirements 6.12**
describe('Property 12: JSON 序列化 round-trip', () => {
  const symbolArb = fc.stringMatching(/^[A-Z]{1,5}$/);
  const priceArb = fc.double({ min: 0, max: 100000, noNaN: true });
  const volumeArb = fc.integer({ min: 0, max: 1000000000 });
  const tsArb = fc.integer({ min: 0, max: 2000000000 });

  it('QuoteData round-trip', () => {
    fc.assert(
      fc.property(symbolArb, priceArb, volumeArb, tsArb, (symbol, price, volume, ts) => {
        const data: QuoteData = { symbol, latestPrice: price, volume, timestamp: ts };
        const msg = createPushMessage(MessageType.Quote, SubjectType.Quote, data);
        const json = serializeMessage(msg);
        const restored = deserializeMessage(json);
        const d = restored.data as QuoteData;
        expect(d.symbol).toBe(symbol);
        expect(d.volume).toBe(volume);
        expect(d.timestamp).toBe(ts);
      }),
      { numRuns: 100 },
    );
  });

  it('TickData round-trip', () => {
    fc.assert(
      fc.property(symbolArb, priceArb, volumeArb, (symbol, price, volume) => {
        const data: TickData = { symbol, price, volume, type: 'BUY' };
        const msg = createPushMessage(MessageType.Tick, SubjectType.Tick, data);
        const restored = deserializeMessage(serializeMessage(msg));
        const d = restored.data as TickData;
        expect(d.symbol).toBe(symbol);
        expect(d.price).toBe(price);
        expect(d.volume).toBe(volume);
      }),
      { numRuns: 100 },
    );
  });

  it('OrderData round-trip', () => {
    const accountArb = fc.stringMatching(/^[a-z0-9]{5,10}$/);
    const statusArb = fc.constantFrom('Submitted', 'Filled', 'Cancelled');
    fc.assert(
      fc.property(accountArb, symbolArb, statusArb, (account, symbol, status) => {
        const data: OrderData = { account, symbol, status, quantity: 100 };
        const msg = createPushMessage(MessageType.Order, SubjectType.Order, data);
        const restored = deserializeMessage(serializeMessage(msg));
        const d = restored.data as OrderData;
        expect(d.account).toBe(account);
        expect(d.symbol).toBe(symbol);
        expect(d.status).toBe(status);
      }),
      { numRuns: 100 },
    );
  });

  it('AssetData round-trip', () => {
    const accountArb = fc.stringMatching(/^[a-z0-9]{5,10}$/);
    const currencyArb = fc.constantFrom('USD', 'HKD', 'CNH');
    fc.assert(
      fc.property(accountArb, priceArb, currencyArb, (account, netLiq, currency) => {
        const data: AssetData = { account, netLiquidation: netLiq, currency };
        const msg = createPushMessage(MessageType.Asset, SubjectType.Asset, data);
        const restored = deserializeMessage(serializeMessage(msg));
        const d = restored.data as AssetData;
        expect(d.account).toBe(account);
        expect(d.currency).toBe(currency);
      }),
      { numRuns: 100 },
    );
  });
});
