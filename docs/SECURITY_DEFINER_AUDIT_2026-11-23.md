# SECURITY DEFINER routine audit — 2026-11-23

## Scope
Added `supabase/audits/security_definer_readonly_audit.sql` as a **read-only inventory** of SECURITY DEFINER routines in the exposed `public` schema. It lists identity arguments, configured search_path and effective EXECUTE privileges for PUBLIC, anon and authenticated.

## How to use
1. Run the SQL in **test** Supabase SQL Editor with a privileged review account. Do not run it in the mobile app.
2. For each returned routine, inspect its body, `auth.uid()` checks, tenant authorization, transaction locking, and whether every referenced relation/function is schema-qualified.
3. Investigate missing or unsafe search_path, public/anon EXECUTE, and overly broad authenticated EXECUTE. Effective EXECUTE does **not** establish exploitability; absence of findings does **not** prove isolation.
4. Run authenticated two-merchant/two-customer negative tests and idempotency/concurrency tests separately. Record results in release checklist before any AAB release.
5. Do not change grants or production database from this audit. Apply fixes only through reviewed migrations with rollback plan.

## Verification
This is a static SQL audit added to the repository. It has **not** been executed against Supabase and no live RLS/tenant isolation conclusion is asserted. This complements `rls_readonly_audit.sql` (tables/policies/grants) without repeating it.

## Outstanding release blockers
Iraqi SMS OTP delivery, account deletion lifecycle and retention review, customer approval/dispute integration tests, actual Play package IDs, EAS credentials and signed AAB, and truthful Data Safety declarations remain unverified.
