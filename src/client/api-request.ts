/**
 * API 请求构造模块
 */

/** API request interface */
export interface ApiRequest {
  /** API method name (e.g. "market_state", "place_order") */
  method: string;
  /** Business parameters as JSON string */
  bizContent: string;
  /** Optional API version override (default: "2.0") */
  version?: string;
}

/**
 * Create an API request, serializing business parameters to JSON as bizContent.
 *
 * @param method - API method name
 * @param bizParams - Business parameters (object, string, or null)
 * @param version - Optional API version override
 * @returns ApiRequest object
 */
export function createApiRequest(
  method: string,
  bizParams: unknown,
  version?: string,
): ApiRequest {
  let bizContent: string;
  if (typeof bizParams === 'string') {
    bizContent = bizParams;
  } else if (bizParams == null) {
    bizContent = '{}';
  } else {
    bizContent = JSON.stringify(bizParams);
  }
  return { method, bizContent, version };
}
