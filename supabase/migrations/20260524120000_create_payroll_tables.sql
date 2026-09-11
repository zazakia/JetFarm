-- =============================================================================
-- Payroll System Schema Extension
-- Adds: app_employees, app_payrolls tables
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. app_employees — employees details
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_employees (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    role        text NOT NULL,
    base_salary numeric NOT NULL,
    is_active   boolean DEFAULT true,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now(),
    deleted_at  timestamptz
);

ALTER TABLE app_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read employees"
    ON app_employees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert employees"
    ON app_employees FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update employees"
    ON app_employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. app_payrolls — payroll period runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_payrolls (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id     uuid NOT NULL REFERENCES app_employees(id),
    period_start    timestamptz NOT NULL,
    period_end      timestamptz NOT NULL,
    base_salary     numeric NOT NULL,
    deductions      numeric DEFAULT 0,
    allowances      numeric DEFAULT 0,
    net_pay         numeric NOT NULL,
    status          text NOT NULL DEFAULT 'draft', -- draft, finalized, paid
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    deleted_at      timestamptz
);

ALTER TABLE app_payrolls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read payrolls"
    ON app_payrolls FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert payrolls"
    ON app_payrolls FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update payrolls"
    ON app_payrolls FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
