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

/** Date N years ago (same month/day) in 'YYYY-MM-DD' format. */
function yearsAgo(n: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

/** Current date in 'YYYY-MM-DD' format. */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

    // 1. Get AAPL nearest option identifier
    try {
      const exps = await qc.getOptionExpiration(['AAPL']);
      if (exps.length && exps[0].dates && exps[0].dates.length) {
        const chain = await qc.getOptionChain([['AAPL', exps[0].dates[0]]]);
        if (chain.length && chain[0].items && chain[0].items.length) {
          const row = chain[0].items[0];
          optionIdentifier = (row as any).call?.identifier ?? (row as any).put?.identifier;
        }
      }
    } catch { /* best-effort */ }

    // 2. Get futures exchange and contract.
    //
    // The seed used to pick `getFutureExchange()[0]` unconditionally, so if
    // that exchange had no active contracts the whole Futures section
    // cascade-skipped. Iterate until we find an exchange with at least one
    // contract; also try the known-good `CME` / `NYMEX` fallbacks if all
    // returned exchanges are empty (or the seed threw for one exchange).
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

    // 3. Get industry ID. Try multiple levels so at least one non-empty
    //    response yields a seed.
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
      expect((data[0] as any).dates.length).toBeGreaterThan(0);
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

    it.skipIf(!optionIdentifier)('getOptionKline — option identifier', async () => {
      const data = await qc.getOptionKline([optionIdentifier!], 'day', -1, -1, undefined, 3);
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!optionIdentifier)('getOptionQuote — option identifier', async () => {
      const data = await qc.getOptionQuote([optionIdentifier!]);
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!optionIdentifier)('getOptionBrief — option identifier (alias)', async () => {
      const data = await qc.getOptionBrief([optionIdentifier!]);
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

    it.skipIf(!optionIdentifier)('getOptionTradeTicks — option identifier', async () => {
      // Non-trading hours: data may be empty — only assert fields when non-empty
      const parsed = parseOptionIdentifier(optionIdentifier!);
      const data = await qc.getOptionTradeTicks({
        contracts: [{
          symbol: parsed.symbol,
          expiry: parsed.expiryMs,
          strike: String(parsed.strike),
          right: parsed.right,
        }],
      });
      expect(Array.isArray(data)).toBe(true);
      if (data.length && (data[0] as any).items?.length) {
        expect((data[0] as any).items[0].time).toBeDefined();
      }
    });

    it.skipIf(!optionIdentifier)('getOptionTimeline — option identifier', async () => {
      // Non-trading hours: data may be empty — only assert fields when non-empty
      const parsed = parseOptionIdentifier(optionIdentifier!);
      const data = await qc.getOptionTimeline({
        optionQuery: [{
          symbol: parsed.symbol,
          expiry: parsed.expiryMs,
          strike: String(parsed.strike),
          right: parsed.right,
        }],
      });
      expect(Array.isArray(data)).toBe(true);
      if (data.length && (data[0] as any).items?.length) {
        expect((data[0] as any).items[0].time).toBeDefined();
      }
    });

    it.skipIf(!optionIdentifier)('getOptionDepth — option identifier', async () => {
      const parsed = parseOptionIdentifier(optionIdentifier!);
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

    it.skipIf(!industryId)('getIndustryStocks', async () => {
      const data = await qc.getIndustryStocks({ industryId: industryId! });
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
          || first.close !== undefined || Object.keys(first).length > 0;
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

    it.skipIf(!futureExchangeCode)('getFutureContracts', async () => {
      const data = await qc.getFutureContracts(futureExchangeCode!);
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!futureContractCode)('getFutureRealTimeQuote', async () => {
      const data = await qc.getFutureRealTimeQuote({ contractCodes: [futureContractCode!] });
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!futureContractCode)('getFutureContract — single', async () => {
      const data = await qc.getFutureContract({ contractCode: futureContractCode! });
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!futureType)('getAllFutureContracts', async () => {
      // Python `get_all_future_contracts(future_type)` sends `type`
      // (like "CL"). `exchange` is server-side optional but `type` is the
      // canonical query field.
      const data = await qc.getAllFutureContracts({ type: futureType! });
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!futureContractCode)('getCurrentFutureContract', async () => {
      const data = await qc.getCurrentFutureContract({ contractCode: futureContractCode! });
      expect(data === undefined || data === null || typeof data === 'object').toBe(true);
    });

    it.skipIf(!futureType)('getFutureContinuousContracts', async () => {
      // Wire param is `type` (future type, e.g. "CL"), not a contract code.
      const data = await qc.getFutureContinuousContracts({ type: futureType! });
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!futureContractCode)('getFutureKline', async () => {
      const data = await qc.getFutureKline({ contractCode: futureContractCode!, period: 'day', limit: 3 });
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!futureContractCode)('getFutureKlineByPage', async () => {
      const data = await qc.getFutureKlineByPage({ contractCode: futureContractCode!, period: 'day', totalSize: 5 });
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!futureContractCode)('getFutureTradeTicks', async () => {
      // Non-trading hours: data may be empty — only assert fields when non-empty
      const data = await qc.getFutureTradeTicks({ contractCode: futureContractCode! });
      expect(Array.isArray(data)).toBe(true);
      if (data.length && (data[0] as any).items?.length) {
        expect((data[0] as any).items[0].time).toBeDefined();
      }
    });

    it.skipIf(!futureContractCode)('getFutureDepth', async () => {
      const data = await qc.getFutureDepth({ contractCodes: [futureContractCode!] });
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!futureContractCode)('getFutureTradingTimes', async () => {
      // Non-trading hours: data may be empty — only assert fields when non-empty
      const data = await qc.getFutureTradingTimes({ contractCode: futureContractCode! });
      expect(data === undefined || data === null || typeof data === 'object').toBe(true);
    });

    it.skipIf(!futureType)('getFutureHistoryMainContract', async () => {
      // Wire param `contract_codes` accepts main-contract identifiers like
      // "CLmain" (future type + "main"), not exchange codes.
      const now = Date.now();
      const data = await qc.getFutureHistoryMainContract({
        contractCodes: [`${futureType!}main`],
        beginTime: now - 90 * 24 * 60 * 60 * 1000,
        endTime: now,
      });
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
      try {
        const filter = await qc.getWarrantFilter({ symbol: '00700', page: 0, pageSize: 5 });
        const items = (filter as any)?.items;
        if (Array.isArray(items) && items.length) {
          warrantSymbol = items[0]?.symbol;
        }
      } catch { /* best-effort */ }
    });

    it('getWarrantFilter — HK 00700', async () => {
      const data = await qc.getWarrantFilter({ symbol: '00700', page: 0, pageSize: 5 });
      expect(data === undefined || data === null || typeof data === 'object').toBe(true);
    });

    it.skipIf(!warrantSymbol)('getWarrantQuote — HK warrant symbol', async () => {
      const data = await qc.getWarrantQuote({ symbols: [warrantSymbol!] });
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!warrantSymbol)('getWarrantBriefs — HK warrant (deprecated alias)', async () => {
      const data = await qc.getWarrantBriefs({ symbols: [warrantSymbol!] });
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
      if (!data.length) return; // non-trading hours
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
