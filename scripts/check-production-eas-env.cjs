'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const required = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY'
];
function missingFromEasListing(output) {
  if (/No variables found for this environment/i.test(output)) return [...required];
  return required.filter((key) => !new RegExp('(?:^|\\n)\\s*' + key + '\\b', 'm').test(output));
}
if (require.main === module) {
  try {
    const eas = process.platform === 'win32' ? 'cmd.exe' : 'eas';
    const output = execFileSync(eas, process.platform === 'win32' ? ['/d', '/s', '/c', 'eas env:list --environment production --non-interactive'] : ['env:list', '--environment', 'production', '--non-interactive'], {
      cwd: path.join(__dirname, '..', 'apps', 'merchant'),
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000
    });
    const missing = missingFromEasListing(output);
    if (missing.length) {
      console.error('BLOCKED: EAS production is missing required public configuration variable names: ' + missing.join(', '));
      process.exitCode = 1;
    } else {
      console.log('PASS: required EAS production variable names exist. Values and runtime connectivity still need verification.');
    }
  } catch (error) {
    console.error('BLOCKED: could not inspect EAS production variable names. Check EAS login and project access.');
    process.exitCode = 1;
  }
}
module.exports = { missingFromEasListing, required };
