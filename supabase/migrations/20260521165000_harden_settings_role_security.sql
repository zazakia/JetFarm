-- Harden role-derived authorization used by settings/configuration RLS.
--
-- This closes two production risks:
-- 1. Users could update their own user_profiles.role/is_active through the
--    generic "Users can update own profile" policy, then satisfy admin RLS.
-- 2. Deactivated users could still satisfy get_current_role() until their
--    session expired because the helper ignored is_active.

CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS text AS $$
  SELECT role
  FROM public.user_profiles
  WHERE id = (auth.uid())::text
    AND deleted_at IS NULL
    AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS boolean AS $$
  SELECT public.get_current_role() IN ('admin', 'main_office');
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, auth;

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

-- Keep the table-level UPDATE grant so global-staff administration and sync
-- still work through the Data API. A trigger below blocks non-staff users from
-- changing authorization-sensitive fields on their own profile.
GRANT UPDATE ON public.user_profiles TO authenticated;

CREATE POLICY "Users can update own safe profile fields" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()::text
    AND deleted_at IS NULL
    AND is_active = true
  )
  WITH CHECK (
    id = auth.uid()::text
    AND deleted_at IS NULL
    AND is_active = true
  );

CREATE OR REPLACE FUNCTION public.prevent_user_profile_self_escalation()
RETURNS trigger AS $$
BEGIN
  IF NOT public.is_global_admin()
     AND OLD.id = auth.uid()::text
     AND (
       NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     ) THEN
    RAISE EXCEPTION 'Users cannot change their own role, active status, or deletion status'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS prevent_user_profile_self_escalation ON public.user_profiles;
CREATE TRIGGER prevent_user_profile_self_escalation
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_profile_self_escalation();

-- Prevent app_role_permissions from disabling all app-side admin access.
-- This is a database backstop for the UI guard in Role Access settings.
CREATE OR REPLACE FUNCTION public.prevent_admin_route_lockout()
RETURNS trigger AS $$
BEGIN
  IF NEW.permission_key = 'route.(admin)'
     AND NEW.role IN ('admin', 'main_office')
     AND NEW.enabled = false
     AND COALESCE(OLD.enabled, true) <> false THEN
    RAISE EXCEPTION 'Admin dashboard access for % cannot be disabled', NEW.role
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS prevent_admin_route_lockout ON public.app_role_permissions;
CREATE TRIGGER prevent_admin_route_lockout
  BEFORE UPDATE OF enabled ON public.app_role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_route_lockout();
