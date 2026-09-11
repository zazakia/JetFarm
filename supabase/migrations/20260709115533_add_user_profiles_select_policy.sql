-- Add SELECT policy for user_profiles so client-side role resolution works.
-- Without this, AuthService.getCurrentUserRole() returns null via PostgREST
-- because RLS blocks all rows when no SELECT policy exists.
--
-- The SECURITY DEFINER helper functions (get_current_role, is_global_admin)
-- bypass RLS internally, but the client-side query in AuthService.ts does not.

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = (auth.uid())::text AND deleted_at IS NULL);

-- Also grant table-level SELECT to authenticated role (if not already granted)
GRANT SELECT ON TABLE public.user_profiles TO authenticated;

NOTIFY pgrst, 'reload schema';
