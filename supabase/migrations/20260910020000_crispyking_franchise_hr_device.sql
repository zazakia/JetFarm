-- Migration: 20260910020000_crispyking_franchise_hr_device.sql
-- Description: P3 modules for Viterbo Foods OPC
--   - Franchise CRM (contracts, royalty ledger, store audits)
--   - Device registry with remote lock/wipe
--   - Employee leave tracking

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. FRANCHISE CONTRACT REGISTRY
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.franchise_contracts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       TEXT NOT NULL,
    branch_name     TEXT NOT NULL,
    owner_name      TEXT NOT NULL,
    owner_phone     TEXT,
    owner_email     TEXT,
    territory       TEXT,                           -- e.g. 'Negros Oriental'
    contract_start  DATE NOT NULL,
    contract_end    DATE,
    renewal_date    DATE,
    royalty_pct     NUMERIC(5,2) DEFAULT 20.00,     -- 20% default
    franchise_fee   NUMERIC(12,2) DEFAULT 0,        -- one-time franchise fee paid
    status          TEXT DEFAULT 'active' CHECK (status IN (
                        'active', 'suspended', 'terminated', 'expired', 'pending_renewal'
                    )),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_franchise_contracts_branch
    ON public.franchise_contracts (branch_id);

CREATE INDEX IF NOT EXISTS idx_franchise_contracts_status
    ON public.franchise_contracts (status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. STORE AUDIT / VISIT LOG
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.store_audits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       TEXT NOT NULL,
    audit_date      DATE NOT NULL,
    auditor_name    TEXT NOT NULL,                   -- supervisor name
    -- Scoring (1-5 scale)
    cleanliness_score   INTEGER CHECK (cleanliness_score BETWEEN 1 AND 5),
    food_quality_score  INTEGER CHECK (food_quality_score BETWEEN 1 AND 5),
    staff_compliance_score INTEGER CHECK (staff_compliance_score BETWEEN 1 AND 5),
    inventory_accuracy_score INTEGER CHECK (inventory_accuracy_score BETWEEN 1 AND 5),
    overall_score       NUMERIC(3,1),
    -- Findings
    findings        TEXT,
    action_items    TEXT,
    photo_urls      TEXT[],                         -- array of Supabase storage URLs
    status          TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'escalated')),
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_store_audits_branch
    ON public.store_audits (branch_id);

CREATE INDEX IF NOT EXISTS idx_store_audits_date
    ON public.store_audits (audit_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. DEVICE REGISTRY (Anti-Theft + Remote Lock/Wipe)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.device_registry (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       TEXT NOT NULL UNIQUE,            -- Android device ID
    branch_id       TEXT NOT NULL,
    device_name     TEXT,                            -- e.g. 'Samsung Tab A8 - Bagacay'
    device_model    TEXT,
    os_version      TEXT,
    app_version     TEXT,
    -- Security Controls
    is_locked       BOOLEAN DEFAULT FALSE,           -- TRUE = show lock screen on app open
    wipe_requested  BOOLEAN DEFAULT FALSE,           -- TRUE = clear local WatermelonDB on next sync
    wipe_completed_at TIMESTAMPTZ,
    -- Health Monitoring
    last_heartbeat  TIMESTAMPTZ,                     -- updated every 30 min by app
    last_sync_at    TIMESTAMPTZ,
    last_ip_address TEXT,
    -- Status
    is_active       BOOLEAN DEFAULT TRUE,
    registered_at   TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_registry_branch
    ON public.device_registry (branch_id);

CREATE INDEX IF NOT EXISTS idx_device_registry_heartbeat
    ON public.device_registry (last_heartbeat);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. EMPLOYEE LEAVE TRACKING
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.employee_leaves (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id     UUID NOT NULL REFERENCES public.employees(id),
    leave_type      TEXT NOT NULL CHECK (leave_type IN (
                        'vacation', 'sick', 'emergency', 'maternity', 'paternity', 'unpaid'
                    )),
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    days_count      NUMERIC(4,1) NOT NULL,
    reason          TEXT,
    status          TEXT DEFAULT 'pending' CHECK (status IN (
                        'pending', 'approved', 'rejected', 'cancelled'
                    )),
    approved_by     TEXT,
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_employee_leaves_employee
    ON public.employee_leaves (employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_leaves_dates
    ON public.employee_leaves (start_date, end_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. FRANCHISE ROYALTY LEDGER
--    Settlement tracking for monthly 80/20 splits
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.franchise_royalty_ledger (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     UUID REFERENCES public.franchise_contracts(id),
    branch_id       TEXT NOT NULL,
    fiscal_year     INTEGER NOT NULL,
    fiscal_month    INTEGER NOT NULL,
    gross_sales     NUMERIC(15,2) NOT NULL DEFAULT 0,
    cogs            NUMERIC(15,2) NOT NULL DEFAULT 0,
    opex            NUMERIC(15,2) NOT NULL DEFAULT 0,
    net_income      NUMERIC(15,2) NOT NULL DEFAULT 0,
    royalty_pct     NUMERIC(5,2) NOT NULL DEFAULT 20.00,
    royalty_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
    operator_share  NUMERIC(15,2) NOT NULL DEFAULT 0,
    settlement_status TEXT DEFAULT 'pending' CHECK (settlement_status IN (
                        'pending', 'invoiced', 'paid', 'overdue', 'disputed'
                    )),
    settled_at      TIMESTAMPTZ,
    settled_amount  NUMERIC(15,2),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uq_royalty_branch_period UNIQUE (branch_id, fiscal_year, fiscal_month)
);

CREATE INDEX IF NOT EXISTS idx_franchise_royalty_branch
    ON public.franchise_royalty_ledger (branch_id);

CREATE INDEX IF NOT EXISTS idx_franchise_royalty_period
    ON public.franchise_royalty_ledger (fiscal_year, fiscal_month);

CREATE INDEX IF NOT EXISTS idx_franchise_royalty_status
    ON public.franchise_royalty_ledger (settlement_status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.franchise_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franchise_royalty_ledger ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated
CREATE POLICY "franchise_contracts_read" ON public.franchise_contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "store_audits_read" ON public.store_audits FOR SELECT TO authenticated USING (true);
CREATE POLICY "device_registry_read" ON public.device_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "employee_leaves_read" ON public.employee_leaves FOR SELECT TO authenticated USING (true);
CREATE POLICY "franchise_royalty_read" ON public.franchise_royalty_ledger FOR SELECT TO authenticated USING (true);

-- Write access for admin
CREATE POLICY "franchise_contracts_write" ON public.franchise_contracts FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid()::text AND role = 'admin'));
CREATE POLICY "store_audits_write" ON public.store_audits FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid()::text AND role IN ('admin', 'collector')));
CREATE POLICY "device_registry_write" ON public.device_registry FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid()::text AND role = 'admin'));
CREATE POLICY "employee_leaves_write" ON public.employee_leaves FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid()::text AND role IN ('admin', 'loan-encoder')));
CREATE POLICY "franchise_royalty_write" ON public.franchise_royalty_ledger FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid()::text AND role = 'admin'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. UPDATED_AT TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_franchise_contracts_updated_at') THEN
        CREATE TRIGGER trg_franchise_contracts_updated_at
            BEFORE UPDATE ON public.franchise_contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_store_audits_updated_at') THEN
        CREATE TRIGGER trg_store_audits_updated_at
            BEFORE UPDATE ON public.store_audits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_device_registry_updated_at') THEN
        CREATE TRIGGER trg_device_registry_updated_at
            BEFORE UPDATE ON public.device_registry FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_employee_leaves_updated_at') THEN
        CREATE TRIGGER trg_employee_leaves_updated_at
            BEFORE UPDATE ON public.employee_leaves FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_franchise_royalty_updated_at') THEN
        CREATE TRIGGER trg_franchise_royalty_updated_at
            BEFORE UPDATE ON public.franchise_royalty_ledger FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

COMMIT;
