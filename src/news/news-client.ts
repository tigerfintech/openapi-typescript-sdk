/**
 * NewsClient — 资讯客户端（news_stock_list / news_highlight_list）。
 *
 * 路由约定（对齐 Java SDK 的 MethodType.NEWS）：
 * 资讯接口走主网关（config.serverUrl，与交易域同一路由），**不走行情域名**
 * （config.quoteServerUrl）。本 SDK 的路由在 HttpClient 构造期决定——
 * QuoteClient 以 useQuoteServerUrl 指向行情域名，其余客户端（TradeClient、
 * NewsClient）默认指向主网关——因此 NewsClient 永远不传 useQuoteServerUrl。
 *
 * 请求参数 TypeScript 侧 camelCase，自动转为 wire snake_case；响应出参为
 * camelCase，无需转换。
 */
import { HttpClient } from '../client/http-client';
import type { ClientConfig } from '../config/client-config';
import { createApiRequest } from '../client/api-request';
import { unmarshalData } from '../client/api-response';
import type { NewsPage } from '../model/news';
import type { NewsStockListRequest, NewsHighlightListRequest } from '../model/news-requests';

/** NewsClient construction options. */
export interface NewsClientOptions {
  /**
   * 默认语言（'zh_CN' / 'zh_TW' / 'en_US'）：请求未显携带 lang 时注入
   * biz_content。fromConfig 自动取 config.language。
   */
  lang?: string;
}

/** 资讯客户端：个股新闻列表与市场要闻列表。 */
export class NewsClient {
  private httpClient: HttpClient;
  private defaultLang: string | undefined;

  constructor(httpClient: HttpClient, options?: NewsClientOptions) {
    this.httpClient = httpClient;
    this.defaultLang = options?.lang || undefined;
  }

  /**
   * 从 ClientConfig 直接创建 NewsClient——主网关路由，默认语言取
   * config.language。
   */
  static fromConfig(config: ClientConfig): NewsClient {
    // 资讯走主网关：不传 useQuoteServerUrl（对照 QuoteClient 的构造方式）。
    return new NewsClient(new HttpClient(config), { lang: config.language });
  }

  /**
   * 查询个股新闻列表（wire: news_stock_list）。
   *
   * @param req - symbol 必填（单标的，该接口不支持批量查询）；
   *   pageCount / pageSize 可选（缺省服务端默认 1 / 20）；
   *   lang 可选（'zh_CN' / 'zh_TW' / 'en_US'）
   * @returns 分页信封 NewsPage；空列表属正常成功返回
   */
  async getStockNews(req: NewsStockListRequest): Promise<NewsPage> {
    const page = await this.callInto<NewsPage>('news_stock_list', {
      symbol: req.symbol,
      pageCount: req.pageCount,
      pageSize: req.pageSize,
      lang: this.resolveLang(req.lang),
    });
    return page ?? { items: [] };
  }

  /**
   * 查询市场要闻列表（wire: news_highlight_list）。
   *
   * 翻页只走 lastId 游标：把上一页 items 最后一条的 id 作为 lastId 传入
   * 即取下一页；不传从最新开始。本接口无 page_count / page_size，响应
   * pageCount 恒为 1。
   *
   * @param req - 全部字段可选，不传即从最新开始
   * @returns 分页信封 NewsPage；空列表属正常成功返回
   */
  async getMarketNews(req?: NewsHighlightListRequest): Promise<NewsPage> {
    const body: Record<string, unknown> = {};
    if (req?.lastId !== undefined) {
      body['lastId'] = req.lastId;
    }
    const lang = this.resolveLang(req?.lang);
    if (lang !== undefined) {
      body['lang'] = lang;
    }
    const page = await this.callInto<NewsPage>('news_highlight_list', body);
    return page ?? { items: [] };
  }

  /**
   * 解析生效的 lang：显式传值原样透传，缺省回退客户端默认语言。
   */
  private resolveLang(lang: string | undefined): string | undefined {
    return lang !== undefined ? lang : this.defaultLang;
  }

  private async callInto<T>(method: string, bizParams?: unknown): Promise<T | undefined> {
    const request = createApiRequest(method, bizParams);
    const response = await this.httpClient.executeRequest(request);
    return unmarshalData<T>(response.data);
  }
}
