/**
 * Trade example — covers every TradeClient method end-to-end (v0.4.0).
 *
 * Will place a real limit order: BUY 1 AAPL @ $1.00 (far below market;
 * will not fill under normal conditions), then ModifyOrder and
 * CancelOrder. Safe for sandbox / margin accounts.
 *
 * v0.4.0 additions: every new read-only method is smoke-tested once
 * (17 new methods). Nothing that would move money or modify positions
 * is executed beyond the existing $1.00 limit order flow.
 *
 * Config is auto-discovered from ./tiger_openapi_config.properties or
 * ~/.tigeropen/tiger_openapi_config.properties. PASS/FAIL/SKIP summary
 * is printed at the end.
 *
 * Run: npx tsx examples/trade-example.ts
 */
import { createClientConfig } from '../src/config/client-config';
import { HttpClient } from '../src/client/http-client';
import { TradeClient } from '../src/trade/trade-client';
import { limitOrder } from '../src/model/order-helpers';

type Result = { name: string; ok: boolean; err?: unknown };
const results: Result[] = [];

function ok(name: string, note: string) {
  console.log(`[ OK ] ${name.padEnd(40)} ${truncate(note, 160)}`);
  results.push({ name, ok: true });
}
function fail(name: string, err: unknown) {
  console.log(`[FAIL] ${name.padEnd(40)} ${err instanceof Error ? err.message : String(err)}`);
  results.push({ name, ok: false, err });
}
function skip(name: string, reason: string) {
  console.log(`[SKIP] ${name.padEnd(40)} ${reason}`);
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

  const tc = new TradeClient(new HttpClient(cfg), cfg.account, cfg.secretKey);

  console.log('=== Contract queries ===');
  try {
    const cs = await tc.getContract('AAPL', 'STK');
    ok('getContract(AAPL, STK)',
      cs.length > 0 ? `${cs[0].symbol} contractId=${cs[0].contractId ?? 0} exchange=${cs[0].primaryExchange ?? ''}` : '(empty)');
  } catch (e) { fail('getContract(AAPL, STK)', e); }

  try {
    const cs = await tc.getContracts(['AAPL', 'TSLA'], 'STK');
    ok('getContracts([AAPL TSLA])', `count=${cs.length} ${cs.map(c => c.symbol).join(',')}`);
  } catch (e) { fail('getContracts([AAPL TSLA])', e); }

  try {
    const cs = await tc.getQuoteContract('AAPL', 'OPT', '20260619');
    ok('getQuoteContract(AAPL OPT)', `count=${cs.length}`);
  } catch (e) { fail('getQuoteContract(AAPL OPT)', e); }

  console.log('\n=== Accounts / positions ===');
  try {
    const assets = await tc.getAssets({});
    const a = assets[0];
    ok('getAssets', a
      ? `account=${a.account ?? ''} buyingPower=${a.buyingPower ?? 0} netLiquidation=${a.netLiquidation ?? 0} segments=${a.segments?.length ?? 0}`
      : '(empty)');
  } catch (e) { fail('getAssets', e); }

  try {
    const pa = await tc.getPrimeAssets({});
    const totalBP = pa?.segments.reduce((s, x) => s + (x.buyingPower ?? 0), 0) ?? 0;
    ok('getPrimeAssets', `account=${pa?.accountId ?? ''} segments=${pa?.segments.length ?? 0} totalBuyingPower=${totalBP.toFixed(2)}`);
  } catch (e) { fail('getPrimeAssets', e); }

  try {
    const ps = await tc.getPositions({});
    const totalMV = ps.reduce((s, p) => s + (p.marketValue ?? 0), 0);
    ok('getPositions', `count=${ps.length} totalMarketValue=${totalMV.toFixed(2)}`);
  } catch (e) { fail('getPositions', e); }

  console.log('\n=== Order queries ===');
  try {
    const os = await tc.getOrders({});
    ok('getOrders', `count=${os.length}`);
  } catch (e) { fail('getOrders', e); }
  try {
    const os = await tc.getActiveOrders({});
    ok('getActiveOrders', `count=${os.length}`);
  } catch (e) { fail('getActiveOrders', e); }
  try {
    const os = await tc.getInactiveOrders({});
    ok('getInactiveOrders', `count=${os.length}`);
  } catch (e) { fail('getInactiveOrders', e); }

  const now = Date.now();
  try {
    const os = await tc.getFilledOrders({ startDate: now - 30 * 24 * 3600 * 1000, endDate: now });
    ok('getFilledOrders', `count=${os.length} (last 30d)`);
  } catch (e) { fail('getFilledOrders', e); }

  let existingOrder: { symbol?: string; secType?: string } | undefined;
  try {
    const now = Date.now();
    const filled = await tc.getFilledOrders({ startDate: now - 30 * 24 * 3600 * 1000, endDate: now });
    existingOrder = filled[0] ? { symbol: filled[0].symbol, secType: filled[0].secType } : undefined;
  } catch { /* ignore */ }

  if (existingOrder?.symbol) {
    try {
      const txs = await tc.getOrderTransactions({ symbol: existingOrder.symbol, secType: existingOrder.secType });
      ok(`getOrderTransactions(${existingOrder.symbol})`, `count=${txs.length}`);
    } catch (e) { fail(`getOrderTransactions(${existingOrder.symbol})`, e); }
  } else {
    skip('getOrderTransactions', 'no filled orders in last 30 days');
  }

  console.log('\n=== Place / modify / cancel ===');
  const orderReq = limitOrder(cfg.account, 'AAPL', 'STK', 'BUY', 1, 1.00);
  orderReq.market = 'US';
  orderReq.currency = 'USD';
  orderReq.timeInForce = 'DAY';

  try {
    const preview = await tc.previewOrder(orderReq);
    ok('previewOrder', `isPass=${preview?.isPass} commission=${preview?.commission ?? 0} initMargin=${preview?.initMargin ?? 0}`);
  } catch (e) { fail('previewOrder', e); }

  let placedId = 0;
  try {
    const placed = await tc.placeOrder(orderReq);
    placedId = placed?.id ?? 0;
    ok('placeOrder', `id=${placed?.id ?? 0} orderId=${(placed as unknown as { order_id?: number })?.order_id ?? 0}`);
  } catch (e) { fail('placeOrder', e); }

  if (placedId) {
    const modReq = { ...orderReq, limitPrice: 1.50 };
    try {
      const r = await tc.modifyOrder(placedId, modReq);
      ok(`modifyOrder(${placedId})`, `id=${r?.id ?? 0}`);
    } catch (e) { fail(`modifyOrder(${placedId})`, e); }

    try {
      const r = await tc.cancelOrder(placedId);
      ok(`cancelOrder(${placedId})`, `id=${r?.id ?? 0}`);
    } catch (e) { fail(`cancelOrder(${placedId})`, e); }
  } else {
    skip('modifyOrder', 'placeOrder failed');
    skip('cancelOrder', 'placeOrder failed');
  }

  // ==========================================================================
  // v0.4.0 smoke tests — read-only coverage of every new endpoint.
  // ==========================================================================

  console.log('\n=== v0.4.0: Account management ===');
  try {
    const accs = await tc.getManagedAccounts({});
    ok('getManagedAccounts', `count=${accs.length}${accs[0] ? ` first=${accs[0].account ?? ''}` : ''}`);
  } catch (e) { fail('getManagedAccounts', e); }

  try {
    const cs = await tc.getDerivativeContracts({ symbols: ['AAPL'], secType: 'OPT', expiry: '20260619' });
    ok('getDerivativeContracts(AAPL OPT)', `count=${cs.length}`);
  } catch (e) { fail('getDerivativeContracts(AAPL OPT)', e); }

  console.log('\n=== v0.4.0: Asset analytics ===');
  try {
    const rows = await tc.getAnalyticsAsset({ segType: 'SEC', startDate: '2025-05-01', endDate: '2025-05-07' });
    ok('getAnalyticsAsset', `rows=${rows.length}`);
  } catch (e) { fail('getAnalyticsAsset', e); }

  try {
    const agg = await tc.getAggregateAssets({ baseCurrency: 'USD' });
    ok('getAggregateAssets', agg
      ? `accountId=${agg.accountId ?? ''} baseCurrency=${agg.baseCurrency ?? ''} netLiquidation=${agg.netLiquidation ?? 0}`
      : '(empty)');
  } catch (e) { fail('getAggregateAssets', e); }

  try {
    const est = await tc.getEstimateTradableQuantity({
      symbol: 'AAPL', secType: 'STK', action: 'BUY', orderType: 'LMT', limitPrice: 1.00,
    });
    ok('getEstimateTradableQuantity', est
      ? `tradable=${est.tradableQuantity ?? 0} maxCashBuy=${est.maxCashBuyQuantity ?? 0} maxMarginBuy=${est.maxMarginBuyQuantity ?? 0}`
      : '(empty)');
  } catch (e) { fail('getEstimateTradableQuantity', e); }

  console.log('\n=== v0.4.0: Fund details / funding history ===');
  try {
    const rows = await tc.getFundDetails({ segTypes: ['SEC'], limit: 10 });
    ok('getFundDetails', `rows=${rows.length}`);
  } catch (e) { fail('getFundDetails', e); }

  try {
    const rows = await tc.getFundingHistory({ segType: 'SEC' });
    ok('getFundingHistory', `rows=${rows.length}`);
  } catch (e) { fail('getFundingHistory', e); }

  console.log('\n=== v0.4.0: Segment fund transfer (read-only) ===');
  try {
    const rows = await tc.getSegmentFundAvailable({ fromSegment: 'SEC', toSegment: 'FUT', currency: 'USD' });
    ok('getSegmentFundAvailable', `rows=${rows.length}`);
  } catch (e) { fail('getSegmentFundAvailable', e); }

  try {
    const rows = await tc.getSegmentFundHistory({ limit: 10 });
    ok('getSegmentFundHistory', `rows=${rows.length}`);
  } catch (e) { fail('getSegmentFundHistory', e); }

  console.log('\n=== v0.4.0: Position transfer records (read-only) ===');
  try {
    const rows = await tc.getPositionTransferRecords({ sinceDate: '2025-04-01', toDate: '2025-05-31' });
    ok('getPositionTransferRecords', `rows=${rows.length}`);
  } catch (e) { fail('getPositionTransferRecords', e); }

  try {
    const rows = await tc.getPositionTransferExternalRecords({ sinceDate: '2025-04-01', toDate: '2025-05-31' });
    ok('getPositionTransferExternalRecords', `rows=${rows.length}`);
  } catch (e) { fail('getPositionTransferExternalRecords', e); }

  console.log('\n=== v0.4.0: GetOrder by orderId ===');
  // Note: Order.id is int64 and exceeds JS MAX_SAFE_INTEGER — use Order.orderId instead
  let firstOrderId = existingOrder ? 0 : 0; // filled above; re-fetch for orderId
  try {
    const now = Date.now();
    const filled = await tc.getFilledOrders({ startDate: now - 30 * 24 * 3600 * 1000, endDate: now });
    firstOrderId = filled[0]?.orderId ?? 0;
  } catch { /* ignore */ }
  if (firstOrderId) {
    try {
      const o = await tc.getOrder({ orderId: firstOrderId });
      ok(`getOrder(orderId=${firstOrderId})`, o ? `orderId=${o.orderId ?? 0} status=${o.status ?? ''} symbol=${o.symbol ?? ''}` : '(empty)');
    } catch (e) { fail(`getOrder(orderId=${firstOrderId})`, e); }
  } else {
    skip('getOrder', 'no filled orders in last 30 days');
  }

  console.log('\n=== v0.4.1: 期权行权（只读） ===');
  try {
    const r = await tc.getOptionExercisePositions({ type: 'Exercise' });
    ok('getOptionExercisePositions(Exercise)', `rows=${r?.items?.length ?? 0} pageCount=${r?.pageCount ?? 0}`);
  } catch (e) { fail('getOptionExercisePositions(Exercise)', e); }

  try {
    const r = await tc.getOptionExercisePositions({ type: 'Expire' });
    ok('getOptionExercisePositions(Expire)', `rows=${r?.items?.length ?? 0} pageCount=${r?.pageCount ?? 0}`);
  } catch (e) { fail('getOptionExercisePositions(Expire)', e); }

  try {
    const r = await tc.getOptionExerciseRecords({ page: 1, size: 10 });
    ok('getOptionExerciseRecords', `rows=${r?.items?.length ?? 0} itemCount=${r?.itemCount ?? 0}`);
  } catch (e) { fail('getOptionExerciseRecords', e); }

  try {
    const positions = await tc.getOptionExercisePositions({ type: 'Exercise' });
    if (positions?.items && positions.items.length > 0) {
      const p = positions.items[0];
      const r = await tc.checkOptionExercise({
        contractId: p.contractId ?? 0,
        type: 'Exercise',
        quantity: p.availableQuantity ?? 0,
        executingDate: p.expireDate,
      });
      ok('checkOptionExercise', `symbol=${r?.symbol ?? ''} availableQty=${r?.availableQuantity ?? 0}`);
    } else {
      skip('checkOptionExercise', 'no exercisable positions');
    }
  } catch (e) { fail('checkOptionExercise', e); }

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
