-- Migration: 20260910_crispy_king_core.sql
-- Description: Core schema for Crispy King Enterprise System:
-- Commissary Dispatches, Waste Logs, Royalty Calculations, Production Batches, and Business Unit Area Scoping.

-- 1. Update business_units table with area scoping columns
ALTER TABLE public.business_units
    ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.app_areas(id),
    ADD COLUMN IF NOT EXISTS area_supervisor_id TEXT REFERENCES public.user_profiles(id),
    ADD COLUMN IF NOT EXISTS area_name TEXT;

CREATE INDEX IF NOT EXISTS idx_business_units_area_id
    ON public.business_units (area_id)
    WHERE area_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_units_area_supervisor_id
    ON public.business_units (area_supervisor_id)
    WHERE area_supervisor_id IS NOT NULL;

-- 2. Commissary Dispatches Table
CREATE TABLE IF NOT EXISTS public.commissary_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_location TEXT NOT NULL DEFAULT 'Main Commissary',
    to_branch_id TEXT NOT NULL,
    dispatch_number TEXT NOT NULL,
    po_reference TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'dispatched', 'in_transit', 'received', 'verified', 'posted', 'disputed')),
    items_json TEXT NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    dispatched_by TEXT,
    dispatched_at TIMESTAMPTZ,
    received_by TEXT,
    received_at TIMESTAMPTZ,
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_commissary_dispatches_to_branch_id
    ON public.commissary_dispatches (to_branch_id);

CREATE INDEX IF NOT EXISTS idx_commissary_dispatches_dispatch_number
    ON public.commissary_dispatches (dispatch_number);

CREATE INDEX IF NOT EXISTS idx_commissary_dispatches_status
    ON public.commissary_dispatches (status);

ALTER TABLE public.commissary_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commissary_dispatches_read" ON public.commissary_dispatches
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "commissary_dispatches_write" ON public.commissary_dispatches
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.commissary_dispatches TO authenticated, service_role;

-- 3. Waste Logs Table (Spoilage, Bad Orders, Overcooked, Returns)
CREATE TABLE IF NOT EXISTS public.waste_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
    uom TEXT NOT NULL DEFAULT 'pcs',
    reason TEXT NOT NULL CHECK (reason IN ('spoilage', 'damage', 'expired', 'bad_order', 'overcooked', 'customer_return')),
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    recorded_by TEXT,
    notes TEXT,
    photo_uri TEXT,
    status TEXT NOT NULL DEFAULT 'recorded',
    log_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    journal_entry_id TEXT,
    stock_movement_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_waste_logs_branch_id
    ON public.waste_logs (branch_id);

CREATE INDEX IF NOT EXISTS idx_waste_logs_product_id
    ON public.waste_logs (product_id);

CREATE INDEX IF NOT EXISTS idx_waste_logs_log_date
    ON public.waste_logs (log_date);

CREATE INDEX IF NOT EXISTS idx_waste_logs_reason
    ON public.waste_logs (reason);

ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waste_logs_read" ON public.waste_logs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "waste_logs_write" ON public.waste_logs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.waste_logs TO authenticated, service_role;

-- 4. Royalty Calculations Table (80/20 Operator/Franchisor Split)
CREATE TABLE IF NOT EXISTS public.royalty_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id TEXT NOT NULL,
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL,
    gross_sales NUMERIC(12,2) NOT NULL DEFAULT 0,
    cogs NUMERIC(12,2) NOT NULL DEFAULT 0,
    cogs_ratio NUMERIC(6,4) NOT NULL DEFAULT 0,
    gross_profit NUMERIC(12,2) NOT NULL DEFAULT 0,
    opex NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_income NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_margin NUMERIC(6,4) NOT NULL DEFAULT 0,
    operator_share NUMERIC(12,2) NOT NULL DEFAULT 0,
    franchisor_share NUMERIC(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'remitted')),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    ap_voucher_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_royalty_calculations_branch_period
    ON public.royalty_calculations (branch_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_royalty_calculations_status
    ON public.royalty_calculations (status);

ALTER TABLE public.royalty_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "royalty_calculations_read" ON public.royalty_calculations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "royalty_calculations_write" ON public.royalty_calculations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.royalty_calculations TO authenticated, service_role;

-- 5. Production Batches Table (Commissary Chicken Yield / BOM)
CREATE TABLE IF NOT EXISTS public.production_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number TEXT NOT NULL,
    batch_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    nmis_number TEXT,
    raw_product_id TEXT,
    raw_quantity_heads INTEGER NOT NULL DEFAULT 0,
    raw_weight_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
    price_per_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_raw_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    yield_items_json TEXT,
    total_yield_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
    yield_percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
    waste_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
    waste_percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_production_batches_batch_number
    ON public.production_batches (batch_number);

CREATE INDEX IF NOT EXISTS idx_production_batches_batch_date
    ON public.production_batches (batch_date);

ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_batches_read" ON public.production_batches
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "production_batches_write" ON public.production_batches
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.production_batches TO authenticated, service_role;
