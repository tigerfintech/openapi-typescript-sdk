/**
 * TradeClient 交易客户端测试
 * 使用 vi.fn() mock HttpClient 的 executeRequest 方法
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradeClient } from '../../src/trade/trade-client';
import type { HttpClient } from '../../src/client/http-client';
import type { ApiResponse } from '../../src/client/api-response';
import type { Order } from '../../src/model/order';

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

describe('TradeClient', () => {
  let mockHttpClient: HttpClient;
  let tradeClient: TradeClient;
  const testAccount = 'test_account';

  beforeEach(() => {
    mockHttpClient = createMockHttpClient();
    tradeClient = new TradeClient(mockHttpClient, testAccount);
  });

  // === 17.1 合约查询测试 ===

  describe('合约查询方法', () => {
    it('getContract 应发送 account、symbol、secType 参数', async () => {
      const mockData = { symbol: 'AAPL', secType: 'STK' };
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await tradeClient.getContract('AAPL', 'STK');

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'contract',
        bizContent: JSON.stringify({ account: testAccount, symbol: 'AAPL', secType: 'STK' }),
      });
      expect(result).toEqual(mockData);
    });

    it('getContracts 应发送 account、symbols、secType 参数', async () => {
      const mockData = [{ symbol: 'AAPL' }, { symbol: 'GOOG' }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await tradeClient.getContracts(['AAPL', 'GOOG'], 'STK');

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'contracts',
        bizContent: JSON.stringify({ account: testAccount, symbols: ['AAPL', 'GOOG'], secType: 'STK' }),
      });
      expect(result).toEqual(mockData);
    });

    it('getQuoteContract 应发送 account、symbol、secType 参数', async () => {
      const mockData = { symbol: 'AAPL', secType: 'OPT' };
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await tradeClient.getQuoteContract('AAPL', 'OPT');

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'quote_contract',
        bizContent: JSON.stringify({ account: testAccount, symbol: 'AAPL', secType: 'OPT' }),
      });
      expect(result).toEqual(mockData);
    });
  });

  // === 17.3 订单操作测试 ===

  describe('订单操作方法', () => {
    it('placeOrder 应设置 account 并发送订单', async () => {
      const mockData = { id: 12345, orderId: 1 };
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const order: Order = {
        account: '',
        symbol: 'AAPL',
        secType: 'STK',
        action: 'BUY',
        orderType: 'LMT',
        quantity: 100,
        limitPrice: 150.0,
        timeInForce: 'DAY',
        outsideRth: false,
      };
      const result = await tradeClient.placeOrder(order);

      const calledArg = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      const parsed = JSON.parse(calledArg.bizContent);
      expect(calledArg.method).toBe('place_order');
      expect(parsed.account).toBe(testAccount);
      expect(parsed.symbol).toBe('AAPL');
      expect(result).toEqual(mockData);
    });

    it('previewOrder 应设置 account 并发送预览请求', async () => {
      const mockData = { estimatedCommission: 1.5 };
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const order: Order = {
        account: '',
        symbol: 'AAPL',
        secType: 'STK',
        action: 'BUY',
        orderType: 'MKT',
        quantity: 100,
        timeInForce: 'DAY',
        outsideRth: false,
      };
      const result = await tradeClient.previewOrder(order);

      const calledArg = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      expect(calledArg.method).toBe('preview_order');
      expect(JSON.parse(calledArg.bizContent).account).toBe(testAccount);
      expect(result).toEqual(mockData);
    });

    it('modifyOrder 应设置 account 和 id 并发送修改请求', async () => {
      const mockData = { id: 12345 };
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const order: Order = {
        account: '',
        symbol: 'AAPL',
        secType: 'STK',
        action: 'BUY',
        orderType: 'LMT',
        quantity: 200,
        limitPrice: 155.0,
        timeInForce: 'DAY',
        outsideRth: false,
      };
      const result = await tradeClient.modifyOrder(12345, order);

      const calledArg = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
      const parsed = JSON.parse(calledArg.bizContent);
      expect(calledArg.method).toBe('modify_order');
      expect(parsed.account).toBe(testAccount);
      expect(parsed.id).toBe(12345);
      expect(result).toEqual(mockData);
    });

    it('cancelOrder 应发送 account 和 id 参数', async () => {
      const mockData = { id: 12345 };
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await tradeClient.cancelOrder(12345);

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'cancel_order',
        bizContent: JSON.stringify({ account: testAccount, id: 12345 }),
      });
      expect(result).toEqual(mockData);
    });
  });

  // === 17.5 订单查询测试 ===

  describe('订单查询方法', () => {
    it('getOrders 应发送 account 参数', async () => {
      const mockData = [{ id: 1, symbol: 'AAPL' }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await tradeClient.getOrders();

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'orders',
        bizContent: JSON.stringify({ account: testAccount }),
      });
      expect(result).toEqual(mockData);
    });

    it('getActiveOrders 应发送 account 参数', async () => {
      const mockData = [{ id: 1, status: 'Submitted' }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await tradeClient.getActiveOrders();

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'active_orders',
        bizContent: JSON.stringify({ account: testAccount }),
      });
      expect(result).toEqual(mockData);
    });

    it('getInactiveOrders 应发送 account 参数', async () => {
      const mockData = [{ id: 1, status: 'Cancelled' }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await tradeClient.getInactiveOrders();

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'inactive_orders',
        bizContent: JSON.stringify({ account: testAccount }),
      });
      expect(result).toEqual(mockData);
    });

    it('getFilledOrders 应发送 account 参数', async () => {
      const mockData = [{ id: 1, status: 'Filled' }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await tradeClient.getFilledOrders();

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'filled_orders',
        bizContent: JSON.stringify({ account: testAccount }),
      });
      expect(result).toEqual(mockData);
    });
  });

  // === 17.7 持仓和资产查询测试 ===

  describe('持仓和资产查询方法', () => {
    it('getPositions 应发送 account 参数', async () => {
      const mockData = [{ symbol: 'AAPL', quantity: 100 }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await tradeClient.getPositions();

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'positions',
        bizContent: JSON.stringify({ account: testAccount }),
      });
      expect(result).toEqual(mockData);
    });

    it('getAssets 应发送 account 参数', async () => {
      const mockData = { netLiquidation: 100000.0 };
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await tradeClient.getAssets();

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'assets',
        bizContent: JSON.stringify({ account: testAccount }),
      });
      expect(result).toEqual(mockData);
    });

    it('getPrimeAssets 应发送 account 参数', async () => {
      const mockData = { netLiquidation: 200000.0 };
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await tradeClient.getPrimeAssets();

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'prime_assets',
        bizContent: JSON.stringify({ account: testAccount }),
      });
      expect(result).toEqual(mockData);
    });

    it('getOrderTransactions 应发送 account 和 id 参数', async () => {
      const mockData = [{ id: 12345, filledQuantity: 50 }];
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(mockData));

      const result = await tradeClient.getOrderTransactions(12345);

      expect(mockHttpClient.executeRequest).toHaveBeenCalledWith({
        method: 'order_transactions',
        bizContent: JSON.stringify({ account: testAccount, id: 12345 }),
      });
      expect(result).toEqual(mockData);
    });
  });

  // === 错误处理测试 ===

  describe('错误处理', () => {
    it('当 executeRequest 抛出错误时应向上传播', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockRejectedValue(new Error('网络错误'));

      await expect(tradeClient.getOrders()).rejects.toThrow('网络错误');
    });
  });
});
