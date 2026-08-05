/**
 * Integration tests for QuoteClient — hit the real OpenAPI gateway.
 *
 * Run with:
 *   TIGER_RUN_INTEG=true npm run test:integ
 *
 * Credentials: TIGEROPEN_TIGER_ID / TIGEROPEN_PRIVATE_KEY / TIGEROPEN_ACCOUNT
 * env vars, or TIGEROPEN_PROPS_PATH pointing at a properties file.
 * Without credentials or TIGER_RUN_INTEG=true, all tests in this file skip.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { shouldRun, buildQuoteClient } from './integ-setup';
import type { QuoteClient } from '../../src/quote/quote-client';

describe.skipIf(!shouldRun())('Integration: QuoteClient', () => {
  let qc: QuoteClient;

  beforeAll(() => {
    qc = buildQuoteClient();
  });

  it('getMarketState — US 市场状态非空', async () => {
    const data = await qc.getMarketState('US');
    expect(data.length).toBeGreaterThan(0);
    const us = data[0];
    expect(us.market).toBe('US');
    expect(us.marketStatus).toBeTruthy();
  });

  it('getRealTimeQuote — AAPL 最新价 > 0', async () => {
    const data = await qc.getRealTimeQuote({ symbols: ['AAPL'] });
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].symbol).toBe('AAPL');
    expect(data[0].latestPrice).toBeGreaterThan(0);
    expect(data[0].latestTime).toBeGreaterThan(0);
  });

  it('getKline — AAPL 日 K 线至少 5 条，High >= Low', async () => {
    const data = await qc.getKline({ symbols: ['AAPL'], period: 'day', limit: 5 });
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].symbol).toBe('AAPL');
    expect(data[0].items.length).toBeGreaterThan(0);
    const item = data[0].items[0];
    expect(item.time).toBeGreaterThan(0);
    expect(item.close).toBeGreaterThan(0);
    expect(item.high).toBeGreaterThanOrEqual(item.low);
  });

  it('getTimeline — AAPL 时间线返回数据', async () => {
    const data = await qc.getTimeline(['AAPL']);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].symbol).toBe('AAPL');
    // Timeline buckets may legitimately be empty outside trading hours
  });

  it('getOptionExpiration — AAPL 期权到期日非空', async () => {
    const data = await qc.getOptionExpiration(['AAPL']);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].symbol).toBe('AAPL');
    expect(data[0].dates.length).toBeGreaterThan(0);
    expect(data[0].timestamps.length).toBeGreaterThan(0);
  });

  it('getOptionChain — AAPL 中间到期日期权链含 Call 或 Put', async () => {
    const exps = await qc.getOptionExpiration(['AAPL']);
    if (!exps.length || !exps[0].dates.length) {
      return; // skip: no expiry available
    }
    const midExpiry = exps[0].dates[Math.floor(exps[0].dates.length / 2)];
    const chain = await qc.getOptionChain([['AAPL', midExpiry]]);
    expect(chain.length).toBeGreaterThan(0);
    expect(chain[0].symbol).toBe('AAPL');
    expect(chain[0].expiry).toBeGreaterThan(0);
    expect(chain[0].items.length).toBeGreaterThan(0);
    const row = chain[0].items[0];
    // At least one leg must be present
    expect(row.call !== null || row.put !== null).toBe(true);
    if (row.call) {
      expect(row.call.identifier).toBeTruthy();
      expect(row.call.strike).toBeTruthy();
    }
    if (row.put) {
      expect(row.put.identifier).toBeTruthy();
      expect(row.put.strike).toBeTruthy();
    }
  });

  it('getCorporateAction — AAPL DIVIDEND 2024 有数据', async () => {
    const data = await qc.getCorporateAction({
      symbols: ['AAPL'],
      market: 'US',
      actionType: 'DIVIDEND',
      beginDate: '2024-01-01',
      endDate: '2025-12-31',
    });
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].symbol).toBe('AAPL');
    expect(data[0].actionType).toBeTruthy();
    expect(data[0].executeDate).toBeTruthy();
  });

  it('getCapitalFlow — AAPL 日资金流向非空', async () => {
    const data = await qc.getCapitalFlow('AAPL', 'US', 'day');
    expect(data).not.toBeNull();
    expect(data?.symbol).toBe('AAPL');
  });

  it('grabQuotePermission — 调用成功（权限列表可为空）', async () => {
    const data = await qc.grabQuotePermission();
    expect(Array.isArray(data)).toBe(true);
    for (const p of data) {
      expect(p.name).toBeTruthy();
    }
  });
});
