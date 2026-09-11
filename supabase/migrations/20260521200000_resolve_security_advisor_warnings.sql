-- Resolve remaining Supabase security advisor warnings without changing the
-- intended app access model.
--
-- 1. Remove legacy all-access policies left by older local databases.
-- 2. Pin search_path on helper functions flagged by the linter.
-- 3. Replace the public demo inquiry INSERT policy's always-true check with
--    the same bounded, non-empty shape enforced by the app and table checks.

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'app_action_logs',
    'app_bank_accounts',
    'app_bank_transactions',
    'app_borrowers',
    'app_cash_transactions',
    'app_collection_logs',
    'app_collectors',
    'app_expense_categories',
    'app_expenses',
    'app_financial_snapshots',
    'app_loan_penalties',
    'app_loans',
    'app_payment_schedules',
    'app_payments',
    'app_remittances',
    'app_savings_transactions',
    'collection_groups',
    'user_profiles'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS anon_full_access ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_full_access ON public.%I', tbl);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_current_collector_id()
RETURNS text AS $$
  SELECT id
  FROM public.app_collectors
  WHERE auth_id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS timestamptz AS $$
  SELECT now();
$$ LANGUAGE sql STABLE SET search_path = public;

DROP POLICY IF EXISTS "Anyone can submit demo inquiries" ON public.demo_inquiries;

CREATE POLICY "Anyone can submit demo inquiries" ON public.demo_inquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    full_name = btrim(full_name)
    AND full_name <> ''
    AND char_length(full_name) <= 160
    AND business_name = btrim(business_name)
    AND business_name <> ''
    AND char_length(business_name) <= 200
    AND contact_number = btrim(contact_number)
    AND contact_number <> ''
    AND char_length(contact_number) <= 80
    AND (email IS NULL OR (email = btrim(email) AND email <> '' AND char_length(email) <= 254))
    AND (message IS NULL OR (message = btrim(message) AND message <> '' AND char_length(message) <= 2000))
    AND admin_email = 'cybergada@gmail.com'
    AND admin_whatsapp = '639811254446'
    AND status = 'new'
  );

NOTIFY pgrst, 'reload schema';
