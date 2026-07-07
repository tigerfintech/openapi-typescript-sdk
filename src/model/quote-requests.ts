/**
 * Quote request interfaces (v0.4.0).
 *
 * 所有字段可选(用户调用时传一个空对象即可);字段名用 camelCase,
 * client 层通过 keysToSnakeCase 转成服务端 wire 真名的 snake_case。
 * **字段名设计规则:camelCase → snake_case 后必须等于服务端 wire 真名。**
 *
 * 参考 Go SDK model/quote_requests.go。
 */

// ============================================================================
// Batch 2 breaking signatures
// ============================================================================

/** Real-time stock quotes. wire: quote_real_time */
export interface BriefRequest {
  symbols?: string[];
  includeHourTrading?: boolean;
  secType?: string;
  lang?: string;
}

/** Order-book depth. wire: quote_depth */
export interface DepthQuoteRequest {
  symbols?: string[];
  market?: string;
  tradeSession?: string;
  lang?: string;
}

/** Tick-by-tick trades. wire: trade_tick */
export interface TradeTickRequest {
  symbols?: string[];
  beginIndex?: number;
  endIndex?: number;
  limit?: number;
  lang?: string;
}

/** Real-time futures quotes. wire: future_brief */
export interface FutureBriefRequest {
  contractCodes?: string[];
  lang?: string;
}

// ============================================================================
// Batch 3: stock basics + time series
// ============================================================================

/** All symbols / symbol names. wire: all_symbols / all_symbol_names */
export interface SymbolsRequest {
  market?: string;
  secType?: string;
  includeOtc?: boolean;
  lang?: string;
}

/** Trade meta (lot size / tick size / shortable). wire: quote_stock_trade */
export interface TradeMetasRequest {
  symbols?: string[];
  lang?: string;
}

/** Stock details. wire: stock_detail. Server returns {items:[...]}. */
export interface StockDetailsRequest {
  symbols?: string[];
  secType?: string;
  lang?: string;
}

/** Delayed stock briefs. wire: quote_delay */
export interface StockDelayBriefsRequest {
  symbols?: string[];
  secType?: string;
  lang?: string;
}

/** K-line request. wire: kline
 * BeginTime/EndTime (ms) and BeginIndex/EndIndex are mutually exclusive.
 */
export interface KlineRequest {
  symbols?: string[];
  period?: string;
  right?: string;
  beginTime?: number;
  endTime?: number;
  limit?: number;
  beginIndex?: number;
  endIndex?: number;
  pageToken?: string;
  tradeSession?: string;
  date?: string;
  withFundamental?: boolean;
  secType?: string;
  lang?: string;
}

/** K-line client-side pagination wrapper. */
export interface KlineByPageRequest {
  symbol?: string;
  period?: string;
  beginTime?: number;
  endTime?: number;
  totalSize?: number;
  pageSize?: number;
  right?: string;
  lang?: string;
  tradeSession?: string;
}

/** Historical intraday timeline. wire: history_timeline */
export interface TimelineHistoryRequest {
  symbols?: string[];
  /** yyyy-MM-dd */
  date?: string;
  right?: string;
  tradeSession?: string;
  lang?: string;
}

/** Trade rank (top movers / volume). wire: trade_rank */
export interface TradeRankRequest {
  market?: string;
  lang?: string;
}

/** Short interest. wire: quote_shortable_stocks */
export interface ShortInterestRequest {
  symbols?: string[];
  lang?: string;
}

/** Broker queue. wire: stock_broker */
export interface StockBrokerRequest {
  symbol?: string;
  limit?: number;
  secType?: string;
  lang?: string;
}

/** Stock fundamentals. wire: stock_fundamental */
export interface StockFundamentalRequest {
  symbols?: string[];
  market?: string;
  secType?: string;
  lang?: string;
}

/** Stock industry classification. wire: stock_industry */
export interface StockIndustryRequest {
  symbol?: string;
  market?: string;
  secType?: string;
  lang?: string;
}

/** K-line quota. wire: kline_quota */
export interface KlineQuotaRequest {
  withDetails?: boolean;
  lang?: string;
}

/** Quote permission detail. wire: get_quote_permission */
export interface QuotePermissionRequest {
  beginDate?: string;
  endDate?: string;
  lang?: string;
}

// ============================================================================
// Batch 4: options / futures
// ============================================================================

/** Nested option query item used by option_query / option_basic / contracts. */
export interface OptionQueryItem {
  symbol?: string;
  expiry?: number;
  strike?: string;
  right?: string;
  period?: string;
  beginTime?: number;
  endTime?: number;
  limit?: number;
  beginIndex?: number;
  endIndex?: number;
  pageToken?: string;
}

/** Option tick trades. wire: option_trade_tick */
export interface OptionTradeTicksRequest {
  contracts?: OptionQueryItem[];
  lang?: string;
}

/** Option intraday timeline. wire: option_timeline */
export interface OptionTimelineRequest {
  optionQuery?: OptionQueryItem[];
  market?: string;
  lang?: string;
}

/** Option order-book depth. wire: option_depth */
export interface OptionDepthRequest {
  optionBasic?: OptionQueryItem[];
  market?: string;
  lang?: string;
}

/** Available option symbols. wire: option_symbol */
export interface OptionSymbolsRequest {
  market?: string;
  lang?: string;
}

/** Option analysis (volatility). wire: option_analysis */
export interface OptionAnalysisRequest {
  symbols?: string[];
  market?: string;
  period?: string;
  requireVolatilityList?: boolean;
  lang?: string;
}

/** Lookup a futures contract by code. wire: future_contract_by_contract_code / future_current_contract */
export interface FutureContractSingleRequest {
  contractCode?: string;
  type?: string;
  lang?: string;
}

/** List all futures contracts. wire: future_contracts */
export interface AllFutureContractsRequest {
  type?: string;
  exchange?: string;
  lang?: string;
}

/** Continuous main contracts. wire: future_continuous_contracts */
export interface FutureContinuousContractsRequest {
  type?: string;
  lang?: string;
}

/** Historical main contracts. wire: future_main_contract */
export interface FutureHistoryMainContractRequest {
  contractCodes?: string[];
  beginTime?: number;
  endTime?: number;
  lang?: string;
}

/** Futures K-line request. wire: future_kline */
export interface FutureKlineRequest {
  contractCodes?: string[];
  contractCode?: string;
  period?: string;
  beginTime?: number;
  endTime?: number;
  beginIndex?: number;
  endIndex?: number;
  limit?: number;
  pageToken?: string;
  lang?: string;
}

/** Futures K-line client-side pagination wrapper. */
export interface FutureKlineByPageRequest {
  contractCode?: string;
  period?: string;
  beginTime?: number;
  endTime?: number;
  totalSize?: number;
  pageSize?: number;
  lang?: string;
}

/** Futures tick trades. wire: future_tick (v3.0) */
export interface FutureTradeTicksRequest {
  contractCode?: string;
  beginIndex?: number;
  endIndex?: number;
  limit?: number;
  lang?: string;
}

/** Futures depth. wire: future_depth */
export interface FutureDepthRequest {
  contractCodes?: string[];
  lang?: string;
}

/** Futures trading session times. wire: future_trading_date */
export interface FutureTradingTimesRequest {
  contractCode?: string;
  tradingDate?: string;
  lang?: string;
}

// ============================================================================
// Batch 5: fund / warrant / industry / corporate / financial / calendar
// ============================================================================

/** Fund symbols. wire: fund_all_symbols */
export interface FundSymbolsRequest {
  lang?: string;
}

/** Fund contracts. wire: fund_contracts */
export interface FundContractsRequest {
  symbols?: string[];
  lang?: string;
}

/** Fund real-time NAV. wire: fund_quote */
export interface FundQuoteRequest {
  symbols?: string[];
  lang?: string;
}

/** Fund historical NAV. wire: fund_history_quote */
export interface FundHistoryQuoteRequest {
  symbols?: string[];
  beginTime?: number;
  endTime?: number;
  limit?: number;
  lang?: string;
}

/** Warrant briefs. wire: warrant_briefs */
export interface WarrantBriefsRequest {
  symbols?: string[];
  lang?: string;
}

/** Warrant filter (paginated). wire: warrant_filter */
export interface WarrantFilterRequest {
  symbol?: string;
  page?: number;
  pageSize?: number;
  sortFieldName?: string;
  sortDir?: string;
  issuerName?: string;
  expireYm?: string;
  lang?: string;
}

/** Industry list. wire: industry_list */
export interface IndustryListRequest {
  /** IndustryLevel enum value */
  industryLevel?: string;
  lang?: string;
}

/** Stocks in an industry. wire: industry_stock_list */
export interface IndustryStocksRequest {
  industryId?: string;
  market?: string;
  lang?: string;
}

/** Trading calendar. wire: trading_calendar */
export interface TradingCalendarRequest {
  market?: string;
  /** yyyy-MM-dd */
  beginDate?: string;
  endDate?: string;
  lang?: string;
}

/** FX rates. wire: financial_exchange_rate */
export interface FinancialExchangeRateRequest {
  currencyList?: string[];
  /** yyyyMMdd */
  beginDate?: string;
  endDate?: string;
  timezone?: string;
  lang?: string;
}

/** Financial currency per symbol. wire: financial_currency */
export interface FinancialCurrencyRequest {
  symbols?: string[];
  market?: string;
  lang?: string;
}

/** Market scanner tags. wire: market_scanner_tags */
export interface MarketScannerTagsRequest {
  market?: string;
  /** wire: multi_tag_field_list */
  multiTagFieldList?: string[];
  lang?: string;
}

/** Overnight quote. wire: quote_overnight */
export interface QuoteOvernightRequest {
  symbols?: string[];
  lang?: string;
}
