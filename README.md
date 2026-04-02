# Tiger OpenAPI TypeScript SDK

TypeScript SDK for Tiger Brokers OpenAPI — market data, trading, account management, and real-time push notifications.

老虎证券 OpenAPI 的 TypeScript SDK，提供行情查询、交易下单、账户管理和实时推送等功能。

[![npm version](https://img.shields.io/npm/v/@tigeropenapi/tigeropen.svg)](https://www.npmjs.com/package/@tigeropenapi/tigeropen)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation / 安装

```bash
npm install @tigeropenapi/tigeropen
# or
yarn add @tigeropenapi/tigeropen
# or
pnpm add @tigeropenapi/tigeropen
```

Requires Node.js >= 16.0.0. / 要求 Node.js >= 16.0.0。

## Quick Start / 快速开始

```typescript
import { createClientConfig } from '@tigeropenapi/tigeropen';
import { HttpClient } from '@tigeropenapi/tigeropen/client/http-client';
import { QuoteClient } from '@tigeropenapi/tigeropen/quote/quote-client';

// 1. Create config (load from properties file) / 创建配置（从 properties 文件加载）
const config = createClientConfig({
  propertiesFilePath: 'tiger_openapi_config.properties',
});

// 2. Create HTTP client / 创建 HTTP 客户端
const httpClient = new HttpClient(config);

// 3. Create quote client and query / 创建行情客户端并查询
const qc = new QuoteClient(httpClient);
const states = await qc.getMarketState('US');
console.log('Market state:', states);
```

## Configuration / 配置

Priority: **environment variables > code / config file > defaults**

优先级：**环境变量 > 代码设置（含配置文件） > 默认值**

### Option 1: Code / 方式一：代码直接设置

```typescript
import { createClientConfig } from '@tigeropenapi/tigeropen';

const config = createClientConfig({
  tigerId: 'your_tiger_id',
  privateKey: 'your_rsa_private_key',
  account: 'your_account',
});
```

### Option 2: Properties file / 方式二：配置文件

```typescript
const config = createClientConfig({
  propertiesFilePath: 'tiger_openapi_config.properties',
});
```

File format / 配置文件格式：

```properties
tiger_id=your_developer_id
private_key=your_rsa_private_key
account=your_trading_account
```

### Option 3: Environment variables / 方式三：环境变量

```bash
export TIGEROPEN_TIGER_ID=your_developer_id
export TIGEROPEN_PRIVATE_KEY=your_rsa_private_key
export TIGEROPEN_ACCOUNT=your_trading_account
```

### Config options / 配置项说明

| Field | Description | Required | Default |
|-------|-------------|----------|---------|
| tigerId | Developer ID / 开发者 ID | Yes | - |
| privateKey | RSA private key / RSA 私钥 | Yes | - |
| account | Trading account / 交易账户 | No | - |
| language | Language (zh_CN/en_US) / 语言 | No | zh_CN |
| timeout | Request timeout in seconds / 超时（秒） | No | 15 |
| sandboxDebug | Use sandbox environment / 沙箱环境 | No | false |

## Market Data / 行情查询

```typescript
import { HttpClient } from '@tigeropenapi/tigeropen/client/http-client';
import { QuoteClient } from '@tigeropenapi/tigeropen/quote/quote-client';

const httpClient = new HttpClient(config);
const qc = new QuoteClient(httpClient);

// Get market status / 获取市场状态
const states = await qc.getMarketState('US');

// Get real-time quotes / 获取实时报价
const briefs = await qc.getBrief(['AAPL', 'TSLA']);

// Get K-line data / 获取 K 线数据
const klines = await qc.getKline('AAPL', 'day');

// Get intraday timeline / 获取分时数据
const timeline = await qc.getTimeline(['AAPL']);

// Get order book depth / 获取深度行情
const depth = await qc.getQuoteDepth('AAPL');

// Get option expirations / 获取期权到期日
const expiry = await qc.getOptionExpiration('AAPL');

// Get option chain / 获取期权链
const chain = await qc.getOptionChain('AAPL', '2024-01-19');

// Get futures exchanges / 获取期货交易所列表
const exchanges = await qc.getFutureExchange();
```

## Trading / 交易操作

```typescript
import { HttpClient } from '@tigeropenapi/tigeropen/client/http-client';
import { TradeClient } from '@tigeropenapi/tigeropen/trade/trade-client';

const httpClient = new HttpClient(config);
const tc = new TradeClient(httpClient, config.account);

// Build a limit order / 构造限价单
const order = {
  symbol: 'AAPL',
  secType: 'STK',
  action: 'BUY',
  orderType: 'LMT',
  totalQuantity: 100,
  limitPrice: 150.0,
  timeInForce: 'DAY',
};

// Place order / 下单
const result = await tc.placeOrder(order);

// Preview order (no actual submission) / 预览订单（不实际下单）
const preview = await tc.previewOrder(order);

// Modify order / 修改订单
const modifiedOrder = { ...order, limitPrice: 155.0 };
await tc.modifyOrder(orderId, modifiedOrder);

// Cancel order / 取消订单
await tc.cancelOrder(orderId);

// Get all orders / 查询全部订单
const orders = await tc.getOrders();

// Get positions / 查询持仓
const positions = await tc.getPositions();

// Get assets / 查询资产
const assets = await tc.getAssets();
```

## Generic Execute / 通用方法

For APIs not yet wrapped by the SDK, use `HttpClient.execute` directly.

当 SDK 尚未封装某个 API 时，可以使用 `HttpClient.execute` 直接调用：

```typescript
const httpClient = new HttpClient(config);

const resp = await httpClient.execute('market_state', JSON.stringify({ market: 'US' }));
console.log('Raw response:', resp);
```

## Real-time Push / 实时推送

WebSocket long connection for real-time market data and account events, with auto-reconnect and heartbeat.

通过 WebSocket 长连接接收实时行情和账户推送，支持自动重连和心跳保活：

```typescript
import { PushClient } from '@tigeropenapi/tigeropen/push/push-client';

const pc = new PushClient(config);

pc.setCallbacks({
  onQuote: (data) => {
    console.log(`Quote: ${data.symbol} latest price: ${data.latestPrice}`);
  },
  onOrder: (data) => {
    console.log(`Order: ${data.symbol} status: ${data.status}`);
  },
  onAsset: (data) => {
    console.log('Asset update');
  },
  onPosition: (data) => {
    console.log('Position update');
  },
  onConnect: () => {
    console.log('Connected');
  },
  onDisconnect: () => {
    console.log('Disconnected');
  },
  onError: (err) => {
    console.error('Error:', err);
  },
});

// Connect / 连接
await pc.connect();

// Subscribe to quotes / 订阅行情
pc.subscribeQuote(['AAPL', 'TSLA']);

// Subscribe to account events / 订阅账户推送
pc.subscribeAsset();
pc.subscribeOrder();
pc.subscribePosition();

// Unsubscribe / 退订
pc.unsubscribeQuote(['TSLA']);

// Disconnect / 断开连接
pc.disconnect();
```

## Project Structure / 项目结构

```
openapi-typescript-sdk/
├── src/
│   ├── config/    # Config management / 配置管理
│   ├── signer/    # RSA signing / RSA 签名
│   ├── client/    # HTTP client / HTTP 客户端
│   ├── model/     # Data models / 数据模型
│   ├── quote/     # Quote client / 行情客户端
│   ├── trade/     # Trade client / 交易客户端
│   ├── push/      # WebSocket push client / 推送客户端
│   ├── logger/    # Logger / 日志模块
│   └── index.ts   # Exports / 统一导出
├── examples/      # Examples / 示例代码
└── tests/         # Tests / 测试
```

## ESM and CommonJS / ESM 和 CommonJS

```typescript
// ESM
import { createClientConfig } from '@tigeropenapi/tigeropen';

// CommonJS
const { createClientConfig } = require('@tigeropenapi/tigeropen');
```

## References / 参考链接

- [TypeScript SDK Documentation](https://docs.itigerup.com/docs/typescript)
- [Tiger Brokers OpenAPI Docs](https://quant.itigerup.com/openapi/zh/python/overview/introduction.html)
- [npm package](https://www.npmjs.com/package/@tigeropenapi/tigeropen)

## License / 许可证

[MIT License](LICENSE)
