/**
 * 动态域名获取模块
 *
 * 从域名花园获取动态域名配置，用于 SDK 初始化时自动选择最优服务器地址。
 */

/** 域名花园地址 */
const DOMAIN_GARDEN_ADDRESS = 'https://cg.play-analytics.com';
/** 动态域名查询超时（毫秒） */
const DOMAIN_QUERY_TIMEOUT = 1000;
/** TBUS 牌照标识 */
const LICENSE_TBUS = 'TBUS';
/** COMMON 域名 key */
const DOMAIN_KEY_COMMON = 'COMMON';
/** gateway 后缀 */
const GATEWAY_SUFFIX = '/gateway';

/**
 * 从域名花园获取动态域名配置。
 * 失败时返回空对象（静默回退）。
 *
 * @param license - 牌照类型（如 "TBNZ"）
 * @returns 域名配置 map（key → URL）
 */
export function queryDomains(license?: string): Record<string, unknown> {
  try {
    let url = DOMAIN_GARDEN_ADDRESS;
    if (license === LICENSE_TBUS) {
      url += '?appName=tradeup';
    }

    // 使用同步 XMLHttpRequest（SDK 初始化时调用，非每次请求）
    // Node.js 环境下使用 child_process 同步 HTTP 请求
    const result = syncHttpGet(url, DOMAIN_QUERY_TIMEOUT);
    if (!result) return {};

    const parsed = JSON.parse(result);
    const items = parsed?.items;
    if (!Array.isArray(items) || items.length === 0) return {};

    const conf = items[0]?.openapi;
    if (!conf || typeof conf !== 'object') return {};

    return conf as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * 根据动态域名配置和 license 解析服务器地址。
 * 返回空字符串表示无法解析（应使用默认地址）。
 */
export function resolveDynamicServerUrl(
  domainConf: Record<string, unknown>,
  license?: string
): string {
  if (!domainConf || Object.keys(domainConf).length === 0) {
    return '';
  }

  const key = license || DOMAIN_KEY_COMMON;

  if (typeof domainConf[key] === 'string') {
    return (domainConf[key] as string) + GATEWAY_SUFFIX;
  }

  // 回退到 COMMON
  if (typeof domainConf[DOMAIN_KEY_COMMON] === 'string') {
    return (domainConf[DOMAIN_KEY_COMMON] as string) + GATEWAY_SUFFIX;
  }

  return '';
}

/**
 * Resolve the quote server URL from dynamic domain configuration.
 * Uses the `{LICENSE}-QUOTE` key, falling back to empty string.
 *
 * @param domainConf - Domain configuration map from queryDomains
 * @param license - License type (e.g. "TBNZ")
 * @returns Quote server URL with gateway suffix, or empty string
 */
export function resolveDynamicQuoteServerUrl(
  domainConf: Record<string, unknown>,
  license?: string
): string {
  if (!domainConf || Object.keys(domainConf).length === 0) {
    return '';
  }

  const key = license ? `${license}-QUOTE` : `${DOMAIN_KEY_COMMON}-QUOTE`;

  if (typeof domainConf[key] === 'string') {
    return (domainConf[key] as string) + GATEWAY_SUFFIX;
  }

  return '';
}

/**
 * Synchronous HTTP GET request (Node.js environment).
 * Uses child_process.execSync for synchronous requests with fast timeout.
 */
function syncHttpGet(url: string, timeoutMs: number): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { execSync } = require('child_process');
    const script = `
      const http = require('${url.startsWith('https') ? 'https' : 'http'}');
      const req = http.get('${url}', { timeout: ${timeoutMs} }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => process.stdout.write(data));
      });
      req.on('error', () => process.exit(1));
      req.on('timeout', () => { req.destroy(); process.exit(1); });
    `;
    const result = execSync(`node -e "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      timeout: timeoutMs + 500, // 额外 500ms 给进程启动
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result || null;
  } catch {
    return null;
  }
}
