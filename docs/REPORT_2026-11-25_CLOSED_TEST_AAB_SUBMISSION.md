# Closed-test AAB submission and emulator screenshots — 2026-11-25

## Merchant: actionable result
- Source repository: `hassanali1996h/sijil-merchant`.
- Windows workstation `36hassan`: synchronized 12 upstream commits and rebased the prior local demo-crash fix; force push was **not** used. Merge commit after rebase: `36396bb`.
- Created EAS profile `closed-test-staging` (`dcc43b5`) with `distribution: store`, `android.buildType: app-bundle`, `environment: preview`, `EXPO_PUBLIC_DEBT_LEDGER_PREVIEW=0`, `autoIncrement: true`, local signing.
- Existing EAS `preview` environment has `EXPO_PUBLIC_SUPABASE_URL` pointing at the **staging** project `dnbcgrcfwusswfvcdlzs`, plus a publishable key. This is connected app mode, **not** the local mocked demo; it is **not** production backend.
- Production EAS environment still has **no variables**. RevenueCat `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` was not present in the preview environment either, and is not part of the test bundle configuration; purchases cannot be certified.
- Signed merchant AAB submitted to EAS as Android `versionCode 3`, build ID `926db58a-db44-473c-a221-20c8351f9f6c`, URL https://expo.dev/accounts/hassanali22/projects/debt-ledger-merchant/builds/926db58a-db44-473c-a221-20c8351f9f6c. **Last observed status: IN_PROGRESS; no artifact URL or Google Play upload confirmed.**
- Committed `app.json` versionCode 3 as `c8ae03e` after EAS increment, to prevent accidental reuse.

## Real Android emulator screenshots: drafts, not final store assets
- AVD: `Medium_Phone_API_36.0`; Expo preview APK `745e941e-e5e8-436b-9fa9-4a8b0baceec1` installed and opened.
- Screenshots made by Android `screencap`, not image generation, saved **outside Git** in:
  `C:\Users\LENOVO\Projects\Sijil-Release-Audit\PlayScreenshotsDraft`
- Captured: welcome, phone login, dashboard, customers section, and customer-detail failure screenshot.
- Dashboard/customer images clearly show **demo sample data** including labels like 'متجر التجربة' and 'عميل تجريبي'. Review and replace with screenshots from the actual connected app/test accounts before final Play listing; do not pass mock/demo images off as live account screenshots.
- Live emulator check exposed a **preview-only navigation defect**: `app/customer/[linkId].tsx` attempts Supabase calls even when `isPreviewMode=true`, leading to `example.supabase.co` fetch failure. Screenshots of this error are **not for store upload**. Either implement a proper local preview fixture in customer-detail or capture connected test-account screens.
- No Play Console screen assets were uploaded in this session.

## Customer: verified release gates
- Source `hassanali1996h/sijili-customer` local checkout fast-forwarded to `7ea26b0` safely; untracked local `package-lock.json` preserved.
- `npm run typecheck`: pass.
- `node scripts/check-release-gates.cjs`: package gate blocked (as designed); six package gate regression tests pass; public privacy, deletion, terms, support pages all HTTP 200.
- Package ID conflict must be resolved against the actual customer Play Console entry **before** customer AAB: spec `com.debtledgeriq.sijili`, code `com.debtledgeriq.sijili.customer`. Do not rename blindly.
- No customer AAB started or Play Console upload claimed.

## Next tasks in priority order
1. Check Expo build status and, when `FINISHED`, capture the exact signed AAB URL and SHA/metadata. If errored, inspect build logs.
2. Confirm the **merchant** Google Play entry matches `com.debtledgeriq.sijil.merchant` and submit the staging-connected AAB only to a restricted test track with clear acknowledgement that SMS/RevenueCat functionality is not verified; do not claim production readiness.
3. Obtain the Android **public** RevenueCat SDK key through authorized dashboard access (never put secret keys in Expo), configure a proper production backend intentionally rather than assuming staging is production, test SMS OTP and end-to-end approval/dispute and purchases before wider release.
4. Create compliant screenshots from genuine connected-app flows and enter accurate store listing/Data Safety; browser interaction may require ChatGPT Work mode or user account access.
5. Resolve customer Play package mismatch by inspecting the actual listing, then build and prepare customer restricted-track submission using the existing authorized tester list.
6. Review remaining Supabase security warnings and migration-history drift without making blind destructive changes.
