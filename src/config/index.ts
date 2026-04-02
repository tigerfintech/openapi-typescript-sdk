/**
 * 配置层导出
 */
export { parsePropertiesFile, parsePropertiesString } from './config-parser';
export { createClientConfig } from './client-config';
export type { ClientConfig, ClientConfigOptions } from './client-config';
export { queryDomains, resolveDynamicServerUrl } from './domain';
