-- Remove permissive policies from app_borrowers
DROP POLICY IF EXISTS "Enable all for anon" ON public.app_borrowers;

-- Remove permissive policies from app_loans
DROP POLICY IF EXISTS "allow_all_app_loans" ON public.app_loans;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.app_loans;

-- Remove permissive policies from app_payment_schedules
DROP POLICY IF EXISTS "allow_all_app_payment_schedules" ON public.app_payment_schedules;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.app_payment_schedules;

-- Remove permissive policies from app_payments
DROP POLICY IF EXISTS "allow_all_app_payments" ON public.app_payments;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.app_payments;

-- Remove permissive policies from app_collectors
DROP POLICY IF EXISTS "allow_all_app_collectors" ON public.app_collectors;

-- Ensure app_collectors has a restricted policy for authenticated users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'app_collectors' AND policyname = 'Authenticated users can view collectors'
    ) THEN
        CREATE POLICY "Authenticated users can view collectors" ON public.app_collectors
        FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- Fix app_payment_schedules RLS for collectors.
-- A collector should see schedules for loans that belong to their borrowers.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'app_payment_schedules' AND policyname = 'Collectors can access their assigned schedules'
    ) THEN
        CREATE POLICY "Collectors can access their assigned schedules" ON public.app_payment_schedules
        FOR ALL TO authenticated
        USING (
            loan_id IN (
                SELECT l.id FROM public.app_loans l
                JOIN public.app_borrowers b ON l.borrower_id = b.id::text
                WHERE b.collector_id::text = get_current_collector_id()
            )
        );
    END IF;
END $$;
