-- Migration: 20260911020000_enterprise_pos_sessions_and_cash_controls.sql
-- Description: POS Sessions (Blind Shift Closing, Cash Drawers) and Branch Cash Controls

-- 1. Create pos_sessions table
CREATE TABLE IF NOT EXISTS public.pos_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    cashier_id TEXT NOT NULL,
    terminal_id TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opening_float NUMERIC NOT NULL DEFAULT 0,
    closing_cash_expected NUMERIC,
    closing_cash_actual NUMERIC,
    variance_amount NUMERIC,
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed', 'audited'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pos_sessions_branch ON public.pos_sessions(branch_id);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_cashier ON public.pos_sessions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_status ON public.pos_sessions(status);

-- 2. Add branch_id and pos_session_id to app_cash_transactions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_cash_transactions') THEN
        ALTER TABLE public.app_cash_transactions
        ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id),
        ADD COLUMN IF NOT EXISTS pos_session_id UUID REFERENCES public.pos_sessions(id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_transactions') THEN
        ALTER TABLE public.cash_transactions
        ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id),
        ADD COLUMN IF NOT EXISTS pos_session_id UUID REFERENCES public.pos_sessions(id);
    END IF;
END $$;

-- 3. Enable RLS on pos_sessions
ALTER TABLE public.pos_sessions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy for pos_sessions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'pos_sessions' AND policyname = 'authenticated_pos_sessions_access'
    ) THEN
        CREATE POLICY authenticated_pos_sessions_access ON public.pos_sessions
            FOR ALL TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
