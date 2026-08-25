/**
 * Integration test setup.
 *
 * Provides shared helpers for integration tests that hit the real OpenAPI
 * gateway. Unit tests (default `npm test`) do NOT depend on this module;
 * integration tests opt in by living under tests/integ/ and being run with
 * `npm run test:integ`.
 *
 * Credentials: TIGEROPEN_TIGER_ID / TIGEROPEN_PRIVATE_KEY / TIGEROPEN_ACCOUNT
 * env vars, or TIGEROPEN_PROPS_PATH pointing at a properties file.
 *
 * Gate: TIGER_RUN_INTEG=true must be set, and credentials must be present.
 * Env var names are aligned with Java, Python, and Go SDKs so the same CI
 * variables work across all four.
 */
import { createClientConfig } from '../../src/config/client-config';
import { QuoteClient } from '../../src/quote/quote-client';
import { TradeClient } from '../../src/trade/trade-client';

const ENV_TIGER_ID = 'TIGEROPEN_TIGER_ID';
const ENV_PRIVATE_KEY = 'TIGEROPEN_PRIVATE_KEY';
const ENV_PROPS_PATH = 'TIGEROPEN_PROPS_PATH';
const ENV_SERVER_URL = 'TIGEROPEN_SERVER_URL';
const ENV_RUN_INTEG = 'TIGER_RUN_INTEG';

const DEFAULT_SERVER_URL = 'https://openapi.tigerfintech.com/gateway';

/** Whether TIGER_RUN_INTEG=true is set. */
export function isEnabled(): boolean {
  return process.env[ENV_RUN_INTEG] === 'true';
}

/** Whether credentials are available (env vars or props file path). */
export function hasCreds(): boolean {
  if (process.env[ENV_TIGER_ID] && process.env[ENV_PRIVATE_KEY]) return true;
  return !!process.env[ENV_PROPS_PATH];
}

/**
 * Whether integration tests should run.
 * Use as the condition in `describe.skipIf(!shouldRun())(...)` to guard suites.
 */
export function shouldRun(): boolean {
  return isEnabled() && hasCreds();
}

/**
 * Build a ClientConfig from env vars or a properties file.
 *
 * Dynamic domain resolution is disabled to avoid spawning child processes in
 * CI. The server URL comes from TIGEROPEN_SERVER_URL or defaults to the
 * production gateway.
 *
 * Throws when credentials are absent — call shouldRun() to guard the suite
 * before calling this function.
 */
export function buildConfig() {
  const serverUrl = process.env[ENV_SERVER_URL] ?? DEFAULT_SERVER_URL;
  const propsPath = process.env[ENV_PROPS_PATH];

  return createClientConfig({
    ...(propsPath ? { propertiesFilePath: propsPath } : {}),
    serverUrl,
    quoteServerUrl: serverUrl,
    enableDynamicDomain: false,
  });
}

/** Build a QuoteClient wired to the real gateway. */
export function buildQuoteClient(): QuoteClient {
  return QuoteClient.fromConfig(buildConfig());
}

/** Build a TradeClient wired to the real gateway. */
export function buildTradeClient(): TradeClient {
  const cfg = buildConfig();
  return TradeClient.fromConfig(cfg, cfg.account);
}
