/**
 * Post-build: add .js extensions to all relative imports/exports in ESM output.
 *
 * Node.js ESM requires explicit file extensions. TypeScript's moduleResolution=node
 * doesn't emit them, so we patch the compiled output.
 *
 * Handles two cases:
 *   from './foo'        → from './foo.js'    (file exists)
 *   from './foo'        → from './foo/index.js'  (directory)
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ESM_DIR = join(__dirname, '..', 'dist', 'esm');

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walk(full));
    } else if (full.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

const IMPORT_RE = /((?:import|export)[^'"]*from\s+['"])(\.\.?\/[^'"]+)(['"]\s*;?)/g;

let patched = 0;
for (const file of walk(ESM_DIR)) {
  const original = readFileSync(file, 'utf8');
  const fileDir = dirname(file);

  const fixed = original.replace(IMPORT_RE, (_, prefix, specifier, suffix) => {
    if (specifier.endsWith('.js')) return prefix + specifier + suffix;

    const absPath = join(fileDir, specifier);
    if (existsSync(absPath) && statSync(absPath).isDirectory()) {
      return prefix + specifier + '/index.js' + suffix;
    }
    if (existsSync(absPath + '.js')) {
      return prefix + specifier + '.js' + suffix;
    }
    // leave unchanged if we can't resolve (e.g. node builtins leaking through)
    return prefix + specifier + suffix;
  });

  if (fixed !== original) {
    writeFileSync(file, fixed, 'utf8');
    patched++;
  }
}

console.log(`fix-esm-imports: patched ${patched} file(s) in dist/esm`);
