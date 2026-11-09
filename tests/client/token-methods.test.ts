/**
 * token-methods.ts unit tests
 *
 * Verifies that queryToken, refreshToken, and startTokenAutoRefresh
 * delegate to the HttpClient with the correct arguments.
 */
import { describe, it, expect, vi } from 'vitest';
import { queryToken, refreshToken, startTokenAutoRefresh } from '../../src/client/token-methods';
import type { HttpClient } from '../../src/client/http-client';
import type { TokenManager } from '../../src/config/token-manager';

function createMockHttpClient() {
  return {
    queryToken: vi.fn(),
    refreshToken: vi.fn(),
    startTokenAutoRefresh: vi.fn(),
  } as unknown as HttpClient;
}

describe('token-methods', () => {
  it('queryToken delegates to httpClient.queryToken', async () => {
    const mock = createMockHttpClient();
    vi.mocked(mock.queryToken).mockResolvedValue('new_token_123');

    const result = await queryToken(mock);

    expect(mock.queryToken).toHaveBeenCalledOnce();
    expect(result).toBe('new_token_123');
  });

  it('queryToken propagates errors', async () => {
    const mock = createMockHttpClient();
    vi.mocked(mock.queryToken).mockRejectedValue(new Error('network'));

    await expect(queryToken(mock)).rejects.toThrow('network');
  });

  it('refreshToken delegates to httpClient.refreshToken with tokenManager', async () => {
    const mock = createMockHttpClient();
    vi.mocked(mock.refreshToken).mockResolvedValue(undefined);
    const tm = {} as TokenManager;

    await refreshToken(mock, tm);

    expect(mock.refreshToken).toHaveBeenCalledWith(tm);
  });

  it('refreshToken delegates with null tokenManager', async () => {
    const mock = createMockHttpClient();
    vi.mocked(mock.refreshToken).mockResolvedValue(undefined);

    await refreshToken(mock, null);

    expect(mock.refreshToken).toHaveBeenCalledWith(null);
  });

  it('refreshToken delegates with undefined tokenManager', async () => {
    const mock = createMockHttpClient();
    vi.mocked(mock.refreshToken).mockResolvedValue(undefined);

    await refreshToken(mock, undefined);

    expect(mock.refreshToken).toHaveBeenCalledWith(undefined);
  });

  it('startTokenAutoRefresh delegates with all arguments', () => {
    const mock = createMockHttpClient();
    const mockTm = {} as TokenManager;
    vi.mocked(mock.startTokenAutoRefresh).mockReturnValue(mockTm);
    const writer = vi.fn();

    const result = startTokenAutoRefresh(mock, 60, 5000, writer);

    expect(mock.startTokenAutoRefresh).toHaveBeenCalledWith(null, {
      refreshDuration: 60,
      refreshInterval: 5000,
      tokenWriter: writer,
    });
    expect(result).toBe(mockTm);
  });

  it('startTokenAutoRefresh delegates without optional args', () => {
    const mock = createMockHttpClient();
    const mockTm = {} as TokenManager;
    vi.mocked(mock.startTokenAutoRefresh).mockReturnValue(mockTm);

    const result = startTokenAutoRefresh(mock, 30);

    expect(mock.startTokenAutoRefresh).toHaveBeenCalledWith(null, {
      refreshDuration: 30,
      refreshInterval: undefined,
      tokenWriter: undefined,
    });
    expect(result).toBe(mockTm);
  });
});
