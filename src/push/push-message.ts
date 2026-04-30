/**
 * 推送消息类型定义
 *
 * 仅保留 SubjectType 枚举，用于订阅/退订 API。
 * JSON 消息类型定义和序列化函数已移除，改用 Protobuf 协议。
 */

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
