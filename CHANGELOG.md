# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-05-06

### Changed (BREAKING)

- **Typed request/response API across all quote and trade methods.** All
  `QuoteClient` and `TradeClient` methods now return typed response objects
  (e.g. `MarketState`, `Brief`, `Kline`, `Asset`, `Order`, `PlaceOrderResult`)
  instead of untyped `ApiResponse` envelopes. Callers no longer need to
  destructure `response.data` or deal with `items` wrappers — the client
  unwraps these internally and hands back the domain object.
- **Idiomatic camelCase request models.** Request parameters are written in
  camelCase in TypeScript and converted to `snake_case` on the wire
  automatically by the transport layer (`client/case-convert.ts`). This
  matches the server's wire format while keeping idiomatic TS at the call
  site.
- **Split `Order` into `Order` (response) and `OrderRequest` (for
  place/modify/preview).** The response type exposes the full set of fields
  returned by the server; the request type only contains the fields the
  server accepts. Helper factories in `model/order-helpers.ts`
  (`marketOrder`, `limitOrder`, etc.) now return `OrderRequest`.
- **Unwrap `{items: [...]}` envelopes for trade endpoints.** `getOrders`,
  `getActiveOrders`, `getInactiveOrders`, `getFilledOrders`, `getPositions`,
  `getAssets`, `getOrderTransactions`, `getContract(s)`, and
  `getQuoteContract` now return arrays directly.
- **Method signature corrections to match server contract:**
  - `getQuoteDepth(symbol, market)` — added required `market`
  - `getFutureContracts(exchangeCode)` — method renamed to
    `future_contract_by_exchange_code`; parameter is `exchange_code`
  - `getFutureRealTimeQuote(contractCodes)` — accepts array
  - `getFutureKline(req: FutureKlineRequest)` — structured request with
    `beginTime`/`endTime` (both default to `-1` when omitted on the server)
  - `getFinancialDaily / getFinancialReport / getCorporateAction` — structured
    `*Request` objects for complex parameter sets
  - `getCapitalFlow(symbol, market, period)` and
    `getCapitalDistribution(symbol, market)` — flat parameters matching
    server
  - `marketScanner(req: MarketScannerRequest)` — structured request
  - `getOrderTransactions(orderId, symbol, secType)` — sends `order_id`
  - `getFilledOrders(startDateMs, endDateMs)` — sends `start_date` /
    `end_date` in milliseconds
  - `getQuoteContract(symbol, secType, expiry)` — wraps single symbol in
    `symbols` array and sends `expiry`

### Added

- `src/client/case-convert.ts` — `keysToSnakeCase` / `camelToSnake` utilities
  applied automatically by `createApiRequest`. Keys that already contain
  `_` are left untouched, so `snake_case` inputs still work.
- `src/client/api-response.ts` — `unmarshalData<T>()` helper handles both
  JSON-string and already-parsed `data` payloads returned by the server.
- `src/model/quote.ts` — 30+ response interfaces covering every quote
  endpoint (`MarketState`, `Brief`, `Kline` + `KlineItem`, `Timeline`,
  `TradeTick`, `Depth`, `OptionExpiration`, `OptionChain`, `FutureExchange`,
  `FutureContractInfo`, `FutureQuote`, `FutureKline`,
  `FinancialDailyItem`, `FinancialReportItem`, `CorporateAction`,
  `CapitalFlow`, `CapitalDistribution`, `ScannerResult`, `QuotePermission`,
  etc.) and 5 request interfaces (`FinancialDailyRequest`,
  `FinancialReportRequest`, `CorporateActionRequest`, `FutureKlineRequest`,
  `MarketScannerRequest`).
- `src/model/trade.ts` — `Asset`, `AssetSegment`, `PrimeAsset`,
  `PrimeAssetSegment`, `PreviewResult`, `PlaceOrderResult`,
  `OrderIdResult`, `Transaction`.
- **Expanded contract / position / order fields** to cover what the server
  actually returns (e.g. `Contract.primaryExchange`, `Contract.isEtf`,
  `Position.positionQty`, `Position.todayPnl`, etc.).
- `examples/quote-example.ts` and `examples/trade-example.ts` — full
  end-to-end coverage of every `QuoteClient` / `TradeClient` method with a
  `PASS / FAIL / SKIP` summary, auto-discovering config from
  `./tiger_openapi_config.properties` or
  `~/.tigeropen/tiger_openapi_config.properties`.

### Fixed

- Double-encoded JSON payloads (server occasionally returns `data` as a JSON
  string) are now transparently parsed.
- `getCorporateAction` flattens the server's `{symbol: [...]}` map into a
  single array.
- `parseOptionIdentifier` now returns `expiryMs` as a number and `strike`
  as a number (previously strings).

### Unchanged

- Push / streaming client (`src/push`) is protobuf-based and already
  uses the correct wire format — not affected by this release.

## [0.2.0] - 2026-04-30

- Retry policy, protobuf push client, initial trade/quote clients.

## [0.1.0] - 2026-04-01

- Initial release.
