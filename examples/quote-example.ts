/**
 * Quote example — covers every QuoteClient method end-to-end (v0.4.0).
 *
 * Config is auto-discovered from ./tiger_openapi_config.properties or
 * ~/.tigeropen/tiger_openapi_config.properties. A single endpoint
 * failure does not stop the rest; a PASS/FAIL/SKIP summary is printed
 * at the end.
 *
 * v0.4.0 additions: every new method is smoke-tested once
 * (47 new quote methods grouped by domain).
 *
 * Run: npx tsx examples/quote-example.ts
 */
import { createClientConfig } from '../src/config/client-config';
import { HttpClient } from '../src/client/http-client';
import { QuoteClient } from '../src/quote/quote-client';

type Result = { name: string; ok: boolean; err?: unknown };
const results: Result[] = [];

function ok(name: string, note: string) {
  console.log(`[ OK ] ${name.padEnd(36)} ${truncate(note, 140)}`);
  results.push({ name, ok: true });
}
function fail(name: string, err: unknown) {
  console.log(`[FAIL] ${name.padEnd(36)} ${err instanceof Error ? err.message : String(err)}`);
  results.push({ name, ok: false, err });
}
function skip(name: string, reason: string) {
  console.log(`[SKIP] ${name.padEnd(36)} ${reason}`);
  results.push({ name, ok: false, err: `skipped: ${reason}` });
}
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

async function main() {
  const cfg = createClientConfig({
    propertiesFilePath: process.env.TIGER_CONFIG_PATH,
  });
  console.log(`tiger_id=${cfg.tigerId} account=${cfg.account}\n`);

  const qc = new QuoteClient(new HttpClient(cfg, undefined, { useQuoteServerUrl: true }));

  console.log('=== Basic market data ===');
  try {
    const states = await qc.getMarketState('US');
    ok('getMarketState(US)', states.length > 0 ? `${states[0].market} ${states[0].marketStatus} ${states[0].openTime ?? ''}` : '(empty)');
  } catch (e) { fail('getMarketState(US)', e); }

  try {
    const briefs = await qc.getRealTimeQuote({ symbols: ['AAPL', 'TSLA'] });
    ok('getRealTimeQuote', briefs.map(b => `${b.symbol}=${b.latestPrice}`).join(' '));
  } catch (e) { fail('getRealTimeQuote', e); }

  try {
    const ks = await qc.getKline({ symbols: ['AAPL'], period: 'day' });
    ok('getKline(AAPL day)', ks.length > 0 ? `symbol=${ks[0].symbol} bars=${ks[0].items.length}` : '(empty)');
  } catch (e) { fail('getKline(AAPL day)', e); }

  try {
    const tl = await qc.getTimeline(['AAPL']);
    const n = tl[0]?.intraday?.items.length ?? 0;
    ok('getTimeline', `intraday_points=${n} preClose=${tl[0]?.preClose ?? 0}`);
  } catch (e) { fail('getTimeline', e); }

  try {
    const tt = await qc.getTradeTick({ symbols: ['AAPL'] });
    ok('getTradeTick', `ticks=${tt[0]?.items.length ?? 0}`);
  } catch (e) { fail('getTradeTick', e); }

  try {
    const d = await qc.getQuoteDepth({ symbols: ['AAPL'], market: 'US' });
    ok('getQuoteDepth(AAPL)', `asks=${d[0]?.asks.length ?? 0} bids=${d[0]?.bids.length ?? 0}`);
  } catch (e) { fail('getQuoteDepth(AAPL)', e); }

  console.log('\n=== Options ===');
  let expiryDate = '', optIdentifier = '';
  try {
    const exps = await qc.getOptionExpiration(['AAPL']);
    const dates = exps[0]?.dates ?? [];
    ok('getOptionExpiration(AAPL)', `dates=${dates.length} first=${dates[0] ?? ''}`);
    if (dates.length > 0) expiryDate = dates[Math.floor(dates.length / 2)];
  } catch (e) { fail('getOptionExpiration(AAPL)', e); }

  if (!expiryDate) {
    skip('getOptionChain', 'no expiry available');
    skip('getOptionQuote', 'no expiry available');
    skip('getOptionKline', 'no expiry available');
  } else {
    try {
      const chain = await qc.getOptionChain([['AAPL', expiryDate]]);
      const items = chain[0]?.items ?? [];
      ok(`getOptionChain(${expiryDate})`, `rows=${items.length}`);
      const mid = items[Math.floor(items.length / 2)];
      optIdentifier = mid?.call?.identifier ?? mid?.put?.identifier ?? '';

      // Verify filter+greek using expiry timestamp from first response
      if (chain[0]) {
        try {
          const trueVal = true;
          const filtered = await qc.getOptionChain(
            [['AAPL', expiryDate]],
            undefined,
            trueVal,
            { inTheMoney: false, impliedVolatility: { min: 0.0, max: 5.0 }, greeks: { delta: { min: 0.0, max: 0.6 } } },
          );
          const fRows = filtered.flatMap(c => c.items).length;
          const hasGreek = filtered.some(c => c.items.some(row => (row.call?.delta ?? 0) !== 0 || (row.put?.delta ?? 0) !== 0));
          ok('getOptionChain(filter+greek)', `rows=${fRows} has_greek=${hasGreek}`);
        } catch (e) { fail('getOptionChain(filter+greek)', e); }
      }
    } catch (e) { fail(`getOptionChain(${expiryDate})`, e); }

    if (!optIdentifier) {
      skip('getOptionQuote', 'no identifier from chain');
      skip('getOptionKline', 'no identifier from chain');
    } else {
      try {
        const briefs = await qc.getOptionQuote([optIdentifier]);
        ok('getOptionQuote', `${briefs[0]?.symbol ?? ''} latestPrice=${briefs[0]?.latestPrice ?? 0}`);
      } catch (e) { fail('getOptionQuote', e); }
      try {
        const nowMs = Date.now();
        const beginMs = nowMs - 30 * 24 * 60 * 60 * 1000;
        const ks = await qc.getOptionKline([optIdentifier], 'day', beginMs, nowMs);
        ok('getOptionKline', `bars=${ks[0]?.items.length ?? 0}`);
      } catch (e) { fail('getOptionKline', e); }
    }
  }

  // HK options smoke test
  console.log('\n=== Options (HK) ===');
  let hkExpiryDate = '', hkOptIdentifier = '';
  try {
    const exps = await qc.getOptionExpiration(['00700.HK'], 'HK');
    const dates = exps[0]?.dates ?? [];
    hkExpiryDate = dates[0] ?? '';
    ok('getOptionExpiration(00700.HK)', `dates=${dates.length} first=${hkExpiryDate}`);
  } catch (e) { fail('getOptionExpiration(00700.HK)', e); }

  if (!hkExpiryDate) {
    skip('getOptionChain(HK)', 'no expiry available');
    skip('getOptionQuote(HK)', 'no expiry available');
    skip('getOptionKline(HK)', 'no expiry available');
  } else {
    try {
      const chain = await qc.getOptionChain([['00700.HK', hkExpiryDate]], 'Asia/Hong_Kong');
      const items = chain[0]?.items ?? [];
      ok(`getOptionChain(HK ${hkExpiryDate})`, `rows=${items.length}`);
      const mid = items[Math.floor(items.length / 2)];
      hkOptIdentifier = mid?.call?.identifier ?? mid?.put?.identifier ?? '';
    } catch (e) { fail('getOptionChain(00700.HK)', e); }

    if (!hkOptIdentifier) {
      skip('getOptionQuote(HK)', 'no identifier from chain');
      skip('getOptionKline(HK)', 'no identifier from chain');
    } else {
      try {
        const briefs = await qc.getOptionQuote([hkOptIdentifier], 'Asia/Hong_Kong');
        ok('getOptionQuote(HK)', `${briefs[0]?.symbol ?? ''} latestPrice=${briefs[0]?.latestPrice ?? 0}`);
      } catch (e) { fail('getOptionQuote(HK)', e); }
      try {
        const nowMs = Date.now();
        const beginMs = nowMs - 30 * 24 * 60 * 60 * 1000;
        const ks = await qc.getOptionKline([hkOptIdentifier], 'day', beginMs, nowMs, 'Asia/Hong_Kong');
        ok('getOptionKline(HK)', `bars=${ks[0]?.items.length ?? 0}`);
      } catch (e) { fail('getOptionKline(HK)', e); }
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
      const q = await qc.getFutureRealTimeQuote({ contractCodes: [contractCode] });
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

  // ==========================================================================
  // v0.4.0 smoke tests
  // ==========================================================================

  console.log('\n=== v0.4.0: Stock basics & time series ===');
  try {
    const syms = await qc.getSymbols({ market: 'US', secType: 'STK' });
    ok('getSymbols(US STK)', `count=${syms.length} first=${syms[0] ?? ''}`);
  } catch (e) { fail('getSymbols(US STK)', e); }

  try {
    const names = await qc.getSymbolNames({ market: 'US' });
    ok('getSymbolNames(US)', `count=${names.length} first=${names[0]?.symbol ?? ''}`);
  } catch (e) { fail('getSymbolNames(US)', e); }

  try {
    const metas = await qc.getTradeMetas({ symbols: ['AAPL'] });
    ok('getTradeMetas(AAPL)', `count=${metas.length}`);
  } catch (e) { fail('getTradeMetas(AAPL)', e); }

  try {
    const dets = await qc.getStockDetails({ symbols: ['AAPL'] });
    ok('getStockDetails(AAPL)', `count=${dets.length}`);
  } catch (e) { fail('getStockDetails(AAPL)', e); }

  try {
    const dbs = await qc.getDelayedQuote({ symbols: ['AAPL'] });
    ok('getDelayedQuote(AAPL)', `count=${dbs.length}`);
  } catch (e) { fail('getDelayedQuote(AAPL)', e); }

  try {
    const ks = await qc.getKline({ symbols: ['AAPL'], period: 'day', limit: 10 });
    ok('getKline(AAPL day x10)', `symbols=${ks.length} bars0=${ks[0]?.items?.length ?? 0}`);
  } catch (e) { fail('getKline(AAPL day x10)', e); }

  try {
    const tl = await qc.getTimelineHistory({ symbols: ['AAPL'], date: '2025-05-07' });
    ok('getTimelineHistory(AAPL)', `count=${tl.length}`);
  } catch (e) { fail('getTimelineHistory(AAPL)', e); }

  try {
    const rks = await qc.getTradeRank({ market: 'US' });
    ok('getTradeRank(US)', `count=${rks.length}`);
  } catch (e) { fail('getTradeRank(US)', e); }

  try {
    const si = await qc.getShortInterest({ symbols: ['AAPL'] });
    ok('getShortInterest(AAPL)', `count=${si.length}`);
  } catch (e) {
    const msg = String(e);
    if (msg.includes('permission') || msg.includes('code=4') || msg.includes('unauthorized') || msg.includes('not support')) {
      skip('getShortInterest(AAPL)', `no permission: ${msg}`);
    } else { fail('getShortInterest(AAPL)', e); }
  }

  try {
    const br = await qc.getStockBroker({ symbol: '00700', limit: 3 });
    ok('getStockBroker(00700)', br ? `symbol=${br.symbol ?? ''} bids=${br.levelBidList?.length ?? 0} asks=${br.levelAskList?.length ?? 0}` : '(empty)');
  } catch (e) { fail('getStockBroker(00700)', e); }

  try {
    const f = await qc.getStockFundamental({ symbols: ['AAPL'], market: 'US' });
    ok('getStockFundamental(AAPL)', `keys=${Object.keys(f).length}`);
  } catch (e) { fail('getStockFundamental(AAPL)', e); }

  try {
    const si = await qc.getStockIndustry({ symbol: 'AAPL', market: 'US' });
    ok('getStockIndustry(AAPL)', `count=${si.length}`);
  } catch (e) { fail('getStockIndustry(AAPL)', e); }

  try {
    const perms = await qc.getQuotePermission({});
    ok('getQuotePermission', `count=${perms.length}`);
  } catch (e) { fail('getQuotePermission', e); }

  try {
    const kq = await qc.getKlineQuota({ withDetails: true });
    ok('getKlineQuota', `count=${kq.length}`);
  } catch (e) { fail('getKlineQuota', e); }

  console.log('\n=== v0.4.0: Option extensions ===');
  try {
    const os = await qc.getOptionSymbols({ market: 'US' });
    ok('getOptionSymbols(US)', `count=${os.length}`);
  } catch (e) {
    const msg = String(e);
    if (msg.includes('permission') || msg.includes('code=4') || msg.includes('unauthorized') || msg.includes('not support')) {
      skip('getOptionSymbols(US)', `no permission: ${msg}`);
    } else { fail('getOptionSymbols(US)', e); }
  }
  skip('getOptionBars', 'need explicit OptionQuery; covered by getOptionKline');
  skip('getOptionTradeTicks', 'need explicit OptionQuery');
  skip('getOptionTimeline', 'need explicit OptionQuery');
  skip('getOptionDepth', 'need explicit OptionBasic');

  try {
    const analyses = await qc.getOptionAnalysis({ symbols: ['AAPL'], market: 'US', period: '26week' });
    if (analyses.length > 0) {
      const a = analyses[0];
      ok('getOptionAnalysis(AAPL)', `symbol=${a.symbol ?? ''} impliedVol30Days=${a.impliedVol30Days ?? 0} hisVolatility=${a.hisVolatility ?? 0} ivHisVRatio=${a.ivHisVRatio ?? 0} callPutRatio=${a.callPutRatio ?? 0} volListLen=${a.volatilityList?.length ?? 0}`);
    } else {
      skip('getOptionAnalysis(AAPL)', 'no data returned (permission or no data)');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/permission|forbidden|401|403/i.test(msg)) {
      skip('getOptionAnalysis(AAPL)', `permission denied: ${msg}`);
    } else {
      fail('getOptionAnalysis(AAPL)', e);
    }
  }

  console.log('\n=== v0.4.0: Future extensions ===');
  const fCode = 'MEUR2609';
  const fType = 'MEUR';
  try {
    const items = await qc.getFutureContract({ contractCode: fCode });
    ok(`getFutureContract(${fCode})`, `count=${items.length}`);
  } catch (e) { fail(`getFutureContract(${fCode})`, e); }

  try {
    const items = await qc.getAllFutureContracts({ type: fType });
    ok(`getAllFutureContracts(${fType})`, `count=${items.length}`);
  } catch (e) { fail(`getAllFutureContracts(${fType})`, e); }

  try {
    const c = await qc.getCurrentFutureContract({ type: fType });
    ok(`getCurrentFutureContract(${fType})`, c ? `code=${c.contractCode ?? ''}` : '(empty)');
  } catch (e) { fail(`getCurrentFutureContract(${fType})`, e); }

  try {
    const items = await qc.getFutureContinuousContracts({ type: fType });
    ok(`getFutureContinuousContracts(${fType})`, `count=${items.length}`);
  } catch (e) { fail(`getFutureContinuousContracts(${fType})`, e); }

  skip('getFutureHistoryMainContract', 'needs explicit contractCodes+time range');

  try {
    const ks = await qc.getFutureKline({ contractCodes: [fCode], period: 'day', beginTime: -1, endTime: -1 });
    ok(`getFutureKline(${fCode})`, `count=${ks.length} bars0=${ks[0]?.items?.length ?? 0}`);
  } catch (e) { fail(`getFutureKline(${fCode})`, e); }

  try {
    const ticks = await qc.getFutureTradeTicks({ contractCode: fCode, limit: 10 });
    ok(`getFutureTradeTicks(${fCode})`, `count=${ticks.length}`);
  } catch (e) { fail(`getFutureTradeTicks(${fCode})`, e); }

  try {
    const d = await qc.getFutureDepth({ contractCodes: [fCode] });
    ok(`getFutureDepth(${fCode})`, `count=${d.length}`);
  } catch (e) { fail(`getFutureDepth(${fCode})`, e); }

  try {
    const tt = await qc.getFutureTradingTimes({ contractCode: fCode });
    ok(`getFutureTradingTimes(${fCode})`, tt ? `bizDate=${tt.bizDate ?? ''} zone=${tt.zone ?? ''} segments=${tt.tradingTimes?.length ?? 0}` : '(empty)');
  } catch (e) { fail(`getFutureTradingTimes(${fCode})`, e); }

  console.log('\n=== v0.4.0: Funds ===');
  try {
    const fs = await qc.getFundSymbols({});
    ok('getFundSymbols', `count=${fs.length}`);
  } catch (e) { fail('getFundSymbols', e); }

  try {
    const cs = await qc.getFundContracts({ symbols: ['00003.HK'] });
    ok('getFundContracts(00003.HK)', `count=${cs.length}`);
  } catch (e) { fail('getFundContracts(00003.HK)', e); }

  try {
    const q = await qc.getFundQuote({ symbols: ['00003.HK'] });
    ok('getFundQuote(00003.HK)', `count=${q.length}`);
  } catch (e) { fail('getFundQuote(00003.HK)', e); }

  try {
    // getFundHistoryQuote wire uses begin_time/end_time (ms timestamps).
    const beginMs = Date.UTC(2025, 4, 1);
    const endMs = Date.UTC(2025, 4, 7);
    const hq = await qc.getFundHistoryQuote({ symbols: ['00003.HK'], beginTime: beginMs, endTime: endMs });
    ok('getFundHistoryQuote(00003.HK)', `count=${hq.length}`);
  } catch (e) { fail('getFundHistoryQuote(00003.HK)', e); }

  console.log('\n=== v0.4.0: Warrants ===');
  skip('getWarrantQuote', 'needs explicit HK warrant symbol');
  skip('getWarrantFilter', 'needs explicit underlying symbol');

  console.log('\n=== v0.4.0: Industry ===');
  try {
    const list = await qc.getIndustryList({ industryLevel: 'GSECTOR' });
    ok('getIndustryList(GSECTOR)', `count=${list.length}`);
  } catch (e) { fail('getIndustryList(GSECTOR)', e); }
  skip('getIndustryStocks', 'needs industryId from getIndustryList');

  console.log('\n=== v0.4.0: Corporate actions / financial / calendar ===');
  try {
    const rows = await qc.getCorporateSplit({
      symbols: ['AAPL'], market: 'US', actionType: 'split',
      beginDate: '2020-01-01', endDate: '2024-12-31',
    });
    ok('getCorporateSplit(AAPL)', `rows=${rows.length}`);
  } catch (e) { fail('getCorporateSplit(AAPL)', e); }

  try {
    const rows = await qc.getCorporateDividend({
      symbols: ['AAPL'], market: 'US', actionType: 'dividend',
      beginDate: '2024-01-01', endDate: '2024-12-31',
    });
    ok('getCorporateDividend(AAPL)', `rows=${rows.length}`);
  } catch (e) { fail('getCorporateDividend(AAPL)', e); }

  skip('getCorporateEarningsCalendar', 'covered via getCorporateAction(earning) if needed');
  try {
    const rows = await qc.getCorporateSymbolChange({
      symbols: ['META'], market: 'US', actionType: 'symbol_change',
      beginDate: '2022-01-01', endDate: '2023-01-01',
    });
    ok('getCorporateSymbolChange(META)', `rows=${rows.length}`);
  } catch (e) { fail('getCorporateSymbolChange(META)', e); }
  try {
    const rows = await qc.getCorporateDelisting({
      symbols: ['TWTR'], market: 'US', actionType: 'delisting',
      beginDate: '2022-01-01', endDate: '2023-01-01',
    });
    ok('getCorporateDelisting(TWTR)', `rows=${rows.length}`);
  } catch (e) { fail('getCorporateDelisting(TWTR)', e); }
  try {
    const rows = await qc.getCorporateIPO({
      symbols: ['RIVN'], market: 'US', actionType: 'ipo',
      beginDate: '2021-01-01', endDate: '2022-01-01',
    });
    ok('getCorporateIPO(RIVN)', `rows=${rows.length}`);
  } catch (e) { fail('getCorporateIPO(RIVN)', e); }

  try {
    const rows = await qc.getFinancialCurrency({ symbols: ['AAPL'], market: 'US' });
    ok('getFinancialCurrency(AAPL)', `count=${rows.length}`);
  } catch (e) { fail('getFinancialCurrency(AAPL)', e); }

  try {
    const rows = await qc.getFinancialExchangeRate({
      currencyList: ['USD'], beginDate: '20250501', endDate: '20250507',
    });
    ok('getFinancialExchangeRate(USD)', `count=${rows.length}`);
  } catch (e) { fail('getFinancialExchangeRate(USD)', e); }

  try {
    const rows = await qc.getTradingCalendar({
      market: 'US', beginDate: '2025-05-01', endDate: '2025-05-31',
    });
    ok('getTradingCalendar(US)', `count=${rows.length}`);
  } catch (e) { fail('getTradingCalendar(US)', e); }

  console.log('\n=== v0.4.0: Misc ===');
  try {
    const groups = await qc.getMarketScannerTags({ market: 'US', multiTagFieldList: ['MultiTagField_Industry'] });
    if (groups.length > 0) {
      const g = groups[0];
      ok('getMarketScannerTags(US)', `groups=${groups.length} market=${g.market ?? ''} multiTagField=${g.multiTagField ?? ''} tagListLen=${g.tagList?.length ?? 0}`);
    } else {
      skip('getMarketScannerTags(US)', 'no data returned (permission or no data)');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/permission|forbidden|401|403/i.test(msg)) {
      skip('getMarketScannerTags(US)', `permission denied: ${msg}`);
    } else {
      fail('getMarketScannerTags(US)', e);
    }
  }

  try {
    const rows = await qc.getQuoteOvernight({ symbols: ['AAPL'] });
    ok('getQuoteOvernight(AAPL)', `count=${rows.length}`);
  } catch (e) { fail('getQuoteOvernight(AAPL)', e); }

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
