/**
 * QuoteClient unit tests — verify that each method sends the right
 * snake_case payload and parses the typed response.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuoteClient, parseOptionIdentifier } from '../../src/quote/quote-client';
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

    it('getRealTimeQuote 发送 symbols 数组', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'AAPL', latestPrice: 150.0 }]));
      await qc.getRealTimeQuote({ symbols: ['AAPL', 'GOOG'] });
      expect(capturedBiz(mockHttpClient)).toEqual({ symbols: ['AAPL', 'GOOG'] });
    });

    it('getKline 多 symbol 发送 symbols 数组和 period', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([{ symbol: 'AAPL', period: 'day', items: [] }]));
      await qc.getKline({ symbols: ['AAPL', 'TSLA'], period: 'day' });
      expect(capturedBiz(mockHttpClient)).toEqual({ symbols: ['AAPL', 'TSLA'], period: 'day' });
    });

    it('getTimeline 发送 symbols 数组', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getTimeline(['AAPL']);
      expect(capturedBiz(mockHttpClient)).toEqual({ symbols: ['AAPL'] });
    });

    it('getTradeTick 发送 symbols 数组', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getTradeTick({ symbols: ['AAPL'] });
      expect(capturedBiz(mockHttpClient)).toEqual({ symbols: ['AAPL'] });
    });

    it('getQuoteDepth 发送 symbols 数组 + market(snake_case)', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getQuoteDepth({ symbols: ['AAPL'], market: 'US' });
      expect(capturedBiz(mockHttpClient)).toEqual({ symbols: ['AAPL'], market: 'US' });
    });
  });

  describe('期权行情方法', () => {
    it('getOptionExpiration 多 symbol 发送 symbols 数组', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionExpiration(['AAPL', 'TSLA']);
      expect(capturedBiz(mockHttpClient)).toEqual({ symbols: ['AAPL', 'TSLA'] });
    });

    it('getOptionChain 多 (symbol,expiry) 对，option_basic 里 expiry 为时间戳', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionChain([['AAPL', '2024-01-19'], ['TSLA', '2024-02-16']]);
      const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(call.method).toBe('option_chain');
      expect(call.version).toBe('3.0');
      const parsed = JSON.parse(call.bizContent);
      expect(parsed.option_basic).toHaveLength(2);
      expect(parsed.option_basic[0].symbol).toBe('AAPL');
      expect(typeof parsed.option_basic[0].expiry).toBe('number');
      expect(parsed.option_basic[1].symbol).toBe('TSLA');
    });

    it('getOptionChain AAPL 2024-01-19 使用 America/New_York 时区，expiry = 1705640400000', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionChain([['AAPL', '2024-01-19']]);
      const parsed = JSON.parse(vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0].bizContent);
      // 2024-01-19 00:00:00 America/New_York = 2024-01-19 05:00:00 UTC = 1705640400000
      expect(parsed.option_basic[0].expiry).toBe(1705640400000);
    });

    it('getOptionChain 可传入显式 timezone 覆盖自动推断', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionChain([['AAPL', '2024-01-19']], 'UTC');
      const parsed = JSON.parse(vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0].bizContent);
      // With explicit UTC, expiry should be UTC midnight
      expect(parsed.option_basic[0].expiry).toBe(Date.UTC(2024, 0, 19));
    });

    it('getOptionChain .HK symbol 自动使用 Asia/Hong_Kong 时区', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionChain([['TCH.HK', '2024-01-19']]);
      const parsed = JSON.parse(vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0].bizContent);
      // 2024-01-19 00:00:00 Asia/Hong_Kong = 2024-01-18 16:00:00 UTC
      expect(parsed.option_basic[0].expiry).toBe(Date.UTC(2024, 0, 18, 16, 0, 0));
    });

    it('getOptionQuote 使用 v2,解析 identifier', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionQuote(['AAPL  240119C00150000']);
      const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(call.method).toBe('option_brief');
      expect(call.version).toBe('2.0');
      const parsed = JSON.parse(call.bizContent);
      expect(parsed.option_basic[0].symbol).toBe('AAPL');
      expect(parsed.option_basic[0].right).toBe('CALL');
      expect(parsed.option_basic[0].strike).toBe(150);
      // 2024-01-19 00:00:00 America/New_York = 1705640400000
      expect(parsed.option_basic[0].expiry).toBe(1705640400000);
    });

    it('getOptionKline 多 identifier，使用 v2，option_query 带 period', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionKline(['AAPL  240119C00150000', 'AAPL  240119P00140000'], 'day', -1, -1);
      const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(call.method).toBe('option_kline');
      expect(call.version).toBe('2.0');
      const parsed = JSON.parse(call.bizContent);
      expect(parsed.option_query).toHaveLength(2);
      expect(parsed.option_query[0].period).toBe('day');
      expect(parsed.option_query[0].begin_time).toBe(-1);
      expect(parsed.option_query[0].end_time).toBe(-1);
      // 2024-01-19 00:00:00 America/New_York = 1705640400000
      expect(parsed.option_query[0].expiry).toBe(1705640400000);
    });
  });

  describe('parseOptionIdentifier 时区处理', () => {
    it('US symbol 默认使用 America/New_York 时区', () => {
      const result = parseOptionIdentifier('AAPL  240119C00150000');
      // 2024-01-19 00:00:00 America/New_York = 2024-01-19 05:00:00 UTC = 1705640400000
      expect(result.expiryMs).toBe(1705640400000);
    });

    it('.HK symbol 默认使用 Asia/Hong_Kong 时区', () => {
      const result = parseOptionIdentifier('TCH.HK  240119C00150000');
      // 2024-01-19 00:00:00 Asia/Hong_Kong = 2024-01-18 16:00:00 UTC
      expect(result.expiryMs).toBe(Date.UTC(2024, 0, 18, 16, 0, 0));
    });

    it('显式传入 UTC timezone', () => {
      const result = parseOptionIdentifier('AAPL  240119C00150000', 'UTC');
      expect(result.expiryMs).toBe(Date.UTC(2024, 0, 19));
    });

    it('解析 strike 和 right 正确', () => {
      const result = parseOptionIdentifier('AAPL  240119C00150000');
      expect(result.symbol).toBe('AAPL');
      expect(result.right).toBe('CALL');
      expect(result.strike).toBe(150);
    });

    it('解析 PUT 正确', () => {
      const result = parseOptionIdentifier('AAPL  240119P00140000');
      expect(result.right).toBe('PUT');
      expect(result.strike).toBe(140);
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
      await qc.getFutureRealTimeQuote({ contractCodes: ['ES2403'] });
      const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(call.method).toBe('future_real_time_quote');
      expect(JSON.parse(call.bizContent)).toEqual({ contract_codes: ['ES2403'] });
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

  describe('fromConfig 静态工厂', () => {
    it('fromConfig 返回 QuoteClient 实例', () => {
      const cfg = {
        tigerId: 'test', privateKey: 'pk', account: 'acc', language: 'zh_CN',
        serverUrl: 'https://openapi.tigerfintech.com', quoteServerUrl: 'https://openapi.tigerfintech.com',
        tokenRefreshDuration: 0,
      } as Parameters<typeof QuoteClient.fromConfig>[0];
      const client = QuoteClient.fromConfig(cfg);
      expect(client).toBeInstanceOf(QuoteClient);
    });
  });

  describe('getOptionChain filter+greek (java-parity)', () => {
    it('returnGreekValue=true 发送 return_greek_value 字段', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionChain([['AAPL', '2024-01-19']], undefined, true);
      const parsed = JSON.parse(vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0].bizContent);
      expect(parsed.return_greek_value).toBe(true);
    });

    it('optionFilter.inTheMoney 序列化为 in_the_money', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionChain([['AAPL', '2024-01-19']], undefined, undefined, { inTheMoney: false });
      const parsed = JSON.parse(vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0].bizContent);
      expect(parsed.option_filter.in_the_money).toBe(false);
    });

    it('optionFilter Range 字段序列化为 {min,max} 嵌套对象', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionChain([['AAPL', '2024-01-19']], undefined, true, {
        impliedVolatility: { min: 0.1, max: 0.5 },
        greeks: { delta: { min: 0.0, max: 0.6 } },
      });
      const parsed = JSON.parse(vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0].bizContent);
      expect(parsed.option_filter.implied_volatility).toEqual({ min: 0.1, max: 0.5 });
      expect(parsed.option_filter.greeks.delta).toEqual({ min: 0.0, max: 0.6 });
    });

    it('无 filter/greek 时不发送多余字段', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionChain([['AAPL', '2024-01-19']]);
      const parsed = JSON.parse(vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0].bizContent);
      expect(parsed.return_greek_value).toBeUndefined();
      expect(parsed.option_filter).toBeUndefined();
    });
  });

  describe('getOptionKline limit/sortDir (java-parity)', () => {
    it('limit>0 时每个 entry 包含 limit 字段', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionKline(['AAPL  240119C00150000'], 'day', -1, -1, undefined, 20);
      const parsed = JSON.parse(vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0].bizContent);
      expect(parsed.option_query[0].limit).toBe(20);
    });

    it('sortDir 非空时发送 sort_dir', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionKline(['AAPL  240119C00150000'], 'day', -1, -1, undefined, 0, 'desc');
      const parsed = JSON.parse(vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0].bizContent);
      expect(parsed.option_query[0].sort_dir).toBe('desc');
    });

    it('limit=0 时不发送 limit 字段', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([]));
      await qc.getOptionKline(['AAPL  240119C00150000'], 'day', -1, -1);
      const parsed = JSON.parse(vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0].bizContent);
      expect(parsed.option_query[0].limit).toBeUndefined();
      expect(parsed.option_query[0].sort_dir).toBeUndefined();
    });
  });
});
