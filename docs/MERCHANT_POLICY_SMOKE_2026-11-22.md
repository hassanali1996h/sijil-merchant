# Merchant public policy page check - 2026-11-22

Added scripts/check-public-policy-pages.cjs to smoke-test four public GitHub Pages URLs.

Run: node scripts/check-public-policy-pages.cjs

Observed: privacy.html, delete-account.html, terms.html, support.html all HTTP 200 with HTML content. This is a connectivity/content smoke test only; it does not certify accuracy of legal text, account-deletion backend, or Google Play compliance.

Open gates: Iraqi OTP delivery, live Supabase/RLS tests, RevenueCat credentials, AAB validation and Console declarations. No Play Console edits or public releases performed.
