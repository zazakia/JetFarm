-- Migration: Add Accounting System Tables
-- Chart of Accounts, Journal Entries, Journal Entry Lines
-- Date: 2026-07-05

-- ─── Chart of Accounts ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                TEXT NOT NULL,
    name                TEXT NOT NULL,
    account_type        TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
    normal_balance      TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
    parent_code         TEXT,
    is_header           BOOLEAN DEFAULT FALSE,
    is_active           BOOLEAN DEFAULT TRUE,
    description         TEXT,
    sort_order          NUMERIC,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chart_of_accounts_code
    ON public.chart_of_accounts (code)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_account_type
    ON public.chart_of_accounts (account_type);

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent_code
    ON public.chart_of_accounts (parent_code);

-- ─── Journal Entries ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date          TIMESTAMPTZ NOT NULL,
    reference_number    TEXT NOT NULL,
    description         TEXT NOT NULL,
    entry_type          TEXT NOT NULL CHECK (entry_type IN ('auto', 'manual', 'adjusting', 'closing', 'reversing')),
    source_table        TEXT,
    source_id           UUID,
    posted_by           TEXT,
    is_posted           BOOLEAN DEFAULT FALSE,
    total_debit         NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_credit        NUMERIC(15,2) NOT NULL DEFAULT 0,
    fiscal_year         INTEGER,
    fiscal_month        INTEGER,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_reference_number
    ON public.journal_entries (reference_number)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_date
    ON public.journal_entries (entry_date);

CREATE INDEX IF NOT EXISTS idx_journal_entries_source_id
    ON public.journal_entries (source_id)
    WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_journal_entries_fiscal
    ON public.journal_entries (fiscal_year, fiscal_month);

-- ─── Journal Entry Lines ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id    UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_code        TEXT NOT NULL,
    account_name        TEXT,
    debit_amount        NUMERIC(15,2) DEFAULT 0,
    credit_amount       NUMERIC(15,2) DEFAULT 0,
    description         TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry_id
    ON public.journal_entry_lines (journal_entry_id);

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_code
    ON public.journal_entry_lines (account_code);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- chart_of_accounts: all authenticated users can read; only admin/encoder can write
CREATE POLICY "chart_of_accounts_read" ON public.chart_of_accounts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "chart_of_accounts_write" ON public.chart_of_accounts
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()::text
            AND role IN ('admin', 'loan-encoder')
        )
    );

-- journal_entries: all authenticated users can read; admin writes
CREATE POLICY "journal_entries_read" ON public.journal_entries
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "journal_entries_write" ON public.journal_entries
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()::text
            AND role IN ('admin', 'loan-encoder', 'payment-encoder', 'expenses-encoder')
        )
    );

-- journal_entry_lines: all authenticated users can read; admin writes
CREATE POLICY "journal_entry_lines_read" ON public.journal_entry_lines
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "journal_entry_lines_write" ON public.journal_entry_lines
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()::text
            AND role IN ('admin', 'loan-encoder', 'payment-encoder', 'expenses-encoder')
        )
    );

-- ─── Updated At Trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_chart_of_accounts_updated_at') THEN
        CREATE TRIGGER trg_chart_of_accounts_updated_at
            BEFORE UPDATE ON public.chart_of_accounts
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_journal_entries_updated_at') THEN
        CREATE TRIGGER trg_journal_entries_updated_at
            BEFORE UPDATE ON public.journal_entries
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_journal_entry_lines_updated_at') THEN
        CREATE TRIGGER trg_journal_entry_lines_updated_at
            BEFORE UPDATE ON public.journal_entry_lines
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;
