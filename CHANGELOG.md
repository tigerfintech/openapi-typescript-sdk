# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.9] - 2026-07-09

### Breaking Changes

- **`getOptionKline` 签名变更**：新增必填参数 `beginTime: number` 和 `endTime: number`（毫秒时间戳，传 `-1` 为服务端默认值）。旧调用 `getOptionKline(identifiers, period)` 需改为 `getOptionKline(identifiers, period, -1, -1)`。

### Added

- **`getOptionExpiration` 新增可选 `market` 参数**：`getOptionExpiration(symbols, market?)` — 查询 HK 期权时传 `'HK'`。
- **`getOptionChain`/`getOptionQuote`/`getOptionKline` 时区参数**：支持 `timezone` 可选参数覆盖自动推断；US 期权默认 `America/New_York`，HK 期权（`.HK` 后缀）默认 `Asia/Hong_Kong`。

### Fixed

- **期权到期日时区错误**：`localMidnightMs` 原使用 `T00:00:00Z`（UTC），导致 US/HK 期权到期日时间戳偏差 4–8 小时。现使用正确本地午夜时间戳。

## [0.4.8] - 2026-07-07

### Breaking Changes

- **多 symbol 支持（行情接口签名变更）**：下列接口参数由单 symbol 改为数组，调用方需更新：
  - `getKline(symbol: string, period)` → `getKline(symbols: string[], period)`
  - `getOptionExpiration(symbol: string)` → `getOptionExpiration(symbols: string[])`
  - `getOptionChain(symbol: string, expiry: string)` → `getOptionChain(items: Array<[string, string]>)`（每项为 `[symbol, "YYYY-MM-DD"]` 对）
  - `getOptionKline(identifier: string, period)` → `getOptionKline(identifiers: string[], period)`
- **删除重复方法 `getOptionBars`**：该方法与 `getOptionKline` 均对应 `option_kline` API，已删除，请统一使用 `getOptionKline`。同时删除 `OptionBarsRequest` 类型。
- **`getKline` 签名变更（Request 对象）**：`getKline(symbols: string[], period: string)` → `getKline(req: KlineRequest)`；删除同名 `getBars` 方法及 `BarsRequest` 类型。
- **`getKlineByPage` 重命名**：`getBarsByPage(req: BarsByPageRequest)` → `getKlineByPage(req: KlineByPageRequest)`；删除 `BarsByPageRequest` 类型。
- **`getFutureBars` 删除**：改用 `getFutureKline(req: FutureKlineRequest)`；删除 `FutureBarsRequest` 类型。
- **`getFutureKlineByPage` 重命名**：`getFutureBarsByPage(req: FutureBarsByPageRequest)` → `getFutureKlineByPage(req: FutureKlineByPageRequest)`；删除 `FutureBarsByPageRequest` 类型。

### Added

- **`QuoteClient.fromConfig(config)`**：直接从 `ClientConfig` 创建 `QuoteClient`，内部自动使用 quote server URL，无需手动构造 `HttpClient`。
- **`TradeClient.fromConfig(config, account, secretKey?)`**：直接从 `ClientConfig` 创建 `TradeClient`，无需手动构造 `HttpClient`。

### Deprecated

- **`getBrief` → `getRealTimeQuote`**：方法名与 wire method `quote_real_time` 不一致，现以 `getRealTimeQuote` 为主，旧名保留并标记 `@deprecated`。
- **`getOptionBrief` → `getOptionQuote`**：wire method 为 `option_brief`，更名为 `getOptionQuote`。
- **`getStockDelayBriefs` → `getDelayedQuote`**：wire method 为 `quote_delay`，更名与之对齐。
- **`getWarrantBriefs` → `getWarrantQuote`**：wire method 为 `warrant_briefs`，更名保持接口层风格一致。

## [0.4.7] - 2026-07-03

### Fixed

- **`createClientConfig` 不读 `secret_key`**：机构账号的 secret_key 无法从 properties 文件或 `TIGEROPEN_SECRET_KEY` 环境变量自动加载，导致所有交易接口报 `access forbidden`；现已在 `ClientConfig` / `ClientConfigOptions` 新增 `secretKey` 字段，并在配置加载时同步读取

## [0.4.6] - 2026-06-24

### Added

- **冰山单支持**：新增 `icebergOrder()`（基础参数）和 `icebergOrderFull()`（完整参数，含 `minDisplaySize`、`checkIntervals`、`priceType`、`startTime`、`endTime`）两个订单构造辅助函数。
- **`IcebergPriceType` 枚举**：`LIMIT_PRICE` / `OPPONENT_PRICE`。
- **`Order` 类型新增冰山单字段**：`displaySize`、`minDisplaySize`、`checkIntervals`、`priceType`、`startTime`、`endTime`。
- **单元测试**：`icebergOrder` / `icebergOrderFull` 覆盖基础构造、完整参数及零值省略三个场景。

## [0.4.5] - 2026-06-09

### Fixed

- **`index.ts` 补全公共导出**：原入口文件仅导出 `VERSION` 常量，导致 JS/TS 项目无法通过 `import { TradeClient } from '@tigeropenapi/tigeropen'` 引入任何功能。现已 re-export 所有公共 API：`TradeClient`、`QuoteClient`、`PushClient`、`HttpClient`、`createClientConfig`、`TokenManager`、全部 model 类型及枚举。
- **ESM 构建缺少 `.js` 扩展名**：Node.js ESM 规范要求相对路径导入必须带完整文件扩展名，但 TypeScript `moduleResolution: node` 不自动生成扩展名，导致 `import ... from '@tigeropenapi/tigeropen'` 在 Node.js ESM 项目中报 `ERR_MODULE_NOT_FOUND` / `ERR_UNSUPPORTED_DIR_IMPORT`。新增 `scripts/fix-esm-imports.mjs` postbuild 脚本，自动为 `dist/esm/` 所有相对导入补充 `.js` / `/index.js`，已接入 `npm run build`。

## [0.4.4] - 2026-06-09

### Added

- **期权行权 5 个接口**：新增 `checkOptionExercise`、`getOptionExercisePositions`、`submitOptionExercise`、`getOptionExerciseRecords`、`cancelOptionExercise`，对应 wire method `option_exercise_check / option_exercise_position / option_exercise_submit / option_exercise_record / option_exercise_cancel`。全部接口自动注入 `account`。
- **请求/响应模型**：新增 `OptionExerciseCheckRequest`、`OptionExercisePositionRequest`、`OptionExerciseSubmitRequest`、`OptionExerciseRecordsRequest`、`OptionExerciseCancelRequest` 及对应结果类型 `OptionExerciseCheckResult`、`OptionExercisePositionPageResult`、`OptionExerciseRecordPageResult`。

### Fixed

- 将 `OptionExercisePageRequest` 重命名为 `OptionExerciseRecordsRequest`，与方法名 `getOptionExerciseRecords` 对齐。

## [0.4.3] - 2026-05-25

### Added

- **Token 自动刷新**：新增 `TokenManager`（后台 `setInterval` + `timer.unref()` 避免进程挂起）、`tokenLoader` / `tokenWriter` 回调、`syncToken()` 内存同步方法，与 Go SDK v0.3.6 功能对齐。
- **`HttpClient.close()`**：停止后台 token 刷新 timer，避免长期运行服务中的泄漏。
- **`TIGEROPEN_TOKEN_FILE` 环境变量**：支持通过环境变量指定 token 文件路径。
- **`HttpClient.queryToken()` / `refreshToken()` / `startTokenAutoRefresh()`**：手动刷新与自动刷新控制接口。
- **Push `accountSubs` 改为 `Map<SubjectType, string>`**：记录订阅时的 account，重连后自动恢复订阅，避免断连后 account 丢失。

### Fixed

- **`Transaction` 响应模型修正**（对应 Go SDK v0.3.1）：`transactedAt` 类型 `number` → `string`（服务端返回 "YYYY-MM-DD HH:MM:SS" 格式字符串非时间戳）；新增 `accountId`、`filledPrice`、`filledAmount`、`filledQuantityScale`、`transactionTime` 字段与服务端实际响应对齐。
- **请求时间戳修正**：原 `toISOString()` 生成 UTC 时间，改为本地时间格式 `YYYY-MM-DD HH:MM:SS`，与 Go SDK 签名格式对齐，避免服务端拒绝请求。
- **`keysToSnakeCase` 守卫移除**：移除阻止嵌套对象 key 转换的错误 `typeof v !== 'object'` 守卫，确保 `orderLegs`、`algoParams` 等嵌套字段的 key 正确转为 snake_case。
- **域名查询优化**：`queryDomains()` 仅调用一次，结果同时用于 `serverUrl` 和 `quoteServerUrl`，消除冗余请求。
- **Token 加载优先级修正**：`TIGEROPEN_TOKEN` 环境变量 > `tokenLoader` > token 文件，与 Go SDK 保持一致。

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
