/**
 * QuoteClient - Quote query client
 * Wraps all quote-related APIs, sending requests via HttpClient
 */
import type { HttpClient } from '../client/http-client';
import { createApiRequest } from '../client/api-request';

/**
 * Parse an option identifier string into its components.
 *
 * Supported format: "SYMBOL YYMMDDX00000000" where X is C (call) or P (put),
 * and the 8-digit strike is in thousandths (e.g. 00150000 = 150.0).
 *
 * @param identifier - Option identifier (e.g. "AAPL 240119C00150000")
 * @returns Parsed components { symbol, expiry, right, strike }
 */
export function parseOptionIdentifier(identifier: string): {
  symbol: string;
  expiry: string;
  right: string;
  strike: string;
} {
  const trimmed = identifier.trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) {
    return { symbol: trimmed, expiry: '', right: '', strike: '' };
  }

  const symbol = trimmed.substring(0, spaceIdx);
  const rest = trimmed.substring(spaceIdx + 1).trim();

  // rest format: YYMMDDX00000000 (6 date + 1 right + 8 strike = 15 chars)
  if (rest.length < 15) {
    return { symbol, expiry: rest, right: '', strike: '' };
  }

  const datePart = rest.substring(0, 6); // YYMMDD
  const right = rest.substring(6, 7);     // C or P
  const strikePart = rest.substring(7);   // 00150000

  // Convert YYMMDD to YYYY-MM-DD
  const yy = datePart.substring(0, 2);
  const mm = datePart.substring(2, 4);
  const dd = datePart.substring(4, 6);
  const expiry = `20${yy}-${mm}-${dd}`;

  // Convert strike: remove leading zeros, divide by 1000
  const strikeNum = parseInt(strikePart, 10) / 1000;
  const strike = String(strikeNum);

  return { symbol, expiry, right: right === 'C' ? 'CALL' : 'PUT', strike };
}

/**
 * Quote query client wrapping all quote-related APIs.
 */
export class QuoteClient {
  private httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Internal helper: build request, send, return the data field
   */
  private async execute(method: string, bizParams?: unknown, version?: string): Promise<unknown> {
    const request = createApiRequest(method, bizParams, version);
    const response = await this.httpClient.executeRequest(request);
    return response.data;
  }

  // === Basic quote methods ===

  /** Get market status */
  async marketState(market: string): Promise<unknown> {
    return this.execute('market_state', { market });
  }

  /** Get real-time quotes */
  async quoteRealTime(symbols: string[]): Promise<unknown> {
    return this.execute('quote_real_time', { symbols });
  }

  /** Get K-line data */
  async kline(symbol: string, period: string): Promise<unknown> {
    return this.execute('kline', { symbols: [symbol], period });
  }

  /** Get timeline data */
  async timeline(symbols: string[]): Promise<unknown> {
    return this.execute('timeline', { symbols });
  }

  /** Get trade tick data */
  async tradeTick(symbols: string[]): Promise<unknown> {
    return this.execute('trade_tick', { symbols });
  }

  /** Get quote depth */
  async quoteDepth(symbol: string): Promise<unknown> {
    return this.execute('quote_depth', { symbol });
  }

  // === Option quote methods ===

  /** Get option expiration dates */
  async optionExpiration(symbol: string): Promise<unknown> {
    return this.execute('option_expiration', { symbols: [symbol] });
  }

  /**
   * Get option chain.
   * Uses v3 API with option_basic array format.
   */
  async optionChain(symbol: string, expiry: string): Promise<unknown> {
    return this.execute('option_chain', {
      option_basic: [{ symbol, expiry }],
    }, '3.0');
  }

  /**
   * Get option brief quotes.
   * Parses each identifier into structured params.
   */
  async optionBrief(identifiers: string[]): Promise<unknown> {
    const optionBasic = identifiers.map((id) => {
      const parsed = parseOptionIdentifier(id);
      return {
        symbol: parsed.symbol,
        expiry: parsed.expiry,
        right: parsed.right,
        strike: parsed.strike,
      };
    });
    return this.execute('option_brief', { option_basic: optionBasic }, '2.0');
  }

  /**
   * Get option K-line data.
   * Uses v2 API with option_query array format.
   */
  async optionKline(identifier: string, period: string): Promise<unknown> {
    const parsed = parseOptionIdentifier(identifier);
    return this.execute('option_kline', {
      option_query: [{
        symbol: parsed.symbol,
        expiry: parsed.expiry,
        right: parsed.right,
        strike: parsed.strike,
        period,
      }],
    }, '2.0');
  }

  // === Futures quote methods ===

  /** Get futures exchange list */
  async futureExchange(): Promise<unknown> {
    return this.execute('future_exchange', { sec_type: 'FUT' });
  }

  /** Get futures contract list */
  async futureContracts(exchange: string): Promise<unknown> {
    return this.execute('future_contracts', { exchange });
  }

  /** Get futures real-time quotes */
  async futureRealTimeQuote(symbols: string[]): Promise<unknown> {
    return this.execute('future_real_time_quote', { symbols });
  }

  /** Get futures K-line data */
  async futureKline(symbol: string, period: string): Promise<unknown> {
    return this.execute('future_kline', { symbol, period });
  }

  // === Fundamentals and capital flow methods ===

  /** Get financial daily data */
  async financialDaily(symbol: string): Promise<unknown> {
    return this.execute('financial_daily', { symbol });
  }

  /** Get financial report */
  async financialReport(symbol: string): Promise<unknown> {
    return this.execute('financial_report', { symbol });
  }

  /** Get corporate actions */
  async corporateAction(symbol: string): Promise<unknown> {
    return this.execute('corporate_action', { symbol });
  }

  /** Get capital flow */
  async capitalFlow(symbol: string): Promise<unknown> {
    return this.execute('capital_flow', { symbol });
  }

  /** Get capital distribution */
  async capitalDistribution(symbol: string): Promise<unknown> {
    return this.execute('capital_distribution', { symbol });
  }

  // === Scanner and quote permission methods ===

  /** Market scanner */
  async marketScanner(params: Record<string, unknown>): Promise<unknown> {
    return this.execute('market_scanner', params);
  }

  /** Get quote permission */
  async grabQuotePermission(): Promise<unknown> {
    return this.execute('grab_quote_permission');
  }

  // === Aliases (get* prefix) ===

  /** Alias for marketState */
  async getMarketState(market: string): Promise<unknown> { return this.marketState(market); }
  /** Alias for quoteRealTime */
  async getBrief(symbols: string[]): Promise<unknown> { return this.quoteRealTime(symbols); }
  /** Alias for kline */
  async getKline(symbol: string, period: string): Promise<unknown> { return this.kline(symbol, period); }
  /** Alias for timeline */
  async getTimeline(symbols: string[]): Promise<unknown> { return this.timeline(symbols); }
  /** Alias for tradeTick */
  async getTradeTick(symbols: string[]): Promise<unknown> { return this.tradeTick(symbols); }
  /** Alias for quoteDepth */
  async getQuoteDepth(symbol: string): Promise<unknown> { return this.quoteDepth(symbol); }
  /** Alias for optionExpiration */
  async getOptionExpiration(symbol: string): Promise<unknown> { return this.optionExpiration(symbol); }
  /** Alias for optionChain */
  async getOptionChain(symbol: string, expiry: string): Promise<unknown> { return this.optionChain(symbol, expiry); }
  /** Alias for optionBrief */
  async getOptionBrief(identifiers: string[]): Promise<unknown> { return this.optionBrief(identifiers); }
  /** Alias for optionKline */
  async getOptionKline(identifier: string, period: string): Promise<unknown> { return this.optionKline(identifier, period); }
  /** Alias for futureExchange */
  async getFutureExchange(): Promise<unknown> { return this.futureExchange(); }
  /** Alias for futureContracts */
  async getFutureContracts(exchange: string): Promise<unknown> { return this.futureContracts(exchange); }
  /** Alias for futureRealTimeQuote */
  async getFutureRealTimeQuote(symbols: string[]): Promise<unknown> { return this.futureRealTimeQuote(symbols); }
  /** Alias for futureKline */
  async getFutureKline(symbol: string, period: string): Promise<unknown> { return this.futureKline(symbol, period); }
  /** Alias for financialDaily */
  async getFinancialDaily(symbol: string): Promise<unknown> { return this.financialDaily(symbol); }
  /** Alias for financialReport */
  async getFinancialReport(symbol: string): Promise<unknown> { return this.financialReport(symbol); }
  /** Alias for corporateAction */
  async getCorporateAction(symbol: string): Promise<unknown> { return this.corporateAction(symbol); }
  /** Alias for capitalFlow */
  async getCapitalFlow(symbol: string): Promise<unknown> { return this.capitalFlow(symbol); }
  /** Alias for capitalDistribution */
  async getCapitalDistribution(symbol: string): Promise<unknown> { return this.capitalDistribution(symbol); }
}
