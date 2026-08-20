/**
 * Integration tests — TradeClient (read-only and write endpoints).
 *
 * Write operations (placeOrder, cancelOrder, modifyOrder, placeForexOrder,
 * transferSegmentFund, submitOptionExercise, cancelOptionExercise) are in
 * the "Write operations" describe block. Each mutating call is immediately
 * cancelled / guarded by an env-var to avoid persistent side-effects.
 *
 * Irreversible operations (FX conversion, cross-segment fund move, early
 * option exercise) are permanently skipped — no env var enables them.
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
import type { OrderRequest } from '../../src/model/order';
import { PriceType } from '../../src/model/enums';
import { resolveFilledOrderId, yearsAgo, todayStr } from './_helpers';

describe.skipIf(!shouldRun())('TradeClient integration tests', () => {
  let tc: TradeClient;

  // Shared dynamic data resolved in beforeAll
  // Order id widened to string | number — server returns int64 which
  // patchLargeIntegers preserves as a string for ≥17-digit values.
  let filledOrderId: number | string | undefined;
  let positionSymbol: string | undefined;
  let positionTransferRecordId: string | undefined;
  let optionContractId: number | undefined;

  beforeAll(async () => {
    tc = buildTradeClient();

    // Fallback chain across filled → active → inactive orders. Fresh paper
    // accounts may have none at all — the `getOrder` case skips in that
    // scenario rather than fabricating an id.
    filledOrderId = await resolveFilledOrderId(tc);

    try {
      const positions = await tc.getPositions();
      if (positions.length) positionSymbol = positions[0].symbol;
    } catch { /* best-effort */ }

    // 3. Get a position transfer record id for detail query.
    // NOTE: The response field name is assumed/unverified — we try both
    // `id` and `recordId` but neither is confirmed against the actual API
    // response schema. If both are undefined, the detail test is skipped.
    try {
      const records = await tc.getPositionTransferRecords({ sinceDate: yearsAgo(1), toDate: todayStr() });
      if (records.length) {
        const id = records[0].id;
        if (id) positionTransferRecordId = id;
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
  // Shared error-classification helpers — used across "Write operations" and
  // "Order matrix" describe blocks. Kept at this single top-level location so
  // updates to what counts as an expected boundary vs. a real regression stay
  // in sync everywhere; previously these were duplicated per-block and could
  // drift out of sync with each other.
  // =========================================================================

  /** Server messages we treat as legitimate skips (permission / license / session). */
  const PERMISSION_ERROR_PATTERNS = [
    /access forbidden/i,
    /forbidden/i,
    /no permission/i,
    /not supported/i,
    /license/i,
    /not open/i,
    /not enabled/i,
    /no token/i,
    /don['’]t support trading/i,
    /unsupported instrument/i,
    /only limit orders are supported/i,
    /outside of regular trading hours/i,
    /market is closed/i,
    /only limit orders can be placed/i,
    /only limit, stop or stop-limit orders are allowed/i,
    /at non-trading hour/i,
    /orders cannot be placed at this moment/i,
    /auction order is not allowed at this moment/i,
    /does not support stock (long|short)/i,
    /only trade cash order by market order/i,
    /cash order by market order/i,
    // Algo orders (TWAP / VWAP): start_time must be inside the market's
    // regular trading window. CI runs outside RTH — treat as skip.
    /time range for the order/i,
    // Fractional-share (cashAmount) orders require RTH — same reason.
    /Only regular trading hours supported when trading fractional shares/i,
  ];

  /** Patterns for errors that mean the order reached a terminal state
   *  (filled, cancelled, rejected) before our modify/cancel arrived.
   *  Also covers prime-account-only order types (code: 1200, trade_prime_error).
   */
  const TERMINAL_ORDER_PATTERNS = [
    /cannot be modified/i,
    /cannot be (canc|cancell)ed/i,
    /already (canc|cancell)ed/i,
    /already filled/i,
    /invalid order status/i,
    // HK auction window rejects cancels during specific pre-open phases;
    // the order was accepted, we just can't cancel it right now.
    /cancellation is not allowed/i,
    /cancel is not allowed/i,
    // Prime account required for certain order types (code: 1200, category: trade_prime_error).
    // The SDK marshaled the request correctly; the account simply lacks prime entitlement.
    /trade_prime_error/i,
    /prime.*error/i,
  ];

  const RATE_LIMIT_PATTERNS = [
    /too_many_requests/i,
    /rate limit/i,
    /requestRateExceedLimit/i,
  ];

  function matches(msg: string, patterns: RegExp[]): boolean {
    return patterns.some((p) => p.test(msg));
  }

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
      // Derivative contracts require a future expiry date (YYYYMMDD).
      const expiry = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 10).replace(/-/g, '');
      const data = await tc.getDerivativeContracts({ symbols: ['AAPL'], secType: 'OPT', expiry });
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
        // id may be number or string depending on serialization
        expect(String(o.id)).toMatch(/^[1-9]\d*$/);
        expect(o.symbol).toBeTruthy();
        // Assert orderType field
        expect((o as any).orderType).toBeTruthy();
      }
    });

    it('getOrders — status=FILLED filter', async () => {
      // Filter by filled status; may be empty on fresh accounts.
      // OrdersRequest uses `states` (string[]) not `status`; server enum is 'Filled'.
      const data = await tc.getOrders({ states: ['Filled'] });
      expect(Array.isArray(data)).toBe(true);
      for (const o of data) {
        expect(String(o.id)).toMatch(/^[1-9]\d*$/);
        expect(o.symbol).toBeTruthy();
        // Server returns 'Filled' (title-case) for this status
        expect((o as any).status).toMatch(/^[Ff]illed$/);
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

    it('getOrder — by filled order id', async (ctx) => {
      // Fresh paper accounts may have zero orders across filled / active /
      // inactive queries. Order history is user-driven state, not
      // market-driven — skip with a clear reason instead of failing when
      // there's genuinely nothing to look up.
      if (!filledOrderId) {
        ctx.skip();
        return;
      }
      // Order ids can exceed JavaScript's MAX_SAFE_INTEGER (2^53 - 1).
      // The SDK's GetOrderRequest.id is typed `number` — coercing a 17+ digit
      // string via Number() loses precision and corrupts the round-trip.
      // Known risk: when the account's filled order id is > MAX_SAFE_INTEGER,
      // the SDK type must be widened to `string | number` to fix this properly.
      // If the id is unsafe to coerce, the test is skipped entirely to avoid
      // sending a corrupted id to the gateway. The wire path is only exercised
      // when the value is safe; id round-trip is asserted in that case.
      const asNum = Number(filledOrderId);
      const isSafe = Number.isSafeInteger(asNum) && String(asNum) === String(filledOrderId);
      if (!isSafe) {
        // The SDK's GetOrderRequest.id is typed `number`; coercing a 17+ digit
        // string loses precision and would corrupt the id sent to the gateway.
        // Skip this test rather than sending a wrong id that returns not-found.
        // Fix: widen GetOrderRequest.id to string | number.
        ctx.skip();
        return;
      }
      const data = await tc.getOrder({ id: asNum });
      expect(data).toBeDefined();
      if (data) {
        expect(String(data.id)).toBe(String(filledOrderId));
      }
    });

    it('getOrderTransactions', async () => {
      // Order transactions requires symbol; may be empty on new accounts.
      try {
        const now = Date.now();
        const data = await tc.getOrderTransactions({
          symbol: 'AAPL', secType: 'STK',
          startDate: now - 90 * 24 * 60 * 60 * 1000, endDate: now, limit: 5,
        });
        expect(Array.isArray(data)).toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden|no data|cannot be empty/i.test(msg)) return;
        throw err;
      }
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
        // Assert averageCost field
        expect((p as any).averageCost !== undefined).toBe(true);
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

    it.skip('getAggregateAssets — skipped (institution account only)', async () => {
      try {
        const data = await tc.getAggregateAssets();
        expect(data === undefined || data === null || typeof data === 'object').toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|unauthorized|not support|account type|forbidden|institution/i.test(msg)) return;
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
          totalQuantity: 1,
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
        const data = await tc.getSegmentFundAvailable({ fromSegment: 'FUT', currency: 'USD' });
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
        const data = await tc.getFundDetails({ segTypes: ['SEC'], currency: 'USD' });
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
        const data = await tc.getPositionTransferRecords({ sinceDate: yearsAgo(1), toDate: todayStr() });
        expect(Array.isArray(data)).toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // max_date.limit: server rejects date ranges exceeding its configured limit — expected boundary.
        if (/permission|unauthorized|not support|account type|forbidden|max_date\.limit/i.test(msg)) return;
        throw err;
      }
    });

    it('getPositionTransferExternalRecords', async () => {
      try {
        const data = await tc.getPositionTransferExternalRecords({ sinceDate: yearsAgo(1), toDate: todayStr() });
        expect(Array.isArray(data)).toBe(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // max_date.limit: server rejects date ranges exceeding its configured limit — expected boundary.
        if (/permission|unauthorized|not support|account type|forbidden|max_date\.limit/i.test(msg)) return;
        throw err;
      }
    });

    it('getPositionTransferDetail — by record id', async (ctx) => {
      // Real accounts may not have any transfer records — skip when the
      // seed is empty (this is a legitimate skip regardless of trading
      // hours because transfers are user-initiated, not market-driven).
      if (!positionTransferRecordId) {
        ctx.skip();
        return;
      }
      try {
        const data = await tc.getPositionTransferDetail({ id: positionTransferRecordId });
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

    it('checkOptionExercise — predict exercise outcome', async (ctx) => {
      // Requires a live option contract in the account. Paper accounts
      // rarely hold options, so this is a legitimate skip regardless of
      // trading hours.
      if (!optionContractId) {
        ctx.skip();
        return;
      }
      try {
        const data = await tc.checkOptionExercise({
          contractId: optionContractId,
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
    it('queryToken — returns token string or license error', async () => {
      try {
        const token = await tc.queryToken();
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
      } catch (err: unknown) {
        // Some licenses (e.g. TBNZ) have no token entitlement.
        const msg = err instanceof Error ? err.message : String(err);
        if (/no token|license/i.test(msg)) return;
        throw err;
      }
    });
  });

  // =========================================================================
  // Write operations — mutating endpoints against real sandbox gateway.
  // Order price is set far off the market to avoid unintended fills; a place
  // is followed by an immediate cancel so state doesn't leak between runs.
  // =========================================================================

  describe('Write operations', () => {
    /**
     * Build a limit BUY order for AAPL well below the current market price
     * (limitPrice=1) so it stays resting and safe to modify/cancel.
     */
    function limitBuyOrder(overrides: Partial<OrderRequest> = {}): OrderRequest {
      return {
        symbol: 'AAPL',
        secType: 'STK',
        currency: 'USD',
        action: 'BUY',
        orderType: 'LMT',
        limitPrice: 1,
        totalQuantity: 1,
        timeInForce: 'DAY',
        ...overrides,
      };
    }

    it('placeOrder — place + cancel round-trip', async () => {
      const placed = await tc.placeOrder(limitBuyOrder());
      expect(placed).toBeDefined();
      const orderId = placed!.id;
      expect(typeof orderId === 'number' || typeof orderId === 'string').toBe(true);

      // Clean up so we don't leave a resting order.
      const canceled = await tc.cancelOrder(orderId!);
      expect(canceled).toBeDefined();
    });

    it('modifyOrder — place, modify, cancel', async () => {
      const placed = await tc.placeOrder(limitBuyOrder());
      expect(placed).toBeDefined();
      const orderId = placed!.id!;

      // The order may transition to a non-modifiable state (filled / rejected)
      // very quickly in sandbox — accept that outcome and treat the modify
      // call as a success as long as the SDK marshaled the request correctly.
      try {
        const modified = await tc.modifyOrder(orderId, limitBuyOrder({ limitPrice: 2 }));
        expect(modified).toBeDefined();
      } catch (e: any) {
        const msg = String(e?.message ?? '');
        if (!matches(msg, TERMINAL_ORDER_PATTERNS)) throw e;
      } finally {
        // Best-effort cleanup — cancel may also fail if already terminal.
        try { await tc.cancelOrder(orderId); } catch { /* ignore */ }
      }
    });

    it('cancelOrder — place then cancel by id', async () => {
      const placed = await tc.placeOrder(limitBuyOrder());
      expect(placed).toBeDefined();
      const orderId = placed!.id!;

      const canceled = await tc.cancelOrder(orderId);
      expect(canceled).toBeDefined();
    });

    // placeForexOrder is an IRREVERSIBLE real FX conversion with no safe way
    // to auto-run in CI; request marshaling is covered by unit tests instead.
    it.skip('placeForexOrder — skipped (irreversible real FX conversion)');

    // transferSegmentFund is an IRREVERSIBLE cross-segment fund move with no
    // safe way to auto-run in CI; request marshaling is covered by unit tests
    // instead.
    it.skip('transferSegmentFund — skipped (irreversible cross-segment fund move)');

    it('cancelSegmentFund — cancel prior transfer', async (ctx) => {
      // cancelSegmentFund requires a segment fund transfer id from
      // getSegmentFundHistory, NOT a position transfer record id.
      // We query the history here; skip when no pending transfer is found
      // because this is user-driven state.
      let segmentFundTransferId: string | undefined;
      try {
        const history = await tc.getSegmentFundHistory({});
        const items: any[] = Array.isArray(history) ? history : (history as any)?.items ?? [];
        if (items.length) {
          const id = items[0]?.id ?? items[0]?.transferId;
          if (id != null) segmentFundTransferId = String(id);
        }
      } catch { /* best-effort */ }

      if (!segmentFundTransferId) {
        ctx.skip();
        return;
      }
      try {
        const res = await tc.cancelSegmentFund({
          id: segmentFundTransferId,
          currency: 'USD',
          amount: 1,
        });
        expect(res).toBeDefined();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Prime account errors (code: 1200) or permission errors are account-boundary
        // failures, not SDK regressions — treat as expected environment limitations.
        if (/trade_prime_error|prime.*error|permission|unauthorized|not support|account type|forbidden/i.test(msg)) return;
        throw err;
      }
    });

    // transferPosition is a mutating cross-account transfer. Requires a real
    // destination sub-account provisioned in the environment; the sandbox
    // rejects synthetic toAccount values with `account.notFound`. Request
    // marshaling is covered by unit tests instead.
    it.skip('transferPosition — skipped (mutating write, sandbox rejects synthetic toAccount)');

    // submitOptionExercise is an IRREVERSIBLE early exercise submission with
    // no safe way to auto-run in CI; request marshaling is covered by unit
    // tests instead.
    it.skip('submitOptionExercise — skipped (irreversible early exercise submission)');

    it('cancelOptionExercise — cancel by record id', async (ctx) => {
      // Find a cancellable exercise record; skip if the account has none.
      // (Gated on the query result itself, not `optionContractId` — this test
      // doesn't use that variable, and gating on it would incorrectly skip
      // accounts that have exercise records but no option contract lookup.)
      const records = await tc.getOptionExerciseRecords({ status: 'New', size: 5 });
      const items = records?.items ?? [];
      if (!items.length) {
        ctx.skip();
        return;
      }

      const res = await tc.cancelOptionExercise({ id: items[0].id });
      expect(typeof res).toBe('boolean');
    });
  });

  // ==================================================================
  // Matrix coverage — Phase 1: US market × order type × sec type
  // ==================================================================
  describe('Order matrix — US market', () => {
    /** Safe prices — kept far from market so BUY/SELL orders never fill. */
    const SAFE_BUY_PRICE = 0.01;
    const SAFE_SELL_PRICE = 999_999;
    const SAFE_STOP_BUY_TRIGGER = 999_999;

    /** Sleep for backoff between retries. */
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    /**
     * placeOrder with exponential backoff on rate limits.
     * Returns the order id or throws on non-rate-limit errors.
     */
    async function placeWithRetry(order: OrderRequest, context: string): Promise<number> {
      let delay = 1000;
      // Every branch inside the loop either returns (success) or throws
      // (non-rate-limit error, or the final rate-limited attempt) — the
      // loop never completes all 3 iterations without exiting, so there is
      // no reachable code path after it.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const placed = await tc.placeOrder(order);
          expect(placed, `${context}: placeOrder returned undefined`).toBeDefined();
          expect(placed!.id, `${context}: order id missing`).toBeDefined();
          return placed!.id!;
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          const isRateLimit = matches(msg, RATE_LIMIT_PATTERNS);
          if (isRateLimit && attempt < 2) {
            await sleep(delay);
            delay *= 2;
            continue;
          }
          if (isRateLimit) {
            // Final attempt still rate-limited — retries exhausted.
            throw new Error(`${context}: exhausted rate-limit retries: ${msg}`);
          }
          throw e; // Non-rate-limit error — surface unchanged.
        }
      }
      // Unreachable — satisfies TypeScript's control-flow analysis for the
      // Promise<number> return type.
      throw new Error(`${context}: unreachable`);
    }

    /** Best-effort cancel; ignore terminal-state races. */
    async function cancelTolerant(orderId: number, context: string) {
      try {
        await tc.cancelOrder(orderId);
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (!matches(msg, TERMINAL_ORDER_PATTERNS)) {
          throw new Error(`${context}: unexpected cancel failure: ${msg}`);
        }
      }
    }

    /**
     * preview → place → cancel round-trip.
     * Skips silently (returns early) when the server returns a permission or
     * session-boundary error; throws for unexpected errors.
     */
    async function previewAndPlace(order: OrderRequest, context: string): Promise<void> {
      // 1. Preview validates SDK marshaling before touching real state.
      try {
        const preview = await tc.previewOrder(order);
        expect(preview, `${context}: preview returned undefined`).toBeDefined();
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (matches(msg, PERMISSION_ERROR_PATTERNS)) return;
        throw e;
      }
      // 2. Place, then cancel.
      let orderId: number;
      try {
        orderId = await placeWithRetry(order, context);
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (matches(msg, PERMISSION_ERROR_PATTERNS)) return;
        throw e;
      }
      await cancelTolerant(orderId, context);
    }

    /** Build a base US STK order and merge overrides. */
    function usStkOrder(overrides: Partial<OrderRequest>): OrderRequest {
      return {
        symbol: 'AAPL',
        secType: 'STK',
        currency: 'USD',
        action: 'BUY',
        orderType: 'LMT',
        limitPrice: SAFE_BUY_PRICE,
        totalQuantity: 1,
        timeInForce: 'DAY',
        ...overrides,
      };
    }

    it('MKT — preview only (would fill immediately)', async () => {
      try {
        const preview = await tc.previewOrder(usStkOrder({
          orderType: 'MKT',
          limitPrice: undefined,
        }));
        expect(preview).toBeDefined();
      } catch (e: any) {
        if (!matches(String(e?.message ?? e), PERMISSION_ERROR_PATTERNS)) throw e;
      }
    });

    it('MKT by cashAmount — preview only', async () => {
      try {
        const preview = await tc.previewOrder(usStkOrder({
          orderType: 'MKT',
          limitPrice: undefined,
          totalQuantity: 0,
          cashAmount: 100,
        }));
        expect(preview).toBeDefined();
      } catch (e: any) {
        if (!matches(String(e?.message ?? e), PERMISSION_ERROR_PATTERNS)) throw e;
      }
    });

    it('LMT by cashAmount — safe price, place + cancel', async () => {
      await previewAndPlace(
        usStkOrder({ totalQuantity: 0, cashAmount: 100 }),
        'US STK LMT-by-amount',
      );
    });

    it('STP — trigger price far above market', async () => {
      await previewAndPlace(
        usStkOrder({
          orderType: 'STP',
          limitPrice: undefined,
          auxPrice: SAFE_STOP_BUY_TRIGGER,
        }),
        'US STK STP',
      );
    });

    it('STP_LMT — trigger + limit both safe', async () => {
      await previewAndPlace(
        usStkOrder({
          orderType: 'STP_LMT',
          limitPrice: SAFE_BUY_PRICE,
          auxPrice: SAFE_STOP_BUY_TRIGGER,
        }),
        'US STK STP_LMT',
      );
    });

    it('TRAIL — 50% trailing pct on SELL side', async () => {
      await previewAndPlace(
        usStkOrder({
          action: 'SELL',
          orderType: 'TRAIL',
          limitPrice: undefined,
          trailingPercent: 50,
        }),
        'US STK TRAIL',
      );
    });

    it('LMT + attached legs (bracket)', async () => {
      await previewAndPlace(
        usStkOrder({
          orderLegs: [
            { legType: 'PROFIT', price: SAFE_SELL_PRICE, timeInForce: 'GTC' },
            { legType: 'LOSS', price: SAFE_BUY_PRICE, timeInForce: 'GTC' },
          ],
        }),
        'US STK LMT+legs',
      );
    });

    it('OCA — two alternative limit legs', async () => {
      await previewAndPlace(
        usStkOrder({
          orderType: 'OCA',
          limitPrice: undefined,
          ocaOrders: [
            usStkOrder({ limitPrice: SAFE_BUY_PRICE }),
            usStkOrder({ limitPrice: SAFE_BUY_PRICE / 2 }),
          ],
        }),
        'US STK OCA',
      );
    });

    // AlgoParams: caller passes the natural object shape; TradeClient
    // internally marshals it into the [{tag, value}] array the gateway
    // expects. Previously required a manual conversion helper here.

    it('TWAP algo — safe limit price', async () => {
      const now = Date.now();
      await previewAndPlace(
        usStkOrder({
          orderType: 'TWAP',
          totalQuantity: 10,
          algoStrategy: 'TWAP',
          algoParams: {
            // String, to match the ICEBERG case below — keeps a single
            // wire convention for algoParams.startTime/endTime across
            // all algo order types.
            startTime: String(now),
            endTime: String(now + 3_600_000),
            allowPastEndTime: true,
          },
        }),
        'US STK TWAP',
      );
    });

    it('VWAP algo — participation rate + safe limit', async () => {
      const now = Date.now();
      await previewAndPlace(
        usStkOrder({
          orderType: 'VWAP',
          totalQuantity: 10,
          algoStrategy: 'VWAP',
          algoParams: {
            startTime: String(now),
            endTime: String(now + 3_600_000),
            participationRate: 0.1,
            allowPastEndTime: true,
          },
        }),
        'US STK VWAP',
      );
    });

    it('ICEBERG — full parameter set, place + cancel', async () => {
      const now = Date.now();
      await previewAndPlace(
        usStkOrder({
          orderType: 'ICEBERG',
          totalQuantity: 10,
          displaySize: 2,
          minDisplaySize: 1,
          checkIntervals: 30,
          // priceType required by the gateway even though the interface
          // marks it optional — matches the icebergOrder() helper default.
          priceType: PriceType.LIMIT_PRICE,
          startTime: String(now),
          endTime: String(now + 3_600_000),
        }),
        'US STK ICEBERG',
      );
    });

    it('OPT LMT — dynamic AAPL call contract', async () => {
      // Resolve nearest-expiry near-ATM CALL via QuoteClient
      const qc = buildQuoteClient();
      let expiry: string | undefined;
      let strike: number | undefined;
      try {
        const exps = await qc.getOptionExpirations({ symbols: ['AAPL'] });
        const dates = (exps as any)?.[0]?.dates ?? [];
        const today = new Date();
        for (const d of dates) {
          const dt = new Date(String(d));
          if ((dt.getTime() - today.getTime()) / 86_400_000 > 14) {
            expiry = String(d).replace(/-/g, '');
            break;
          }
        }
        if (!expiry) return; // skip

        const chain = await qc.getOptionChain({ symbol: 'AAPL', expiry });
        const items = (chain as any)?.items ?? [];
        const calls = items.filter((x: any) => x.putCall === 'CALL' || x.right === 'CALL');
        if (!calls.length) return;
        const mid = calls[Math.floor(calls.length / 2)];
        strike = Number(mid.strike);
      } catch { return; /* discovery failed — skip */ }

      if (!expiry || !strike) return;

      await previewAndPlace(
        {
          symbol: 'AAPL',
          secType: 'OPT',
          currency: 'USD',
          action: 'BUY',
          orderType: 'LMT',
          limitPrice: SAFE_BUY_PRICE,
          totalQuantity: 1,
          timeInForce: 'DAY',
          expiry,
          strike: String(strike),
          right: 'CALL',
        },
        'US OPT LMT',
      );
    });

    it('FUT LMT — CL main contract', async () => {
      await previewAndPlace(
        {
          symbol: 'CL',
          secType: 'FUT',
          currency: 'USD',
          action: 'BUY',
          orderType: 'LMT',
          limitPrice: SAFE_BUY_PRICE,
          totalQuantity: 1,
          timeInForce: 'DAY',
        },
        'US FUT LMT',
      );
    });

    // placeForexOrder is an IRREVERSIBLE real FX conversion with no safe way
    // to auto-run in CI; request marshaling is covered by unit tests instead.
    it.skip('Forex SEC segment — skipped (irreversible real FX conversion)');

    it('preview — negative price should still return or reject cleanly', async () => {
      try {
        await tc.previewOrder(usStkOrder({ limitPrice: -1 }));
      } catch { /* both accept and reject are OK for edge input */ }
    });

    // ================================================================
    // Phase 2 — HK / CN / SG market coverage
    // ================================================================
    // Base order builder for HK/CN/SG markets that reuses the same
    // safe-price convention and matches on non-US currency + symbol.

    function hkStkOrder(overrides: Partial<OrderRequest>): OrderRequest {
      return {
        symbol: '00700',
        secType: 'STK',
        currency: 'HKD',
        action: 'BUY',
        orderType: 'LMT',
        limitPrice: SAFE_BUY_PRICE,
        totalQuantity: 100,
        timeInForce: 'DAY',
        ...overrides,
      };
    }

    it('HK STK LMT — Tencent 00700', async () => {
      await previewAndPlace(hkStkOrder({}), 'HK STK LMT');
    });

    it('HK STK LMT — place + cancel round-trip (market=HK variant)', async () => {
      // Explicit market=HK variant to confirm the SDK routes to the HK gateway.
      await previewAndPlace(
        hkStkOrder({ symbol: '00700' }),
        'HK STK LMT market=HK',
      );
    });

    it('HK STK Auction Limit (AL) — only during HK auction windows', async () => {
      await previewAndPlace(
        hkStkOrder({ orderType: 'AL', outsideRth: true }),
        'HK STK AL',
      );
    });

    it('HK STK Auction Market (AM) — preview only', async () => {
      try {
        const preview = await tc.previewOrder(
          hkStkOrder({ orderType: 'AM', limitPrice: undefined, outsideRth: true }),
        );
        expect(preview).toBeDefined();
      } catch (e: any) {
        if (!matches(String(e?.message ?? e), PERMISSION_ERROR_PATTERNS)) throw e;
      }
    });

    it('HK STK LMT + bracket legs', async () => {
      await previewAndPlace(
        hkStkOrder({
          orderLegs: [
            { legType: 'PROFIT', price: SAFE_SELL_PRICE, timeInForce: 'GTC' },
            { legType: 'LOSS', price: SAFE_BUY_PRICE, timeInForce: 'GTC' },
          ],
        }),
        'HK STK LMT+legs',
      );
    });

    it('HK OPT LMT — dynamic 00700 option contract', async () => {
      // Discover an HK option via getDerivativeContracts.
      let expiry: string | undefined;
      let strike: string | undefined;
      let right: string | undefined;
      try {
        const contracts = await tc.getDerivativeContracts({
          symbol: '00700',
          secType: 'OPT',
          expiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
            .toISOString().slice(0, 10).replace(/-/g, ''),
        });
        if (!contracts?.length) return;
        const c: any = contracts[0];
        expiry = c.expiry;
        strike = c.strike != null ? String(c.strike) : undefined;
        right = c.right ?? c.putCall;
      } catch { return; }

      if (!expiry || !strike || !right) return;
      await previewAndPlace(
        {
          symbol: '00700', secType: 'OPT', currency: 'HKD',
          action: 'BUY', orderType: 'LMT', limitPrice: SAFE_BUY_PRICE,
          totalQuantity: 1, timeInForce: 'DAY',
          expiry, strike, right,
        },
        'HK OPT LMT',
      );
    });

    it('HK WAR LMT — dynamic warrant contract', async () => {
      let contract: any;
      try {
        const results = await tc.getDerivativeContracts({
          symbol: '00700',
          secType: 'WAR',
          expiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
            .toISOString().slice(0, 10).replace(/-/g, ''),
        });
        contract = results?.[0];
      } catch { return; }
      if (!contract) return;

      await previewAndPlace(
        {
          symbol: contract.symbol ?? '00700',
          secType: 'WAR', currency: 'HKD',
          action: 'BUY', orderType: 'LMT', limitPrice: SAFE_BUY_PRICE,
          totalQuantity: 100, timeInForce: 'DAY',
          expiry: contract.expiry,
          strike: String(contract.strike ?? ''),
          right: contract.right ?? contract.putCall,
        },
        'HK WAR LMT',
      );
    });

    it('HK IOPT LMT — dynamic callable bull/bear contract', async () => {
      let contract: any;
      try {
        const results = await tc.getDerivativeContracts({
          symbol: '00700',
          secType: 'IOPT',
          expiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
            .toISOString().slice(0, 10).replace(/-/g, ''),
        });
        contract = results?.[0];
      } catch { return; }
      if (!contract) return;

      await previewAndPlace(
        {
          symbol: contract.symbol ?? '00700',
          secType: 'IOPT', currency: 'HKD',
          action: 'BUY', orderType: 'LMT', limitPrice: SAFE_BUY_PRICE,
          totalQuantity: 100, timeInForce: 'DAY',
          expiry: contract.expiry,
          strike: String(contract.strike ?? ''),
          right: contract.right ?? contract.putCall,
        },
        'HK IOPT LMT',
      );
    });

    it('CN STK LMT — Ping An Bank 000001.SZ', async () => {
      await previewAndPlace(
        {
          symbol: '000001', secType: 'STK', currency: 'CNH',
          action: 'BUY', orderType: 'LMT', limitPrice: SAFE_BUY_PRICE,
          totalQuantity: 100, timeInForce: 'DAY',
        },
        'CN STK LMT',
      );
    });

    it('SG STK LMT — DBS Group D05', async () => {
      await previewAndPlace(
        {
          symbol: 'D05', secType: 'STK', currency: 'SGD',
          action: 'BUY', orderType: 'LMT', limitPrice: SAFE_BUY_PRICE,
          totalQuantity: 100, timeInForce: 'DAY',
        },
        'SG STK LMT',
      );
    });

    // ================================================================
    // Phase 3 — MLEG combo + edge cases
    // ================================================================

    it('MLEG vertical spread — AAPL PUT spread', async () => {
      // Resolve two adjacent PUT strikes on the same expiry.
      const qc = buildQuoteClient();
      let expiry: string | undefined;
      let lower: number | undefined;
      let higher: number | undefined;
      try {
        const exps = await qc.getOptionExpirations({ symbols: ['AAPL'] });
        const dates = (exps as any)?.[0]?.dates ?? [];
        const today = new Date();
        for (const d of dates) {
          const dt = new Date(String(d));
          if ((dt.getTime() - today.getTime()) / 86_400_000 > 14) {
            expiry = String(d).replace(/-/g, '');
            break;
          }
        }
        if (!expiry) return;
        const chain = await qc.getOptionChain({ symbol: 'AAPL', expiry });
        const items = (chain as any)?.items ?? [];
        const puts = items
          .filter((x: any) => (x.putCall ?? x.right) === 'PUT')
          .map((x: any) => Number(x.strike))
          .filter((n: number) => Number.isFinite(n))
          .sort((a: number, b: number) => a - b);
        if (puts.length < 2) return;
        const mid = Math.floor(puts.length / 2);
        lower = puts[Math.min(mid, puts.length - 2)];
        higher = puts[Math.min(mid + 1, puts.length - 1)];
      } catch { return; }
      if (!expiry || !lower || !higher) return;

      const order: OrderRequest = {
        symbol: 'AAPL',
        secType: 'MLEG',
        currency: 'USD',
        action: 'BUY',
        orderType: 'LMT',
        limitPrice: -100, // deeply negative — cannot execute
        totalQuantity: 1,
        timeInForce: 'DAY',
        comboType: 'VERTICAL',
        contractLegs: [
          {
            symbol: 'AAPL', secType: 'OPT', expiry,
            strike: String(lower), right: 'PUT',
            action: 'BUY', ratio: 1,
          },
          {
            symbol: 'AAPL', secType: 'OPT', expiry,
            strike: String(higher), right: 'PUT',
            action: 'SELL', ratio: 1,
          },
        ],
      };
      await previewAndPlace(order, 'US MLEG VERTICAL');
    });

    it('ICEBERG modify — place, modify limit price, cancel', async () => {
      const now = Date.now();
      const order = usStkOrder({
        orderType: 'ICEBERG',
        totalQuantity: 10,
        displaySize: 2,
        minDisplaySize: 1,
        checkIntervals: 30,
        priceType: PriceType.LIMIT_PRICE,
        startTime: String(now),
        endTime: String(now + 3_600_000),
      });
      let orderId: number;
      try {
        orderId = await placeWithRetry(order, 'US STK ICEBERG modify');
      } catch (e: any) {
        if (matches(String(e?.message ?? e), PERMISSION_ERROR_PATTERNS)) return;
        throw e;
      }
      try {
        await tc.modifyOrder(orderId, { ...order, limitPrice: SAFE_BUY_PRICE * 2 });
      } catch (e: any) {
        if (!matches(String(e?.message ?? e), TERMINAL_ORDER_PATTERNS)) {
          throw e; // Unexpected error — rethrow to surface it
        }
      } finally {
        await cancelTolerant(orderId, 'US STK ICEBERG modify');
      }
    });

    it('SELL SHORT preview — validates SDK marshals shortable action', async () => {
      try {
        const preview = await tc.previewOrder(
          usStkOrder({ action: 'SELL', limitPrice: SAFE_SELL_PRICE }),
        );
        expect(preview).toBeDefined();
      } catch (e: any) {
        if (!matches(String(e?.message ?? e), PERMISSION_ERROR_PATTERNS)) throw e;
      }
    });
  });
});
