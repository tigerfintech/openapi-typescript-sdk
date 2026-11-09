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

    it('placeOrder 新字段 segType/contractLegs 正确序列化为 snake_case', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ id: 1 }));
      await tc.placeOrder({
        ...order,
        segType: 'CASH',
        expireTime: 1700000000000,
        contractLegs: [{ symbol: 'AAPL', secType: 'OPT', right: 'CALL', ratio: 1 }],
      });
      const biz = capturedBiz(mockHttpClient);
      expect(biz.seg_type).toBe('CASH');
      expect(biz.expire_time).toBe(1700000000000);
      const legs = biz.contract_legs as Record<string, unknown>[];
      expect(legs[0].sec_type).toBe('OPT');
      expect(legs[0].ratio).toBe(1);
    });

    it('placeOrder 把 algoParams 对象序列化成 [{tag,value}] 数组', async () => {
      // Gateway 期望 algo_params 是 tag/value 数组(见 Python SDK 的
      // AlgoParams.to_dict),而不是直接的 object。TradeClient 内部要做这层转换,
      // 用户传自然的 object 就行。
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ id: 1 }));
      const now = 1700000000000;
      await tc.placeOrder({
        symbol: 'AAPL', secType: 'STK', action: 'BUY',
        orderType: 'TWAP', totalQuantity: 100,
        algoStrategy: 'TWAP',
        algoParams: {
          startTime: now,
          endTime: now + 3_600_000,
          allowPastEndTime: true,
        },
      });
      const biz = capturedBiz(mockHttpClient);
      const algo = biz.algo_params as Array<{ tag: string; value: unknown }>;
      expect(Array.isArray(algo)).toBe(true);
      expect(algo).toContainEqual({ tag: 'start_time', value: now });
      expect(algo).toContainEqual({ tag: 'end_time', value: now + 3_600_000 });
      expect(algo).toContainEqual({ tag: 'allow_past_end_time', value: true });
      // algoStrategy 保持在顶层
      expect(biz.algo_strategy).toBe('TWAP');
    });

    it('placeOrder 保留已经是数组形式的 algoParams(高级用法)', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ id: 1 }));
      const raw = [{ tag: 'start_time', value: 123 }];
      await tc.placeOrder({
        symbol: 'AAPL', secType: 'STK', action: 'BUY',
        orderType: 'TWAP', totalQuantity: 100,
        algoParams: raw as unknown as OrderRequest['algoParams'],
      });
      const biz = capturedBiz(mockHttpClient);
      expect(biz.algo_params).toEqual(raw);
    });

    it('placeOrder 过滤 algoParams 里的 undefined/null 值', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ id: 1 }));
      await tc.placeOrder({
        symbol: 'AAPL', secType: 'STK', action: 'BUY',
        orderType: 'VWAP', totalQuantity: 100,
        algoParams: {
          startTime: 123,
          endTime: undefined,
          participationRate: 0.1,
        },
      });
      const algo = capturedBiz(mockHttpClient).algo_params as Array<{ tag: string; value: unknown }>;
      expect(algo).toHaveLength(2);
      expect(algo.map(e => e.tag).sort()).toEqual(['participation_rate', 'start_time']);
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
      await tc.getFilledOrders({ startDate: 1000000000000, endDate: 2000000000000 });
      expect(capturedBiz(mockHttpClient)).toEqual({
        account: testAccount, start_date: 1000000000000, end_date: 2000000000000,
      });
    });

    it('getOrder 使用 order_no wire method（P0 bug fix）', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ id: 99, orderId: 42 }));
      await tc.getOrder({ id: 99 });
      const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(call.method).toBe('order_no');
      expect(capturedBiz(mockHttpClient)).toMatchObject({ account: testAccount, id: 99 });
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
      await tc.getOrderTransactions({ orderId: 12345, symbol: 'AAPL', secType: 'STK' });
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

  describe('fromConfig 静态工厂', () => {
    it('fromConfig 返回 TradeClient 实例', () => {
      const cfg = {
        tigerId: 'test', privateKey: 'pk', account: 'acc', language: 'zh_CN',
        serverUrl: 'https://openapi.tigerfintech.com', quoteServerUrl: 'https://openapi.tigerfintech.com',
        tokenRefreshDuration: 0,
      } as Parameters<typeof TradeClient.fromConfig>[0];
      const client = TradeClient.fromConfig(cfg, 'acc123');
      expect(client).toBeInstanceOf(TradeClient);
    });
  });
});
