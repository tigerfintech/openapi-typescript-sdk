/**
 * API request builder.
 *
 * Requests use camelCase parameters in TypeScript (idiomatic), but the
 * server wire format is snake_case, so we convert keys before serializing.
 */
import { keysToSnakeCase } from './case-convert';

/** API request interface */
export interface ApiRequest {
  /** API method name (e.g. "market_state", "place_order") */
  method: string;
  /** Business parameters as JSON string (already snake_case) */
  bizContent: string;
  /** Optional API version override (default: "2.0") */
  version?: string;
}

/**
 * Create an API request, serializing business parameters to JSON as bizContent.
 * camelCase keys are automatically converted to snake_case to match the server.
 *
 * @param method - API method name
 * @param bizParams - Business parameters (object, string, or null); objects are converted recursively
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
    bizContent = JSON.stringify(keysToSnakeCase(bizParams));
  }
  return { method, bizContent, version };
}
