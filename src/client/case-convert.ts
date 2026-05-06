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
 * Keys already containing an underscore are kept as-is (already snake_case).
 */
export function keysToSnakeCase(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => keysToSnakeCase(v));
  }
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const newKey = k.includes('_') ? k : camelToSnake(k);
      out[newKey] = keysToSnakeCase(v);
    }
    return out;
  }
  return value;
}
