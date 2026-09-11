-- Ensure global staff roles included by public.is_global_admin() can sync schedules.
-- Previous hardening left schedules readable to borrowers/collectors but not loan/payment encoders.

DROP POLICY IF EXISTS "Global staff can manage app_payment_schedules" ON public.app_payment_schedules;
CREATE POLICY "Global staff can manage app_payment_schedules"
  ON public.app_payment_schedules
  FOR ALL TO authenticated
  USING (public.is_global_admin())
  WITH CHECK (public.is_global_admin());

NOTIFY pgrst, 'reload schema';
