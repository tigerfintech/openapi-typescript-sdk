/**
 * TradeClient 交易客户端
 * 封装所有交易相关 API，通过 HttpClient 发送请求
 */
import type { HttpClient } from '../client/http-client';
import { createApiRequest } from '../client/api-request';
import type { Order } from '../model/order';

/**
 * 交易客户端，封装所有交易相关 API。
 */
export class TradeClient {
  private httpClient: HttpClient;
  private account: string;

  constructor(httpClient: HttpClient, account: string) {
    this.httpClient = httpClient;
    this.account = account;
  }

  /**
   * 内部通用方法：构造请求、发送、返回 data 字段
   */
  private async execute(method: string, bizParams: unknown): Promise<unknown> {
    const request = createApiRequest(method, bizParams);
    const response = await this.httpClient.executeRequest(request);
    return response.data;
  }

  // === 合约查询方法 ===

  /** 查询单个合约 */
  async contract(symbol: string, secType: string): Promise<unknown> {
    return this.execute('contract', {
      account: this.account, symbol, secType,
    });
  }

  /** 批量查询合约 */
  async contracts(symbols: string[], secType: string): Promise<unknown> {
    return this.execute('contracts', {
      account: this.account, symbols, secType,
    });
  }

  /** 查询衍生品合约 */
  async quoteContract(symbol: string, secType: string): Promise<unknown> {
    return this.execute('quote_contract', {
      account: this.account, symbol, secType,
    });
  }

  // === 订单操作方法 ===

  /** 下单 */
  async placeOrder(order: Order): Promise<unknown> {
    const params = { ...order, account: this.account };
    return this.execute('place_order', params);
  }

  /** 预览订单 */
  async previewOrder(order: Order): Promise<unknown> {
    const params = { ...order, account: this.account };
    return this.execute('preview_order', params);
  }

  /** 修改订单 */
  async modifyOrder(id: number, order: Order): Promise<unknown> {
    const params = { ...order, account: this.account, id };
    return this.execute('modify_order', params);
  }

  /** 取消订单 */
  async cancelOrder(id: number): Promise<unknown> {
    return this.execute('cancel_order', {
      account: this.account, id,
    });
  }

  // === 订单查询方法 ===

  /** 查询全部订单 */
  async orders(): Promise<unknown> {
    return this.execute('orders', { account: this.account });
  }

  /** 查询待成交订单 */
  async activeOrders(): Promise<unknown> {
    return this.execute('active_orders', { account: this.account });
  }

  /** 查询已撤销订单 */
  async inactiveOrders(): Promise<unknown> {
    return this.execute('inactive_orders', { account: this.account });
  }

  /** 查询已成交订单 */
  async filledOrders(): Promise<unknown> {
    return this.execute('filled_orders', { account: this.account });
  }

  // === 持仓和资产查询方法 ===

  /** 查询持仓 */
  async positions(): Promise<unknown> {
    return this.execute('positions', { account: this.account });
  }

  /** 查询资产 */
  async assets(): Promise<unknown> {
    return this.execute('assets', { account: this.account });
  }

  /** 查询综合账户资产 */
  async primeAssets(): Promise<unknown> {
    return this.execute('prime_assets', { account: this.account });
  }

  /** 查询订单成交明细 */
  async orderTransactions(id: number): Promise<unknown> {
    return this.execute('order_transactions', {
      account: this.account, id,
    });
  }

  // === Aliases (get* prefix) ===

  async getContract(symbol: string, secType: string): Promise<unknown> { return this.contract(symbol, secType); }
  async getContracts(symbols: string[], secType: string): Promise<unknown> { return this.contracts(symbols, secType); }
  async getQuoteContract(symbol: string, secType: string): Promise<unknown> { return this.quoteContract(symbol, secType); }
  async getOrders(): Promise<unknown> { return this.orders(); }
  async getActiveOrders(): Promise<unknown> { return this.activeOrders(); }
  async getInactiveOrders(): Promise<unknown> { return this.inactiveOrders(); }
  async getFilledOrders(): Promise<unknown> { return this.filledOrders(); }
  async getPositions(): Promise<unknown> { return this.positions(); }
  async getAssets(): Promise<unknown> { return this.assets(); }
  async getPrimeAssets(): Promise<unknown> { return this.primeAssets(); }
  async getOrderTransactions(id: number): Promise<unknown> { return this.orderTransactions(id); }
}
