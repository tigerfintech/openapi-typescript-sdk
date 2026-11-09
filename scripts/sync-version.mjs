/**
 * Pre-build: keep src/version.ts in sync with package.json.
 *
 * SDK_VERSION feeds the HTTP User-Agent and the push handshake sdkVersion, so a
 * stale value silently misreports the client version to the server. It drifted
 * from 0.4.8 to 0.5.4 because every release bumped package.json only.
 *
 * Runs as part of `npm run build`. Writes only when the value actually changed,
 * and exits non-zero if package.json has no usable version.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const VERSION_FILE = join(ROOT, 'src', 'version.ts');

const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
if (!version) {
  console.error('sync-version: package.json has no "version" field');
  process.exit(1);
}

const contents = `export const SDK_VERSION = '${version}';\n`;
const current = readFileSync(VERSION_FILE, 'utf8');

if (current === contents) {
  console.log(`sync-version: src/version.ts already at ${version}`);
} else {
  writeFileSync(VERSION_FILE, contents);
  const was = current.match(/'([^']+)'/)?.[1] ?? 'unknown';
  console.log(`sync-version: src/version.ts ${was} -> ${version}`);
}
