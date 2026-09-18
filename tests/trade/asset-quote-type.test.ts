/**
 * asset_quote_type 拉取侧参数测试
 *
 * 契约: 用户侧写 camelCase 的 `assetQuoteType`,上到 wire 必须是下划线的
 * `asset_quote_type`,取值是枚举名字符串 ETH / RTH / OVERNIGHT。
 * 覆盖接口: positions(已有) / assets / prime_assets / aggregate_assets。
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

function captured(mock: HttpClient): { method: string; biz: Record<string, unknown> } {
  const call = vi.mocked(mock.executeRequest).mock.calls[0][0];
  return { method: call.method, biz: JSON.parse(call.bizContent) };
}

describe('asset_quote_type 拉取侧 wire 格式', () => {
  let mockHttpClient: HttpClient;
  let tc: TradeClient;
  const testAccount = 'test_account';

  beforeEach(() => {
    mockHttpClient = createMockHttpClient();
    tc = new TradeClient(mockHttpClient, testAccount);
  });

  it('getPositions 发送 asset_quote_type', async () => {
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(
      successResponse({ items: [] }),
    );
    await tc.getPositions({ assetQuoteType: 'OVERNIGHT' });

    const { method, biz } = captured(mockHttpClient);
    expect(method).toBe('positions');
    expect(biz).toEqual({ account: testAccount, asset_quote_type: 'OVERNIGHT' });
    expect(biz.assetQuoteType).toBeUndefined();
  });

  it('getAssets 发送 asset_quote_type', async () => {
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(
      successResponse({ items: [] }),
    );
    await tc.getAssets({ assetQuoteType: 'ETH' });

    const { method, biz } = captured(mockHttpClient);
    expect(method).toBe('assets');
    expect(biz).toEqual({ account: testAccount, asset_quote_type: 'ETH' });
  });

  it('getPrimeAssets 发送 asset_quote_type', async () => {
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({}));
    await tc.getPrimeAssets({ assetQuoteType: 'RTH' });

    const { method, biz } = captured(mockHttpClient);
    expect(method).toBe('prime_assets');
    expect(biz).toEqual({ account: testAccount, asset_quote_type: 'RTH' });
  });

  it('getAggregateAssets 发送 asset_quote_type', async () => {
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse({}));
    await tc.getAggregateAssets({ baseCurrency: 'USD', assetQuoteType: 'OVERNIGHT' });

    const { method, biz } = captured(mockHttpClient);
    expect(method).toBe('aggregate_assets');
    expect(biz).toEqual({
      account: testAccount,
      base_currency: 'USD',
      asset_quote_type: 'OVERNIGHT',
    });
  });

  it('不传时 payload 里不出现该字段(老调用零改动)', async () => {
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(
      successResponse({ items: [] }),
    );
    await tc.getAssets();

    const { biz } = captured(mockHttpClient);
    expect(biz).toEqual({ account: testAccount });
    expect('asset_quote_type' in biz).toBe(false);
  });
});
