-- Local Schema Setup for jetfarm-local
-- Based on production schema from YOUR_SUPABASE_PROJECT.supabase.co

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables to ensure a clean slate
DROP TABLE IF EXISTS public.app_action_logs;
DROP TABLE IF EXISTS public.app_payment_schedules;
DROP TABLE IF EXISTS public.app_payments;
DROP TABLE IF EXISTS public.app_loan_penalties;
DROP TABLE IF EXISTS public.app_loans;
DROP TABLE IF EXISTS public.collection_groups;
DROP TABLE IF EXISTS public.app_borrowers;
DROP TABLE IF EXISTS public.app_collectors;
DROP TABLE IF EXISTS public.user_profiles;
DROP TABLE IF EXISTS public.app_expenses;
DROP TABLE IF EXISTS public.app_cash_transactions;
DROP TABLE IF EXISTS public.app_bank_accounts;
DROP TABLE IF EXISTS public.app_bank_transactions;
DROP TABLE IF EXISTS public.app_collection_logs;
DROP TABLE IF EXISTS public.app_financial_snapshots;
DROP TABLE IF EXISTS public.app_remittances;
DROP TABLE IF EXISTS public.app_savings_transactions;
DROP TABLE IF EXISTS public.app_expense_categories;

-- user_profiles
CREATE TABLE public.user_profiles (
    id TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::text,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- app_collectors
CREATE TABLE public.app_collectors (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    auth_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- app_borrowers
CREATE TABLE public.app_borrowers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    address TEXT,
    phone TEXT,
    area TEXT,
    route_index NUMERIC,
    collector_id UUID,
    auth_id UUID,
    date_of_birth TIMESTAMPTZ,
    gender TEXT,
    notes TEXT,
    created_by UUID,
    latitude NUMERIC,
    longitude NUMERIC,
    "group" TEXT,
    co_maker_name TEXT,
    business TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- app_loans
CREATE TABLE public.app_loans (
    id TEXT PRIMARY KEY,
    borrower_id TEXT NOT NULL,
    loan_number TEXT,
    loan_type TEXT,
    principal_amount NUMERIC,
    interest_rate NUMERIC,
    interest_type TEXT,
    term INTEGER,
    term_unit TEXT,
    frequency TEXT,
    total_amount NUMERIC,
    installment_amount NUMERIC,
    release_date TIMESTAMPTZ,
    first_payment_date TIMESTAMPTZ,
    maturity_date TIMESTAMPTZ,
    status TEXT DEFAULT 'active',
    is_reloan BOOLEAN DEFAULT false,
    previous_loan_id TEXT,
    encoded_by TEXT,
    collector_id TEXT,
    deposit_amount NUMERIC,
    insurance_amount NUMERIC,
    processing_fee NUMERIC,
    collection_fee NUMERIC,
    notarial_fee NUMERIC,
    rod_fee NUMERIC,
    lto_fee NUMERIC,
    udi_rebatable_fee NUMERIC,
    vat_on_interest NUMERIC,
    vat_on_charges NUMERIC,
    dst_fee NUMERIC,
    rebate_amount NUMERIC,
    savings_per_payment NUMERIC,
    deducted_amount NUMERIC DEFAULT 0,
    batch INTEGER,
    cycle INTEGER,
    notes TEXT,
    interest_amount NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- app_payment_schedules
CREATE TABLE public.app_payment_schedules (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    scheduled_amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    fees_amount NUMERIC DEFAULT 0,
    principal_amount NUMERIC DEFAULT 0,
    interest_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- app_payments
CREATE TABLE public.app_payments (
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
CREATE INDEX idx_app_payments_borrower_id ON public.app_payments(borrower_id);

-- app_loan_penalties
CREATE TABLE public.app_loan_penalties (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    loan_id TEXT,
    amount NUMERIC NOT NULL,
    penalty_date BIGINT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- app_expenses
CREATE TABLE public.app_expenses (
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

-- app_cash_transactions
CREATE TABLE public.app_cash_transactions (
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

-- app_bank_accounts
CREATE TABLE public.app_bank_accounts (
    id TEXT PRIMARY KEY,
    bank_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    starting_balance NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- app_bank_transactions
CREATE TABLE public.app_bank_transactions (
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

-- app_collection_logs
CREATE TABLE public.app_collection_logs (
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

-- app_financial_snapshots
CREATE TABLE public.app_financial_snapshots (
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

-- app_remittances
CREATE TABLE public.app_remittances (
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

-- app_savings_transactions
CREATE TABLE public.app_savings_transactions (
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

-- app_expense_categories
CREATE TABLE public.app_expense_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- collection_groups
CREATE TABLE public.collection_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    collector_id UUID,
    collection_day SMALLINT DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT collection_day_check CHECK (collection_day >= 0 AND collection_day <= 6)
);

-- app_action_logs
CREATE TABLE public.app_action_logs (
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

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_collectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_loan_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_collection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_savings_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_action_logs ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users (matching production policy)
DO $$ 
DECLARE 
    tbl TEXT;
    all_tables TEXT[] := ARRAY[
        'user_profiles', 'app_borrowers', 'app_collectors', 'app_loans', 
        'app_payment_schedules', 'app_payments', 'app_loan_penalties', 
        'app_expenses', 'app_cash_transactions', 'app_bank_accounts', 
        'app_bank_transactions', 'app_collection_logs', 'app_financial_snapshots', 
        'app_remittances', 'app_savings_transactions', 'app_expense_categories', 
        'collection_groups', 'app_action_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY all_tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS authenticated_full_access ON public.%I', tbl);
        EXECUTE format('CREATE POLICY authenticated_full_access ON public.%I FOR ALL TO authenticated USING (true)', tbl);
    END LOOP;
END $$;
