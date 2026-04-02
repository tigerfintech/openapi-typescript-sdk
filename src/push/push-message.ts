/**
 * 推送消息类型定义和数据结构
 *
 * 定义 WebSocket 推送消息的类型、主题和数据结构，
 * 使用 JSON 序列化/反序列化（简化替代 Protobuf）。
 */

/** 推送消息类型 */
export enum MessageType {
  // 连接相关
  Connect = 'connect',
  Connected = 'connected',
  Disconnect = 'disconnect',
  Heartbeat = 'heartbeat',
  Kickout = 'kickout',
  Error = 'error',
  // 订阅相关
  Subscribe = 'subscribe',
  Unsubscribe = 'unsubscribe',
  // 行情推送
  Quote = 'quote',
  Tick = 'tick',
  Depth = 'depth',
  Option = 'option',
  Future = 'future',
  Kline = 'kline',
  StockTop = 'stock_top',
  OptionTop = 'option_top',
  FullTick = 'full_tick',
  QuoteBBO = 'quote_bbo',
  // 账户推送
  Asset = 'asset',
  Position = 'position',
  Order = 'order',
  Transaction = 'transaction',
}

/** 订阅主题类型 */
export enum SubjectType {
  Quote = 'quote',
  Tick = 'tick',
  Depth = 'depth',
  Option = 'option',
  Future = 'future',
  Kline = 'kline',
  StockTop = 'stock_top',
  OptionTop = 'option_top',
  FullTick = 'full_tick',
  QuoteBBO = 'quote_bbo',
  Asset = 'asset',
  Position = 'position',
  Order = 'order',
  Transaction = 'transaction',
}

/** 推送消息通用结构 */
export interface PushMessage {
  type: MessageType;
  subject?: SubjectType | string;
  data?: unknown;
}

/** 连接认证请求 */
export interface ConnectRequest {
  tigerId: string;
  sign: string;
  timestamp: string;
  version: string;
}

/** 订阅/退订请求 */
export interface SubscribeRequest {
  subject: SubjectType;
  symbols?: string[];
  account?: string;
  market?: string;
}

/** 行情推送数据 */
export interface QuoteData {
  symbol: string;
  latestPrice?: number;
  preClose?: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  amount?: number;
  timestamp?: number;
}

/** 逐笔成交推送数据 */
export interface TickData {
  symbol: string;
  price: number;
  volume: number;
  type?: string;
  timestamp?: number;
}

/** 价格档位 */
export interface PriceLevel {
  price: number;
  volume: number;
  count?: number;
}

/** 深度行情推送数据 */
export interface DepthData {
  symbol: string;
  asks?: PriceLevel[];
  bids?: PriceLevel[];
}

/** K 线推送数据 */
export interface KlineData {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp?: number;
}

/** 资产推送数据 */
export interface AssetData {
  account: string;
  netLiquidation?: number;
  equityWithLoan?: number;
  cashBalance?: number;
  buyingPower?: number;
  currency?: string;
}

/** 持仓推送数据 */
export interface PositionData {
  account: string;
  symbol: string;
  secType?: string;
  quantity: number;
  averageCost?: number;
  marketPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
}

/** 订单推送数据 */
export interface OrderData {
  account: string;
  id?: number;
  orderId?: number;
  symbol: string;
  action?: string;
  orderType?: string;
  quantity?: number;
  limitPrice?: number;
  status?: string;
  filled?: number;
  avgFillPrice?: number;
}

/** 成交推送数据 */
export interface TransactionData {
  account: string;
  id?: number;
  orderId?: number;
  symbol: string;
  action?: string;
  price?: number;
  quantity?: number;
  timestamp?: number;
}

/**
 * 创建推送消息
 */
export function createPushMessage(
  type: MessageType,
  subject?: SubjectType | string,
  data?: unknown,
): PushMessage {
  const msg: PushMessage = { type };
  if (subject) msg.subject = subject;
  if (data !== undefined) msg.data = data;
  return msg;
}

/**
 * 序列化推送消息为 JSON 字符串
 */
export function serializeMessage(msg: PushMessage): string {
  return JSON.stringify(msg);
}

/**
 * 反序列化 JSON 字符串为推送消息
 */
export function deserializeMessage(data: string): PushMessage {
  return JSON.parse(data) as PushMessage;
}
