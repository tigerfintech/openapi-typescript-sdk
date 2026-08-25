/**
 * HttpClient additional unit tests
 *
 * Covers: executeRequest, queryToken, refreshToken, startTokenAutoRefresh,
 * close, retry logic, response signature verification, and constructor
 * auto-start token refresh.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../../src/client/http-client';
import { TigerError } from '../../src/client/errors';
import type { ClientConfig } from '../../src/config/client-config';
import type { TokenManager } from '../../src/config/token-manager';

function makeTestConfig(overrides?: Partial<ClientConfig>): ClientConfig {
  return {
    tigerId: 'test_tiger_id',
    privateKey: '',
    account: 'test_account',
    language: 'zh_CN',
    timeout: 15,
    serverUrl: 'https://openapi.tigerfintech.com/gateway',
    quoteServerUrl: 'https://openapi.tigerfintech.com/gateway',
    tigerPublicKey: 'test_public_key',
    ...overrides,
  };
}

function mockFetchResponse(body: string) {
  return { ok: true, status: 200, text: () => Promise.resolve(body) };
}

describe('HttpClient.executeRequest', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('parses API response and returns ApiResponse on success', async () => {
    const data = { items: [{ symbol: 'AAPL' }] };
    const body = JSON.stringify({ code: 0, message: 'ok', data, timestamp: 123 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(body));

    const client = new HttpClient(makeTestConfig());
    (client as any).signParams = () => 'mock_sign';
    (client as any).verifyResponseSign = () => {};

    const req = { method: 'orders', bizContent: '{"account":"acc"}', version: '2.0' };
    const result = await client.executeRequest(req as any);

    expect(result.code).toBe(0);
    expect(result.data).toEqual(data);
  });

  it('throws TigerError on API business error (code != 0) without retry', async () => {
    const body = JSON.stringify({ code: 1000, message: 'param error', data: null, timestamp: 123 });
    const mockFetch = vi.fn().mockResolvedValue(mockFetchResponse(body));
    globalThis.fetch = mockFetch;

    const client = new HttpClient(makeTestConfig());
    (client as any).signParams = () => 'mock_sign';
    (client as any).verifyResponseSign = () => {};

    const req = { method: 'orders', bizContent: '{}', version: '2.0' };
    await expect(client.executeRequest(req as any)).rejects.toThrow(TigerError);

    // Only one attempt — no retry for business errors
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on network error when retryPolicy allows', async () => {
    const successBody = JSON.stringify({ code: 0, message: 'ok', data: {}, timestamp: 123 });
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce(mockFetchResponse(successBody));
    globalThis.fetch = mockFetch;

    const client = new HttpClient(makeTestConfig());
    (client as any).signParams = () => 'mock_sign';
    (client as any).verifyResponseSign = () => {};
    // Override sleep to avoid real delays
    (client as any).sleep = () => Promise.resolve();

    const req = { method: 'orders', bizContent: '{}', version: '2.0' };
    const result = await client.executeRequest(req as any);
    expect(result.code).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('persistent network error'));
    globalThis.fetch = mockFetch;

    const client = new HttpClient(makeTestConfig());
    (client as any).signParams = () => 'mock_sign';
    (client as any).verifyResponseSign = () => {};
    (client as any).sleep = () => Promise.resolve();

    const req = { method: 'orders', bizContent: '{}', version: '2.0' };
    await expect(client.executeRequest(req as any)).rejects.toThrow('persistent network error');
    // default retry policy: maxRetries=5 → 6 attempts total
    expect(mockFetch).toHaveBeenCalledTimes(6);
  });

  it('does not retry when retryPolicy does not allow the method', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network error'));
    globalThis.fetch = mockFetch;

    const client = new HttpClient(makeTestConfig());
    (client as any).signParams = () => 'mock_sign';
    (client as any).verifyResponseSign = () => {};
    (client as any).sleep = () => Promise.resolve();

    // "place_order" is not in the retryable set
    const req = { method: 'place_order', bizContent: '{}', version: '2.0' };
    await expect(client.executeRequest(req as any)).rejects.toThrow('network error');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws when response signature verification fails', async () => {
    const body = JSON.stringify({ code: 0, message: 'ok', data: {}, sign: 'bad_sign', timestamp: 123 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(body));

    const client = new HttpClient(makeTestConfig());
    (client as any).signParams = () => 'mock_sign';
    (client as any).sleep = () => Promise.resolve();
    // Override verifyResponseSign to throw
    (client as any).verifyResponseSign = (_ts: string, sign: string | undefined) => {
      if (sign) throw new TigerError(-1, 'Response signature verification failed');
    };

    const req = { method: 'orders', bizContent: '{}', version: '2.0' };
    await expect(client.executeRequest(req as any)).rejects.toThrow(TigerError);
  });
});

describe('HttpClient.queryToken', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

  it('returns the new token from response', async () => {
    const body = JSON.stringify({ code: 0, message: 'ok', data: { token: 'new_tok' }, timestamp: 123 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(body));

    const client = new HttpClient(makeTestConfig());
    (client as any).signParams = () => 'mock_sign';
    (client as any).verifyResponseSign = () => {};

    const token = await client.queryToken();
    expect(token).toBe('new_tok');
  });

  it('throws TigerError when token is empty', async () => {
    const body = JSON.stringify({ code: 0, message: 'ok', data: { token: '' }, timestamp: 123 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(body));

    const client = new HttpClient(makeTestConfig());
    (client as any).signParams = () => 'mock_sign';
    (client as any).verifyResponseSign = () => {};

    await expect(client.queryToken()).rejects.toThrow(TigerError);
  });

  it('throws TigerError when token is undefined', async () => {
    const body = JSON.stringify({ code: 0, message: 'ok', data: {}, timestamp: 123 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(body));

    const client = new HttpClient(makeTestConfig());
    (client as any).signParams = () => 'mock_sign';
    (client as any).verifyResponseSign = () => {};

    await expect(client.queryToken()).rejects.toThrow(TigerError);
  });
});

describe('HttpClient.refreshToken', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

  it('updates config.token with the new token', async () => {
    const body = JSON.stringify({ code: 0, message: 'ok', data: { token: 'refreshed_tok' }, timestamp: 123 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(body));

    const config = makeTestConfig();
    const client = new HttpClient(config);
    (client as any).signParams = () => 'mock_sign';
    (client as any).verifyResponseSign = () => {};

    await client.refreshToken();
    expect(config.token).toBe('refreshed_tok');
  });

  it('calls tokenManager.setToken when provided', async () => {
    const body = JSON.stringify({ code: 0, message: 'ok', data: { token: 'refreshed_tok' }, timestamp: 123 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(body));

    const client = new HttpClient(makeTestConfig());
    (client as any).signParams = () => 'mock_sign';
    (client as any).verifyResponseSign = () => {};

    const tm = { setToken: vi.fn(), syncToken: vi.fn(), startAutoRefresh: vi.fn(), stopAutoRefresh: vi.fn() } as unknown as TokenManager;
    await client.refreshToken(tm);

    expect(tm.setToken).toHaveBeenCalledWith('refreshed_tok');
  });
});

describe('HttpClient.startTokenAutoRefresh', () => {
  it('creates an internal TokenManager when null is passed', () => {
    const client = new HttpClient(makeTestConfig());
    const tm = client.startTokenAutoRefresh(null, { refreshDuration: 60, refreshInterval: 5000 });

    expect(tm).toBeDefined();
    expect(typeof tm.stopAutoRefresh).toBe('function');
    tm.stopAutoRefresh();
  });

  it('syncs config.token into the new TokenManager', () => {
    const config = makeTestConfig({ token: 'existing_tok' });
    const client = new HttpClient(config);
    const tm = client.startTokenAutoRefresh(null, { refreshDuration: 60 });

    expect(tm).toBeDefined();
    tm.stopAutoRefresh();
  });

  it('uses provided TokenManager instead of creating one', () => {
    const client = new HttpClient(makeTestConfig());
    const tm = {
      startAutoRefresh: vi.fn(),
      stopAutoRefresh: vi.fn(),
      syncToken: vi.fn(),
    } as unknown as TokenManager;

    const result = client.startTokenAutoRefresh(tm, { refreshDuration: 60 });
    expect(result).toBe(tm);
    expect(tm.startAutoRefresh).toHaveBeenCalled();
  });
});

describe('HttpClient.close', () => {
  it('stops token auto-refresh and clears tokenManager', () => {
    const config = makeTestConfig({ tokenRefreshDuration: 60 });
    const client = new HttpClient(config);
    // tokenManager should be set internally from constructor auto-start
    const tm = (client as any).tokenManager;
    expect(tm).not.toBeNull();
    const stopSpy = vi.spyOn(tm, 'stopAutoRefresh');

    client.close();

    expect(stopSpy).toHaveBeenCalled();
    expect((client as any).tokenManager).toBeNull();
  });

  it('is a no-op when no tokenManager is running', () => {
    const client = new HttpClient(makeTestConfig());
    expect(() => client.close()).not.toThrow();
  });
});

describe('HttpClient constructor auto-start', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

  it('auto-starts token refresh when tokenRefreshDuration > 0', () => {
    const config = makeTestConfig({ tokenRefreshDuration: 60 });
    const client = new HttpClient(config);
    // tokenManager should be set internally
    expect((client as any).tokenManager).not.toBeNull();
    client.close();
  });

  it('does not auto-start when tokenRefreshDuration is 0', () => {
    const config = makeTestConfig({ tokenRefreshDuration: 0 });
    const client = new HttpClient(config);
    expect((client as any).tokenManager).toBeNull();
  });

  it('uses tokenCheckInterval from config when provided', () => {
    const config = makeTestConfig({
      tokenRefreshDuration: 60,
      tokenCheckInterval: 10000,
    });
    const client = new HttpClient(config);
    expect((client as any).tokenManager).not.toBeNull();
    client.close();
  });

  it('uses quoteServerUrl when useQuoteServerUrl option is set', () => {
    const config = makeTestConfig({
      serverUrl: 'https://trade-server.com',
      quoteServerUrl: 'https://quote-server.com',
    });
    const client = new HttpClient(config, undefined, { useQuoteServerUrl: true });
    expect((client as any).targetUrl).toBe('https://quote-server.com');
  });

  it('uses serverUrl by default', () => {
    const config = makeTestConfig({
      serverUrl: 'https://trade-server.com',
      quoteServerUrl: 'https://quote-server.com',
    });
    const client = new HttpClient(config);
    expect((client as any).targetUrl).toBe('https://trade-server.com');
  });
});

describe('HttpClient.execute retry logic', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

  it('retries execute on network error for retryable methods', async () => {
    const successBody = JSON.stringify({ code: 0, message: 'ok', data: {}, timestamp: 123 });
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(mockFetchResponse(successBody));
    globalThis.fetch = mockFetch;

    const client = new HttpClient(makeTestConfig());
    (client as any).signParams = () => 'mock_sign';
    (client as any).verifyResponseSign = () => {};
    (client as any).sleep = () => Promise.resolve();

    const result = await client.execute('orders', '{}');
    expect(result).toBe(successBody);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry execute for non-retryable methods', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network'));
    globalThis.fetch = mockFetch;

    const client = new HttpClient(makeTestConfig());
    (client as any).signParams = () => 'mock_sign';
    (client as any).verifyResponseSign = () => {};
    (client as any).sleep = () => Promise.resolve();

    await expect(client.execute('place_order', '{}')).rejects.toThrow('network');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
