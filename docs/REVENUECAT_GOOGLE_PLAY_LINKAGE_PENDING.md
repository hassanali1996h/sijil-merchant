# Google Play ↔ RevenueCat: pending live-console verification

Status: **NOT CONNECTED/VALIDATED BY THIS AUDIT**. This document contains no secrets and is not a declaration that products exist.

## Verified identities (from owner-provided Play Console screenshots and earlier setup)
- Play Console account: `hassanali941996@gmail.com` (Chrome Profile 1), NOT `hugnvf@gmail.com`.
- Merchant Android package: `com.debtledgeriq.sijil.merchant`; customer: `com.debtledgeriq.sijili.customer` (no paid subscription in customer app).
- Google Cloud project: `sijil-revenuecat`.
- Service account: `sijil-revenuecat@sijil-revenuecat.iam.gserviceaccount.com`.
- RevenueCat project: Sijil; Google Play app ID `app7e2eaad318`; entitlement `merchant_pro`.
- RevenueCat package identifiers previously created: `merchant_monthly`, `merchant_6_months`, `merchant_annual`. These are not proof of Google Play product IDs.
- Intended Iraqi prices: 2,500 IQD/month; 12,500 IQD/6 months; 20,000 IQD/year. **Storefront prices must be verified in Play Console**.

## Google Play credentials (must inspect live dashboard)
1. Verify Google Play Android Developer API and Google Play Developer Reporting API are enabled in the same Cloud project.
2. In **correct Play Console account** > Users and permissions, confirm service account invitation is ACTIVE and has access to merchant app. Earlier attempt had an email-format error; invitation success is unverified.
3. Confirm permissions recommended by RevenueCat: View app information/bulk reports, View financial data/orders, Manage orders/subscriptions, Manage store presence (scope minimally to merchant where supported).
4. In RevenueCat > Apps > Sijil (Play Store) verify package and **Service Account Credentials JSON** upload; click credential status > Check credentials. Never commit/upload JSON to GitHub or share it in chat.
5. Record each validation check and timestamp. New credentials may take up to 36 hours to validate. No automatic claims of success.

## Create Google Play products, only after console is accessible
- Navigate Play Console > Sijil merchant > Monetize with Play > Products > Subscriptions.
- If subscription creation is disabled, upload a signed AAB to an appropriate test track first; do not publish publicly.
- Define three distinct billing periods (P1M, P6M, P1Y), with verified local prices. Confirm whether these should be separate subscriptions or one subscription with multiple base plans before creating duplicates.
- Free first month without a card is currently an **app-managed trial**, not a Play Billing free-trial offer. Do not add a Play offer that silently changes this behavior.
- Import actual Google Play product/base-plan IDs into RevenueCat, attach all to `merchant_pro`, and put corresponding packages in the current offering. Do not infer IDs from package labels.
- Check that the app's RevenueCat public Android key is configured for EAS production, and server secret remains in Supabase secrets (never public Expo env).
- Test with Play license testers on an installed Play Store build: purchase, restore, cancel, expiry, failed purchase, server webhook synchronization and read-only fallback. No live charges.

## Current blocker
The connected Browser tool in Chat mode can **read tabs only**, and its visible tabs do not include authenticated Play Console or RevenueCat. Remote Desktop Commander has terminal/file access but no browser UI controls. Therefore no Play Console invitation, JSON upload, subscription creation or RevenueCat import was performed in this audit.

References:
- https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials
- https://www.revenuecat.com/docs/getting-started/entitlements/android-products
