-- Remove legacy broad production policies left over from earlier bootstrap migrations.
-- This is data-safe: it changes only RLS policy metadata, not table rows.

DROP POLICY IF EXISTS "Enable read access for all users" ON public.app_payments;
DROP POLICY IF EXISTS auth_all_user_profiles ON public.user_profiles;
DROP POLICY IF EXISTS "auth_all_user_profiles" ON public.user_profiles;

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT *
    FROM (VALUES
      ('app_borrowers', 'Borrowers can access their own record'),
      ('app_borrowers', 'Borrowers can view their own profile'),
      ('app_borrowers', 'Collectors can access their assigned borrowers'),
      ('app_borrowers', 'Encoders have global access to borrowers'),
      ('app_borrowers', 'Staff complete access - profile'),
      ('app_loans', 'Borrowers can access their own loans'),
      ('app_loans', 'Borrowers can view their own loans'),
      ('app_loans', 'Collectors can access their assigned loans'),
      ('app_loans', 'Encoders have global access to loans'),
      ('app_loans', 'Staff complete access - loans'),
      ('app_payment_schedules', 'Borrowers can view their own payment schedules'),
      ('app_payment_schedules', 'Staff complete access - schedules'),
      ('app_payments', 'Borrowers can access their own payments'),
      ('app_payments', 'Borrowers can view their own payments'),
      ('app_payments', 'Collectors can access payments for their loans'),
      ('app_payments', 'Encoders have global access to payments'),
      ('app_payments', 'Staff complete access - payments')
    ) AS policies(table_name, policy_name)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = policy_record.table_name
        AND policyname = policy_record.policy_name
    ) THEN
      EXECUTE format(
        'ALTER POLICY %I ON public.%I TO authenticated',
        policy_record.policy_name,
        policy_record.table_name
      );
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
