/**
 * SDK_VERSION must match package.json.
 *
 * SDK_VERSION feeds the HTTP User-Agent and the push handshake sdkVersion, so a
 * stale value silently misreports the client version to the server. It had
 * drifted from 0.4.8 to 0.5.4 because releases bumped package.json only; the
 * build now runs scripts/sync-version.mjs, and this test fails the suite if the
 * two ever diverge again.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SDK_VERSION } from '../src/version';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('SDK_VERSION', () => {
  it('matches the version in package.json', () => {
    const { version } = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
    );
    expect(SDK_VERSION).toBe(version);
  });

  it('is a plain semver string with no leading v', () => {
    expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
  });
});
