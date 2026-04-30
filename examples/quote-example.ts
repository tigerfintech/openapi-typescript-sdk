/**
 * Quote example — comprehensive
 *
 * Demonstrates all major QuoteClient methods: market state, real-time
 * quotes, kline, timeline, depth, trade ticks, option expiration,
 * futures exchanges, quote permissions, and capital flow.
 *
 * Config is auto-discovered from:
 *   ./tiger_openapi_config.properties  (current directory)
 *   ~/.tigeropen/tiger_openapi_config.properties  (home directory)
 *
 * Run: npx tsx examples/quote-example.ts
 */

import { createClientConfig } from '../src/config/client-config';
import { HttpClient } from '../src/client/http-client';
import { QuoteClient } from '../src/quote/quote-client';

async function main() {
  const config = createClientConfig();
  const httpClient = new HttpClient(config);
  const qc = new QuoteClient(httpClient);

  // 1. Market state
  console.log('=== Market State (US) ===');
  const states = await qc.marketState('US');
  console.log(JSON.stringify(states, null, 2));

  // 2. Real-time quotes
  console.log('\n=== Real-Time Quotes ===');
  const quotes = await qc.quoteRealTime(['AAPL', 'TSLA']);
  console.log(JSON.stringify(quotes, null, 2));

  // 3. Kline (daily)
  console.log('\n=== Kline Data (AAPL, day) ===');
  const klines = await qc.kline('AAPL', 'day');
  console.log(JSON.stringify(klines, null, 2));

  // 4. Timeline (intraday minute bars)
  console.log('\n=== Timeline (AAPL) ===');
  const timeline = await qc.timeline(['AAPL']);
  console.log(JSON.stringify(timeline, null, 2));

  // 5. Quote depth (order book)
  console.log('\n=== Quote Depth (AAPL) ===');
  const depth = await qc.quoteDepth('AAPL');
  console.log(JSON.stringify(depth, null, 2));

  // 6. Trade ticks (recent trades)
  console.log('\n=== Trade Ticks (AAPL) ===');
  const ticks = await qc.tradeTick(['AAPL']);
  console.log(JSON.stringify(ticks, null, 2));

  // 7. Option expiration dates
  console.log('\n=== Option Expiration (AAPL) ===');
  const expirations = await qc.optionExpiration('AAPL');
  console.log(JSON.stringify(expirations, null, 2));

  // 8. Futures exchange list
  console.log('\n=== Futures Exchanges ===');
  const exchanges = await qc.futureExchange();
  console.log(JSON.stringify(exchanges, null, 2));

  // 9. Quote permissions
  console.log('\n=== Quote Permissions ===');
  const permissions = await qc.grabQuotePermission();
  console.log(JSON.stringify(permissions, null, 2));

  // 10. Capital flow
  console.log('\n=== Capital Flow (AAPL) ===');
  const flow = await qc.capitalFlow('AAPL');
  console.log(JSON.stringify(flow, null, 2));
}

main().catch(console.error);
