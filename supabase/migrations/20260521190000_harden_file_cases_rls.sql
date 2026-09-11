-- Restrict legal/file-case records to global staff roles.
-- Client route guards are not a database security boundary; file cases include
-- delinquency/legal metadata and should not be readable or editable by every
-- authenticated user.

ALTER TABLE public.app_file_cases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_file_cases FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.app_file_cases TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can read file cases" ON public.app_file_cases;
DROP POLICY IF EXISTS "Authenticated users can insert file cases" ON public.app_file_cases;
DROP POLICY IF EXISTS "Authenticated users can update file cases" ON public.app_file_cases;
DROP POLICY IF EXISTS "Global staff can manage file cases" ON public.app_file_cases;

CREATE POLICY "Global staff can manage file cases"
  ON public.app_file_cases
  FOR ALL
  TO authenticated
  USING (public.is_global_admin())
  WITH CHECK (public.is_global_admin());

NOTIFY pgrst, 'reload schema';
