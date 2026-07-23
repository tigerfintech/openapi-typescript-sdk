/**
 * 枚举类型定义
 * 所有枚举值与 API JSON 保持一致
 */

/** 市场枚举 */
export enum Market {
  All = 'ALL',
  US = 'US',
  HK = 'HK',
  CN = 'CN',
  SG = 'SG',
}

/** 证券类型枚举 */
export enum SecurityType {
  All = 'ALL',
  STK = 'STK',
  OPT = 'OPT',
  WAR = 'WAR',
  IOPT = 'IOPT',
  FUT = 'FUT',
  FOP = 'FOP',
  CASH = 'CASH',
  MLEG = 'MLEG',
  FUND = 'FUND',
}

/** 货币枚举 */
export enum Currency {
  All = 'ALL',
  USD = 'USD',
  HKD = 'HKD',
  CNH = 'CNH',
  SGD = 'SGD',
}

/** 订单类型枚举 */
export enum OrderType {
  MKT = 'MKT',
  LMT = 'LMT',
  STP = 'STP',
  STP_LMT = 'STP_LMT',
  TRAIL = 'TRAIL',
  AM = 'AM',
  AL = 'AL',
  TWAP = 'TWAP',
  VWAP = 'VWAP',
  OCA = 'OCA',
  ICEBERG = 'ICEBERG',
}

/** 冰山单价格类型 */
export enum PriceType {
  /** 限价 */
  LIMIT_PRICE = 'LIMIT_PRICE',
  /** 卖一价 */
  ASK_PRICE = 'ASK_PRICE',
  /** 买一价 */
  BID_PRICE = 'BID_PRICE',
  /** 最新价 */
  LATEST_PRICE = 'LATEST_PRICE',
}

/**
 * 订单状态枚举。对齐 Java SDK OrderStatus 定义。
 *
 * 服务端 wire 返回的值同时可能是:
 * - 数字: -2 / -1 / 3 / 4 / 5 / 6 / 7 / 8
 * - 字符串: "Invalid" / "Initial" / "PendingCancel" / "Cancelled" /
 *           "Submitted" / "Filled" / "Inactive" / "PendingSubmit"
 *
 * Client 层通过 normalizeOrderStatus() 做数字→字符串归一,不做跨别名合并。
 */
export enum OrderStatus {
  Invalid = 'Invalid',
  Initial = 'Initial',
  PendingCancel = 'PendingCancel',
  Cancelled = 'Cancelled',
  Submitted = 'Submitted',
  Filled = 'Filled',
  Inactive = 'Inactive',
  PendingSubmit = 'PendingSubmit',
}

/** 返回订单状态对应的服务端数字码,未知返回 0。 */
export function orderStatusCode(status: OrderStatus | string): number {
  switch (status) {
    case OrderStatus.Invalid:
      return -2;
    case OrderStatus.Initial:
      return -1;
    case OrderStatus.PendingCancel:
      return 3;
    case OrderStatus.Cancelled:
      return 4;
    case OrderStatus.Submitted:
      return 5;
    case OrderStatus.Filled:
      return 6;
    case OrderStatus.Inactive:
      return 7;
    case OrderStatus.PendingSubmit:
      return 8;
  }
  return 0;
}

/** K 线周期枚举 */
export enum BarPeriod {
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Year = 'year',
  Min1 = '1min',
  Min5 = '5min',
  Min15 = '15min',
  Min30 = '30min',
  Min60 = '60min',
}

/** 语言枚举 */
export enum Language {
  ZhCN = 'zh_CN',
  ZhTW = 'zh_TW',
  EnUS = 'en_US',
}

/** 复权类型枚举 */
export enum QuoteRight {
  /** 前复权 */
  Br = 'br',
  /** 不复权 */
  Nr = 'nr',
}

/** 牌照类型枚举 */
export enum License {
  TBNZ = 'TBNZ',
  TBSG = 'TBSG',
  TBHK = 'TBHK',
  TBAU = 'TBAU',
  TBUS = 'TBUS',
}

/** 订单有效期枚举 */
export enum TimeInForce {
  DAY = 'DAY',
  GTC = 'GTC',
  GTD = 'GTD',
  OPG = 'OPG',
}

/** 订单排序字段 */
export enum OrderSortBy {
  LatestCreated = 'LATEST_CREATED',
  LatestStatusUpdated = 'LATEST_STATUS_UPDATED',
}

/** 账户分部类型 */
export enum SegmentType {
  All = 'ALL',
  Sec = 'SEC',
  Fut = 'FUT',
  Fund = 'FUND',
}

/** 公司行动类型 */
export enum CorporateActionType {
  Split = 'split',
  Dividend = 'dividend',
  Earning = 'earning',
  SymbolChange = 'symbol_change',
  Delisting = 'delisting',
  IPO = 'ipo',
}

/** 行业级别 (1~4 级) */
export enum IndustryLevel {
  GSector = 'GSECTOR',
  GGroup = 'GGROUP',
  GInd = 'GIND',
  GSubInd = 'GSUBIND',
}

/** 排序方向 */
export enum SortDirection {
  No = 'SortDir_No',
  Ascend = 'SortDir_Ascend',
  Descend = 'SortDir_Descend',
}

/** 期权分析周期 */
export enum OptionAnalysisPeriod {
  ThreeYear = '3year',
  FiftyTwoWeek = '52week',
  TwentySixWeek = '26week',
  ThirteenWeek = '13week',
}

/** 财报类型 */
export enum FinancialReportPeriod {
  Annual = 'Annual',
  Quarterly = 'Quarterly',
  LTM = 'LTM',
}
