-- Allow RLS helper wrappers in public schema to call the private helper
-- functions for authenticated app users. Without these grants, policies using
-- public.is_global_admin(), public.get_current_role(), or
-- public.get_current_collector_id() fail with:
--   permission denied for schema private

GRANT USAGE ON SCHEMA private TO authenticated;

GRANT EXECUTE ON FUNCTION private.get_current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_current_collector_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_global_admin() TO authenticated;

NOTIFY pgrst, 'reload schema';
