#!/usr/bin/env node
/**
 * Canary for the internal `expo/fetch` implementation details this library
 * depends on. `expo/fetch` is not a stable public contract for these details,
 * so an Expo upgrade can silently break our assumptions. Each entry in
 * ASSUMPTIONS pins one such detail to a source location + expected pattern;
 * this fails CI when any drifts, so it's caught at upgrade time — not in
 * production.
 *
 * To add a new dependency on Expo internals, add an entry below. Keep each check
 * targeted at a single file (no tree walking) and note where we rely on it.
 *
 * Note: native Android/iOS message text is intentionally out of scope — those
 * are platform strings, not an Expo API surface.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {{ name: string, file: string, expect: string | RegExp, reliedOnBy: string }[]} */
const ASSUMPTIONS = [
  {
    name: 'transport failures carry the `fetch failed: ` message prefix',
    file: 'src/winter/fetch/FetchErrors.ts',
    expect: 'fetch failed: ',
    reliedOnBy: 'SSETransportError.from() — FETCH_FAILED_PREFIX in src/errors.ts',
  },
];

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

let expoDir;
try {
  expoDir = dirname(require.resolve('expo/package.json', { paths: [libDir] }));
} catch {
  console.error('✖ Could not resolve `expo` from packages/expo-sse. Is it installed?');
  process.exit(1);
}

const version = require(join(expoDir, 'package.json')).version;
console.log(`Checking expo@${version} internals this library depends on:\n`);

let failed = 0;
for (const { name, file, expect, reliedOnBy } of ASSUMPTIONS) {
  let contents;
  try {
    contents = readFileSync(join(expoDir, file), 'utf8');
  } catch {
    failed++;
    console.error(`✖ ${name}\n  ${file} not found — expo/fetch was restructured.`);
    console.error(`  Relied on by: ${reliedOnBy}\n`);
    continue;
  }

  const ok =
    expect instanceof RegExp ? expect.test(contents) : contents.includes(expect);
  if (ok) {
    console.log(`✓ ${name}  (${file})`);
  } else {
    failed++;
    console.error(`✖ ${name}\n  Expected ${expect} in ${file}, not found.`);
    console.error(`  Relied on by: ${reliedOnBy}\n`);
  }
}

if (failed > 0) {
  console.error(
    `\n${failed} expo/fetch assumption(s) drifted. Re-verify against the installed expo source and update the dependent code + this canary.`
  );
  process.exit(1);
}

console.log('\nAll expo/fetch assumptions hold.');
