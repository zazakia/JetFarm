-- ========================================================
-- POSCursor Audit Fixes Phase 2 - RLS & Types (SEC2, D1)
-- ========================================================

-- D1. Fix Type Mismatches (Only apply if types differ)
-- We use DO blocks to avoid errors if already applied or if conversion is tricky
DO $$ 
BEGIN
  -- app_loan_penalties.penalty_date to BIGINT
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_loan_penalties' AND column_name = 'penalty_date' AND data_type != 'bigint') THEN
    ALTER TABLE public.app_loan_penalties ALTER COLUMN penalty_date TYPE BIGINT USING penalty_date::bigint;
  END IF;

  -- app_borrowers.collector_id to UUID (Handle text-to-uuid carefully)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_borrowers' AND column_name = 'collector_id' AND data_type != 'uuid') THEN
    ALTER TABLE public.app_borrowers ALTER COLUMN collector_id TYPE UUID USING collector_id::uuid;
  END IF;
END $$;

-- SEC2. Implement Strict RLS Operations

-- Create a helper function to securely resolve current user role from user_profiles
-- Cast auth.uid() to text to match user_profiles.id
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS text AS $$
  SELECT role FROM public.user_profiles WHERE id = (auth.uid())::text AND deleted_at IS NULL LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Create helper to resolve collector ID for a user
-- Since app_collectors.id is text in local schema, we return text.
CREATE OR REPLACE FUNCTION public.get_current_collector_id()
RETURNS text AS $$
  SELECT id FROM public.app_collectors WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper to verify if user is an admin or encoder
CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS boolean AS $$
  SELECT public.get_current_role() IN ('admin', 'loan_encoder', 'payment_encoder', 'expenses_encoder');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- BEGIN RLS ACTIVATION 
ALTER TABLE public.app_borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to make this migration idempotent
DO $$
BEGIN
  DROP POLICY IF EXISTS "Encoders have global access to borrowers" ON public.app_borrowers;
  DROP POLICY IF EXISTS "Collectors can access their assigned borrowers" ON public.app_borrowers;
  DROP POLICY IF EXISTS "Borrowers can access their own record" ON public.app_borrowers;
  DROP POLICY IF EXISTS "Encoders have global access to loans" ON public.app_loans;
  DROP POLICY IF EXISTS "Collectors can access their assigned loans" ON public.app_loans;
  DROP POLICY IF EXISTS "Borrowers can access their own loans" ON public.app_loans;
  DROP POLICY IF EXISTS "Encoders have global access to payments" ON public.app_payments;
  DROP POLICY IF EXISTS "Collectors can access payments for their loans" ON public.app_payments;
  DROP POLICY IF EXISTS "Borrowers can access their own payments" ON public.app_payments;
  -- Cleanup old permissive policies if they exist
  DROP POLICY IF EXISTS "Authenticated users have full access" ON public.app_borrowers;
  DROP POLICY IF EXISTS "Authenticated users have full access" ON public.app_loans;
  DROP POLICY IF EXISTS "Authenticated users have full access" ON public.app_payments;
END
$$;

-- 1. Borrowers Table
-- We cast collector_id::text because get_current_collector_id returns text
CREATE POLICY "Encoders have global access to borrowers" ON public.app_borrowers
  FOR ALL USING (public.is_global_admin());

CREATE POLICY "Collectors can access their assigned borrowers" ON public.app_borrowers
  FOR ALL USING (collector_id::text = public.get_current_collector_id());

CREATE POLICY "Borrowers can access their own record" ON public.app_borrowers
  FOR SELECT USING (auth_id = auth.uid());

-- 2. Loans Table
CREATE POLICY "Encoders have global access to loans" ON public.app_loans
  FOR ALL USING (public.is_global_admin());

CREATE POLICY "Collectors can access their assigned loans" ON public.app_loans
  FOR ALL USING (
    borrower_id IN (
      SELECT id::text FROM public.app_borrowers WHERE collector_id::text = public.get_current_collector_id()
    )
  );

CREATE POLICY "Borrowers can access their own loans" ON public.app_loans
  FOR SELECT USING (
    borrower_id IN (
      SELECT id::text FROM public.app_borrowers WHERE auth_id = auth.uid()
    )
  );

-- 3. Payments Table
CREATE POLICY "Encoders have global access to payments" ON public.app_payments
  FOR ALL USING (public.is_global_admin());

CREATE POLICY "Collectors can access payments for their loans" ON public.app_payments
  FOR ALL USING (
    loan_id IN (
      SELECT id FROM public.app_loans WHERE borrower_id IN (
        SELECT id::text FROM public.app_borrowers WHERE collector_id::text = public.get_current_collector_id()
      )
    )
  );

CREATE POLICY "Borrowers can access their own payments" ON public.app_payments
  FOR SELECT USING (
    loan_id IN (
      SELECT id FROM public.app_loans WHERE borrower_id IN (
        SELECT id::text FROM public.app_borrowers WHERE auth_id = auth.uid()
      )
    )
  );
