/**
 * Trade example — covers every TradeClient method end-to-end.
 *
 * Will place a real limit order: BUY 1 AAPL @ $1.00 (far below market;
 * will not fill under normal conditions), then ModifyOrder and
 * CancelOrder. Safe for sandbox / margin accounts.
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
  console.log(`[ OK ] ${name.padEnd(36)} ${truncate(note, 160)}`);
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
  const cfg = createClientConfig();
  console.log(`tiger_id=${cfg.tigerId} account=${cfg.account}\n`);

  const tc = new TradeClient(new HttpClient(cfg), cfg.account);

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
    const assets = await tc.getAssets();
    const a = assets[0];
    ok('getAssets', a
      ? `account=${a.account ?? ''} buyingPower=${a.buyingPower ?? 0} netLiquidation=${a.netLiquidation ?? 0} segments=${a.segments?.length ?? 0}`
      : '(empty)');
  } catch (e) { fail('getAssets', e); }

  try {
    const pa = await tc.getPrimeAssets();
    const totalBP = pa?.segments.reduce((s, x) => s + (x.buyingPower ?? 0), 0) ?? 0;
    ok('getPrimeAssets', `account=${pa?.accountId ?? ''} segments=${pa?.segments.length ?? 0} totalBuyingPower=${totalBP.toFixed(2)}`);
  } catch (e) { fail('getPrimeAssets', e); }

  try {
    const ps = await tc.getPositions();
    const totalMV = ps.reduce((s, p) => s + (p.marketValue ?? 0), 0);
    ok('getPositions', `count=${ps.length} totalMarketValue=${totalMV.toFixed(2)}`);
  } catch (e) { fail('getPositions', e); }

  console.log('\n=== Order queries ===');
  try {
    const os = await tc.getOrders();
    ok('getOrders', `count=${os.length}`);
  } catch (e) { fail('getOrders', e); }
  try {
    const os = await tc.getActiveOrders();
    ok('getActiveOrders', `count=${os.length}`);
  } catch (e) { fail('getActiveOrders', e); }
  try {
    const os = await tc.getInactiveOrders();
    ok('getInactiveOrders', `count=${os.length}`);
  } catch (e) { fail('getInactiveOrders', e); }

  const now = Date.now();
  try {
    const os = await tc.getFilledOrders(now - 30 * 24 * 3600 * 1000, now);
    ok('getFilledOrders', `count=${os.length} (last 30d)`);
  } catch (e) { fail('getFilledOrders', e); }

  let existingOrderID = 0;
  try {
    const orders = await tc.getOrders();
    existingOrderID = orders[0]?.id ?? 0;
  } catch { /* ignore */ }

  if (existingOrderID) {
    try {
      const txs = await tc.getOrderTransactions(existingOrderID, 'AAPL', 'STK');
      ok(`getOrderTransactions(${existingOrderID})`, `count=${txs.length}`);
    } catch (e) { fail(`getOrderTransactions(${existingOrderID})`, e); }
  } else {
    skip('getOrderTransactions', 'no existing order');
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
