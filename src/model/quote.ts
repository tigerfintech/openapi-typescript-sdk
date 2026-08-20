/**
 * Quote response & request models.
 * All field names are camelCase (TypeScript idiom); request fields are
 * converted to snake_case on the wire by the client layer.
 */

// === Responses ===

export interface MarketState {
  market: string;
  marketStatus: string;
  status: string;
  openTime?: string;
}

export interface Brief {
  symbol: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  preClose?: number;
  latestPrice?: number;
  latestTime?: number;
  askPrice?: number;
  askSize?: number;
  bidPrice?: number;
  bidSize?: number;
  volume?: number;
  status?: string;
  adjPreClose?: number;
  change?: number;
  changeRate?: number;
  amplitude?: number;
  expiry?: string;
  strike?: string;
  right?: string;
  multiplier?: number;
  openInterest?: number;
}

export interface KlineItem {
  time: number;
  volume: number;
  volumeDecimal?: number | null;
  open: number;
  close: number;
  high: number;
  low: number;
  amount?: number;
}

export interface Kline {
  symbol: string;
  period?: string;
  nextPageToken?: string;
  items: KlineItem[];
}

export interface TimelineItem {
  time: number;
  volume: number;
  volumeDecimal?: number | null;
  price: number;
  avgPrice: number;
}

export interface TimelineBucket {
  items: TimelineItem[];
}

export interface Timeline {
  symbol: string;
  period: string;
  preClose: number;
  intraday?: TimelineBucket;
  preHours?: TimelineBucket;
  afterHours?: TimelineBucket;
}

export interface TradeTickItem {
  time: number;
  volume: number;
  price: number;
  type: string;
  partCode?: string;
  partName?: string;
  cond?: string;
}

export interface TradeTick {
  symbol: string;
  beginIndex: number;
  endIndex: number;
  items: TradeTickItem[];
}

export interface DepthLevel {
  price: number;
  count: number;
  volume: number;
}

export interface Depth {
  symbol: string;
  asks: DepthLevel[];
  bids: DepthLevel[];
}

export interface OptionExpiration {
  symbol: string;
  optionSymbols?: string[];
  dates: string[];
  timestamps: number[];
  periods?: string[];
  counts?: number[];
}

export interface OptionLeg {
  identifier: string;
  strike: string;
  right: string;
  bidPrice?: number;
  bidSize?: number;
  askPrice?: number;
  askSize?: number;
  volume?: number;
  latestPrice?: number;
  preClose?: number;
  openInterest?: number;
  multiplier?: number;
  lastTimestamp?: number;
  impliedVol?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
  markPrice?: number;
  preMarkPrice?: number;
  markTimestamp?: number;
  midPrice?: number;
  preMidPrice?: number;
  midTimestamp?: number;
}

export interface OptionChainRow {
  put?: OptionLeg;
  call?: OptionLeg;
}

/** Range filter, serialized as { min, max } — corresponds to Java Range<T> */
export interface Range {
  min?: number;
  max?: number;
}

/** Greeks range filters for option_chain (corresponds to Java OptionChainFilterModel.Greeks) */
export interface OptionChainFilterGreeks {
  delta?: Range;
  gamma?: Range;
  vega?: Range;
  theta?: Range;
  rho?: Range;
}

/** Option chain filter (corresponds to Java OptionChainFilterModel) */
export interface OptionChainFilter {
  inTheMoney?: boolean;
  impliedVolatility?: Range;
  openInterest?: Range;
  greeks?: OptionChainFilterGreeks;
}

export interface OptionChain {
  symbol: string;
  expiry: number;
  items: OptionChainRow[];
}

export interface FutureExchange {
  code: string;
  name: string;
  zoneId?: string;
}

export interface FutureContractInfo {
  continuous?: boolean;
  trade?: boolean;
  type: string;
  contractCode: string;
  ibCode?: string;
  name?: string;
  contractMonth?: string;
  lastTradingDate?: string;
  firstNoticeDate?: string;
  lastBiddingCloseTime?: number;
  currency?: string;
  exchangeCode?: string;
  multiplier?: number;
  minTick?: number;
  displayMultiplier?: number;
  exchange?: string;
  productWorth?: string;
  deliveryMode?: string;
  productType?: string;
  productScale?: string;
  lastTradingTimestamp?: number;
}

export interface FutureQuote {
  contractCode: string;
  latestPrice?: number;
  latestSize?: number;
  latestTime?: number;
  bidPrice?: number;
  askPrice?: number;
  bidSize?: number;
  askSize?: number;
  openInterest?: number;
  openInterestChange?: number;
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
  settlement?: number;
  limitUp?: number;
  limitDown?: number;
  avgPrice?: number;
}

export interface FutureKlineItem {
  time: number;
  volume: number;
  open: number;
  close: number;
  high: number;
  low: number;
  lastTime?: number;
  openInterest?: number;
  settlement?: number;
}

export interface FutureKline {
  nextPageToken?: string;
  items: FutureKlineItem[];
}

export interface FinancialDailyItem {
  symbol: string;
  field: string;
  date?: number;
  value?: number;
}

export interface FinancialReportItem {
  symbol: string;
  currency?: string;
  field: string;
  value?: string;
  filingDate?: string;
  periodEndDate?: string;
}

export interface CorporateAction {
  symbol: string;
  market?: string;
  exchange?: string;
  executeDate?: string;
  actionType?: string;
  recordDate?: string;
  announcedDate?: string;
  payDate?: string;
  amount?: number;
  currency?: string;
  fromFactor?: number;
  toFactor?: number;
}

export interface CorporateSymbolChange {
  symbol: string;
  market?: string;
  exchange?: string;
  executeDate?: string;
  actionType?: string;
  oldSymbol?: string;
  /** newSymbol is the ticker after the rename; same as symbol. */
  newSymbol?: string;
}

export interface CorporateDelisting {
  symbol: string;
  market?: string;
  exchange?: string;
  executeDate?: string;
  actionType?: string;
  announcedDate?: string;
  reason?: string;
}

export interface CorporateIPO {
  symbol: string;
  market?: string;
  exchange?: string;
  executeDate?: string;
  actionType?: string;
  ipoName?: string;
  listingDate?: string;
  listingPrice?: number;
  sharesOutstanding?: number;
  sharesFloat?: number;
  offerAmount?: number;
  priceRange?: string;
  currency?: string;
  minPurchaseQuantity?: number;
  leverageRatio?: number;
}

export interface CapitalFlowItem {
  time: string;
  timestamp: number;
  netInflow: number;
}

export interface CapitalFlow {
  symbol: string;
  period?: string;
  items: CapitalFlowItem[];
}

export interface CapitalDistribution {
  symbol: string;
  netInflow: number;
  inAll: number;
  inBig: number;
  inMid: number;
  inSmall: number;
  outAll: number;
  outBig: number;
  outMid: number;
  outSmall: number;
}

export interface ScannerDataRow {
  index: number;
  name: string;
  value?: string;
  data?: number;
}

export interface ScannerResultItem {
  symbol: string;
  market: string;
  baseDataList?: ScannerDataRow[];
  accumulateDataList?: ScannerDataRow[];
  financialDataList?: ScannerDataRow[];
  multiTagDataList?: ScannerDataRow[];
}

export interface ScannerResult {
  page: number;
  totalPage: number;
  totalCount: number;
  pageSize: number;
  cursorId?: string;
  items: ScannerResultItem[];
}

export interface QuotePermission {
  name: string;
  expireAt: number;
}

// === Request objects for complex endpoints ===

export interface FinancialDailyRequest {
  symbols: string[];
  market: string;
  fields: string[];
  beginDate: string;
  endDate: string;
}

/**
 * Financial report request.
 *
 * **Wire types (breaking):** `beginDate` / `endDate` are epoch-ms integers,
 * not date strings. Python SDK converts via `date_str_to_timestamp` before
 * sending; sending raw strings makes the gateway reject with
 * `biz param error(failed to parse parameters in 'biz_content')`.
 */
export interface FinancialReportRequest {
  symbols: string[];
  market: string;
  fields: string[];
  periodType: string;
  /** epoch-ms start time */
  beginDate?: number;
  /** epoch-ms end time */
  endDate?: number;
}

/**
 * Corporate action request.
 *
 * **Wire types (breaking):** `beginDate` / `endDate` are epoch-ms integers,
 * matching `FinancialReportRequest`. Server rejects string dates with
 * `biz param error(failed to parse parameters in 'biz_content')`.
 */
export interface CorporateActionRequest {
  symbols: string[];
  market: string;
  actionType: string;
  /** epoch-ms start time */
  beginDate?: number;
  /** epoch-ms end time */
  endDate?: number;
}

export interface FutureKlineRequest {
  contractCodes: string[];
  period: string;
  /** Use -1 for unbounded */
  beginTime: number;
  /** Use -1 for unbounded */
  endTime: number;
  limit?: number;
  pageToken?: string;
}

export interface MarketScannerRequest {
  market: string;
  page?: number;
  pageSize?: number;
  cursorId?: string;
  baseFilterList?: Array<Record<string, unknown>>;
  accumulateFilterList?: Array<Record<string, unknown>>;
  financialFilterList?: Array<Record<string, unknown>>;
  multiTagsFilterList?: Array<Record<string, unknown>>;
  sortFieldData?: Record<string, unknown>;
  multiTagsFields?: string[];
}

// ============================================================================
// Batch 3-5: extended response models (v0.4.0).
// ============================================================================

/** Symbol + name item (all_symbol_names). */
export interface SymbolName {
  symbol?: string;
  name?: string;
  market?: string;
}

/** Trade meta (quote_stock_trade). */
export interface TradeMeta {
  symbol?: string;
  lotSize?: number;
  minTick?: number;
  spreadScale?: number;
  shortableFlag?: string;
  marginableFlag?: string;
}

/** Stock detail (stock_detail). */
export interface StockDetail {
  symbol?: string;
  nameCN?: string;
  nameEN?: string;
  exchange?: string;
  market?: string;
  currency?: string;
  secType?: string;
  sector?: string;
  industry?: string;
  /** ms timestamp */
  listingDate?: number;
  marketCap?: number;
  circulationCap?: number;
  totalShares?: number;
  epsTtm?: number;
  peRatioTtm?: number;
}

/** Short interest data. */
export interface ShortInterest {
  symbol?: string;
  settlementDate?: string;
  shortInterest?: number;
  avgDailyVolume?: number;
  daysToCover?: number;
  percentOfFloat?: number;
  shortInterestPrevious?: number;
  percentChange?: number;
}

/** Broker detail inside a price level. */
export interface BrokerDetail {
  id?: string;
  name?: string;
}

/** A single broker-queue level. */
export interface StockBrokerItem {
  level?: number;
  price?: number;
  brokers?: BrokerDetail[];
}

/** Broker queue (stock_broker). */
export interface StockBroker {
  symbol?: string;
  levelAskList?: StockBrokerItem[];
  levelBidList?: StockBrokerItem[];
}

/** Stock industry classification (stock_industry). */
export interface StockIndustry {
  symbol?: string;
  gsector?: string;
  ggroup?: string;
  gind?: string;
  gsubind?: string;
  level?: string;
}

/** Trade rank row (trade_rank). */
export interface TradeRankItem {
  symbol?: string;
  name?: string;
  latestPrice?: number;
  change?: number;
  changeRate?: number;
  volume?: number;
  amount?: number;
}

/** K-line quota detail. */
export interface KlineQuotaDetail {
  symbol?: string;
  market?: string;
  usedBars?: number;
  quotaBars?: number;
  lastAccess?: number;
}

/** K-line quota (kline_quota). */
export interface KlineQuota {
  method?: string;
  used?: number;
  quota?: number;
  detail?: KlineQuotaDetail[];
}

/** Option historical-volatility time series point. */
export interface OptionVolatilityPoint {
  impliedVol?: number;
  percentile?: number;
  rank?: number;
  hisVolatility?: number;
  timestamp?: number;
}

/** Implied-volatility metric for a specific period. */
export interface ImpliedVolMetric {
  period?: string;
  percentile?: number;
  rank?: number;
}

/** Option analysis (option_analysis). */
export interface OptionAnalysis {
  symbol?: string;
  impliedVol30Days?: number;
  hisVolatility?: number;
  ivHisVRatio?: number;
  callPutRatio?: number;
  impliedVolMetric?: ImpliedVolMetric;
  volatilityList?: OptionVolatilityPoint[];
}

/** Option symbol listing (option_symbol). */
export interface OptionSymbol {
  symbol?: string;
  market?: string;
  nameCN?: string;
  nameEN?: string;
}

/** Historical futures main contract entry. */
export interface FutureMainContractHistory {
  contractCode?: string;
  symbol?: string;
  beginDate?: string;
  endDate?: string;
}

/** A single futures trading time segment. */
export interface FutureTradingSegment {
  /** ms timestamp */
  start?: number;
  end?: number;
  /** RTH / Night / Break */
  type?: string;
}

/** Futures trading session (future_trading_date). */
export interface FutureTradingTime {
  contractCode?: string;
  bizDate?: string;
  zone?: string;
  tradingTimes?: FutureTradingSegment[];
}

/** Futures tick-trade item (future_tick). */
export interface FutureTradeTickItem {
  contractCode?: string;
  index?: number;
  time?: number;
  price?: number;
  volume?: number;
  direction?: string;
}

/** Futures depth snapshot (future_depth). */
export interface FutureDepth {
  contractCode?: string;
  timestamp?: number;
  asks?: DepthLevel[];
  bids?: DepthLevel[];
}

/** Warrant brief (warrant_briefs). */
export interface WarrantBrief {
  symbol?: string;
  name?: string;
  latestPrice?: number;
  change?: number;
  changeRate?: number;
  volume?: number;
  amount?: number;
  underlying?: string;
  issuer?: string;
  expiryDate?: string;
  strikePrice?: number;
  warrantType?: string;
}

/** Warrant filter paged result (warrant_filter). */
export interface WarrantFilterResult {
  total?: number;
  items?: WarrantBrief[];
  pageSize?: number;
  page?: number;
}

/**
 * Industry list row (industry_list).
 *
 * **Wire fields (breaking):** the server returns `nameCN` / `nameEN` /
 * `industryLevel`, not `name` / `level` (matches Python SDK's
 * `IndustryListResponse` which reads `ind.get('nameCN')`,
 * `ind.get('nameEN')`, `ind.get('industryLevel')`).
 * Since responses come back already-camelCase (no snake→camel step) and the
 * server keeps `nameCN` / `nameEN` in mixed case, the fields are exposed
 * exactly as sent.
 *
 * `name` and `level` are backwards-compat aliases populated by
 * `getIndustryList` after the raw response is decoded — `name` mirrors
 * `nameEN || nameCN`, `level` mirrors `industryLevel`.
 */
export interface IndustryItem {
  id?: string;
  /** Chinese name. Wire: `nameCN`. */
  nameCN?: string;
  /** English name. Wire: `nameEN`. */
  nameEN?: string;
  /** Industry level. Wire: `industryLevel`. */
  industryLevel?: string;
  /** Convenience alias: `nameEN || nameCN`. Populated by `getIndustryList`. */
  name?: string;
  /** @deprecated Use `industryLevel`. Mirrored by `getIndustryList` for back-compat. */
  level?: string;
}

/** Stock belonging to an industry (industry_stock_list). */
export interface IndustryStock {
  symbol?: string;
  name?: string;
  industryId?: string;
  change?: number;
  changeRate?: number;
}

/** Trading calendar entry (trading_calendar). */
export interface TradingCalendarItem {
  market?: string;
  date?: string;
  isTrading?: boolean;
  sessionType?: string;
}

/** FX rate (financial_exchange_rate). */
export interface ExchangeRate {
  currency?: string;
  date?: string;
  rate?: number;
  baseCurrency?: string;
}

/** Financial currency per symbol (financial_currency). */
export interface FinancialCurrency {
  symbol?: string;
  market?: string;
  currency?: string;
}

/** Overnight quote (quote_overnight). */
export interface QuoteOvernight {
  symbol?: string;
  latestPrice?: number;
  askPrice?: number;
  askSize?: number;
  bidPrice?: number;
  bidSize?: number;
  preClose?: number;
  volume?: number;
  amount?: number;
  timestamp?: number;
  tradingStatus?: number;
  change?: number;
  changeRate?: number;
  amplitude?: number;
}

/** Single market-scanner tag. */
export interface MarketScannerTag {
  field?: string;
  name?: string;
  values?: string[];
}

/** Market-scanner tag group (one entry per market). wire: market_scanner_tags returns array of these. */
export interface MarketScannerTagGroup {
  market?: string;
  multiTagField?: string;
  tagList?: MarketScannerTag[];
}

/** @deprecated Use MarketScannerTagGroup[] instead. Kept for backwards compatibility. */
export type MarketScannerTags = MarketScannerTagGroup;

/** Fund contract info (fund_contracts). */
export interface FundContractInfo {
  symbol?: string;
  name?: string;
  currency?: string;
  fundType?: string;
  inception?: string;
  netAssetValue?: number;
  expenseRatio?: number;
}

/** Fund real-time NAV (fund_quote). */
export interface FundQuote {
  symbol?: string;
  latestNav?: number;
  change?: number;
  changeRate?: number;
  date?: string;
}

/** Fund historical NAV (fund_history_quote). */
export interface FundHistoryQuote {
  symbol?: string;
  date?: string;
  nav?: number;
}
