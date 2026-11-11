/**
 * News example — covers both NewsClient methods end-to-end.
 *
 * Config is auto-discovered from ./tiger_openapi_config.properties or
 * ~/.tigeropen/tiger_openapi_config.properties. A single endpoint failure
 * does not stop the rest; a PASS/FAIL summary is printed at the end.
 *
 * News requests are routed to the main gateway (never the quote server).
 *
 * Run: npx tsx examples/news-example.ts
 */
import { createClientConfig } from '../src/config/client-config';
import { NewsClient } from '../src/news/news-client';
import type { NewsPage } from '../src/model/news';

type Result = { name: string; ok: boolean; err?: unknown };
const results: Result[] = [];

function ok(name: string, note: string) {
  console.log(`[ OK ] ${name.padEnd(36)} ${note}`);
  results.push({ name, ok: true });
}
function fail(name: string, err: unknown) {
  console.log(`[FAIL] ${name.padEnd(36)} ${err instanceof Error ? err.message : String(err)}`);
  results.push({ name, ok: false, err });
}
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function describePage(page: NewsPage): string {
  const first = page.items[0];
  const head = first ? `${first.id}: ${first.title}` : '(empty)';
  return `items=${page.items.length} totalSize=${page.totalSize ?? '?'} | ${truncate(head, 100)}`;
}

async function main() {
  const cfg = createClientConfig({
    propertiesFilePath: process.env.TIGER_CONFIG_PATH,
  });
  console.log(`tiger_id=${cfg.tigerId} account=${cfg.account}\n`);

  // 资讯走主网关（与 QuoteClient 的行情域名路由不同）
  const nc = NewsClient.fromConfig(cfg);

  console.log('=== Stock news (news_stock_list) ===');
  try {
    const page = await nc.getStockNews({ symbol: 'AAPL', lang: 'zh_CN', pageCount: 1, pageSize: 20 });
    ok('getStockNews(AAPL)', describePage(page));
  } catch (e) { fail('getStockNews(AAPL)', e); }

  try {
    // 可选参数缺省：服务端默认 pageCount=1 / pageSize=20
    const page = await nc.getStockNews({ symbol: 'TSLA' });
    ok('getStockNews(TSLA, defaults)', describePage(page));
  } catch (e) { fail('getStockNews(TSLA, defaults)', e); }

  console.log('\n=== Market highlights (news_highlight_list) ===');
  try {
    // 首页：不传 lastId 从最新开始；下一页传本页最后一条的 id
    const page = await nc.getMarketNews({ lang: 'zh_CN' });
    ok('getMarketNews(first page)', describePage(page));

    const lastId = page.items.length > 0 ? page.items[page.items.length - 1]!.id : undefined;
    if (lastId) {
      const next = await nc.getMarketNews({ lang: 'zh_CN', lastId });
      ok('getMarketNews(next page, lastId)', describePage(next));
    } else {
      console.log('[SKIP] getMarketNews(next page, lastId)  first page empty, no cursor');
    }
  } catch (e) { fail('getMarketNews', e); }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} passed`);
  if (passed < results.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('news-example crashed:', e);
  process.exitCode = 1;
});
