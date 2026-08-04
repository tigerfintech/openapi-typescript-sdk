# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.5] - 2026-08-04

### Fixed
- `SDK_VERSION` 与 `package.json` 版本号不一致：此前停留在 `0.4.8`，导致 HTTP
  `User-Agent` 与 push 握手的 `sdkVersion` 上报错误版本。现由 `npm run build`
  自动同步（`scripts/sync-version.mjs`），并新增单测防止再次漂移。

## [0.5.4] - 2026-07-24

### Added
- `TradeClient` / `QuoteClient`：新增 `queryToken()` / `refreshToken()` / `startTokenAutoRefresh()` 方法，无需直接操作 `HttpClient`
- 订单工具函数：新增 `marketOrderByAmount`、`limitOrderByAmount`、`trailOrderByPrice`、`limitOrderWithLegs`、`comboOrder`、`ocaOrder`、`contractLeg`
- `icebergOrder` 合并可选参数（原 `icebergOrderFull` 废弃，参数后移为可选）
- `OrderRequest` 新增 `cashAmount`、`comboType` 字段

### Fixed
- token 文件（`tiger_openapi_token.properties`）与 config 文件同目录自动加载，不再依赖当前工作目录

### Changed
- `SANDBOX_TIGER_PUBLIC_KEY` 导出，支持非生产环境公钥配置

## [0.5.3] - 2026-07-23

### Added
- `getCorporateSymbolChange` / `getCorporateDelisting` / `getCorporateIPO` — 企业行为查询（代码变更、退市、新股上市）
- `CorporateActionType`：新增 `SymbolChange`、`Delisting`、`IPO`
- `SANDBOX_TIGER_PUBLIC_KEY`：导出非生产环境公钥常量
- `TIGEROPEN_TIGER_PUBLIC_KEY` / `TIGEROPEN_SERVER_URL` / `TIGEROPEN_QUOTE_SERVER_URL` 环境变量支持，可覆盖 properties 文件默认值
- 所有交易 Request 类型新增可选 `secretKey` 字段，支持逐接口覆盖

### Changed
- `TradeClient`：`ClientConfig.secretKey` 自动注入所有交易请求（机构账号），per-call `secretKey` 可覆盖

## [0.5.2] - 2026-07-22

### Fixed
- 修复大整数订单 ID（int64）精度丢失问题，以字符串形式保留完整精度
- 修复 properties 配置文件续行（`\`）解析

## [0.5.1] - 2026-07-13

### Fixed
- `getOrder` wire method 错误修正（`orders` → `order_no`）

### Added
- `getOptionChain`：新增可选参数 `returnGreekValue` 和 `optionFilter`（价内外、IV、持仓量、Greeks 过滤）
- `Range` / `OptionChainFilter` / `OptionChainFilterGreeks` 范围过滤类型
- `getOptionKline`：新增可选参数 `limit` 和 `sortDir`
- `OrderRequest`：补齐 `expireTime` / `afterHoursPrice` / `batchNo` / `segType` / `amount` / `isQuantityByAmount` / `allocAccounts` / `allocShares` / `source` / `channel` / `virtualOrderType` / `virtualId` / `profitTakerOrderId` / `stopLossOrderId` / `localNo` / `ocaOrders` / `contractLegs`
- `ContractLegRequest`：多腿期权子腿类型（MLEG）

## [0.4.9] - 2026-07-09

### Breaking Changes
- `getOptionKline` 新增必填参数 `beginTime` 和 `endTime`（ms 时间戳，传 `-1` 为服务端默认值）

### Added
- `getOptionExpiration` 新增可选 `market` 参数
- `getOptionChain` / `getOptionQuote` / `getOptionKline` 新增可选 `timezone` 参数

### Fixed
- 期权到期日时区错误（UTC → 本地午夜时间戳）

## [0.4.8] - 2026-07-07

### Breaking Changes
- 行情接口多 symbol 支持：`getKline` / `getOptionExpiration` / `getOptionChain` / `getOptionKline` 参数由单 symbol 改为数组
- `getKline` / `getKlineByPage` / `getFutureKline` / `getFutureKlineByPage` 改为 Request 对象签名
- 删除 `getOptionBars`（重复方法，统一用 `getOptionKline`）
- 删除 `getBars` / `getFutureBars` 及对应 Request 类型

### Added
- `QuoteClient.fromConfig(config)` / `TradeClient.fromConfig(config, account, secretKey?)` 工厂方法

### Deprecated
- `getBrief` → `getRealTimeQuote`
- `getOptionBrief` → `getOptionQuote`
- `getStockDelayBriefs` → `getDelayedQuote`
- `getWarrantBriefs` → `getWarrantQuote`

## [0.4.7] - 2026-07-03

### Fixed
- `createClientConfig` 未读取 `secret_key`，机构账号交易接口报 `access forbidden`

## [0.4.6] - 2026-06-24

### Added
- 冰山单辅助函数 `icebergOrder()`
- `IcebergPriceType` 枚举
- `Order` 类型补充冰山单字段

## [0.4.5] - 2026-06-09

### Fixed
- `index.ts` 补全公共导出（`TradeClient` / `QuoteClient` 等之前无法直接 import）
- ESM 构建缺少 `.js` 扩展名导致 Node.js ESM 项目报 `ERR_MODULE_NOT_FOUND`

## [0.4.4] - 2026-06-09

### Added
- 期权行权 5 个接口：`checkOptionExercise` / `getOptionExercisePositions` / `submitOptionExercise` / `getOptionExerciseRecords` / `cancelOptionExercise`
- 对应 Request / Result 类型

## [0.4.3] - 2026-05-25

### Added
- Token 自动刷新：`TokenManager`、`tokenLoader` / `tokenWriter` 回调、`TIGEROPEN_TOKEN_FILE` 环境变量
- `HttpClient.close()` / `queryToken()` / `refreshToken()` / `startTokenAutoRefresh()`
- Push `accountSubs` 改为 `Map`，重连后自动恢复订阅

### Fixed
- `Transaction.transactedAt` 类型修正（`number` → `string`），补充 `accountId` / `filledPrice` 等字段
- 请求时间戳由 UTC 改为本地时间格式，与服务端签名要求对齐
- `keysToSnakeCase` 嵌套对象 key 转换修复（`orderLegs` / `algoParams` 等）
- Token 加载优先级修正：`TIGEROPEN_TOKEN` env > `tokenLoader` > token 文件

## [0.4.2] - 2026-05-12

### Fixed
- `FundingHistoryItem` 字段修正（对照服务端实际响应重写）

## [0.4.1] - 2026-05-12

### Fixed
- `getFutureTradeTicks` 响应解包修正
- `SegmentFundHistoryItem` / `SegmentFundAvailableItem` 字段名修正
- `getFundingHistory` 响应解析修正（服务端返回裸 list）
- 响应签名验证：无 sign 字段时跳过（不抛异常）
- API 业务错误不再触发重试
- 添加 `Connection: close` header

### Added
- `propertiesFilePath` 支持传目录路径

## [0.4.0] - 2026-05-08

与 Python / Java / Go SDK 100% API 覆盖，新增约 65 个方法，重构 12 个方法签名。

### Breaking Changes
- `OrderStatus` 枚举对齐 Java SDK：移除 `PendingNew` / `PartiallyFilled`，新增 `PendingSubmit`
- 8 个 Trade 方法改为 Request 对象签名：`getOrders` / `getActiveOrders` / `getInactiveOrders` / `getFilledOrders` / `getOrderTransactions` / `getPositions` / `getAssets` / `getPrimeAssets`
- 4 个 Quote 方法改为 Request 对象签名：`getBrief` / `getQuoteDepth` / `getTradeTick` / `getFutureRealTimeQuote`

### Added
- Trade：`getOrder` / `getManagedAccounts` / `getDerivativeContracts` / `getAnalyticsAsset` / `getAggregateAssets` / `getEstimateTradableQuantity` / `placeForexOrder` / 资金调拨 4 个 / `getFundDetails` / `getFundingHistory` / `transferPosition` / 转股记录 3 个
- Quote：新增 47 个方法（股票/期权/期货/基金/窝轮/行业/公司行动/财务/日历）
- Push：`subscribeStockTop` / `subscribeOptionTop` / `subscribeCc` / `subscribeMarket` 及对应取消订阅方法
- 枚举：`OrderSortBy` / `SegmentType` / `CorporateActionType` / `IndustryLevel` / `SortDirection` / `OptionAnalysisPeriod` / `FinancialReportPeriod`
- `orderStatusCode()` 工具函数

### Fixed
- Push dispatcher 补 Cc dataType 路由
- `Order.status` 整数自动转字符串
- `getFutureRealTimeQuote` wire method 修正

## [0.3.1] - 2026-05-07

### Added
- `OrderStatusData` push message 新增 `updateTime` / `latestTime` 字段

## [0.3.0] - 2026-05-06

### Breaking Changes
- 所有 `QuoteClient` / `TradeClient` 方法改为强类型响应，不再返回裸 `ApiResponse`
- 请求参数统一 camelCase，transport 层自动转 snake_case
- `Order` 拆分为 `Order`（响应）和 `OrderRequest`（下单/改单/预览）
- 多个方法签名修正以匹配服务端契约

### Added
- 30+ Quote 响应类型 / 5 个 Request 类型
- Trade 响应类型：`Asset` / `PrimeAsset` / `PreviewResult` / `PlaceOrderResult` / `Transaction` 等
- `examples/quote-example.ts` / `examples/trade-example.ts`

### Fixed
- 双重编码 JSON payload 解析
- `parseOptionIdentifier` 返回类型修正

## [0.2.0] - 2026-04-30

- 重试策略、protobuf push 客户端、初始 trade/quote 接口

## [0.1.0] - 2026-04-01

- 初始版本
