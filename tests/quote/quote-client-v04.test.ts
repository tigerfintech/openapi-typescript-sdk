/**
 * QuoteClient additional method tests
 *
 * Tests methods not covered by the primary quote-client.test.ts:
 * Batch 3-5 methods (stock details, symbols, trade metas, delayed quotes,
 * kline pagination, timeline history, trade rank, short interest,
 * broker queue, stock fundamentals, stock industry, kline quota,
 * quote permission, option methods, futures, funds, warrants,
 * industries, corporate actions, financial, calendar, etc.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuoteClient } from '../../src/quote/quote-client';
import type { HttpClient } from '../../src/client/http-client';
import type { ApiResponse } from '../../src/client/api-response';

function createMockHttpClient() {
  return {
    executeRequest: vi.fn(),
    execute: vi.fn(),
  } as unknown as HttpClient;
}

function successResponse(data: unknown): ApiResponse {
  return { code: 0, message: 'success', data, timestamp: 1700000000 };
}

function capturedBiz(mock: HttpClient): Record<string, unknown> {
  const call = vi.mocked(mock.executeRequest).mock.calls[0][0];
  return JSON.parse(call.bizContent);
}

function capturedMethod(mock: HttpClient): string {
  const call = vi.mocked(mock.executeRequest).mock.calls[0][0];
  return call.method;
}

describe('QuoteClient additional methods', () => {
  let mockHttpClient: HttpClient;
  let qc: QuoteClient;

  beforeEach(() => {
    mockHttpClient = createMockHttpClient();
    qc = new QuoteClient(mockHttpClient);
  });

  describe('Batch 3: Stock basics + time series', () => {
    it('getSymbols sends all_symbols and returns string array', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(['AAPL', 'GOOG']));
      const result = await qc.getSymbols({ market: 'US' });
      expect(result).toEqual(['AAPL', 'GOOG']);
      expect(capturedMethod(mockHttpClient)).toBe('all_symbols');
      expect(capturedBiz(mockHttpClient)).toEqual({ market: 'US' });
    });

    it('getSymbolNames sends all_symbol_names', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'AAPL', name: 'Apple' }]));
      const result = await qc.getSymbolNames({ market: 'US' });
      expect(result[0].symbol).toBe('AAPL');
      expect(capturedMethod(mockHttpClient)).toBe('all_symbol_names');
    });

    it('getTradeMetas sends quote_stock_trade', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'AAPL', lotSize: 100 }]));
      const result = await qc.getTradeMetas({ symbols: ['AAPL'] });
      expect(result[0].lotSize).toBe(100);
      expect(capturedMethod(mockHttpClient)).toBe('quote_stock_trade');
      const biz = capturedBiz(mockHttpClient);
      expect(biz.symbols).toEqual(['AAPL']);
    });

    it('getStockDetails sends stock_detail and unwraps items', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        items: [{ symbol: 'AAPL', nameEN: 'Apple' }],
      }));
      const result = await qc.getStockDetails({ symbols: ['AAPL'] });
      expect(result[0].symbol).toBe('AAPL');
      expect(capturedMethod(mockHttpClient)).toBe('stock_detail');
    });

    it('getDelayedQuote sends quote_delay', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'AAPL', latestPrice: 150 }]));
      const result = await qc.getDelayedQuote({ symbols: ['AAPL'] });
      expect(result[0].latestPrice).toBe(150);
      expect(capturedMethod(mockHttpClient)).toBe('quote_delay');
    });

    it('getStockDelayBriefs (deprecated) delegates to getDelayedQuote', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getStockDelayBriefs({ symbols: ['AAPL'] });
      expect(capturedMethod(mockHttpClient)).toBe('quote_delay');
    });

    it('getKlineByPage loops until totalSize bars collected', async () => {
      // Mock: first call returns 200 items, second returns 1 item (less than pageSize → break)
      const items1 = Array.from({ length: 200 }, (_, i) => ({ time: 1000 - i, volume: 100, open: 150, close: 151, high: 152, low: 149 }));
      const items2 = [{ time: 799, volume: 100, open: 150, close: 151, high: 152, low: 149 }];
      vi.mocked(mockHttpClient.executeRequest)
        .mockResolvedValueOnce(successResponse([{ symbol: 'AAPL', items: items1 }]))
        .mockResolvedValueOnce(successResponse([{ symbol: 'AAPL', items: items2 }]));
      const result = await qc.getKlineByPage({ symbol: 'AAPL', period: 'day', totalSize: 500, pageSize: 200 });
      expect(result).toHaveLength(201);
    });

    it('getKlineByPage breaks on empty response', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValueOnce(successResponse([{ symbol: 'AAPL', items: [] }]));
      const result = await qc.getKlineByPage({ symbol: 'AAPL', period: 'day', totalSize: 500, pageSize: 200 });
      expect(result).toHaveLength(0);
    });

    it('getTimelineHistory sends history_timeline', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'AAPL', period: 'day', preClose: 149, items: [] }]));
      await qc.getTimelineHistory({ symbols: ['AAPL'], date: '2024-01-01' });
      const biz = capturedBiz(mockHttpClient);
      expect(biz.symbols).toEqual(['AAPL']);
      expect(biz.date).toBe('2024-01-01');
    });

    it('getTradeRank sends trade_rank', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'AAPL', volume: 1000000 }]));
      const result = await qc.getTradeRank({ market: 'US' });
      expect(result[0].symbol).toBe('AAPL');
      expect(capturedMethod(mockHttpClient)).toBe('trade_rank');
    });

    it('getShortInterest sends quote_shortable_stocks', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'AAPL', shortInterest: 1000 }]));
      const result = await qc.getShortInterest({ symbols: ['AAPL'] });
      expect(result[0].shortInterest).toBe(1000);
      expect(capturedMethod(mockHttpClient)).toBe('quote_shortable_stocks');
    });

    it('getStockBroker sends stock_broker', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ symbol: 'AAPL', levelAskList: [] }));
      const result = await qc.getStockBroker({ symbol: 'AAPL' });
      expect(result?.symbol).toBe('AAPL');
      expect(capturedMethod(mockHttpClient)).toBe('stock_broker');
    });

    it('getStockFundamental returns grouped map', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ AAPL: { shares: 1000 } }));
      const result = await qc.getStockFundamental({ symbols: ['AAPL'], market: 'US' });
      expect(result.AAPL).toEqual({ shares: 1000 });
    });

    it('getStockFundamental returns empty object on null', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(null));
      const result = await qc.getStockFundamental({ symbols: ['AAPL'] });
      expect(result).toEqual({});
    });
  });

  describe('Batch 3: Kline quota and quote permission', () => {
    it('getKlineQuota sends kline_quota', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ method: 'kline', used: 10, quota: 100 }));
      const result = await qc.getKlineQuota({});
      expect(result?.quota).toBe(100);
      expect(capturedMethod(mockHttpClient)).toBe('kline_quota');
    });

    it('getQuotePermission sends get_quote_permission', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ name: 'usStockQuote', expireAt: 1700000000 }]));
      const result = await qc.getQuotePermission({ beginDate: '2024-01-01', endDate: '2024-12-31' });
      expect(result[0].name).toBe('usStockQuote');
      const biz = capturedBiz(mockHttpClient);
      expect(biz.begin_date).toBe('2024-01-01');
    });
  });

  describe('Batch 4: Options', () => {
    it('getOptionTradeTicks sends option_trade_tick method', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionTradeTicks({ contracts: [{ symbol: 'AAPL', expiry: 1705640400000, strike: '150', right: 'CALL' }] });
      expect(capturedMethod(mockHttpClient)).toBe('option_trade_tick');
      const biz = capturedBiz(mockHttpClient);
      expect(biz.contracts).toBeDefined();
    });

    it('getOptionTimeline sends option_timeline method', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionTimeline({ optionQuery: [{ symbol: 'AAPL' }], market: 'US' });
      expect(capturedMethod(mockHttpClient)).toBe('option_timeline');
      const biz = capturedBiz(mockHttpClient);
      expect(biz.option_query).toBeDefined();
    });

    it('getOptionDepth sends option_depth method', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionDepth({ optionBasic: [{ symbol: 'AAPL' }], market: 'US' });
      expect(capturedMethod(mockHttpClient)).toBe('option_depth');
      const biz = capturedBiz(mockHttpClient);
      expect(biz.option_basic).toBeDefined();
    });

    it('getOptionSymbols sends option_symbol', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'AAPL', market: 'US' }]));
      const result = await qc.getOptionSymbols({ market: 'US' });
      expect(result[0].symbol).toBe('AAPL');
      expect(capturedMethod(mockHttpClient)).toBe('option_symbol');
    });

    it('getOptionAnalysis sends option_analysis', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ symbol: 'AAPL', impliedVol30Days: 0.5 }));
      const result = await qc.getOptionAnalysis({ symbols: ['AAPL'] });
      expect(result?.impliedVol30Days).toBe(0.5);
      expect(capturedMethod(mockHttpClient)).toBe('option_analysis');
    });
  });

  describe('Batch 4: Futures', () => {
    it('getFutureContract sends future_contract_by_contract_code', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ contractCode: 'ES2403' }]));
      const result = await qc.getFutureContract({ contractCode: 'ES2403' });
      expect(result[0].contractCode).toBe('ES2403');
      expect(capturedMethod(mockHttpClient)).toBe('future_contract_by_contract_code');
    });

    it('getAllFutureContracts sends future_contracts', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ contractCode: 'ES2403' }]));
      const result = await qc.getAllFutureContracts({ type: 'FUT' });
      expect(result[0].contractCode).toBe('ES2403');
      expect(capturedMethod(mockHttpClient)).toBe('future_contracts');
    });

    it('getFutureContinuousContracts sends future_continuous_contracts', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getFutureContinuousContracts({ type: 'FUT' });
      expect(capturedMethod(mockHttpClient)).toBe('future_continuous_contracts');
    });

    it('getFutureHistoryMainContract sends future_main_contract', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getFutureHistoryMainContract({ contractCodes: ['ES2403'] });
      expect(capturedMethod(mockHttpClient)).toBe('future_main_contract');
    });

    it('getFutureKline sends future_kline', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getFutureKline({ contractCodes: ['ES2403'], period: 'day', beginTime: -1, endTime: -1 });
      const biz = capturedBiz(mockHttpClient);
      expect(biz.contract_codes).toEqual(['ES2403']);
    });

    it('getFutureKlineByPage paginates', async () => {
      vi.mocked(mockHttpClient.executeRequest)
        .mockResolvedValueOnce(successResponse([{ items: [{ time: 100, volume: 10, open: 1, close: 2, high: 3, low: 0 }] }]))
        .mockResolvedValueOnce(successResponse([{ items: [] }]));
      const result = await qc.getFutureKlineByPage({ contractCode: 'ES2403', period: 'day', totalSize: 500, pageSize: 200 });
      expect(result.length).toBeGreaterThan(0);
    });

    it('getFutureTradeTicks sends future_tick', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getFutureTradeTicks({ contractCode: 'ES2403' });
      const biz = capturedBiz(mockHttpClient);
      expect(biz.contract_code).toBe('ES2403');
    });

    it('getFutureDepth sends future_depth', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getFutureDepth({ contractCodes: ['ES2403'] });
      const biz = capturedBiz(mockHttpClient);
      expect(biz.contract_codes).toEqual(['ES2403']);
    });

    it('getFutureTradingTimes sends future_trading_date', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ contractCode: 'ES2403', bizDate: '2024-01-01' }));
      const result = await qc.getFutureTradingTimes({ contractCode: 'ES2403' });
      expect(result?.contractCode).toBe('ES2403');
    });
  });

  describe('Batch 5: Funds, warrants, industries, corporate, financial, calendar', () => {
    it('getFundSymbols sends fund_all_symbols', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(['FUND1', 'FUND2']));
      const result = await qc.getFundSymbols();
      expect(result).toEqual(['FUND1', 'FUND2']);
      expect(capturedMethod(mockHttpClient)).toBe('fund_all_symbols');
    });

    it('getFundContracts sends fund_contracts', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'FUND1' }]));
      const result = await qc.getFundContracts({ symbols: ['FUND1'] });
      expect(result[0].symbol).toBe('FUND1');
    });

    it('getFundQuote sends fund_quote', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'FUND1', latestNav: 10.0 }]));
      const result = await qc.getFundQuote({ symbols: ['FUND1'] });
      expect(result[0].latestNav).toBe(10.0);
    });

    it('getFundHistoryQuote sends fund_history_quote', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'FUND1', date: '2024-01-01', nav: 10.0 }]));
      const result = await qc.getFundHistoryQuote({ symbols: ['FUND1'] });
      expect(result[0].nav).toBe(10.0);
    });

    it('getWarrantQuote sends warrant_briefs', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'W1' }]));
      const result = await qc.getWarrantQuote({ symbols: ['W1'] });
      expect(result[0].symbol).toBe('W1');
    });

    it('getWarrantBriefs (deprecated) delegates to getWarrantQuote', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getWarrantBriefs({ symbols: ['W1'] });
      expect(capturedMethod(mockHttpClient)).toBe('warrant_briefs');
    });

    it('getWarrantFilter sends warrant_filter', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ total: 1, items: [] }));
      const result = await qc.getWarrantFilter({ symbol: 'AAPL' });
      expect(result?.total).toBe(1);
    });

    it('getIndustryList sends industry_list', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ id: '1', name: 'Tech' }]));
      const result = await qc.getIndustryList({ industryLevel: '1' });
      expect(result[0].id).toBe('1');
    });

    it('getIndustryStocks sends industry_stock_list', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'AAPL', name: 'Apple' }]));
      const result = await qc.getIndustryStocks({ industryId: '1' });
      expect(result[0].symbol).toBe('AAPL');
    });

    it('getCorporateSplit sends action_type=split', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ AAPL: [{ symbol: 'AAPL', actionType: 'split' }] }));
      const result = await qc.getCorporateSplit({ symbols: ['AAPL'], market: 'US' });
      expect(result).toHaveLength(1);
      const biz = capturedBiz(mockHttpClient);
      expect(biz.action_type).toBe('split');
    });

    it('getCorporateDividend sends action_type=dividend', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ AAPL: [{ symbol: 'AAPL', actionType: 'dividend' }] }));
      const result = await qc.getCorporateDividend({ symbols: ['AAPL'], market: 'US' });
      expect(result).toHaveLength(1);
      const biz = capturedBiz(mockHttpClient);
      expect(biz.action_type).toBe('dividend');
    });

    it('getCorporateEarningsCalendar sends action_type=earning', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ AAPL: [{ symbol: 'AAPL', actionType: 'earning' }] }));
      const result = await qc.getCorporateEarningsCalendar({ symbols: ['AAPL'], market: 'US' });
      expect(result).toHaveLength(1);
      const biz = capturedBiz(mockHttpClient);
      expect(biz.action_type).toBe('earning');
    });

    it('getCorporateSplit returns empty array on null response', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(null));
      const result = await qc.getCorporateSplit({ symbols: ['AAPL'], market: 'US' });
      expect(result).toEqual([]);
    });

    it('getFinancialCurrency sends financial_currency', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'AAPL', currency: 'USD' }]));
      const result = await qc.getFinancialCurrency({ symbols: ['AAPL'], market: 'US' });
      expect(result[0].currency).toBe('USD');
    });

    it('getFinancialExchangeRate sends financial_exchange_rate', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ currency: 'USD', rate: 7.8 }]));
      const result = await qc.getFinancialExchangeRate({ currencyList: ['USD'] });
      expect(result[0].rate).toBe(7.8);
    });

    it('getTradingCalendar sends trading_calendar', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ market: 'US', date: '2024-01-01', isTrading: true }]));
      const result = await qc.getTradingCalendar({ market: 'US' });
      expect(result[0].isTrading).toBe(true);
    });

    it('getMarketScannerTags sends market_scanner_tags', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ market: 'US', multiTagField: 'tag1', tagList: [] }]));
      const result = await qc.getMarketScannerTags({ market: 'US' });
      expect(result[0].market).toBe('US');
    });

    it('getQuoteOvernight sends quote_overnight', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'AAPL', preClose: 149 }]));
      const result = await qc.getQuoteOvernight({ symbols: ['AAPL'] });
      expect(result[0].symbol).toBe('AAPL');
    });
  });
});
