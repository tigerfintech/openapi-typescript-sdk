# Changelog

## 0.5.9 (2026-11-18)

### New

- Contract responses expose supported combinations of order types, time in force, and trading sessions through order capabilities.
- `getContractV3` queries a single trading contract, including option order capabilities and account-specific trading properties.

## 0.5.8 (2026-11-11)

### New

- US option snapshots and option chains provide GTH/CURB extended-session quotes and independent cumulative volume and turnover.
- Protobuf option callbacks provide current-session prices, volume, and turnover with `PreMarket` / `AfterHours` tags and independent cumulative totals.
- Option minute-bar requests support `with_hour_trading` to include or exclude extended-session data while preserving the server default when omitted.
- `NewsClient.getStockNews` queries stock news with page-number pagination.
- `NewsClient.getMarketNews` queries market highlights with cursor pagination.

### Changed

- Protobuf option callbacks use flat quote fields; HTTP snapshots and option chains retain their extended-session objects.

### Fixed

- `getOrder` returns order details instead of allocating a new order number.
- `GetOrderRequest.id` accepts strings to preserve 64-bit order IDs.
- Single-order queries accept both order objects and single-item collections.
- Response parsing preserves integers beyond JavaScript's safe range as strings.

## 0.5.7 (2026-11-09)

### New

- Asset and position queries support `assetQuoteType` values `ETH`, `RTH`, and `OVERNIGHT`.
- Asset and position subscriptions accept quote-basis options and restore them after reconnecting.
- `buildSubscribeMessage` supports quote-basis selection.

### Changed

- Existing subscriptions remain compatible and retain their previous behavior when no quote basis is specified.

### Fixed

- HTTP User-Agent and push handshake versions match the installed SDK version.
- ESM imports work on Node.js 16/18 without export-syntax or missing-extension errors.

## 0.5.6 (2026-08-27)

### New

- Real-time stock and cryptocurrency quotes provide turnover through `Brief.amount`.

## 0.5.5 (2026-08-19)

### New

- Cryptocurrency K-line and timeline responses provide fractional volume through `volumeDecimal`.
- `getTimeline` accepts request objects with `secType` for cryptocurrency timelines while retaining symbol-list calls.
- `getKlineByPage` supports `secType`.
- Option quotes provide mark prices and midpoint prices.
- Trade-tick queries support `tradeSession`, and push ticks provide readable trade-condition descriptions.

### Fixed

- Overnight quote fields match the service response.
- Full-tick push messages reach `onFullTick` without changing normal `onTick` dispatch.

### Breaking

- `Callbacks.onTick` receives decoded `PushTick` data instead of raw Protobuf. Update callback handlers to use the new fields.
- `FundDetailsRequest.startDate` and `endDate` require `yyyy-MM-dd` strings instead of numeric millisecond timestamps.

## 0.5.4 (2026-07-24)

### New

- `TradeClient` and `QuoteClient` expose token querying, refreshing, and automatic-refresh methods.
- Order helpers support monetary market and limit orders, trailing-stop prices, multi-leg orders, combination orders, and OCA orders.
- `OrderRequest` supports cash amounts and combination-order types.

### Changed

- `icebergOrder` accepts the extended optional arguments; `icebergOrderFull` is deprecated.
- The service-public-key constant is exported for custom configuration.

### Fixed

- Token files are discovered next to the configuration file independently of the working directory.

## 0.5.3 (2026-07-23)

### New

- Corporate-action queries support symbol changes, delistings, and IPOs.
- `CorporateActionType` includes `SymbolChange`, `Delisting`, and `IPO`.
- A service-public-key constant and environment-variable overrides support custom key and service URL configuration.
- Trading request types accept a per-call `secretKey`.

### Changed

- Trading requests inherit the configured institutional secret key unless a per-call key overrides it.

## 0.5.2 (2026-07-22)

### Fixed

- Large 64-bit order IDs retain their precision as strings.
- Properties files correctly parse line continuations.

## 0.5.1 (2026-07-13)

### New

- Option chains support filters for Greeks, moneyness, implied volatility, and open interest.
- Option K-line queries support result limits and sort direction.
- Order requests support batch allocations, virtual orders, profit/loss-based brackets, and multi-leg option orders.
- `ContractLegRequest` represents multi-leg option legs.

### Fixed

- `getOrder` sends the correct parameters.

## 0.4.9 (2026-07-09)

### New

- `getOptionExpiration` accepts an optional market.
- Option-chain, option-quote, and option-K-line queries accept an optional timezone.

### Fixed

- Option expiration timestamps use local midnight instead of UTC.

### Breaking

- `getOptionKline` requires `beginTime` and `endTime` in milliseconds. Pass `-1` to use the server default.

## 0.4.8 (2026-07-07)

### New

- `QuoteClient.fromConfig` and `TradeClient.fromConfig` construct clients from configuration.

### Changed

- `getBrief`, `getOptionBrief`, `getStockDelayBriefs`, and `getWarrantBriefs` are deprecated. Use `getRealTimeQuote`, `getOptionQuote`, `getDelayedQuote`, and `getWarrantQuote`, respectively.

### Breaking

- `getKline`, `getOptionExpiration`, `getOptionChain`, and `getOptionKline` accept symbol arrays instead of one symbol.
- `getKline`, `getKlineByPage`, `getFutureKline`, and `getFutureKlineByPage` require request objects.
- `getOptionBars` is removed; use `getOptionKline`.
- `getBars`, `getFutureBars`, and their request types are removed.

## 0.4.7 (2026-07-03)

### Fixed

- `createClientConfig` reads `secret_key` correctly for institutional trading requests.

## 0.4.6 (2026-06-24)

### New

- `icebergOrder` creates iceberg orders.
- `IcebergPriceType` and iceberg-order fields are available.

## 0.4.5 (2026-06-09)

### Fixed

- `TradeClient`, `QuoteClient`, and other public APIs can be imported from the package entry point.
- Node.js ESM imports resolve relative modules correctly.

## 0.4.4 (2026-06-09)

### New

- Option-exercise APIs support checks, eligible-position queries, submission, records, and cancellation with typed requests and results.

## 0.4.3 (2026-05-25)

### New

- Automatic token refresh supports custom loading and persistence callbacks and a configurable token file.
- `HttpClient` exposes close, token-query, token-refresh, and automatic-refresh controls.
- Push clients restore account subscriptions after reconnecting.

### Fixed

- Transactions use string timestamps and provide account and fill-price information.
- Request timestamps use the correct local format for signature verification.
- Nested order-leg and algorithm-parameter keys serialize correctly.
- Token loading follows environment variable, callback, then file priority.

## 0.4.2 (2026-05-12)

### Fixed

- Funding-history fields match the service response.

## 0.4.1 (2026-05-12)

### New

- `propertiesFilePath` accepts a directory.

### Changed

- HTTP requests close connections after use.

### Fixed

- Futures ticks, segment-fund history, available funds, and funding history decode the correct response shapes.
- Response-signature validation skips responses without a signature.
- Business errors no longer trigger retries.

## 0.4.0 (2026-05-08)

### New

- Added trading APIs for individual orders, managed accounts, derivative contracts, asset analytics and aggregation, tradable quantities, forex orders, funding, and position transfers.
- Added 47 quote methods covering stocks, options, futures, funds, warrants, industries, corporate actions, financials, and calendars.
- Push subscriptions support stock rankings, option rankings, cryptocurrency, and market status.
- Added the corresponding models and enums, plus `orderStatusCode`.

### Fixed

- Cryptocurrency push messages reach the correct callbacks.
- Integer order statuses convert to their string names.
- Futures quote requests send the correct parameters.

### Breaking

- `OrderStatus` matches Java: replace `PendingNew` and `PartiallyFilled` checks with `PendingSubmit`.
- `getOrders`, `getActiveOrders`, `getInactiveOrders`, `getFilledOrders`, `getOrderTransactions`, `getPositions`, `getAssets`, and `getPrimeAssets` require request objects instead of positional arguments.
- `getBrief`, `getQuoteDepth`, `getTradeTick`, and `getFutureRealTimeQuote` require request objects instead of positional arguments.

## 0.3.1 (2026-05-07)

### New

- Order-status push messages provide order-information and order-status update timestamps.

## 0.3.0 (2026-05-06)

### New

- Added typed quote and trading responses, request models, and client examples.

### Fixed

- Double-encoded JSON responses parse correctly.
- `parseOptionIdentifier` returns the correct type.

### Breaking

- Quote and trading methods return typed results instead of raw `ApiResponse`; access response fields directly.
- Request properties use camelCase and no longer require manual snake_case conversion.
- Use `OrderRequest` for placement, modification, and preview; `Order` remains the response type.
- Several method signatures now match the service contract; update calls to the new signatures.

## 0.2.0 (2026-04-30)

### New

- Added retries, Protobuf push connections, and initial trading and quote APIs.

## 0.1.0 (2026-04-01)

### New

- Initial release.
