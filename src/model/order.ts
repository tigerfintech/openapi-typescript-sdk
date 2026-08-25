/**
 * Order response / request models.
 *
 * TypeScript uses camelCase field names idiomatically. The client layer
 * transparently converts request camelCase to snake_case before sending;
 * server responses are already camelCase so they decode directly.
 */

/** Attached leg order (profit / loss) — response side */
export interface OrderLeg {
  legType?: string;
  price?: number;
  timeInForce?: string;
  quantity?: number;
}

/**
 * Algo order parameters — response side.
 *
 * The response shape flattens the [{tag, value}, ...] wire form into an
 * object, and the server historically emits `startTime` / `endTime` as
 * epoch-ms numbers (matching what the request side sends). Some legacy
 * paths still return the raw string; accept both.
 *
 * Note: `algoStrategy` on the response side is server-echoed; on the
 * request side it lives on `OrderRequest`, not `AlgoParamsRequest`.
 */
export interface AlgoParams {
  algoStrategy?: string;
  /** Epoch-ms; server may echo as string on legacy paths */
  startTime?: number | string;
  /** Epoch-ms; server may echo as string on legacy paths */
  endTime?: number | string;
  /** Whether to minimize trade count (VWAP) */
  noTakeLiq?: boolean;
  /** Whether to allow completion after end_time (TWAP / VWAP) */
  allowPastEndTime?: boolean;
  /** Participation rate 0.01–0.5 (VWAP only) */
  participationRate?: number;
}

/** Order response model (returned by order query methods). */
export interface Order {
  account?: string;
  /** int64 order ID — may be a string when it exceeds Number.MAX_SAFE_INTEGER */
  id?: number | string;
  orderId?: number | string;
  externalId?: string;
  action?: string;
  orderType?: string;
  totalQuantity?: number;
  totalQuantityScale?: number;
  filledQuantity?: number;
  filledQuantityScale?: number;
  filledCashAmount?: number;
  limitPrice?: number;
  auxPrice?: number;
  trailingPercent?: number;
  status?: string;
  avgFillPrice?: number;
  timeInForce?: string;
  outsideRth?: boolean;
  orderLegs?: OrderLeg[];
  algoParams?: AlgoParams;
  algoStrategy?: string;
  symbol?: string;
  secType?: string;
  market?: string;
  currency?: string;
  expiry?: string;
  strike?: string;
  right?: string;
  identifier?: string;
  name?: string;
  commission?: number;
  gst?: number;
  realizedPnl?: number;
  openTime?: number;
  updateTime?: number;
  latestTime?: number;
  latestPrice?: number;
  remark?: string;
  source?: string;
  userMark?: string;
  liquidation?: boolean;
  discount?: number;
  replaceStatus?: string;
  cancelStatus?: string;
  canModify?: boolean;
  canCancel?: boolean;
  isOpen?: boolean;
  orderDiscount?: number;
  tradingSessionType?: string;
  attrDesc?: string;
  attrList?: string[];
}

/**
 * OrderRequest — order request model used by placeOrder / previewOrder / modifyOrder.
 * Fields are camelCase in TypeScript; the client converts them to snake_case on the wire.
 */
export interface OrderRequest {
  /** Account ID (client fills it in automatically) */
  account?: string;
  /** Global order ID (required for modify) */
  id?: number;
  /** Institutional account trading key (client fills it in automatically if set) */
  secretKey?: string;
  /** Account-level order ID */
  orderId?: number;
  /** BUY / SELL */
  action: string;
  /** Order type: MKT / LMT / STP / STP_LMT / TRAIL / AM / AL / TWAP / VWAP / OCA */
  orderType: string;
  /** Total quantity */
  totalQuantity: number;
  /** Limit price (required for LMT / STP_LMT) */
  limitPrice?: number;
  /** Stop / trigger price (required for STP / STP_LMT / TRAIL) */
  auxPrice?: number;
  /** Trailing stop percent */
  trailingPercent?: number;
  /** DAY / GTC / GTD / OPG */
  timeInForce: string;
  /** Allow extended-hours trading */
  outsideRth?: boolean;
  /** Attached legs (profit / loss) */
  orderLegs?: OrderLegRequest[];
  /** Algo parameters */
  algoParams?: AlgoParamsRequest;
  /** Contract symbol */
  symbol: string;
  /** STK / OPT / FUT / WAR / IOPT */
  secType: string;
  /** Market */
  market?: string;
  /** Currency */
  currency?: string;
  /** Option expiry */
  expiry?: string;
  /** Option strike */
  strike?: string;
  /** CALL / PUT */
  right?: string;
  /** Contract identifier */
  identifier?: string;
  /** Remark */
  remark?: string;
  /** User mark */
  userMark?: string;
  /** 冰山单：展示数量 */
  displaySize?: number;
  /** 冰山单：最小展示数量 */
  minDisplaySize?: number;
  /** 冰山单：价检间隔（秒） */
  checkIntervals?: number;
  /** 冰山单：价格类型（LIMIT_PRICE / ASK_PRICE / BID_PRICE / LATEST_PRICE） */
  priceType?: string;
  /**
   * 冰山单：生效开始时间（epoch ms）。
   * Wire note: the gateway accepts both `number` (epoch ms) and `string`
   * (epoch ms as string) for ICEBERG orders; `number | string` keeps
   * TypeScript callers who pass `String(now)` from hitting a compile error.
   */
  startTime?: number | string;
  /**
   * 冰山单：生效结束时间（epoch ms）。
   * Same dual-type note as `startTime` above.
   */
  endTime?: number | string;
  /** GTD 到期时间（epoch ms） */
  expireTime?: number;
  /** 盘后委托价格 */
  afterHoursPrice?: number;
  /** 批次号 */
  batchNo?: number;
  /** 资金类型（CASH / MARGIN） */
  segType?: string;
  /** 按金额下单：委托金额 */
  amount?: number;
  /** 按金额下单：现金金额（wire: cash_amount，与 amount 二选一） */
  cashAmount?: number;
  /**
   * @deprecated 服务端不再需要此字段，by-amount 订单直接设置 `cashAmount`。
   * 保留仅为向前兼容，新代码勿使用。
   */
  isQuantityByAmount?: boolean;
  /** 账户分配列表（机构账户） */
  allocAccounts?: string[];
  /** 各账户分配份额（与 allocAccounts 一一对应） */
  allocShares?: number[];
  /** 下单来源 */
  source?: string;
  /** 下单渠道 */
  channel?: string;
  /** 虚拟订单类型 */
  virtualOrderType?: string;
  /** 虚拟订单 ID */
  virtualId?: string;
  /** 止盈订单 ID（bracket 关联） */
  profitTakerOrderId?: number;
  /** 止损订单 ID（bracket 关联） */
  stopLossOrderId?: number;
  /** 本地流水号 */
  localNo?: string;
  /** OCA 订单组（One-Cancels-All） */
  ocaOrders?: OrderRequest[];
  /** 多腿期权各腿（MLEG） */
  contractLegs?: ContractLegRequest[];
  /** 组合单类型（如 MLEG） */
  comboType?: string;
  /**
   * Algo strategy name for TWAP / VWAP orders (e.g. `'TWAP'`, `'VWAP'`).
   * Lives on `OrderRequest`, not inside `algoParams` — the Python SDK
   * places it at the top-level order object, and the gateway expects
   * `algo_strategy` as a sibling of `algo_params`.
   *
   * Note: `AlgoParamsRequest` intentionally omits this field (see its
   * doc-comment). Pass `algoStrategy` here and `algoParams` as the
   * companion object.
   */
  algoStrategy?: string;
}

/** Single leg of a multi-leg option order (MLEG) */
export interface ContractLegRequest {
  symbol?: string;
  secType?: string;
  expiry?: string;
  strike?: string;
  right?: string;
  action?: string;
  ratio?: number;
}

/** Attached profit/loss leg for order request side */
export interface OrderLegRequest {
  legType: string;
  price?: number;
  timeInForce?: string;
  quantity?: number;
}

/**
 * Algo parameters for request side (TWAP / VWAP).
 *
 * Fields match the Python SDK's AlgoParams. On the wire, the SDK marshals
 * this object into the `[{tag, value}, ...]` array shape the gateway
 * expects — callers should just pass the natural object.
 *
 * `algoStrategy` is intentionally not here: it lives on the parent
 * `OrderRequest`, not inside `algoParams`.
 */
export interface AlgoParamsRequest {
  /** Epoch-ms start time (TWAP / VWAP only) */
  startTime?: number;
  /** Epoch-ms end time (TWAP / VWAP only) */
  endTime?: number;
  /** Try to minimize trade count (VWAP only) */
  noTakeLiq?: boolean;
  /** Allow completing after end_time (TWAP / VWAP only) */
  allowPastEndTime?: boolean;
  /** Participation rate 0.01–0.5 (VWAP only) */
  participationRate?: number;
}
