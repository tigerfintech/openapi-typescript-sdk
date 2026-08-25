/**
 * Shared test support utilities.
 *
 * Provides offline configuration builders for unit tests.
 * No real credentials or network access required.
 */
import type { ClientConfig } from '../src/config/client-config';

/** Build a minimal ClientConfig for unit tests (no real credentials). */
export function makeTestConfig(overrides?: Partial<ClientConfig>): ClientConfig {
  return {
    tigerId: 'test_tiger_id',
    privateKey: 'test_private_key',
    account: 'test_account',
    language: 'zh_CN',
    timeout: 15,
    serverUrl: 'https://openapi.tigerfintech.com/gateway',
    quoteServerUrl: 'https://openapi.tigerfintech.com/gateway',
    deviceId: '00:00:00:00:00:00',
    tigerPublicKey: 'test_public_key',
    ...overrides,
  };
}
