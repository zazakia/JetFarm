-- Migration: MPCO Framework Foundation
-- Date: 2026-07-09

-- ─── Alter Journal Entry Lines ───────────────────────────────────────────────
ALTER TABLE public.journal_entry_lines
    ADD COLUMN IF NOT EXISTS business_unit_id TEXT,
    ADD COLUMN IF NOT EXISTS module_source_table TEXT,
    ADD COLUMN IF NOT EXISTS module_source_id TEXT;

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_business_unit_id
    ON public.journal_entry_lines (business_unit_id)
    WHERE business_unit_id IS NOT NULL;

-- ─── Business Units ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_units (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL,
    module_id           TEXT NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE,
    description         TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_units_slug
    ON public.business_units (slug)
    WHERE deleted_at IS NULL;

-- ─── Module Transactions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.module_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id           TEXT NOT NULL,
    business_unit_id    TEXT NOT NULL,
    source_table        TEXT NOT NULL,
    source_id           TEXT NOT NULL,
    amount              NUMERIC(15,2) NOT NULL DEFAULT 0,
    transaction_type    TEXT NOT NULL,
    posted_at           TIMESTAMPTZ NOT NULL,
    fiscal_year         INTEGER,
    fiscal_month        INTEGER,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_module_transactions_module_id
    ON public.module_transactions (module_id);

CREATE INDEX IF NOT EXISTS idx_module_transactions_business_unit_id
    ON public.module_transactions (business_unit_id);

CREATE INDEX IF NOT EXISTS idx_module_transactions_source_id
    ON public.module_transactions (source_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_units_read" ON public.business_units
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "business_units_write" ON public.business_units
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()::text
            AND role = 'admin'
        )
    );

CREATE POLICY "module_transactions_read" ON public.module_transactions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "module_transactions_write" ON public.module_transactions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()::text
            AND role IN ('admin', 'loan-encoder', 'payment-encoder', 'expenses-encoder')
        )
    );

-- ─── Updated At Triggers ─────────────────────────────────────────────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_units_updated_at') THEN
        CREATE TRIGGER trg_business_units_updated_at
            BEFORE UPDATE ON public.business_units
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_module_transactions_updated_at') THEN
        CREATE TRIGGER trg_module_transactions_updated_at
            BEFORE UPDATE ON public.module_transactions
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;
