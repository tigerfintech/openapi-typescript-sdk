/**
 * 资讯请求参数模型（wire: news_stock_list / news_highlight_list）。
 *
 * TypeScript 侧使用 camelCase，序列化时由 createApiRequest 自动转为
 * snake_case（契约决策 #13：入参 snake_case）。可选字段不传时不出现在
 * biz_content 中，由服务端取缺省值。
 */

/**
 * 个股新闻列表请求。wire: news_stock_list
 *
 * symbol 单标的必填（下游资讯服务实际不支持批量查询，契约决策 #5）；
 * pageCount / pageSize 缺省时服务端默认 1 / 20（决策 #6）；
 * lang 可选（'zh_CN' / 'zh_TW' / 'en_US'）。
 */
export interface NewsStockListRequest {
  /** 股票代码，必填、单标的（如 "AAPL"，该接口不支持批量查询） */
  symbol: string;
  /** 页码，缺省 = 1；显式传值须 >= 1（越界由服务端报参数错误） */
  pageCount?: number;
  /** 每页条数，缺省 = 20；显式传值须 1-50（闭区间） */
  pageSize?: number;
  /** 内容语言：'zh_CN' / 'zh_TW' / 'en_US' */
  lang?: string;
}

/**
 * 市场要闻列表请求。wire: news_highlight_list
 *
 * 翻页只走 lastId 游标（契约决策 #14，该接口无 page_count / page_size）；
 * lang 语义同 NewsStockListRequest。
 */
export interface NewsHighlightListRequest {
  /**
   * 游标翻页：取上一页 items 最后一条的 id；不传从最新开始。
   * 这是本接口唯一的翻页方式。
   */
  lastId?: string;
  /** 内容语言：'zh_CN' / 'zh_TW' / 'en_US' */
  lang?: string;
}
