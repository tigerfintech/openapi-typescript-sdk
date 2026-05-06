/**
 * TradeClient unit tests — verify snake_case payloads and typed responses.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradeClient } from '../../src/trade/trade-client';
import type { HttpClient } from '../../src/client/http-client';
import type { ApiResponse } from '../../src/client/api-response';
import type { OrderRequest } from '../../src/model/order';

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

describe('TradeClient', () => {
  let mockHttpClient: HttpClient;
  let tc: TradeClient;
  const testAccount = 'test_account';

  beforeEach(() => {
    mockHttpClient = createMockHttpClient();
    tc = new TradeClient(mockHttpClient, testAccount);
  });

  describe('合约查询方法', () => {
    it('getContract 发送 account/symbol/sec_type,解包 items', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        items: [{ symbol: 'AAPL', secType: 'STK' }],
      }));
      const result = await tc.getContract('AAPL', 'STK');
      expect(result).toEqual([{ symbol: 'AAPL', secType: 'STK' }]);
      expect(capturedBiz(mockHttpClient)).toEqual({
        account: testAccount, symbol: 'AAPL', sec_type: 'STK',
      });
    });

    it('getContracts 发送 symbols 数组', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        items: [{ symbol: 'AAPL' }, { symbol: 'GOOG' }],
      }));
      await tc.getContracts(['AAPL', 'GOOG'], 'STK');
      expect(capturedBiz(mockHttpClient)).toEqual({
        account: testAccount, symbols: ['AAPL', 'GOOG'], sec_type: 'STK',
      });
    });

    it('getQuoteContract 发送 symbols + sec_type + expiry', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        items: [{ symbol: 'AAPL', secType: 'OPT' }],
      }));
      await tc.getQuoteContract('AAPL', 'OPT', '20260619');
      expect(capturedBiz(mockHttpClient)).toEqual({
        account: testAccount, symbols: ['AAPL'], sec_type: 'OPT', expiry: '20260619',
      });
    });
  });

  describe('订单操作方法', () => {
    const order: OrderRequest = {
      account: '',
      symbol: 'AAPL',
      secType: 'STK',
      action: 'BUY',
      orderType: 'LMT',
      totalQuantity: 100,
      limitPrice: 150.0,
      timeInForce: 'DAY',
      outsideRth: false,
    };

    it('placeOrder 发送 snake_case 订单,设置 account', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ id: 12345, order_id: 1 }));
      const result = await tc.placeOrder(order);
      const biz = capturedBiz(mockHttpClient);
      const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(call.method).toBe('place_order');
      expect(biz.account).toBe(testAccount);
      expect(biz.sec_type).toBe('STK');
      expect(biz.order_type).toBe('LMT');
      expect(biz.total_quantity).toBe(100);
      expect(biz.limit_price).toBe(150.0);
      expect(biz.time_in_force).toBe('DAY');
      expect(result?.id).toBe(12345);
    });

    it('previewOrder 发送 preview_order', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ isPass: true }));
      await tc.previewOrder(order);
      const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(call.method).toBe('preview_order');
      expect(capturedBiz(mockHttpClient).account).toBe(testAccount);
    });

    it('modifyOrder 设置 id 和 account', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ id: 12345 }));
      await tc.modifyOrder(12345, order);
      const biz = capturedBiz(mockHttpClient);
      expect(biz.id).toBe(12345);
      expect(biz.account).toBe(testAccount);
    });

    it('cancelOrder 发送 account 和 id', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ id: 12345 }));
      await tc.cancelOrder(12345);
      expect(capturedBiz(mockHttpClient)).toEqual({ account: testAccount, id: 12345 });
    });
  });

  describe('订单查询方法', () => {
    it('getOrders 解包 items', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        items: [{ id: 1, symbol: 'AAPL' }],
      }));
      const result = await tc.getOrders();
      expect(result).toEqual([{ id: 1, symbol: 'AAPL' }]);
      expect(capturedBiz(mockHttpClient)).toEqual({ account: testAccount });
    });

    it('getActiveOrders 解包 items', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ items: [] }));
      await tc.getActiveOrders();
      expect(capturedBiz(mockHttpClient)).toEqual({ account: testAccount });
    });

    it('getInactiveOrders 解包 items', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ items: [] }));
      await tc.getInactiveOrders();
      expect(capturedBiz(mockHttpClient)).toEqual({ account: testAccount });
    });

    it('getFilledOrders 发送 start_date/end_date', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ items: [] }));
      await tc.getFilledOrders(1000000000000, 2000000000000);
      expect(capturedBiz(mockHttpClient)).toEqual({
        account: testAccount, start_date: 1000000000000, end_date: 2000000000000,
      });
    });
  });

  describe('持仓和资产查询方法', () => {
    it('getPositions 解包 items', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        items: [{ symbol: 'AAPL', position: 100 }],
      }));
      const r = await tc.getPositions();
      expect(r).toEqual([{ symbol: 'AAPL', position: 100 }]);
    });

    it('getAssets 解包 items', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        items: [{ netLiquidation: 100000 }],
      }));
      const r = await tc.getAssets();
      expect(r).toEqual([{ netLiquidation: 100000 }]);
    });

    it('getPrimeAssets 返回单个对象', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        accountId: 'U1', segments: [],
      }));
      const r = await tc.getPrimeAssets();
      expect(r?.accountId).toBe('U1');
    });

    it('getOrderTransactions 发送 order_id + symbol + sec_type', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        items: [{ id: 12345, filledQuantity: 50 }],
      }));
      await tc.getOrderTransactions(12345, 'AAPL', 'STK');
      expect(capturedBiz(mockHttpClient)).toEqual({
        account: testAccount, order_id: 12345, symbol: 'AAPL', sec_type: 'STK',
      });
    });
  });

  describe('错误处理', () => {
    it('executeRequest 抛错应向上传播', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockRejectedValue(new Error('network error'));
      await expect(tc.getOrders()).rejects.toThrow('network error');
    });
  });
});
