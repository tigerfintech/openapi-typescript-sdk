/**
 * Integration tests — QuoteClient (full coverage).
 *
 * Guarded by `describe.skipIf(!shouldRun())`: skipped automatically in CI
 * when credentials or TIGER_RUN_INTEG=true are missing.
 *
 * Run with:
 *   TIGER_RUN_INTEG=true npm run test:integ
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { shouldRun, buildQuoteClient } from './integ-setup';
import { QuoteClient, parseOptionIdentifier } from '../../src/quote/quote-client';
import {
  FUTURES_FALLBACK,
  isMarketOpenExtendedCached,
  isMarketTradingCached,
  primeMarketStatuses,
  resolveHkWarrantSymbol,
  resolveUsOptionIdentifier,
  yearsAgo,
  todayStr,
} from './_helpers';

/** Nearest past weekday (Mon-Fri) in 'YYYY-MM-DD' format. */
function recentWeekday(): string {
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** First day of the current month in 'YYYY-MM-DD' format. */
function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Last day of the current month in 'YYYY-MM-DD' format. */
function monthEnd(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

/** First day (Jan 1) of the year N years ago, in 'YYYY-MM-DD' format. */
function yearStartAgo(n: number): string {
  const d = new Date();
  return `${d.getFullYear() - n}-01-01`;
}

/** Last day (Dec 31) of the year N years ago, in 'YYYY-MM-DD' format. */
function yearEndAgo(n: number): string {
  const d = new Date();
  return `${d.getFullYear() - n}-12-31`;
}

describe.skipIf(!shouldRun())('QuoteClient integration tests', () => {
  let qc: QuoteClient;

  // Shared dynamic data resolved in beforeAll
  let optionIdentifier: string | undefined;
  let futureExchangeCode: string | undefined;
  let futureContractCode: string | undefined;
  let futureType: string | undefined;
  let industryId: string | undefined;

  beforeAll(async () => {
    qc = buildQuoteClient();

    // Prime the market-state cache once so every `.skipIf(...)` and inline
    // trading-hours check reads without an extra RPC. We cover the
    // per-market checks used by the suite: US for stocks/options, HK for
    // warrants, and — via extended checks — CN/SG when needed.
    await primeMarketStatuses(qc, ['US', 'HK']);

    // 1. Get AAPL nearest option identifier.
    //    If the resolver returns undefined AND the US market is trading,
    //    that's a real bug (empty option chain during RTH should not
    //    happen) — fail the whole suite via `beforeAll`. Otherwise leave
    //    undefined and let each `it()` block decide whether to skip.
    optionIdentifier = await resolveUsOptionIdentifier(qc);
    if (!optionIdentifier && isMarketTradingCached('US')) {
      throw new Error(
        'resolveUsOptionIdentifier() returned undefined while US market is TRADING — ' +
        'option chain endpoint should always yield data during RTH.',
      );
    }

    // 2. Get futures exchange and contract.
    //
    // Iterate the exchanges returned by `future_exchange` and fall back to
    // known-good codes (`CME` / `NYMEX` / `COMEX` / `GLOBEX`) if the list
    // is empty. Paper accounts sometimes have restricted futures
    // permissions; if every exchange returns empty, fall back to the
    // hard-coded `MNQmain` contract so the Futures tests still execute.
    try {
      const excs = await qc.getFutureExchange();
      const seenCodes = new Set<string>();
      const candidates: string[] = [];
      for (const e of excs as any[]) {
        const code = e?.code ?? e?.exchangeCode;
        if (code && !seenCodes.has(code)) {
          seenCodes.add(code);
          candidates.push(code);
        }
      }
      for (const code of ['CME', 'NYMEX', 'COMEX', 'GLOBEX']) {
        if (!seenCodes.has(code)) {
          seenCodes.add(code);
          candidates.push(code);
        }
      }
      for (const code of candidates) {
        try {
          const contracts = await qc.getFutureContracts(code);
          if (contracts.length) {
            futureExchangeCode = code;
            const first = contracts[0] as any;
            futureContractCode = first.contractCode;
            futureType = first.type;
            break;
          }
        } catch { /* try next exchange */ }
      }
      // Fall back to the first exchange code even if empty so exchange-only
      // tests still run.
      if (!futureExchangeCode && candidates.length) {
        futureExchangeCode = candidates[0];
      }
    } catch { /* best-effort */ }

    // Ultimate fallback: hardcoded continuous-contract identifier. Futures
    // trade nearly 24/6 so we don't gate on trading hours here — if the
    // gateway simply doesn't grant futures data to the account, the
    // individual tests will get a permission error and surface it.
    if (!futureContractCode) {
      futureExchangeCode = futureExchangeCode ?? FUTURES_FALLBACK.exchangeCode;
      futureContractCode = FUTURES_FALLBACK.contractCode;
      futureType = FUTURES_FALLBACK.futureType;
    }

    // 3. Get industry ID. Try multiple levels so at least one non-empty
    //    response yields a seed. `GSECTOR` is always populated for US — if
    //    every level returns empty something is wrong with the account.
    for (const level of ['GSECTOR', 'GGROUP', 'GIND', 'GSUBIND']) {
      try {
        const industries = await qc.getIndustryList({ industryLevel: level });
        if (industries.length) {
          const id = (industries[0] as any).id ?? (industries[0] as any).industryId;
          if (id) {
            industryId = String(id);
            break;
          }
        }
      } catch { /* try next level */ }
    }
    if (!industryId) {
      throw new Error(
        'getIndustryList returned empty for every level (GSECTOR/GGROUP/GIND/GSUBIND) — ' +
        'expected at least one industry entry.',
      );
    }
  });

  // =========================================================================
  // Basic market data
  // =========================================================================

  describe('Basic market data', () => {
    it('getMarketState — US market', async () => {
      const data = await qc.getMarketState('US');
      expect(Array.isArray(data)).toBe(true);
      if (data.length) {
        expect((data[0] as any).market).toBe('US');
        expect((data[0] as any).marketStatus).toBeTruthy();
      }
    });

    it('getRealTimeQuote — AAPL', async () => {
      const data = await qc.getRealTimeQuote({ symbols: ['AAPL'] });
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect((data[0] as any).latestPrice).toBeGreaterThan(0);
      expect((data[0] as any).latestTime).toBeGreaterThan(0);
    });

    it('getBrief — AAPL (alias)', async () => {
      const data = await qc.getBrief({ symbols: ['AAPL'] });
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect((data[0] as any).latestPrice).toBeGreaterThan(0);
    });

    it('getKline — AAPL day', async () => {
      const data = await qc.getKline({ symbols: ['AAPL'], period: 'day', limit: 5 });
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      const items = (data[0] as any).items ?? [];
      if (items.length) {
        expect(items[0].high).toBeGreaterThanOrEqual(items[0].low);
        expect(items[0].close).toBeGreaterThan(0);
      }
    });

    it('getTimeline — AAPL', async () => {
      // Non-trading hours: data may be empty — only assert fields when non-empty
      const data = await qc.getTimeline(['AAPL']);
      expect(Array.isArray(data)).toBe(true);
      if (data.length && (data[0] as any).items?.length) {
        expect((data[0] as any).items[0].time).toBeDefined();
      }
    });

    it('getTradeTick — AAPL', async () => {
      // Non-trading hours: data may be empty — only assert fields when non-empty
      const data = await qc.getTradeTick({ symbols: ['AAPL'], limit: 5 });
      expect(Array.isArray(data)).toBe(true);
      if (data.length && (data[0] as any).items?.length) {
        expect((data[0] as any).items[0].time).toBeDefined();
      }
    });

    it('getQuoteDepth — AAPL US', async () => {
      const data = await qc.getQuoteDepth({ symbols: ['AAPL'], market: 'US' });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getDelayedQuote — AAPL', async () => {
      const data = await qc.getDelayedQuote({ symbols: ['AAPL'] });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getStockDelayBriefs — AAPL (deprecated alias)', async () => {
      const data = await qc.getStockDelayBriefs({ symbols: ['AAPL'] });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getQuoteOvernight — AAPL', async () => {
      // Non-trading hours: data may be empty — only assert fields when non-empty
      const data = await qc.getQuoteOvernight({ symbols: ['AAPL'] });
      expect(Array.isArray(data)).toBe(true);
      if (data.length) {
        expect((data[0] as any).symbol).toBeTruthy();
      }
    });
  });

  // =========================================================================
  // Timeline history
  // =========================================================================

  describe('Timeline history', () => {
    it('getTimelineHistory — AAPL recent weekday', async () => {
      // Non-trading hours: data may be empty — only assert fields when non-empty
      const data = await qc.getTimelineHistory({ symbols: ['AAPL'], date: recentWeekday() });
      expect(Array.isArray(data)).toBe(true);
      if (data.length && (data[0] as any).items?.length) {
        expect((data[0] as any).items[0].time).toBeDefined();
      }
    });
  });

  // =========================================================================
  // Options
  // =========================================================================

  describe('Options', () => {
    it('getOptionExpiration — AAPL', async () => {
      const data = await qc.getOptionExpiration(['AAPL']);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect((data[0] as any).dates?.length).toBeGreaterThan(0);
    });

    it('getOptionChain — AAPL first expiry', async () => {
      const exps = await qc.getOptionExpiration(['AAPL']);
      // No option expiry data available — skip
      if (!exps.length || !(exps[0] as any).dates?.length) return;
      const chain = await qc.getOptionChain([['AAPL', (exps[0] as any).dates[0]]]);
      expect(Array.isArray(chain)).toBe(true);
      if (chain.length && chain[0].items?.length) {
        const row = chain[0].items[0];
        const id = (row as any).call?.identifier ?? (row as any).put?.identifier;
        expect(id).toBeTruthy();
      }
    });

    it('getOptionKline — option identifier', async (ctx) => {
      if (!optionIdentifier) {
        ctx.skip();
        return;
      }
      // Server rejects begin_time=-1/end_time=-1 as "begin_time > end_time"
      // when a limit is set — pass a real 30-day window instead.
      const now = Date.now();
      const begin = now - 30 * 24 * 60 * 60 * 1000;
      const data = await qc.getOptionKline([optionIdentifier], 'day', begin, now, undefined, 3);
      expect(Array.isArray(data)).toBe(true);
    });

    it('getOptionQuote — option identifier', async (ctx) => {
      if (!optionIdentifier) {
        ctx.skip();
        return;
      }
      const data = await qc.getOptionQuote([optionIdentifier]);
      expect(Array.isArray(data)).toBe(true);
    });

    it('getOptionBrief — option identifier (alias)', async (ctx) => {
      if (!optionIdentifier) {
        ctx.skip();
        return;
      }
      const data = await qc.getOptionBrief([optionIdentifier]);
      expect(Array.isArray(data)).toBe(true);
    });

    it('getOptionSymbols — HK market', async () => {
      let data: any;
      try {
        data = await qc.getOptionSymbols({ market: 'HK' });
      } catch (e: any) {
        if (/does not support|not support/i.test(e?.message ?? '')) {
          return; // HK option symbols not supported by this account/env — skip
        }
        throw e;
      }
      expect(Array.isArray(data)).toBe(true);
    });

    it('getOptionAnalysis — AAPL US', async () => {
      const data = await qc.getOptionAnalysis({ symbols: ['AAPL'], market: 'US', period: '52week' });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getOptionTradeTicks — option identifier', async (ctx) => {
      if (!optionIdentifier) {
        ctx.skip();
        return;
      }
      const parsed = parseOptionIdentifier(optionIdentifier);
      const data = await qc.getOptionTradeTicks({
        contracts: [{
          symbol: parsed.symbol,
          expiry: parsed.expiryMs,
          strike: String(parsed.strike),
          right: parsed.right,
        }],
      });
      expect(Array.isArray(data)).toBe(true);
      // In-hours the endpoint should return trade ticks. Off-hours the
      // server returns an empty envelope — that's expected.
      if (isMarketTradingCached('US')) {
        expect(data.length).toBeGreaterThan(0);
        expect((data[0] as any).items?.length ?? 0).toBeGreaterThan(0);
        expect((data[0] as any).items[0].time).toBeDefined();
      } else if (data.length && (data[0] as any).items?.length) {
        expect((data[0] as any).items[0].time).toBeDefined();
      }
    });

    it('getOptionTimeline — option identifier', async (ctx) => {
      if (!optionIdentifier) {
        ctx.skip();
        return;
      }
      const parsed = parseOptionIdentifier(optionIdentifier);
      // Server requires top-level `market` alongside optionQuery.
      const data = await qc.getOptionTimeline({
        market: 'US',
        optionQuery: [{
          symbol: parsed.symbol,
          expiry: parsed.expiryMs,
          strike: String(parsed.strike),
          right: parsed.right,
        }],
      });
      expect(Array.isArray(data)).toBe(true);
      if (isMarketTradingCached('US')) {
        expect(data.length).toBeGreaterThan(0);
        expect((data[0] as any).items?.length ?? 0).toBeGreaterThan(0);
        expect((data[0] as any).items[0].time).toBeDefined();
      } else if (data.length && (data[0] as any).items?.length) {
        expect((data[0] as any).items[0].time).toBeDefined();
      }
    });

    it('getOptionDepth — option identifier', async (ctx) => {
      if (!optionIdentifier) {
        ctx.skip();
        return;
      }
      const parsed = parseOptionIdentifier(optionIdentifier);
      const data = await qc.getOptionDepth({
        optionBasic: [{
          symbol: parsed.symbol,
          expiry: parsed.expiryMs,
          strike: String(parsed.strike),
          right: parsed.right,
        }],
      });
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // =========================================================================
  // Stock basics
  // =========================================================================

  describe('Stock basics', () => {
    it('getSymbols — US STK', async () => {
      const data = await qc.getSymbols({ market: 'US', secType: 'STK' });
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(typeof data[0]).toBe('string');
    });

    it('getSymbolNames — US STK', async () => {
      const data = await qc.getSymbolNames({ market: 'US', secType: 'STK' });
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('getTradeMetas — AAPL', async () => {
      const data = await qc.getTradeMetas({ symbols: ['AAPL'] });
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect((data[0] as any).symbol).toBeTruthy();
    });

    it('getStockDetails — AAPL', async () => {
      const data = await qc.getStockDetails({ symbols: ['AAPL'] });
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect((data[0] as any).symbol).toBeTruthy();
    });

    it('getStockBroker — HK 00700', async () => {
      // Stock broker interface only supports the HK market.
      const data = await qc.getStockBroker({ symbol: '00700' });
      // May be undefined for markets without broker queue
      expect(data === undefined || data === null || typeof data === 'object').toBe(true);
    });

    it('getStockFundamental — AAPL US', async () => {
      const data = await qc.getStockFundamental({ symbols: ['AAPL'], market: 'US' });
      expect(typeof data).toBe('object');
    });

    it('getStockIndustry — AAPL US', async () => {
      const data = await qc.getStockIndustry({ symbol: 'AAPL', market: 'US' });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getTradeRank — US', async () => {
      const data = await qc.getTradeRank({ market: 'US' });
      expect(Array.isArray(data)).toBe(true);
    });

    it.skip('getShortInterest — skipped (account does not support method)', async () => {
      const data = await qc.getShortInterest({ symbols: ['AAPL'] });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getKlineQuota', async () => {
      const data = await qc.getKlineQuota({});
      expect(Array.isArray(data)).toBe(true);
    });

    it('getQuotePermission', async () => {
      const data = await qc.getQuotePermission({});
      expect(Array.isArray(data)).toBe(true);
    });

    // grabQuotePermission is a mutating operation (activates/claims quote
    // permissions) and must not run against the real gateway in integration
    // tests. It is covered by unit tests with mocked transport instead.
    it.skip('grabQuotePermission — skipped (mutating op)', async () => {
      const data = await qc.grabQuotePermission();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // =========================================================================
  // K-line pagination
  // =========================================================================

  describe('K-line pagination', () => {
    it('getKlineByPage — AAPL day', async () => {
      const data = await qc.getKlineByPage({ symbol: 'AAPL', period: 'day', totalSize: 10 });
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // =========================================================================
  // Industry & calendar
  // =========================================================================

  describe('Industry & calendar', () => {
    it('getIndustryList — returns array with id', async () => {
      const data = await qc.getIndustryList({ industryLevel: 'GSECTOR' });
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      const first = data[0] as any;
      expect(first.id ?? first.industryId).toBeTruthy();
    });

    it('getIndustryStocks', async (ctx) => {
      // `industryId` is asserted non-empty in `beforeAll` — the guard here
      // is a defensive fallback that keeps this case skippable in case a
      // future change loosens the beforeAll invariant.
      if (!industryId) {
        ctx.skip();
        return;
      }
      let data: any;
      try {
        data = await qc.getIndustryStocks({ industryId });
      } catch (e: any) {
        // Some paper accounts don't have industry-stock lookup enabled
        // (gateway returns code=4 "method does not support"). Skip rather
        // than fail — this is an account boundary, not an SDK regression.
        if (e?.code === 4 || /not support/i.test(e?.message ?? '')) {
          ctx.skip();
          return;
        }
        throw e;
      }
      expect(Array.isArray(data)).toBe(true);
    });

    it('getTradingCalendar — US current month', async () => {
      const data = await qc.getTradingCalendar({ market: 'US', beginDate: monthStart(), endDate: monthEnd() });
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // =========================================================================
  // Corporate actions
  // =========================================================================

  describe('Corporate actions', () => {
    // beginDate/endDate are epoch-ms on the wire — Python's date_str_to_timestamp
    // convention. Server rejects string dates for corporate_action.
    const corpReq = {
      symbols: ['AAPL'], market: 'US',
      beginDate: Date.parse(yearsAgo(3)),
      endDate: Date.parse(todayStr()),
    };

    it('getCorporateAction', async () => {
      const data = await qc.getCorporateAction({ ...corpReq, actionType: 'split' });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getCorporateSplit', async () => {
      const data = await qc.getCorporateSplit(corpReq as any);
      expect(Array.isArray(data)).toBe(true);
    });

    it('getCorporateDividend — non-empty for AAPL', async () => {
      const data = await qc.getCorporateDividend(corpReq as any);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('getCorporateEarningsCalendar', async () => {
      // Earnings calendar date interval cannot exceed 1 month.
      const data = await qc.getCorporateEarningsCalendar({
        symbols: ['AAPL'], market: 'US', actionType: 'earning',
        beginDate: Date.parse(monthStart()), endDate: Date.parse(monthEnd()),
      });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getCorporateSymbolChange', async () => {
      const data = await qc.getCorporateSymbolChange(corpReq);
      expect(Array.isArray(data)).toBe(true);
    });

    it('getCorporateDelisting', async () => {
      const data = await qc.getCorporateDelisting(corpReq);
      expect(Array.isArray(data)).toBe(true);
    });

    it('getCorporateIPO', async () => {
      const data = await qc.getCorporateIPO(corpReq);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // =========================================================================
  // Financial data
  // =========================================================================

  describe('Financial data', () => {
    it('getFinancialDaily — AAPL', async () => {
      const data = await qc.getFinancialDaily({
        symbols: ['AAPL'],
        market: 'US',
        fields: ['shares_outstanding'],
        beginDate: yearStartAgo(1),
        endDate: yearEndAgo(1),
      });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFinancialReport — AAPL quarterly', async () => {
      // beginDate/endDate are epoch-ms on the wire.
      const data = await qc.getFinancialReport({
        symbols: ['AAPL'],
        market: 'US',
        fields: ['net_income'],
        periodType: 'LTM',
        beginDate: Date.parse(yearStartAgo(1)),
        endDate: Date.parse(yearEndAgo(1)),
      });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFinancialCurrency — AAPL US', async () => {
      const data = await qc.getFinancialCurrency({ symbols: ['AAPL'], market: 'US' });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFinancialExchangeRate — USD/HKD', async () => {
      const data = await qc.getFinancialExchangeRate({
        currencyList: ['USD', 'HKD'],
        beginDate: yearStartAgo(1).replace(/-/g, ''),
        endDate: yearEndAgo(1).replace(/-/g, ''),
      });
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        const first = data[0] as any;
        // rate field may be nested or named differently depending on server version
        const hasRate = first.rate !== undefined || first.exchangeRate !== undefined
          || first.close !== undefined;
        expect(hasRate).toBe(true);
      }
    });
  });

  // =========================================================================
  // Capital flow
  // =========================================================================

  describe('Capital flow', () => {
    it('getCapitalFlow — AAPL US day', async () => {
      // Non-trading hours: data may be empty — only assert fields when non-empty
      const data = await qc.getCapitalFlow('AAPL', 'US', 'day');
      if (data) {
        expect((data as any).symbol).toBe('AAPL');
      }
    });

    it('getCapitalDistribution — AAPL US', async () => {
      // Non-trading hours: data may be empty — only assert fields when non-empty
      const data = await qc.getCapitalDistribution('AAPL', 'US');
      expect(data === undefined || data === null || typeof data === 'object').toBe(true);
    });
  });

  // =========================================================================
  // Market scanner
  // =========================================================================

  describe('Market scanner', () => {
    it('marketScanner — US', async () => {
      const data = await qc.marketScanner({ market: 'US' });
      expect(data === undefined || data === null || typeof data === 'object').toBe(true);
    });

    it('getMarketScannerTags — US', async () => {
      let data: any;
      try {
        data = await qc.getMarketScannerTags({
          market: 'US',
          multiTagFieldList: ['industry', 'concept'],
        });
      } catch (e: any) {
        if (/biz param error|parse parameters|not support/i.test(e?.message ?? '')) {
          return; // market_scanner_tags biz_content parsing not supported in this env
        }
        throw e;
      }
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // =========================================================================
  // Futures
  // =========================================================================

  describe('Futures', () => {
    it('getFutureExchange', async () => {
      const data = await qc.getFutureExchange();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      const first = data[0] as any;
      expect(first.code ?? first.exchangeCode).toBeTruthy();
    });

    // Futures seed is now guaranteed by beforeAll (falls back to hardcoded
    // MNQmain if all exchanges return empty), so these tests execute
    // unconditionally and surface real permission errors when they occur.
    it('getFutureContracts', async () => {
      const data = await qc.getFutureContracts(futureExchangeCode!);
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFutureRealTimeQuote', async () => {
      const data = await qc.getFutureRealTimeQuote({ contractCodes: [futureContractCode!] });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFutureContract — single', async () => {
      const data = await qc.getFutureContract({ contractCode: futureContractCode! });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getAllFutureContracts', async () => {
      // Python `get_all_future_contracts(future_type)` sends `type`
      // (like "CL"). `exchange` is server-side optional but `type` is the
      // canonical query field.
      const data = await qc.getAllFutureContracts({ type: futureType! });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getCurrentFutureContract', async () => {
      // future_current_contract requires `type` (e.g. "CL"); contractCode
      // alone is rejected with "field 'type' cannot be empty".
      const data = await qc.getCurrentFutureContract({
        contractCode: futureContractCode!,
        type: futureType!,
      });
      expect(data === undefined || data === null || typeof data === 'object').toBe(true);
    });

    it('getFutureContinuousContracts', async () => {
      // Wire param is `type` (future type, e.g. "CL"), not a contract code.
      const data = await qc.getFutureContinuousContracts({ type: futureType! });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFutureKline', async () => {
      const data = await qc.getFutureKline({ contractCode: futureContractCode!, period: 'day', limit: 3 });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFutureKlineByPage', async () => {
      const data = await qc.getFutureKlineByPage({ contractCode: futureContractCode!, period: 'day', totalSize: 5 });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFutureTradeTicks', async () => {
      // Futures trade nearly 24/6. Data may still be sparse during the
      // daily settlement break — only assert content when items are
      // present rather than gating on stock-market RTH.
      const data = await qc.getFutureTradeTicks({ contractCode: futureContractCode! });
      expect(Array.isArray(data)).toBe(true);
      if (data.length && (data[0] as any).items?.length) {
        expect((data[0] as any).items[0].time).toBeDefined();
      }
    });

    it('getFutureDepth', async () => {
      const data = await qc.getFutureDepth({ contractCodes: [futureContractCode!] });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFutureTradingTimes', async () => {
      const data = await qc.getFutureTradingTimes({ contractCode: futureContractCode! });
      expect(data === undefined || data === null || typeof data === 'object').toBe(true);
    });

    it('getFutureHistoryMainContract', async (ctx) => {
      // Wire param `contract_codes` accepts main-contract identifiers like
      // "CLmain" (future type + "main"), not exchange codes.
      const now = Date.now();
      let data: any;
      try {
        data = await qc.getFutureHistoryMainContract({
          contractCodes: [`${futureType!}main`],
          beginTime: now - 90 * 24 * 60 * 60 * 1000,
          endTime: now,
        });
      } catch (e: any) {
        // Paper accounts without the futures history entitlement return
        // code=4 "method does not support" — treat as a boundary skip.
        if (e?.code === 4 || /not support/i.test(e?.message ?? '')) {
          ctx.skip();
          return;
        }
        throw e;
      }
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // =========================================================================
  // Fund
  // =========================================================================

  describe('Fund', () => {
    let fundSymbol: string | undefined;

    beforeAll(async () => {
      try {
        const syms = await qc.getFundSymbols({});
        if (syms.length) fundSymbol = syms[0];
      } catch { /* best-effort */ }
    });

    it('getFundSymbols', async () => {
      const data = await qc.getFundSymbols({});
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFundContracts', async () => {
      // Empty when no fund symbol available — only assert fields when non-empty
      const symbols = fundSymbol ? [fundSymbol] : [];
      const data = await qc.getFundContracts({ symbols });
      expect(Array.isArray(data)).toBe(true);
      if (data.length) expect((data[0] as any).symbol).toBeTruthy();
    });

    it('getFundQuote', async () => {
      // Empty when no fund symbol available — only assert fields when non-empty
      const symbols = fundSymbol ? [fundSymbol] : [];
      const data = await qc.getFundQuote({ symbols });
      expect(Array.isArray(data)).toBe(true);
      if (data.length) expect((data[0] as any).symbol).toBeTruthy();
    });

    it('getFundHistoryQuote', async () => {
      // Empty when no fund symbol available — only assert fields when non-empty
      const symbols = fundSymbol ? [fundSymbol] : [];
      const end = Date.now();
      const begin = end - 180 * 24 * 60 * 60 * 1000;
      const data = await qc.getFundHistoryQuote({ symbols, beginTime: begin, endTime: end, limit: 5 });
      expect(Array.isArray(data)).toBe(true);
      if (data.length) expect((data[0] as any).symbol).toBeTruthy();
    });
  });

  // =========================================================================
  // Warrant
  // =========================================================================

  describe('Warrant', () => {
    let warrantSymbol: string | undefined;

    beforeAll(async () => {
      warrantSymbol = await resolveHkWarrantSymbol(qc);
      // HK warrants are only discoverable while the HK market is at least
      // in an extended-hours session. If it's closed, empty is expected —
      // otherwise resolveHkWarrantSymbol should have returned something.
      if (!warrantSymbol && isMarketOpenExtendedCached('HK')) {
        throw new Error(
          'resolveHkWarrantSymbol() returned undefined while HK market is in trading hours — ' +
          'warrant_filter should return at least one row for 00700 during the session.',
        );
      }
    });

    it('getWarrantFilter — HK 00700', async () => {
      // Wire shape: server returns a bare array of warrant items with no
      // {total, page, pageSize} wrapper — SDK model keeps those fields at
      // their zero defaults. So only `items` carries the answer. The
      // previous `typeof data === 'object'` assertion was trivially true and
      // caught nothing. During HK trading 00700 must yield at least one
      // warrant; otherwise (market closed) empty is legitimate.
      const data = await qc.getWarrantFilter({ symbol: '00700', page: 0, pageSize: 5 });
      expect(data).toBeDefined();
      const items = (data as any)?.items;
      expect(Array.isArray(items)).toBe(true);
      if (isMarketTradingCached('HK')) {
        expect(items.length).toBeGreaterThan(0);
        expect(items[0]?.symbol).toBeTruthy();
      }
    });

    it('getWarrantQuote — HK warrant symbol', async (ctx) => {
      if (!warrantSymbol) {
        ctx.skip();
        return;
      }
      let data: any;
      try {
        data = await qc.getWarrantQuote({ symbols: [warrantSymbol] });
      } catch (e: any) {
        // Accounts without HK warrant subscription get code=4
        // "method does not support" — skip rather than fail.
        if (e?.code === 4 || /not support/i.test(e?.message ?? '')) {
          ctx.skip();
          return;
        }
        throw e;
      }
      expect(Array.isArray(data)).toBe(true);
    });

    it('getWarrantBriefs — HK warrant (deprecated alias)', async (ctx) => {
      if (!warrantSymbol) {
        ctx.skip();
        return;
      }
      let data: any;
      try {
        data = await qc.getWarrantBriefs({ symbols: [warrantSymbol] });
      } catch (e: any) {
        if (e?.code === 4 || /not support/i.test(e?.message ?? '')) {
          ctx.skip();
          return;
        }
        throw e;
      }
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // =========================================================================
  // Token management
  // =========================================================================

  describe('Token management', () => {
    it('queryToken — returns token string or license error', async () => {
      try {
        const token = await qc.queryToken();
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
  // Kline time range + OHLC
  // =========================================================================

  describe('Kline time range + OHLC', () => {
    it('getKline — 30-day daily AAPL: count>=15, ascending timestamps, OHLC valid', async () => {
      const now = Date.now();
      const begin = now - 30 * 24 * 60 * 60 * 1000;
      const data = await qc.getKline({ symbols: ['AAPL'], period: 'day', beginTime: begin, endTime: now, limit: 60 });
      expect(Array.isArray(data)).toBe(true);
      if (!data.length || !(data[0] as any).items?.length) return; // skip if empty
      const items: any[] = (data[0] as any).items;
      expect(items.length).toBeGreaterThanOrEqual(15);
      // Timestamps ascending
      for (let i = 1; i < items.length; i++) {
        expect(items[i].time).toBeGreaterThan(items[i - 1].time);
      }
      // OHLC constraints
      for (const pt of items) {
        if (pt.high > 0 && pt.low > 0) expect(pt.high).toBeGreaterThanOrEqual(pt.low);
        if (pt.high > 0 && pt.open > 0) expect(pt.high).toBeGreaterThanOrEqual(pt.open);
        if (pt.high > 0 && pt.close > 0) expect(pt.high).toBeGreaterThanOrEqual(pt.close);
        if (pt.low > 0 && pt.open > 0) expect(pt.open).toBeGreaterThanOrEqual(pt.low);
        if (pt.low > 0 && pt.close > 0) expect(pt.close).toBeGreaterThanOrEqual(pt.low);
        if (pt.volume !== undefined) expect(pt.volume).toBeGreaterThanOrEqual(0);
      }
    });

    it('getKline — 30-day daily 00700: count>=15, ascending timestamps, OHLC valid', async () => {
      const now = Date.now();
      const begin = now - 30 * 24 * 60 * 60 * 1000;
      const data = await qc.getKline({ symbols: ['00700'], period: 'day', beginTime: begin, endTime: now, limit: 60 });
      expect(Array.isArray(data)).toBe(true);
      if (!data.length || !(data[0] as any).items?.length) return; // skip if empty
      const items: any[] = (data[0] as any).items;
      expect(items.length).toBeGreaterThanOrEqual(15);
      for (let i = 1; i < items.length; i++) {
        expect(items[i].time).toBeGreaterThan(items[i - 1].time);
      }
      for (const pt of items) {
        if (pt.high > 0 && pt.low > 0) expect(pt.high).toBeGreaterThanOrEqual(pt.low);
        if (pt.high > 0 && pt.open > 0) expect(pt.high).toBeGreaterThanOrEqual(pt.open);
        if (pt.high > 0 && pt.close > 0) expect(pt.high).toBeGreaterThanOrEqual(pt.close);
        if (pt.low > 0 && pt.open > 0) expect(pt.open).toBeGreaterThanOrEqual(pt.low);
        if (pt.low > 0 && pt.close > 0) expect(pt.close).toBeGreaterThanOrEqual(pt.low);
        if (pt.volume !== undefined) expect(pt.volume).toBeGreaterThanOrEqual(0);
      }
    });

    it('getKline — 60min intraday AAPL 5 days: count>=5, ascending, OHLC valid', async () => {
      const now = Date.now();
      const begin = now - 5 * 24 * 60 * 60 * 1000;
      // Non-trading periods may return empty — only assert when data present
      const data = await qc.getKline({ symbols: ['AAPL'], period: '60min', beginTime: begin, endTime: now });
      expect(Array.isArray(data)).toBe(true);
      if (!data.length || !(data[0] as any).items?.length) return;
      const items: any[] = (data[0] as any).items;
      expect(items.length).toBeGreaterThanOrEqual(5);
      for (let i = 1; i < items.length; i++) {
        expect(items[i].time).toBeGreaterThan(items[i - 1].time);
      }
      for (const pt of items) {
        if (pt.high > 0 && pt.low > 0) expect(pt.high).toBeGreaterThanOrEqual(pt.low);
        if (pt.volume !== undefined) expect(pt.volume).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // =========================================================================
  // Quote depth ordering
  // =========================================================================

  describe('Quote depth ordering', () => {
    it('getQuoteDepth — AAPL US: asks ascending, bids descending, spread>=0, prices>0', async () => {
      const data = await qc.getQuoteDepth({ symbols: ['AAPL'], market: 'US' });
      expect(Array.isArray(data)).toBe(true);
      if (!data.length) return; // non-trading hours
      const item = data[0] as any;
      const asks: any[] = item.asks ?? [];
      const bids: any[] = item.bids ?? [];
      if (asks.length >= 2) {
        for (let i = 1; i < asks.length; i++) {
          expect(asks[i].price).toBeGreaterThanOrEqual(asks[i - 1].price);
        }
        for (const a of asks) expect(a.price).toBeGreaterThan(0);
      }
      if (bids.length >= 2) {
        for (let i = 1; i < bids.length; i++) {
          expect(bids[i].price).toBeLessThanOrEqual(bids[i - 1].price);
        }
        for (const b of bids) expect(b.price).toBeGreaterThan(0);
      }
      if (asks.length > 0 && bids.length > 0) {
        expect(asks[0].price - bids[0].price).toBeGreaterThanOrEqual(0);
      }
    });

    it('getQuoteDepth — 00700 HK: asks ascending, bids descending, spread>=0, prices>0', async () => {
      const data = await qc.getQuoteDepth({ symbols: ['00700'], market: 'HK' });
      expect(Array.isArray(data)).toBe(true);
      if (!data.length) return; // non-trading hours
      const item = data[0] as any;
      const asks: any[] = item.asks ?? [];
      const bids: any[] = item.bids ?? [];
      if (asks.length >= 2) {
        for (let i = 1; i < asks.length; i++) {
          expect(asks[i].price).toBeGreaterThanOrEqual(asks[i - 1].price);
        }
        for (const a of asks) expect(a.price).toBeGreaterThan(0);
      }
      if (bids.length >= 2) {
        for (let i = 1; i < bids.length; i++) {
          expect(bids[i].price).toBeLessThanOrEqual(bids[i - 1].price);
        }
        for (const b of bids) expect(b.price).toBeGreaterThan(0);
      }
      if (asks.length > 0 && bids.length > 0) {
        expect(asks[0].price - bids[0].price).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // =========================================================================
  // Brief multi-market
  // =========================================================================

  describe('Brief multi-market', () => {
    it('getBrief — AAPL+00700+09988: latestPrice>0, High>=Low, AskPrice>=BidPrice', async () => {
      const data = await qc.getBrief({ symbols: ['AAPL', '00700', '09988'] });
      expect(Array.isArray(data)).toBe(true);
      // Each symbol is checked independently — a multi-market query can return
      // partial results when some markets are closed while others are open.
      for (const q of data as any[]) {
        expect(q.symbol).toBeTruthy();
        expect(q.latestPrice).toBeGreaterThan(0);
        if (q.high > 0 && q.low > 0) {
          expect(q.high).toBeGreaterThanOrEqual(q.low);
        }
        if (q.askPrice > 0 && q.bidPrice > 0) {
          expect(q.askPrice).toBeGreaterThanOrEqual(q.bidPrice);
        }
      }
    });
  });
});
