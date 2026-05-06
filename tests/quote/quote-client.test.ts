/**
 * QuoteClient unit tests — verify that each method sends the right
 * snake_case payload and parses the typed response.
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

/** Parse the bizContent the client sent. */
function capturedBiz(mock: HttpClient): Record<string, unknown> {
  const call = vi.mocked(mock.executeRequest).mock.calls[0][0];
  return JSON.parse(call.bizContent);
}

describe('QuoteClient', () => {
  let mockHttpClient: HttpClient;
  let qc: QuoteClient;

  beforeEach(() => {
    mockHttpClient = createMockHttpClient();
    qc = new QuoteClient(mockHttpClient);
  });

  describe('基础行情方法', () => {
    it('getMarketState 发送 market 参数', async () => {
      const data = [{ market: 'US', marketStatus: 'Trading', status: 'TRADING' }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(data));

      const result = await qc.getMarketState('US');
      expect(result).toEqual(data);
      expect(capturedBiz(mockHttpClient)).toEqual({ market: 'US' });
    });

    it('getBrief 发送 symbols 数组', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'AAPL', latestPrice: 150.0 }]));
      await qc.getBrief(['AAPL', 'GOOG']);
      expect(capturedBiz(mockHttpClient)).toEqual({ symbols: ['AAPL', 'GOOG'] });
    });

    it('getKline 发送 symbols 数组和 period', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'AAPL', period: 'day', items: [] }]));
      await qc.getKline('AAPL', 'day');
      expect(capturedBiz(mockHttpClient)).toEqual({ symbols: ['AAPL'], period: 'day' });
    });

    it('getTimeline 发送 symbols 数组', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getTimeline(['AAPL']);
      expect(capturedBiz(mockHttpClient)).toEqual({ symbols: ['AAPL'] });
    });

    it('getTradeTick 发送 symbols 数组', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getTradeTick(['AAPL']);
      expect(capturedBiz(mockHttpClient)).toEqual({ symbols: ['AAPL'] });
    });

    it('getQuoteDepth 发送 symbols 数组 + market(snake_case)', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getQuoteDepth('AAPL', 'US');
      expect(capturedBiz(mockHttpClient)).toEqual({ symbols: ['AAPL'], market: 'US' });
    });
  });

  describe('期权行情方法', () => {
    it('getOptionExpiration 发送 symbols 数组', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionExpiration('AAPL');
      expect(capturedBiz(mockHttpClient)).toEqual({ symbols: ['AAPL'] });
    });

    it('getOptionChain 使用 v3,option_basic 里 expiry 为时间戳', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionChain('AAPL', '2024-01-19');
      const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(call.method).toBe('option_chain');
      expect(call.version).toBe('3.0');
      const parsed = JSON.parse(call.bizContent);
      expect(parsed.option_basic[0].symbol).toBe('AAPL');
      expect(typeof parsed.option_basic[0].expiry).toBe('number');
    });

    it('getOptionBrief 使用 v2,解析 identifier', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionBrief(['AAPL  240119C00150000']);
      const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(call.method).toBe('option_brief');
      expect(call.version).toBe('2.0');
      const parsed = JSON.parse(call.bizContent);
      expect(parsed.option_basic[0].symbol).toBe('AAPL');
      expect(parsed.option_basic[0].right).toBe('CALL');
      expect(parsed.option_basic[0].strike).toBe(150);
    });

    it('getOptionKline 使用 v2,option_query 带 period', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionKline('AAPL  240119C00150000', 'day');
      const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(call.method).toBe('option_kline');
      expect(call.version).toBe('2.0');
      const parsed = JSON.parse(call.bizContent);
      expect(parsed.option_query[0].period).toBe('day');
    });
  });

  describe('期货行情方法', () => {
    it('getFutureExchange 发送 sec_type', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getFutureExchange();
      expect(capturedBiz(mockHttpClient)).toEqual({ sec_type: 'FUT' });
    });

    it('getFutureContracts 使用 future_contract_by_exchange_code + exchange_code', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getFutureContracts('CME');
      const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(call.method).toBe('future_contract_by_exchange_code');
      expect(JSON.parse(call.bizContent)).toEqual({ exchange_code: 'CME' });
    });

    it('getFutureRealTimeQuote 发送 contract_codes', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getFutureRealTimeQuote(['ES2403']);
      expect(capturedBiz(mockHttpClient)).toEqual({ contract_codes: ['ES2403'] });
    });

    it('getFutureKline 发送 contract_codes + begin_time + end_time', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getFutureKline({ contractCodes: ['ES2403'], period: 'day', beginTime: -1, endTime: -1 });
      expect(capturedBiz(mockHttpClient)).toEqual({
        contract_codes: ['ES2403'], period: 'day', begin_time: -1, end_time: -1,
      });
    });
  });

  describe('基本面和资金流向方法', () => {
    it('getFinancialDaily 发送完整 Request', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getFinancialDaily({
        symbols: ['AAPL'], market: 'US', fields: ['shares_outstanding'],
        beginDate: '2024-01-01', endDate: '2024-01-31',
      });
      expect(capturedBiz(mockHttpClient)).toEqual({
        symbols: ['AAPL'], market: 'US', fields: ['shares_outstanding'],
        begin_date: '2024-01-01', end_date: '2024-01-31',
      });
    });

    it('getFinancialReport 发送完整 Request', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getFinancialReport({
        symbols: ['AAPL'], market: 'US', fields: ['total_revenue'], periodType: 'Annual',
      });
      expect(capturedBiz(mockHttpClient)).toEqual({
        symbols: ['AAPL'], market: 'US', fields: ['total_revenue'], period_type: 'Annual',
      });
    });

    it('getCorporateAction 扁平化返回,发送完整 Request', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        AAPL: [{ symbol: 'AAPL', actionType: 'DIVIDEND' }],
      }));
      const rows = await qc.getCorporateAction({
        symbols: ['AAPL'], market: 'US', actionType: 'DIVIDEND',
        beginDate: '2024-01-01', endDate: '2024-12-31',
      });
      expect(rows).toEqual([{ symbol: 'AAPL', actionType: 'DIVIDEND' }]);
      expect(capturedBiz(mockHttpClient)).toEqual({
        symbols: ['AAPL'], market: 'US', action_type: 'DIVIDEND',
        begin_date: '2024-01-01', end_date: '2024-12-31',
      });
    });

    it('getCapitalFlow 发送 symbol/market/period', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ symbol: 'AAPL', period: 'day', items: [] }));
      await qc.getCapitalFlow('AAPL', 'US', 'day');
      expect(capturedBiz(mockHttpClient)).toEqual({ symbol: 'AAPL', market: 'US', period: 'day' });
    });

    it('getCapitalDistribution 发送 symbol/market', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ symbol: 'AAPL', netInflow: 0, inAll: 0, inBig: 0, inMid: 0, inSmall: 0, outAll: 0, outBig: 0, outMid: 0, outSmall: 0 }));
      await qc.getCapitalDistribution('AAPL', 'US');
      expect(capturedBiz(mockHttpClient)).toEqual({ symbol: 'AAPL', market: 'US' });
    });
  });

  describe('选股器和行情权限方法', () => {
    it('marketScanner 使用 Request 结构', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        page: 0, totalPage: 1, totalCount: 1, pageSize: 10, items: [],
      }));
      await qc.marketScanner({ market: 'US', page: 0, pageSize: 10 });
      expect(capturedBiz(mockHttpClient)).toEqual({ market: 'US', page: 0, page_size: 10 });
    });

    it('grabQuotePermission 无参数', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ name: 'usStockQuote', expireAt: 1700000000 }]));
      await qc.grabQuotePermission();
      const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(call.bizContent).toBe('{}');
    });
  });

  describe('错误处理', () => {
    it('executeRequest 抛错应向上传播', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockRejectedValue(new Error('network error'));
      await expect(qc.getMarketState('US')).rejects.toThrow('network error');
    });
  });
});
