/**
 * ClientConfig - 客户端配置管理
 *
 * 聚合所有配置参数，支持：
 * - 代码直接设置
 * - 从 properties 配置文件加载
 * - 环境变量覆盖
 *
 * 优先级：环境变量 > 代码设置（含配置文件） > 默认值
 */
import { readFileSync } from 'fs';
import { parsePropertiesString } from './config-parser';
import { queryDomains, resolveDynamicServerUrl } from './domain';

/** 默认值 */
const DEFAULT_LANGUAGE = 'zh_CN';
const DEFAULT_TIMEOUT = 15;
const DEFAULT_SERVER_URL = 'https://openapi.tigerfintech.com/gateway';
const SANDBOX_SERVER_URL = 'https://openapi-sandbox.tigerfintech.com/gateway';

/** 环境变量名 */
const ENV_TIGER_ID = 'TIGEROPEN_TIGER_ID';
const ENV_PRIVATE_KEY = 'TIGEROPEN_PRIVATE_KEY';
const ENV_ACCOUNT = 'TIGEROPEN_ACCOUNT';

/** 客户端配置接口 */
export interface ClientConfig {
  tigerId: string;
  privateKey: string;
  account: string;
  license?: string;
  language: string;
  timezone?: string;
  timeout: number;
  sandboxDebug: boolean;
  token?: string;
  tokenRefreshDuration?: number;
  serverUrl: string;
}

/** 创建配置时的选项参数 */
export interface ClientConfigOptions {
  tigerId?: string;
  privateKey?: string;
  account?: string;
  license?: string;
  language?: string;
  timezone?: string;
  timeout?: number;
  sandboxDebug?: boolean;
  token?: string;
  tokenRefreshDuration?: number;
  serverUrl?: string;
  /** 是否启用动态域名获取（默认 true） */
  enableDynamicDomain?: boolean;
  /** properties 配置文件路径（同步读取） */
  propertiesFilePath?: string;
}

/**
 * 创建客户端配置。
 *
 * 优先级：环境变量 > 代码设置（含配置文件） > 默认值。
 * 必填字段 tigerId 和 privateKey 为空时抛出错误。
 *
 * @param options - 配置选项
 * @returns 完整的客户端配置对象
 * @throws tigerId 或 privateKey 为空时抛出错误
 */
export function createClientConfig(options: ClientConfigOptions): ClientConfig {
  // 从配置文件加载（如果指定了路径）
  let fileProps: Record<string, string> = {};
  if (options.propertiesFilePath) {
    try {
      const content = readFileSync(options.propertiesFilePath, 'utf-8');
      fileProps = parsePropertiesString(content);
    } catch {
      // 文件加载失败时静默跳过，后续校验会捕获必填字段缺失
    }
  }

  // 从配置文件提取值（代码设置优先于配置文件）
  let tigerId = options.tigerId || fileProps['tiger_id'] || '';
  let privateKey = options.privateKey || resolvePrivateKey(fileProps) || '';
  let account = options.account || fileProps['account'] || '';
  const license = options.license || fileProps['license'];
  const language = options.language || fileProps['language'] || DEFAULT_LANGUAGE;
  const timezone = options.timezone || fileProps['timezone'];

  // 环境变量覆盖（最高优先级）
  const envTigerId = process.env[ENV_TIGER_ID];
  const envPrivateKey = process.env[ENV_PRIVATE_KEY];
  const envAccount = process.env[ENV_ACCOUNT];

  if (envTigerId) {
    tigerId = envTigerId;
  }
  if (envPrivateKey) {
    privateKey = envPrivateKey;
  }
  if (envAccount) {
    account = envAccount;
  }

  // 校验必填字段
  if (!tigerId) {
    throw new Error(
      `tigerId 不能为空，请通过 options.tigerId 或环境变量 ${ENV_TIGER_ID} 设置`
    );
  }
  if (!privateKey) {
    throw new Error(
      `privateKey 不能为空，请通过 options.privateKey 或环境变量 ${ENV_PRIVATE_KEY} 设置`
    );
  }

  // 确定服务器 URL：sandbox > 动态域名 > 默认
  const sandboxDebug = options.sandboxDebug ?? false;
  const enableDynamicDomain = options.enableDynamicDomain ?? true;
  let serverUrl: string;
  if (sandboxDebug) {
    serverUrl = SANDBOX_SERVER_URL;
  } else if (options.serverUrl) {
    serverUrl = options.serverUrl;
  } else {
    // 尝试动态域名获取
    let dynamicUrl = '';
    if (enableDynamicDomain) {
      const domainConf = queryDomains(license);
      dynamicUrl = resolveDynamicServerUrl(domainConf, license);
    }
    serverUrl = dynamicUrl || DEFAULT_SERVER_URL;
  }

  return {
    tigerId,
    privateKey,
    account,
    license,
    language,
    timezone,
    timeout: options.timeout ?? DEFAULT_TIMEOUT,
    sandboxDebug,
    token: options.token,
    tokenRefreshDuration: options.tokenRefreshDuration,
    serverUrl,
  };
}

/**
 * 从 properties 键值对中解析私钥。
 * 优先级：private_key > private_key_pk8 > private_key_pk1
 */
function resolvePrivateKey(props: Record<string, string>): string {
  return props['private_key'] || props['private_key_pk8'] || props['private_key_pk1'] || '';
}
