/**
 * 交易下单示例
 *
 * 演示如何使用 TradeClient 进行下单、查询订单和持仓。
 */

/*
import { createClientConfig } from '../src/config/client-config';
import { TradeClient } from '../src/trade/trade-client';
import { limitOrder } from '../src/model/order-helpers';

async function main() {
  const config = createClientConfig({
    tigerId: '你的 tiger_id',
    privateKey: '你的 RSA 私钥',
    account: '你的交易账户',
  });

  const tc = new TradeClient(config);

  // 创建限价单
  const order = limitOrder('AAPL', 'BUY', 100, 150.0);
  console.log('订单:', order);

  // 下单（需要真实账户）
  // const result = await tc.placeOrder(order);

  // 查询订单
  const orders = await tc.getOrders();
  console.log('订单列表:', orders);

  // 查询持仓
  const positions = await tc.getPositions();
  console.log('持仓列表:', positions);
}

main().catch(console.error);
*/
