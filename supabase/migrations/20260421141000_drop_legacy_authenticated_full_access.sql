-- Remove the permissive policy created by the initial schema migration
-- only from tables that already have replacement role-scoped policies.
-- Other app tables need least-privilege policies before this legacy policy can be dropped safely.
--
-- Also revoke anonymous table grants. The hosted REST API must not expose
-- borrower/loan/payment data before a user has authenticated.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'app_borrowers',
    'app_loans',
    'app_payments'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_full_access ON public.%I', tbl);
  END LOOP;
END $$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'user_profiles',
    'app_borrowers',
    'app_collectors',
    'app_loans',
    'app_payment_schedules',
    'app_payments',
    'app_loan_penalties',
    'app_expenses',
    'app_cash_transactions',
    'app_bank_accounts',
    'app_bank_transactions',
    'app_collection_logs',
    'app_financial_snapshots',
    'app_remittances',
    'app_savings_transactions',
    'app_expense_categories',
    'collection_groups',
    'app_action_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl);
  END LOOP;
END $$;
