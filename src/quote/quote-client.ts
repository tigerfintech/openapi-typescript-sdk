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
  Timeline,
  TradeTick,
  Depth,
  OptionExpiration,
  OptionChain,
  FutureExchange,
  FutureContractInfo,
  FutureQuote,
  FutureKline,
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
} from '../model/quote';

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

  // === Basic market data ===

  async getMarketState(market: string): Promise<MarketState[]> {
    return this.callInto<MarketState[]>('market_state', { market });
  }

  async getBrief(symbols: string[]): Promise<Brief[]> {
    return this.callInto<Brief[]>('quote_real_time', { symbols });
  }

  async getKline(symbol: string, period: string): Promise<Kline[]> {
    return this.callInto<Kline[]>('kline', { symbols: [symbol], period });
  }

  async getTimeline(symbols: string[]): Promise<Timeline[]> {
    return this.callInto<Timeline[]>('timeline', { symbols });
  }

  async getTradeTick(symbols: string[]): Promise<TradeTick[]> {
    return this.callInto<TradeTick[]>('trade_tick', { symbols });
  }

  /** Depth snapshot. market is required (US / HK supported). */
  async getQuoteDepth(symbol: string, market: string): Promise<Depth[]> {
    return this.callInto<Depth[]>('quote_depth', { symbols: [symbol], market });
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

  async getFutureRealTimeQuote(contractCodes: string[]): Promise<FutureQuote[]> {
    return this.callInto<FutureQuote[]>('future_real_time_quote', { contractCodes });
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
}
