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
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parsePropertiesString } from './config-parser';
import { queryDomains, resolveDynamicServerUrl } from './domain';

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

/** Client configuration interface */
export interface ClientConfig {
  tigerId: string;
  privateKey: string;
  account: string;
  license?: string;
  language: string;
  timezone?: string;
  timeout: number;
  token?: string;
  tokenRefreshDuration?: number;
  serverUrl: string;
  tigerPublicKey: string;
}

/** Options for creating a client configuration */
export interface ClientConfigOptions {
  tigerId?: string;
  privateKey?: string;
  account?: string;
  license?: string;
  language?: string;
  timezone?: string;
  timeout?: number;
  token?: string;
  tokenRefreshDuration?: number;
  serverUrl?: string;
  /** Enable dynamic domain resolution (default: true) */
  enableDynamicDomain?: boolean;
  /** Explicit properties file path (synchronous read) */
  propertiesFilePath?: string;
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
    fileProps = loadPropertiesFile(opts.propertiesFilePath);
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
  const license = opts.license || fileProps['license'];
  const language = opts.language || fileProps['language'] || DEFAULT_LANGUAGE;
  const timezone = opts.timezone || fileProps['timezone'];

  // Environment variables override everything
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
  if (opts.serverUrl) {
    serverUrl = opts.serverUrl;
  } else {
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
    timeout: opts.timeout ?? DEFAULT_TIMEOUT,
    token: opts.token,
    tokenRefreshDuration: opts.tokenRefreshDuration,
    serverUrl,
    tigerPublicKey: TIGER_PUBLIC_KEY,
  };
}

/**
 * Resolve private key from properties.
 * Priority: private_key > private_key_pk8 > private_key_pk1
 */
function resolvePrivateKey(props: Record<string, string>): string {
  return props['private_key'] || props['private_key_pk8'] || props['private_key_pk1'] || '';
}
