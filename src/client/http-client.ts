/**
 * HttpClient - HTTP client
 *
 * Handles HTTP requests, signing, retry, and timeout.
 * Uses Node.js built-in fetch (Node 18+).
 */
import type { ClientConfig } from '../config/client-config';
import { getSignContent } from '../signer/sign-content';
import { signWithRSA, verifyWithRSA } from '../signer/signer';
import { TigerError } from './errors';
import { RetryPolicy, defaultRetryPolicy } from './retry';
import { parseApiResponse, type ApiResponse } from './api-response';
import type { ApiRequest } from './api-request';

/** SDK 版本号 */
const SDK_VERSION = '0.1.0';
/** User-Agent 字符串 */
const USER_AGENT = `openapi-typescript-sdk-${SDK_VERSION}`;
/** 默认字符集 */
const DEFAULT_CHARSET = 'UTF-8';
/** 默认签名类型 */
const DEFAULT_SIGN_TYPE = 'RSA';
/** 默认 API 版本 */
const DEFAULT_VERSION = '2.0';

/**
 * HttpClient handles HTTP requests, signing, retry, and timeout
 */
export class HttpClient {
  private config: ClientConfig;
  private retryPolicy: RetryPolicy;
  /** Override the target URL (used by quote client to hit quote server) */
  private targetUrl: string;

  constructor(config: ClientConfig, retryPolicy?: RetryPolicy, options?: { useQuoteServerUrl?: boolean }) {
    this.config = config;
    this.retryPolicy = retryPolicy ?? defaultRetryPolicy();
    this.targetUrl = options?.useQuoteServerUrl ? config.quoteServerUrl : config.serverUrl;
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
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
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

    return response.text();
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
   * @returns Raw response JSON string, unparsed
   */
  async execute(apiMethod: string, requestJson: string): Promise<string> {
    // Parameter validation
    if (!apiMethod) {
      throw new TigerError(-1, 'api_method must not be empty');
    }
    try {
      JSON.parse(requestJson);
    } catch {
      throw new TigerError(-1, 'request_json is not valid JSON');
    }

    const params = this.buildCommonParams(apiMethod, requestJson);
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
        const parsed = JSON.parse(body) as { sign?: string };
        this.verifyResponseSign(params['timestamp'], parsed.sign);
        return body;
      } catch (err) {
        lastErr = err as Error;
        if (!this.retryPolicy.shouldRetry(apiMethod)) {
          throw err;
        }
      }
    }

    throw lastErr;
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
      throw new TigerError(-1, 'Response signature is missing');
    }
    const valid = verifyWithRSA(this.config.tigerPublicKey, timestamp, signBase64);
    if (!valid) {
      throw new TigerError(-1, 'Response signature verification failed');
    }
  }
}
