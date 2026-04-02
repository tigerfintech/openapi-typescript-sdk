/**
 * 实时推送示例
 *
 * 演示如何使用 PushClient 接收实时行情和账户推送。
 */

/*
import { createClientConfig } from '../src/config/client-config';
import { PushClient } from '../src/push/push-client';

async function main() {
  const config = createClientConfig({
    propertiesFilePath: 'tiger_openapi_config.properties',
  });

  const pc = new PushClient(config);

  pc.setCallbacks({
    onQuote: (data) => {
      console.log(`[行情] ${data.symbol}: ${data.latestPrice}`);
    },
    onOrder: (data) => {
      console.log(`[订单] ${data.symbol}: ${data.status}`);
    },
    onConnect: () => console.log('已连接推送服务器'),
    onDisconnect: () => console.log('已断开连接'),
    onError: (err) => console.error('错误:', err),
  });

  await pc.connect();
  pc.subscribeQuote(['AAPL', 'TSLA']);
  pc.subscribeAsset();

  // 保持运行
  process.on('SIGINT', () => {
    pc.disconnect();
    process.exit(0);
  });
}

main().catch(console.error);
*/
