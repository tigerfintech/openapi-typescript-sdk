/**
 * API response parsing.
 */
import { TigerError } from './errors';

/** API response envelope */
export interface ApiResponse {
  /** Result code (0 = success) */
  code: number;
  /** Human-readable message */
  message: string;
  /** Business payload */
  data: unknown;
  /** Server timestamp */
  timestamp: number;
  /** Response signature for verification */
  sign?: string;
}

/**
 * Parse the raw HTTP response body.
 * Throws TigerError when code != 0.
 */
export function parseApiResponse(body: string): ApiResponse {
  const resp: ApiResponse = JSON.parse(body);
  if (resp.code !== 0) {
    throw new TigerError(resp.code, resp.message);
  }
  return resp;
}

/**
 * Decode an ApiResponse.data payload into a typed value.
 * Handles the server's occasional double-encoded JSON (where `data` is a
 * JSON string that itself wraps JSON), seen on some trade endpoints.
 */
export function unmarshalData<T>(data: unknown): T | undefined {
  if (data == null) return undefined;
  if (typeof data === 'string') {
    // Attempt to parse JSON string (double-encoded case)
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }
  return data as T;
}

