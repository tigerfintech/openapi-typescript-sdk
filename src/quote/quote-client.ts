/**
 * QuoteClient — market-data client.
 *
 * All methods return strongly-typed responses from the `model` package.
 * Request parameters are written in camelCase in TypeScript and are
 * converted to snake_case on the wire automatically.
 */
import type { HttpClient } from '../client/http-client';
import { createApiRequest } from '../client/api-request';
import { unmarshalData } from '../client/api-response';
import type {
  MarketState,
  Brief,
  Kline,
  KlineItem,
  Timeline,
  TradeTick,
  Depth,
  OptionExpiration,
  OptionChain,
  FutureExchange,
  FutureContractInfo,
  FutureQuote,
  FutureKline,
  FutureKlineItem,
  FinancialDailyItem,
  FinancialReportItem,
  CorporateAction,
  CapitalFlow,
  CapitalDistribution,
  ScannerResult,
  QuotePermission,
  FinancialDailyRequest,
  FinancialReportRequest,
  CorporateActionRequest,
  FutureKlineRequest,
  MarketScannerRequest,
  SymbolName,
  TradeMeta,
  StockDetail,
  StockBroker,
  StockIndustry,
  TradeRankItem,
  ShortInterest,
  KlineQuota,
  OptionAnalysis,
  OptionSymbol,
  FutureMainContractHistory,
  FutureTradingTime,
  FutureTradeTickItem,
  FutureDepth,
  WarrantBrief,
  WarrantFilterResult,
  IndustryItem,
  IndustryStock,
  TradingCalendarItem,
  ExchangeRate,
  FinancialCurrency,
  QuoteOvernight,
  MarketScannerTags,
  FundContractInfo,
  FundQuote,
  FundHistoryQuote,
} from '../model/quote';
import type {
  BriefRequest,
  DepthQuoteRequest,
  TradeTickRequest,
  FutureBriefRequest,
  SymbolsRequest,
  TradeMetasRequest,
  StockDetailsRequest,
  StockDelayBriefsRequest,
  BarsRequest,
  BarsByPageRequest,
  TimelineHistoryRequest,
  TradeRankRequest,
  ShortInterestRequest,
  StockBrokerRequest,
  StockFundamentalRequest,
  StockIndustryRequest,
  KlineQuotaRequest,
  QuotePermissionRequest,
  OptionBarsRequest,
  OptionTradeTicksRequest,
  OptionTimelineRequest,
  OptionDepthRequest,
  OptionSymbolsRequest,
  OptionAnalysisRequest,
  FutureContractSingleRequest,
  AllFutureContractsRequest,
  FutureContinuousContractsRequest,
  FutureHistoryMainContractRequest,
  FutureBarsRequest,
  FutureBarsByPageRequest,
  FutureTradeTicksRequest,
  FutureDepthRequest,
  FutureTradingTimesRequest,
  FundSymbolsRequest,
  FundContractsRequest,
  FundQuoteRequest,
  FundHistoryQuoteRequest,
  WarrantBriefsRequest,
  WarrantFilterRequest,
  IndustryListRequest,
  IndustryStocksRequest,
  TradingCalendarRequest,
  FinancialExchangeRateRequest,
  FinancialCurrencyRequest,
  MarketScannerTagsRequest,
  QuoteOvernightRequest,
} from '../model/quote-requests';

/**
 * Parse an OCC-style option identifier like "AAPL  260619C00150000"
 * into its component parts.
 */
export function parseOptionIdentifier(identifier: string): {
  symbol: string;
  expiryMs: number;
  right: string;
  strike: number;
} {
  const trimmed = identifier.trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) {
    throw new Error(`invalid option identifier: ${identifier}`);
  }
  const symbol = trimmed.substring(0, spaceIdx);
  const rest = trimmed.substring(spaceIdx + 1).trim();
  if (rest.length < 15) {
    throw new Error(`option code too short: ${rest}`);
  }
  const datePart = rest.substring(0, 6);
  const rightChar = rest.substring(6, 7);
  const strikePart = rest.substring(7);

  const yy = parseInt(datePart.substring(0, 2), 10);
  const mm = parseInt(datePart.substring(2, 4), 10);
  const dd = parseInt(datePart.substring(4, 6), 10);
  const expiryMs = Date.UTC(2000 + yy, mm - 1, dd);

  const right = rightChar === 'C' ? 'CALL' : rightChar === 'P' ? 'PUT' : '';
  if (!right) throw new Error(`invalid right character: ${rightChar}`);

  const strikeInt = parseInt(strikePart, 10);
  if (Number.isNaN(strikeInt)) throw new Error(`invalid strike digits: ${strikePart}`);
  const strike = strikeInt / 1000;

  return { symbol, expiryMs, right, strike };
}

/** Market data client wrapping all quote-related APIs. */
export class QuoteClient {
  private httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  private async callInto<T>(method: string, bizParams?: unknown, version?: string): Promise<T> {
    const request = createApiRequest(method, bizParams, version);
    const response = await this.httpClient.executeRequest(request);
    return unmarshalData<T>(response.data) as T;
  }

  /**
   * Some endpoints return either a list or a single object depending on the
   * server response shape (future_contract_by_contract_code /
   * future_continuous_contracts). Unify into an array.
   */
  private async callIntoListOrObject<T>(method: string, bizParams: unknown, version?: string): Promise<T[]> {
    const raw = await this.callInto<T[] | T | null | undefined>(method, bizParams, version);
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw;
    return [raw as T];
  }

  /** Unwrap server {"items":[...]} envelope. */
  private async callIntoItems<T>(method: string, bizParams: unknown, version?: string): Promise<T[]> {
    const wrap = await this.callInto<{ items?: T[] } | null>(method, bizParams, version);
    return wrap?.items ?? [];
  }

  // === Basic market data ===

  async getMarketState(market: string): Promise<MarketState[]> {
    return this.callInto<MarketState[]>('market_state', { market });
  }

  /** Real-time stock briefs. wire: quote_real_time */
  async getBrief(req: BriefRequest): Promise<Brief[]> {
    return this.callInto<Brief[]>('quote_real_time', req);
  }

  async getKline(symbol: string, period: string): Promise<Kline[]> {
    return this.callInto<Kline[]>('kline', { symbols: [symbol], period });
  }

  async getTimeline(symbols: string[]): Promise<Timeline[]> {
    return this.callInto<Timeline[]>('timeline', { symbols });
  }

  /** Tick-by-tick trades. wire: trade_tick */
  async getTradeTick(req: TradeTickRequest): Promise<TradeTick[]> {
    return this.callInto<TradeTick[]>('trade_tick', req);
  }

  /** Depth snapshot. wire: quote_depth */
  async getQuoteDepth(req: DepthQuoteRequest): Promise<Depth[]> {
    return this.callInto<Depth[]>('quote_depth', req);
  }

  // === Options ===

  async getOptionExpiration(symbol: string): Promise<OptionExpiration[]> {
    return this.callInto<OptionExpiration[]>('option_expiration', { symbols: [symbol] });
  }

  /** Option chain; `expiry` is "YYYY-MM-DD". */
  async getOptionChain(symbol: string, expiry: string): Promise<OptionChain[]> {
    const d = new Date(expiry + 'T00:00:00Z');
    const expiryMs = d.getTime();
    if (Number.isNaN(expiryMs)) {
      throw new Error(`invalid expiry date, expected YYYY-MM-DD: ${expiry}`);
    }
    return this.callInto<OptionChain[]>(
      'option_chain',
      { option_basic: [{ symbol, expiry: expiryMs }] },
      '3.0',
    );
  }

  async getOptionBrief(identifiers: string[]): Promise<Brief[]> {
    const optionBasic = identifiers.map((id) => {
      const p = parseOptionIdentifier(id);
      return { symbol: p.symbol, expiry: p.expiryMs, right: p.right, strike: p.strike };
    });
    return this.callInto<Brief[]>('option_brief', { option_basic: optionBasic }, '2.0');
  }

  async getOptionKline(identifier: string, period: string): Promise<Kline[]> {
    const p = parseOptionIdentifier(identifier);
    return this.callInto<Kline[]>(
      'option_kline',
      {
        option_query: [{ symbol: p.symbol, expiry: p.expiryMs, right: p.right, strike: p.strike, period }],
      },
      '2.0',
    );
  }

  // === Futures ===

  async getFutureExchange(): Promise<FutureExchange[]> {
    return this.callInto<FutureExchange[]>('future_exchange', { secType: 'FUT' });
  }

  async getFutureContracts(exchange: string): Promise<FutureContractInfo[]> {
    return this.callInto<FutureContractInfo[]>(
      'future_contract_by_exchange_code',
      { exchangeCode: exchange },
    );
  }

  /** Real-time futures quotes. wire: future_real_time_quote */
  async getFutureRealTimeQuote(req: FutureBriefRequest): Promise<FutureQuote[]> {
    return this.callInto<FutureQuote[]>('future_real_time_quote', req);
  }

  /** Futures K-line; use -1 for unbounded beginTime / endTime. */
  async getFutureKline(req: FutureKlineRequest): Promise<FutureKline[]> {
    const body: FutureKlineRequest = {
      ...req,
      beginTime: req.beginTime ?? -1,
      endTime: req.endTime ?? -1,
    };
    return this.callInto<FutureKline[]>('future_kline', body);
  }

  // === Fundamentals ===

  async getFinancialDaily(req: FinancialDailyRequest): Promise<FinancialDailyItem[]> {
    return this.callInto<FinancialDailyItem[]>('financial_daily', req);
  }

  async getFinancialReport(req: FinancialReportRequest): Promise<FinancialReportItem[]> {
    return this.callInto<FinancialReportItem[]>('financial_report', req);
  }

  /**
   * Corporate actions. Server returns {symbol: [...]}, this method flattens into a single list.
   */
  async getCorporateAction(req: CorporateActionRequest): Promise<CorporateAction[]> {
    const grouped = await this.callInto<Record<string, CorporateAction[]>>('corporate_action', req);
    if (!grouped || typeof grouped !== 'object') return [];
    return Object.values(grouped).flat();
  }

  // === Capital flow ===

  async getCapitalFlow(symbol: string, market: string, period: string): Promise<CapitalFlow | undefined> {
    return this.callInto<CapitalFlow>('capital_flow', { symbol, market, period });
  }

  async getCapitalDistribution(symbol: string, market: string): Promise<CapitalDistribution | undefined> {
    return this.callInto<CapitalDistribution>('capital_distribution', { symbol, market });
  }

  // === Scanner & permission ===

  async marketScanner(req: MarketScannerRequest): Promise<ScannerResult | undefined> {
    return this.callInto<ScannerResult>('market_scanner', req);
  }

  async grabQuotePermission(): Promise<QuotePermission[]> {
    return this.callInto<QuotePermission[]>('grab_quote_permission');
  }

  // ==========================================================================
  // Batch 3: stock basics + time series
  // ==========================================================================

  /** All symbol codes (string list). wire: all_symbols */
  async getSymbols(req: SymbolsRequest): Promise<string[]> {
    return this.callInto<string[]>('all_symbols', req);
  }

  /** All symbols with names. wire: all_symbol_names */
  async getSymbolNames(req: SymbolsRequest): Promise<SymbolName[]> {
    return this.callInto<SymbolName[]>('all_symbol_names', req);
  }

  /** Trade meta (lot size / tick size). wire: quote_stock_trade */
  async getTradeMetas(req: TradeMetasRequest): Promise<TradeMeta[]> {
    return this.callInto<TradeMeta[]>('quote_stock_trade', req);
  }

  /** Stock details. wire: stock_detail. Server returns {items:[...]}. */
  async getStockDetails(req: StockDetailsRequest): Promise<StockDetail[]> {
    return this.callIntoItems<StockDetail>('stock_detail', req);
  }

  /** Delayed stock briefs. wire: quote_delay */
  async getStockDelayBriefs(req: StockDelayBriefsRequest): Promise<Brief[]> {
    return this.callInto<Brief[]>('quote_delay', req);
  }

  /** K-line bars (full request). wire: kline */
  async getBars(req: BarsRequest): Promise<Kline[]> {
    return this.callInto<Kline[]>('kline', req);
  }

  /**
   * Client-side paginated K-line fetch — loops over getBars until TotalSize
   * bars are collected. Items are returned oldest-first, matching
   * Python/Go get_bars_by_page behaviour.
   */
  async getBarsByPage(req: BarsByPageRequest): Promise<KlineItem[]> {
    const pageSize = req.pageSize && req.pageSize > 0 ? req.pageSize : 200;
    const totalSize = req.totalSize && req.totalSize > 0 ? req.totalSize : 1000;
    let beginTime = req.beginTime ?? -1;
    let endTime = req.endTime ?? -1;
    if (beginTime === 0) beginTime = -1;
    if (endTime === 0) endTime = -1;

    const acc: KlineItem[] = [];
    while (acc.length < totalSize) {
      const sub: BarsRequest = {
        symbols: req.symbol ? [req.symbol] : undefined,
        period: req.period,
        right: req.right,
        beginTime,
        endTime,
        limit: pageSize,
        tradeSession: req.tradeSession,
        lang: req.lang,
      };
      const pageOut = await this.callInto<Kline[]>('kline', sub);
      if (!pageOut || pageOut.length === 0 || !pageOut[0].items || pageOut[0].items.length === 0) {
        break;
      }
      const items = pageOut[0].items;
      acc.push(...items);
      if (items.length < pageSize) break;
      // next page endTime = oldest bar time - 1
      let oldest = items[0].time;
      for (const it of items) {
        if (it.time < oldest) oldest = it.time;
      }
      endTime = oldest - 1;
    }
    return acc;
  }

  /** Historical intraday timeline. wire: history_timeline */
  async getTimelineHistory(req: TimelineHistoryRequest): Promise<Timeline[]> {
    return this.callInto<Timeline[]>('history_timeline', req);
  }

  /** Trade rank (top movers / volume). wire: trade_rank */
  async getTradeRank(req: TradeRankRequest): Promise<TradeRankItem[]> {
    return this.callInto<TradeRankItem[]>('trade_rank', req);
  }

  /** Short interest / shortable. wire: quote_shortable_stocks */
  async getShortInterest(req: ShortInterestRequest): Promise<ShortInterest[]> {
    return this.callInto<ShortInterest[]>('quote_shortable_stocks', req);
  }

  /** Broker queue. wire: stock_broker */
  async getStockBroker(req: StockBrokerRequest): Promise<StockBroker | undefined> {
    return this.callInto<StockBroker>('stock_broker', req);
  }

  /** Stock fundamentals (server returns grouped map). wire: stock_fundamental */
  async getStockFundamental(req: StockFundamentalRequest): Promise<Record<string, unknown>> {
    const out = await this.callInto<Record<string, unknown>>('stock_fundamental', req);
    return out ?? {};
  }

  /** Stock industry classification (array). wire: stock_industry */
  async getStockIndustry(req: StockIndustryRequest): Promise<StockIndustry[]> {
    return this.callInto<StockIndustry[]>('stock_industry', req);
  }

  /** Quote permission detail. wire: get_quote_permission */
  async getQuotePermission(req: QuotePermissionRequest): Promise<QuotePermission[]> {
    return this.callInto<QuotePermission[]>('get_quote_permission', req);
  }

  /** K-line quota usage. wire: kline_quota */
  async getKlineQuota(req: KlineQuotaRequest): Promise<KlineQuota[]> {
    return this.callInto<KlineQuota[]>('kline_quota', req);
  }

  // ==========================================================================
  // Batch 4: option / future extensions
  // ==========================================================================

  /** Option K-line. wire: option_kline (v2.0) */
  async getOptionBars(req: OptionBarsRequest): Promise<Kline[]> {
    return this.callInto<Kline[]>('option_kline', req, '2.0');
  }

  /** Option tick trades. wire: option_trade_tick */
  async getOptionTradeTicks(req: OptionTradeTicksRequest): Promise<TradeTick[]> {
    return this.callInto<TradeTick[]>('option_trade_tick', req);
  }

  /** Option intraday timeline. wire: option_timeline */
  async getOptionTimeline(req: OptionTimelineRequest): Promise<Timeline[]> {
    return this.callInto<Timeline[]>('option_timeline', req);
  }

  /** Option depth. wire: option_depth */
  async getOptionDepth(req: OptionDepthRequest): Promise<Depth[]> {
    return this.callInto<Depth[]>('option_depth', req);
  }

  /** Available option symbols. wire: option_symbol */
  async getOptionSymbols(req: OptionSymbolsRequest): Promise<OptionSymbol[]> {
    return this.callInto<OptionSymbol[]>('option_symbol', req);
  }

  /** Option analysis (volatility). wire: option_analysis */
  async getOptionAnalysis(req: OptionAnalysisRequest): Promise<OptionAnalysis[]> {
    return this.callInto<OptionAnalysis[]>('option_analysis', req);
  }

  /** Single futures contract by code. wire: future_contract_by_contract_code */
  async getFutureContract(req: FutureContractSingleRequest): Promise<FutureContractInfo[]> {
    return this.callIntoListOrObject<FutureContractInfo>('future_contract_by_contract_code', req);
  }

  /** All futures contracts. wire: future_contracts */
  async getAllFutureContracts(req: AllFutureContractsRequest): Promise<FutureContractInfo[]> {
    return this.callInto<FutureContractInfo[]>('future_contracts', req);
  }

  /** Current main contract. wire: future_current_contract */
  async getCurrentFutureContract(req: FutureContractSingleRequest): Promise<FutureContractInfo | undefined> {
    return this.callInto<FutureContractInfo>('future_current_contract', req);
  }

  /** Continuous main contracts. wire: future_continuous_contracts */
  async getFutureContinuousContracts(req: FutureContinuousContractsRequest): Promise<FutureContractInfo[]> {
    return this.callIntoListOrObject<FutureContractInfo>('future_continuous_contracts', req);
  }

  /** Historical main contracts. wire: future_main_contract */
  async getFutureHistoryMainContract(req: FutureHistoryMainContractRequest): Promise<FutureMainContractHistory[]> {
    return this.callInto<FutureMainContractHistory[]>('future_main_contract', req);
  }

  /**
   * Futures K-line (full request with index pagination). wire: future_kline
   * begin_time / end_time default to -1 when unset (server requires them present).
   */
  async getFutureBars(req: FutureBarsRequest): Promise<FutureKline[]> {
    const body: FutureBarsRequest = {
      ...req,
      beginTime: req.beginTime ?? -1,
      endTime: req.endTime ?? -1,
    };
    return this.callInto<FutureKline[]>('future_kline', body);
  }

  /** Client-side paginated futures K-line fetch. */
  async getFutureBarsByPage(req: FutureBarsByPageRequest): Promise<FutureKlineItem[]> {
    const pageSize = req.pageSize && req.pageSize > 0 ? req.pageSize : 200;
    const totalSize = req.totalSize && req.totalSize > 0 ? req.totalSize : 1000;
    let beginTime = req.beginTime ?? -1;
    let endTime = req.endTime ?? -1;
    if (beginTime === 0) beginTime = -1;
    if (endTime === 0) endTime = -1;

    const acc: FutureKlineItem[] = [];
    while (acc.length < totalSize) {
      const sub: FutureBarsRequest = {
        contractCode: req.contractCode,
        period: req.period,
        beginTime,
        endTime,
        limit: pageSize,
        lang: req.lang,
      };
      const pageOut = await this.callInto<FutureKline[]>('future_kline', sub);
      if (!pageOut || pageOut.length === 0 || !pageOut[0].items || pageOut[0].items.length === 0) {
        break;
      }
      const items = pageOut[0].items;
      acc.push(...items);
      if (items.length < pageSize) break;
      let oldest = items[0].time;
      for (const it of items) {
        if (it.time < oldest) oldest = it.time;
      }
      endTime = oldest - 1;
    }
    return acc;
  }

  /** Futures tick trades. wire: future_tick (API v3.0) */
  async getFutureTradeTicks(req: FutureTradeTicksRequest): Promise<FutureTradeTickItem[]> {
    return this.callInto<FutureTradeTickItem[]>('future_tick', req, '3.0');
  }

  /** Futures depth. wire: future_depth */
  async getFutureDepth(req: FutureDepthRequest): Promise<FutureDepth[]> {
    return this.callInto<FutureDepth[]>('future_depth', req);
  }

  /** Futures trading times (single-object response). wire: future_trading_date */
  async getFutureTradingTimes(req: FutureTradingTimesRequest): Promise<FutureTradingTime | undefined> {
    return this.callInto<FutureTradingTime>('future_trading_date', req);
  }

  // ==========================================================================
  // Batch 5: fund / warrant / industry / corporate / financial / calendar
  // ==========================================================================

  /** Fund symbols. wire: fund_all_symbols */
  async getFundSymbols(req: FundSymbolsRequest): Promise<string[]> {
    return this.callInto<string[]>('fund_all_symbols', req);
  }

  /** Fund contracts. wire: fund_contracts */
  async getFundContracts(req: FundContractsRequest): Promise<FundContractInfo[]> {
    return this.callInto<FundContractInfo[]>('fund_contracts', req);
  }

  /** Fund real-time NAV. wire: fund_quote */
  async getFundQuote(req: FundQuoteRequest): Promise<FundQuote[]> {
    return this.callInto<FundQuote[]>('fund_quote', req);
  }

  /** Fund historical NAV. wire: fund_history_quote */
  async getFundHistoryQuote(req: FundHistoryQuoteRequest): Promise<FundHistoryQuote[]> {
    return this.callInto<FundHistoryQuote[]>('fund_history_quote', req);
  }

  /** Warrant briefs. wire: warrant_briefs */
  async getWarrantBriefs(req: WarrantBriefsRequest): Promise<WarrantBrief[]> {
    return this.callInto<WarrantBrief[]>('warrant_briefs', req);
  }

  /** Warrant filter (paged). wire: warrant_filter */
  async getWarrantFilter(req: WarrantFilterRequest): Promise<WarrantFilterResult | undefined> {
    return this.callInto<WarrantFilterResult>('warrant_filter', req);
  }

  /** Industry list. wire: industry_list */
  async getIndustryList(req: IndustryListRequest): Promise<IndustryItem[]> {
    return this.callInto<IndustryItem[]>('industry_list', req);
  }

  /** Stocks inside an industry. wire: industry_stock_list */
  async getIndustryStocks(req: IndustryStocksRequest): Promise<IndustryStock[]> {
    return this.callInto<IndustryStock[]>('industry_stock_list', req);
  }

  /** Corporate split (flattened). wire: corporate_action (action_type=split) */
  async getCorporateSplit(req: CorporateActionRequest): Promise<CorporateAction[]> {
    const body: CorporateActionRequest = { ...req, actionType: 'split' };
    const grouped = await this.callInto<Record<string, CorporateAction[]>>('corporate_action', body);
    if (!grouped || typeof grouped !== 'object') return [];
    return Object.values(grouped).flat();
  }

  /** Corporate dividend (flattened). wire: corporate_action (action_type=dividend) */
  async getCorporateDividend(req: CorporateActionRequest): Promise<CorporateAction[]> {
    const body: CorporateActionRequest = { ...req, actionType: 'dividend' };
    const grouped = await this.callInto<Record<string, CorporateAction[]>>('corporate_action', body);
    if (!grouped || typeof grouped !== 'object') return [];
    return Object.values(grouped).flat();
  }

  /** Corporate earnings calendar (flattened). wire: corporate_action (action_type=earning) */
  async getCorporateEarningsCalendar(req: CorporateActionRequest): Promise<CorporateAction[]> {
    const body: CorporateActionRequest = { ...req, actionType: 'earning' };
    const grouped = await this.callInto<Record<string, CorporateAction[]>>('corporate_action', body);
    if (!grouped || typeof grouped !== 'object') return [];
    return Object.values(grouped).flat();
  }

  /** Financial currency per symbol. wire: financial_currency */
  async getFinancialCurrency(req: FinancialCurrencyRequest): Promise<FinancialCurrency[]> {
    return this.callInto<FinancialCurrency[]>('financial_currency', req);
  }

  /** FX rates. wire: financial_exchange_rate */
  async getFinancialExchangeRate(req: FinancialExchangeRateRequest): Promise<ExchangeRate[]> {
    return this.callInto<ExchangeRate[]>('financial_exchange_rate', req);
  }

  /** Trading calendar. wire: trading_calendar */
  async getTradingCalendar(req: TradingCalendarRequest): Promise<TradingCalendarItem[]> {
    return this.callInto<TradingCalendarItem[]>('trading_calendar', req);
  }

  /** Available market-scanner tags. wire: market_scanner_tags */
  async getMarketScannerTags(req: MarketScannerTagsRequest): Promise<MarketScannerTags | undefined> {
    return this.callInto<MarketScannerTags>('market_scanner_tags', req);
  }

  /** Overnight quote. wire: quote_overnight */
  async getQuoteOvernight(req: QuoteOvernightRequest): Promise<QuoteOvernight[]> {
    return this.callInto<QuoteOvernight[]>('quote_overnight', req);
  }
}
