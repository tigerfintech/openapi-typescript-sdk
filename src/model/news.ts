/**
 * 资讯数据模型（news_stock_list / news_highlight_list 共用）。
 *
 * 服务端响应出参为 camelCase（契约决策 #13），与 TypeScript 字段名一致，
 * 响应侧无需命名转换。
 */

/**
 * 资讯条目（news_stock_list 与 news_highlight_list 共用，契约 §3.3）。
 */
export interface NewsItem {
  /** 资讯 ID（同时是 highlight 游标翻页 last_id 的取值来源） */
  id?: string;
  /** 标题 */
  title?: string;
  /** 摘要 */
  summary?: string;
  /** 发布时间戳（秒级） */
  pubTimestamp?: number;
  /** 原文链接 */
  url?: string;
}

/**
 * 资讯列表分页信封（news_stock_list 与 news_highlight_list 共用，契约 §3.3）。
 *
 * news_highlight_list 仅支持 last_id 游标翻页（决策 #14），其 pageCount 恒为 1。
 */
export interface NewsPage {
  /** 当前页资讯列表（下游返回空 items 属正常成功） */
  items: NewsItem[];
  /** 当前页码（highlight 接口恒为 1） */
  pageCount?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 总页数 */
  totalPage?: number;
  /** 总条数 */
  totalSize?: number;
}
