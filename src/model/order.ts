/**
 * Order 订单接口
 * 字段名 camelCase 与 API JSON 天然一致，不改名、不加封装层
 */

/** 附加订单（止盈/止损） */
export interface OrderLeg {
  /** 附加订单类型（PROFIT/LOSS） */
  legType?: string;
  /** 价格 */
  price?: number;
  /** 有效期 */
  timeInForce?: string;
  /** 数量 */
  quantity?: number;
}

/** 算法订单参数 */
export interface AlgoParams {
  /** 算法策略（TWAP/VWAP） */
  algoStrategy?: string;
  /** 开始时间 */
  startTime?: string;
  /** 结束时间 */
  endTime?: string;
  /** 参与率 */
  participationRate?: number;
}

/** 订单模型，字段名词根保持与 API JSON 一致 */
export interface Order {
  /** 交易账户 */
  account: string;
  /** 全局订单 ID */
  id?: number;
  /** 账户自增订单号 */
  orderId?: number;
  /** 买卖方向（BUY/SELL） */
  action: string;
  /** 订单类型（MKT/LMT/STP/STP_LMT/TRAIL 等） */
  orderType: string;
  /** 总数量（API 返回字段名为 totalQuantity） */
  totalQuantity: number;
  /** 限价 */
  limitPrice?: number;
  /** 辅助价格（止损价） */
  auxPrice?: number;
  /** 跟踪止损百分比 */
  trailingPercent?: number;
  /** 订单状态 */
  status?: string;
  /** 已成交数量（API 返回字段名为 filledQuantity） */
  filledQuantity?: number;
  /** 平均成交价 */
  avgFillPrice?: number;
  /** 有效期（DAY/GTC/OPG） */
  timeInForce: string;
  /** 是否允许盘前盘后 */
  outsideRth: boolean;
  /** 附加订单（止盈/止损） */
  orderLegs?: OrderLeg[];
  /** 算法参数 */
  algoParams?: AlgoParams;
  /** 股票代码 */
  symbol: string;
  /** 合约类型 */
  secType: string;
  /** 市场 */
  market?: string;
  /** 货币 */
  currency?: string;
  /** 到期日（期权/期货） */
  expiry?: string;
  /** 行权价（期权），API 返回为字符串 */
  strike?: string;
  /** 看涨/看跌（PUT/CALL），保持 API 原始名 right */
  right?: string;
  /** 合约标识符 */
  identifier?: string;
  /** 合约名称 */
  name?: string;
  /** 佣金 */
  commission?: number;
  /** 已实现盈亏 */
  realizedPnl?: number;
  /** 开仓时间（毫秒时间戳） */
  openTime?: number;
  /** 更新时间（毫秒时间戳） */
  updateTime?: number;
  /** 最新时间（毫秒时间戳） */
  latestTime?: number;
  /** 备注 */
  remark?: string;
  /** 订单来源 */
  source?: string;
  /** 用户标记 */
  userMark?: string;
}
