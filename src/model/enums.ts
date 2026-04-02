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
}

/** 订单状态枚举 */
export enum OrderStatus {
  PendingNew = 'PendingNew',
  Initial = 'Initial',
  Submitted = 'Submitted',
  PartiallyFilled = 'PartiallyFilled',
  Filled = 'Filled',
  Cancelled = 'Cancelled',
  PendingCancel = 'PendingCancel',
  Inactive = 'Inactive',
  Invalid = 'Invalid',
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
  OPG = 'OPG',
}
