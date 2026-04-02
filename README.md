# Tiger OpenAPI TypeScript SDK

老虎证券 OpenAPI 的 TypeScript SDK，提供行情查询、交易下单、账户管理和实时推送等功能。

[![npm version](https://img.shields.io/npm/v/@tigeropenapi/tigeropen.svg)](https://www.npmjs.com/package/@tigeropenapi/tigeropen)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 安装

```bash
npm install @tigeropenapi/tigeropen
# 或
yarn add @tigeropenapi/tigeropen
# 或
pnpm add @tigeropenapi/tigeropen
```

要求 Node.js >= 16.0.0。

## Quick Start

以下是一个完整的示例，从配置到查询行情：

```typescript
import { createClientConfig } from '@tigeropenapi/tigeropen';
import { HttpClient } from '@tigeropenapi/tigeropen/client/http-client';
import { QuoteClient } from '@tigeropenapi/tigeropen/quote/quote-client';

// 1. 创建配置（从 properties 文件加载）
const config = createClientConfig({
  propertiesFilePath: 'tiger_openapi_config.properties',
});

// 2. 创建 HTTP 客户端
const httpClient = new HttpClient(config);

// 3. 创建行情客户端并查询
const qc = new QuoteClient(httpClient);
const states = await qc.getMarketState('US');
console.log('美股市场状态:', states);
```

## 配置

SDK 支持三种配置方式，优先级：**环境变量 > 代码设置（含配置文件） > 默认值**。

### 方式一：代码直接设置

```typescript
import { createClientConfig } from '@tigeropenapi/tigeropen';

const config = createClientConfig({
  tigerId: '你的 tiger_id',
  privateKey: '你的 RSA 私钥',
  account: '你的交易账户',
});
```

### 方式二：从 properties 配置文件加载

```typescript
const config = createClientConfig({
  propertiesFilePath: 'tiger_openapi_config.properties',
});
```

配置文件格式：

```properties
tiger_id=你的开发者ID
private_key=你的RSA私钥
account=你的交易账户
```

### 方式三：环境变量

```bash
export TIGEROPEN_TIGER_ID=你的开发者ID
export TIGEROPEN_PRIVATE_KEY=你的RSA私钥
export TIGEROPEN_ACCOUNT=你的交易账户
```

### 配置项说明

| 配置项 | 说明 | 必填 | 默认值 |
|--------|------|------|--------|
| tigerId | 开发者 ID | 是 | - |
| privateKey | RSA 私钥 | 是 | - |
| account | 交易账户 | 否 | - |
| language | 语言（zh_CN/en_US） | 否 | zh_CN |
| timeout | 请求超时（秒） | 否 | 15 |
| sandboxDebug | 是否使用沙箱环境 | 否 | false |

## 行情查询

```typescript
import { HttpClient } from '@tigeropenapi/tigeropen/client/http-client';
import { QuoteClient } from '@tigeropenapi/tigeropen/quote/quote-client';

const httpClient = new HttpClient(config);
const qc = new QuoteClient(httpClient);

// 获取市场状态
const states = await qc.getMarketState('US');

// 获取实时报价
const briefs = await qc.getBrief(['AAPL', 'TSLA']);

// 获取 K 线数据
const klines = await qc.getKline('AAPL', 'day');

// 获取分时数据
const timeline = await qc.getTimeline(['AAPL']);

// 获取深度行情
const depth = await qc.getQuoteDepth('AAPL');

// 获取期权到期日
const expiry = await qc.getOptionExpiration('AAPL');

// 获取期权链
const chain = await qc.getOptionChain('AAPL', '2024-01-19');

// 获取期货交易所列表
const exchanges = await qc.getFutureExchange();
```

## 交易操作

```typescript
import { HttpClient } from '@tigeropenapi/tigeropen/client/http-client';
import { TradeClient } from '@tigeropenapi/tigeropen/trade/trade-client';

const httpClient = new HttpClient(config);
const tc = new TradeClient(httpClient, config.account);

// 构造限价单
const order = {
  symbol: 'AAPL',
  secType: 'STK',
  action: 'BUY',
  orderType: 'LMT',
  totalQuantity: 100,
  limitPrice: 150.0,
  timeInForce: 'DAY',
};

// 下单
const result = await tc.placeOrder(order);

// 预览订单（不实际下单）
const preview = await tc.previewOrder(order);

// 修改订单
const modifiedOrder = { ...order, limitPrice: 155.0 };
await tc.modifyOrder(orderId, modifiedOrder);

// 取消订单
await tc.cancelOrder(orderId);

// 查询全部订单
const orders = await tc.getOrders();

// 查询持仓
const positions = await tc.getPositions();

// 查询资产
const assets = await tc.getAssets();
```

## 通用方法（execute）

当 SDK 尚未封装某个 API 时，可以使用 `HttpClient.execute` 直接调用：

```typescript
const httpClient = new HttpClient(config);

// 直接传入 API 方法名和 JSON 参数
const resp = await httpClient.execute('market_state', JSON.stringify({ market: 'US' }));
console.log('原始响应:', resp);
```

## 实时推送

通过 WebSocket 长连接接收实时行情和账户推送，支持自动重连和心跳保活：

```typescript
import { PushClient } from '@tigeropenapi/tigeropen/push/push-client';

const pc = new PushClient(config);

// 设置回调
pc.setCallbacks({
  onQuote: (data) => {
    console.log(`行情推送: ${data.symbol} 最新价: ${data.latestPrice}`);
  },
  onOrder: (data) => {
    console.log(`订单推送: ${data.symbol} 状态: ${data.status}`);
  },
  onAsset: (data) => {
    console.log('资产变动推送');
  },
  onPosition: (data) => {
    console.log('持仓变动推送');
  },
  onConnect: () => {
    console.log('推送连接成功');
  },
  onDisconnect: () => {
    console.log('推送连接断开');
  },
  onError: (err) => {
    console.error('推送错误:', err);
  },
});

// 连接
await pc.connect();

// 订阅行情
pc.subscribeQuote(['AAPL', 'TSLA']);

// 订阅账户推送
pc.subscribeAsset();
pc.subscribeOrder();
pc.subscribePosition();

// 退订
pc.unsubscribeQuote(['TSLA']);

// 断开连接
pc.disconnect();
```

## 项目结构

```
openapi-typescript-sdk/
├── src/
│   ├── config/    # 配置管理（ClientConfig、ConfigParser、动态域名）
│   ├── signer/    # RSA 签名
│   ├── client/    # HTTP 客户端（请求/响应、重试策略、execute）
│   ├── model/     # 数据模型（Order、Contract、Position、枚举）
│   ├── quote/     # 行情查询客户端
│   ├── trade/     # 交易客户端
│   ├── push/      # WebSocket 实时推送客户端
│   ├── logger/    # 日志模块
│   └── index.ts   # 统一导出
├── examples/      # 示例代码
└── tests/         # 测试
```

## ESM 和 CommonJS

本 SDK 同时支持 ESM 和 CommonJS：

```typescript
// ESM
import { createClientConfig } from '@tigeropenapi/tigeropen';

// CommonJS
const { createClientConfig } = require('@tigeropenapi/tigeropen');
```

## API 参考

- [老虎证券 OpenAPI 文档](https://quant.itigerup.com/openapi/zh/python/overview/introduction.html)
- [npm 包主页](https://www.npmjs.com/package/@tigeropenapi/tigeropen)

## 许可证

[MIT License](LICENSE)
