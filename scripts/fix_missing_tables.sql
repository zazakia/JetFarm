-- Missing Tables for YOUR_SUPABASE_PROJECT.supabase.co
-- These tables correspond to the WatermelonDB version 14 schema

-- Loans
CREATE TABLE IF NOT EXISTS public.app_loans (
    id TEXT PRIMARY KEY,
    borrower_id TEXT NOT NULL,
    loan_number TEXT NOT NULL,
    principal_amount NUMERIC NOT NULL,
    interest_rate NUMERIC NOT NULL,
    interest_type TEXT NOT NULL,
    term NUMERIC NOT NULL,
    term_unit TEXT NOT NULL,
    frequency TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    installment_amount NUMERIC NOT NULL,
    deposit_amount NUMERIC,
    insurance_amount NUMERIC,
    release_date TIMESTAMPTZ,
    first_payment_date TIMESTAMPTZ,
    maturity_date TIMESTAMPTZ,
    status TEXT NOT NULL,
    is_reloan BOOLEAN DEFAULT FALSE,
    previous_loan_id TEXT,
    deducted_amount NUMERIC,
    encoded_by TEXT,
    collector_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_app_loans_borrower_id ON public.app_loans(borrower_id);

-- Payment Schedules
CREATE TABLE IF NOT EXISTS public.app_payment_schedules (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    scheduled_amount NUMERIC NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_app_payment_schedules_loan_id ON public.app_payment_schedules(loan_id);

-- Payments
CREATE TABLE IF NOT EXISTS public.app_payments (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL,
    borrower_id TEXT,
    schedule_id TEXT,
    collector_id TEXT,
    amount NUMERIC NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL,
    receipt_number TEXT,
    notes TEXT,
    encoded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_app_payments_loan_id ON public.app_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_app_payments_borrower_id ON public.app_payments(borrower_id);

-- Expenses
CREATE TABLE IF NOT EXISTS public.app_expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    description TEXT,
    amount NUMERIC NOT NULL,
    expense_date TIMESTAMPTZ NOT NULL,
    frequency TEXT,
    encoded_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Cash Transactions
CREATE TABLE IF NOT EXISTS public.app_cash_transactions (
    id TEXT PRIMARY KEY,
    transaction_date TIMESTAMPTZ NOT NULL,
    particulars TEXT NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    remarks TEXT,
    recorded_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Bank Accounts
CREATE TABLE IF NOT EXISTS public.app_bank_accounts (
    id TEXT PRIMARY KEY,
    bank_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    starting_balance NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Bank Transactions
CREATE TABLE IF NOT EXISTS public.app_bank_transactions (
    id TEXT PRIMARY KEY,
    bank_account_id TEXT NOT NULL,
    transaction_date TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    particulars TEXT NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_app_bank_transactions_bank_account_id ON public.app_bank_transactions(bank_account_id);

-- Collection Logs
CREATE TABLE IF NOT EXISTS public.app_collection_logs (
    id TEXT PRIMARY KEY,
    collector_id TEXT NOT NULL,
    log_date TIMESTAMPTZ NOT NULL,
    total_collected NUMERIC NOT NULL,
    cash_on_hand_start NUMERIC NOT NULL,
    cash_on_hand_end NUMERIC NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_app_collection_logs_collector_id ON public.app_collection_logs(collector_id);

-- Financial Snapshots
CREATE TABLE IF NOT EXISTS public.app_financial_snapshots (
    id TEXT PRIMARY KEY,
    snapshot_date TIMESTAMPTZ NOT NULL,
    total_assets NUMERIC NOT NULL,
    total_equity NUMERIC NOT NULL,
    total_liabilities NUMERIC NOT NULL,
    loan_loss_reserve NUMERIC NOT NULL,
    operating_revenue NUMERIC NOT NULL,
    financial_costs NUMERIC NOT NULL,
    subsidy_adjustment NUMERIC,
    inflation_adjustment NUMERIC,
    risk_weighted_assets NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Remittances
CREATE TABLE IF NOT EXISTS public.app_remittances (
    id TEXT PRIMARY KEY,
    collector_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    remittance_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL,
    approved_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_app_remittances_collector_id ON public.app_remittances(collector_id);

-- Savings Transactions
CREATE TABLE IF NOT EXISTS public.app_savings_transactions (
    id TEXT PRIMARY KEY,
    borrower_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    reference_id TEXT,
    date TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_app_savings_transactions_borrower_id ON public.app_savings_transactions(borrower_id);

-- Expense Categories
CREATE TABLE IF NOT EXISTS public.app_expense_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Action Logs
CREATE TABLE IF NOT EXISTS public.app_action_logs (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    old_data TEXT,
    new_data TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_app_action_logs_entity ON public.app_action_logs(entity_type, entity_id);

-- Enable RLS and add basic policies
DO $$ 
DECLARE 
    tbl TEXT;
    all_tables TEXT[] := ARRAY[
        'app_loans', 'app_payment_schedules', 'app_payments', 'app_expenses', 
        'app_cash_transactions', 'app_bank_accounts', 'app_bank_transactions', 
        'app_collection_logs', 'app_financial_snapshots', 'app_remittances', 
        'app_savings_transactions', 'app_expense_categories', 'app_action_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY all_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS authenticated_full_access ON public.%I', tbl);
        EXECUTE format('CREATE POLICY authenticated_full_access ON public.%I FOR ALL TO authenticated USING (true)', tbl);
    END LOOP;
END $$;
