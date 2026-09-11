-- Migration: 20260910010000_crispyking_payroll_module.sql
-- Description: Philippine statutory payroll module for Viterbo Foods OPC
--   - SSS, PhilHealth, Pag-IBIG contribution tables
--   - BIR Withholding Tax brackets
--   - Payroll runs with auto-journal posting trigger

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. STATUTORY CONTRIBUTION RATE TABLES
--    These are Philippine government-mandated rates updated annually.
--    Storing in DB allows updating without code deploys.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.statutory_rates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_type       TEXT NOT NULL CHECK (rate_type IN ('sss', 'philhealth', 'pagibig', 'tax')),
    bracket_min     NUMERIC(12,2) NOT NULL,
    bracket_max     NUMERIC(12,2),               -- NULL = no upper limit
    employee_share  NUMERIC(12,2) NOT NULL DEFAULT 0,
    employer_share  NUMERIC(12,2) NOT NULL DEFAULT 0,
    effective_from  DATE NOT NULL,
    effective_to    DATE,                         -- NULL = currently active
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_statutory_rates_type
    ON public.statutory_rates (rate_type, effective_from);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. SEED SSS 2026 CONTRIBUTION TABLE (Monthly Salary Credit Brackets)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.statutory_rates (rate_type, bracket_min, bracket_max, employee_share, employer_share, effective_from, description) VALUES
('sss',     0,     4249.99,   200,    400,  '2026-01-01', 'MSC 4000'),
('sss',  4250,     4749.99,   225,    450,  '2026-01-01', 'MSC 4500'),
('sss',  4750,     5249.99,   250,    500,  '2026-01-01', 'MSC 5000'),
('sss',  5250,     5749.99,   275,    550,  '2026-01-01', 'MSC 5500'),
('sss',  5750,     6249.99,   300,    600,  '2026-01-01', 'MSC 6000'),
('sss',  6250,     6749.99,   325,    650,  '2026-01-01', 'MSC 6500'),
('sss',  6750,     7249.99,   350,    700,  '2026-01-01', 'MSC 7000'),
('sss',  7250,     7749.99,   375,    750,  '2026-01-01', 'MSC 7500'),
('sss',  7750,     8249.99,   400,    800,  '2026-01-01', 'MSC 8000'),
('sss',  8250,     8749.99,   425,    850,  '2026-01-01', 'MSC 8500'),
('sss',  8750,     9249.99,   450,    900,  '2026-01-01', 'MSC 9000'),
('sss',  9250,     9749.99,   475,    950,  '2026-01-01', 'MSC 9500'),
('sss',  9750,    10249.99,   500,   1000,  '2026-01-01', 'MSC 10000'),
('sss', 10250,    10749.99,   525,   1050,  '2026-01-01', 'MSC 10500'),
('sss', 10750,    11249.99,   550,   1100,  '2026-01-01', 'MSC 11000'),
('sss', 11250,    11749.99,   575,   1150,  '2026-01-01', 'MSC 11500'),
('sss', 11750,    12249.99,   600,   1200,  '2026-01-01', 'MSC 12000'),
('sss', 12250,    12749.99,   625,   1250,  '2026-01-01', 'MSC 12500'),
('sss', 12750,    13249.99,   650,   1300,  '2026-01-01', 'MSC 13000'),
('sss', 13250,    13749.99,   675,   1350,  '2026-01-01', 'MSC 13500'),
('sss', 13750,    14249.99,   700,   1400,  '2026-01-01', 'MSC 14000'),
('sss', 14250,    14749.99,   725,   1450,  '2026-01-01', 'MSC 14500'),
('sss', 14750,    15249.99,   750,   1500,  '2026-01-01', 'MSC 15000'),
('sss', 15250,    15749.99,   775,   1550,  '2026-01-01', 'MSC 15500'),
('sss', 15750,    16249.99,   800,   1600,  '2026-01-01', 'MSC 16000'),
('sss', 16250,    16749.99,   825,   1650,  '2026-01-01', 'MSC 16500'),
('sss', 16750,    17249.99,   850,   1700,  '2026-01-01', 'MSC 17000'),
('sss', 17250,    17749.99,   875,   1750,  '2026-01-01', 'MSC 17500'),
('sss', 17750,    18249.99,   900,   1800,  '2026-01-01', 'MSC 18000'),
('sss', 18250,    18749.99,   925,   1850,  '2026-01-01', 'MSC 18500'),
('sss', 18750,    19249.99,   950,   1900,  '2026-01-01', 'MSC 19000'),
('sss', 19250,    19749.99,   975,   1950,  '2026-01-01', 'MSC 19500'),
('sss', 19750,    20249.99,  1000,   2000,  '2026-01-01', 'MSC 20000'),
('sss', 20250,    20749.99,  1050,   2100,  '2026-01-01', 'MSC 20500 (WISP)'),
('sss', 20750,    21249.99,  1100,   2200,  '2026-01-01', 'MSC 21000 (WISP)'),
('sss', 21250,    21749.99,  1150,   2300,  '2026-01-01', 'MSC 21500 (WISP)'),
('sss', 21750,    22249.99,  1200,   2400,  '2026-01-01', 'MSC 22000 (WISP)'),
('sss', 22250,    22749.99,  1250,   2500,  '2026-01-01', 'MSC 22500 (WISP)'),
('sss', 22750,    23249.99,  1300,   2600,  '2026-01-01', 'MSC 23000 (WISP)'),
('sss', 23250,    23749.99,  1350,   2700,  '2026-01-01', 'MSC 23500 (WISP)'),
('sss', 23750,    24249.99,  1400,   2800,  '2026-01-01', 'MSC 24000 (WISP)'),
('sss', 24250,    24749.99,  1450,   2900,  '2026-01-01', 'MSC 24500 (WISP)'),
('sss', 24750,    NULL,      1500,   3000,  '2026-01-01', 'MSC 25000+ (WISP)')
ON CONFLICT DO NOTHING;

-- PhilHealth 2026: 5% of basic salary, split 50/50 (employee/employer)
-- Floor: ₱10,000 | Ceiling: ₱100,000
INSERT INTO public.statutory_rates (rate_type, bracket_min, bracket_max, employee_share, employer_share, effective_from, description) VALUES
('philhealth', 10000, 100000, 0, 0, '2026-01-01', '5% of basic salary, 50/50 split. EE = salary * 0.025, ER = salary * 0.025. Min ₱250/₱250, Max ₱2500/₱2500')
ON CONFLICT DO NOTHING;

-- Pag-IBIG 2026: 2% employee + 2% employer (for salary > ₱1,500)
INSERT INTO public.statutory_rates (rate_type, bracket_min, bracket_max, employee_share, employer_share, effective_from, description) VALUES
('pagibig',     0,  1500,  25,   50,  '2026-01-01', '1% EE + 2% ER for salary ≤ ₱1,500'),
('pagibig',  1500,  NULL, 100,  100,  '2026-01-01', '2% EE + 2% ER capped at ₱100 each for salary > ₱1,500')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. EMPLOYEES TABLE (for payroll — lightweight HR)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.employees (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code   TEXT NOT NULL UNIQUE,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    middle_name     TEXT,
    position        TEXT NOT NULL DEFAULT 'crew',      -- crew, team_leader, supervisor, manager
    branch_id       TEXT,
    daily_rate      NUMERIC(10,2) NOT NULL DEFAULT 0,
    hire_date       DATE,
    -- Government IDs (201 File)
    sss_number      TEXT,
    philhealth_number TEXT,
    pagibig_number  TEXT,
    tin             TEXT,
    -- Contact
    phone           TEXT,
    emergency_contact TEXT,
    emergency_phone TEXT,
    -- Status
    is_active       BOOLEAN DEFAULT TRUE,
    separation_date DATE,
    separation_reason TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_employees_branch
    ON public.employees (branch_id) WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_active
    ON public.employees (is_active) WHERE deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. PAYROLL RUNS & PAYROLL LINES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       TEXT NOT NULL,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    pay_date        DATE,
    status          TEXT DEFAULT 'draft' CHECK (status IN (
                        'draft', 'computed', 'approved', 'posted', 'reversed'
                    )),
    total_gross     NUMERIC(12,2) DEFAULT 0,
    total_deductions NUMERIC(12,2) DEFAULT 0,
    total_net       NUMERIC(12,2) DEFAULT 0,
    total_employer_contributions NUMERIC(12,2) DEFAULT 0,
    computed_by     TEXT,
    approved_by     TEXT,
    approved_at     TIMESTAMPTZ,
    journal_entry_id UUID REFERENCES public.journal_entries(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.payroll_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id      UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
    employee_id     UUID NOT NULL REFERENCES public.employees(id),
    -- Earnings
    days_worked     NUMERIC(5,2) DEFAULT 0,
    basic_pay       NUMERIC(12,2) NOT NULL DEFAULT 0,
    overtime_hours  NUMERIC(5,2) DEFAULT 0,
    overtime_pay    NUMERIC(12,2) DEFAULT 0,
    holiday_pay     NUMERIC(12,2) DEFAULT 0,
    tl_allowance    NUMERIC(12,2) DEFAULT 0,
    thirteenth_month NUMERIC(12,2) DEFAULT 0,
    other_earnings  NUMERIC(12,2) DEFAULT 0,
    gross_pay       NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- Employee Deductions
    sss_ee          NUMERIC(12,2) DEFAULT 0,
    philhealth_ee   NUMERIC(12,2) DEFAULT 0,
    pagibig_ee      NUMERIC(12,2) DEFAULT 0,
    withholding_tax NUMERIC(12,2) DEFAULT 0,
    other_deductions NUMERIC(12,2) DEFAULT 0,
    total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_pay         NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- Employer Contributions (not deducted from employee, but must be recorded)
    sss_er          NUMERIC(12,2) DEFAULT 0,
    philhealth_er   NUMERIC(12,2) DEFAULT 0,
    pagibig_er      NUMERIC(12,2) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_branch
    ON public.payroll_runs (branch_id);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_period
    ON public.payroll_runs (period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_payroll_lines_payroll
    ON public.payroll_lines (payroll_id);

CREATE INDEX IF NOT EXISTS idx_payroll_lines_employee
    ON public.payroll_lines (employee_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. PAYROLL → JOURNAL AUTO-POSTING TRIGGER
--    When a payroll run is approved, automatically create the balanced
--    journal entry with all statutory deductions and employer contributions.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_post_payroll_journal()
RETURNS TRIGGER AS $$
DECLARE
    v_je_id UUID;
    v_je_number TEXT;
    v_total_gross NUMERIC(12,2);
    v_total_net NUMERIC(12,2);
    v_total_sss_ee NUMERIC(12,2);
    v_total_sss_er NUMERIC(12,2);
    v_total_ph_ee NUMERIC(12,2);
    v_total_ph_er NUMERIC(12,2);
    v_total_pi_ee NUMERIC(12,2);
    v_total_pi_er NUMERIC(12,2);
    v_total_tax NUMERIC(12,2);
BEGIN
    -- Only fire when status changes to 'posted'
    IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN

        -- Aggregate payroll totals
        SELECT
            COALESCE(SUM(gross_pay), 0),
            COALESCE(SUM(net_pay), 0),
            COALESCE(SUM(sss_ee), 0),
            COALESCE(SUM(sss_er), 0),
            COALESCE(SUM(philhealth_ee), 0),
            COALESCE(SUM(philhealth_er), 0),
            COALESCE(SUM(pagibig_ee), 0),
            COALESCE(SUM(pagibig_er), 0),
            COALESCE(SUM(withholding_tax), 0)
        INTO v_total_gross, v_total_net,
             v_total_sss_ee, v_total_sss_er,
             v_total_ph_ee, v_total_ph_er,
             v_total_pi_ee, v_total_pi_er,
             v_total_tax
        FROM public.payroll_lines
        WHERE payroll_id = NEW.id
          AND deleted_at IS NULL;

        -- Generate journal entry number
        v_je_number := 'PR-' || NEW.branch_id || '-'
                       || to_char(NEW.period_end, 'YYYYMM') || '-'
                       || lpad(nextval(pg_get_serial_sequence('public.journal_entries', 'id'))::TEXT, 4, '0');

        -- Fallback if sequence doesn't exist
        IF v_je_number IS NULL THEN
            v_je_number := 'PR-' || NEW.branch_id || '-'
                           || to_char(NEW.period_end, 'YYYYMMDD') || '-'
                           || substr(gen_random_uuid()::TEXT, 1, 8);
        END IF;

        -- Create journal header
        INSERT INTO public.journal_entries (
            id, entry_date, reference_number, description,
            entry_type, journal_type, branch_id,
            source_table, source_id,
            is_posted, fiscal_year, fiscal_month
        ) VALUES (
            gen_random_uuid(), NEW.period_end, v_je_number,
            'Payroll ' || to_char(NEW.period_start, 'Mon DD') || '–' || to_char(NEW.period_end, 'Mon DD, YYYY'),
            'auto', 'payroll', NEW.branch_id,
            'payroll_runs', NEW.id,
            FALSE, -- Will be posted by the balanced-journal trigger
            EXTRACT(YEAR FROM NEW.period_end)::INTEGER,
            EXTRACT(MONTH FROM NEW.period_end)::INTEGER
        ) RETURNING id INTO v_je_id;

        -- DEBIT: Salaries & Wages (gross pay)
        INSERT INTO public.journal_entry_lines (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description)
        VALUES (v_je_id, '6010', 'Salaries & Wages', v_total_gross, 0, 'Gross payroll');

        -- DEBIT: SSS Employer Contribution
        IF v_total_sss_er > 0 THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description)
            VALUES (v_je_id, '6012', 'SSS Employer Share', v_total_sss_er, 0, 'SSS employer contribution');
        END IF;

        -- DEBIT: PhilHealth Employer Contribution
        IF v_total_ph_er > 0 THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description)
            VALUES (v_je_id, '6013', 'PhilHealth Employer Share', v_total_ph_er, 0, 'PhilHealth employer contribution');
        END IF;

        -- DEBIT: Pag-IBIG Employer Contribution
        IF v_total_pi_er > 0 THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description)
            VALUES (v_je_id, '6014', 'Pag-IBIG Employer Share', v_total_pi_er, 0, 'Pag-IBIG employer contribution');
        END IF;

        -- CREDIT: Cash (net pay disbursed to employees)
        INSERT INTO public.journal_entry_lines (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description)
        VALUES (v_je_id, '1010', 'Cash on Hand', 0, v_total_net, 'Net payroll disbursement');

        -- CREDIT: SSS Payable (employee + employer shares)
        IF (v_total_sss_ee + v_total_sss_er) > 0 THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description)
            VALUES (v_je_id, '2020', 'SSS Payable', 0, v_total_sss_ee + v_total_sss_er, 'SSS contributions payable');
        END IF;

        -- CREDIT: PhilHealth Payable
        IF (v_total_ph_ee + v_total_ph_er) > 0 THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description)
            VALUES (v_je_id, '2021', 'PhilHealth Payable', 0, v_total_ph_ee + v_total_ph_er, 'PhilHealth contributions payable');
        END IF;

        -- CREDIT: Pag-IBIG Payable
        IF (v_total_pi_ee + v_total_pi_er) > 0 THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description)
            VALUES (v_je_id, '2022', 'Pag-IBIG Payable', 0, v_total_pi_ee + v_total_pi_er, 'Pag-IBIG contributions payable');
        END IF;

        -- CREDIT: BIR Withholding Tax Payable
        IF v_total_tax > 0 THEN
            INSERT INTO public.journal_entry_lines (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description)
            VALUES (v_je_id, '2030', 'Withholding Tax Payable', 0, v_total_tax, 'BIR withholding tax');
        END IF;

        -- Post the journal (balanced-journal trigger will validate)
        UPDATE public.journal_entries SET is_posted = TRUE WHERE id = v_je_id;

        -- Link journal entry back to payroll run
        NEW.journal_entry_id := v_je_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_post_payroll_journal ON public.payroll_runs;

CREATE TRIGGER trg_auto_post_payroll_journal
    BEFORE UPDATE ON public.payroll_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_post_payroll_journal();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.statutory_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_lines ENABLE ROW LEVEL SECURITY;

-- All authenticated can read
CREATE POLICY "statutory_rates_read" ON public.statutory_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees_read" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_runs_read" ON public.payroll_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_lines_read" ON public.payroll_lines FOR SELECT TO authenticated USING (true);

-- Admin-only write
CREATE POLICY "statutory_rates_write" ON public.statutory_rates FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid()::text AND role = 'admin'));

CREATE POLICY "employees_write" ON public.employees FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid()::text AND role IN ('admin', 'loan-encoder')));

CREATE POLICY "payroll_runs_write" ON public.payroll_runs FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid()::text AND role IN ('admin', 'expenses-encoder')));

CREATE POLICY "payroll_lines_write" ON public.payroll_lines FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid()::text AND role IN ('admin', 'expenses-encoder')));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. UPDATED_AT TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_employees_updated_at') THEN
        CREATE TRIGGER trg_employees_updated_at
            BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payroll_runs_updated_at') THEN
        CREATE TRIGGER trg_payroll_runs_updated_at
            BEFORE UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payroll_lines_updated_at') THEN
        CREATE TRIGGER trg_payroll_lines_updated_at
            BEFORE UPDATE ON public.payroll_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

COMMIT;
