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

describe.skipIf(!shouldRun())('QuoteClient integration tests', () => {
  let qc: QuoteClient;

  // Shared dynamic data resolved in beforeAll
  let optionIdentifier: string | undefined;
  let futureExchangeCode: string | undefined;
  let futureContractCode: string | undefined;
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

    // 2. Get futures exchange and contract
    try {
      const excs = await qc.getFutureExchange();
      if (excs.length) {
        futureExchangeCode = (excs[0] as any).code ?? (excs[0] as any).exchangeCode;
        const contracts = await qc.getFutureContracts(futureExchangeCode!);
        if (contracts.length) futureContractCode = (contracts[0] as any).contractCode;
      }
    } catch { /* best-effort */ }

    // 3. Get industry ID
    try {
      const industries = await qc.getIndustryList({});
      if (industries.length) {
        industryId = (industries[0] as any).id ?? (industries[0] as any).industryId;
      }
    } catch { /* best-effort */ }
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
      const data = await qc.getTimeline(['AAPL']);
      expect(Array.isArray(data)).toBe(true);
      if (data.length && (data[0] as any).items?.length) {
        expect((data[0] as any).items[0].time).toBeDefined();
      }
    });

    it('getTradeTick — AAPL', async () => {
      const data = await qc.getTradeTick({ symbols: ['AAPL'], limit: 5 });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getQuoteDepth — AAPL', async () => {
      const data = await qc.getQuoteDepth({ symbols: ['AAPL'] });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getDelayedQuote — AAPL', async () => {
      const data = await qc.getDelayedQuote({ symbols: ['AAPL'] });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getQuoteOvernight — AAPL', async () => {
      const data = await qc.getQuoteOvernight({ symbols: ['AAPL'] });
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // =========================================================================
  // Timeline history
  // =========================================================================

  describe('Timeline history', () => {
    it('getTimelineHistory — AAPL recent weekday', async () => {
      const data = await qc.getTimelineHistory({ symbols: ['AAPL'], date: recentWeekday() });
      expect(Array.isArray(data)).toBe(true);
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
      if (!exps.length || !(exps[0] as any).dates?.length) return;
      const chain = await qc.getOptionChain([['AAPL', (exps[0] as any).dates[0]]]);
      expect(Array.isArray(chain)).toBe(true);
      expect(chain.length).toBeGreaterThan(0);
      if (chain[0].items?.length) {
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

    it('getOptionSymbols — market query', async () => {
      const data = await qc.getOptionSymbols({ market: 'US' });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getOptionAnalysis — AAPL', async () => {
      const data = await qc.getOptionAnalysis({ symbols: ['AAPL'] });
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!optionIdentifier)('getOptionTradeTicks — option identifier', async () => {
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
    });

    it.skipIf(!optionIdentifier)('getOptionTimeline — option identifier', async () => {
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

    it('getStockBroker — AAPL', async () => {
      const data = await qc.getStockBroker({ symbol: 'AAPL' });
      // May be undefined for markets without broker queue
      expect(data === undefined || data === null || typeof data === 'object').toBe(true);
    });

    it('getStockFundamental — AAPL', async () => {
      const data = await qc.getStockFundamental({ symbols: ['AAPL'] });
      expect(typeof data).toBe('object');
    });

    it('getStockIndustry — AAPL', async () => {
      const data = await qc.getStockIndustry({ symbol: 'AAPL' });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getTradeRank — US', async () => {
      const data = await qc.getTradeRank({ market: 'US' });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getShortInterest — AAPL', async () => {
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

    it('grabQuotePermission', async () => {
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
      const data = await qc.getIndustryList({});
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
    const corpReq = { symbols: ['AAPL'], market: 'US', beginDate: '2023-01-01', endDate: '2025-12-31' };

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
      const data = await qc.getCorporateEarningsCalendar(corpReq as any);
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
        fields: ['open', 'close'],
        beginDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFinancialReport — AAPL quarterly', async () => {
      const data = await qc.getFinancialReport({
        symbols: ['AAPL'],
        market: 'US',
        fields: ['revenue'],
        periodType: 'Q',
      });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFinancialCurrency — AAPL', async () => {
      const data = await qc.getFinancialCurrency({ symbols: ['AAPL'] });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFinancialExchangeRate — USD/HKD', async () => {
      const data = await qc.getFinancialExchangeRate({ currencyList: ['USD', 'HKD'] });
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      const first = data[0] as any;
      expect(first.rate ?? first.exchangeRate).toBeDefined();
    });
  });

  // =========================================================================
  // Capital flow
  // =========================================================================

  describe('Capital flow', () => {
    it('getCapitalFlow — AAPL US day', async () => {
      const data = await qc.getCapitalFlow('AAPL', 'US', 'day');
      if (data) {
        expect((data as any).symbol).toBe('AAPL');
        expect((data as any).inFlow !== undefined || (data as any).outFlow !== undefined).toBe(true);
      }
    });

    it('getCapitalDistribution — AAPL US', async () => {
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
      const data = await qc.getMarketScannerTags({ market: 'US' });
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

    it.skipIf(!futureExchangeCode)('getAllFutureContracts', async () => {
      const data = await qc.getAllFutureContracts({ exchange: futureExchangeCode! });
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!futureContractCode)('getCurrentFutureContract', async () => {
      const data = await qc.getCurrentFutureContract({ contractCode: futureContractCode! });
      expect(data === undefined || data === null || typeof data === 'object').toBe(true);
    });

    it.skipIf(!futureContractCode)('getFutureContinuousContracts', async () => {
      const data = await qc.getFutureContinuousContracts({ type: futureContractCode! });
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
      const data = await qc.getFutureTradeTicks({ contractCode: futureContractCode! });
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!futureContractCode)('getFutureDepth', async () => {
      const data = await qc.getFutureDepth({ contractCodes: [futureContractCode!] });
      expect(Array.isArray(data)).toBe(true);
    });

    it.skipIf(!futureContractCode)('getFutureTradingTimes', async () => {
      const data = await qc.getFutureTradingTimes({ contractCode: futureContractCode! });
      expect(data === undefined || data === null || typeof data === 'object').toBe(true);
    });

    it.skipIf(!futureExchangeCode)('getFutureHistoryMainContract', async () => {
      const now = Date.now();
      const data = await qc.getFutureHistoryMainContract({
        contractCodes: [futureExchangeCode!],
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
      const symbols = fundSymbol ? [fundSymbol] : [];
      const data = await qc.getFundContracts({ symbols });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFundQuote', async () => {
      const symbols = fundSymbol ? [fundSymbol] : [];
      const data = await qc.getFundQuote({ symbols });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getFundHistoryQuote', async () => {
      const symbols = fundSymbol ? [fundSymbol] : [];
      const data = await qc.getFundHistoryQuote({ symbols });
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // =========================================================================
  // Warrant
  // =========================================================================

  describe('Warrant', () => {
    it('getWarrantQuote — HK market', async () => {
      const data = await qc.getWarrantQuote({ symbols: [] });
      expect(Array.isArray(data)).toBe(true);
    });

    it('getWarrantFilter — HK market', async () => {
      const data = await qc.getWarrantFilter({ page: 0, pageSize: 5 });
      expect(data === undefined || data === null || typeof data === 'object').toBe(true);
    });
  });
});
