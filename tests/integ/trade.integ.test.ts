/**
 * Integration tests for TradeClient — read-only endpoints only.
 *
 * NO order placement, modification, or cancellation.
 *
 * Run with:
 *   TIGER_RUN_INTEG=true npm run test:integ
 *
 * Credentials: TIGEROPEN_TIGER_ID / TIGEROPEN_PRIVATE_KEY / TIGEROPEN_ACCOUNT
 * env vars, or TIGEROPEN_PROPS_PATH pointing at a properties file.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { shouldRun, buildTradeClient } from './integ-setup';
import type { TradeClient } from '../../src/trade/trade-client';

describe.skipIf(!shouldRun())('Integration: TradeClient (read-only)', () => {
  let tc: TradeClient;

  beforeAll(() => {
    tc = buildTradeClient();
  });

  it('getContract — AAPL STK 合约 symbol/currency 非空', async () => {
    const data = await tc.getContract('AAPL', 'STK');
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].symbol).toBe('AAPL');
    expect(data[0].secType).toBe('STK');
    expect(data[0].currency).toBeTruthy();
  });

  it('getAssets — 资产列表至少有一条，字段合法', async () => {
    const data = await tc.getAssets();
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].account).toBeTruthy();
    expect(data[0].currency).toBeTruthy();
    expect(data[0].netLiquidation).toBeGreaterThanOrEqual(0);
  });

  it('getPositions — 持仓查询成功（持仓可为空，纸账号正常）', async () => {
    const data = await tc.getPositions();
    // Positions may be empty for a fresh paper account
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      expect(p.symbol, `Position[${i}].symbol`).toBeTruthy();
      expect(p.account, `Position[${i}].account`).toBeTruthy();
      expect(p.secType, `Position[${i}].secType`).toBeTruthy();
    }
  });

  it('getOrders — 近 30 天订单查询成功（可为空）', async () => {
    const now = Date.now();
    const data = await tc.getOrders({
      startDate: now - 30 * 24 * 60 * 60 * 1000,
      endDate: now,
      limit: 10,
    });
    // May be empty if no trades in the last 30 days
    for (let i = 0; i < data.length; i++) {
      const o = data[i];
      expect(o.id, `Order[${i}].id`).toBeGreaterThan(0);
      expect(o.symbol, `Order[${i}].symbol`).toBeTruthy();
      expect(o.action, `Order[${i}].action`).toBeTruthy();
      expect(o.status, `Order[${i}].status`).toBeTruthy();
    }
  });

  it('getActiveOrders — 活跃订单查询成功（可为空）', async () => {
    const data = await tc.getActiveOrders();
    for (let i = 0; i < data.length; i++) {
      const o = data[i];
      expect(o.id, `ActiveOrder[${i}].id`).toBeGreaterThan(0);
      expect(o.symbol, `ActiveOrder[${i}].symbol`).toBeTruthy();
      expect(o.status, `ActiveOrder[${i}].status`).toBeTruthy();
    }
  });
});
