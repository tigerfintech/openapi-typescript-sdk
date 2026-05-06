/**
 * Quote response & request models.
 * All field names are camelCase (TypeScript idiom); request fields are
 * converted to snake_case on the wire by the client layer.
 */

// === Responses ===

export interface MarketState {
  market: string;
  marketStatus: string;
  status: string;
  openTime?: string;
}

export interface Brief {
  symbol: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  preClose?: number;
  latestPrice?: number;
  latestTime?: number;
  askPrice?: number;
  askSize?: number;
  bidPrice?: number;
  bidSize?: number;
  volume?: number;
  status?: string;
  adjPreClose?: number;
  change?: number;
  changeRate?: number;
  amplitude?: number;
  expiry?: string;
  strike?: string;
  right?: string;
  multiplier?: number;
  openInterest?: number;
}

export interface KlineItem {
  time: number;
  volume: number;
  open: number;
  close: number;
  high: number;
  low: number;
  amount?: number;
}

export interface Kline {
  symbol: string;
  period?: string;
  nextPageToken?: string;
  items: KlineItem[];
}

export interface TimelineItem {
  time: number;
  volume: number;
  price: number;
  avgPrice: number;
}

export interface TimelineBucket {
  items: TimelineItem[];
}

export interface Timeline {
  symbol: string;
  period: string;
  preClose: number;
  intraday?: TimelineBucket;
  preHours?: TimelineBucket;
  afterHours?: TimelineBucket;
}

export interface TradeTickItem {
  time: number;
  volume: number;
  price: number;
  type: string;
}

export interface TradeTick {
  symbol: string;
  beginIndex: number;
  endIndex: number;
  items: TradeTickItem[];
}

export interface DepthLevel {
  price: number;
  count: number;
  volume: number;
}

export interface Depth {
  symbol: string;
  asks: DepthLevel[];
  bids: DepthLevel[];
}

export interface OptionExpiration {
  symbol: string;
  optionSymbols?: string[];
  dates: string[];
  timestamps: number[];
  periods?: string[];
  counts?: number[];
}

export interface OptionLeg {
  identifier: string;
  strike: string;
  right: string;
  bidPrice?: number;
  bidSize?: number;
  askPrice?: number;
  askSize?: number;
  volume?: number;
  latestPrice?: number;
  preClose?: number;
  openInterest?: number;
  multiplier?: number;
  lastTimestamp?: number;
  impliedVol?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
}

export interface OptionChainRow {
  put?: OptionLeg;
  call?: OptionLeg;
}

export interface OptionChain {
  symbol: string;
  expiry: number;
  items: OptionChainRow[];
}

export interface FutureExchange {
  code: string;
  name: string;
  zoneId?: string;
}

export interface FutureContractInfo {
  continuous?: boolean;
  trade?: boolean;
  type: string;
  contractCode: string;
  ibCode?: string;
  name?: string;
  contractMonth?: string;
  lastTradingDate?: string;
  firstNoticeDate?: string;
  lastBiddingCloseTime?: number;
  currency?: string;
  exchangeCode?: string;
  multiplier?: number;
  minTick?: number;
  displayMultiplier?: number;
  exchange?: string;
  productWorth?: string;
  deliveryMode?: string;
  productType?: string;
  productScale?: string;
  lastTradingTimestamp?: number;
}

export interface FutureQuote {
  contractCode: string;
  latestPrice?: number;
  latestSize?: number;
  latestTime?: number;
  bidPrice?: number;
  askPrice?: number;
  bidSize?: number;
  askSize?: number;
  openInterest?: number;
  openInterestChange?: number;
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
  settlement?: number;
  limitUp?: number;
  limitDown?: number;
  avgPrice?: number;
}

export interface FutureKlineItem {
  time: number;
  volume: number;
  open: number;
  close: number;
  high: number;
  low: number;
  lastTime?: number;
  openInterest?: number;
  settlement?: number;
}

export interface FutureKline {
  nextPageToken?: string;
  items: FutureKlineItem[];
}

export interface FinancialDailyItem {
  symbol: string;
  field: string;
  date?: number;
  value?: number;
}

export interface FinancialReportItem {
  symbol: string;
  currency?: string;
  field: string;
  value?: string;
  filingDate?: string;
  periodEndDate?: string;
}

export interface CorporateAction {
  symbol: string;
  market?: string;
  exchange?: string;
  executeDate?: string;
  actionType?: string;
  recordDate?: string;
  announcedDate?: string;
  payDate?: string;
  amount?: number;
  currency?: string;
  fromFactor?: number;
  toFactor?: number;
}

export interface CapitalFlowItem {
  time: string;
  timestamp: number;
  netInflow: number;
}

export interface CapitalFlow {
  symbol: string;
  period?: string;
  items: CapitalFlowItem[];
}

export interface CapitalDistribution {
  symbol: string;
  netInflow: number;
  inAll: number;
  inBig: number;
  inMid: number;
  inSmall: number;
  outAll: number;
  outBig: number;
  outMid: number;
  outSmall: number;
}

export interface ScannerDataRow {
  index: number;
  name: string;
  value?: string;
  data?: number;
}

export interface ScannerResultItem {
  symbol: string;
  market: string;
  baseDataList?: ScannerDataRow[];
  accumulateDataList?: ScannerDataRow[];
  financialDataList?: ScannerDataRow[];
  multiTagDataList?: ScannerDataRow[];
}

export interface ScannerResult {
  page: number;
  totalPage: number;
  totalCount: number;
  pageSize: number;
  cursorId?: string;
  items: ScannerResultItem[];
}

export interface QuotePermission {
  name: string;
  expireAt: number;
}

// === Request objects for complex endpoints ===

export interface FinancialDailyRequest {
  symbols: string[];
  market: string;
  fields: string[];
  beginDate: string;
  endDate: string;
}

export interface FinancialReportRequest {
  symbols: string[];
  market: string;
  fields: string[];
  periodType: string;
  beginDate?: string;
  endDate?: string;
}

export interface CorporateActionRequest {
  symbols: string[];
  market: string;
  actionType: string;
  beginDate?: string;
  endDate?: string;
}

export interface FutureKlineRequest {
  contractCodes: string[];
  period: string;
  /** Use -1 for unbounded */
  beginTime: number;
  /** Use -1 for unbounded */
  endTime: number;
  limit?: number;
  pageToken?: string;
}

export interface MarketScannerRequest {
  market: string;
  page?: number;
  pageSize?: number;
  cursorId?: string;
  baseFilterList?: Array<Record<string, unknown>>;
  accumulateFilterList?: Array<Record<string, unknown>>;
  financialFilterList?: Array<Record<string, unknown>>;
  multiTagsFilterList?: Array<Record<string, unknown>>;
  sortFieldData?: Record<string, unknown>;
  multiTagsFields?: string[];
}
