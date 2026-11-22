# Android store-build preflight — 2026-11-22

The merchant's EAS production profile requests a signed Android App Bundle for Play Store testing, but the production EAS environment currently lists **no variables**. A connected, purchase-capable AAB is **not ready**. Do not submit a blank-config build to Play testing as though OTP or purchases work.

## Verified
- Existing EAS owner `hassanali22`, slug `debt-ledger-merchant`, project ID `7e4caf46-a57d-49f8-b799-15795682d309`.
- Android application ID `com.debtledgeriq.sijil.merchant` in current Expo configuration. **Verify against the actual Play Console entry**, as older documents use `com.debtledgeriq.sijil`.
- `production` build profile: `distribution=store`, `android.buildType=app-bundle`.
- EAS build list shows one completed preview APK and one errored connected-preview build; no completed AAB observed.
- EAS production `env:list` returned no variables. `node scripts/check-production-eas-env.cjs` fails closed with three missing names.
- The new fixture test `node scripts/test-production-eas-env.cjs` passes.

## Next gate
1. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the **intended deployment** (not automatically the staging database). Set `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` to the RevenueCat **public Android** key. Do not put Supabase service-role or RevenueCat secret keys in EAS public variables.
2. Confirm that Play Console application ID matches the current Android package, and the backend and store are configured for that package.
3. Rerun `node scripts/check-production-eas-env.cjs`, then `node scripts/verify-eas-config.cjs` and typecheck. Confirm actual values/permissions separately; the preflight checks variable names only.
4. Only then start `eas build --platform android --profile production --non-interactive --no-wait`. If the signing credentials or Play package mismatch, stop and document the exact prompt/error. Upload only to Internal testing; never release to Production.
5. Test Iraqi OTP, approval/dispute, purchase/restore/expiry and server entitlement with licensed test accounts before claiming payment readiness.

This file is a build gate, not a claim that a build or Play Console submission succeeded.
