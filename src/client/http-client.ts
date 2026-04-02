/**
 * HttpClient - HTTP 客户端
 *
 * 封装 HTTP 请求、签名、重试、超时。
 * 使用 Node.js 内置 fetch（Node 18+）。
 */
import type { ClientConfig } from '../config/client-config';
import { getSignContent } from '../signer/sign-content';
import { signWithRSA } from '../signer/signer';
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
 * HttpClient 封装 HTTP 请求、签名、重试、超时
 */
export class HttpClient {
  private config: ClientConfig;
  private retryPolicy: RetryPolicy;

  constructor(config: ClientConfig, retryPolicy?: RetryPolicy) {
    this.config = config;
    this.retryPolicy = retryPolicy ?? defaultRetryPolicy();
  }

  /**
   * 构造公共请求参数
   */
  private buildCommonParams(apiMethod: string, bizContent: string): Record<string, string> {
    const params: Record<string, string> = {
      tiger_id: this.config.tigerId,
      method: apiMethod,
      charset: DEFAULT_CHARSET,
      sign_type: DEFAULT_SIGN_TYPE,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      version: DEFAULT_VERSION,
      biz_content: bizContent,
    };
    if (this.config.language) {
      params['language'] = this.config.language;
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
   * 发送 HTTP POST 请求
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

    const response = await fetch(this.config.serverUrl, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(this.config.timeout * 1000),
    });

    return response.text();
  }

  /**
   * 执行结构化 API 请求，返回解析后的 ApiResponse。
   * 供 QuoteClient/TradeClient 内部使用。
   */
  async executeRequest(request: ApiRequest): Promise<ApiResponse> {
    const params = this.buildCommonParams(request.method, request.bizContent);
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
        return parseApiResponse(body);
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
   * 通用 API 调用方法。
   *
   * @param apiMethod - API 方法名（如 "market_state"、"place_order"）
   * @param requestJson - 原始 biz_content JSON 字符串
   * @returns 原始 response JSON 字符串，不做任何解析
   */
  async execute(apiMethod: string, requestJson: string): Promise<string> {
    // 参数校验
    if (!apiMethod) {
      throw new TigerError(-1, 'api_method 不能为空');
    }
    try {
      JSON.parse(requestJson);
    } catch {
      throw new TigerError(-1, 'request_json 不是有效的 JSON');
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
        return await this.doHttpPost(params);
      } catch (err) {
        lastErr = err as Error;
        if (!this.retryPolicy.shouldRetry(apiMethod)) {
          throw err;
        }
      }
    }

    throw lastErr;
  }

  /** 延迟指定毫秒 */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
