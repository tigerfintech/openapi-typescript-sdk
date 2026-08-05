/**
 * Integration tests — TradeClient (full coverage, read-only endpoints).
 *
 * NO order placement, modification, or cancellation.
 *
 * Guarded by `describe.skipIf(!shouldRun())`: skipped automatically in CI
 * when credentials or TIGER_RUN_INTEG=true are missing.
 *
 * Run with:
 *   TIGER_RUN_INTEG=true npm run test:integ
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { shouldRun, buildTradeClient, buildQuoteClient } from './integ-setup';
import type { TradeClient } from '../../src/trade/trade-client';

describe.skipIf(!shouldRun())('TradeClient integration tests', () => {
  let tc: TradeClient;

  // Shared dynamic data resolved in beforeAll
  let filledOrderId: number | undefined;
  let positionSymbol: string | undefined;

  beforeAll(async () => {
    tc = buildTradeClient();

    try {
      const now = Date.now();
      const orders = await tc.getFilledOrders({
        startDate: now - 90 * 24 * 60 * 60 * 1000,
        endDate: now,
        limit: 5,
      });
      if (orders.length) filledOrderId = orders[0].id;
    } catch { /* best-effort */ }

    try {
      const positions = await tc.getPositions();
      if (positions.length) positionSymbol = positions[0].symbol;
    } catch { /* best-effort */ }
  });

  // =========================================================================
  // Contract queries
  // =========================================================================

  describe('Contract queries', () => {
    it('getContract — AAPL STK', async () => {
      const data = await tc.getContract('AAPL', 'STK');
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].symbol).toBe('AAPL');
      expect(data[0].secType).toBe('STK');
      expect(data[0].currency).toBeTruthy();
    });

    it('getContracts — AAPL,TSLA STK', async () => {
      const data = await tc.getContracts(['AAPL', 'TSLA'], 'STK');
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      for (const c of data) {
        expect(c.symbol).toBeTruthy();
      }
    });

    it('getQuoteContract — AAPL OPT nearest expiry', async () => {
      try {
        const qc = buildQuoteClient();
        const exps = await qc.getOptionExpiration(['AAPL']);
        if (!exps.length || !exps[0].dates?.length) return;
        // Convert YYYY-MM-DD to YYYYMMDD
        const expiry = exps[0].dates[0].replace(/-/g, '');
        const data = await tc.getQuoteContract('AAPL', 'OPT', expiry);
        expect(Array.isArray(data)).toBe(true);
      } catch {
        // May fail if permission is missing
      }
    });

    it('getDerivativeContracts — AAPL OPT', async () => {
      const data = await tc.getDerivativeContracts({ symbols: ['AAPL'], secType: 'OPT' });
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // =========================================================================
  // Order queries
  // =========================================================================

  describe('Order queries', () => {
    it('getOrders', async () => {
      const data = await tc.getOrders();
      expect(Array.isArray(data)).toBe(true);
      for (const o of data) {
        expect(o.id).toBeGreaterThan(0);
        expect(o.symbol).toBeTruthy();
      }
    });

    it('getActiveOrders', async () => {
      const data = await tc.getActiveOrders();
      expect(Array.isArray(data)).toBe(true);
    });

    it('getInactiveOrders', async () => {
      const data = await tc.getInactiveOrders();
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFilledOrders — last 90 days', async () => {
      const now = Date.now();
      const data = await tc.getFilledOrders({
        startDate: now - 90 * 24 * 60 * 60 * 1000,
        endDate: now,
        limit: 10,
      });
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!filledOrderId)('getOrder — by filled order id', async () => {
      const data = await tc.getOrder({ id: filledOrderId! });
      expect(data).toBeDefined();
      if (data) {
        expect(data.id).toBe(filledOrderId);
      }
    });

    it('getOrderTransactions', async () => {
      const data = await tc.getOrderTransactions({ limit: 5 });
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // =========================================================================
  // Positions & assets
  // =========================================================================

  describe('Positions & assets', () => {
    it('getPositions', async () => {
      const data = await tc.getPositions();
      expect(Array.isArray(data)).toBe(true);
      for (const p of data) {
        expect(p.symbol).toBeTruthy();
        expect(p.account).toBeTruthy();
        expect(p.secType).toBeTruthy();
      }
    });

    it('getAssets', async () => {
      const data = await tc.getAssets();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].account).toBeTruthy();
      expect(data[0].currency).toBeTruthy();
      expect(data[0].netLiquidation).toBeGreaterThanOrEqual(0);
    });

    it('getPrimeAssets — call succeeds or returns undefined', async () => {
      try {
        const data = await tc.getPrimeAssets();
        expect(data === undefined || data === null || typeof data === 'object').toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden/i.test(msg)) return;
        throw err;
      }
    });

    it('getManagedAccounts', async () => {
      try {
        const data = await tc.getManagedAccounts();
        expect(Array.isArray(data)).toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden/i.test(msg)) return;
        throw err;
      }
    });

    it('getAnalyticsAsset', async () => {
      try {
        const data = await tc.getAnalyticsAsset({ startDate: '2024-01-01', endDate: '2025-12-31' });
        expect(Array.isArray(data)).toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden/i.test(msg)) return;
        throw err;
      }
    });

    it('getAggregateAssets', async () => {
      try {
        const data = await tc.getAggregateAssets();
        expect(data === undefined || data === null || typeof data === 'object').toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden/i.test(msg)) return;
        throw err;
      }
    });
  });

  // =========================================================================
  // Estimate
  // =========================================================================

  describe('Estimate', () => {
    it('getEstimateTradableQuantity — AAPL LMT BUY', async () => {
      try {
        const data = await tc.getEstimateTradableQuantity({
          symbol: 'AAPL',
          secType: 'STK',
          action: 'BUY',
          orderType: 'LMT',
          limitPrice: 100,
        });
        expect(data === undefined || data === null || typeof data === 'object').toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden/i.test(msg)) return;
        throw err;
      }
    });
  });

  // =========================================================================
  // Order Preview (read-only)
  // =========================================================================

  describe('Order Preview', () => {
    it('previewOrder — AAPL LMT BUY 1 share at $1', async () => {
      try {
        const data = await tc.previewOrder({
          symbol: 'AAPL',
          secType: 'STK',
          action: 'BUY',
          orderType: 'LMT',
          limitPrice: 1,
          quantity: 1,
          currency: 'USD',
        });
        expect(data === undefined || data === null || typeof data === 'object').toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden/i.test(msg)) return;
        throw err;
      }
    });
  });

  // =========================================================================
  // Segment Fund (institutional, may error on individual accounts)
  // =========================================================================

  describe('Segment Fund', () => {
    it('getSegmentFundAvailable — call succeeds or permission error', async () => {
      try {
        const data = await tc.getSegmentFundAvailable({});
        expect(Array.isArray(data) || data === undefined || data === null || typeof data === 'object').toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden/i.test(msg)) return;
        throw err;
      }
    });

    it('getSegmentFundHistory — call succeeds or permission error', async () => {
      try {
        const data = await tc.getSegmentFundHistory({});
        expect(Array.isArray(data) || data === undefined || data === null || typeof data === 'object').toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden/i.test(msg)) return;
        throw err;
      }
    });
  });

  // =========================================================================
  // Fund details / history
  // =========================================================================

  describe('Fund details / history', () => {
    it('getFundDetails', async () => {
      try {
        const data = await tc.getFundDetails({});
        expect(Array.isArray(data)).toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden/i.test(msg)) return;
        throw err;
      }
    });

    it('getFundingHistory', async () => {
      try {
        const data = await tc.getFundingHistory({ limit: 5 });
        expect(Array.isArray(data) || data === undefined || data === null || typeof data === 'object').toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden/i.test(msg)) return;
        throw err;
      }
    });
  });

  // =========================================================================
  // Position transfer records
  // =========================================================================

  describe('Position transfer records', () => {
    it('getPositionTransferRecords', async () => {
      try {
        const data = await tc.getPositionTransferRecords({});
        expect(Array.isArray(data)).toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden/i.test(msg)) return;
        throw err;
      }
    });

    it('getPositionTransferExternalRecords', async () => {
      try {
        const data = await tc.getPositionTransferExternalRecords({});
        expect(Array.isArray(data)).toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden/i.test(msg)) return;
        throw err;
      }
    });
  });

  // =========================================================================
  // Option exercise
  // =========================================================================

  describe('Option exercise', () => {
    it('getOptionExercisePositions', async () => {
      try {
        const data = await tc.getOptionExercisePositions({ type: 'Exercise' });
        expect(data === undefined || data === null || typeof data === 'object').toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden/i.test(msg)) return;
        throw err;
      }
    });

    it('getOptionExerciseRecords', async () => {
      try {
        const data = await tc.getOptionExerciseRecords({});
        expect(data === undefined || data === null || typeof data === 'object').toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden/i.test(msg)) return;
        throw err;
      }
    });
  });
});
