/**
 * API 请求构造模块
 */

/** API 请求接口 */
export interface ApiRequest {
  /** API 方法名（如 "market_state"、"place_order"） */
  method: string;
  /** 业务参数 JSON 字符串 */
  bizContent: string;
}

/**
 * 创建 API 请求，将业务参数序列化为 JSON 字符串作为 bizContent。
 *
 * @param method - API 方法名
 * @param bizParams - 业务参数（对象、字符串或 null）
 * @returns ApiRequest 对象
 */
export function createApiRequest(
  method: string,
  bizParams: unknown,
): ApiRequest {
  let bizContent: string;
  if (typeof bizParams === 'string') {
    bizContent = bizParams;
  } else if (bizParams == null) {
    bizContent = '{}';
  } else {
    bizContent = JSON.stringify(bizParams);
  }
  return { method, bizContent };
}
