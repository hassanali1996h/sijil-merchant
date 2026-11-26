// Test the actual TypeScript auth module with mocked provider responses.
// This is a unit test, NOT proof that Google OAuth / SMTP is configured.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.resolve(__dirname, '../apps/merchant/src/lib/auth.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const calls = { sent: [], verified: [], oauth: [], exchanged: [], browser: [] };
let authSession = null;
let browserResult = { type: 'success', url: 'debtledger-merchant://auth/callback?code=testGoogleCode' };
const client = {
  auth: {
    signInWithOtp: async (args) => { calls.sent.push(args); return { error: null }; },
    verifyOtp: async (args) => {
      calls.verified.push(args);
      authSession = { user: { id: 'verified-user' } };
      return { data: { session: authSession }, error: null };
    },
    signInWithOAuth: async (args) => {
      calls.oauth.push(args);
      return { data: { url: 'https://example.test/oauth' }, error: null };
    },
    exchangeCodeForSession: async (code) => {
      calls.exchanged.push(code);
      authSession = { user: { id: 'verified-user' } };
      return { error: null };
    },
    setSession: async (args) => { authSession = args; return { error: null }; },
    getSession: async () => ({ data: { session: authSession }, error: null }),
    getUser: async () => ({ data: { user: authSession?.user ?? { id: 'verified-user' } }, error: null }),
  },
};
const external = {
  'expo-linking': { createURL: (route, { scheme }) => scheme + '://' + route },
  'expo-web-browser': {
    maybeCompleteAuthSession: () => {},
    openAuthSessionAsync: async (...args) => {
      calls.browser.push(args);
      return browserResult;
    },
  },
  './supabase': { supabase: client, isSupabaseConfigured: true },
};
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleRef, exports: moduleRef.exports,
  require: (name) => {
    assert.ok(Object.hasOwn(external, name), 'unexpected dependency ' + name);
    return external[name];
  },
  console, Map, Set, Error, RegExp, decodeURIComponent,
});
const auth = moduleRef.exports;
(async () => {
  assert.equal(auth.normalizeEmail('  Foo.Bar@EXAMPLE.com  '), 'foo.bar@example.com');
  for (const value of ['', ' ', 'missing-at-symbol', 'a@', '@example.com', 'a b@example.com']) {
    assert.equal(auth.normalizeEmail(value), null, value);
  }
  await auth.sendEmailCode('  USER@Example.com ');
  assert.equal(calls.sent.length, 1);
  assert.equal(calls.sent[0].email, 'user@example.com');
  assert.equal(calls.sent[0].options.emailRedirectTo, 'debtledger-merchant://auth/callback');
  await assert.rejects(() => auth.sendEmailCode('nonsense'));
  await auth.verifyEmailCode('user@example.com', '123456');
  assert.equal(calls.verified[0].type, 'email');
  assert.equal(calls.verified[0].token, '123456');
  await assert.rejects(() => auth.verifyEmailCode('user@example.com', '123'));
  await auth.completeAuthRedirect('debtledger-merchant://auth/callback?token_hash=abc123');
  assert.equal(calls.verified[1].token_hash, 'abc123');
  const googleSignedIn = await auth.signInWithGoogle();
  assert.equal(googleSignedIn, true);
  assert.equal(calls.oauth.length, 1);
  assert.equal(calls.oauth[0].provider, 'google');
  assert.equal(calls.oauth[0].options.skipBrowserRedirect, true);
  assert.equal(calls.browser[0][1], 'debtledger-merchant://auth/callback');
  assert.equal(calls.exchanged.length, 1);
  assert.equal(calls.exchanged[0], 'testGoogleCode');
  await auth.completeAuthRedirect('debtledger-merchant://auth/callback?code=testGoogleCode');
  assert.equal(calls.exchanged.length, 1, 'callback must be idempotent');
  browserResult = { type: 'cancel' };
  assert.equal(await auth.signInWithGoogle(), false);
  await assert.rejects(() => auth.completeAuthRedirect('debtledger-merchant://auth/callback?error=access_denied'));
  console.log('PASS email normalization, OTP, link callback, Google OAuth flow, cancel and duplicate callback (mock providers)');
})().catch((err) => { console.error(err); process.exitCode = 1; });
