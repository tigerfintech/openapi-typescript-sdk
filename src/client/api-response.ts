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
 * Replaces bare int64 values (≥17 digits, not part of a float) with quoted
 * strings so they survive JSON.parse without precision loss.
 * 17+ digits are guaranteed to exceed Number.MAX_SAFE_INTEGER (≈9.007e15),
 * so 16-digit microsecond timestamps remain as numbers.
 */
function patchLargeIntegers(text: string): string {
  const strings: string[] = [];
  const masked = text.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
    strings.push(match);
    return '\x01' + (strings.length - 1) + '\x01';
  });
  // Match bare integers preceded by a JSON structural character or line start,
  // not followed by decimal point or exponent (avoids matching float components).
  // The `m` flag makes `^` match line-start for multi-line JSON.
  const patched = masked.replace(/([:,\[{]|^)\s*(-?\d{17,})(?![.\deE])/gm, (full, prefix, num) => {
    return prefix + '"' + num + '"';
  });
  return patched.replace(/\x01(\d+)\x01/g, (_, i) => strings[parseInt(i, 10)]);
}

/**
 * Parse the raw HTTP response body. Throws TigerError when code != 0.
 *
 * patchLargeIntegers is applied before JSON.parse to preserve int64 order IDs
 * (e.g. 28868646234578944) as strings rather than losing precision.
 */
export function parseApiResponse(body: string): ApiResponse {
  const resp: ApiResponse = JSON.parse(patchLargeIntegers(body));
  if (resp.code !== 0) {
    throw new TigerError(resp.code, resp.message);
  }
  return resp;
}

/**
 * Decode an ApiResponse.data payload into a typed value.
 * Handles double-encoded JSON (where `data` is a JSON string wrapping JSON),
 * seen on some trade endpoints.
 */
export function unmarshalData<T>(data: unknown): T | undefined {
  if (data == null) return undefined;
  if (typeof data === 'string') {
    try {
      return JSON.parse(patchLargeIntegers(data)) as T;
    } catch {
      return data as unknown as T;
    }
  }
  return data as T;
}

