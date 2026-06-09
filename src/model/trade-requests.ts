/**
 * Trade request interfaces (v0.4.0).
 *
 * 所有字段可选(用户调用时传一个空对象即可);字段名用 camelCase,
 * client 层通过 keysToSnakeCase 转成服务端 wire 真名的 snake_case。
 * **字段名设计规则:camelCase → snake_case 后必须等于服务端 wire 真名。**
 * 比如 Trade 用 `startDate`/`endDate`(wire `start_date`/`end_date`),
 * 不用 `startTime`/`endTime`(会被转成 `start_time`/`end_time`,与 wire 不符)。
 *
 * 参考 Go SDK model/trade_requests.go。
 */

export interface OrdersRequest {
  account?: string;
  secType?: string;
  market?: string;
  symbol?: string;
  /** 毫秒时间戳 (wire: start_date) */
  startDate?: number;
  /** 毫秒时间戳 (wire: end_date) */
  endDate?: number;
  limit?: number;
  isBrief?: boolean;
  /** 订单状态过滤: Invalid / Initial / PendingCancel / Cancelled / Submitted / Filled / Inactive / PendingSubmit */
  states?: string[];
  /** LATEST_CREATED / LATEST_STATUS_UPDATED */
  sortBy?: string;
  segType?: string;
  lang?: string;
  pageToken?: string;
  /** 仅 ActiveOrders 使用,按父订单 ID 过滤附加订单 */
  parentId?: number;
}

export interface GetOrderRequest {
  account?: string;
  id?: number;
  orderId?: number;
  isBrief?: boolean;
  showCharges?: boolean;
  lang?: string;
}

export interface OrderTransactionsRequest {
  account?: string;
  orderId?: number;
  symbol?: string;
  secType?: string;
  /** 毫秒时间戳 */
  startDate?: number;
  /** 毫秒时间戳 */
  endDate?: number;
  limit?: number;
  expiry?: string;
  strike?: number;
  putCall?: string;
  lang?: string;
  pageToken?: string;
}

export interface PositionsRequest {
  account?: string;
  secType?: string;
  currency?: string;
  market?: string;
  symbol?: string;
  subAccounts?: string[];
  expiry?: string;
  strike?: string;
  right?: string;
  assetQuoteType?: string;
  lang?: string;
}

export interface AssetsRequest {
  account?: string;
  subAccounts?: string[];
  segment?: boolean;
  marketValue?: boolean;
  lang?: string;
}

export interface ManagedAccountsRequest {
  account?: string;
  lang?: string;
}

export interface DerivativeContractsRequest {
  account?: string;
  symbols: string[];
  secType: string;
  expiry?: string;
  lang?: string;
}

export interface AnalyticsAssetRequest {
  account?: string;
  segType?: string;
  /** 格式 "YYYY-MM-DD" */
  startDate?: string;
  endDate?: string;
  lang?: string;
}

export interface AggregateAssetsRequest {
  account?: string;
  baseCurrency?: string;
  segType?: string;
  lang?: string;
}

export interface EstimateTradableQuantityRequest {
  account?: string;
  symbol: string;
  secType: string;
  action: string;
  orderType?: string;
  limitPrice?: number;
  market?: string;
  currency?: string;
  expiry?: string;
  strike?: string;
  right?: string;
  lang?: string;
}

export interface ForexOrderRequest {
  account?: string;
  segType?: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount?: number;
  targetAmount?: number;
  orderType?: string;
  lang?: string;
}

export interface SegmentFundRequest {
  account?: string;
  id?: string;
  fromSegment?: string;
  toSegment?: string;
  currency?: string;
  amount?: number;
  limit?: number;
  lang?: string;
}

export interface FundDetailsRequest {
  account?: string;
  segTypes?: string[];
  fundType?: string;
  currency?: string;
  /** 毫秒时间戳 */
  startDate?: number;
  /** 毫秒时间戳 */
  endDate?: number;
  limit?: number;
  pageToken?: string;
  lang?: string;
}

export interface FundingHistoryRequest {
  account?: string;
  segType?: string;
  currency?: string;
  /** 毫秒时间戳 */
  startDate?: number;
  /** 毫秒时间戳 */
  endDate?: number;
  limit?: number;
  lang?: string;
}

export interface PositionTransferRequest {
  fromAccount?: string;
  toAccount: string;
  market?: string;
  transfers: Array<{
    symbol?: string;
    quantity?: number;
    expiry?: string;
    strike?: string;
    right?: string;
    secType?: string;
  }>;
  lang?: string;
}

export interface PositionTransferRecordsRequest {
  /** wire: account_id */
  accountId?: string;
  sinceDate?: string;
  toDate?: string;
  market?: string;
  limit?: number;
  lang?: string;
}

export interface PositionTransferDetailRequest {
  accountId?: string;
  id: string;
  lang?: string;
}

export interface PositionTransferExternalRecordsRequest {
  accountId?: string;
  sinceDate?: string;
  toDate?: string;
  market?: string;
  limit?: number;
  lang?: string;
}

/** 行权检验请求 (wire: option_exercise_check) */
export interface OptionExerciseCheckRequest {
  account?: string;
  secretKey?: string;
  /** 期权合约 ID */
  contractId: number;
  /** Exercise | Expire */
  type: string;
  quantity?: number;
  /** yyyy-MM-dd，Exercise 类型建议填 */
  executingDate?: string;
  /** Exercise 类型建议填 */
  isForce?: boolean;
  /** 0–10，Expire 类型专用 */
  itmRate?: number;
  lang?: string;
}

/** 查询可行权持仓请求 (wire: option_exercise_position) */
export interface OptionExercisePositionRequest {
  account?: string;
  secretKey?: string;
  /** Exercise | Expire */
  type: string;
  lang?: string;
}

/** 提交行权申请请求 (wire: option_exercise_submit) */
export interface OptionExerciseSubmitRequest {
  account?: string;
  secretKey?: string;
  contractId: number;
  /** Exercise | Expire */
  type: string;
  quantity: number;
  /** Exercise 必填，yyyy-MM-dd */
  executingDate?: string;
  /** Exercise 必填 */
  isForce?: boolean;
  /** 0–10，Expire 专用 */
  itmRate?: number;
  lang?: string;
}

/** 分页查询行权记录请求 (wire: option_exercise_record) */
export interface OptionExerciseRecordsRequest {
  account?: string;
  secretKey?: string;
  /** 从 1 开始，默认 1 */
  page?: number;
  /** 1–100，默认 20 */
  size?: number;
  /** New | Cancel | Success | Fail */
  status?: string;
  /** Exercise | Expire */
  type?: string;
  symbol?: string;
  /** symbol | expire_date | strike | is_call */
  orderBy?: string;
  lang?: string;
}

/** 撤销行权申请请求 (wire: option_exercise_cancel) */
export interface OptionExerciseCancelRequest {
  account?: string;
  secretKey?: string;
  id: number;
  lang?: string;
}
