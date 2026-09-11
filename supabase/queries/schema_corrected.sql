-- ================================================================
-- POSCURSOR SCHEMA (CORRECTED)
-- All dates use TIMESTAMPTZ (RFC 3339 ISO format)
-- ================================================================

-- ================================================================
-- 1. USER_PROFILES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'collector', 'loan_encoder', 'payment_encoder', 'expenses_encoder')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_user_profiles_updated_at ON user_profiles(updated_at);
CREATE INDEX idx_user_profiles_role ON user_profiles(role) WHERE is_active = true;
CREATE INDEX idx_user_profiles_deleted_at ON user_profiles(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 2. BORROWERS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS borrowers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    area TEXT,
    route_index INTEGER,
    collector_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    auth_id UUID,
    date_of_birth TIMESTAMPTZ,
    gender TEXT,
    notes TEXT,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    latitude NUMERIC,
    longitude NUMERIC,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_borrowers_updated_at ON borrowers(updated_at);
CREATE INDEX idx_borrowers_collector_id ON borrowers(collector_id);
CREATE INDEX idx_borrowers_full_name ON borrowers(full_name);
CREATE INDEX idx_borrowers_deleted_at ON borrowers(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 3. LOANS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
    loan_number TEXT NOT NULL UNIQUE,
    principal_amount NUMERIC NOT NULL,
    interest_rate NUMERIC NOT NULL,
    interest_type TEXT,
    term INTEGER,
    term_unit TEXT,
    frequency TEXT,
    total_amount NUMERIC,
    installment_amount NUMERIC,
    deposit_amount NUMERIC,
    insurance_amount NUMERIC,
    release_date TIMESTAMPTZ,
    first_payment_date TIMESTAMPTZ,
    maturity_date TIMESTAMPTZ,
    status TEXT CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),
    is_reloan BOOLEAN DEFAULT false,
    previous_loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
    encoded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    collector_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_loans_updated_at ON loans(updated_at);
CREATE INDEX idx_loans_borrower_id ON loans(borrower_id);
CREATE INDEX idx_loans_collector_id ON loans(collector_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_deleted_at ON loans(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 4. PAYMENT_SCHEDULES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS payment_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    due_date TIMESTAMPTZ NOT NULL,
    scheduled_amount NUMERIC NOT NULL,
    status TEXT CHECK (status IN ('pending', 'paid', 'overdue', 'waived')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_schedules_updated_at ON payment_schedules(updated_at);
CREATE INDEX idx_payment_schedules_loan_id ON payment_schedules(loan_id);
CREATE INDEX idx_payment_schedules_due_date ON payment_schedules(due_date);
CREATE INDEX idx_payment_schedules_deleted_at ON payment_schedules(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 5. PAYMENTS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES payment_schedules(id) ON DELETE SET NULL,
    collector_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL,
    receipt_number TEXT,
    notes TEXT,
    encoded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_payments_updated_at ON payments(updated_at);
CREATE INDEX idx_payments_loan_id ON payments(loan_id);
CREATE INDEX idx_payments_collector_id ON payments(collector_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_payments_deleted_at ON payments(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 6. EXPENSES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    description TEXT,
    amount NUMERIC NOT NULL,
    expense_date TIMESTAMPTZ NOT NULL,
    encoded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_expenses_updated_at ON expenses(updated_at);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expenses_deleted_at ON expenses(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 7. CASH_TRANSACTIONS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_date TIMESTAMPTZ NOT NULL,
    particulars TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('inflow', 'outflow')),
    amount NUMERIC NOT NULL,
    remarks TEXT,
    recorded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_cash_transactions_updated_at ON cash_transactions(updated_at);
CREATE INDEX idx_cash_transactions_transaction_date ON cash_transactions(transaction_date);
CREATE INDEX idx_cash_transactions_type ON cash_transactions(type);
CREATE INDEX idx_cash_transactions_deleted_at ON cash_transactions(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 8. BANK_ACCOUNTS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    starting_balance NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_bank_accounts_updated_at ON bank_accounts(updated_at);
CREATE INDEX idx_bank_accounts_deleted_at ON bank_accounts(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 9. BANK_TRANSACTIONS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    transaction_date TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'transfer')),
    amount NUMERIC NOT NULL,
    particulars TEXT NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_bank_transactions_updated_at ON bank_transactions(updated_at);
CREATE INDEX idx_bank_transactions_bank_account_id ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_transaction_date ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_deleted_at ON bank_transactions(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 10. COLLECTION_LOGS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS collection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    log_date TIMESTAMPTZ NOT NULL,
    total_collected NUMERIC NOT NULL,
    cash_on_hand_start NUMERIC,
    cash_on_hand_end NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_collection_logs_updated_at ON collection_logs(updated_at);
CREATE INDEX idx_collection_logs_collector_id ON collection_logs(collector_id);
CREATE INDEX idx_collection_logs_log_date ON collection_logs(log_date);
CREATE INDEX idx_collection_logs_deleted_at ON collection_logs(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE collection_logs ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 11. FINANCIAL_SNAPSHOTS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS financial_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date TIMESTAMPTZ NOT NULL,
    total_assets NUMERIC,
    total_equity NUMERIC,
    total_liabilities NUMERIC,
    loan_loss_reserve NUMERIC,
    operating_revenue NUMERIC,
    financial_costs NUMERIC,
    subsidy_adjustment NUMERIC,
    inflation_adjustment NUMERIC,
    risk_weighted_assets NUMERIC,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_financial_snapshots_updated_at ON financial_snapshots(updated_at);
CREATE INDEX idx_financial_snapshots_snapshot_date ON financial_snapshots(snapshot_date);
CREATE INDEX idx_financial_snapshots_deleted_at ON financial_snapshots(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE financial_snapshots ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 12. REMITTANCES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS remittances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    remittance_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'deposited')),
    approved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_remittances_updated_at ON remittances(updated_at);
CREATE INDEX idx_remittances_collector_id ON remittances(collector_id);
CREATE INDEX idx_remittances_status ON remittances(status);
CREATE INDEX idx_remittances_remittance_date ON remittances(remittance_date);
CREATE INDEX idx_remittances_deleted_at ON remittances(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE remittances ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- TIMESTAMP UPDATE TRIGGER
-- ================================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER update_user_profiles_timestamp BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_borrowers_timestamp BEFORE UPDATE ON borrowers FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_loans_timestamp BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_payment_schedules_timestamp BEFORE UPDATE ON payment_schedules FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_payments_timestamp BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_expenses_timestamp BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_cash_transactions_timestamp BEFORE UPDATE ON cash_transactions FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_bank_accounts_timestamp BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_bank_transactions_timestamp BEFORE UPDATE ON bank_transactions FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_collection_logs_timestamp BEFORE UPDATE ON collection_logs FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_financial_snapshots_timestamp BEFORE UPDATE ON financial_snapshots FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_remittances_timestamp BEFORE UPDATE ON remittances FOR EACH ROW EXECUTE FUNCTION update_timestamp();
