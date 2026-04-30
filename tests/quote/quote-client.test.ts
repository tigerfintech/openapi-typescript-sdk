/**
 * QuoteClient 行情查询客户端测试
 * 使用 vi.fn() mock HttpClient 的 executeRequest 方法
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuoteClient } from '../../src/quote/quote-client';
import type { HttpClient } from '../../src/client/http-client';
import type { ApiResponse } from '../../src/client/api-response';

/** 创建 mock HttpClient */
function createMockHttpClient() {
  return {
    executeRequest: vi.fn(),
    execute: vi.fn(),
  } as unknown as HttpClient;
}

/** 创建成功的 ApiResponse */
function successResponse(data: unknown): ApiResponse {
  return { code: 0, message: 'success', data, timestamp: 1700000000 };
}

describe('QuoteClient', () => {
  let mockHttpClient: HttpClient;
  let quoteClient: QuoteClient;

  beforeEach(() => {
    mockHttpClient = createMockHttpClient();
    quoteClient = new QuoteClient(mockHttpClient);
  });

  // === 16.1 基础行情测试 ===

  describe('基础行情方法', () => {
    it('getMarketState 应发送正确的 API 方法名和参数', async () => {
      const mockData = [{ market: 'US', status: 'Trading' }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getMarketState('US');

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'market_state',
        bizContent: JSON.stringify({ market: 'US' }),
      });
      expect(result).toEqual(mockData);
    });

    it('getBrief 应发送 symbols 数组参数', async () => {
      const mockData = [{ symbol: 'AAPL', latestPrice: 150.0 }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getBrief(['AAPL', 'GOOG']);

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'quote_real_time',
        bizContent: JSON.stringify({ symbols: ['AAPL', 'GOOG'] }),
      });
      expect(result).toEqual(mockData);
    });

    it('getKline 应发送 symbols 数组和 period 参数', async () => {
      const mockData = [{ time: 1700000000, close: 150.0 }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getKline('AAPL', 'day');

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'kline',
        bizContent: JSON.stringify({ symbols: ['AAPL'], period: 'day' }),
      });
      expect(result).toEqual(mockData);
    });

    it('getTimeline 应发送 symbols 数组参数', async () => {
      const mockData = [{ symbol: 'AAPL' }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getTimeline(['AAPL']);

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'timeline',
        bizContent: JSON.stringify({ symbols: ['AAPL'] }),
      });
      expect(result).toEqual(mockData);
    });

    it('getTradeTick 应发送 symbols 数组参数', async () => {
      const mockData = [{ symbol: 'AAPL', price: 150.0 }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getTradeTick(['AAPL']);

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'trade_tick',
        bizContent: JSON.stringify({ symbols: ['AAPL'] }),
      });
      expect(result).toEqual(mockData);
    });

    it('getQuoteDepth 应发送 symbol 参数', async () => {
      const mockData = { asks: [], bids: [] };
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getQuoteDepth('AAPL');

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'quote_depth',
        bizContent: JSON.stringify({ symbol: 'AAPL' }),
      });
      expect(result).toEqual(mockData);
    });
  });

  // === 16.3 期权行情测试 ===

  describe('期权行情方法', () => {
    it('getOptionExpiration 应发送 symbols 数组参数', async () => {
      const mockData = ['2024-01-19', '2024-02-16'];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getOptionExpiration('AAPL');

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'option_expiration',
        bizContent: JSON.stringify({ symbols: ['AAPL'] }),
      });
      expect(result).toEqual(mockData);
    });

    it('getOptionChain 应发送 symbol 和 expiry 参数', async () => {
      const mockData = [{ symbol: 'AAPL', right: 'CALL' }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getOptionChain('AAPL', '2024-01-19');

      // v3 API uses option_basic array with expiry as millisecond timestamp
      const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(call.method).toBe('option_chain');
      expect(call.version).toBe('3.0');
      const parsed = JSON.parse(call.bizContent);
      expect(parsed.option_basic[0].symbol).toBe('AAPL');
      expect(result).toEqual(mockData);
    });

    it('getOptionBrief 应发送 identifiers 数组参数', async () => {
      const mockData = [{ identifier: 'AAPL 240119C00150000' }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getOptionBrief(['AAPL 240119C00150000']);

      // v2 API uses option_basic array with parsed identifier fields
      const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(call.method).toBe('option_brief');
      expect(call.version).toBe('2.0');
      const parsed = JSON.parse(call.bizContent);
      expect(parsed.option_basic).toBeDefined();
      expect(parsed.option_basic[0].symbol).toBe('AAPL');
      expect(result).toEqual(mockData);
    });

    it('getOptionKline 应发送 identifier 和 period 参数', async () => {
      const mockData = [{ time: 1700000000, close: 5.0 }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getOptionKline('AAPL 240119C00150000', 'day');

      // v2 API uses option_query array with parsed identifier fields
      const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(call.method).toBe('option_kline');
      expect(call.version).toBe('2.0');
      const parsed = JSON.parse(call.bizContent);
      expect(parsed.option_query).toBeDefined();
      expect(parsed.option_query[0].symbol).toBe('AAPL');
      expect(parsed.option_query[0].period).toBe('day');
      expect(result).toEqual(mockData);
    });
  });

  // === 16.5 期货行情测试 ===

  describe('期货行情方法', () => {
    it('getFutureExchange 应发送 sec_type 参数', async () => {
      const mockData = [{ code: 'CME', name: 'Chicago Mercantile Exchange' }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getFutureExchange();

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'future_exchange',
        bizContent: '{"sec_type":"FUT"}',
      });
      expect(result).toEqual(mockData);
    });

    it('getFutureContracts 应发送 exchange 参数', async () => {
      const mockData = [{ symbol: 'ES', exchange: 'CME' }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getFutureContracts('CME');

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'future_contracts',
        bizContent: JSON.stringify({ exchange: 'CME' }),
      });
      expect(result).toEqual(mockData);
    });

    it('getFutureRealTimeQuote 应发送 symbols 数组参数', async () => {
      const mockData = [{ symbol: 'ES2403', latestPrice: 5000.0 }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getFutureRealTimeQuote(['ES2403']);

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'future_real_time_quote',
        bizContent: JSON.stringify({ symbols: ['ES2403'] }),
      });
      expect(result).toEqual(mockData);
    });

    it('getFutureKline 应发送 symbol 和 period 参数', async () => {
      const mockData = [{ time: 1700000000, close: 5000.0 }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getFutureKline('ES2403', 'day');

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'future_kline',
        bizContent: JSON.stringify({ symbol: 'ES2403', period: 'day' }),
      });
      expect(result).toEqual(mockData);
    });
  });

  // === 16.7 基本面和资金流向测试 ===

  describe('基本面和资金流向方法', () => {
    it('getFinancialDaily 应发送 symbol 参数', async () => {
      const mockData = [{ date: '2024-01-15', close: 150.0 }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getFinancialDaily('AAPL');

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'financial_daily',
        bizContent: JSON.stringify({ symbol: 'AAPL' }),
      });
      expect(result).toEqual(mockData);
    });

    it('getFinancialReport 应发送 symbol 参数', async () => {
      const mockData = [{ period: '2023Q4', revenue: 100000000 }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getFinancialReport('AAPL');

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'financial_report',
        bizContent: JSON.stringify({ symbol: 'AAPL' }),
      });
      expect(result).toEqual(mockData);
    });

    it('getCorporateAction 应发送 symbol 参数', async () => {
      const mockData = [{ type: 'dividend', amount: 0.24 }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getCorporateAction('AAPL');

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'corporate_action',
        bizContent: JSON.stringify({ symbol: 'AAPL' }),
      });
      expect(result).toEqual(mockData);
    });

    it('getCapitalFlow 应发送 symbol 参数', async () => {
      const mockData = { inflow: 1000000, outflow: 500000 };
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getCapitalFlow('AAPL');

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'capital_flow',
        bizContent: JSON.stringify({ symbol: 'AAPL' }),
      });
      expect(result).toEqual(mockData);
    });

    it('getCapitalDistribution 应发送 symbol 参数', async () => {
      const mockData = { large: 0.3, medium: 0.4, small: 0.3 };
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.getCapitalDistribution('AAPL');

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'capital_distribution',
        bizContent: JSON.stringify({ symbol: 'AAPL' }),
      });
      expect(result).toEqual(mockData);
    });
  });

  // === 16.9 选股器和行情权限测试 ===

  describe('选股器和行情权限方法', () => {
    it('marketScanner 应发送自定义参数', async () => {
      const scannerParams = { market: 'US', sortBy: 'changeRate' };
      const mockData = [{ symbol: 'AAPL', changeRate: 0.05 }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.marketScanner(scannerParams);

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'market_scanner',
        bizContent: JSON.stringify(scannerParams),
      });
      expect(result).toEqual(mockData);
    });

    it('grabQuotePermission 应发送无参数请求', async () => {
      const mockData = { permission: 'granted' };
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await quoteClient.grabQuotePermission();

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'grab_quote_permission',
        bizContent: '{}',
      });
      expect(result).toEqual(mockData);
    });
  });

  // === 错误处理测试 ===

  describe('错误处理', () => {
    it('当 executeRequest 抛出错误时应向上传播', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockRejectedValue(new Error('网络错误'));

      await expect(quoteClient.getMarketState('US')).rejects.toThrow('网络错误');
    });
  });
});
