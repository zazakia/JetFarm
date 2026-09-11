-- Migration: 20260909000000_create_books_of_accounts_tables.sql
-- Description: Create suppliers, accounts_payable_vouchers, and stock_movements tables for Books of Accounts

CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    tin TEXT,
    payment_terms_days INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.accounts_payable_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    voucher_number TEXT NOT NULL UNIQUE,
    invoice_number TEXT,
    invoice_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    amount_paid NUMERIC NOT NULL DEFAULT 0,
    balance NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    expense_account_code TEXT,
    module_id TEXT,
    posted_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    product_source TEXT NOT NULL,
    module_id TEXT NOT NULL,
    movement_type TEXT NOT NULL,
    quantity_in NUMERIC,
    quantity_out NUMERIC,
    quantity_balance NUMERIC NOT NULL DEFAULT 0,
    unit_cost NUMERIC,
    total_cost NUMERIC,
    reference_number TEXT,
    source_table TEXT,
    source_id UUID,
    journal_entry_id UUID,
    movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    performed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ap_vouchers_supplier_id ON public.accounts_payable_vouchers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ap_vouchers_status ON public.accounts_payable_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_module ON public.stock_movements(module_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON public.stock_movements(movement_date);

-- RLS Policies
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated all on suppliers" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read on ap vouchers" ON public.accounts_payable_vouchers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated all on ap vouchers" ON public.accounts_payable_vouchers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read on stock movements" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated all on stock movements" ON public.stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
