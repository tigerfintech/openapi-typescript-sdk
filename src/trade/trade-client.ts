/**
 * TradeClient — trading client.
 *
 * All methods return strongly-typed responses; request parameters are
 * written in camelCase in TypeScript and converted to snake_case on the wire.
 *
 * v0.4.0: 所有查询类方法改为 Request 对象签名(OrdersRequest 等),补齐 17
 * 个新方法(账户管理 / 资产分析 / 资金调拨 / 持仓划转等)。
 */
import { HttpClient } from '../client/http-client';
import type { ClientConfig } from '../config/client-config';
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
  ManagedAccount,
  AnalyticsAsset,
  AggregateAssets,
  EstimateTradableQuantity,
  ForexOrderResult,
  SegmentFund,
  SegmentFundAvailableItem,
  SegmentFundHistoryItem,
  FundDetails,
  FundingHistoryItem,
  PositionTransferRecord,
  PositionTransferDetail,
  PositionTransferExternalRecord,
  OptionExerciseCheckResult,
  OptionExercisePositionPageResult,
  OptionExerciseRecordPageResult,
} from '../model/trade';
import type {
  OrdersRequest,
  GetOrderRequest,
  OrderTransactionsRequest,
  PositionsRequest,
  AssetsRequest,
  ManagedAccountsRequest,
  DerivativeContractsRequest,
  AnalyticsAssetRequest,
  AggregateAssetsRequest,
  EstimateTradableQuantityRequest,
  ForexOrderRequest,
  SegmentFundRequest,
  FundDetailsRequest,
  FundingHistoryRequest,
  PositionTransferRequest,
  PositionTransferRecordsRequest,
  PositionTransferDetailRequest,
  PositionTransferExternalRecordsRequest,
  OptionExerciseCheckRequest,
  OptionExercisePositionRequest,
  OptionExerciseSubmitRequest,
  OptionExerciseRecordsRequest,
  OptionExerciseCancelRequest,
} from '../model/trade-requests';
import { normalizeOrderStatus } from '../model/order-status';

/** Normalize `Order.status` field in-place (handles int → string). */
function normalizeOrderInPlace(o: Order | undefined | null): void {
  if (o && o.status !== undefined && o.status !== null) {
    o.status = normalizeOrderStatus(o.status);
  }
}

/** Normalize every Order in a list in-place. */
function normalizeOrders(orders: Order[]): Order[] {
  for (const o of orders) normalizeOrderInPlace(o);
  return orders;
}

/** Shallow-copy a request object and fill account if empty. */
function withAccount<T extends { account?: string }>(req: T | undefined, account: string): T {
  const r = { ...(req ?? {}) } as T;
  if (!r.account) r.account = account;
  return r;
}

/** Trading client wrapping all trade-related APIs. */
export class TradeClient {
  private httpClient: HttpClient;
  private account: string;
  private secretKey?: string;

  constructor(httpClient: HttpClient, account: string, secretKey?: string) {
    this.httpClient = httpClient;
    this.account = account;
    this.secretKey = secretKey;
  }

  /** Create a TradeClient directly from a ClientConfig — no need to construct HttpClient manually. */
  static fromConfig(config: ClientConfig, account: string, secretKey?: string): TradeClient {
    return new TradeClient(new HttpClient(config), account, secretKey);
  }

  private async callInto<T>(method: string, bizParams: unknown): Promise<T> {
    // Inject secretKey into every request when available (institution accounts require it).
    // Individual methods that already set secretKey will not be overwritten (|| not &&).
    let params = bizParams;
    if (this.secretKey && params !== null && typeof params === 'object' && !Array.isArray(params)) {
      const p = params as Record<string, unknown>;
      if (p['secretKey'] == null && p['secret_key'] == null) {
        params = { ...p, secretKey: this.secretKey };
      }
    }
    const request = createApiRequest(method, params);
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

  async modifyOrder(id: number | string, order: OrderRequest): Promise<OrderIdResult | undefined> {
    return this.callInto<OrderIdResult>('modify_order', { ...order, account: this.account, id });
  }

  async cancelOrder(id: number | string, secretKey?: string): Promise<OrderIdResult | undefined> {
    const params: Record<string, unknown> = { account: this.account, id };
    if (secretKey !== undefined) params.secretKey = secretKey; // per-call override takes precedence; undefined means use config default
    return this.callInto<OrderIdResult>('cancel_order', params);
  }

  // === Order queries (BREAKING v0.4.0) ===

  /**
   * Query all historical orders. v0.4.0: optional OrdersRequest for filtering.
   *
   * @example
   * // Default (unfiltered)
   * await tc.getOrders();
   * // Filter by status
   * await tc.getOrders({ states: ['Filled'], limit: 100 });
   */
  async getOrders(req?: OrdersRequest): Promise<Order[]> {
    return normalizeOrders(
      await this.callIntoItems<Order>('orders', withAccount(req, this.account)),
    );
  }

  /** Query active (open) orders. v0.4.0: supports ParentId to filter attached legs. */
  async getActiveOrders(req?: OrdersRequest): Promise<Order[]> {
    return normalizeOrders(
      await this.callIntoItems<Order>('active_orders', withAccount(req, this.account)),
    );
  }

  /** Query inactive/cancelled orders. */
  async getInactiveOrders(req?: OrdersRequest): Promise<Order[]> {
    return normalizeOrders(
      await this.callIntoItems<Order>('inactive_orders', withAccount(req, this.account)),
    );
  }

  /**
   * Query filled orders. v0.4.0 BREAKING: signature changed from positional
   * (startDateMs, endDateMs) to OrdersRequest object.
   *
   * @example
   * // Last 30 days
   * const now = Date.now();
   * await tc.getFilledOrders({ startDate: now - 30*24*3600*1000, endDate: now });
   */
  async getFilledOrders(req?: OrdersRequest): Promise<Order[]> {
    return normalizeOrders(
      await this.callIntoItems<Order>('filled_orders', withAccount(req, this.account)),
    );
  }

  /**
   * Get a single order by ID (v0.4.0 new).
   * Returns `undefined` if no match.
   */
  async getOrder(req: GetOrderRequest): Promise<Order | undefined> {
    const merged = withAccount(req, this.account);
    const out = await this.callInto<Order | undefined>('order_no', merged);
    if (!out || (!out.id && !out.orderId)) return undefined;
    normalizeOrderInPlace(out);
    return out;
  }

  /**
   * Query order transaction details. v0.4.0 BREAKING: all fields now optional
   * (previously symbol/secType required).
   */
  async getOrderTransactions(req: OrderTransactionsRequest): Promise<Transaction[]> {
    return this.callIntoItems<Transaction>(
      'order_transactions',
      withAccount(req, this.account),
    );
  }

  // === Positions & assets (BREAKING v0.4.0) ===

  /** Query positions. v0.4.0: supports Symbol / SecType / Currency / Market filters. */
  async getPositions(req?: PositionsRequest): Promise<Position[]> {
    return this.callIntoItems<Position>('positions', withAccount(req, this.account));
  }

  /** Query assets. v0.4.0: supports sub-account list and aggregation options. */
  async getAssets(req?: AssetsRequest): Promise<Asset[]> {
    return this.callIntoItems<Asset>('assets', withAccount(req, this.account));
  }

  /** Query prime assets. v0.4.0: takes AssetsRequest for filters. */
  async getPrimeAssets(req?: AssetsRequest): Promise<PrimeAsset | undefined> {
    return this.callInto<PrimeAsset>('prime_assets', withAccount(req, this.account));
  }

  // ===== v0.4.0 NEW: Account management =====

  /** Query managed sub-accounts (institutional). */
  async getManagedAccounts(req?: ManagedAccountsRequest): Promise<ManagedAccount[]> {
    return this.callIntoItems<ManagedAccount>('accounts', withAccount(req, this.account));
  }

  /**
   * Query derivative contracts list. Same wire as getQuoteContract but accepts
   * full request struct. Python: `get_derivative_contracts`.
   */
  async getDerivativeContracts(req: DerivativeContractsRequest): Promise<Contract[]> {
    return this.callIntoItems<Contract>('quote_contract', withAccount(req, this.account));
  }

  // ===== v0.4.0 NEW: Asset analytics =====

  /** Daily P&L / net-value / holding-value analytics. */
  async getAnalyticsAsset(req: AnalyticsAssetRequest): Promise<AnalyticsAsset[]> {
    return this.callIntoItems<AnalyticsAsset>('analytics_asset', withAccount(req, this.account));
  }

  /** Aggregate assets (prime) by base currency. */
  async getAggregateAssets(req?: AggregateAssetsRequest): Promise<AggregateAssets | undefined> {
    return this.callInto<AggregateAssets>('aggregate_assets', withAccount(req, this.account));
  }

  /** Estimate tradable quantity given order parameters. */
  async getEstimateTradableQuantity(
    req: EstimateTradableQuantityRequest,
  ): Promise<EstimateTradableQuantity | undefined> {
    return this.callInto<EstimateTradableQuantity>(
      'estimate_tradable_quantity',
      withAccount(req, this.account),
    );
  }

  // ===== v0.4.0 NEW: Forex =====

  /** Place forex order (sub-account base-currency swap). */
  async placeForexOrder(req: ForexOrderRequest): Promise<ForexOrderResult | undefined> {
    return this.callInto<ForexOrderResult>('place_forex_order', withAccount(req, this.account));
  }

  // ===== v0.4.0 NEW: Segment fund transfer =====

  /** Query amount available for inter-segment transfer. Returns array. */
  async getSegmentFundAvailable(req: SegmentFundRequest): Promise<SegmentFundAvailableItem[]> {
    return this.callInto<SegmentFundAvailableItem[]>('segment_fund_available', withAccount(req, this.account));
  }

  /** Query segment fund transfer history. Server returns plain array (no items wrapper). */
  async getSegmentFundHistory(req: SegmentFundRequest): Promise<SegmentFundHistoryItem[]> {
    return this.callInto<SegmentFundHistoryItem[]>(
      'segment_fund_history',
      withAccount(req, this.account),
    );
  }

  /** Execute an inter-segment fund transfer. */
  async transferSegmentFund(req: SegmentFundRequest): Promise<SegmentFund | undefined> {
    return this.callInto<SegmentFund>('transfer_segment_fund', withAccount(req, this.account));
  }

  /** Cancel a pending inter-segment transfer. */
  async cancelSegmentFund(req: SegmentFundRequest): Promise<SegmentFund | undefined> {
    return this.callInto<SegmentFund>('cancel_segment_fund', withAccount(req, this.account));
  }

  // ===== v0.4.0 NEW: Fund details / history =====

  /** Fund-movement details (by segment / currency / fund-type). */
  async getFundDetails(req: FundDetailsRequest): Promise<FundDetails[]> {
    return this.callIntoItems<FundDetails>('fund_details', withAccount(req, this.account));
  }

  /** Funding history (wire method: `transfer_fund`).
   * Server returns bare list (no items wrapper). */
  async getFundingHistory(req: FundingHistoryRequest): Promise<FundingHistoryItem[]> {
    return this.callInto<FundingHistoryItem[]>(
      'transfer_fund',
      withAccount(req, this.account),
    );
  }

  // ===== v0.4.0 NEW: Internal / external position transfer =====

  /**
   * Internal position transfer (cross sub-account).
   * @note Uses `fromAccount` / `toAccount` (not `account`).
   */
  async transferPosition(req: PositionTransferRequest): Promise<PositionTransferRecord | undefined> {
    const merged = { ...req } as PositionTransferRequest;
    if (!merged.fromAccount) merged.fromAccount = this.account;
    return this.callInto<PositionTransferRecord>('position_transfer', merged);
  }

  /** Query internal position transfer records. Uses `accountId` (wire: `account_id`). */
  async getPositionTransferRecords(
    req: PositionTransferRecordsRequest,
  ): Promise<PositionTransferRecord[]> {
    const merged = { ...req } as PositionTransferRecordsRequest;
    if (!merged.accountId) merged.accountId = this.account;
    return this.callIntoItems<PositionTransferRecord>('position_transfer_records', merged);
  }

  /** Query single internal position transfer detail by ID. */
  async getPositionTransferDetail(
    req: PositionTransferDetailRequest,
  ): Promise<PositionTransferDetail | undefined> {
    const merged = { ...req } as PositionTransferDetailRequest;
    if (!merged.accountId) merged.accountId = this.account;
    return this.callInto<PositionTransferDetail>('position_transfer_detail', merged);
  }

  /** Query external position transfer records (DWAC / FOP / etc.). */
  async getPositionTransferExternalRecords(
    req: PositionTransferExternalRecordsRequest,
  ): Promise<PositionTransferExternalRecord[]> {
    const merged = { ...req } as PositionTransferExternalRecordsRequest;
    if (!merged.accountId) merged.accountId = this.account;
    return this.callIntoItems<PositionTransferExternalRecord>(
      'position_transfer_external_records',
      merged,
    );
  }

  /** 行权检验：预估行权/作废后正股持仓变化 (wire: option_exercise_check) */
  async checkOptionExercise(
    req: OptionExerciseCheckRequest,
  ): Promise<OptionExerciseCheckResult | undefined> {
    const merged = { ...req };
    if (!merged.account) merged.account = this.account;
    return this.callInto<OptionExerciseCheckResult>('option_exercise_check', merged);
  }

  /** 查询可行权持仓列表 (wire: option_exercise_position) */
  async getOptionExercisePositions(
    req: OptionExercisePositionRequest,
  ): Promise<OptionExercisePositionPageResult | undefined> {
    const merged = { ...req };
    if (!merged.account) merged.account = this.account;
    return this.callInto<OptionExercisePositionPageResult>('option_exercise_position', merged);
  }

  /** 提交行权/作废申请 (wire: option_exercise_submit) */
  async submitOptionExercise(req: OptionExerciseSubmitRequest): Promise<boolean> {
    const merged = { ...req };
    if (!merged.account) merged.account = this.account;
    const result = await this.callInto<boolean>('option_exercise_submit', merged);
    return result ?? false;
  }

  /** 分页查询行权记录 (wire: option_exercise_record) */
  async getOptionExerciseRecords(
    req: OptionExerciseRecordsRequest,
  ): Promise<OptionExerciseRecordPageResult | undefined> {
    const merged = { ...req };
    if (!merged.account) merged.account = this.account;
    return this.callInto<OptionExerciseRecordPageResult>('option_exercise_record', merged);
  }

  /** 撤销行权申请 (wire: option_exercise_cancel) */
  async cancelOptionExercise(req: OptionExerciseCancelRequest): Promise<boolean> {
    const merged = { ...req };
    if (!merged.account) merged.account = this.account;
    const result = await this.callInto<boolean>('option_exercise_cancel', merged);
    return result ?? false;
  }
}
