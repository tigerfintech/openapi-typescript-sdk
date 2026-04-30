/**
 * 配置层导出
 */
export { parsePropertiesFile, parsePropertiesString } from './config-parser';
export { createClientConfig, loadPropertiesFile } from './client-config';
export type { ClientConfig, ClientConfigOptions } from './client-config';
export { queryDomains, resolveDynamicServerUrl, resolveDynamicQuoteServerUrl } from './domain';
