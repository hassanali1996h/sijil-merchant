#!/usr/bin/env node
// Merchant release gate. This is a preflight only, not evidence of Play approval.
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const checks = [
  ['Android package', 'check-merchant-package.cjs'],
  ['Android package regression tests', 'check-merchant-package.test.cjs'],
  ['Public policy pages', 'check-public-policy-pages.cjs'],
];
let failed = false;
for (const [label, filename] of checks) {
  const script = path.join(__dirname, filename);
  if (!fs.existsSync(script)) {
    console.error('BLOCKED: missing check: ' + label + ' (' + filename + ')');
    failed = true;
    continue;
  }
  console.log('\n=== ' + label + ' ===');
  const result = spawnSync(process.execPath, [script], {
    cwd: root, env: process.env, encoding: 'utf8', timeout: 65000,
    maxBuffer: 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) {
    console.error('BLOCKED: ' + label + ': ' + (result.error?.message || 'exit ' + result.status));
    failed = true;
  }
}
if (failed) {
  console.error('\nRELEASE BLOCKED. Do not build or upload until Play package identity and all checks are verified.');
  process.exitCode = 1;
} else {
  console.log('\nPreflight passed. Live email/Google provider setup, cross-account RLS, real-device authentication, RevenueCat, EAS production environment and Google Play policy approval remain separate required gates.');
}
