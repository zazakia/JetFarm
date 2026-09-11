-- Migration: 20260910000000_crispyking_enterprise_accounting_hardening.sql
-- Description: Harden accounting for Crispy King / Viterbo Foods OPC
--   1. Add journal_type to journal_entries for BIR 8 Books classification
--   2. Create balanced-journal enforcement trigger (debits MUST equal credits)
--   3. Create BIR 8 Books of Accounts database views
--   4. Create sync_conflict_log table
--   5. Create franchise_royalty_splits view

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. ADD JOURNAL_TYPE TO JOURNAL_ENTRIES
--    Maps each entry to one of the BIR 8 Books of Accounts
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'journal_entries'
          AND column_name = 'journal_type'
    ) THEN
        ALTER TABLE public.journal_entries
            ADD COLUMN journal_type TEXT DEFAULT 'general'
            CHECK (journal_type IN (
                'general',              -- General Journal
                'sales',                -- Sales Journal
                'purchase',             -- Purchase Journal
                'cash_receipt',         -- Cash Receipts Journal
                'cash_disbursement',    -- Cash Disbursement Journal
                'inventory',            -- Inventory Journal
                'payroll'               -- Payroll (maps to General Journal for BIR)
            ));
    END IF;
END $$;

-- Add branch_id to journal_entries for multi-branch filtering
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'journal_entries'
          AND column_name = 'branch_id'
    ) THEN
        ALTER TABLE public.journal_entries ADD COLUMN branch_id TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_journal_entries_journal_type
    ON public.journal_entries (journal_type);

CREATE INDEX IF NOT EXISTS idx_journal_entries_branch_id
    ON public.journal_entries (branch_id)
    WHERE branch_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. BALANCED JOURNAL ENFORCEMENT TRIGGER
--    The nuclear safeguard: PostgreSQL itself REJECTS any journal entry
--    where total debits ≠ total credits. Even buggy application code
--    cannot create unbalanced books.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_balanced_journal()
RETURNS TRIGGER AS $$
DECLARE
    v_total_debits  NUMERIC(15,2);
    v_total_credits NUMERIC(15,2);
    v_line_count    INTEGER;
BEGIN
    -- Only enforce when transitioning to posted state
    IF NEW.is_posted = TRUE AND (OLD.is_posted IS NULL OR OLD.is_posted = FALSE) THEN

        SELECT COALESCE(SUM(debit_amount), 0),
               COALESCE(SUM(credit_amount), 0),
               COUNT(*)
        INTO v_total_debits, v_total_credits, v_line_count
        FROM public.journal_entry_lines
        WHERE journal_entry_id = NEW.id
          AND deleted_at IS NULL;

        -- Must have at least 2 lines (one debit, one credit)
        IF v_line_count < 2 THEN
            RAISE EXCEPTION
                'Journal % cannot be posted: requires at least 2 lines (has %)',
                NEW.reference_number, v_line_count;
        END IF;

        -- DEBITS MUST EQUAL CREDITS — NO EXCEPTIONS
        IF v_total_debits != v_total_credits THEN
            RAISE EXCEPTION
                'Journal % REJECTED: debits (%.2f) ≠ credits (%.2f). Difference: %.2f',
                NEW.reference_number,
                v_total_debits,
                v_total_credits,
                ABS(v_total_debits - v_total_credits);
        END IF;

        -- Stamp the verified totals on the header
        NEW.total_debit := v_total_debits;
        NEW.total_credit := v_total_credits;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate to ensure latest version
DROP TRIGGER IF EXISTS trg_enforce_balanced_journal ON public.journal_entries;

CREATE TRIGGER trg_enforce_balanced_journal
    BEFORE UPDATE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_balanced_journal();

-- Also enforce on INSERT if is_posted = true from the start
DROP TRIGGER IF EXISTS trg_enforce_balanced_journal_insert ON public.journal_entries;

CREATE TRIGGER trg_enforce_balanced_journal_insert
    BEFORE INSERT ON public.journal_entries
    FOR EACH ROW
    WHEN (NEW.is_posted = TRUE)
    EXECUTE FUNCTION public.enforce_balanced_journal();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. BIR 8 BOOKS OF ACCOUNTS — DATABASE VIEWS
--    Each view filters journal_entries + journal_entry_lines to produce
--    the format required by the Philippine Bureau of Internal Revenue.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 3a. GENERAL JOURNAL
CREATE OR REPLACE VIEW public.vw_bir_general_journal AS
SELECT
    je.entry_date                   AS "Date",
    jel.account_name                AS "Particulars",
    je.reference_number             AS "Ref No.",
    jel.debit_amount                AS "Debit",
    jel.credit_amount               AS "Credit",
    je.description                  AS "Description",
    je.branch_id                    AS "Branch"
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.is_posted = TRUE
  AND je.deleted_at IS NULL
  AND jel.deleted_at IS NULL
  AND je.journal_type = 'general'
ORDER BY je.entry_date, je.reference_number, jel.debit_amount DESC;

-- 3b. SALES JOURNAL
CREATE OR REPLACE VIEW public.vw_bir_sales_journal AS
SELECT
    je.entry_date                   AS "Date",
    je.description                  AS "Particulars",
    je.reference_number             AS "STR#/DR#",
    jel.credit_amount               AS "Amount",
    je.branch_id                    AS "Branch"
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN public.chart_of_accounts coa ON coa.code = jel.account_code
WHERE je.is_posted = TRUE
  AND je.deleted_at IS NULL
  AND jel.deleted_at IS NULL
  AND je.journal_type = 'sales'
  AND coa.account_type = 'income'
ORDER BY je.entry_date, je.reference_number;

-- 3c. PURCHASE JOURNAL
CREATE OR REPLACE VIEW public.vw_bir_purchase_journal AS
SELECT
    je.entry_date                   AS "Date",
    je.description                  AS "Supplier / Particulars",
    je.reference_number             AS "Invoice No.",
    jel.debit_amount                AS "Amount",
    je.branch_id                    AS "Branch"
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN public.chart_of_accounts coa ON coa.code = jel.account_code
WHERE je.is_posted = TRUE
  AND je.deleted_at IS NULL
  AND jel.deleted_at IS NULL
  AND je.journal_type = 'purchase'
  AND coa.account_type = 'expense'
ORDER BY je.entry_date, je.reference_number;

-- 3d. CASH RECEIPTS JOURNAL
CREATE OR REPLACE VIEW public.vw_bir_cash_receipts_journal AS
SELECT
    je.entry_date                   AS "Date",
    je.description                  AS "Particulars",
    je.reference_number             AS "Deposit Slip / Ref",
    jel.debit_amount                AS "Amount",
    je.branch_id                    AS "Branch"
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN public.chart_of_accounts coa ON coa.code = jel.account_code
WHERE je.is_posted = TRUE
  AND je.deleted_at IS NULL
  AND jel.deleted_at IS NULL
  AND je.journal_type = 'cash_receipt'
  AND coa.code IN ('1010', '1020') -- Cash on Hand, Cash in Bank
ORDER BY je.entry_date, je.reference_number;

-- 3e. CASH DISBURSEMENT JOURNAL
CREATE OR REPLACE VIEW public.vw_bir_cash_disbursement_journal AS
SELECT
    je.entry_date                   AS "Date",
    je.description                  AS "Particulars",
    je.reference_number             AS "SI/OR Number",
    jel.credit_amount               AS "Amount",
    jel.account_name                AS "Expense Category",
    je.branch_id                    AS "Branch"
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN public.chart_of_accounts coa ON coa.code = jel.account_code
WHERE je.is_posted = TRUE
  AND je.deleted_at IS NULL
  AND jel.deleted_at IS NULL
  AND je.journal_type = 'cash_disbursement'
  AND coa.code IN ('1010', '1020') -- Cash outflows
ORDER BY je.entry_date, je.reference_number;

-- 3f. ACCOUNTS RECEIVABLE LEDGER (derived from AR-affecting entries)
CREATE OR REPLACE VIEW public.vw_bir_accounts_receivable AS
SELECT
    je.entry_date                   AS "Date",
    je.description                  AS "Particulars",
    je.reference_number             AS "STR#/DR#",
    jel.debit_amount                AS "Debit",
    jel.credit_amount               AS "Credit",
    je.branch_id                    AS "Branch"
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.is_posted = TRUE
  AND je.deleted_at IS NULL
  AND jel.deleted_at IS NULL
  AND jel.account_code = '1100' -- Accounts Receivable
ORDER BY je.branch_id, je.entry_date;

-- 3g. ACCOUNTS PAYABLE LEDGER (derived from AP-affecting entries)
CREATE OR REPLACE VIEW public.vw_bir_accounts_payable AS
SELECT
    je.entry_date                   AS "Date",
    je.description                  AS "Particulars",
    je.reference_number             AS "STR#/DR#",
    jel.debit_amount                AS "Debit",
    jel.credit_amount               AS "Credit",
    je.branch_id                    AS "Branch"
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.is_posted = TRUE
  AND je.deleted_at IS NULL
  AND jel.deleted_at IS NULL
  AND jel.account_code = '2010' -- Accounts Payable
ORDER BY je.branch_id, je.entry_date;

-- 3h. INVENTORY JOURNAL
CREATE OR REPLACE VIEW public.vw_bir_inventory_journal AS
SELECT
    je.entry_date                   AS "Date",
    je.description                  AS "Particulars",
    je.reference_number             AS "Ref",
    jel.debit_amount                AS "Debit",
    jel.credit_amount               AS "Credit",
    jel.account_name                AS "Inventory Account",
    je.branch_id                    AS "Branch"
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN public.chart_of_accounts coa ON coa.code = jel.account_code
WHERE je.is_posted = TRUE
  AND je.deleted_at IS NULL
  AND jel.deleted_at IS NULL
  AND je.journal_type = 'inventory'
ORDER BY je.entry_date, je.reference_number;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. SYNC CONFLICT LOG
--    Every overwritten value during WatermelonDB sync is permanently logged.
--    No silent data loss — every conflict is auditable.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sync_conflict_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name      TEXT NOT NULL,
    record_id       TEXT NOT NULL,
    field_name      TEXT NOT NULL,
    device_a_value  TEXT,
    device_b_value  TEXT,
    winning_value   TEXT NOT NULL,
    resolution      TEXT NOT NULL DEFAULT 'last_write_wins',
    branch_id       TEXT,
    device_id       TEXT,
    resolved_at     TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_conflict_log_table
    ON public.sync_conflict_log (table_name);

CREATE INDEX IF NOT EXISTS idx_sync_conflict_log_branch
    ON public.sync_conflict_log (branch_id)
    WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sync_conflict_log_resolved_at
    ON public.sync_conflict_log (resolved_at);

ALTER TABLE public.sync_conflict_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_conflict_log_read" ON public.sync_conflict_log
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "sync_conflict_log_insert" ON public.sync_conflict_log
    FOR INSERT TO authenticated WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. FRANCHISE ROYALTY SPLIT VIEW
--    Auto-computes 80% operator / 20% franchisor split from posted journals
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.vw_franchise_royalty_summary AS
WITH monthly_pnl AS (
    SELECT
        je.branch_id,
        je.fiscal_year,
        je.fiscal_month,
        SUM(CASE WHEN coa.account_type = 'income'
            THEN jel.credit_amount - jel.debit_amount ELSE 0 END) AS gross_sales,
        SUM(CASE WHEN coa.code LIKE '5%'
            THEN jel.debit_amount - jel.credit_amount ELSE 0 END) AS cogs,
        SUM(CASE WHEN coa.code LIKE '6%'
            THEN jel.debit_amount - jel.credit_amount ELSE 0 END) AS opex
    FROM public.journal_entries je
    JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
    JOIN public.chart_of_accounts coa ON coa.code = jel.account_code
    WHERE je.is_posted = TRUE
      AND je.deleted_at IS NULL
      AND jel.deleted_at IS NULL
    GROUP BY je.branch_id, je.fiscal_year, je.fiscal_month
)
SELECT
    branch_id                               AS "Branch",
    fiscal_year                             AS "Year",
    fiscal_month                            AS "Month",
    gross_sales                             AS "Gross Sales",
    cogs                                    AS "COGS",
    gross_sales - cogs                      AS "Gross Profit",
    opex                                    AS "OPEX",
    gross_sales - cogs - opex               AS "Net Income",
    (gross_sales - cogs - opex) * 0.80      AS "80% Operator Share",
    (gross_sales - cogs - opex) * 0.20      AS "20% Franchisor Royalty"
FROM monthly_pnl
ORDER BY fiscal_year DESC, fiscal_month DESC, gross_sales DESC;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. INCOME STATEMENT VIEW (per branch, per month)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.vw_income_statement AS
SELECT
    je.branch_id,
    je.fiscal_year,
    je.fiscal_month,
    coa.code                                    AS account_code,
    coa.name                                    AS account_name,
    coa.account_type,
    SUM(jel.debit_amount)                       AS total_debit,
    SUM(jel.credit_amount)                      AS total_credit,
    CASE
        WHEN coa.account_type = 'income'
            THEN SUM(jel.credit_amount) - SUM(jel.debit_amount)
        WHEN coa.account_type = 'expense'
            THEN SUM(jel.debit_amount) - SUM(jel.credit_amount)
        ELSE 0
    END                                         AS net_amount
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN public.chart_of_accounts coa ON coa.code = jel.account_code
WHERE je.is_posted = TRUE
  AND je.deleted_at IS NULL
  AND jel.deleted_at IS NULL
  AND coa.account_type IN ('income', 'expense')
GROUP BY je.branch_id, je.fiscal_year, je.fiscal_month,
         coa.code, coa.name, coa.account_type
ORDER BY je.fiscal_year, je.fiscal_month, coa.code;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. TRIAL BALANCE VIEW
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.vw_trial_balance AS
SELECT
    je.fiscal_year,
    je.fiscal_month,
    coa.code                                    AS account_code,
    coa.name                                    AS account_name,
    coa.account_type,
    coa.normal_balance,
    SUM(jel.debit_amount)                       AS total_debit,
    SUM(jel.credit_amount)                      AS total_credit,
    SUM(jel.debit_amount) - SUM(jel.credit_amount) AS balance
FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN public.chart_of_accounts coa ON coa.code = jel.account_code
WHERE je.is_posted = TRUE
  AND je.deleted_at IS NULL
  AND jel.deleted_at IS NULL
GROUP BY je.fiscal_year, je.fiscal_month,
         coa.code, coa.name, coa.account_type, coa.normal_balance
ORDER BY coa.code;

COMMIT;
