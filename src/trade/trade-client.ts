/**
 * TradeClient — trading client.
 *
 * All methods return strongly-typed responses; request parameters are
 * written in camelCase in TypeScript and converted to snake_case on the wire.
 */
import type { HttpClient } from '../client/http-client';
import { createApiRequest } from '../client/api-request';
import { unmarshalData } from '../client/api-response';
import type { OrderRequest, Order } from '../model/order';
import type { Contract } from '../model/contract';
import type { Position } from '../model/position';
import type {
  Asset,
  PrimeAsset,
  PreviewResult,
  PlaceOrderResult,
  OrderIdResult,
  Transaction,
} from '../model/trade';

/** Trading client wrapping all trade-related APIs. */
export class TradeClient {
  private httpClient: HttpClient;
  private account: string;

  constructor(httpClient: HttpClient, account: string) {
    this.httpClient = httpClient;
    this.account = account;
  }

  private async callInto<T>(method: string, bizParams: unknown): Promise<T> {
    const request = createApiRequest(method, bizParams);
    const response = await this.httpClient.executeRequest(request);
    return unmarshalData<T>(response.data) as T;
  }

  /** Strip `{items: [...]}` envelope used by most trade read endpoints. */
  private async callIntoItems<T>(method: string, bizParams: unknown): Promise<T[]> {
    const wrap = await this.callInto<{ items?: T[] } | T[]>(method, bizParams);
    if (Array.isArray(wrap)) return wrap;
    return wrap?.items ?? [];
  }

  // === Contracts ===

  async getContract(symbol: string, secType: string): Promise<Contract[]> {
    return this.callIntoItems<Contract>('contract', {
      account: this.account, symbol, secType,
    });
  }

  async getContracts(symbols: string[], secType: string): Promise<Contract[]> {
    return this.callIntoItems<Contract>('contracts', {
      account: this.account, symbols, secType,
    });
  }

  /**
   * Derivative contracts (OPT / WAR / IOPT only).
   * `symbol` is the underlying (e.g. "AAPL"); `expiry` is "YYYYMMDD".
   */
  async getQuoteContract(symbol: string, secType: string, expiry: string): Promise<Contract[]> {
    return this.callIntoItems<Contract>('quote_contract', {
      account: this.account, symbols: [symbol], secType, expiry,
    });
  }

  // === Order operations ===

  async placeOrder(order: OrderRequest): Promise<PlaceOrderResult | undefined> {
    return this.callInto<PlaceOrderResult>('place_order', { ...order, account: this.account });
  }

  async previewOrder(order: OrderRequest): Promise<PreviewResult | undefined> {
    return this.callInto<PreviewResult>('preview_order', { ...order, account: this.account });
  }

  async modifyOrder(id: number, order: OrderRequest): Promise<OrderIdResult | undefined> {
    return this.callInto<OrderIdResult>('modify_order', { ...order, account: this.account, id });
  }

  async cancelOrder(id: number): Promise<OrderIdResult | undefined> {
    return this.callInto<OrderIdResult>('cancel_order', { account: this.account, id });
  }

  // === Order queries ===

  async getOrders(): Promise<Order[]> {
    return this.callIntoItems<Order>('orders', { account: this.account });
  }

  async getActiveOrders(): Promise<Order[]> {
    return this.callIntoItems<Order>('active_orders', { account: this.account });
  }

  async getInactiveOrders(): Promise<Order[]> {
    return this.callIntoItems<Order>('inactive_orders', { account: this.account });
  }

  /**
   * Filled orders in a time range (ms timestamps required by the server).
   * Use `Date.now() - 30*24*3600*1000` for "last 30 days".
   */
  async getFilledOrders(startDateMs: number, endDateMs: number): Promise<Order[]> {
    return this.callIntoItems<Order>('filled_orders', {
      account: this.account, startDate: startDateMs, endDate: endDateMs,
    });
  }

  /** Transactions for a specific order; `symbol` and `secType` are required. */
  async getOrderTransactions(
    id: number,
    symbol: string,
    secType: string,
  ): Promise<Transaction[]> {
    return this.callIntoItems<Transaction>('order_transactions', {
      account: this.account, orderId: id, symbol, secType,
    });
  }

  // === Positions & assets ===

  async getPositions(): Promise<Position[]> {
    return this.callIntoItems<Position>('positions', { account: this.account });
  }

  async getAssets(): Promise<Asset[]> {
    return this.callIntoItems<Asset>('assets', { account: this.account });
  }

  async getPrimeAssets(): Promise<PrimeAsset | undefined> {
    return this.callInto<PrimeAsset>('prime_assets', { account: this.account });
  }
}
