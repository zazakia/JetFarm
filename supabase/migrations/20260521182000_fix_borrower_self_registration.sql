-- Fix borrower self-registration fallback when the Edge Function is unavailable.
-- New Supabase auth users must be able to create exactly one inactive borrower
-- profile for themselves, without gaining any staff privileges.

GRANT INSERT ON public.user_profiles TO authenticated;

DROP POLICY IF EXISTS "Borrowers can create own pending profile" ON public.user_profiles;
CREATE POLICY "Borrowers can create own pending profile" ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    id = (auth.uid())::text
    AND role = 'borrower'
    AND is_active = false
    AND deleted_at IS NULL
  );
