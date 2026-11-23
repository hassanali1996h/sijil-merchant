-- Read-only release gate for staging. Run in Supabase SQL editor.
-- A successful run returns zero rows; any row is a release blocker.
-- This is an exposure inventory, not a proof of exploitability.
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as signature,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       coalesce(array_to_string(p.proconfig, ', '), '<default>') as function_settings
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by p.proname, signature;
