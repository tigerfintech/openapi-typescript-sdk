/**
 * Trade response models (Asset / PrimeAsset / order result / transaction).
 */
import type { Order } from './order';

export interface AssetSegment {
  account?: string;
  category?: string;
  title?: string;
  netLiquidation?: number;
  cashValue?: number;
  availableFunds?: number;
  equityWithLoan?: number;
  excessLiquidity?: number;
  accruedCash?: number;
  accruedDividend?: number;
  initMarginReq?: number;
  maintMarginReq?: number;
  grossPositionValue?: number;
  leverage?: number;
}

export interface Asset {
  account?: string;
  capability?: string;
  currency?: string;
  buyingPower?: number;
  cashValue?: number;
  netLiquidation?: number;
  realizedPnL?: number;
  unrealizedPnL?: number;
  segments?: AssetSegment[];
}

export interface CurrencyAsset {
  currency?: string;
  cashBalance?: number;
  cashAvailableForTrade?: number;
  forexRate?: number;
}

export interface PrimeAssetSegment {
  capability?: string;
  category?: string;
  currency?: string;
  cashBalance?: number;
  cashAvailableForTrade?: number;
  grossPositionValue?: number;
  equityWithLoan?: number;
  netLiquidation?: number;
  initMargin?: number;
  maintainMargin?: number;
  overnightMargin?: number;
  unrealizedPL?: number;
  unrealizedPLByCostOfCarry?: number;
  realizedPL?: number;
  totalTodayPL?: number;
  excessLiquidation?: number;
  overnightLiquidation?: number;
  buyingPower?: number;
  lockedFunds?: number;
  leverage?: number;
  uncollected?: number;
  currencyAssets?: CurrencyAsset[];
  consolidatedSegTypes?: string[];
}

export interface PrimeAsset {
  accountId: string;
  updateTimestamp?: number;
  segments: PrimeAssetSegment[];
}

export interface PreviewResult {
  account?: string;
  isPass: boolean;
  commission?: number;
  commissionCurrency?: string;
  marginCurrency?: string;
  initMargin?: number;
  initMarginBefore?: number;
  maintMargin?: number;
  maintMarginBefore?: number;
  equityWithLoan?: number;
  equityWithLoanBefore?: number;
  availableEE?: number;
  excessLiquidity?: number;
  overnightLiquidation?: number;
  gst?: number;
  message?: string;
}

export interface PlaceOrderResult {
  /** int64 order ID — may be a string when it exceeds Number.MAX_SAFE_INTEGER */
  id: number | string;
  /** Account-level order ID; the server returns snake_case `order_id` */
  order_id?: number | string;
  subIds?: (number | string)[];
  orders?: Order[];
}

export interface OrderIdResult {
  /** int64 order ID — may be a string when it exceeds Number.MAX_SAFE_INTEGER */
  id: number | string;
}

export interface Transaction {
  id?: number;
  orderId?: number;
  /** Numeric account ID (wire: accountId). */
  accountId?: number;
  account?: string;
  symbol?: string;
  secType?: string;
  market?: string;
  currency?: string;
  identifier?: string;
  action?: string;
  /** Order/commission price. */
  price?: number;
  /** Fill price (wire: filledPrice). */
  filledPrice?: number;
  quantity?: number;
  filledQuantity?: number;
  /** Scale for filledQuantity (wire: filledQuantityScale). */
  filledQuantityScale?: number;
  /** Order amount. */
  amount?: number;
  /** Fill amount (wire: filledAmount). */
  filledAmount?: number;
  commission?: number;
  /** Fill timestamp string, format "YYYY-MM-DD HH:MM:SS" (server returns string, not number). */
  transactedAt?: string;
  /** Fill time as Unix millisecond timestamp (wire: transactionTime). */
  transactionTime?: number;
  /** Legacy time field. */
  time?: number;
}

// ===== v0.4.0 新增响应类型 =====

export interface ManagedAccount {
  account?: string;
  accountType?: string;
  capability?: string;
  status?: string;
}

export interface AnalyticsAsset {
  date?: string;
  holdingValue?: number;
  cashBalance?: number;
  pnl?: number;
  pnlRate?: number;
  netValueIndex?: number;
  currency?: string;
  segType?: string;
}

export interface AggregateAssets {
  accountId?: string;
  netLiquidation?: number;
  grossPositionValue?: number;
  cashBalance?: number;
  baseCurrency?: string;
  currencyAssets?: CurrencyAsset[];
}

export interface EstimateTradableQuantity {
  tradableQuantity?: number;
  maxCashBuyQuantity?: number;
  maxMarginBuyQuantity?: number;
  maxShortSellQuantity?: number;
  maxPositionSellQuantity?: number;
  cashBuyingPower?: number;
  currency?: string;
}

/**
 * Forex order response.
 *
 * Server returns `id` as a JSON number (matches `PlaceOrderResult.id`).
 * The Rust / Go SDKs confirmed this on live integ — earlier the type here
 * was `string`, which the loose JS typing silently accepted while Rust /
 * Go crashed on the mismatch. Kept as `number | string` for backward
 * compatibility with any caller relying on the old typing.
 */
export interface ForexOrderResult {
  /** int64 forex order ID; may be a string when exceeding Number.MAX_SAFE_INTEGER */
  id?: number | string;
  status?: string;
  sourceCurrency?: string;
  targetCurrency?: string;
  sourceAmount?: number;
  targetAmount?: number;
  rate?: number;
  submitTime?: number;
}

/** Segment fund available item (segment_fund_available response). */
export interface SegmentFundAvailableItem {
  fromSegment?: string;
  currency?: string;
  amount?: number;
}

/** Segment fund transfer/cancel response. */
export interface SegmentFund {
  id?: string | number;
  fromSegment?: string;
  toSegment?: string;
  currency?: string;
  amount?: number;
  status?: string;
  statusDesc?: string;
  message?: string;
  settledAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface SegmentFundHistoryItem {
  id?: number;
  fromSegment?: string;
  toSegment?: string;
  currency?: string;
  amount?: number;
  status?: string;
  statusDesc?: string;
  settledAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface FundDetails {
  /** int64 fund-detail ID — server may return as string (e.g. "4733519770"). */
  id?: string | number;
  account?: string;
  segType?: string;
  fundType?: string;
  currency?: string;
  amount?: number;
  balance?: number;
  occurTime?: number;
  remark?: string;
  externalId?: string;
}

export interface FundingHistoryItem {
  id?: number;
  refId?: string;
  type?: number;
  typeDesc?: string;
  currency?: string;
  amount?: number;
  businessDate?: string;
  status?: string;
  statusDesc?: string;
  completedStatus?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface TransferItem {
  symbol?: string;
  quantity?: number;
  expiry?: string;
  strike?: string;
  right?: string;
  secType?: string;
}

export interface PositionTransferRecord {
  id?: string;
  fromAccount?: string;
  toAccount?: string;
  market?: string;
  status?: string;
  submitTime?: number;
  transfers?: TransferItem[];
}

export interface PositionTransferDetail {
  id?: string;
  fromAccount?: string;
  toAccount?: string;
  market?: string;
  status?: string;
  submitTime?: number;
  updateTime?: number;
  transfers?: TransferItem[];
  remark?: string;
}

export interface PositionTransferExternalRecord {
  id?: string;
  market?: string;
  symbol?: string;
  quantity?: number;
  direction?: string;
  status?: string;
  submitTime?: number;
  updateTime?: number;
}

/** 行权检验结果 */
export interface OptionExerciseCheckResult {
  availableQuantity: number;
  position: number;
  stkPosition: number;
  stkPositionChange: number;
  stkPositionBefore: number;
  stkPositionAfter: number;
  symbol?: string;
}

/** 可行权期权持仓条目 */
export interface OptionExercisePosition {
  contractId?: number;
  symbol?: string;
  stkSymbol?: string;
  expireDate?: string;
  strike?: string;
  callPut?: string;
  market?: string;
  accountId?: number;
  position: number;
  availableQuantity: number;
}

/** 可行权持仓分页结果 */
export interface OptionExercisePositionPageResult {
  pageNum: number;
  pageSize: number;
  itemCount: number;
  pageCount: number;
  items?: OptionExercisePosition[];
}

/** 行权申请记录条目 */
export interface OptionExerciseRecord {
  id?: number;
  contractId?: number;
  symbol?: string;
  stkSymbol?: string;
  expireDate?: string;
  strike?: string;
  callPut?: string;
  /** Exercise | Expire */
  type?: string;
  requestQuantity: number;
  quantity: number;
  /** New | Cancel | Success | Fail */
  status?: string;
  executingDate?: string;
  itmRate: number;
  isForce: boolean;
  reason?: string;
  accountId?: number;
}

/** 行权记录分页结果 */
export interface OptionExerciseRecordPageResult {
  pageNum: number;
  pageSize: number;
  itemCount: number;
  pageCount: number;
  items?: OptionExerciseRecord[];
}
