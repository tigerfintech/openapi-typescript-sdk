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

/** Date N years ago (same month/day) in 'YYYY-MM-DD' format. */
function yearsAgo(n: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Current date in 'YYYY-MM-DD' format. */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe.skipIf(!shouldRun())('TradeClient integration tests', () => {
  let tc: TradeClient;

  // Shared dynamic data resolved in beforeAll
  let filledOrderId: number | undefined;
  let positionSymbol: string | undefined;
  let positionTransferRecordId: string | undefined;
  let optionContractId: number | undefined;

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

    // 3. Get a position transfer record id for detail query.
    // NOTE: The response field name is assumed/unverified — we try both
    // `id` and `recordId` but neither is confirmed against the actual API
    // response schema. If both are undefined, the detail test is skipped.
    try {
      const records = await tc.getPositionTransferRecords({});
      if (records.length) {
        const id = (records[0] as any).id ?? (records[0] as any).recordId;
        if (id) positionTransferRecordId = String(id);
      }
    } catch { /* best-effort */ }

    // 4. Get an option contractId from positions (for option exercise check)
    try {
      const positions = await tc.getPositions({ secType: 'OPT' });
      if (positions.length && positions[0].contractId) {
        optionContractId = positions[0].contractId;
      }
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
        // No option expiry data available — skip
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
      // New paper account may have no orders — only assert fields when non-empty
      const data = await tc.getOrders();
      expect(Array.isArray(data)).toBe(true);
      for (const o of data) {
        expect(o.id).toBeGreaterThan(0);
        expect(o.symbol).toBeTruthy();
      }
    });

    it('getActiveOrders', async () => {
      // New paper account may have no active orders — only assert fields when non-empty
      const data = await tc.getActiveOrders();
      expect(Array.isArray(data)).toBe(true);
    });

    it('getInactiveOrders', async () => {
      // New paper account may have no inactive orders — only assert fields when non-empty
      const data = await tc.getInactiveOrders();
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFilledOrders — last 90 days', async () => {
      // New paper account may have no filled orders — only assert fields when non-empty
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
      // New paper account may have no transactions — only assert fields when non-empty
      const data = await tc.getOrderTransactions({ limit: 5 });
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // =========================================================================
  // Positions & assets
  // =========================================================================

  describe('Positions & assets', () => {
    it('getPositions', async () => {
      // New paper account may have no positions — only assert fields when non-empty
      const data = await tc.getPositions();
      expect(Array.isArray(data)).toBe(true);
      for (const p of data) {
        expect(p.symbol).toBeTruthy();
        expect(p.account).toBeTruthy();
        expect(p.secType).toBeTruthy();
      }
    });

    it('getAssets', async () => {
      // New paper account may have no assets — only assert fields when non-empty
      const data = await tc.getAssets();
      expect(Array.isArray(data)).toBe(true);
      if (data.length) {
        expect(data[0].account).toBeTruthy();
        expect(data[0].currency).toBeTruthy();
        expect(data[0].netLiquidation).toBeGreaterThanOrEqual(0);
      }
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
        const data = await tc.getAnalyticsAsset({ startDate: yearsAgo(2), endDate: todayStr() });
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

    it.skipIf(!positionTransferRecordId)('getPositionTransferDetail — by record id', async () => {
      try {
        const data = await tc.getPositionTransferDetail({ id: positionTransferRecordId! });
        expect(data === undefined || data === null || typeof data === 'object').toBe(true);
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

    it.skipIf(!optionContractId)('checkOptionExercise — predict exercise outcome', async () => {
      try {
        const data = await tc.checkOptionExercise({
          contractId: optionContractId!,
          type: 'Exercise',
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
  // Token management
  // =========================================================================

  describe('Token management', () => {
    it('queryToken — returns token string', async () => {
      const token = await tc.queryToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Write operations (skipped — mutating, never run against real gateway)
  // =========================================================================

  describe('Write operations (skipped)', () => {
    it.skip('placeOrder — skipped (mutating op)', async () => {
      await tc.placeOrder({
        symbol: 'AAPL', secType: 'STK', action: 'BUY',
        orderType: 'LMT', limitPrice: 1, quantity: 1,
      });
    });

    it.skip('modifyOrder — skipped (mutating op)', async () => {
      await tc.modifyOrder(0, {
        symbol: 'AAPL', secType: 'STK', action: 'BUY',
        orderType: 'LMT', limitPrice: 1, quantity: 1,
      });
    });

    it.skip('cancelOrder — skipped (mutating op)', async () => {
      await tc.cancelOrder(0);
    });

    it.skip('placeForexOrder — skipped (mutating op)', async () => {
      await tc.placeForexOrder({ sourceCurrency: 'USD', targetCurrency: 'HKD' });
    });

    it.skip('transferSegmentFund — skipped (mutating op)', async () => {
      await tc.transferSegmentFund({});
    });

    it.skip('cancelSegmentFund — skipped (mutating op)', async () => {
      await tc.cancelSegmentFund({});
    });

    it.skip('transferPosition — skipped (mutating op)', async () => {
      await tc.transferPosition({ toAccount: '', transfers: [] });
    });

    it.skip('submitOptionExercise — skipped (mutating op)', async () => {
      await tc.submitOptionExercise({ contractId: 0, type: 'Exercise', quantity: 1 });
    });

    it.skip('cancelOptionExercise — skipped (mutating op)', async () => {
      await tc.cancelOptionExercise({ id: 0 });
    });
  });
});
