# Sijil unified app — verified email and Google sign-in migration

Date: 26 November 2026. Product decision: only **Sijil**, Android package `com.debtledgeriq.sijil.merchant` (unchanged), Expo project `7e4caf46-a57d-49f8-b799-15795682d309`. **Do not submit a new Play release until external authentication works on a real device.**

## Product behavior implemented in source

- Customers use Sijil free; merchant tools alone require a server-backed 30-day free period or verified paid subscription.
- New account registration and login screen `app/sign-in.tsx`: Google via Supabase OAuth + system auth browser, and verified email via emailed code or link, without phone input or demo sign-in.
- PKCE session recovery via `app/auth/callback.tsx`, safe handling of duplicate callbacks, SecureStore-backed sessions. Legacy `/phone` invitation links redirect to `/sign-in` rather than showing phone OTP.
- Merchant adds customers by their email; `add_customer_email` checks merchant ownership and server-side subscription/trial. Customer cannot create store customers, and only verified email owners are bound to invitations.
- Customer and merchant still share a Supabase user ID and switch modes without expanding authorization.
- `isPreviewMode=false` in all builds; even EAS preview is now live/backend-connected, not a demo. No fake sign-in success.

## Database change (verified on STAGING, not proved in production)

Project: `dnbcgrcfwusswfvcdlzs`.

Applied `supabase/migrations/20261126225000_email_google_unified_auth.sql` using Supabase migration `email_google_unified_auth_20261126`. This:
- permits preexisting phone-only profiles and links to remain, adds unique normalized verified email identity to profiles, and adds customer email invitations;
- only matches pending shop invitations with a **confirmed** email/phone identity;
- uses a narrowly authorized `add_customer_email` RPC (anonymous/unauthenticated execute permission revoked);
- anonymizes linked email as well as phone during approved account deletion processing.

Post-change verification: `profiles.phone_e164` nullable; `profiles.email` and `customer_links.customer_email` present; exactly one auth trigger; `anon` cannot execute invite RPC while `authenticated` may. Security advisers still flag intentional authenticated SECURITY DEFINER RPCs that require ongoing audit; no claim that all advisories are resolved.

A transactional, fully rolled-back integration test succeeded: create an email-verified merchant; create shop; add pending email invitation; create verified customer; automatically attach invitation to customer; accept; assert customer cannot invoke merchant invitation RPC. Database remained with no test users or links.

## Technical checks

- `npm run typecheck`: PASS.
- `node scripts/test-unified-app.cjs`: 12 checks PASS after updating obsolete phone-OTP assertion.
- `node scripts/test-email-auth.cjs`: PASS with **mocked provider responses** for email normalization, OTP, magic link, Google browser OAuth flow, cancellation and callback idempotency. These mocks are tests only and are never exposed inside the installed application.
- `node scripts/verify-eas-config.cjs`: PASS before the final auth edits; rerun in final checks.
- Actual user login on Android and live SMTP delivery: **NOT YET VERIFIED**.

## Confirmed external release blockers

1. **Google sign-in provider disabled in Supabase.** Checked live `/auth/v1/settings` with public publishable key: `external.google=false`, `external.email=true`, `mailer_autoconfirm=false`. Create a **Google Cloud OAuth Web client** configured for Supabase callback
   `https://dnbcgrcfwusswfvcdlzs.supabase.co/auth/v1/callback`,
   then securely enable Google provider and supply OAuth client ID/secret in Supabase Dashboard > Authentication > Providers. Never commit secret to Expo or Git.
2. **Production email delivery not verified.** Configure a dedicated SMTP sender (verified domain, mail provider credentials) under Supabase Dashboard > Authentication > SMTP; replace default team-only/rate-limited SMTP; configure email OTP template to include a numeric `{{ .Token }}` or reliable `{{ .ConfirmationURL }}`, and test actual inbox delivery and callback on Android. Keep credentials on Supabase servers.
3. **Auth redirect allow-list:** configure `debtledger-merchant://**` in Supabase Dashboard > Authentication > URL Configuration. A repo `config.toml` update does **not** automatically configure an existing hosted Supabase instance.
4. **Production backend/EAS keys:** last audited EAS `production` lacked public Supabase variables and Android public RevenueCat SDK key; keep services separated from staging and configure genuine deployment settings before a production release.
5. **Store/payment review:** RevenueCat purchases/webhook, end-to-end debt/approve/dispute on actual phones, true screen captures and Google Play account policy rejection (financial-features vs organization account) remain independent blockers. Existing versionCode 4 EAS build was created *before this email auth change*; it is not a Google/email release and must not be represented as one.
6. **Legacy identities:** old phone-only accounts must not automatically be merged with new email/Google accounts based merely on matching displayed names. Provide verified account migration before removing access for actual users if any pre-existing production accounts exist.

## Mandatory release acceptance test

- Create new customer on actual Android with Gmail/other mail account using email OTP/link, log out/log in, receive invitation by verified email, review/debt approve/dispute.
- Login with Google via browser account picker (with consent), callback returns correctly to Sijil, refresh/relaunch restores session, verified email invitation matches.
- Create merchant using the **same account** with 30-day free entitlement. Client mode always free after merchant trial expiration; merchant writes blocked until paid. Test owner/customer isolation and a disputed transaction.
- Verify deletion request removes email link on administrative approval, retained shared history respects approved policy.
- Run RevenueCat billing scenarios and push notification checks, store policy/Data Safety declarations, then generate new AAB with incremented versionCode for **existing** Play app only. No public publication or paid plan changes without confirmation.

Official docs:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/auth-email
