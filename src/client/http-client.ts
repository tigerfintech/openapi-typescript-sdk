/**
 * HttpClient - HTTP client
 *
 * Handles HTTP requests, signing, retry, and timeout.
 * Uses Node.js built-in fetch (Node 18+).
 */
import type { ClientConfig } from '../config/client-config';
import { TokenManager, type TokenManagerOptions } from '../config/token-manager';
import { getSignContent } from '../signer/sign-content';
import { signWithRSA, verifyWithRSA } from '../signer/signer';
import { TigerError } from './errors';
import { RetryPolicy, defaultRetryPolicy } from './retry';
import { parseApiResponse, unmarshalData, type ApiResponse } from './api-response';
import type { ApiRequest } from './api-request';
import { SDK_VERSION } from '../version';
/** User-Agent 字符串 */
const USER_AGENT = `openapi-typescript-sdk-${SDK_VERSION}`;
/** 默认字符集 */
const DEFAULT_CHARSET = 'UTF-8';
/** 默认签名类型 */
const DEFAULT_SIGN_TYPE = 'RSA';
/** 默认 API 版本 */
const DEFAULT_VERSION = '2.0';
/** Token 刷新 API 方法名 */
const METHOD_TOKEN_REFRESH = 'user_token_refresh';
/** 默认后台 token 检查间隔（毫秒）：5 分钟 */
const DEFAULT_TOKEN_CHECK_INTERVAL = 5 * 60 * 1000;

/**
 * HttpClient handles HTTP requests, signing, retry, and timeout
 */
export class HttpClient {
  private config: ClientConfig;
  private retryPolicy: RetryPolicy;
  /** Override the target URL (used by quote client to hit quote server) */
  private targetUrl: string;
  /** non-null when auto-refresh is active */
  private tokenManager: TokenManager | null = null;

  constructor(config: ClientConfig, retryPolicy?: RetryPolicy, options?: { useQuoteServerUrl?: boolean }) {
    this.config = config;
    this.retryPolicy = retryPolicy ?? defaultRetryPolicy();
    this.targetUrl = options?.useQuoteServerUrl ? config.quoteServerUrl : config.serverUrl;

    // Auto-start token refresh when tokenRefreshDuration is configured (mirrors Go SDK behaviour)
    if (config.tokenRefreshDuration && config.tokenRefreshDuration > 0) {
      const interval = config.tokenCheckInterval ?? DEFAULT_TOKEN_CHECK_INTERVAL;
      const opts: TokenManagerOptions = {
        refreshDuration: config.tokenRefreshDuration,
        refreshInterval: interval,
      };
      if (config.tokenWriter) {
        opts.tokenWriter = config.tokenWriter;
      }
      if (config.tokenLoader) {
        opts.tokenLoader = config.tokenLoader;
      }
      this.tokenManager = this.startTokenAutoRefresh(null, opts);
    }
  }

  /**
   * Stop the background token auto-refresh timer.
   * Call this when the HttpClient is no longer needed to avoid timer leaks.
   */
  close(): void {
    if (this.tokenManager) {
      this.tokenManager.stopAutoRefresh();
      this.tokenManager = null;
    }
  }

  /**
   * Build common request parameters
   */
  private buildCommonParams(apiMethod: string, bizContent: string, version?: string): Record<string, string> {
    const params: Record<string, string> = {
      tiger_id: this.config.tigerId,
      method: apiMethod,
      charset: DEFAULT_CHARSET,
      sign_type: DEFAULT_SIGN_TYPE,
      timestamp: (() => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      })(),
      version: version || DEFAULT_VERSION,
      biz_content: bizContent,
    };
    if (this.config.language) {
      params['language'] = this.config.language;
    }
    if (this.config.deviceId) {
      params['device_id'] = this.config.deviceId;
    }
    return params;
  }

  /**
   * 对参数进行签名
   */
  private signParams(params: Record<string, string>): string {
    const content = getSignContent(params);
    return signWithRSA(this.config.privateKey, content);
  }

  /**
   * Send HTTP POST request
   */
  private async doHttpPost(params: Record<string, string>): Promise<string> {
    const body = JSON.stringify(params);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json;charset=UTF-8',
      'User-Agent': USER_AGENT,
      'Connection': 'close',
    };
    if (this.config.token) {
      headers['Authorization'] = this.config.token;
    }

    const response = await fetch(this.targetUrl, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(this.config.timeout * 1000),
    });

    const text = await response.text();
    return text;
  }

  /**
   * Execute a structured API request, returning a parsed ApiResponse.
   * Used internally by QuoteClient/TradeClient.
   */
  async executeRequest(request: ApiRequest): Promise<ApiResponse> {
    const params = this.buildCommonParams(request.method, request.bizContent, request.version);
    const sign = this.signParams(params);
    params['sign'] = sign;

    let lastErr: Error | undefined;
    const maxAttempts = this.retryPolicy.shouldRetry(request.method)
      ? this.retryPolicy.maxRetries + 1
      : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        const backoff = this.retryPolicy.calculateBackoff(attempt - 1);
        await this.sleep(backoff);
      }

      try {
        const body = await this.doHttpPost(params);
        const response = parseApiResponse(body);
        this.verifyResponseSign(params['timestamp'], response.sign);
        return response;
      } catch (err) {
        lastErr = err as Error;
        // Only retry on network errors, not API business errors (TigerError with code)
        if ((err as any).code !== undefined && (err as any).code !== -1) {
          throw err; // API returned a business error code, don't retry
        }
        if (!this.retryPolicy.shouldRetry(request.method)) {
          throw err;
        }
      }
    }

    throw lastErr;
  }

  /**
   * General-purpose API call method.
   *
   * @param apiMethod - API method name (e.g. "market_state", "place_order")
   * @param requestJson - Raw biz_content JSON string
   * @param version - Optional API version override (default: "2.0")
   * @returns Raw response JSON string, unparsed
   */
  async execute(apiMethod: string, requestJson: string, version?: string): Promise<string> {
    // Parameter validation
    if (!apiMethod) {
      throw new TigerError(-1, 'api_method must not be empty');
    }
    try {
      JSON.parse(requestJson);
    } catch {
      throw new TigerError(-1, 'request_json is not valid JSON');
    }

    const params = this.buildCommonParams(apiMethod, requestJson, version);
    const sign = this.signParams(params);
    params['sign'] = sign;

    let lastErr: Error | undefined;
    const maxAttempts = this.retryPolicy.shouldRetry(apiMethod)
      ? this.retryPolicy.maxRetries + 1
      : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        const backoff = this.retryPolicy.calculateBackoff(attempt - 1);
        await this.sleep(backoff);
      }

      try {
        const body = await this.doHttpPost(params);
        // Verify response signature even for raw responses
        const parsed = JSON.parse(body) as { sign?: string; code?: number };
        this.verifyResponseSign(params['timestamp'], parsed.sign);
        return body;
      } catch (err) {
        lastErr = err as Error;
        // Don't retry API business errors
        if ((err as any).code !== undefined && (err as any).code !== -1) {
          throw err;
        }
        if (!this.retryPolicy.shouldRetry(apiMethod)) {
          throw err;
        }
      }
    }

    throw lastErr;
  }

  /**
   * 调用 user_token_refresh 接口获取新 token，返回新 token 字符串。
   * 此方法仅查询，不修改 config 中的 token。
   */
  async queryToken(): Promise<string> {
    const params = this.buildCommonParams(METHOD_TOKEN_REFRESH, '{}');
    const sign = this.signParams(params);
    params['sign'] = sign;
    const body = await this.doHttpPost(params);
    const response = parseApiResponse(body);
    this.verifyResponseSign(params['timestamp'], response.sign);
    const data = unmarshalData<{ token?: string }>(response.data);
    const newToken = data?.token;
    if (!newToken) {
      throw new TigerError(-1, '服务端返回空 token');
    }
    return newToken;
  }

  /**
   * 刷新 token：调用接口获取新 token 后更新 config.token。
   *
   * @param tokenManager - 可选外部 TokenManager；若提供则调用 setToken() 写文件并触发回调。
   *                       若 NewHttpClient 已自动启动内部 TokenManager，其内存 token 也会同步更新。
   */
  async refreshToken(tokenManager?: TokenManager | null): Promise<void> {
    const newToken = await this.queryToken();
    this.config.token = newToken;
    // Keep internal tokenManager in sync so shouldTokenRefresh stays accurate.
    if (this.tokenManager && tokenManager !== this.tokenManager) {
      this.tokenManager.syncToken(newToken);
    }
    if (tokenManager) {
      tokenManager.setToken(newToken);
    }
  }

  /**
   * 启动后台 token 自动刷新。
   *
   * @param tokenManager - 可为 null：SDK 内部自动创建一个仅内存的 TokenManager，
   *   适合直接通过 token 在代码里设置、不使用文件的场景。
   * @param options - 仅在 tokenManager 为 null 时生效，用于配置内部 TokenManager
   *   （refreshDuration / refreshInterval / tokenWriter / tokenLoader）。
   * @returns 使用或创建的 TokenManager 实例
   */
  startTokenAutoRefresh(
    tokenManager: TokenManager | null,
    options?: TokenManagerOptions,
  ): TokenManager {
    if (!tokenManager) {
      tokenManager = new TokenManager(options);
      // 从 config.token 同步当前 token，使 shouldTokenRefresh 能正确判断。
      // 若 config.token 暂时为空（异步 tokenLoader 尚未 resolve），则先异步加载。
      if (this.config.token) {
        tokenManager.syncToken(this.config.token);
      } else if (options?.tokenLoader) {
        // tokenLoader 可能是异步的；在后台 resolve 后同步到 config.token 和 TokenManager。
        Promise.resolve(options.tokenLoader()).then((t) => {
          if (t) {
            this.config.token = t;
            (tokenManager as TokenManager).syncToken(t);
          }
        }).catch(() => { /* loader failed; token stays empty */ });
      }
    }
    tokenManager.startAutoRefresh(async () => {
      const newToken = await this.queryToken();
      this.config.token = newToken;
      return newToken;
    });
    return tokenManager;
  }

  /** Delay for the specified milliseconds */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Verify the response signature using the tiger public key.
   *
   * @param timestamp - The timestamp sent in the request params
   * @param signBase64 - The `sign` field from the response body
   * @throws TigerError if the signature is missing or invalid
   */
  private verifyResponseSign(timestamp: string, signBase64: string | undefined): void {
    if (!signBase64) {
      // Some endpoints don't return a signature; skip verification silently.
      return;
    }
    const valid = verifyWithRSA(this.config.tigerPublicKey, timestamp, signBase64);
    if (!valid) {
      throw new TigerError(-1, 'Response signature verification failed');
    }
  }
}
