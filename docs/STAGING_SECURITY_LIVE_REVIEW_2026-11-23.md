# Supabase staging read-only security review — 2026-11-23

Project: `debt-ledger-staging` (`dnbcgrcfwusswfvcdlzs`), ACTIVE_HEALTHY at review time. **No SQL mutations were performed.**

## Live checks performed

1. Queried `pg_class` / `pg_namespace` / `pg_policies` for public user tables. All 12 returned tables had `relrowsecurity=true`. Four tables (`notification_outbox`, `notification_push_receipts`, `push_tokens`, `store_webhook_events`) had zero policies; that is not by itself an exposure. No table had FORCE RLS; this alone is not proof of a defect.
2. Queried `pg_proc` for public `SECURITY DEFINER` functions and effective EXECUTE grants. **16 functions are executable by `anon`**, including `create_transaction_request`, `respond_to_transaction`, `register_merchant_device`, and `register_push_token`. Many have `search_path=public, pg_temp`. This is a security review finding, **not proof of unauthorized access**: functions may reject unauthenticated callers internally. Do not claim isolation until verified with actual JWT roles.

## Reproduction and next gates

Run `supabase/audits/assert_no_anon_security_definer.sql` against staging. It must return zero rows for a strict anonymous-execution release gate. Review each function body, internal `auth.uid()` checks, and intended caller roles before deciding which grants to revoke. Check `PUBLIC` grants too: revoking `anon` alone may be ineffective if `PUBLIC` retains EXECUTE. Use a reviewed migration and test under `anon`, merchant A, merchant B, and customer JWTs; test both allowed and forbidden debt/approval paths. Do not execute blanket revocations without regression testing.

This report is a catalog check only. It does not validate OTP delivery, RLS row isolation, account deletion, push notifications, subscription billing, or Google Play declarations. Android package IDs remain unresolved against the real Play listings; do not build or submit a release on assumptions.
