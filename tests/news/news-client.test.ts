/**
 * NewsClient 单元测试 — 覆盖 news_stock_list / news_highlight_list 的
 * 请求 wire 格式（snake_case、可选字段缺省省略）、响应解析（camelCase）、
 * lang 缺省继承，以及「资讯必须路由主网关、不得走行情域名」的回归断言。
 *
 * 契约依据：stock-openapi docs/news_api_design.md §3.1-§3.3、决策 #5 #6 #11 #13 #14。
 */
import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest';
import { NewsClient } from '../../src/news/news-client';
import { QuoteClient } from '../../src/quote/quote-client';
import { HttpClient } from '../../src/client/http-client';
import { TigerError } from '../../src/client/errors';
import type { ApiResponse } from '../../src/client/api-response';
import type { NewsPage, NewsItem } from '../../src/model/news';
import { makeTestConfig } from '../support';

function createMockHttpClient() {
  return {
    executeRequest: vi.fn(),
    execute: vi.fn(),
  } as unknown as HttpClient;
}

function successResponse(data: unknown): ApiResponse {
  return { code: 0, message: 'success', data, timestamp: 1700000000 };
}

/** Parse the bizContent of the n-th (0-based) request the client sent. */
function capturedBiz(mock: HttpClient, callIndex = 0): Record<string, unknown> {
  const call = vi.mocked(mock.executeRequest).mock.calls[callIndex][0];
  return JSON.parse(call.bizContent);
}

/** Wire-shaped page payload used across parsing tests. */
const wirePage = {
  items: [
    {
      id: '123456',
      title: 'Apple 发布 Q2 财报',
      summary: 'Earnings beat',
      pubTimestamp: 1729413600,
      url: 'https://example.com/news/123456',
    },
  ],
  pageCount: 1,
  pageSize: 20,
  totalPage: 10,
  totalSize: 200,
};

describe('NewsClient', () => {
  let mockHttpClient: HttpClient;
  let nc: NewsClient;

  beforeEach(() => {
    mockHttpClient = createMockHttpClient();
    nc = new NewsClient(mockHttpClient);
  });

  // ── getStockNews wire format ─────────────────────────────────────────────

  it('getStockNews 发送 news_stock_list，参数 snake_case', async () => {
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(wirePage));

    await nc.getStockNews({ symbol: 'AAPL', pageCount: 2, pageSize: 50, lang: 'zh_CN' });

    const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
    expect(call.method).toBe('news_stock_list');
    expect(capturedBiz(mockHttpClient)).toEqual({
      symbol: 'AAPL',
      page_count: 2,
      page_size: 50,
      lang: 'zh_CN',
    });
  });

  it('getStockNews 可选参数缺省时不出现在 biz_content（服务端默认 1 / 20）', async () => {
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(wirePage));

    await nc.getStockNews({ symbol: 'AAPL' });

    const biz = capturedBiz(mockHttpClient);
    expect(biz).toEqual({ symbol: 'AAPL' });
    expect(biz).not.toHaveProperty('page_count');
    expect(biz).not.toHaveProperty('page_size');
    expect(biz).not.toHaveProperty('lang');
  });

  // ── getMarketNews wire format / cursor pagination ────────────────────────

  it('getMarketNews 无参数时发送空 biz_content（从最新开始）', async () => {
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(wirePage));

    await nc.getMarketNews();

    const call = vi.mocked(mockHttpClient.executeRequest).mock.calls[0][0];
    expect(call.method).toBe('news_highlight_list');
    expect(capturedBiz(mockHttpClient)).toEqual({});
  });

  it('getMarketNews 游标翻页：lastId → last_id（两页模拟）', async () => {
    const page1: NewsPage = {
      items: [
        { id: '100', title: 'a', summary: '', pubTimestamp: 1, url: 'u1' },
        { id: '789', title: 'b', summary: '', pubTimestamp: 2, url: 'u2' },
      ],
      pageCount: 1,
      pageSize: 20,
      totalPage: 5,
      totalSize: 100,
    };
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValueOnce(successResponse(page1));

    const first = await nc.getMarketNews();
    expect(capturedBiz(mockHttpClient)).toEqual({});

    // 下一页：把本页最后一条的 id 作为 lastId 传回
    const lastId = first.items[first.items.length - 1]!.id!;
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValueOnce(successResponse(wirePage));
    await nc.getMarketNews({ lastId });
    expect(capturedBiz(mockHttpClient, 1)).toEqual({ last_id: '789' });
  });

  it('getMarketNews 显式传 lang 时与 last_id 一并发送', async () => {
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(wirePage));

    await nc.getMarketNews({ lastId: '789', lang: 'en_US' });

    expect(capturedBiz(mockHttpClient)).toEqual({ last_id: '789', lang: 'en_US' });
  });

  // ── lang 缺省继承（对齐 Python NewsClient） ─────────────────────────────

  it('lang 缺省时注入客户端默认语言', async () => {
    const withLang = new NewsClient(mockHttpClient, { lang: 'zh_CN' });
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(wirePage));

    await withLang.getStockNews({ symbol: 'AAPL' });
    expect(capturedBiz(mockHttpClient)).toEqual({ symbol: 'AAPL', lang: 'zh_CN' });
  });

  it('显式 lang 覆盖默认语言', async () => {
    const withLang = new NewsClient(mockHttpClient, { lang: 'zh_CN' });
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(wirePage));

    await withLang.getStockNews({ symbol: 'AAPL', lang: 'en_US' });
    expect(capturedBiz(mockHttpClient)).toEqual({ symbol: 'AAPL', lang: 'en_US' });
  });

  it('显式空串 lang 原样透传（服务端视为中英混合内容）', async () => {
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(wirePage));

    await nc.getStockNews({ symbol: 'AAPL', lang: '' });
    expect(capturedBiz(mockHttpClient)).toEqual({ symbol: 'AAPL', lang: '' });
  });

  it('未配置默认语言且未传 lang 时不发送 lang 字段', async () => {
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(wirePage));

    await nc.getMarketNews();
    expect(capturedBiz(mockHttpClient)).not.toHaveProperty('lang');
  });

  // ── 响应解析（camelCase 直通） ──────────────────────────────────────────

  it('解析 NewsPage：信封字段与 item 字段均为 camelCase', async () => {
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(wirePage));

    const page = await nc.getStockNews({ symbol: 'AAPL' });

    expect(page.pageCount).toBe(1);
    expect(page.pageSize).toBe(20);
    expect(page.totalPage).toBe(10);
    expect(page.totalSize).toBe(200);
    expect(page.items).toHaveLength(1);
    const item: NewsItem = page.items[0];
    expect(item.id).toBe('123456');
    expect(item.title).toBe('Apple 发布 Q2 财报');
    expect(item.summary).toBe('Earnings beat');
    expect(item.pubTimestamp).toBe(1729413600);
    expect(item.url).toBe('https://example.com/news/123456');
    expectTypeOf(page.items).toEqualTypeOf<NewsItem[]>();
    expectTypeOf(item.pubTimestamp).toEqualTypeOf<number | undefined>();
  });

  it('空 items 属正常成功返回', async () => {
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(
      successResponse({ items: [], pageCount: 1, pageSize: 20, totalPage: 0, totalSize: 0 }),
    );

    const page = await nc.getMarketNews();
    expect(page.items).toEqual([]);
  });

  it('data 为 null 时返回空页兜底', async () => {
    vi.mocked(mockHttpClient.executeRequest).mockResolvedValue(successResponse(null));

    const page = await nc.getStockNews({ symbol: 'AAPL' });
    expect(page).toEqual({ items: [] });
  });

  it('业务错误码透传为 TigerError（code != 0）', async () => {
    vi.mocked(mockHttpClient.executeRequest).mockRejectedValue(
      new TigerError(1010, 'biz param error'),
    );

    await expect(nc.getStockNews({ symbol: '' })).rejects.toMatchObject({ code: 1010 });
  });

  // ── 路由回归：主网关，不走行情域名 ───────────────────────────────────────
  //
  // 对照 Java SDK 的 testNewsRoutesToMainGatewayNotQuote：资讯请求必须打到
  // 主网关 serverUrl，不得打到行情域名 quoteServerUrl（行情域名对部分牌照
  // 配置了分流路径，标错路由会把资讯流量打进行情集群）。

  describe('路由：news 走主网关', () => {
    const MAIN_URL = 'https://openapi.itigerup.com:443/main/gateway';
    const QUOTE_URL = 'https://openapi.itigerup.com:443/hkg-quote/gateway';
    let originalFetch: typeof globalThis.fetch;
    let config: ReturnType<typeof makeTestConfig>;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      config = makeTestConfig({ serverUrl: MAIN_URL, quoteServerUrl: QUOTE_URL });
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    /** Wire a real HttpClient-backed client through a mocked fetch. */
    function stubFetch(): { urls: string[]; bodies: Record<string, string>[] } {
      const urls: string[] = [];
      const bodies: Record<string, string>[] = [];
      globalThis.fetch = vi.fn().mockImplementation(
        async (url: string | URL | Request, init: RequestInit) => {
          urls.push(String(url));
          bodies.push(JSON.parse(init.body as string));
          return {
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify(successResponse(wirePage))),
          };
        },
      );
      return { urls, bodies };
    }

    it('fromConfig 创建的 NewsClient 请求主网关 URL，且 lang 继承 config.language', async () => {
      const { urls, bodies } = stubFetch();
      const client = NewsClient.fromConfig(config);
      // 跳过真实签名（离线测试无有效私钥），响应无 sign 字段跳过验签
      (client as any).httpClient.signParams = () => 'mock_sign';

      await client.getStockNews({ symbol: 'AAPL' });
      await client.getMarketNews();

      expect(urls).toEqual([MAIN_URL, MAIN_URL]);
      // makeTestConfig 的 language 为 zh_CN，缺省 lang 应注入 biz_content
      expect(bodies[0]).toMatchObject({
        method: 'news_stock_list',
        biz_content: JSON.stringify({ symbol: 'AAPL', lang: 'zh_CN' }),
      });
      expect(bodies[1]).toMatchObject({
        method: 'news_highlight_list',
        biz_content: JSON.stringify({ lang: 'zh_CN' }),
      });
    });

    it('手工构造的 NewsClient（默认 HttpClient）同样请求主网关', async () => {
      const { urls, bodies } = stubFetch();
      const http = new HttpClient(config);
      (http as any).signParams = () => 'mock_sign';
      const client = new NewsClient(http);

      await client.getMarketNews({ lastId: '789' });

      expect(urls).toEqual([MAIN_URL]);
      expect(urls[0]).not.toBe(QUOTE_URL);
      expect(bodies[0]).toMatchObject({
        method: 'news_highlight_list',
        biz_content: JSON.stringify({ last_id: '789' }),
      });
    });

    it('对照组：QuoteClient 仍走行情域名（防止路由逻辑被误改）', async () => {
      const { urls } = stubFetch();
      const http = new HttpClient(config, undefined, { useQuoteServerUrl: true });
      (http as any).signParams = () => 'mock_sign';
      const qc = new QuoteClient(http);

      await qc.getMarketState('US');

      expect(urls).toEqual([QUOTE_URL]);
    });
  });
});
