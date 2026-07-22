/**
 * Position 接口和 JSON 序列化测试
 * 验证字段名 camelCase 与 API JSON 一致
 */
import { describe, it, expect } from 'vitest';
import type { Position } from '../../src/model/position';

describe('Position JSON 序列化', () => {
  it('基本持仓 JSON round-trip', () => {
    const position: Position = {
      account: 'DU123456',
      symbol: 'AAPL',
      secType: 'STK',
      quantity: 100,
      averageCost: 150.5,
    };
    const json = JSON.stringify(position);
    const parsed: Position = JSON.parse(json);
    expect(parsed).toEqual(position);
  });

  it('完整持仓 JSON round-trip', () => {
    const position: Position = {
      account: 'DU123456',
      symbol: 'AAPL',
      secType: 'STK',
      market: 'US',
      currency: 'USD',
      quantity: 100,
      averageCost: 150.5,
      marketPrice: 155.0,
      marketValue: 15500.0,
      realizedPnl: 200.0,
      unrealizedPnl: 450.0,
      positionScale: 0.15,
    };
    const json = JSON.stringify(position);
    const parsed: Position = JSON.parse(json);
    expect(parsed).toEqual(position);
  });

  it('JSON 字段名应保持 camelCase 与 API 一致', () => {
    const position: Position = {
      account: 'DU123456',
      symbol: 'AAPL',
      secType: 'STK',
      quantity: 100,
      averageCost: 150.5,
      marketPrice: 155.0,
      unrealizedPnl: 450.0,
    };
    const json = JSON.stringify(position);
    const obj = JSON.parse(json);
    expect(obj).toHaveProperty('averageCost');
    expect(obj).toHaveProperty('marketPrice');
    expect(obj).toHaveProperty('unrealizedPnl');
    expect(obj).toHaveProperty('secType');
  });

  it('从 API JSON 字符串反序列化', () => {
    const apiJson = `{
      "account": "DU999",
      "symbol": "TSLA",
      "secType": "STK",
      "market": "US",
      "currency": "USD",
      "quantity": 50,
      "averageCost": 200.0,
      "marketPrice": 210.0,
      "marketValue": 10500.0,
      "realizedPnl": 0,
      "unrealizedPnl": 500.0,
      "positionScale": 0.1
    }`;
    const position: Position = JSON.parse(apiJson);
    expect(position.account).toBe('DU999');
    expect(position.symbol).toBe('TSLA');
    expect(position.averageCost).toBe(200.0);
    expect(position.unrealizedPnl).toBe(500.0);
    expect(position.positionScale).toBe(0.1);
  });
});
