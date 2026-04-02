/**
 * Contract 合约接口
 * 字段名 camelCase 与 API JSON 天然一致，不改名、不加封装层
 */

/** 最小报价单位价格区间 */
export interface TickSize {
  /** 起始价格（字符串，如 "0"、"1"） */
  begin?: string;
  /** 结束价格（字符串，如 "1"、"Infinity"） */
  end?: string;
  /** 最小报价单位 */
  tickSize?: number;
  /** 类型（CLOSED/OPEN） */
  type?: string;
}

/** 合约模型，字段名词根保持与 API JSON 一致 */
export interface Contract {
  /** 合约 ID */
  contractId?: number;
  /** 标的代码（如 AAPL） */
  symbol: string;
  /** 证券类型（STK/OPT/FUT/WAR/CASH/FUND 等） */
  secType: string;
  /** 货币 */
  currency?: string;
  /** 交易所 */
  exchange?: string;
  /** 到期日（期权/期货） */
  expiry?: string;
  /** 行权价（期权） */
  strike?: number;
  /** 看涨/看跌（PUT/CALL），保持 API 原始名 right，不改为 putCall */
  right?: string;
  /** 合约乘数 */
  multiplier?: number;
  /** 合约标识符 */
  identifier?: string;
  /** 合约名称 */
  name?: string;
  /** 市场 */
  market?: string;
  /** 是否可交易，保持 API 原始名 tradeable，不改为 trade */
  tradeable?: boolean;
  /** 合约内部 ID，保持 API 原始名 conid，不改为 contractId */
  conid?: number;
  /** 做空保证金比例 */
  shortMargin?: number;
  /** 做空初始保证金比例 */
  shortInitialMargin?: number;
  /** 做空维持保证金比例 */
  shortMaintenanceMargin?: number;
  /** 做多初始保证金 */
  longInitialMargin?: number;
  /** 做多维持保证金 */
  longMaintenanceMargin?: number;
  /** 最小报价单位价格区间 */
  tickSizes?: TickSize[];
  /** 每手数量 */
  lotSize?: number;
}
