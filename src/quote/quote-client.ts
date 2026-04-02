/**
 * QuoteClient 行情查询客户端
 * 封装所有行情相关 API，通过 HttpClient 发送请求
 */
import type { HttpClient } from '../client/http-client';
import { createApiRequest } from '../client/api-request';

/**
 * 行情查询客户端，封装所有行情相关 API。
 */
export class QuoteClient {
  private httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * 内部通用方法：构造请求、发送、返回 data 字段
   */
  private async execute(method: string, bizParams?: unknown): Promise<unknown> {
    const request = createApiRequest(method, bizParams);
    const response = await this.httpClient.executeRequest(request);
    return response.data;
  }

  // === 基础行情方法 ===

  /** 获取市场状态 */
  async marketState(market: string): Promise<unknown> {
    return this.execute('market_state', { market });
  }

  /** 获取实时报价 */
  async quoteRealTime(symbols: string[]): Promise<unknown> {
    return this.execute('quote_real_time', { symbols });
  }

  /** 获取 K 线数据 */
  async kline(symbol: string, period: string): Promise<unknown> {
    return this.execute('kline', { symbols: [symbol], period });
  }

  /** 获取分时数据 */
  async timeline(symbols: string[]): Promise<unknown> {
    return this.execute('timeline', { symbols });
  }

  /** 获取逐笔成交数据 */
  async tradeTick(symbols: string[]): Promise<unknown> {
    return this.execute('trade_tick', { symbols });
  }

  /** 获取深度行情 */
  async quoteDepth(symbol: string): Promise<unknown> {
    return this.execute('quote_depth', { symbol });
  }

  // === 期权行情方法 ===

  /** 获取期权到期日 */
  async optionExpiration(symbol: string): Promise<unknown> {
    return this.execute('option_expiration', { symbols: [symbol] });
  }

  /** 获取期权链 */
  async optionChain(symbol: string, expiry: string): Promise<unknown> {
    return this.execute('option_chain', { symbol, expiry });
  }

  /** 获取期权报价 */
  async optionBrief(identifiers: string[]): Promise<unknown> {
    return this.execute('option_brief', { identifiers });
  }

  /** 获取期权 K 线 */
  async optionKline(identifier: string, period: string): Promise<unknown> {
    return this.execute('option_kline', { identifier, period });
  }

  // === 期货行情方法 ===

  /** 获取期货交易所列表 */
  async futureExchange(): Promise<unknown> {
    return this.execute('future_exchange', { sec_type: 'FUT' });
  }

  /** 获取期货合约列表 */
  async futureContracts(exchange: string): Promise<unknown> {
    return this.execute('future_contracts', { exchange });
  }

  /** 获取期货实时报价 */
  async futureRealTimeQuote(symbols: string[]): Promise<unknown> {
    return this.execute('future_real_time_quote', { symbols });
  }

  /** 获取期货 K 线 */
  async futureKline(symbol: string, period: string): Promise<unknown> {
    return this.execute('future_kline', { symbol, period });
  }

  // === 基本面和资金流向方法 ===

  /** 获取财务日报 */
  async financialDaily(symbol: string): Promise<unknown> {
    return this.execute('financial_daily', { symbol });
  }

  /** 获取财务报告 */
  async financialReport(symbol: string): Promise<unknown> {
    return this.execute('financial_report', { symbol });
  }

  /** 获取公司行动 */
  async corporateAction(symbol: string): Promise<unknown> {
    return this.execute('corporate_action', { symbol });
  }

  /** 获取资金流向 */
  async capitalFlow(symbol: string): Promise<unknown> {
    return this.execute('capital_flow', { symbol });
  }

  /** 获取资金分布 */
  async capitalDistribution(symbol: string): Promise<unknown> {
    return this.execute('capital_distribution', { symbol });
  }

  // === 选股器和行情权限方法 ===

  /** 选股器 */
  async marketScanner(params: Record<string, unknown>): Promise<unknown> {
    return this.execute('market_scanner', params);
  }

  /** 获取行情权限 */
  async grabQuotePermission(): Promise<unknown> {
    return this.execute('grab_quote_permission');
  }
}
