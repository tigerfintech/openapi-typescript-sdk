/**
 * Shared token management methods for TradeClient and QuoteClient.
 * Both clients delegate to the underlying HttpClient; this module
 * centralises the JSDoc so each client stays in sync automatically.
 */
import type { HttpClient } from './http-client';
import type { TokenManager } from '../config/token-manager';

/**
 * Call the `user_token_refresh` API and return the new token string.
 * Read-only: does NOT update the stored token.
 * Use `refreshToken()` to also update the in-memory config and optionally persist.
 */
export async function queryToken(httpClient: HttpClient): Promise<string> {
  return httpClient.queryToken();
}

/**
 * Refresh the token: call the API, update the in-memory config token, and
 * optionally persist via the provided TokenManager (file + writer callback).
 *
 * @param httpClient - The underlying HTTP client
 * @param tokenManager - optional TokenManager for file persistence and writer callback
 */
export async function refreshToken(
  httpClient: HttpClient,
  tokenManager?: TokenManager | null,
): Promise<void> {
  return httpClient.refreshToken(tokenManager);
}

/**
 * Start background token auto-refresh. Returns a TokenManager that can be
 * used to stop the background task via `tm.stopAutoRefresh()`.
 *
 * @param httpClient - The underlying HTTP client
 * @param refreshDurationSecs - Refresh threshold in seconds (minimum 30).
 *   When the token age exceeds this value the refresh is triggered.
 * @param checkIntervalMs - How often to check whether a refresh is needed,
 *   in milliseconds. Defaults to 300 000 ms (5 minutes).
 * @param tokenWriter - Optional callback invoked with the new token string
 *   after each successful refresh.
 */
export function startTokenAutoRefresh(
  httpClient: HttpClient,
  refreshDurationSecs: number,
  checkIntervalMs?: number,
  tokenWriter?: (token: string) => void,
): TokenManager {
  return httpClient.startTokenAutoRefresh(null, {
    refreshDuration: refreshDurationSecs,
    refreshInterval: checkIntervalMs,
    tokenWriter,
  });
}
