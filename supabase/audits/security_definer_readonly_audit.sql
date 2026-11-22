-- Read-only inventory of exposed SECURITY DEFINER routines for manual security review.
-- Run against TEST Supabase first. Results are indicators, not exploit findings.
-- No DDL, no calls to application routines, and no user data returned.
-- Review every returned function's body and grants with a qualified database reviewer.
WITH routines AS (
  SELECT n.nspname AS schema_name,
         p.proname AS routine_name,
         pg_get_function_identity_arguments(p.oid) AS identity_arguments,
         p.oid AS routine_oid,
         p.proconfig AS config,
         p.proacl AS acl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public')
    AND p.prosecdef
)
SELECT schema_name,
       routine_name,
       identity_arguments,
       (SELECT split_part(setting, '=', 2)
          FROM unnest(COALESCE(config, ARRAY[]::text[])) setting
         WHERE setting LIKE 'search_path=%' LIMIT 1) AS configured_search_path,
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM unnest(COALESCE(config, ARRAY[]::text[])) setting
         WHERE setting LIKE 'search_path=%'
       ) THEN 'REVIEW_MISSING_SEARCH_PATH'
       ELSE 'REVIEW_SEARCH_PATH_CONTENTS' END AS search_path_review,
       has_function_privilege('PUBLIC', routine_oid, 'EXECUTE') AS public_execute,
       EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon'
               AND has_function_privilege(oid, routine_oid, 'EXECUTE')) AS anon_execute,
       EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated'
               AND has_function_privilege(oid, routine_oid, 'EXECUTE')) AS authenticated_execute
FROM routines
ORDER BY schema_name, routine_name, identity_arguments;
