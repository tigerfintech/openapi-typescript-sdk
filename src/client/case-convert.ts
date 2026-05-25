/**
 * Case conversion utilities.
 *
 * TypeScript SDK uses camelCase idiomatically. The server expects
 * snake_case for request field names and returns camelCase for responses.
 * These helpers convert camelCase objects to snake_case before
 * serialization; response side needs no conversion.
 */

/** Convert a single camelCase key to snake_case. */
export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

/**
 * Recursively convert all object keys from camelCase to snake_case.
 * Preserves arrays, primitives, and Date/null/undefined.
 *
 * Note: camelToSnake is idempotent for pure snake_case keys (no uppercase
 * letters → no replacements), so no pre-check is needed.
 */
export function keysToSnakeCase(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => keysToSnakeCase(v));
  }
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[camelToSnake(k)] = keysToSnakeCase(v);
    }
    return out;
  }
  return value;
}
