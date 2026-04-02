/**
 * 行情查询示例
 *
 * 演示如何使用 QuoteClient 查询市场状态、实时报价和 K 线数据。
 */

/*
import { createClientConfig } from '../src/config/client-config';
import { QuoteClient } from '../src/quote/quote-client';

async function main() {
  const config = createClientConfig({
    tigerId: '你的 tiger_id',
    privateKey: '你的 RSA 私钥',
    account: '你的交易账户',
  });

  const qc = new QuoteClient(config);

  // 查询市场状态
  console.log('=== 市场状态 ===');
  const states = await qc.getMarketState('US');
  console.log(states);

  // 查询实时报价
  console.log('\n=== 实时报价 ===');
  const quotes = await qc.getQuoteRealTime(['AAPL', 'TSLA']);
  console.log(quotes);

  // 查询 K 线
  console.log('\n=== K 线数据 ===');
  const klines = await qc.getKline('AAPL', 'day', 10);
  console.log(klines);
}

main().catch(console.error);
*/
