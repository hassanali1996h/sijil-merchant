# Google Play package reconciliation — 2026-11-22

## Evidence and status

The account owner's Google Play Console screenshot dated 2026-11-22 shows **draft** entries with these package identifiers:

- Merchant / سِجل: `com.debtledgeriq.sijil.merchant`
- Customer / سِجلي: `com.debtledgeriq.sijili.customer`

These are different from the original identifiers in AGENTS.md and store submission documents (`com.debtledgeriq.sijil` and `com.debtledgeriq.sijili`). **Do not build or upload an AAB using the old identifiers without reconciling the actual Expo configuration, EAS credentials, Google Play entries and store integrations.** Existing Play package identifiers cannot simply be renamed.

The owner separately showed the RevenueCat merchant Android app field containing `com.debtledgeriq.sijil.merchant` and confirmed saving it. This is evidence of configuration entry, **not** proof of working Google API credentials or purchase validation.

## Safe release gate

1. Inspect Android package in the Expo config and resolved EAS build configuration for both apps. Preserve the existing Play Console identifiers if those are the intended listings; check for any existing installs, signing keys and version codes before changing code.
2. Merchant only: check RevenueCat package ID, Play Console service-account access scoped to the merchant app, and successful credential validation. Never commit the service-account JSON.
3. Build test AABs only after IDs match. Verify package ID, signing, target SDK, versionCode and merged permissions from each actual artifact. Internal testing only until OTP, ledger/RLS, account deletion, and privacy checks pass.
4. Correct the old package IDs in AGENTS.md, KNOWN_GAPS.md, GOOGLE_PLAY_SUBMISSION_2026.md and any other documents **only after** reconciling source/build settings. Until then, the old documentation is stale and must not be copied into Play Console.
5. Reconcile the current RevenueCat subscription product identifiers and merchant-only billing; do not configure billing in the customer app.

## Not verified in this note

No authenticated Play Console read, EAS build, Supabase test, SMS delivery, service-account credential upload, or purchase test was performed as part of this documentation update. Do not claim a successful release or policy declaration based on this note.
