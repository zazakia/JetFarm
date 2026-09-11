-- Add RLS policies for remaining sync tables that lost their permissive
-- policies when authenticated_full_access was dropped, but have no
-- replacement role-scoped policies.
--
-- These follow the same pattern from audit_fixes_part2:
--   - Staff (admin/encoders): global access via is_global_admin()
--   - Collectors: scoped to their own records via get_current_collector_id()
--   - Borrowers: self-access via auth_id = auth.uid()

-- Create policies using IF NOT EXISTS for idempotent re-runs
DO $$
BEGIN
  -- ------------------------------------------------------------------
  -- app_bank_accounts — staff global only
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_bank_accounts' AND policyname = 'Staff have global access to bank accounts') THEN
    CREATE POLICY "Staff have global access to bank accounts" ON public.app_bank_accounts
      FOR ALL USING (public.is_global_admin());
  END IF;

  -- ------------------------------------------------------------------
  -- app_bank_transactions — staff global only
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_bank_transactions' AND policyname = 'Staff have global access to bank transactions') THEN
    CREATE POLICY "Staff have global access to bank transactions" ON public.app_bank_transactions
      FOR ALL USING (public.is_global_admin());
  END IF;

  -- ------------------------------------------------------------------
  -- app_cash_transactions — staff global
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_cash_transactions' AND policyname = 'Staff have global access to cash transactions') THEN
    CREATE POLICY "Staff have global access to cash transactions" ON public.app_cash_transactions
      FOR ALL USING (public.is_global_admin());
  END IF;

  -- ------------------------------------------------------------------
  -- app_collection_logs — staff global + collector scoped
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_collection_logs' AND policyname = 'Staff have global access to collection logs') THEN
    CREATE POLICY "Staff have global access to collection logs" ON public.app_collection_logs
      FOR ALL USING (public.is_global_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_collection_logs' AND policyname = 'Collectors can access their own collection logs') THEN
    CREATE POLICY "Collectors can access their own collection logs" ON public.app_collection_logs
      FOR ALL USING (collector_id = public.get_current_collector_id());
  END IF;

  -- ------------------------------------------------------------------
  -- app_expenses — staff global
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_expenses' AND policyname = 'Staff have global access to expenses') THEN
    CREATE POLICY "Staff have global access to expenses" ON public.app_expenses
      FOR ALL USING (public.is_global_admin());
  END IF;

  -- ------------------------------------------------------------------
  -- app_expense_categories — staff global
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_expense_categories' AND policyname = 'Staff have global access to expense categories') THEN
    CREATE POLICY "Staff have global access to expense categories" ON public.app_expense_categories
      FOR ALL USING (public.is_global_admin());
  END IF;

  -- ------------------------------------------------------------------
  -- app_financial_snapshots — staff global (reports)
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_financial_snapshots' AND policyname = 'Staff have global access to financial snapshots') THEN
    CREATE POLICY "Staff have global access to financial snapshots" ON public.app_financial_snapshots
      FOR ALL USING (public.is_global_admin());
  END IF;

  -- ------------------------------------------------------------------
  -- app_remittances — staff global + collector scoped
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_remittances' AND policyname = 'Staff have global access to remittances') THEN
    CREATE POLICY "Staff have global access to remittances" ON public.app_remittances
      FOR ALL USING (public.is_global_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_remittances' AND policyname = 'Collectors can access their own remittances') THEN
    CREATE POLICY "Collectors can access their own remittances" ON public.app_remittances
      FOR ALL USING (collector_id = public.get_current_collector_id());
  END IF;

  -- ------------------------------------------------------------------
  -- app_savings_transactions — staff global + borrower self-view
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_savings_transactions' AND policyname = 'Staff have global access to savings transactions') THEN
    CREATE POLICY "Staff have global access to savings transactions" ON public.app_savings_transactions
      FOR ALL USING (public.is_global_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_savings_transactions' AND policyname = 'Borrowers can view their own savings transactions') THEN
    CREATE POLICY "Borrowers can view their own savings transactions" ON public.app_savings_transactions
      FOR SELECT USING (
        borrower_id IN (
          SELECT id::text FROM public.app_borrowers WHERE auth_id = auth.uid()
        )
      );
  END IF;

  -- ------------------------------------------------------------------
  -- app_action_logs — staff global (audit trail)
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_action_logs' AND policyname = 'Staff have global access to action logs') THEN
    CREATE POLICY "Staff have global access to action logs" ON public.app_action_logs
      FOR ALL USING (public.is_global_admin());
  END IF;

  -- ------------------------------------------------------------------
  -- app_collectors — ensure collector self-view exists
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_collectors' AND policyname = 'Collectors can view own record') THEN
    CREATE POLICY "Collectors can view own record" ON public.app_collectors
      FOR SELECT USING (auth_id = auth.uid());
  END IF;

  -- ------------------------------------------------------------------
  -- loan_penalties — staff global + collector scoped + borrower self-view
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_loan_penalties' AND policyname = 'Staff have global access to loan penalties') THEN
    CREATE POLICY "Staff have global access to loan penalties" ON public.app_loan_penalties
      FOR ALL USING (public.is_global_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_loan_penalties' AND policyname = 'Collectors can access penalties for their assigned loans') THEN
    CREATE POLICY "Collectors can access penalties for their assigned loans" ON public.app_loan_penalties
      FOR ALL USING (
        loan_id IN (
          SELECT l.id FROM public.app_loans l
          JOIN public.app_borrowers b ON l.borrower_id = b.id::text
          WHERE b.collector_id::text = public.get_current_collector_id()
        )
      );
  END IF;

END $$;

NOTIFY pgrst, 'reload schema';
