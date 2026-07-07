/**
 * 老虎证券 OpenAPI TypeScript SDK
 *
 * 本 SDK 提供行情查询、交易下单、账户管理和实时推送等功能，
 * 与 Python SDK 保持功能对等，遵循 TypeScript 最佳实践。
 *
 * 分层架构：
 * - 模型层（model）：Contract、Order、Position 等数据模型和枚举
 * - 配置层（config）：ClientConfig、ConfigParser
 * - 认证层（signer）：RSA 签名
 * - 传输层（client）：HttpClient、重试策略
 * - 业务层（quote/trade）：QuoteClient、TradeClient
 * - 推送层（push）：PushClient
 *
 * @packageDocumentation
 */

/** SDK 版本号 */
export const VERSION = '0.4.6';

// Config
export { createClientConfig, loadPropertiesFile } from './config';
export type { ClientConfig, ClientConfigOptions } from './config';
export { TokenManager } from './config';
export type { TokenManagerOptions, RefreshFn } from './config';

// Transport
export { HttpClient } from './client';
export { TigerError, classifyErrorCode } from './client';
export type { ErrorCategory } from './client';

// Clients
export { QuoteClient, parseOptionIdentifier } from './quote';
export { TradeClient } from './trade';
export { PushClient, ConnectionState, SubjectType } from './push';
export type { PushClientOptions } from './push';

// Models — order
export type { Order, OrderRequest } from './model/order';
export { marketOrder, limitOrder, stopOrder, stopLimitOrder } from './model/order-helpers';
export { normalizeOrderStatus } from './model/order-status';
export type { Contract } from './model/contract';
export type { Position } from './model/position';

// Models — trade responses
export type {
  Asset, AssetSegment, PrimeAsset, PreviewResult, PlaceOrderResult,
  OrderIdResult, Transaction, ManagedAccount, AnalyticsAsset, AggregateAssets,
  EstimateTradableQuantity, ForexOrderResult,
  SegmentFund, SegmentFundAvailableItem, SegmentFundHistoryItem,
  FundDetails, FundingHistoryItem,
  PositionTransferRecord, PositionTransferDetail, PositionTransferExternalRecord,
  OptionExerciseCheckResult, OptionExercisePositionPageResult, OptionExerciseRecordPageResult,
} from './model/trade';

// Models — trade requests
export type {
  OrdersRequest, GetOrderRequest, OrderTransactionsRequest,
  PositionsRequest, AssetsRequest, ManagedAccountsRequest,
  DerivativeContractsRequest, AnalyticsAssetRequest, AggregateAssetsRequest,
  EstimateTradableQuantityRequest, ForexOrderRequest, SegmentFundRequest,
  FundDetailsRequest, FundingHistoryRequest,
  PositionTransferRequest, PositionTransferRecordsRequest,
  PositionTransferDetailRequest, PositionTransferExternalRecordsRequest,
  OptionExerciseCheckRequest, OptionExercisePositionRequest,
  OptionExerciseSubmitRequest, OptionExerciseRecordsRequest, OptionExerciseCancelRequest,
} from './model/trade-requests';

// Models — quote responses
export type {
  MarketState, Brief, Kline, KlineItem, Timeline, TimelineItem, TradeTick, TradeTickItem,
  Depth, DepthLevel, OptionExpiration, OptionChain, OptionChainRow, OptionSymbol,
  FutureExchange, FutureContractInfo, FutureQuote, FutureKline, FutureKlineItem,
  FutureDepth, FutureTradeTickItem, FutureTradingTime,
  FinancialDailyItem, FinancialReportItem, CorporateAction,
  CapitalFlow, CapitalFlowItem, CapitalDistribution, ScannerResult, ScannerResultItem,
  QuotePermission, SymbolName, TradeMeta, StockDetail, StockBroker, StockBrokerItem,
  ShortInterest, StockIndustry, IndustryItem, IndustryStock,
  WarrantBrief, WarrantFilterResult, FundContractInfo, FundQuote, FundHistoryQuote,
  QuoteOvernight, KlineQuota, MarketScannerTag, MarketScannerTags,
  OptionAnalysis, OptionLeg, OptionVolatilityPoint, ExchangeRate, FinancialCurrency,
  BrokerDetail, TradingCalendarItem, FutureMainContractHistory,
} from './model/quote';
// Models — quote requests
export type {
  BriefRequest, DepthQuoteRequest, TradeTickRequest, KlineRequest, KlineByPageRequest,
  FutureBriefRequest, FutureKlineRequest, FutureKlineByPageRequest, FutureTradeTicksRequest,
  FutureDepthRequest, FutureContractSingleRequest, FutureContinuousContractsRequest,
  FutureHistoryMainContractRequest, FutureTradingTimesRequest, AllFutureContractsRequest,
  OptionTradeTicksRequest, OptionTimelineRequest, OptionDepthRequest,
  OptionSymbolsRequest, OptionAnalysisRequest, OptionQueryItem,
  ShortInterestRequest, StockBrokerRequest, StockDetailsRequest, StockFundamentalRequest,
  StockIndustryRequest, StockDelayBriefsRequest, SymbolsRequest, TradeMetasRequest,
  TradeRankRequest, TimelineHistoryRequest, TradingCalendarRequest,
  KlineQuotaRequest, QuotePermissionRequest, QuoteOvernightRequest,
  IndustryListRequest, IndustryStocksRequest,
  FundSymbolsRequest, FundContractsRequest, FundQuoteRequest, FundHistoryQuoteRequest,
  WarrantBriefsRequest, WarrantFilterRequest, MarketScannerTagsRequest,
  FinancialCurrencyRequest, FinancialExchangeRateRequest,
} from './model/quote-requests';

// Enums
export {
  OrderStatus, SecurityType, OrderType, TimeInForce, Market,
  Currency, QuoteRight, SegmentType, OrderSortBy, CorporateActionType,
  IndustryLevel, SortDirection, OptionAnalysisPeriod, FinancialReportPeriod,
  Language, License, BarPeriod, orderStatusCode,
} from './model/enums';
