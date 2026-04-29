/**
 * API 响应解析模块
 */
import { TigerError } from './errors';

/** API 响应接口 */
export interface ApiResponse {
  /** 状态码（0=成功） */
  code: number;
  /** 状态描述 */
  message: string;
  /** 业务数据 */
  data: unknown;
  /** 服务器时间戳 */
  timestamp: number;
  /** Response signature for verification */
  sign?: string;
}

/**
 * 解析 API 响应 JSON 字符串。
 * code 为 0 时返回 ApiResponse；code 不为 0 时抛出 TigerError。
 */
export function parseApiResponse(body: string): ApiResponse {
  const resp: ApiResponse = JSON.parse(body);
  if (resp.code !== 0) {
    throw new TigerError(resp.code, resp.message);
  }
  return resp;
}
