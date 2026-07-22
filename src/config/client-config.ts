/**
 * ClientConfig - Client configuration management
 *
 * Aggregates all configuration parameters with support for:
 * - Direct code configuration
 * - Properties file loading (explicit path or auto-discovery)
 * - Environment variable overrides
 *
 * Priority: environment variables > code options (incl. config file) > defaults
 */
import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { homedir, networkInterfaces } from 'os';
import { parsePropertiesString } from './config-parser';
import { queryDomains, resolveDynamicServerUrl, resolveDynamicQuoteServerUrl } from './domain';
import { TokenManager } from './token-manager';

/** Default config file name */
const CONFIG_FILE_NAME = 'tiger_openapi_config.properties';

/** Defaults */
const DEFAULT_LANGUAGE = 'zh_CN';
const DEFAULT_TIMEOUT = 15;
const DEFAULT_SERVER_URL = 'https://openapi.tigerfintech.com/gateway';

/** Tiger public key for response signature verification (Base64-encoded) */
const TIGER_PUBLIC_KEY =
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDNF3G8SoEcCZh2rshUbayDgLLrj6rKgzNMxDL2HSnKcB0+GPOsndqSv+a4IBu9+I3fyBp5hkyMMG2+AXugd9pMpy6VxJxlNjhX1MYbNTZJUT4nudki4uh+LMOkIBHOceGNXjgB+cXqmlUnjlqha/HgboeHSnSgpM3dKSJQlIOsDwIDAQAB';

/** Environment variable names */
const ENV_TIGER_ID = 'TIGEROPEN_TIGER_ID';
const ENV_PRIVATE_KEY = 'TIGEROPEN_PRIVATE_KEY';
const ENV_ACCOUNT = 'TIGEROPEN_ACCOUNT';
const ENV_SECRET_KEY = 'TIGEROPEN_SECRET_KEY';
const ENV_TOKEN = 'TIGEROPEN_TOKEN';
const ENV_TOKEN_FILE = 'TIGEROPEN_TOKEN_FILE';

/** Client configuration interface */
export interface ClientConfig {
  tigerId: string;
  privateKey: string;
  account: string;
  /** Institution secret key for trade authentication (institution accounts only) */
  secretKey?: string;
  license?: string;
  language: string;
  timezone?: string;
  timeout: number;
  token?: string;
  tokenRefreshDuration?: number;
  /** 后台 token 检查间隔（毫秒），仅 tokenRefreshDuration > 0 时生效，默认 5 分钟 */
  tokenCheckInterval?: number;
  /** 自定义 token 加载函数，替代默认的文件加载 */
  tokenLoader?: () => Promise<string> | string;
  /** token 刷新写入后的可选回调 */
  tokenWriter?: (token: string) => void;
  serverUrl: string;
  /** Quote server URL for quote-specific requests; falls back to serverUrl */
  quoteServerUrl: string;
  /** Device identifier (auto-detected MAC address) */
  deviceId: string;
  tigerPublicKey: string;
}

/** Options for creating a client configuration */
export interface ClientConfigOptions {
  tigerId?: string;
  privateKey?: string;
  account?: string;
  /** Institution secret key for trade authentication (institution accounts only) */
  secretKey?: string;
  license?: string;
  language?: string;
  timezone?: string;
  timeout?: number;
  token?: string;
  tokenRefreshDuration?: number;
  /** 后台 token 检查间隔（毫秒），仅 tokenRefreshDuration > 0 时生效，默认 5 分钟 */
  tokenCheckInterval?: number;
  /** 自定义 token 加载函数，替代默认的文件加载 */
  tokenLoader?: () => Promise<string> | string;
  /** token 刷新写入后的可选回调 */
  tokenWriter?: (token: string) => void;
  serverUrl?: string;
  /** Explicit quote server URL; resolved dynamically if not set */
  quoteServerUrl?: string;
  /** Enable dynamic domain resolution (default: true) */
  enableDynamicDomain?: boolean;
  /** Explicit properties file path or directory (synchronous read).
   * If a directory is given, appends 'tiger_openapi_config.properties' automatically. */
  propertiesFilePath?: string;
  /** Override Tiger public key (e.g. for sandbox/QA environments) */
  tigerPublicKey?: string;
}

/**
 * Load and parse a Java-style properties file.
 *
 * @param filePath - Absolute or relative path to the properties file
 * @returns Parsed key-value pairs, or empty object if the file cannot be read
 */
export function loadPropertiesFile(filePath: string): Record<string, string> {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return parsePropertiesString(content);
  } catch {
    return {};
  }
}

/**
 * Discover the config file by searching well-known locations.
 *
 * Search order:
 * 1. `./tiger_openapi_config.properties` (current working directory)
 * 2. `~/.tigeropen/tiger_openapi_config.properties` (home directory)
 *
 * @returns The resolved file path, or `undefined` if not found
 */
function discoverConfigFile(): string | undefined {
  const candidates = [
    join(process.cwd(), CONFIG_FILE_NAME),
    join(homedir(), '.tigeropen', CONFIG_FILE_NAME),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Auto-detect device identifier from the first non-internal MAC address.
 *
 * @returns MAC address string, or empty string if none found
 */
function detectDeviceId(): string {
  const interfaces = networkInterfaces();
  for (const [, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
        return addr.mac;
      }
    }
  }
  return '';
}

/**
 * Create a client configuration.
 *
 * When called with no arguments (or without `propertiesFilePath`), the function
 * automatically searches for `tiger_openapi_config.properties` in the current
 * directory and `~/.tigeropen/`. Discovered values serve as defaults; explicit
 * options and environment variables take precedence.
 *
 * Priority: environment variables > code options > config file > defaults
 *
 * @param options - Configuration options (optional)
 * @returns Complete client configuration object
 * @throws When tigerId or privateKey is empty after all resolution
 */
export function createClientConfig(options?: ClientConfigOptions): ClientConfig {
  const opts = options ?? {};

  // Load properties: explicit path > auto-discovery
  let fileProps: Record<string, string> = {};
  if (opts.propertiesFilePath) {
    // Support both directory path and full file path
    let filePath = opts.propertiesFilePath;
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, CONFIG_FILE_NAME);
    } else if (!existsSync(filePath) && !filePath.endsWith('.properties')) {
      // Path doesn't exist as-is; try treating it as a directory
      const asDir = join(filePath, CONFIG_FILE_NAME);
      if (existsSync(asDir)) filePath = asDir;
    }
    fileProps = loadPropertiesFile(filePath);
  } else {
    const discovered = discoverConfigFile();
    if (discovered) {
      fileProps = loadPropertiesFile(discovered);
    }
  }

  // Merge values (code options override config file)
  let tigerId = opts.tigerId || fileProps['tiger_id'] || '';
  let privateKey = opts.privateKey || resolvePrivateKey(fileProps) || '';
  let account = opts.account || fileProps['account'] || '';
  let secretKey = opts.secretKey || fileProps['secret_key'] || undefined;
  let token = opts.token || fileProps['token'];
  const license = opts.license || fileProps['license'];
  const language = opts.language || fileProps['language'] || DEFAULT_LANGUAGE;
  const timezone = opts.timezone || fileProps['timezone'];

  // Environment variables override everything
  const envTigerId = process.env[ENV_TIGER_ID];
  const envPrivateKey = process.env[ENV_PRIVATE_KEY];
  const envAccount = process.env[ENV_ACCOUNT];
  const envSecretKey = process.env[ENV_SECRET_KEY];
  const envToken = process.env[ENV_TOKEN];

  if (envTigerId) {
    tigerId = envTigerId;
  }
  if (envPrivateKey) {
    privateKey = envPrivateKey;
  }
  if (envAccount) {
    account = envAccount;
  }
  if (envSecretKey) {
    secretKey = envSecretKey;
  }
  if (envToken) {
    token = envToken;
  }

  // Token loading priority: env TIGEROPEN_TOKEN > tokenLoader > token file (TIGEROPEN_TOKEN_FILE or default)
  if (!token) {
    if (opts.tokenLoader) {
      // tokenLoader is async-capable; we do a best-effort synchronous call here.
      // If the loader returns a Promise, the token will be set later via HttpClient.
      try {
        const result = opts.tokenLoader();
        if (result instanceof Promise) {
          // Cannot await in sync constructor; HttpClient.startTokenAutoRefresh() will
          // resolve this Promise and sync the token after construction.
        } else if (result) {
          token = result;
        }
      } catch {
        // loader failed; leave token undefined
      }
    } else {
      // Load from token file: TIGEROPEN_TOKEN_FILE env var > default file
      const tokenFilePath = process.env[ENV_TOKEN_FILE] || 'tiger_openapi_token.properties';
      const tm = new TokenManager({ filePath: tokenFilePath });
      try {
        token = tm.loadTokenSync();
      } catch {
        // file not found or no token field; leave token undefined
      }
    }
  }

  // Validate required fields
  if (!tigerId) {
    throw new Error(
      `tigerId is required. Set it via options.tigerId, a config file, or the ${ENV_TIGER_ID} environment variable.`
    );
  }
  if (!privateKey) {
    throw new Error(
      `privateKey is required. Set it via options.privateKey, a config file, or the ${ENV_PRIVATE_KEY} environment variable.`
    );
  }

  // Resolve server URL: explicit > dynamic domain > default
  const enableDynamicDomain = opts.enableDynamicDomain ?? true;
  let serverUrl: string;
  let quoteServerUrl: string;

  // Query dynamic domains once (may spawn a child process); reuse for both URLs.
  let domainConf: Record<string, unknown> = {};
  if (enableDynamicDomain && (!opts.serverUrl || !opts.quoteServerUrl)) {
    domainConf = queryDomains(license);
  }

  if (opts.serverUrl) {
    serverUrl = opts.serverUrl;
  } else {
    const dynamicUrl = resolveDynamicServerUrl(domainConf, license);
    serverUrl = dynamicUrl || DEFAULT_SERVER_URL;
  }

  // Resolve quote server URL: explicit > dynamic domain > serverUrl fallback
  if (opts.quoteServerUrl) {
    quoteServerUrl = opts.quoteServerUrl;
  } else {
    const dynamicQuoteUrl = resolveDynamicQuoteServerUrl(domainConf, license);
    quoteServerUrl = dynamicQuoteUrl || serverUrl;
  }

  return {
    tigerId,
    privateKey,
    account,
    secretKey: secretKey || undefined,
    license,
    language,
    timezone,
    timeout: opts.timeout ?? DEFAULT_TIMEOUT,
    token,
    tokenRefreshDuration: opts.tokenRefreshDuration,
    tokenCheckInterval: opts.tokenCheckInterval,
    tokenLoader: opts.tokenLoader,
    tokenWriter: opts.tokenWriter,
    serverUrl,
    quoteServerUrl,
    deviceId: detectDeviceId(),
    tigerPublicKey: opts.tigerPublicKey ?? TIGER_PUBLIC_KEY,
  };
}

/**
 * Resolve private key from properties.
 * Priority: private_key > private_key_pk8 > private_key_pk1
 */
function resolvePrivateKey(props: Record<string, string>): string {
  return props['private_key'] || props['private_key_pk8'] || props['private_key_pk1'] || '';
}
