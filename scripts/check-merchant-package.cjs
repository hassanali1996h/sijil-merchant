#!/usr/bin/env node
// Fail closed: the expected Play listing package must be confirmed before release.
const fs = require('node:fs');
const path = require('node:path');
const configPath = process.env.SIJIL_APP_CONFIG || path.resolve(__dirname, '../apps/merchant/app.json');
const expected = 'com.debtledgeriq.sijil';
try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const actual = config?.expo?.android?.package;
  if (actual !== expected) {
    console.error(`BLOCKED: merchant Android package is ${JSON.stringify(actual)}; expected ${expected}. Confirm the existing Play Console listing before changing it.`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: merchant Android package matches ${expected}`);
  }
} catch (error) {
  console.error(`BLOCKED: unable to validate merchant app config: ${error.message}`);
  process.exitCode = 1;
}
