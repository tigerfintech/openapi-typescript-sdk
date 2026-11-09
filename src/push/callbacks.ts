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
import type { PushTradeTick } from './tick-util';

/** 所有回调函数的集合 */
export interface Callbacks {
  // 行情推送回调（Protobuf 类型）
  onQuote?: (data: QuoteData) => void;
  onTick?: (data: PushTradeTick) => void;
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

export type { TradeTickData };
