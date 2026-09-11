-- Migration: Add Financial Period Settings and Statutory Fund Allocations Tables
-- Date: 2026-07-06

-- ─── Statutory Fund Allocations ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.statutory_fund_allocations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year         INTEGER NOT NULL,
    fiscal_month        INTEGER,
    fund_type           TEXT NOT NULL,
    amount              NUMERIC(15,2) NOT NULL,
    percentage          NUMERIC(5,2) NOT NULL,
    notes               TEXT,
    performed_by        TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_statutory_fund_allocations_year
    ON public.statutory_fund_allocations (fiscal_year);

-- ─── Financial Period Settings ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.financial_period_settings (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year                 INTEGER NOT NULL,
    authorized_share_capital    NUMERIC(15,2) NOT NULL DEFAULT 0,
    subscribed_capital          NUMERIC(15,2) NOT NULL DEFAULT 0,
    subscription_receivable     NUMERIC(15,2) NOT NULL DEFAULT 0,
    sundry_assets               NUMERIC(15,2) NOT NULL DEFAULT 0,
    prior_year_data             TEXT NOT NULL, -- JSON string containing comparative prior-year values
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_period_settings_year
    ON public.financial_period_settings (fiscal_year)
    WHERE deleted_at IS NULL;

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.statutory_fund_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_period_settings ENABLE ROW LEVEL SECURITY;

-- statutory_fund_allocations policies
CREATE POLICY "statutory_fund_allocations_read" ON public.statutory_fund_allocations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "statutory_fund_allocations_write" ON public.statutory_fund_allocations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()::text
            AND role IN ('admin', 'loan-encoder')
        )
    );

-- financial_period_settings policies
CREATE POLICY "financial_period_settings_read" ON public.financial_period_settings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "financial_period_settings_write" ON public.financial_period_settings
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()::text
            AND role IN ('admin', 'loan-encoder')
        )
    );

-- ─── Updated At Triggers ─────────────────────────────────────────────────────

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_statutory_fund_allocations_updated_at') THEN
        CREATE TRIGGER trg_statutory_fund_allocations_updated_at
            BEFORE UPDATE ON public.statutory_fund_allocations
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_financial_period_settings_updated_at') THEN
        CREATE TRIGGER trg_financial_period_settings_updated_at
            BEFORE UPDATE ON public.financial_period_settings
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;
