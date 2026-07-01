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
 * Replace bare integers (not inside JSON string values) that exceed
 * Number.MAX_SAFE_INTEGER (> 15 digits) with quoted string equivalents,
 * so that int64 order IDs survive JSON.parse without precision loss.
 */
function patchLargeIntegers(text: string): string {
  // Mask all existing JSON string values so their content isn't touched.
  const strings: string[] = [];
  const masked = text.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
    strings.push(match);
    return '\x01' + (strings.length - 1) + '\x01';
  });
  // Quote any bare integer with >15 digits.
  const patched = masked.replace(/-?\d{16,}/g, (m) => '"' + m + '"');
  // Restore original string values.
  return patched.replace(/\x01(\d+)\x01/g, (_, i) => strings[parseInt(i, 10)]);
}

/**
 * Parse the raw HTTP response body.
 * Throws TigerError when code != 0.
 * Large integers in the outer envelope are not an issue (only inner `data` contains int64 IDs).
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
    // Attempt to parse JSON string (double-encoded case).
    // Patch large integers before parsing so int64 IDs survive as strings.
    try {
      return JSON.parse(patchLargeIntegers(data)) as T;
    } catch {
      return data as unknown as T;
    }
  }
  return data as T;
}

