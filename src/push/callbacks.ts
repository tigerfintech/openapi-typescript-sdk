/**
 * 推送回调函数类型定义
 *
 * 每种推送类型独立回调，连接状态回调独立管理。
 */
import type {
  QuoteData, TickData, DepthData, KlineData,
  AssetData, PositionData, OrderData, TransactionData,
  SubjectType,
} from './push-message';

/** 行情推送回调 */
export type QuoteCallback = (data: QuoteData) => void;
/** 逐笔成交推送回调 */
export type TickCallback = (data: TickData) => void;
/** 深度行情推送回调 */
export type DepthCallback = (data: DepthData) => void;
/** K 线推送回调 */
export type KlineCallback = (data: KlineData) => void;
/** 资产变动推送回调 */
export type AssetCallback = (data: AssetData) => void;
/** 持仓变动推送回调 */
export type PositionCallback = (data: PositionData) => void;
/** 订单状态推送回调 */
export type OrderCallback = (data: OrderData) => void;
/** 成交明细推送回调 */
export type TransactionCallback = (data: TransactionData) => void;
/** 连接成功回调 */
export type ConnectCallback = () => void;
/** 断开连接回调 */
export type DisconnectCallback = () => void;
/** 错误回调 */
export type ErrorCallback = (err: Error) => void;
/** 被踢出回调 */
export type KickoutCallback = (message: string) => void;
/** 订阅成功回调 */
export type SubscribeCallback = (subject: SubjectType, symbols: string[]) => void;
/** 退订成功回调 */
export type UnsubscribeCallback = (subject: SubjectType, symbols: string[]) => void;

/** 所有回调函数的集合 */
export interface Callbacks {
  // 行情推送回调
  onQuote?: QuoteCallback;
  onTick?: TickCallback;
  onDepth?: DepthCallback;
  onOption?: QuoteCallback;
  onFuture?: QuoteCallback;
  onKline?: KlineCallback;
  onStockTop?: QuoteCallback;
  onOptionTop?: QuoteCallback;
  onFullTick?: TickCallback;
  onQuoteBBO?: QuoteCallback;
  // 账户推送回调
  onAsset?: AssetCallback;
  onPosition?: PositionCallback;
  onOrder?: OrderCallback;
  onTransaction?: TransactionCallback;
  // 连接状态回调
  onConnect?: ConnectCallback;
  onDisconnect?: DisconnectCallback;
  onError?: ErrorCallback;
  onKickout?: KickoutCallback;
  onSubscribe?: SubscribeCallback;
  onUnsubscribe?: UnsubscribeCallback;
}
