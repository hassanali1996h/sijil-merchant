'use strict';
const assert = require('node:assert/strict');
const { missingFromEasListing, required } = require('./check-production-eas-env.cjs');
assert.deepEqual(missingFromEasListing('Environment: production\nNo variables found for this environment.'), required);
assert.deepEqual(missingFromEasListing('Environment: production\nEXPO_PUBLIC_SUPABASE_URL\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY\nEXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY'), []);
assert.deepEqual(missingFromEasListing('Environment: production\nEXPO_PUBLIC_SUPABASE_URL\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), ['EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY']);
console.log('PASS EAS production preflight fixtures');
