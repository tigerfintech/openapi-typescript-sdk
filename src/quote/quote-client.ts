/**
 * QuoteClient — market-data client.
 *
 * All methods return strongly-typed responses from the `model` package.
 * Request parameters are written in camelCase in TypeScript and are
 * converted to snake_case on the wire automatically.
 */
import { HttpClient } from '../client/http-client';
import type { ClientConfig } from '../config/client-config';
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
  OptionChainFilter,
  FutureExchange,
  FutureContractInfo,
  FutureQuote,
  FutureKline,
  FutureKlineItem,
  FinancialDailyItem,
  FinancialReportItem,
  CorporateAction,
  CorporateSymbolChange,
  CorporateDelisting,
  CorporateIPO,
  CapitalFlow,
  CapitalDistribution,
  ScannerResult,
  QuotePermission,
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
  MarketScannerTagGroup,
  FundContractInfo,
  FundQuote,
  FundHistoryQuote,
  FinancialDailyRequest,
  FinancialReportRequest,
  CorporateActionRequest,
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
  KlineRequest,
  KlineByPageRequest,
  TimelineHistoryRequest,
  TradeRankRequest,
  ShortInterestRequest,
  StockBrokerRequest,
  StockFundamentalRequest,
  StockIndustryRequest,
  KlineQuotaRequest,
  QuotePermissionRequest,
  OptionTradeTicksRequest,
  OptionTimelineRequest,
  OptionDepthRequest,
  OptionSymbolsRequest,
  OptionAnalysisRequest,
  FutureContractSingleRequest,
  AllFutureContractsRequest,
  FutureContinuousContractsRequest,
  FutureHistoryMainContractRequest,
  FutureKlineRequest,
  FutureKlineByPageRequest,
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
 * resolveOptionTimezone returns the timezone string to use for expiry conversion.
 * Explicit tz takes precedence; otherwise infer from symbol (.HK suffix → Asia/Hong_Kong, else America/New_York).
 */
function resolveOptionTimezone(tz: string | undefined, symbol: string): string {
  if (tz) return tz;
  return symbol.toUpperCase().endsWith('.HK') ? 'Asia/Hong_Kong' : 'America/New_York';
}

/**
 * Convert a "YYYY-MM-DD" date string to the Unix timestamp (ms) of local midnight
 * in the given IANA timezone.
 *
 * Strategy: use Intl.DateTimeFormat to determine what UTC time corresponds to
 * local midnight in the target timezone, correctly handling DST.
 */
function localMidnightMs(dateStr: string, timezone: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Use noon UTC as a safe anchor (avoids DST ambiguity right at midnight)
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  // Determine what hour/minute/second UTC noon appears as in the target timezone
  const timeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(noonUtc);
  const h = parseInt(timeParts.find(p => p.type === 'hour')!.value, 10);
  const m = parseInt(timeParts.find(p => p.type === 'minute')!.value, 10);
  const s = parseInt(timeParts.find(p => p.type === 'second')!.value, 10);
  // UTC offset at noon = 12:00:00 UTC − local time shown for noon UTC
  // Local midnight = noon UTC − 12h + offset = noon UTC − (h*3600+m*60+s)s
  return noonUtc.getTime() - (h * 3600 + m * 60 + s) * 1000;
}

/**
 * Parse an OCC-style option identifier like "AAPL  260619C00150000"
 * into its component parts.
 *
 * @param timezone - Optional IANA timezone for expiry conversion (e.g. 'America/New_York').
 *   If omitted, defaults to America/New_York for US symbols and Asia/Hong_Kong for .HK symbols.
 */
export function parseOptionIdentifier(identifier: string, timezone?: string): {
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

  const resolvedTz = resolveOptionTimezone(timezone, symbol);
  const paddedYear = String(2000 + yy).padStart(4, '0');
  const paddedMonth = String(mm).padStart(2, '0');
  const paddedDay = String(dd).padStart(2, '0');
  const expiryMs = localMidnightMs(`${paddedYear}-${paddedMonth}-${paddedDay}`, resolvedTz);

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

  /** Create a QuoteClient directly from a ClientConfig — no need to construct HttpClient manually. */
  static fromConfig(config: ClientConfig): QuoteClient {
    return new QuoteClient(new HttpClient(config, undefined, { useQuoteServerUrl: true }));
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

  /** Real-time stock quotes. wire: quote_real_time */
  async getRealTimeQuote(req: BriefRequest): Promise<Brief[]> {
    return this.callInto<Brief[]>('quote_real_time', req);
  }

  /** @deprecated Use getRealTimeQuote instead. */
  async getBrief(req: BriefRequest): Promise<Brief[]> {
    return this.getRealTimeQuote(req);
  }

  async getKline(req: KlineRequest): Promise<Kline[]> {
    return this.callInto<Kline[]>('kline', req);
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

  async getOptionExpiration(symbols: string[], market?: string): Promise<OptionExpiration[]> {
    const params: Record<string, unknown> = { symbols };
    if (market) params.market = market;
    return this.callInto<OptionExpiration[]>('option_expiration', params);
  }

  /**
   * Option chain; each item is [symbol, "YYYY-MM-DD"].
   *
   * @param timezone - Optional IANA timezone for expiry conversion (e.g. 'America/New_York').
   *   If omitted, defaults to America/New_York for US symbols and Asia/Hong_Kong for .HK symbols.
   * @param returnGreekValue - Whether to return Greeks (delta/gamma/theta/vega/rho).
   * @param optionFilter - Optional filter for in-the-money status, IV range, open interest range, Greeks ranges.
   */
  async getOptionChain(
    items: Array<[string, string]>,
    timezone?: string,
    returnGreekValue?: boolean,
    optionFilter?: OptionChainFilter,
  ): Promise<OptionChain[]> {
    const optionBasic = items.map(([symbol, expiry]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
        throw new Error(`invalid expiry date, expected YYYY-MM-DD: ${expiry}`);
      }
      const tz = resolveOptionTimezone(timezone, symbol);
      const expiryMs = localMidnightMs(expiry, tz);
      return { symbol, expiry: expiryMs };
    });
    const body: Record<string, unknown> = { option_basic: optionBasic };
    if (returnGreekValue !== undefined) body['return_greek_value'] = returnGreekValue;
    if (optionFilter !== undefined) body['option_filter'] = optionFilter;
    return this.callInto<OptionChain[]>('option_chain', body, '3.0');
  }

  /**
   * Option K-line by OCC-style identifier.
   *
   * @param timezone - Optional IANA timezone for expiry conversion (e.g. 'America/New_York').
   *   If omitted, defaults to America/New_York for US symbols and Asia/Hong_Kong for .HK symbols.
   * @param limit - Maximum number of bars to return.
   * @param sortDir - Sort direction ('asc' or 'desc').
   */
  async getOptionKline(
    identifiers: string[],
    period: string,
    beginTime: number = -1,
    endTime: number = -1,
    timezone?: string,
    limit?: number,
    sortDir?: string,
  ): Promise<Kline[]> {
    const resolvedBegin = beginTime === 0 ? -1 : beginTime;
    const resolvedEnd = endTime === 0 ? -1 : endTime;
    const optionQuery = identifiers.map((id) => {
      const p = parseOptionIdentifier(id, timezone);
      const entry: Record<string, unknown> = {
        symbol: p.symbol,
        expiry: p.expiryMs,
        right: p.right,
        strike: p.strike,
        period,
        begin_time: resolvedBegin,
        end_time: resolvedEnd,
      };
      if (limit !== undefined && limit > 0) entry['limit'] = limit;
      if (sortDir !== undefined && sortDir !== '') entry['sort_dir'] = sortDir;
      return entry;
    });
    return this.callInto<Kline[]>(
      'option_kline',
      { option_query: optionQuery },
      '2.0',
    );
  }

  /**
   * Real-time option quotes by OCC-style identifier.
   *
   * @param timezone - Optional IANA timezone for expiry conversion (e.g. 'America/New_York').
   *   If omitted, defaults to America/New_York for US symbols and Asia/Hong_Kong for .HK symbols.
   */
  async getOptionQuote(identifiers: string[], timezone?: string): Promise<Brief[]> {
    const optionBasic = identifiers.map((id) => {
      const p = parseOptionIdentifier(id, timezone);
      return { symbol: p.symbol, expiry: p.expiryMs, right: p.right, strike: p.strike };
    });
    return this.callInto<Brief[]>('option_brief', { option_basic: optionBasic }, '2.0');
  }

  /** @deprecated Use getOptionQuote instead. */
  async getOptionBrief(identifiers: string[]): Promise<Brief[]> {
    return this.getOptionQuote(identifiers);
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

  /** Delayed stock quotes. wire: quote_delay */
  async getDelayedQuote(req: StockDelayBriefsRequest): Promise<Brief[]> {
    return this.callInto<Brief[]>('quote_delay', req);
  }

  /** @deprecated Use getDelayedQuote instead. */
  async getStockDelayBriefs(req: StockDelayBriefsRequest): Promise<Brief[]> {
    return this.getDelayedQuote(req);
  }

  /** Client-side paginated K-line fetch. Loops until totalSize bars are collected, oldest-first. */
  async getKlineByPage(req: KlineByPageRequest): Promise<KlineItem[]> {
    const pageSize = req.pageSize && req.pageSize > 0 ? req.pageSize : 200;
    const totalSize = req.totalSize && req.totalSize > 0 ? req.totalSize : 1000;
    let beginTime = req.beginTime ?? -1;
    let endTime = req.endTime ?? -1;
    if (beginTime === 0) beginTime = -1;
    if (endTime === 0) endTime = -1;

    const acc: KlineItem[] = [];
    while (acc.length < totalSize) {
      const sub: KlineRequest = {
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

  /** Futures K-line. wire: future_kline
   * beginTime / endTime default to -1 when unset (server requires them present). */
  async getFutureKline(req: FutureKlineRequest): Promise<FutureKline[]> {
    const body: FutureKlineRequest = {
      ...req,
      beginTime: req.beginTime ?? -1,
      endTime: req.endTime ?? -1,
    };
    return this.callInto<FutureKline[]>('future_kline', body);
  }

  /** Client-side paginated futures K-line fetch. */
  async getFutureKlineByPage(req: FutureKlineByPageRequest): Promise<FutureKlineItem[]> {
    const pageSize = req.pageSize && req.pageSize > 0 ? req.pageSize : 200;
    const totalSize = req.totalSize && req.totalSize > 0 ? req.totalSize : 1000;
    let beginTime = req.beginTime ?? -1;
    let endTime = req.endTime ?? -1;
    if (beginTime === 0) beginTime = -1;
    if (endTime === 0) endTime = -1;

    const acc: FutureKlineItem[] = [];
    while (acc.length < totalSize) {
      const sub: FutureKlineRequest = {
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

  /** Futures tick trades. wire: future_tick (API v3.0)
   * Server returns {contractCode, items:[...]}; unwrap items and backfill contractCode.
   * endIndex defaults to 30 when not set (consistent with Python/Go SDK). */
  async getFutureTradeTicks(req: FutureTradeTicksRequest): Promise<FutureTradeTickItem[]> {
    if (!req.endIndex) req.endIndex = 30;
    const wrap = await this.callInto<{ contractCode?: string; items?: FutureTradeTickItem[] }>('future_tick', req, '3.0');
    const items = wrap?.items ?? [];
    if (wrap?.contractCode) {
      for (const item of items) {
        if (!item.contractCode) item.contractCode = wrap.contractCode;
      }
    }
    return items;
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

  /** Real-time warrant quotes. wire: warrant_briefs */
  async getWarrantQuote(req: WarrantBriefsRequest): Promise<WarrantBrief[]> {
    return this.callInto<WarrantBrief[]>('warrant_briefs', req);
  }

  /** @deprecated Use getWarrantQuote instead. */
  async getWarrantBriefs(req: WarrantBriefsRequest): Promise<WarrantBrief[]> {
    return this.getWarrantQuote(req);
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

  /** Corporate symbol change (flattened). wire: corporate_action (action_type=symbol_change) */
  async getCorporateSymbolChange(req: CorporateActionRequest): Promise<CorporateSymbolChange[]> {
    const body: CorporateActionRequest = { ...req, actionType: 'symbol_change' };
    const grouped = await this.callInto<Record<string, CorporateSymbolChange[]>>('corporate_action', body);
    if (!grouped || typeof grouped !== 'object') return [];
    return Object.values(grouped).flat();
  }

  /** Corporate delisting (flattened). wire: corporate_action (action_type=delisting) */
  async getCorporateDelisting(req: CorporateActionRequest): Promise<CorporateDelisting[]> {
    const body: CorporateActionRequest = { ...req, actionType: 'delisting' };
    const grouped = await this.callInto<Record<string, CorporateDelisting[]>>('corporate_action', body);
    if (!grouped || typeof grouped !== 'object') return [];
    return Object.values(grouped).flat();
  }

  /** Corporate IPO (flattened). wire: corporate_action (action_type=ipo) */
  async getCorporateIPO(req: CorporateActionRequest): Promise<CorporateIPO[]> {
    const body: CorporateActionRequest = { ...req, actionType: 'ipo' };
    const grouped = await this.callInto<Record<string, CorporateIPO[]>>('corporate_action', body);
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
  async getMarketScannerTags(req: MarketScannerTagsRequest): Promise<MarketScannerTagGroup[]> {
    return this.callInto<MarketScannerTagGroup[]>('market_scanner_tags', req);
  }

  /** Overnight quote. wire: quote_overnight */
  async getQuoteOvernight(req: QuoteOvernightRequest): Promise<QuoteOvernight[]> {
    return this.callInto<QuoteOvernight[]>('quote_overnight', req);
  }
}
