/**
 * Integration test: real API connectivity + int64 precision
 *
 * Run: npx tsx examples/integ-token-refresh.ts
 * Override server: TIGER_SERVER_URL=<url> npx tsx examples/integ-token-refresh.ts
 */
import { createClientConfig } from '../src/config/client-config';
import { HttpClient } from '../src/client/http-client';
import { parseApiResponse } from '../src/client/api-response';

let passed = 0;

function pass(name: string, note = '') {
  console.log(`[ OK ] ${name.padEnd(54)} ${note}`);
  passed++;
}
function fail(name: string, err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`[FAIL] ${name.padEnd(54)} ${msg}`);
  process.exit(1);
}

async function main() {
  const serverUrl = process.env['TIGER_SERVER_URL'];
  const opts = serverUrl
    ? { serverUrl, quoteServerUrl: serverUrl, enableDynamicDomain: false as const }
    : { enableDynamicDomain: true as const };

  const cfg = createClientConfig(opts);
  console.log(`tiger_id=${cfg.tigerId} server=${cfg.serverUrl}\n`);

  const hc = new HttpClient(cfg);

  // ── Test 1: Connectivity ───────────────────────────────────────────────────
  try {
    const body = await hc.execute('market_state', JSON.stringify({ market: 'US' }));
    const resp = parseApiResponse(body);
    pass('market_state', `code=${resp.code}`);
  } catch (e) {
    fail('market_state', e);
  }

  // ── Test 2: int64 precision (single-line JSON) ─────────────────────────────
  try {
    const resp = parseApiResponse('{"code":0,"message":"ok","data":{"orderId":28868646234578944},"timestamp":1700000000}');
    const data = resp.data as { orderId: string };
    if (data.orderId !== '28868646234578944') fail('int64 precision', new Error(`got ${data.orderId}`));
    pass('parseApiResponse int64 precision', `orderId="${data.orderId}"`);
  } catch (e) {
    fail('parseApiResponse int64 precision', e);
  }

  // ── Test 3: int64 precision (multiline JSON, m-flag) ──────────────────────
  try {
    const multiline = `{\n"code": 0,\n"message": "ok",\n"data": {\n"orderId": 28868646234578944\n},\n"timestamp": 1000\n}`;
    const resp = parseApiResponse(multiline);
    const data = resp.data as { orderId: string };
    if (data.orderId !== '28868646234578944') fail('int64 multiline', new Error(`got ${data.orderId}`));
    pass('patchLargeIntegers multiline JSON', `orderId="${data.orderId}"`);
  } catch (e) {
    fail('patchLargeIntegers multiline JSON', e);
  }

  // ── Test 4: Float values not affected ─────────────────────────────────────
  try {
    const resp = parseApiResponse('{"code":0,"message":"ok","data":{"price":1234567890123456.7},"timestamp":1000}');
    const data = resp.data as Record<string, unknown>;
    if (typeof data['price'] !== 'number') fail('float type', new Error(`got ${typeof data['price']}`));
    pass('float values not affected by patchLargeIntegers', `typeof price=${typeof data['price']}`);
  } catch (e) {
    fail('float type', e);
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`  PASS: ${passed} tests passed`);
  console.log('══════════════════════════════════════════════════════════');
}

main().catch(e => { console.error(e); process.exit(1); });
