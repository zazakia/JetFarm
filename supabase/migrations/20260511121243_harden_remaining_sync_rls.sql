-- Harden remaining sync RLS policies after legacy full-access bootstrap.
-- This migration removes blanket authenticated access from every sync table,
-- preserves role helper behavior, and adds explicit authenticated grants that
-- still rely on RLS for row-level authorization.

CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS boolean AS $$
  SELECT public.get_current_role() IN ('admin', 'main_office', 'loan_encoder', 'payment_encoder', 'expenses_encoder');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

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
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tbl);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_full_access ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_full_access" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users have full access" ON public.%I', tbl);
  END LOOP;
END $$;

-- user_profiles must not allow any authenticated user to manage everyone.
DROP POLICY IF EXISTS "Global staff can manage user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Global staff can manage user profiles" ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.is_global_admin())
  WITH CHECK (public.is_global_admin());

CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid()::text AND deleted_at IS NULL);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()::text AND deleted_at IS NULL)
  WITH CHECK (id = auth.uid()::text AND deleted_at IS NULL);

-- Remaining sync tables that did not yet have least-privilege replacements.
-- Global staff can sync/manage these records; non-global role-specific access
-- should be added explicitly per module instead of falling back to blanket access.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'app_collectors',
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
    EXECUTE format('DROP POLICY IF EXISTS "Global staff can manage %s" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Global staff can manage %s" ON public.%I FOR ALL TO authenticated USING (public.is_global_admin()) WITH CHECK (public.is_global_admin())',
      tbl,
      tbl
    );
  END LOOP;
END $$;

-- Keep app metadata/reference lists readable to authenticated users without granting writes.
DROP POLICY IF EXISTS "Authenticated users can view expense categories" ON public.app_expense_categories;
CREATE POLICY "Authenticated users can view expense categories" ON public.app_expense_categories
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Authenticated users can view collection groups" ON public.collection_groups;
CREATE POLICY "Authenticated users can view collection groups" ON public.collection_groups
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

NOTIFY pgrst, 'reload schema';
