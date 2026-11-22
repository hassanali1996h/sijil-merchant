-- Read-only Supabase/Postgres RLS audit. Run in SQL editor on TEST project first.
-- No DDL, no mutations. A clean result is NOT proof of correct tenant isolation.
-- Inspect each finding; review SECURITY DEFINER RPCs and test as separate auth users.
WITH exposed AS (
  SELECT n.nspname AS schema_name, c.relname AS table_name,
         c.oid AS relation_id, c.relrowsecurity AS rls_enabled,
         c.relforcerowsecurity AS rls_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public')
    AND c.relkind IN ('r','p')
),
findings AS (
  SELECT 'RLS_DISABLED' AS finding, schema_name, table_name,
         'Enable RLS and verify policies before any production use' AS detail
  FROM exposed WHERE NOT rls_enabled
  UNION ALL
  SELECT 'NO_POLICIES', e.schema_name, e.table_name,
         'RLS is enabled but no policies exist; verify intended access through RPCs'
  FROM exposed e
  WHERE e.rls_enabled AND NOT EXISTS (
    SELECT 1 FROM pg_policy p WHERE p.polrelid = e.relation_id
  )
  UNION ALL
  SELECT 'BROAD_POLICY', e.schema_name, e.table_name,
         'Policy ' || quote_ident(p.polname) || ' applies to PUBLIC; inspect USING/WITH CHECK and tenant restrictions'
  FROM exposed e
  JOIN pg_policy p ON p.polrelid = e.relation_id
  WHERE 0 = ANY(p.polroles)
  UNION ALL
  SELECT 'CLIENT_WRITE_GRANT', e.schema_name, e.table_name,
         'Role ' || quote_ident(r.rolname) || ' has table-level ' || g.privilege ||
         '; confirm RLS plus explicit REVOKE/column grants protect ledger writes'
  FROM exposed e
  CROSS JOIN (VALUES ('INSERT'),('UPDATE'),('DELETE')) g(privilege)
  JOIN pg_roles r ON r.rolname IN ('anon','authenticated')
  WHERE has_table_privilege(r.oid, e.relation_id, g.privilege)
)
SELECT finding, schema_name, table_name, detail
FROM findings
ORDER BY finding, schema_name, table_name, detail;
