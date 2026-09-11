-- Migration: Water Refilling Station Module Tables
-- Date: 2026-07-09

-- ─── Water Station Customers ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ws_customers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    phone               TEXT,
    address             TEXT,
    is_member           BOOLEAN NOT NULL DEFAULT FALSE,
    member_id           UUID, -- Optionally links to borrowers/members table
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ws_customers_member_id
    ON public.ws_customers (member_id)
    WHERE member_id IS NOT NULL;

-- ─── Water Station Deliveries ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ws_deliveries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID NOT NULL REFERENCES public.ws_customers(id) ON DELETE CASCADE,
    delivery_date       TIMESTAMPTZ NOT NULL,
    gallons             NUMERIC(10,2) NOT NULL,
    price_per_gallon    NUMERIC(10,2) NOT NULL,
    total_amount        NUMERIC(12,2) NOT NULL,
    status              TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'cancelled')),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ws_deliveries_customer_id
    ON public.ws_deliveries (customer_id);

-- ─── Water Station Containers Inventory ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ws_containers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID NOT NULL REFERENCES public.ws_customers(id) ON DELETE CASCADE,
    container_type      TEXT NOT NULL CHECK (container_type IN ('slim', 'round')),
    quantity_owned      INTEGER NOT NULL DEFAULT 0,
    quantity_loaned     INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ws_containers_customer_type
    ON public.ws_containers (customer_id, container_type)
    WHERE deleted_at IS NULL;

-- ─── Water Station Payments ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ws_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID NOT NULL REFERENCES public.ws_customers(id) ON DELETE CASCADE,
    delivery_id         UUID REFERENCES public.ws_deliveries(id) ON DELETE SET NULL,
    payment_date        TIMESTAMPTZ NOT NULL,
    amount              NUMERIC(12,2) NOT NULL,
    payment_method      TEXT NOT NULL CHECK (payment_method IN ('cash', 'gcash')),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ws_payments_customer_id
    ON public.ws_payments (customer_id);

CREATE INDEX IF NOT EXISTS idx_ws_payments_delivery_id
    ON public.ws_payments (delivery_id)
    WHERE delivery_id IS NOT NULL;

-- ─── Water Station Expenses ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ws_expenses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category            TEXT NOT NULL,
    amount              NUMERIC(12,2) NOT NULL,
    expense_date        TIMESTAMPTZ NOT NULL,
    description         TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

-- ─── Row Level Security ────────────────────────────────────────────────
ALTER TABLE public.ws_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ws_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ws_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ws_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ws_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_customers_read" ON public.ws_customers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "ws_customers_write" ON public.ws_customers
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()::text
            AND role IN ('admin', 'payment-encoder', 'water-station-cashier')
        )
    );

CREATE POLICY "ws_deliveries_read" ON public.ws_deliveries
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "ws_deliveries_write" ON public.ws_deliveries
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()::text
            AND role IN ('admin', 'payment-encoder', 'water-station-cashier', 'water-station-delivery-boy')
        )
    );

CREATE POLICY "ws_containers_read" ON public.ws_containers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "ws_containers_write" ON public.ws_containers
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()::text
            AND role IN ('admin', 'payment-encoder', 'water-station-cashier')
        )
    );

CREATE POLICY "ws_payments_read" ON public.ws_payments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "ws_payments_write" ON public.ws_payments
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()::text
            AND role IN ('admin', 'payment-encoder', 'water-station-cashier')
        )
    );

CREATE POLICY "ws_expenses_read" ON public.ws_expenses
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "ws_expenses_write" ON public.ws_expenses
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()::text
            AND role IN ('admin', 'expenses-encoder', 'water-station-cashier')
        )
    );

-- ─── Updated At Triggers ───────────────────────────────────────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ws_customers_updated_at') THEN
        CREATE TRIGGER trg_ws_customers_updated_at
            BEFORE UPDATE ON public.ws_customers
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ws_deliveries_updated_at') THEN
        CREATE TRIGGER trg_ws_deliveries_updated_at
            BEFORE UPDATE ON public.ws_deliveries
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ws_containers_updated_at') THEN
        CREATE TRIGGER trg_ws_containers_updated_at
            BEFORE UPDATE ON public.ws_containers
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ws_payments_updated_at') THEN
        CREATE TRIGGER trg_ws_payments_updated_at
            BEFORE UPDATE ON public.ws_payments
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ws_expenses_updated_at') THEN
        CREATE TRIGGER trg_ws_expenses_updated_at
            BEFORE UPDATE ON public.ws_expenses
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;
