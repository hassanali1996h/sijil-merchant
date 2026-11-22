# Merchant release preflight — 2026-11-23

Added `scripts/check-merchant-release-gates.cjs` in commit `2aafeb85`.

Run from repository root:

```sh
node scripts/check-merchant-release-gates.cjs
```

The gate runs the merchant Android package check, its five regression tests, and live HTTPS smoke checks of the four public policy pages. It fails closed if a check is missing, exits nonzero, crashes, or times out. It **does not** build or upload an AAB, change Google Play, or certify policy compliance.

**Known expected blocker:** `apps/merchant/app.json` currently declares `com.debtledgeriq.sijil.merchant`, while the documented Play package is `com.debtledgeriq.sijil`. Do not automatically change the package: verify the existing Play listing in Chrome Profile 1 under `hassanali941996@gmail.com` first. The equivalent customer mismatch also remains open.

**Execution status:** GitHub file creation confirmed. Full execution of the new gate, OTP on Iraqi networks, Supabase pgTAP/RLS, customer approval/dispute, EAS AAB and Play testing have **not** been verified by this commit. All remain release blockers.

**Safety:** no production deployment, payments, SMS, or customer notifications were triggered. Do not treat an HTTP 200 as proof of an effective account deletion process or legally complete privacy policy.
