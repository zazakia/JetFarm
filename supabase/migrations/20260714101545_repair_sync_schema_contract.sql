-- Repair the Water Station schema when migration history says the original
-- migration ran but the relations are absent, and make Data API grants
-- explicit for every table currently used by SyncService.

CREATE TABLE IF NOT EXISTS public.ws_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    is_member BOOLEAN NOT NULL DEFAULT FALSE,
    member_id UUID,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ws_customers_member_id
    ON public.ws_customers (member_id)
    WHERE member_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ws_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.ws_customers(id) ON DELETE CASCADE,
    delivery_date TIMESTAMPTZ NOT NULL,
    gallons NUMERIC(10,2) NOT NULL,
    price_per_gallon NUMERIC(10,2) NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ws_deliveries_customer_id
    ON public.ws_deliveries (customer_id);

CREATE TABLE IF NOT EXISTS public.ws_containers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.ws_customers(id) ON DELETE CASCADE,
    container_type TEXT NOT NULL CHECK (container_type IN ('slim', 'round')),
    quantity_owned INTEGER NOT NULL DEFAULT 0,
    quantity_loaned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ws_containers_customer_type
    ON public.ws_containers (customer_id, container_type)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.ws_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.ws_customers(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES public.ws_deliveries(id) ON DELETE SET NULL,
    payment_date TIMESTAMPTZ NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'gcash')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ws_payments_customer_id
    ON public.ws_payments (customer_id);

CREATE INDEX IF NOT EXISTS idx_ws_payments_delivery_id
    ON public.ws_payments (delivery_id)
    WHERE delivery_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ws_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    expense_date TIMESTAMPTZ NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.ws_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ws_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ws_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ws_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ws_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ws_customers_read" ON public.ws_customers;
CREATE POLICY "ws_customers_read" ON public.ws_customers
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ws_customers_write" ON public.ws_customers;
CREATE POLICY "ws_customers_write" ON public.ws_customers
    FOR ALL TO authenticated
    USING (public.get_current_role() IN ('admin', 'payment-encoder', 'water-station-cashier'))
    WITH CHECK (public.get_current_role() IN ('admin', 'payment-encoder', 'water-station-cashier'));

DROP POLICY IF EXISTS "ws_deliveries_read" ON public.ws_deliveries;
CREATE POLICY "ws_deliveries_read" ON public.ws_deliveries
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ws_deliveries_write" ON public.ws_deliveries;
CREATE POLICY "ws_deliveries_write" ON public.ws_deliveries
    FOR ALL TO authenticated
    USING (public.get_current_role() IN ('admin', 'payment-encoder', 'water-station-cashier', 'water-station-delivery-boy'))
    WITH CHECK (public.get_current_role() IN ('admin', 'payment-encoder', 'water-station-cashier', 'water-station-delivery-boy'));

DROP POLICY IF EXISTS "ws_containers_read" ON public.ws_containers;
CREATE POLICY "ws_containers_read" ON public.ws_containers
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ws_containers_write" ON public.ws_containers;
CREATE POLICY "ws_containers_write" ON public.ws_containers
    FOR ALL TO authenticated
    USING (public.get_current_role() IN ('admin', 'payment-encoder', 'water-station-cashier'))
    WITH CHECK (public.get_current_role() IN ('admin', 'payment-encoder', 'water-station-cashier'));

DROP POLICY IF EXISTS "ws_payments_read" ON public.ws_payments;
CREATE POLICY "ws_payments_read" ON public.ws_payments
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ws_payments_write" ON public.ws_payments;
CREATE POLICY "ws_payments_write" ON public.ws_payments
    FOR ALL TO authenticated
    USING (public.get_current_role() IN ('admin', 'payment-encoder', 'water-station-cashier'))
    WITH CHECK (public.get_current_role() IN ('admin', 'payment-encoder', 'water-station-cashier'));

DROP POLICY IF EXISTS "ws_expenses_read" ON public.ws_expenses;
CREATE POLICY "ws_expenses_read" ON public.ws_expenses
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ws_expenses_write" ON public.ws_expenses;
CREATE POLICY "ws_expenses_write" ON public.ws_expenses
    FOR ALL TO authenticated
    USING (public.get_current_role() IN ('admin', 'expenses-encoder', 'water-station-cashier'))
    WITH CHECK (public.get_current_role() IN ('admin', 'expenses-encoder', 'water-station-cashier'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ws_customers_updated_at ON public.ws_customers;
CREATE TRIGGER trg_ws_customers_updated_at
    BEFORE UPDATE ON public.ws_customers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_ws_deliveries_updated_at ON public.ws_deliveries;
CREATE TRIGGER trg_ws_deliveries_updated_at
    BEFORE UPDATE ON public.ws_deliveries
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_ws_containers_updated_at ON public.ws_containers;
CREATE TRIGGER trg_ws_containers_updated_at
    BEFORE UPDATE ON public.ws_containers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_ws_payments_updated_at ON public.ws_payments;
CREATE TRIGGER trg_ws_payments_updated_at
    BEFORE UPDATE ON public.ws_payments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_ws_expenses_updated_at ON public.ws_expenses;
CREATE TRIGGER trg_ws_expenses_updated_at
    BEFORE UPDATE ON public.ws_expenses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
DECLARE
    sync_table TEXT;
BEGIN
    FOREACH sync_table IN ARRAY ARRAY[
        'user_profiles', 'app_areas', 'app_collectors', 'app_expense_categories',
        'app_bank_accounts', 'app_employees', 'collection_groups', 'app_payrolls',
        'app_borrowers', 'app_loan_applications', 'app_savings_transactions',
        'ws_customers', 'app_loans', 'ws_deliveries', 'ws_containers',
        'app_payment_schedules', 'app_payments', 'app_loan_penalties',
        'app_guarantors', 'ws_payments', 'app_expenses', 'app_cash_transactions',
        'app_bank_transactions', 'app_collection_logs', 'app_financial_snapshots',
        'app_remittances', 'app_action_logs', 'app_file_cases', 'ws_expenses', 'chart_of_accounts',
        'journal_entries', 'journal_entry_lines', 'statutory_fund_allocations',
        'financial_period_settings', 'business_units', 'module_transactions',
        'app_dependents', 'app_children', 'app_share_capital_transactions',
        'app_committees', 'app_committee_members', 'app_board_resolutions',
        'app_meeting_attendance', 'app_settings', 'app_loan_products',
        'app_feature_flags', 'app_role_permissions'
    ]
    LOOP
        IF to_regclass(format('public.%I', sync_table)) IS NOT NULL THEN
            EXECUTE format(
                'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
                sync_table
            );
        END IF;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
