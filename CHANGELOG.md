# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.2] - 2026-05-12

### Fixed

- **`FundingHistoryItem` 字段修正**：对照服务端 `FundDepositWithdrawDTO` 及真实响应重写。`id` 类型 `string` → `number`，移除不存在的 `segType`/`submitTime`/`updateTime`，新增 `refId`/`type`/`typeDesc`/`businessDate`/`statusDesc`/`completedStatus`/`createdAt`/`updatedAt`。

## [0.4.1] - 2026-05-12

### Fixed

- **`getFutureTradeTicks` 响应解包修正**：服务端返回 `{contractCode, items:[...]}` 结构，现正确解包 items 并回填 contractCode 到每条记录。`endIndex` 未设置时默认 30（与 Python/Go SDK 一致）。
- **`SegmentFundHistoryItem` 字段名修正**：`submitTime`/`updateTime` → `createdAt`/`updatedAt`/`settledAt`，补充 `statusDesc` 字段，与服务端实际响应对齐。
- **`SegmentFundAvailable` 返回类型修正**：由 `SegmentFund[]` 改为专用 `SegmentFundAvailableItem[]`（仅含 `fromSegment`/`currency`/`amount`）。
- **`SegmentFund` 模型更新**：`ID` 类型改为 `string | number`，补充 `statusDesc`/`message`/`settledAt`/`createdAt`/`updatedAt` 字段。
- **`getFundingHistory` 响应解析修正**：服务端返回裸 list（无 items 包装），改用 `callInto` 替代 `callIntoItems`。
- **响应签名验证修正**：部分接口不返回 sign 字段，不再抛异常，改为跳过验证。
- **重试逻辑修正**：API 业务错误（code != 0）不再触发指数退避重试（之前会重试 5 次导致 ~30s 假超时）。
- **HTTP 连接管理**：添加 `Connection: close` header，避免 keep-alive 连接未释放。

### Added

- **`propertiesFilePath` 支持目录路径**：传入目录时自动拼接 `tiger_openapi_config.properties`，简化配置加载。

## [0.4.0] - 2026-05-08

本次发布达到与 Python / Java / Go SDK **100% API 覆盖**。新增约 65 个方法,重构 12 个方法签名。包含多处 breaking change。

### Added

**Trade (17 个新方法)**

- `getOrder(req)` — 按 ID 查询单个订单详情(`orders` wire,传 id/order_id)
- `getManagedAccounts(req?)` — 查询机构子账户列表(`accounts`)
- `getDerivativeContracts(req)` — 衍生品合约列表(`quote_contract`)
- `getAnalyticsAsset(req)` — 按日资产分析(`analytics_asset`)
- `getAggregateAssets(req?)` — 综合账户资产汇总(`aggregate_assets`)
- `getEstimateTradableQuantity(req)` — 可交易数量估算(`estimate_tradable_quantity`)
- `placeForexOrder(req)` — 外汇下单(`place_forex_order`)
- `getSegmentFundAvailable(req)` / `getSegmentFundHistory(req)` / `transferSegmentFund(req)` / `cancelSegmentFund(req)` — 子账户资金调拨
- `getFundDetails(req)` — 资金流水明细(`fund_details`)
- `getFundingHistory(req)` — 资金调拨记录(`transfer_fund`)
- `transferPosition(req)` — 内部转股(`position_transfer`)
- `getPositionTransferRecords(req)` / `getPositionTransferDetail(req)` / `getPositionTransferExternalRecords(req)` — 转股记录查询

**Quote (47 个新方法)**

- 股票基础扩展(15): `getSymbols` / `getSymbolNames` / `getTradeMetas` / `getStockDetails` / `getStockDelayBriefs` / `getBars` / `getBarsByPage` / `getTimelineHistory` / `getTradeRank` / `getShortInterest` / `getStockBroker` / `getStockFundamental` / `getStockIndustry` / `getQuotePermission` / `getKlineQuota`
- 期权扩展(6): `getOptionBars` / `getOptionTradeTicks` / `getOptionTimeline` / `getOptionDepth` / `getOptionSymbols` / `getOptionAnalysis`
- 期货扩展(10): `getFutureContract` / `getAllFutureContracts` / `getCurrentFutureContract` / `getFutureContinuousContracts` / `getFutureHistoryMainContract` / `getFutureBars` / `getFutureBarsByPage` / `getFutureTradeTicks` / `getFutureDepth` / `getFutureTradingTimes`
- 基金(4): `getFundSymbols` / `getFundContracts` / `getFundQuote` / `getFundHistoryQuote`
- 窝轮(2): `getWarrantBriefs` / `getWarrantFilter`
- 行业(2): `getIndustryList` / `getIndustryStocks`
- 公司行动/财务/日历(6): `getCorporateSplit` / `getCorporateDividend` / `getCorporateEarningsCalendar` / `getFinancialCurrency` / `getFinancialExchangeRate` / `getTradingCalendar`
- 其他(2): `getMarketScannerTags` / `getQuoteOvernight`

**Push (4 对新订阅方法)**

- `subscribeStockTop(market, indicators)` / `unsubscribeStockTop(market, indicators)` — 股票排行榜(v0.3.0 已有 `onStockTop` 回调)
- `subscribeOptionTop(market, indicators)` / `unsubscribeOptionTop(market, indicators)` — 期权排行榜
- `subscribeCc(symbols)` / `unsubscribeCc(symbols?)` — 加密货币实时行情(复用 `onQuote` 回调)
- `subscribeMarket(market)` / `unsubscribeMarket(market)` — 市场状态推送(复用 `onQuote` 回调)

**Enums (7 个新专属枚举)**

- `OrderSortBy` — 订单排序字段(LATEST_CREATED / LATEST_STATUS_UPDATED)
- `SegmentType` — 账户分部类型(SEC / FUT / FUND / ALL)
- `CorporateActionType` — 公司行动类型(split / dividend / earning)
- `IndustryLevel` — 行业级别(GSECTOR / GGROUP / GIND / GSUBIND)
- `SortDirection` — 排序方向
- `OptionAnalysisPeriod` — 期权分析周期
- `FinancialReportPeriod` — 财报类型(Annual / Quarterly / LTM)
- `orderStatusCode(status)` 工具函数 — 返回订单状态对应的服务端数字码

**OrderStatusData push message**

- 合并了 `updateTime` (field 44) 和 `latestTime` (field 45) 两个字段(原 0.3.1 条目)

### Changed (BREAKING)

1. **OrderStatus 枚举对齐 Java SDK** — 移除 `PendingNew` 和 `PartiallyFilled`(这两个是 Python 客户端派生,服务端不返回),新增 `PendingSubmit`。最终 8 个值: `Invalid` / `Initial` / `PendingCancel` / `Cancelled` / `Submitted` / `Filled` / `Inactive` / `PendingSubmit`,与 Java SDK `OrderStatus.java` 完全一致。

2. **8 个 Trade 方法改签名为 Request 对象** (原位置参数 / 无参):
   - `getOrders()` → `getOrders(req?: OrdersRequest)`
   - `getActiveOrders()` → `getActiveOrders(req?: OrdersRequest)`
   - `getInactiveOrders()` → `getInactiveOrders(req?: OrdersRequest)`
   - `getFilledOrders(startMs, endMs)` → `getFilledOrders(req?: OrdersRequest)` (startMs/endMs 改为 req.startDate/req.endDate)
   - `getOrderTransactions(id, symbol, secType)` → `getOrderTransactions(req: OrderTransactionsRequest)` (全部字段可选,不再要求 symbol/secType)
   - `getPositions()` → `getPositions(req?: PositionsRequest)`
   - `getAssets()` → `getAssets(req?: AssetsRequest)`
   - `getPrimeAssets()` → `getPrimeAssets(req?: AssetsRequest)`

3. **4 个 Quote 方法改签名为 Request 对象**:
   - `getBrief(symbols)` → `getBrief(req: BriefRequest)`
   - `getQuoteDepth(symbol, market)` → `getQuoteDepth(req: DepthQuoteRequest)`
   - `getTradeTick(symbols)` → `getTradeTick(req: TradeTickRequest)`
   - `getFutureRealTimeQuote(contractCodes)` → `getFutureRealTimeQuote(req: FutureBriefRequest)`

### Fixed

- **Push dispatcher 补 Cc dataType 路由**:之前收到 Cc 推送会抛 "Unknown DataType"(dispatcher 默认分支)。现路由到 `onQuote` 回调,与 Java / Python / Go SDK 一致。
- **`Order.status` 反序列化时自动把整数转字符串**:服务端同时返回整数(-2/-1/3/4/5/6/7/8)和字符串(Invalid/Initial/...)的 status,现在客户端统一归一为 Java 风格字符串。不做跨别名合并(Submitted↔Held 等保持原样)。
- **`getFutureRealTimeQuote` wire method** 修正为 `future_real_time_quote`(不是早先误用的 `future_brief`)。

### 迁移指引

```ts
// Before (0.3.x)
const orders = await tc.getOrders();
const filled = await tc.getFilledOrders(startMs, endMs);
const txs = await tc.getOrderTransactions(id, symbol, secType);
const pos = await tc.getPositions();
const assets = await tc.getAssets();
const briefs = await qc.getBrief(['AAPL']);
const depth = await qc.getQuoteDepth('AAPL', 'US');

// After (0.4.0)
const orders = await tc.getOrders({});                               // 或 tc.getOrders()
const filled = await tc.getFilledOrders({ startDate: startMs, endDate: endMs });
const txs = await tc.getOrderTransactions({ orderId: id, symbol, secType });
const pos = await tc.getPositions({});
const assets = await tc.getAssets({});
const briefs = await qc.getBrief({ symbols: ['AAPL'] });
const depth = await qc.getQuoteDepth({ symbols: ['AAPL'], market: 'US' });

// OrderStatus 迁移
// OrderStatus.PendingNew      → 移除(服务端从不返回,Python 派生)
// OrderStatus.PartiallyFilled → 移除(同上,用户自己根据 filledQuantity 判断)
// OrderStatus.PendingSubmit   → 新增(对应服务端数字 8)
```

### 设计原则

- **Request interface 字段名 = 服务端 wire 真名(camelCase 转换后)**,不学 Python 客户端做参数别名。Trade 时间字段统一用 `startDate`/`endDate`(wire `start_date`/`end_date`,ms 时间戳)。
- 所有 Request 字段都可选,`account` 留空时自动填 client 初始化的默认账户。
- 枚举字符串值对齐 Java SDK;专属业务枚举对齐 Python SDK。

## [0.3.1] - 2026-05-07

### Added

- `OrderStatusData` push message: new fields `updateTime` (field 44, timestamp ms of order info update) and `latestTime` (field 45, timestamp ms of order status update). Regenerated `src/push/pb/OrderStatusData.ts`.

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
