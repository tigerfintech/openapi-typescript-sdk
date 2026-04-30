/**
 * Push example — comprehensive
 *
 * Demonstrates how to connect to the push server, register ALL callback
 * types, and subscribe to multiple market-data and account-level streams.
 *
 * Config is auto-discovered from:
 *   ./tiger_openapi_config.properties  (current directory)
 *   ~/.tigeropen/tiger_openapi_config.properties  (home directory)
 *
 * Run: npx tsx examples/push-example.ts
 */

import { createClientConfig } from '../src/config/client-config';
import { PushClient } from '../src/push/push-client';

async function main() {
  const config = createClientConfig();
  const pc = new PushClient(config);

  // Register ALL available callback types
  pc.setCallbacks({
    // --- Market data callbacks ---
    onQuote: (data) =>
      console.log(`[Quote]       ${data.symbol}  price=${data.latestPrice}  vol=${data.volume}`),
    onTick: (data) =>
      console.log(`[Tick]        ${data.symbol}  prices=${data.price.length}  volumes=${data.volume.length}`),
    onDepth: (data) =>
      console.log(`[Depth]       ${data.symbol}  asks=${data.ask?.price?.length ?? 0}  bids=${data.bid?.price?.length ?? 0}`),
    onKline: (data) =>
      console.log(`[Kline]       ${data.symbol}  open=${data.open}  close=${data.close}  vol=${data.volume}`),
    onOption: (data) =>
      console.log(`[Option]      ${data.symbol}  price=${data.latestPrice}`),
    onFuture: (data) =>
      console.log(`[Future]      ${data.symbol}  price=${data.latestPrice}`),
    onStockTop: (data) =>
      console.log(`[StockTop]    market=${data.market}  categories=${data.topData.length}`),
    onOptionTop: (data) =>
      console.log(`[OptionTop]   market=${data.market}  categories=${data.topData.length}`),
    onFullTick: (data) =>
      console.log(`[FullTick]    ${data.symbol}  ticks=${data.ticks.length}`),
    onQuoteBBO: (data) =>
      console.log(`[QuoteBBO]    ${data.symbol}  ask=${data.askPrice}  bid=${data.bidPrice}`),

    // --- Account push callbacks ---
    onOrder: (data) =>
      console.log(`[Order]       id=${data.id}  status=${data.status}  symbol=${data.symbol}`),
    onPosition: (data) =>
      console.log(`[Position]    symbol=${data.symbol}  qty=${data.position}  pnl=${data.unrealizedPnl}`),
    onTransaction: (data) =>
      console.log(`[Transaction] id=${data.id}  filledQty=${data.filledQuantity}  price=${data.filledPrice}`),

    // --- Connection lifecycle callbacks ---
    onConnect: () => console.log('[Connected]   push server connected'),
    onDisconnect: () => console.log('[Disconnected] push server disconnected'),
    onError: (err) => console.error('[Error]       ', err.message),
    onKickout: (msg) => console.warn('[Kickout]     ', msg),
  });

  // Connect to the push server (authenticates automatically)
  await pc.connect();
  console.log('\n=== Subscribing to market data ===');

  // Real-time quotes for multiple symbols
  pc.subscribeQuote(['AAPL', 'TSLA']);
  console.log('Subscribed: quotes for AAPL, TSLA');

  // Order-book depth for AAPL
  pc.subscribeDepth(['AAPL']);
  console.log('Subscribed: depth for AAPL');

  // Trade ticks for AAPL
  pc.subscribeTick(['AAPL']);
  console.log('Subscribed: trade ticks for AAPL');

  // Kline updates
  pc.subscribeKline(['AAPL']);
  console.log('Subscribed: kline for AAPL');

  console.log('\n=== Subscribing to account streams ===');

  // Account-level push: orders, positions, transactions, assets
  pc.subscribeOrder();
  console.log('Subscribed: order status');

  pc.subscribePosition();
  console.log('Subscribed: position changes');

  pc.subscribeTransaction();
  console.log('Subscribed: transaction details');

  pc.subscribeAsset();
  console.log('Subscribed: asset changes');

  console.log('\nListening for push data… (Ctrl+C to stop)\n');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down…');
    pc.disconnect();
    process.exit(0);
  });
}

main().catch(console.error);
