/**
 * Protobuf 生成代码统一导出
 *
 * 由 ts-proto 从 proto 文件生成的所有类型、枚举和编解码函数
 */

// 基础层：命令和数据类型枚举
export {
  SocketCommon_Command,
  SocketCommon_DataType,
  SocketCommon_QuoteType,
} from './SocketCommon';
export type { SocketCommon } from './SocketCommon';

// 协议层：请求和响应消息
export { Request, Request_Connect, Request_Subscribe } from './Request';
export type {
  Request as RequestType,
  Request_Connect as RequestConnectType,
  Request_Subscribe as RequestSubscribeType,
} from './Request';

export { Response } from './Response';
export type { Response as ResponseType } from './Response';

export { PushData } from './PushData';
export type { PushData as PushDataType } from './PushData';

// 数据层：业务数据消息
export { QuoteData } from './QuoteData';
export type { QuoteData as QuoteDataType, QuoteData_Minute } from './QuoteData';

export { QuoteBasicData } from './QuoteBasicData';
export type { QuoteBasicData as QuoteBasicDataType } from './QuoteBasicData';

export { QuoteBBOData } from './QuoteBBOData';
export type { QuoteBBOData as QuoteBBODataType } from './QuoteBBOData';

export { QuoteDepthData } from './QuoteDepthData';
export type { QuoteDepthData as QuoteDepthDataType, QuoteDepthData_OrderBook } from './QuoteDepthData';

export { TradeTickData } from './TradeTickData';
export type { TradeTickData as TradeTickDataType, TradeTickData_MergedVol } from './TradeTickData';

export { TickData } from './TickData';
export type { TickData as TickDataType, TickData_Tick } from './TickData';

export { AssetData } from './AssetData';
export type { AssetData as AssetDataType } from './AssetData';

export { PositionData } from './PositionData';
export type { PositionData as PositionDataType } from './PositionData';

export { OrderStatusData } from './OrderStatusData';
export type { OrderStatusData as OrderStatusDataType } from './OrderStatusData';

export { OrderTransactionData } from './OrderTransactionData';
export type { OrderTransactionData as OrderTransactionDataType } from './OrderTransactionData';

export { StockTopData } from './StockTopData';
export type {
  StockTopData as StockTopDataType,
  StockTopData_TopData,
  StockTopData_StockItem,
} from './StockTopData';

export { OptionTopData } from './OptionTopData';
export type {
  OptionTopData as OptionTopDataType,
  OptionTopData_TopData,
  OptionTopData_BigOrder,
  OptionTopData_OptionItem,
} from './OptionTopData';

export { KlineData } from './KlineData';
export type { KlineData as KlineDataType } from './KlineData';
