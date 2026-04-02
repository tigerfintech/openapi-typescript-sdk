/**
 * 通用 execute 方法测试
 *
 * 包含 Property 13（请求构造正确性）、Property 14（响应原始透传）、
 * Property 15（无效 JSON 拒绝）的属性测试。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { HttpClient } from '../../src/client/http-client';
import { TigerError } from '../../src/client/errors';
import type { ClientConfig } from '../../src/config/client-config';

/** 创建测试用 ClientConfig */
function makeTestConfig(overrides?: Partial<ClientConfig>): ClientConfig {
  return {
    tigerId: 'test_tiger_id',
    privateKey: '',
    account: 'test_account',
    language: 'zh_CN',
    timeout: 15,
    sandboxDebug: false,
    serverUrl: 'https://openapi.tigerfintech.com/gateway',
    ...overrides,
  };
}

describe('HttpClient.execute', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /**
   * Feature: multi-language-sdks, Property 13: Generic execute 请求构造正确性
   *
   * 对于任意有效的 API 方法名和有效的 biz_content JSON 字符串，
   * 调用通用 execute 方法时，构造的 HTTP 请求参数应包含正确的公共参数。
   *
   * **Validates: Requirements 15.3, 15.8**
   */
  describe('Property 13: Generic execute 请求构造正确性', () => {
    it('请求包含正确的公共参数', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z_]+$/.test(s)),
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 8 }).filter((s) => /^[a-zA-Z]\w*$/.test(s)),
            fc.oneof(fc.string({ maxLength: 10 }), fc.integer({ min: -1000, max: 1000 })),
            { minKeys: 0, maxKeys: 3 },
          ),
          async (apiMethod, bizParams) => {
            const requestJson = JSON.stringify(bizParams);
            const responseBody = JSON.stringify({ code: 0, message: 'success', data: {} });

            let capturedBody: Record<string, string> | undefined;
            globalThis.fetch = vi.fn().mockImplementation(
              async (_url: string, init: RequestInit) => {
                capturedBody = JSON.parse(init.body as string);
                return { ok: true, status: 200, text: () => Promise.resolve(responseBody) };
              },
            );

            const config = makeTestConfig();
            const client = new HttpClient(config);
            // mock 签名函数避免需要真实私钥
            (client as any).signParams = () => 'mock_sign';

            await client.execute(apiMethod, requestJson);

            expect(capturedBody).toBeDefined();
            expect(capturedBody!['method']).toBe(apiMethod);
            expect(capturedBody!['biz_content']).toBe(requestJson);
            expect(capturedBody!['tiger_id']).toBe('test_tiger_id');
            expect(capturedBody!['charset']).toBe('UTF-8');
            expect(capturedBody!['sign_type']).toBe('RSA');
            expect(capturedBody!['version']).toBe('2.0');
            expect(capturedBody!['sign']).toBe('mock_sign');
            expect(capturedBody!['timestamp']).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('User-Agent 头正确', async () => {
      const responseBody = JSON.stringify({ code: 0, message: 'success', data: {} });
      const mockFetch = vi.fn().mockImplementation(
        async (_url: string, _init: RequestInit) => {
          return { ok: true, status: 200, text: () => Promise.resolve(responseBody) };
        },
      );
      globalThis.fetch = mockFetch;

      const client = new HttpClient(makeTestConfig());
      (client as any).signParams = () => 'mock_sign';

      await client.execute('market_state', '{}');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers['User-Agent']).toBe('openapi-typescript-sdk-0.1.0');
      expect(headers['Content-Type']).toBe('application/json;charset=UTF-8');
    });
  });

  /**
   * Feature: multi-language-sdks, Property 14: Generic execute 响应原始透传
   *
   * 对于任意服务器返回的 JSON 响应字符串，通用 execute 方法返回的字符串
   * 应与服务器返回的原始 JSON 完全一致。
   *
   * **Validates: Requirements 15.4**
   */
  describe('Property 14: Generic execute 响应原始透传', () => {
    it('返回原始 JSON 字符串不做解析', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.jsonValue(),
          fc.integer({ min: 0, max: 99999 }),
          async (message, data, timestamp) => {
            const responseObj = { code: 0, message, data, timestamp };
            const responseBody = JSON.stringify(responseObj);

            globalThis.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              text: () => Promise.resolve(responseBody),
            });

            const client = new HttpClient(makeTestConfig());
            (client as any).signParams = () => 'mock_sign';

            const result = await client.execute('market_state', '{}');
            expect(result).toBe(responseBody);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Feature: multi-language-sdks, Property 15: Generic execute 无效 JSON 拒绝
   *
   * 对于任意非法 JSON 字符串，调用通用 execute 方法时应返回参数错误，
   * 不发送任何 HTTP 请求。
   *
   * **Validates: Requirements 15.5, 15.6**
   */
  describe('Property 15: Generic execute 无效 JSON 拒绝', () => {
    it('无效 JSON 抛出 TigerError', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
            try { JSON.parse(s); return false; } catch { return true; }
          }),
          async (invalidJson) => {
            const mockFetch = vi.fn();
            globalThis.fetch = mockFetch;

            const client = new HttpClient(makeTestConfig());

            await expect(client.execute('market_state', invalidJson))
              .rejects.toThrow(TigerError);

            // 不应发送任何 HTTP 请求
            expect(mockFetch).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('空 apiMethod 抛出 TigerError', async () => {
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      const client = new HttpClient(makeTestConfig());

      await expect(client.execute('', '{}'))
        .rejects.toThrow(TigerError);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
