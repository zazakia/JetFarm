-- Migration: 20260911030000_agribusiness_outgrower_platform.sql
-- Description: Agribusiness Investment & Outgrower Management Platform (JetFarm) schema

-- 1. Parcels
CREATE TABLE IF NOT EXISTS public.agri_parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT,
    land_owner_id UUID NOT NULL,
    area_hectares NUMERIC NOT NULL DEFAULT 0,
    location_address TEXT,
    gps_coordinates TEXT,
    soil_type TEXT,
    status TEXT NOT NULL DEFAULT 'available',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. Land Owners
CREATE TABLE IF NOT EXISTS public.agri_land_owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    name TEXT NOT NULL,
    contact_number TEXT,
    bank_name TEXT,
    account_number TEXT,
    default_per_kilo_rate NUMERIC NOT NULL DEFAULT 1.0,
    default_guaranteed_minimum NUMERIC NOT NULL DEFAULT 25000.0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 3. Investors
CREATE TABLE IF NOT EXISTS public.agri_investors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    contact_number TEXT,
    email TEXT,
    default_offtake_price_per_kg NUMERIC NOT NULL DEFAULT 4.0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 4. Crop Cycles
CREATE TABLE IF NOT EXISTS public.agri_crop_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_code TEXT NOT NULL,
    parcel_id UUID NOT NULL REFERENCES public.agri_parcels(id) ON DELETE CASCADE,
    investor_id UUID REFERENCES public.agri_investors(id) ON DELETE SET NULL,
    crop_type TEXT NOT NULL DEFAULT 'Cassava',
    variety TEXT,
    planting_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    target_harvest_date TIMESTAMPTZ,
    actual_harvest_date TIMESTAMPTZ,
    area_planted_ha NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planning',
    expected_yield_kg NUMERIC NOT NULL DEFAULT 0,
    total_actual_yield_kg NUMERIC NOT NULL DEFAULT 0,
    capital_allocated NUMERIC NOT NULL DEFAULT 0,
    land_owner_rate_per_kg NUMERIC NOT NULL DEFAULT 1.0,
    land_owner_guaranteed_min NUMERIC NOT NULL DEFAULT 25000.0,
    offtake_price_per_kg NUMERIC NOT NULL DEFAULT 4.0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 5. Growth Checkins
CREATE TABLE IF NOT EXISTS public.agri_growth_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_cycle_id UUID NOT NULL REFERENCES public.agri_crop_cycles(id) ON DELETE CASCADE,
    checkin_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stage TEXT NOT NULL,
    plant_height_cm NUMERIC,
    health_status TEXT NOT NULL DEFAULT 'good',
    notes TEXT,
    photo_uri TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 6. Harvest Logs
CREATE TABLE IF NOT EXISTS public.agri_harvest_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_cycle_id UUID NOT NULL REFERENCES public.agri_crop_cycles(id) ON DELETE CASCADE,
    parcel_id UUID NOT NULL REFERENCES public.agri_parcels(id) ON DELETE CASCADE,
    harvest_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    batch_number TEXT NOT NULL,
    gross_weight_kg NUMERIC NOT NULL DEFAULT 0,
    tare_weight_kg NUMERIC NOT NULL DEFAULT 0,
    net_weight_kg NUMERIC NOT NULL DEFAULT 0,
    quality_grade TEXT,
    truck_plate_number TEXT,
    weigh_in_supervisor TEXT,
    photo_uri TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 7. Farm Expenses
CREATE TABLE IF NOT EXISTS public.agri_farm_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_cycle_id UUID REFERENCES public.agri_crop_cycles(id) ON DELETE CASCADE,
    parcel_id UUID REFERENCES public.agri_parcels(id) ON DELETE SET NULL,
    expense_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    paid_by TEXT NOT NULL DEFAULT 'jet',
    receipt_photo_uri TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 8. Farm Workers
CREATE TABLE IF NOT EXISTS public.agri_farm_workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_number TEXT,
    specialization TEXT,
    daily_rate NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 9. Labor Logs
CREATE TABLE IF NOT EXISTS public.agri_labor_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES public.agri_farm_workers(id) ON DELETE CASCADE,
    crop_cycle_id UUID REFERENCES public.agri_crop_cycles(id) ON DELETE SET NULL,
    work_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    task TEXT NOT NULL,
    rate_type TEXT NOT NULL DEFAULT 'daily',
    units_completed NUMERIC NOT NULL DEFAULT 1,
    rate_per_unit NUMERIC NOT NULL DEFAULT 0,
    total_pay NUMERIC NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 10. Weekly Settlements
CREATE TABLE IF NOT EXISTS public.agri_weekly_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_cycle_id UUID NOT NULL REFERENCES public.agri_crop_cycles(id) ON DELETE CASCADE,
    land_owner_id UUID NOT NULL REFERENCES public.agri_land_owners(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    week_start_date TIMESTAMPTZ NOT NULL,
    week_end_date TIMESTAMPTZ NOT NULL,
    cumulative_kilos NUMERIC NOT NULL DEFAULT 0,
    rate_per_kilo NUMERIC NOT NULL DEFAULT 1.0,
    raw_kilo_earnings NUMERIC NOT NULL DEFAULT 0,
    guaranteed_minimum NUMERIC NOT NULL DEFAULT 25000.0,
    target_cumulative_payout NUMERIC NOT NULL DEFAULT 25000.0,
    previous_cumulative_payout NUMERIC NOT NULL DEFAULT 0,
    net_payout_due_this_week NUMERIC NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'draft',
    disbursement_date TIMESTAMPTZ,
    receipt_reference TEXT,
    calculation_breakdown_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 11. Investor Ledgers
CREATE TABLE IF NOT EXISTS public.agri_investor_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES public.agri_investors(id) ON DELETE CASCADE,
    crop_cycle_id UUID REFERENCES public.agri_crop_cycles(id) ON DELETE SET NULL,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type TEXT NOT NULL,
    kilos_received NUMERIC,
    price_per_kilo NUMERIC,
    amount NUMERIC NOT NULL DEFAULT 0,
    balance_running NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agri_parcels_land_owner ON public.agri_parcels(land_owner_id);
CREATE INDEX IF NOT EXISTS idx_agri_crop_cycles_parcel ON public.agri_crop_cycles(parcel_id);
CREATE INDEX IF NOT EXISTS idx_agri_crop_cycles_investor ON public.agri_crop_cycles(investor_id);
CREATE INDEX IF NOT EXISTS idx_agri_harvest_logs_cycle ON public.agri_harvest_logs(crop_cycle_id);
CREATE INDEX IF NOT EXISTS idx_agri_harvest_logs_date ON public.agri_harvest_logs(harvest_date);
CREATE INDEX IF NOT EXISTS idx_agri_weekly_settlements_cycle ON public.agri_weekly_settlements(crop_cycle_id);
CREATE INDEX IF NOT EXISTS idx_agri_weekly_settlements_owner ON public.agri_weekly_settlements(land_owner_id);
CREATE INDEX IF NOT EXISTS idx_agri_investor_ledgers_investor ON public.agri_investor_ledgers(investor_id);

-- RLS
ALTER TABLE public.agri_parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agri_land_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agri_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agri_crop_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agri_growth_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agri_harvest_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agri_farm_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agri_farm_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agri_labor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agri_weekly_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agri_investor_ledgers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read/write on agri_parcels" ON public.agri_parcels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read/write on agri_land_owners" ON public.agri_land_owners FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read/write on agri_investors" ON public.agri_investors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read/write on agri_crop_cycles" ON public.agri_crop_cycles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read/write on agri_growth_checkins" ON public.agri_growth_checkins FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read/write on agri_harvest_logs" ON public.agri_harvest_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read/write on agri_farm_expenses" ON public.agri_farm_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read/write on agri_farm_workers" ON public.agri_farm_workers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read/write on agri_labor_logs" ON public.agri_labor_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read/write on agri_weekly_settlements" ON public.agri_weekly_settlements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read/write on agri_investor_ledgers" ON public.agri_investor_ledgers FOR ALL TO authenticated USING (true) WITH CHECK (true);
