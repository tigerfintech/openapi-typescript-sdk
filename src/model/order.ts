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

/** Algo order parameters — response side */
export interface AlgoParams {
  algoStrategy?: string;
  startTime?: string;
  endTime?: string;
  participationRate?: number;
}

/** Order response model (returned by order query methods). */
export interface Order {
  account?: string;
  id?: number;
  orderId?: number;
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
}

/** Attached leg for request side */
export interface OrderLegRequest {
  legType: string;
  price?: number;
  timeInForce?: string;
  quantity?: number;
}

/** Algo parameters for request side */
export interface AlgoParamsRequest {
  algoStrategy?: string;
  startTime?: string;
  endTime?: string;
  participationRate?: number;
}
