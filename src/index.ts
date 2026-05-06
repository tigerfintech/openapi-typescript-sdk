/**
 * 老虎证券 OpenAPI TypeScript SDK
 *
 * 本 SDK 提供行情查询、交易下单、账户管理和实时推送等功能，
 * 与 Python SDK 保持功能对等，遵循 TypeScript 最佳实践。
 *
 * 分层架构：
 * - 模型层（model）：Contract、Order、Position 等数据模型和枚举
 * - 配置层（config）：ClientConfig、ConfigParser
 * - 认证层（signer）：RSA 签名
 * - 传输层（client）：HttpClient、重试策略
 * - 业务层（quote/trade）：QuoteClient、TradeClient
 * - 推送层（push）：PushClient
 *
 * @packageDocumentation
 */

/** SDK 版本号 */
export const VERSION = '0.3.0';
