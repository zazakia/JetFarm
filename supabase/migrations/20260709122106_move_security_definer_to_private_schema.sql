-- Move SECURITY DEFINER helper functions from public to private schema.
--
-- Per Supabase security best practices: SECURITY DEFINER functions in an
-- exposed schema (public) can be exploited if there's ever a SQL injection
-- or unintended invocation, because they run as the table owner (bypassing RLS).
--
-- This migration:
--   1. Creates a private schema
--   2. Creates SECURITY DEFINER functions in private with locked search_path
--   3. Replaces public functions with thin STABLE wrappers (not SECURITY DEFINER)

-- Create private schema for sensitive helper functions
CREATE SCHEMA IF NOT EXISTS private;

-- Move get_current_role to private schema with locked search_path
CREATE OR REPLACE FUNCTION private.get_current_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT role FROM public.user_profiles WHERE id = (auth.uid())::text AND deleted_at IS NULL LIMIT 1;
$$;

-- Replace public wrapper (no SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT private.get_current_role();
$$;

-- Move get_current_collector_id to private schema
CREATE OR REPLACE FUNCTION private.get_current_collector_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT id FROM public.app_collectors WHERE auth_id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$;

-- Replace public wrapper (no SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_current_collector_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT private.get_current_collector_id();
$$;

-- Move is_global_admin to private schema
CREATE OR REPLACE FUNCTION private.is_global_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT private.get_current_role() IN ('admin', 'loan_encoder', 'payment_encoder', 'expenses_encoder');
$$;

-- Replace public wrapper (no SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT private.is_global_admin();
$$;

NOTIFY pgrst, 'reload schema';
