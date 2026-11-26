# Unified Sijil implementation and closed-test build — 2026-11-26

## Completed in source code (verified)
- Approved product change: ONE Google Play Android app (Sijil); customer forever free; shop owner trial and merchant subscription only.
- Existing Play package `com.debtledgeriq.sijil.merchant`, EAS owner, credentials and Supabase Auth backend kept.
- Copied the free customer's home, invitations, shop statements, approval/dispute logic and notification UI into `apps/merchant/app/client` and `app/invite.tsx`.
- Added `/roles` after phone OTP, customer/merchant role switching from both dashboards; shared account and no duplicate registration.
- Prevented client mode from reading the shop owner's customer rows: explicitly filter `customer_links.customer_user_id` to signed-in user and transactions to customer link IDs. Shop statement view also verifies ownership. Server RLS remains essential.
- Merchant subscription route checks actual `businesses.owner_user_id` before showing offers; customer route contains no purchase UI.
- Invitation links now use `debtledger-merchant://invite`, and old `debtledger-customer` scheme is declared as a compatibility alias; shared invite also directs to the Sijil Play listing.
- Updated Arabic and Sorani strings, privacy page, terms and deletion page for the unified experience; saved clear release checklist and updated AGENTS instructions.
- Old separate customer repository remains untouched and is NOT a second release.

## Tests (evidence)
- `npm run typecheck`: PASS.
- `node scripts/test-unified-app.cjs`: PASS 10 static regression checks; this does not equal an authenticated device E2E test.
- `node scripts/verify-eas-config.cjs`: PASS.
- Android Metro/Expo JS production export: PASS, 1326 modules bundled at `C:\Users\LENOVO\Projects\Sijil-Release-Audit\UnifiedSijilExport`, before final subscription-policy copy changes. Native EAS build will validate all current changes.
- Existing four public legal pages responded HTTP 200 before merged privacy edits; new copy has been committed to docs for GitHub Pages publication.

## Build submission
- Git commit: `c941856` (unified source merged and pushed to main).
- Android EAS profile: `closed-test-staging`, using real Supabase staging backend with `EXPO_PUBLIC_DEBT_LEDGER_PREVIEW=0` (NOT production database). Uses existing local keystore, same Play package, Expo SDK 58.
- AAB versionCode **4** uploaded to EAS build service:
  https://expo.dev/accounts/hassanali22/projects/debt-ledger-merchant/builds/4076aa94-27c6-45ef-953d-e66e44f96cc4
- Last verified build status: **IN_PROGRESS**. No new AAB artifact URL and no Play Console upload confirmed as of this report.
- EAS auto-increment also changed local app.json from versionCode 3 to 4; commit this version bump to avoid reuse.

## Non-negotiable remaining release gates
1. EAS AAB build must finish successfully, then verify package, signing key, versionCode.
2. Real phone OTP for Iraqi numbers; authenticated merchant and customer end-to-end transaction confirmation/dispute; one identity with both roles; merchant device binding must never restrict customer mode.
3. Confirm correct production Supabase deployment, RLS and API permissions, and complete RevenueCat public Android SDK key + server secret/webhooks and actual Play products. **The staging-connected AAB currently has no verified RevenueCat SDK public key; shop subscriptions are not ready.** No billing key secrets inside client app.
4. Correct the 2026-11-25 Google Play app rejection for Play Console Requirements/organization account versus app's true bookkeeping purpose; keep financial-data disclosures accurate and confirm current Play policy status.
5. Replace Play description with one-app customer and merchant roles; create actual screenshots from this unified application, not old mock-only preview, then revise Data Safety / account access / policies as applicable.
6. Upload new AAB to the **existing closed testing** release (testers retain their opt-in identities), never public production without verification. No Play upload has occurred in this operation.
7. Earlier requirement for Kurdish Badini remains unimplemented. The current localized UI supports Arabic and Sorani.

## Follow-up
Automation `6b02530adcf881919d82ef24640ab6fe` has been updated to monitor the **single-app plan**; do not resume the obsolete two-app publishing flow.

