-- Remove anonymous EXECUTE on SECURITY DEFINER functions in public.
-- Existing authenticated and service_role grants are preserved.
-- Trigger functions are excluded because they are not RPC endpoints.
-- SECURITY DEFINER routines added later must receive explicit grants.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype <> 'pg_catalog.trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.signature);
  END LOOP;
END
$$;
