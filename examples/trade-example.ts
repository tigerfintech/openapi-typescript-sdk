/**
 * Trade example — comprehensive
 *
 * Demonstrates TradeClient usage: building orders with helper functions,
 * querying orders (all / active / filled), positions, and assets.
 *
 * Config is auto-discovered from:
 *   ./tiger_openapi_config.properties  (current directory)
 *   ~/.tigeropen/tiger_openapi_config.properties  (home directory)
 *
 * Run: npx tsx examples/trade-example.ts
 */

import { createClientConfig } from '../src/config/client-config';
import { HttpClient } from '../src/client/http-client';
import { TradeClient } from '../src/trade/trade-client';
import { limitOrder, marketOrder, stopOrder, stopLimitOrder, trailOrder } from '../src/model/order-helpers';

async function main() {
  const config = createClientConfig();
  const httpClient = new HttpClient(config);
  const tc = new TradeClient(httpClient, config.account);

  // --- Build various order types using helper functions ---
  console.log('=== Order Helpers ===');

  const limit = limitOrder(config.account, 'AAPL', 'STK', 'BUY', 100, 150.0);
  console.log('Limit order :', JSON.stringify(limit));

  const market = marketOrder(config.account, 'AAPL', 'STK', 'BUY', 50);
  console.log('Market order:', JSON.stringify(market));

  const stop = stopOrder(config.account, 'AAPL', 'STK', 'SELL', 100, 140.0);
  console.log('Stop order  :', JSON.stringify(stop));

  const stopLmt = stopLimitOrder(config.account, 'AAPL', 'STK', 'SELL', 100, 139.0, 140.0);
  console.log('Stop-limit  :', JSON.stringify(stopLmt));

  const trail = trailOrder(config.account, 'AAPL', 'STK', 'SELL', 100, 5.0);
  console.log('Trail order :', JSON.stringify(trail));

  // --- Place order (uncomment when using a real account) ---
  // console.log('\n=== Place Order ===');
  // const placeResult = await tc.placeOrder(limit);
  // console.log(JSON.stringify(placeResult, null, 2));

  // --- Query account assets ---
  console.log('\n=== Assets ===');
  const assets = await tc.assets();
  console.log(JSON.stringify(assets, null, 2));

  // --- Query all orders ---
  console.log('\n=== All Orders ===');
  const allOrders = await tc.orders();
  console.log(JSON.stringify(allOrders, null, 2));

  // --- Query active (pending) orders ---
  console.log('\n=== Active Orders ===');
  const active = await tc.activeOrders();
  console.log(JSON.stringify(active, null, 2));

  // --- Query filled orders ---
  console.log('\n=== Filled Orders ===');
  const filled = await tc.filledOrders();
  console.log(JSON.stringify(filled, null, 2));

  // --- Query positions ---
  console.log('\n=== Positions ===');
  const positions = await tc.positions();
  console.log(JSON.stringify(positions, null, 2));
}

main().catch(console.error);
