/**
 * Quote example — covers every QuoteClient method end-to-end.
 *
 * Config is auto-discovered from ./tiger_openapi_config.properties or
 * ~/.tigeropen/tiger_openapi_config.properties. A single endpoint
 * failure does not stop the rest; a PASS/FAIL/SKIP summary is printed
 * at the end.
 *
 * Run: npx tsx examples/quote-example.ts
 */
import { createClientConfig } from '../src/config/client-config';
import { HttpClient } from '../src/client/http-client';
import { QuoteClient } from '../src/quote/quote-client';

type Result = { name: string; ok: boolean; err?: unknown };
const results: Result[] = [];

function ok(name: string, note: string) {
  console.log(`[ OK ] ${name.padEnd(32)} ${truncate(note, 140)}`);
  results.push({ name, ok: true });
}
function fail(name: string, err: unknown) {
  console.log(`[FAIL] ${name.padEnd(32)} ${err instanceof Error ? err.message : String(err)}`);
  results.push({ name, ok: false, err });
}
function skip(name: string, reason: string) {
  console.log(`[SKIP] ${name.padEnd(32)} ${reason}`);
  results.push({ name, ok: false, err: `skipped: ${reason}` });
}
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

async function main() {
  const cfg = createClientConfig();
  console.log(`tiger_id=${cfg.tigerId} account=${cfg.account}\n`);

  const qc = new QuoteClient(new HttpClient(cfg, undefined, { useQuoteServerUrl: true }));

  console.log('=== Basic market data ===');
  try {
    const states = await qc.getMarketState('US');
    ok('getMarketState(US)', states.length > 0 ? `${states[0].market} ${states[0].marketStatus} ${states[0].openTime ?? ''}` : '(empty)');
  } catch (e) { fail('getMarketState(US)', e); }

  try {
    const briefs = await qc.getBrief(['AAPL', 'TSLA']);
    ok('getBrief', briefs.map(b => `${b.symbol}=${b.latestPrice}`).join(' '));
  } catch (e) { fail('getBrief', e); }

  try {
    const ks = await qc.getKline('AAPL', 'day');
    ok('getKline(AAPL day)', ks.length > 0 ? `symbol=${ks[0].symbol} bars=${ks[0].items.length}` : '(empty)');
  } catch (e) { fail('getKline(AAPL day)', e); }

  try {
    const tl = await qc.getTimeline(['AAPL']);
    const n = tl[0]?.intraday?.items.length ?? 0;
    ok('getTimeline', `intraday_points=${n} preClose=${tl[0]?.preClose ?? 0}`);
  } catch (e) { fail('getTimeline', e); }

  try {
    const tt = await qc.getTradeTick(['AAPL']);
    ok('getTradeTick', `ticks=${tt[0]?.items.length ?? 0}`);
  } catch (e) { fail('getTradeTick', e); }

  try {
    const d = await qc.getQuoteDepth('AAPL', 'US');
    ok('getQuoteDepth(AAPL)', `asks=${d[0]?.asks.length ?? 0} bids=${d[0]?.bids.length ?? 0}`);
  } catch (e) { fail('getQuoteDepth(AAPL)', e); }

  console.log('\n=== Options ===');
  let expiryDate = '', optIdentifier = '';
  try {
    const exps = await qc.getOptionExpiration('AAPL');
    const dates = exps[0]?.dates ?? [];
    ok('getOptionExpiration(AAPL)', `dates=${dates.length} first=${dates[0] ?? ''}`);
    if (dates.length > 0) expiryDate = dates[Math.floor(dates.length / 2)];
  } catch (e) { fail('getOptionExpiration(AAPL)', e); }

  if (!expiryDate) {
    skip('getOptionChain', 'no expiry available');
    skip('getOptionBrief', 'no expiry available');
    skip('getOptionKline', 'no expiry available');
  } else {
    try {
      const chain = await qc.getOptionChain('AAPL', expiryDate);
      const items = chain[0]?.items ?? [];
      ok(`getOptionChain(${expiryDate})`, `rows=${items.length}`);
      const mid = items[Math.floor(items.length / 2)];
      optIdentifier = mid?.call?.identifier ?? mid?.put?.identifier ?? '';
    } catch (e) { fail(`getOptionChain(${expiryDate})`, e); }

    if (!optIdentifier) {
      skip('getOptionBrief', 'no identifier from chain');
      skip('getOptionKline', 'no identifier from chain');
    } else {
      try {
        const briefs = await qc.getOptionBrief([optIdentifier]);
        ok('getOptionBrief', `${briefs[0]?.symbol ?? ''} latestPrice=${briefs[0]?.latestPrice ?? 0}`);
      } catch (e) { fail('getOptionBrief', e); }
      try {
        const ks = await qc.getOptionKline(optIdentifier, 'day');
        ok('getOptionKline', `bars=${ks[0]?.items.length ?? 0}`);
      } catch (e) { fail('getOptionKline', e); }
    }
  }

  console.log('\n=== Futures ===');
  let exchangeCode = '', contractCode = '';
  try {
    const exs = await qc.getFutureExchange();
    ok('getFutureExchange', `exchanges=${exs.length} first=${exs[0]?.code ?? ''}`);
    exchangeCode = exs[0]?.code ?? '';
  } catch (e) { fail('getFutureExchange', e); }

  if (!exchangeCode) {
    skip('getFutureContracts', 'no exchange');
  } else {
    try {
      const cs = await qc.getFutureContracts(exchangeCode);
      ok(`getFutureContracts(${exchangeCode})`, `contracts=${cs.length} first=${cs[0]?.contractCode ?? ''}`);
      contractCode = cs[0]?.contractCode ?? '';
    } catch (e) { fail(`getFutureContracts(${exchangeCode})`, e); }
  }

  if (!contractCode) {
    skip('getFutureRealTimeQuote', 'no contract');
    skip('getFutureKline', 'no contract');
  } else {
    try {
      const q = await qc.getFutureRealTimeQuote([contractCode]);
      ok('getFutureRealTimeQuote', `${q[0]?.contractCode ?? ''} latestPrice=${q[0]?.latestPrice ?? 0}`);
    } catch (e) { fail('getFutureRealTimeQuote', e); }
    try {
      const ks = await qc.getFutureKline({ contractCodes: [contractCode], period: 'day', beginTime: -1, endTime: -1 });
      ok(`getFutureKline(${contractCode})`, `bars=${ks[0]?.items.length ?? 0}`);
    } catch (e) { fail(`getFutureKline(${contractCode})`, e); }
  }

  console.log('\n=== Fundamentals & capital flow ===');
  try {
    const items = await qc.getFinancialDaily({
      symbols: ['AAPL'], market: 'US', fields: ['shares_outstanding'],
      beginDate: '2026-05-05', endDate: '2026-05-06',
    });
    ok('getFinancialDaily(AAPL)', `rows=${items.length}`);
  } catch (e) { fail('getFinancialDaily(AAPL)', e); }

  try {
    const items = await qc.getFinancialReport({
      symbols: ['AAPL'], market: 'US', fields: ['total_revenue'], periodType: 'Annual',
    });
    ok('getFinancialReport(AAPL)', items.length > 0 ? `${items[0].symbol} ${items[0].field}=${items[0].value} @${items[0].filingDate ?? ''}` : '(empty)');
  } catch (e) { fail('getFinancialReport(AAPL)', e); }

  try {
    const items = await qc.getCorporateAction({
      symbols: ['AAPL'], market: 'US', actionType: 'DIVIDEND',
      beginDate: '2024-01-01', endDate: '2024-12-31',
    });
    ok('getCorporateAction(AAPL)', `rows=${items.length}`);
  } catch (e) { fail('getCorporateAction(AAPL)', e); }

  try {
    const cf = await qc.getCapitalFlow('AAPL', 'US', 'day');
    ok('getCapitalFlow(AAPL)', `${cf?.symbol ?? ''} period=${cf?.period ?? ''} rows=${cf?.items.length ?? 0}`);
  } catch (e) { fail('getCapitalFlow(AAPL)', e); }

  try {
    const cd = await qc.getCapitalDistribution('AAPL', 'US');
    ok('getCapitalDistribution(AAPL)', `${cd?.symbol ?? ''} netInflow=${cd?.netInflow ?? 0}`);
  } catch (e) { fail('getCapitalDistribution(AAPL)', e); }

  console.log('\n=== Scanner & permission ===');
  try {
    const res = await qc.marketScanner({ market: 'US', page: 0, pageSize: 10 });
    ok('marketScanner', `page=${res?.page ?? 0}/${res?.totalPage ?? 0} totalCount=${res?.totalCount ?? 0} items=${res?.items.length ?? 0}`);
  } catch (e) { fail('marketScanner', e); }

  try {
    const perms = await qc.grabQuotePermission();
    ok('grabQuotePermission', `permissions=${perms.length}`);
  } catch (e) { fail('grabQuotePermission', e); }

  printSummary();
}

function printSummary() {
  console.log('\n================ SUMMARY ================');
  let pass = 0, fa = 0, sk = 0;
  for (const r of results) {
    if (r.ok) pass++;
    else if (typeof r.err === 'string' && r.err.startsWith('skipped')) sk++;
    else fa++;
  }
  console.log(`PASS=${pass}  FAIL=${fa}  SKIP=${sk}  TOTAL=${results.length}`);
  if (fa > 0) {
    console.log('\nFailures:');
    for (const r of results) {
      if (!r.ok && !(typeof r.err === 'string' && r.err.startsWith('skipped'))) {
        console.log(`  - ${r.name}: ${r.err instanceof Error ? r.err.message : String(r.err)}`);
      }
    }
  }
  console.log('=========================================');
}

main().catch((e) => { console.error(e); process.exit(1); });
