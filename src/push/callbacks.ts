/**
 * 推送回调函数类型定义（Protobuf 协议）
 *
 * 每种推送类型独立回调，参数类型为 Protobuf 生成的类型。
 * 连接状态回调独立管理。
 */
import type { QuoteData } from './pb/QuoteData';
import type { QuoteDepthData } from './pb/QuoteDepthData';
import type { TradeTickData } from './pb/TradeTickData';
import type { TickData } from './pb/TickData';
import type { AssetData } from './pb/AssetData';
import type { PositionData } from './pb/PositionData';
import type { OrderStatusData } from './pb/OrderStatusData';
import type { OrderTransactionData } from './pb/OrderTransactionData';
import type { StockTopData } from './pb/StockTopData';
import type { OptionTopData } from './pb/OptionTopData';
import type { KlineData } from './pb/KlineData';

/** 所有回调函数的集合 */
export interface Callbacks {
  // 行情推送回调（Protobuf 类型）
  onQuote?: (data: QuoteData) => void;
  onTick?: (data: TradeTickData) => void;
  onDepth?: (data: QuoteDepthData) => void;
  onOption?: (data: QuoteData) => void;
  onFuture?: (data: QuoteData) => void;
  onKline?: (data: KlineData) => void;
  onStockTop?: (data: StockTopData) => void;
  onOptionTop?: (data: OptionTopData) => void;
  onFullTick?: (data: TickData) => void;
  onQuoteBBO?: (data: QuoteData) => void;
  // 账户推送回调（Protobuf 类型）
  onAsset?: (data: AssetData) => void;
  onPosition?: (data: PositionData) => void;
  onOrder?: (data: OrderStatusData) => void;
  onTransaction?: (data: OrderTransactionData) => void;
  // 连接状态回调
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (err: Error) => void;
  onKickout?: (message: string) => void;
}
