/**
 * TradeClient v0.4.0 additional method tests
 *
 * Tests the new methods not covered by the primary trade-client.test.ts:
 * managed accounts, derivative contracts, analytics, forex, segment funds,
 * fund details, position transfers, option exercise.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradeClient } from '../../src/trade/trade-client';
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

describe('TradeClient v0.4.0 additional methods', () => {
  let mockHttpClient: HttpClient;
  let tc: TradeClient;
  const testAccount = 'test_account';

  beforeEach(() => {
    mockHttpClient = createMockHttpClient();
    tc = new TradeClient(mockHttpClient, testAccount);
  });

  describe('Account management', () => {
    it('getManagedAccounts sends accounts method', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        items: [{ account: 'sub1', accountType: 'segment', status: 'active' }],
      }));
      const result = await tc.getManagedAccounts();
      expect(result).toHaveLength(1);
      expect(result[0].account).toBe('sub1');
      expect(capturedMethod(mockHttpClient)).toBe('accounts');
      expect(capturedBiz(mockHttpClient)).toEqual({ account: testAccount });
    });
  });

  describe('Derivative contracts', () => {
    it('getDerivativeContracts sends quote_contract method', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        items: [{ symbol: 'AAPL', secType: 'OPT' }],
      }));
      const result = await tc.getDerivativeContracts({
        symbols: ['AAPL'], secType: 'OPT', expiry: '20260619',
      });
      expect(result).toHaveLength(1);
      expect(capturedMethod(mockHttpClient)).toBe('quote_contract');
      const biz = capturedBiz(mockHttpClient);
      expect(biz.symbols).toEqual(['AAPL']);
      expect(biz.sec_type).toBe('OPT');
    });
  });

  describe('Analytics', () => {
    it('getAnalyticsAsset sends analytics_asset method', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        items: [{ date: '2024-01-01', pnl: 1000, holdingValue: 50000 }],
      }));
      const result = await tc.getAnalyticsAsset({
        startDate: '2024-01-01', endDate: '2024-01-31',
      });
      expect(result).toHaveLength(1);
      expect(capturedMethod(mockHttpClient)).toBe('analytics_asset');
      const biz = capturedBiz(mockHttpClient);
      expect(biz.start_date).toBe('2024-01-01');
      expect(biz.end_date).toBe('2024-01-31');
    });

    it('getAggregateAssets sends aggregate_assets method', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        netLiquidation: 100000, grossPositionValue: 80000,
      }));
      const result = await tc.getAggregateAssets();
      expect(result?.netLiquidation).toBe(100000);
      expect(capturedMethod(mockHttpClient)).toBe('aggregate_assets');
    });

    it('getEstimateTradableQuantity sends correct method', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        tradableQuantity: 100, maxCashBuyQuantity: 100,
      }));
      const result = await tc.getEstimateTradableQuantity({
        symbol: 'AAPL', secType: 'STK', action: 'BUY',
      });
      expect(result?.tradableQuantity).toBe(100);
      expect(capturedMethod(mockHttpClient)).toBe('estimate_tradable_quantity');
      const biz = capturedBiz(mockHttpClient);
      expect(biz.symbol).toBe('AAPL');
      expect(biz.action).toBe('BUY');
    });
  });

  describe('Forex', () => {
    it('placeForexOrder sends place_forex_order method', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        id: 'fx1', status: 'success',
      }));
      const result = await tc.placeForexOrder({
        sourceCurrency: 'USD', targetCurrency: 'HKD', sourceAmount: 1000,
      });
      expect(result?.id).toBe('fx1');
      expect(capturedMethod(mockHttpClient)).toBe('place_forex_order');
      const biz = capturedBiz(mockHttpClient);
      expect(biz.source_currency).toBe('USD');
      expect(biz.target_currency).toBe('HKD');
    });

    // Real gateway returns `id` as a JSON number (matches PlaceOrderResult.id).
    // The Rust / Go SDKs confirmed this on live integ. Rust crashed with
    // "invalid type: integer, expected a string" when the SDK typed id as
    // string; TS silently accepted the mismatch. Type is now `number | string`.
    it('placeForexOrder accepts numeric id from server (wire truth)', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        id: 12345, status: 'Submitted',
      }));
      const result = await tc.placeForexOrder({
        sourceCurrency: 'USD', targetCurrency: 'HKD', sourceAmount: 1000,
      });
      expect(result?.id).toBe(12345);
      expect(typeof result?.id).toBe('number');
    });

    it('placeForexOrder accepts string id for backward compatibility', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        id: '12345', status: 'Submitted',
      }));
      const result = await tc.placeForexOrder({
        sourceCurrency: 'USD', targetCurrency: 'HKD', sourceAmount: 1000,
      });
      expect(result?.id).toBe('12345');
      expect(typeof result?.id).toBe('string');
    });
  });

  describe('Segment fund transfer', () => {
    it('getSegmentFundAvailable returns array directly (no items wrapper)', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([
        { fromSegment: 'CASH', currency: 'USD', amount: 5000 },
      ]));
      const result = await tc.getSegmentFundAvailable({ fromSegment: 'CASH' });
      expect(result).toHaveLength(1);
      expect(result[0].fromSegment).toBe('CASH');
      expect(capturedMethod(mockHttpClient)).toBe('segment_fund_available');
    });

    it('getSegmentFundHistory returns array directly', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([
        { id: 1, fromSegment: 'CASH', toSegment: 'MARGIN', amount: 1000 },
      ]));
      const result = await tc.getSegmentFundHistory({ fromSegment: 'CASH' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(capturedMethod(mockHttpClient)).toBe('segment_fund_history');
    });

    it('transferSegmentFund sends transfer_segment_fund', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        id: 'tf1', fromSegment: 'CASH', toSegment: 'MARGIN', status: 'success',
      }));
      const result = await tc.transferSegmentFund({
        fromSegment: 'CASH', toSegment: 'MARGIN', currency: 'USD', amount: 1000,
      });
      expect(result?.id).toBe('tf1');
      expect(capturedMethod(mockHttpClient)).toBe('transfer_segment_fund');
    });

    it('cancelSegmentFund sends cancel_segment_fund', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        id: 'tf1', status: 'cancelled',
      }));
      const result = await tc.cancelSegmentFund({ id: 'tf1' });
      expect(result?.status).toBe('cancelled');
      expect(capturedMethod(mockHttpClient)).toBe('cancel_segment_fund');
    });
  });

  describe('Fund details & history', () => {
    it('getFundDetails sends fund_details and unwraps items', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        items: [{ id: '1', fundType: 'deposit', amount: 5000 }],
      }));
      const result = await tc.getFundDetails({ segTypes: ['CASH'] });
      expect(result).toHaveLength(1);
      expect(result[0].fundType).toBe('deposit');
      expect(capturedMethod(mockHttpClient)).toBe('fund_details');
      const biz = capturedBiz(mockHttpClient);
      expect(biz.seg_types).toEqual(['CASH']);
    });

    it('getFundingHistory returns array directly', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse([
        { id: 1, type: 1, currency: 'USD', amount: 1000 },
      ]));
      const result = await tc.getFundingHistory({ currency: 'USD' });
      expect(result).toHaveLength(1);
      expect(result[0].currency).toBe('USD');
      expect(capturedMethod(mockHttpClient)).toBe('transfer_fund');
    });
  });

  describe('Position transfer', () => {
    it('transferPosition fills fromAccount from account', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        id: 'pt1', fromAccount: testAccount, toAccount: 'sub2',
      }));
      const result = await tc.transferPosition({
        toAccount: 'sub2', transfers: [{ symbol: 'AAPL', quantity: 100 }],
      });
      expect(result?.fromAccount).toBe(testAccount);
      const biz = capturedBiz(mockHttpClient);
      expect(biz.from_account).toBe(testAccount);
      expect(biz.to_account).toBe('sub2');
      expect(capturedMethod(mockHttpClient)).toBe('position_transfer');
    });

    it('getPositionTransferRecords fills accountId from account', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        items: [{ id: 'r1', fromAccount: testAccount, toAccount: 'sub2' }],
      }));
      const result = await tc.getPositionTransferRecords({});
      expect(result).toHaveLength(1);
      const biz = capturedBiz(mockHttpClient);
      expect(biz.account_id).toBe(testAccount);
      expect(capturedMethod(mockHttpClient)).toBe('position_transfer_records');
    });

    it('getPositionTransferDetail fills accountId from account', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        id: 'd1', fromAccount: testAccount, toAccount: 'sub2',
      }));
      const result = await tc.getPositionTransferDetail({ id: 'd1' });
      expect(result?.id).toBe('d1');
      const biz = capturedBiz(mockHttpClient);
      expect(biz.account_id).toBe(testAccount);
      expect(capturedMethod(mockHttpClient)).toBe('position_transfer_detail');
    });

    it('getPositionTransferExternalRecords fills accountId from account', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        items: [{ id: 'e1', market: 'US', symbol: 'AAPL' }],
      }));
      const result = await tc.getPositionTransferExternalRecords({});
      expect(result).toHaveLength(1);
      const biz = capturedBiz(mockHttpClient);
      expect(biz.account_id).toBe(testAccount);
      expect(capturedMethod(mockHttpClient)).toBe('position_transfer_external_records');
    });
  });

  describe('Option exercise', () => {
    it('checkOptionExercise fills account', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        availableQuantity: 100, position: 100, stkPosition: 0,
        stkPositionChange: 100, stkPositionBefore: 0, stkPositionAfter: 100,
      }));
      const result = await tc.checkOptionExercise({
        contractId: 123, type: 'Exercise',
      });
      expect(result?.availableQuantity).toBe(100);
      const biz = capturedBiz(mockHttpClient);
      expect(biz.account).toBe(testAccount);
      expect(biz.contract_id).toBe(123);
      expect(capturedMethod(mockHttpClient)).toBe('option_exercise_check');
    });

    it('getOptionExercisePositions fills account', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        pageNum: 1, pageSize: 20, itemCount: 0, pageCount: 0,
      }));
      const result = await tc.getOptionExercisePositions({ type: 'Exercise' });
      expect(result?.pageNum).toBe(1);
      const biz = capturedBiz(mockHttpClient);
      expect(biz.account).toBe(testAccount);
      expect(capturedMethod(mockHttpClient)).toBe('option_exercise_position');
    });

    it('submitOptionExercise returns boolean', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(true));
      const result = await tc.submitOptionExercise({
        contractId: 123, type: 'Exercise', quantity: 1, executingDate: '2024-01-19',
      });
      expect(result).toBe(true);
      const biz = capturedBiz(mockHttpClient);
      expect(biz.account).toBe(testAccount);
      expect(capturedMethod(mockHttpClient)).toBe('option_exercise_submit');
    });

    it('submitOptionExercise returns false when data is falsy', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(undefined));
      const result = await tc.submitOptionExercise({
        contractId: 123, type: 'Expire', quantity: 1,
      });
      expect(result).toBe(false);
    });

    it('getOptionExerciseRecords fills account', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({
        pageNum: 1, pageSize: 20, itemCount: 0, pageCount: 0,
      }));
      const result = await tc.getOptionExerciseRecords({ page: 1, size: 20 });
      expect(result?.pageNum).toBe(1);
      const biz = capturedBiz(mockHttpClient);
      expect(biz.account).toBe(testAccount);
      expect(capturedMethod(mockHttpClient)).toBe('option_exercise_record');
    });

    it('cancelOptionExercise returns boolean', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(true));
      const result = await tc.cancelOptionExercise({ id: 456 });
      expect(result).toBe(true);
      const biz = capturedBiz(mockHttpClient);
      expect(biz.account).toBe(testAccount);
      expect(capturedMethod(mockHttpClient)).toBe('option_exercise_cancel');
    });

    it('cancelOptionExercise returns false when data is falsy', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(undefined));
      const result = await tc.cancelOptionExercise({ id: 456 });
      expect(result).toBe(false);
    });
  });

  describe('Token methods', () => {
    it('startTokenAutoRefresh delegates to httpClient.startTokenAutoRefresh', () => {
      const mockTm = { startAutoRefresh: vi.fn(), stopAutoRefresh: vi.fn() } as any;
      const mockHc = {
        executeRequest: vi.fn(),
        execute: vi.fn(),
        startTokenAutoRefresh: vi.fn().mockReturnValue(mockTm),
      } as unknown as HttpClient;
      const tc2 = new TradeClient(mockHc, testAccount);
      const writer = vi.fn();
      const result = tc2.startTokenAutoRefresh(60, 5000, writer);

      expect(mockHc.startTokenAutoRefresh).toHaveBeenCalledWith(null, {
        refreshDuration: 60,
        refreshInterval: 5000,
        tokenWriter: writer,
      });
      expect(result).toBe(mockTm);
    });
  });

  describe('cancelOrder with secretKey', () => {
    it('cancelOrder with explicit secretKey param', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ id: 12345 }));
      await tc.cancelOrder(12345, 'my_secret');
      const biz = capturedBiz(mockHttpClient);
      expect(biz.secret_key).toBe('my_secret');
      expect(biz.id).toBe(12345);
    });

    it('cancelOrder without secretKey param does not set secret_key', async () => {
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ id: 12345 }));
      await tc.cancelOrder(12345);
      const biz = capturedBiz(mockHttpClient);
      expect(biz.secret_key).toBeUndefined();
    });
  });

  describe('TradeClient with secretKey', () => {
    it('injects secretKey into requests when set in constructor', async () => {
      const tcWithKey = new TradeClient(mockHttpClient, testAccount, 'global_secret');
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ items: [] }));
      await tcWithKey.getOrders();
      const biz = capturedBiz(mockHttpClient);
      expect(biz.secret_key).toBe('global_secret');
    });

    it('does not overwrite secretKey when method already sets it', async () => {
      const tcWithKey = new TradeClient(mockHttpClient, testAccount, 'global_secret');
      vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({ id: 1 }));
      await tcWithKey.cancelOrder(123, 'per_call_secret');
      const biz = capturedBiz(mockHttpClient);
      expect(biz.secret_key).toBe('per_call_secret');
    });
  });
});
