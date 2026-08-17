/**
 * Shared helpers for integration tests.
 *
 * These utilities let individual `it()` blocks make trading-hours-aware
 * decisions and resolve fresh identifiers/symbols from the live gateway
 * instead of hard-coding data that goes stale between test runs.
 *
 * Design:
 *   - `isMarketTrading` / `isMarketOpenExtended` are the two market-state
 *     predicates. Results are cached per-market for the lifetime of the
 *     test run so we don't slam `market_state` before every case.
 *   - `resolve*` helpers each do the minimum RPC work needed to seed a
 *     particular test (option identifier, HK warrant symbol, filled order
 *     id). They return `undefined` on any failure and let the caller
 *     decide whether that should fail or skip based on trading state.
 */
import type { QuoteClient } from '../../src/quote/quote-client';
import type { TradeClient } from '../../src/trade/trade-client';

// -----------------------------------------------------------------------
// Date helpers — shared between quote and trade integ tests
// -----------------------------------------------------------------------

/** Date N years ago (same month/day) in 'YYYY-MM-DD' format. */
export function yearsAgo(n: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Current date in 'YYYY-MM-DD' format. */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// -----------------------------------------------------------------------
// Market-state cache
// -----------------------------------------------------------------------

/**
 * Tiger `market_state` status codes.
 *
 * Only `TRADING` counts as "the market is open right now". Pre/post-hours
 * count as "extended" but not as regular trading.
 */
type MarketStatus =
  | 'NOT_YET_OPEN'
  | 'PRE_HOUR_TRADING'
  | 'TRADING'
  | 'MIDDLE_CLOSE'
  | 'POST_HOUR_TRADING'
  | 'CLOSING'
  | 'EARLY_CLOSED'
  | 'MARKET_CLOSED'
  | string;

/** Cached market status keyed by market code (`US`, `HK`, `CN`, `SG`, ...). */
const marketStatusCache = new Map<string, MarketStatus>();

/**
 * Fetch (and cache) the `status` field for a single market. Falls back to
 * `MARKET_CLOSED` when the API call fails so callers safely treat a
 * transient error as "not trading".
 */
async function fetchStatus(qc: QuoteClient, market: string): Promise<MarketStatus> {
  const cached = marketStatusCache.get(market);
  if (cached !== undefined) return cached;
  try {
    const rows = await qc.getMarketState(market);
    const first = rows?.[0] as any;
    // Tiger returns both `status` (enum) and `marketStatus` (human-readable);
    // status is the machine-friendly one we want.
    const status: MarketStatus = first?.status ?? first?.marketStatus ?? 'MARKET_CLOSED';
    marketStatusCache.set(market, status);
    return status;
  } catch {
    marketStatusCache.set(market, 'MARKET_CLOSED');
    return 'MARKET_CLOSED';
  }
}

/** True when `market_state.status === 'TRADING'`. */
export async function isMarketTrading(qc: QuoteClient, market: string): Promise<boolean> {
  return (await fetchStatus(qc, market)) === 'TRADING';
}

/**
 * True when the market is in regular trading OR pre/post-hours. Useful for
 * data endpoints that publish quotes across the extended session.
 */
export async function isMarketOpenExtended(qc: QuoteClient, market: string): Promise<boolean> {
  const s = await fetchStatus(qc, market);
  return s === 'TRADING' || s === 'PRE_HOUR_TRADING' || s === 'POST_HOUR_TRADING';
}

/**
 * Synchronous cached lookup after `fetchStatus` has been primed. Returns
 * false when the market has never been queried. Prefer the async variants
 * for correctness; this exists for `.skipIf(...)` predicates evaluated at
 * describe-time after `beforeAll` warmed the cache.
 */
export function isMarketTradingCached(market: string): boolean {
  return marketStatusCache.get(market) === 'TRADING';
}

/** Same, for extended hours. */
export function isMarketOpenExtendedCached(market: string): boolean {
  const s = marketStatusCache.get(market);
  return s === 'TRADING' || s === 'PRE_HOUR_TRADING' || s === 'POST_HOUR_TRADING';
}

/**
 * Prime the market-state cache for the given markets. Call in `beforeAll`
 * so subsequent `isMarket*Cached` checks work synchronously.
 */
export async function primeMarketStatuses(qc: QuoteClient, markets: string[]): Promise<void> {
  await Promise.all(markets.map((m) => fetchStatus(qc, m)));
}

/** Force a fresh fetch (mostly for tests of the helpers themselves). */
export function resetMarketStatusCache(): void {
  marketStatusCache.clear();
}

// -----------------------------------------------------------------------
// Dynamic identifier resolvers
// -----------------------------------------------------------------------

/**
 * Resolve a live US option identifier for `AAPL`:
 *   1. `option_expiration` → nearest expiry.
 *   2. `option_chain` → pick the ATM-ish row (middle of the returned items).
 *   3. Return the CALL identifier (fall back to PUT if only puts are present).
 *
 * Returns `undefined` on any gateway failure or empty response — the caller
 * decides whether to fail or skip based on trading hours.
 */
export async function resolveUsOptionIdentifier(qc: QuoteClient): Promise<string | undefined> {
  try {
    const exps = await qc.getOptionExpiration(['AAPL']);
    const dates = exps?.[0]?.dates ?? [];
    if (!dates.length) return undefined;

    const chain = await qc.getOptionChain([['AAPL', dates[0]]]);
    const items = (chain?.[0] as any)?.items ?? [];
    if (!items.length) return undefined;

    // Middle of the chain is close to at-the-money for most equities.
    const mid = items[Math.floor(items.length / 2)] as any;
    const id = mid?.call?.identifier ?? mid?.put?.identifier;
    if (typeof id === 'string' && id.length > 0) return id;

    // Fall back to the first row if the middle row was empty.
    const first = items[0] as any;
    return first?.call?.identifier ?? first?.put?.identifier;
  } catch {
    return undefined;
  }
}

/**
 * Resolve a live HK warrant symbol linked to `00700` (Tencent). Uses
 * `warrant_filter` because the standalone `warrant_briefs` endpoint takes a
 * symbol we don't have yet.
 */
export async function resolveHkWarrantSymbol(qc: QuoteClient): Promise<string | undefined> {
  try {
    const filter = await qc.getWarrantFilter({ symbol: '00700', page: 0, pageSize: 5 });
    const items = (filter as any)?.items;
    if (!Array.isArray(items) || !items.length) return undefined;
    const first = items[0];
    const sym = first?.symbol;
    return typeof sym === 'string' && sym.length ? sym : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve a filled/order id for the account, using the same fallback chain
 * TradeClient integ tests already rely on:
 *   1. Filled orders in the last 90 days
 *   2. Any recent orders
 *   3. Any inactive orders
 *
 * Returns `undefined` if none of the sources yield an id.
 */
export async function resolveFilledOrderId(
  tc: TradeClient,
): Promise<number | string | undefined> {
  const now = Date.now();
  try {
    const orders = await tc.getFilledOrders({
      startDate: now - 90 * 24 * 60 * 60 * 1000,
      endDate: now,
      limit: 5,
    });
    if (orders.length) return orders[0].id;
  } catch { /* try next source */ }

  try {
    const orders = await tc.getOrders({ limit: 5 });
    if (orders.length) return orders[0].id;
  } catch { /* try next source */ }

  try {
    const orders = await tc.getInactiveOrders({ limit: 5 });
    if (orders.length) return orders[0].id;
  } catch { /* nothing left to try */ }

  return undefined;
}

// -----------------------------------------------------------------------
// Fallback data — used when live discovery returns empty outside market
// hours for paper accounts with restricted futures permissions.
// -----------------------------------------------------------------------

/**
 * Hard-coded main-contract fallbacks used only when `getFutureContracts()`
 * returns empty for every candidate exchange (typically outside RTH on
 * paper accounts with restricted futures entitlements). These are stable
 * continuous-contract identifiers accepted by the gateway.
 */
export const FUTURES_FALLBACK = {
  exchangeCode: 'CME',
  contractCode: 'MNQmain',
  futureType: 'MNQ',
} as const;
