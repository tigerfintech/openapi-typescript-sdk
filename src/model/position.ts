/**
 * Position 持仓接口
 * 字段名 camelCase 与 API JSON 天然一致，不改名、不加封装层
 */

/** 持仓模型，字段名词根保持与 API JSON 一致 */
export interface Position {
  /** 交易账户 */
  account: string;
  /** 标的代码 */
  symbol: string;
  /** 证券类型 */
  secType: string;
  /** 市场 */
  market?: string;
  /** 货币 */
  currency?: string;
  /** 持仓数量（API 返回字段名为 position） */
  position: number;
  /** 平均成本 */
  averageCost: number;
  /** 市值 */
  marketValue?: number;
  /** 已实现盈亏 */
  realizedPnl?: number;
  /** 未实现盈亏 */
  unrealizedPnl?: number;
  /** 未实现盈亏百分比 */
  unrealizedPnlPercent?: number;
  /** 合约 ID */
  contractId?: number;
  /** 合约标识符 */
  identifier?: string;
  /** 合约名称 */
  name?: string;
  /** 最新价格 */
  latestPrice?: number;
  /** 合约乘数 */
  multiplier?: number;
}
