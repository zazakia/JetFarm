-- Migration: 20260911010000_enterprise_location_aware_inventory_and_returns.sql
-- Description: Location-Aware Inventory (branch_id, warehouse_id) and Persistent Sales Returns & Reverse Logistics

-- 1. Alter stock_movements to support multi-branch / multi-warehouse tracking
ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id),
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse ON public.stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch ON public.stock_movements(branch_id);

-- 2. Sales Returns Table
CREATE TABLE IF NOT EXISTS public.sales_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number TEXT NOT NULL UNIQUE,
    original_order_number TEXT,
    original_order_id UUID,
    customer_id UUID,
    customer_name TEXT,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES public.warehouses(id),
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'rejected', 'completed'
    reason TEXT NOT NULL,
    total_refund_amount NUMERIC NOT NULL DEFAULT 0,
    refund_method TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'credit', 'charge_invoice'
    created_by TEXT NOT NULL,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 3. Sales Return Lines Table
CREATE TABLE IF NOT EXISTS public.sales_return_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_return_id UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    product_name TEXT NOT NULL,
    sku TEXT,
    return_quantity NUMERIC NOT NULL DEFAULT 1,
    uom TEXT DEFAULT 'pc',
    uom_multiplier NUMERIC NOT NULL DEFAULT 1,
    base_quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    condition TEXT NOT NULL DEFAULT 'good', -- 'good', 'damaged', 'expired'
    restock_action TEXT NOT NULL DEFAULT 'restock_shelf', -- 'restock_shelf', 'waste_log'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sales_returns_branch ON public.sales_returns(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_status ON public.sales_returns(status);
CREATE INDEX IF NOT EXISTS idx_sales_return_lines_return ON public.sales_return_lines(sales_return_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_lines ENABLE ROW LEVEL SECURITY;

-- 5. Standard RLS Policies for Authenticated Sync
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'sales_returns' AND policyname = 'authenticated_sales_returns_access'
    ) THEN
        CREATE POLICY authenticated_sales_returns_access ON public.sales_returns
            FOR ALL TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'sales_return_lines' AND policyname = 'authenticated_sales_return_lines_access'
    ) THEN
        CREATE POLICY authenticated_sales_return_lines_access ON public.sales_return_lines
            FOR ALL TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
