# Unified Sijil release migration (2026-11-26)

## Approved product decision
Ship **one** mobile app, **Sijil** (سِجل), updating the **existing** Google Play entry. Existing Android package remains \`com.debtledgeriq.sijil.merchant\`, Expo owner \`hassanali22\`, existing EAS project and local upload keystore remain unchanged. The former Sijili customer code is a source of features, **not** a second app release.

### Roles and pricing
- One phone-OTP identity can have both customer and shop-owner roles, with an in-app role selector/switch.
- Customer remains free permanently: invitations, shop balances and statements, customer approval/dispute of debt and payment requests, notifications, account settings and deletion. No purchase screen or paid check for the customer view.
- Shop owner gets 30 server-side non-billing trial days from first activation, then subscription via Google Play/RevenueCat (\`merchant_pro\`) to **write** new debts/payments or edit credit limits. Old records remain readable at expiry.
- Requested commercial targets, subject to localized storefront support: IQD 2,500 monthly, IQD 12,500 six-monthly, IQD 20,000 yearly. Do **not** claim that these Play subscriptions are configured or purchasable until testing.

### Architecture
- Existing \`apps/merchant\` is the sole application and release target. Customer screens are ported into \`apps/merchant/app/client\`, with common route \`/roles\`.
- \`/home\` retains merchant view; \`/client/home\` and \`/client/shop/[linkId]\` are customer views; \`/invite?linkId=...\` reuses the existing OTP flow.
- Invitation links now use \`debtledger-merchant://invite\`; retain the old \`debtledger-customer\` native scheme to support already shared invitations. Verify handling through \`adb am start -a android.intent.action.VIEW -d ...\` on a signed test build.
- Both modes use the same Supabase Auth and shared backend. Client queries filter by \`customer_user_id = auth.uid()\` and transaction customer_link IDs to avoid mixing the merchant’s own ledger into their customer view; RLS remains the authoritative server boundary.
- Merchant device registration stays merchant-only; switching to customer mode must not trigger that binding.
- One account deletion request deletes/sanitizes a whole user identity; the legal policy must describe both roles, financial record retention and counterpart rights. Do not automatically delete shared ledger without a compliant policy.
- No data migration between apps is necessary on the **same** Supabase project; confirm the production project and account sources before deployment. The connected EAS preview environment currently points at staging.

### Verification gates before sending update for Play review
1. \`npm run typecheck\` and \`node scripts/test-unified-app.cjs\` and Expo bundle export pass.
2. Signed AAB built with same package, signing key, versionCode **higher** than currently on the relevant Play track.
3. Two different authenticated phone test identities, one merchant and one customer: merchant creates invite/debt; customer accepts link, approves/disputes, sees only own ledger; merchant sees status change. Test a **single** identity with both roles.
4. Expired merchant cannot write; customer can approve/dispute **without** purchasing even if same account also owns a shop.
5. Verify merchant Google Play subscriptions and RevenueCat public SDK key/server entitlement; no secret in app.
6. Test new and previously shared invitation links, push notifications, account deletion, account switching and Arabic/Sorani RTL.
7. Replace store screenshots using real screens of **this** unified signed app and accurately describe BOTH roles; update privacy/support/terms and Data Safety after verification.
8. Resolve prior rejection for \`Play Console Requirements\` / alleged financial-service category; a book-keeping app is not necessarily banking/credit provision, but do not misdeclare a financial feature to bypass review. Verify the current policy status and appeal if necessary.
9. Release only to existing **closed test** track with its current opted-in tester list, not public production. Confirm Play Console actually accepted the upload.

### Open risks
- EAS production environment previously had missing keys; do not use placeholder values. Staging EAS only has Supabase URL and publishable key, **not** verified RevenueCat Android public SDK key.
- Actual Iraqi SMS OTP delivery, RLS role-isolation tests, purchases, server webhooks and Data Safety have not been independently certified.
- Old separate customer app is not automatically uninstalled or updated; any early users of it would need clear migration instructions to install Sijil.
- Kurdish Badini was requested earlier, but current app locales are Arabic and Sorani only; no completed Badini translation may be claimed.
- This document and source changes do not constitute a Play Console upload or accepted policy appeal.

