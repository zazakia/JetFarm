-- ============================================================================
-- Seed All Modules with Mock Data v2 — POS Cursor / POSCursor
-- Run: docker exec -i supabase_db_jetfarm-local psql -U postgres < scripts/seed-all-mock-data-v2.sql
-- ============================================================================
-- Populates ALL 32 tables with realistic Philippine microfinance mock data.
-- Safe to re-run (DELETE + INSERT pattern). No BEGIN/COMMIT wrapper.
--
-- UUID id tables → gen_random_uuid()
-- TEXT id tables → gen_random_uuid()::text
-- TIMESTAMPTZ columns → now()
-- BIGINT columns → EXTRACT(EPOCH FROM now()) * 1000
-- ============================================================================

-- ============================================================================
-- PHASE 0: DELETE ALL DATA (strict dependency order — children first, then parents)
-- ============================================================================
-- Level 1: Tables that reference other seeded tables (deepest children)
DELETE FROM app_guarantors;       -- FK: loan_id → app_loans, application_id → app_loan_applications, member_id → app_borrowers
DELETE FROM app_committee_members;-- FK: committee_id → app_committees, member_id → app_borrowers
DELETE FROM app_file_cases;       -- FK: loan_id, borrower_id
DELETE FROM app_share_capital_transactions; -- FK: member_id → app_borrowers
DELETE FROM app_dependents;       -- FK: member_id → app_borrowers
DELETE FROM app_children;         -- FK: member_id → app_borrowers
DELETE FROM app_meeting_attendance; -- FK: member_id → app_borrowers
DELETE FROM app_savings_transactions; -- FK: borrower_id → app_borrowers
DELETE FROM app_payments;         -- FK: loan_id → app_loans
DELETE FROM app_payment_schedules;-- FK: loan_id → app_loans
DELETE FROM app_loan_penalties;   -- FK: loan_id → app_loans
DELETE FROM app_payrolls;         -- FK: employee_id → app_employees
DELETE FROM app_bank_transactions;-- FK: bank_account_id → app_bank_accounts

-- Level 2: Tables referenced by Level 1
DELETE FROM app_loans;            -- FK: application_id → app_loan_applications, borrower_id → app_borrowers

-- Level 3: app_loan_applications (FK: borrower_id → app_borrowers, product_id → app_loan_products)
DELETE FROM app_loan_applications;

-- Level 4: Independent reference tables and remaining parents
DELETE FROM app_borrowers;
DELETE FROM collection_groups;
DELETE FROM app_employees;
DELETE FROM app_committees;
DELETE FROM app_board_resolutions;
DELETE FROM app_loan_products;
DELETE FROM app_expense_categories;
DELETE FROM app_bank_accounts;
DELETE FROM app_feature_flags;
DELETE FROM app_settings;
DELETE FROM app_role_permissions;
DELETE FROM app_collection_logs;
DELETE FROM app_remittances;
DELETE FROM app_cash_transactions;
DELETE FROM app_expenses;
DELETE FROM app_financial_snapshots;
DELETE FROM app_action_logs;

-- ============================================================================
-- TEMP TABLE: Borrowers (18 Philippine-named borrowers with collector assignments)
-- ============================================================================
DROP TABLE IF EXISTS _seed_borrowers;
CREATE TEMP TABLE _seed_borrowers (
  id text PRIMARY KEY,
  full_name text,
  collector_id text,
  area text,
  membership_number text,
  seq int
);
INSERT INTO _seed_borrowers VALUES
  (gen_random_uuid()::text, 'Maria Santos Dela Cruz',   '00000000-0000-0000-0000-000000000003', 'Dagupan City',    'SMPC-2024-001', 1),
  (gen_random_uuid()::text, 'Juan Miguel Tan Reyes',    '00000000-0000-0000-0000-000000000003', 'Dagupan City',    'SMPC-2024-002', 2),
  (gen_random_uuid()::text, 'Ana Louise Bautista Garcia', '00000000-0000-0000-0000-000000000007', 'Calasiao',        'SMPC-2024-003', 3),
  (gen_random_uuid()::text, 'Pedro Cruz Salvador',      '00000000-0000-0000-0000-000000000007', 'Calasiao',        'SMPC-2024-004', 4),
  (gen_random_uuid()::text, 'Elena Ferrer Gonzales',    '00000000-0000-0000-0000-000000000008', 'Lingayen',        'SMPC-2024-005', 5),
  (gen_random_uuid()::text, 'Ramon Villanueva Castro',  '00000000-0000-0000-0000-000000000008', 'Lingayen',        'SMPC-2024-006', 6),
  (gen_random_uuid()::text, 'Carmen Lopez Mendoza',     '00000000-0000-0000-0000-000000000009', 'San Carlos City', 'SMPC-2024-007', 7),
  (gen_random_uuid()::text, 'Antonio Rivera Morales',   '00000000-0000-0000-0000-000000000009', 'San Carlos City', 'SMPC-2024-008', 8),
  (gen_random_uuid()::text, 'Luzviminda Aquino Santos', '00000000-0000-0000-0000-000000000010', 'Binmaley',        'SMPC-2024-009', 9),
  (gen_random_uuid()::text, 'Roberto Ramos Flores',     '00000000-0000-0000-0000-000000000010', 'Binmaley',        'SMPC-2024-010', 10),
  (gen_random_uuid()::text, 'Gloria Macapagal Torres',  '00000000-0000-0000-0000-000000000013', 'Dagupan City',    'SMPC-2024-011', 11),
  (gen_random_uuid()::text, 'Ferdinand Castillo Gomez', '00000000-0000-0000-0000-000000000013', 'Dagupan City',    'SMPC-2024-012', 12),
  (gen_random_uuid()::text, 'Josephine Santiago',       '00000000-0000-0000-0000-000000000003', 'Dagupan City',    'SMPC-2024-013', 13),
  (gen_random_uuid()::text, 'Dante Mercader Ignacio',   '00000000-0000-0000-0000-000000000007', 'Calasiao',        'SMPC-2024-014', 14),
  (gen_random_uuid()::text, 'Rosario Panganiban Lee',   '00000000-0000-0000-0000-000000000008', 'Lingayen',        'SMPC-2024-015', 15),
  (gen_random_uuid()::text, 'Cristina Alegre Valdez',   '00000000-0000-0000-0000-000000000009', 'San Carlos City', 'SMPC-2024-016', 16),
  (gen_random_uuid()::text, 'Teodoro Bautista Pascual', '00000000-0000-0000-0000-000000000010', 'Binmaley',        'SMPC-2024-017', 17),
  (gen_random_uuid()::text, 'Nieves Manalo Roxas',      '00000000-0000-0000-0000-000000000011', 'Dagupan City',    'SMPC-2024-018', 18);

-- ============================================================================
-- 1. app_loan_products (TEXT id, 7 products)
-- ============================================================================
INSERT INTO app_loan_products (id, product_type, label, description, default_rate_percent, default_term, default_term_unit, default_frequency, default_processing_fee_rate, default_notarial_fee, default_savings_per_payment, default_principal, max_principal, min_term_months, max_term_months, is_active, sort_order, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, 'micro_enterprise', 'Micro Enterprise Loan', 'For small business owners and entrepreneurs', 3.5, 6, 'months', 'daily', 2.0, 100, 20, 10000, 50000, 1, 12, true, 1, now(), now()),
  (gen_random_uuid()::text, 'agri', 'Agricultural Loan', 'For farmers and agricultural needs', 2.5, 12, 'months', 'monthly', 1.5, 0, 50, 15000, 100000, 3, 24, true, 2, now(), now()),
  (gen_random_uuid()::text, 'emergency', 'Emergency Loan', 'Quick release for emergency needs', 5.0, 3, 'months', 'monthly', 1.0, 0, 10, 5000, 20000, 1, 6, true, 3, now(), now()),
  (gen_random_uuid()::text, 'education', 'Educational Loan', 'For tuition and school expenses', 2.0, 12, 'months', 'monthly', 1.0, 0, 30, 10000, 50000, 3, 24, true, 4, now(), now()),
  (gen_random_uuid()::text, 'housing', 'Housing Loan', 'For home improvement and construction', 1.5, 24, 'months', 'monthly', 2.5, 500, 100, 50000, 300000, 12, 60, true, 5, now(), now()),
  (gen_random_uuid()::text, 'pension_loan', 'Pension Loan', 'For senior citizens and pensioners', 4.0, 6, 'months', 'monthly', 1.0, 0, 15, 5000, 25000, 1, 12, true, 6, now(), now()),
  (gen_random_uuid()::text, 'salary_loan', 'Salary Loan', 'For employed individuals', 3.0, 6, 'months', 'monthly', 1.5, 0, 25, 10000, 30000, 1, 12, true, 7, now(), now());

-- ============================================================================
-- 2. app_expense_categories (TEXT id, 10 categories)
-- ============================================================================
INSERT INTO app_expense_categories (id, name, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, 'Utilities', true, now(), now()),
  (gen_random_uuid()::text, 'Rent', true, now(), now()),
  (gen_random_uuid()::text, 'Salaries', true, now(), now()),
  (gen_random_uuid()::text, 'Transportation', true, now(), now()),
  (gen_random_uuid()::text, 'Office Supplies', true, now(), now()),
  (gen_random_uuid()::text, 'Communication', true, now(), now()),
  (gen_random_uuid()::text, 'Taxes', true, now(), now()),
  (gen_random_uuid()::text, 'Maintenance', true, now(), now()),
  (gen_random_uuid()::text, 'Marketing', true, now(), now()),
  (gen_random_uuid()::text, 'Miscellaneous', true, now(), now());

-- ============================================================================
-- 3. app_feature_flags (TEXT id, 14 feature toggles)
-- ============================================================================
INSERT INTO app_feature_flags (id, key, label, description, category, enabled, sort_order, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, 'multi_center', 'Multi-Center Support', 'Enable operations across multiple collection centers', 'operations', true, 1, now(), now()),
  (gen_random_uuid()::text, 'savings_module', 'Savings Module', 'Enable member savings and withdrawals', 'finance', true, 2, now(), now()),
  (gen_random_uuid()::text, 'share_capital', 'Share Capital', 'Enable share capital tracking', 'finance', true, 3, now(), now()),
  (gen_random_uuid()::text, 'sms_notifications', 'SMS Notifications', 'Send SMS alerts for payments and reminders', 'communication', true, 4, now(), now()),
  (gen_random_uuid()::text, 'committee_management', 'Committee Management', 'Enable committee and board resolution features', 'governance', true, 5, now(), now()),
  (gen_random_uuid()::text, 'collection_groups', 'Collection Groups', 'Enable group/center-based collections', 'operations', true, 6, now(), now()),
  (gen_random_uuid()::text, 'payroll_module', 'Payroll Module', 'Enable employee payroll processing', 'hr', true, 7, now(), now()),
  (gen_random_uuid()::text, 'meeting_attendance', 'Meeting Attendance', 'Track member meeting attendance', 'operations', true, 8, now(), now()),
  (gen_random_uuid()::text, 'file_cases', 'File Cases', 'Track legal cases filed against delinquent accounts', 'legal', true, 9, now(), now()),
  (gen_random_uuid()::text, 'reporting_analytics', 'Reporting & Analytics', 'Advanced reporting and financial analytics', 'analytics', true, 10, now(), now()),
  (gen_random_uuid()::text, 'dependents_module', 'Dependents Module', 'Track member dependents and children', 'membership', true, 11, now(), now()),
  (gen_random_uuid()::text, 'loan_applications', 'Loan Applications', 'Process loan applications before approval', 'lending', true, 12, now(), now()),
  (gen_random_uuid()::text, 'bank_integration', 'Bank Integration', 'Track bank accounts and transactions', 'finance', true, 13, now(), now()),
  (gen_random_uuid()::text, 'delinquency_tracking', 'Delinquency Tracking', 'Track delinquent accounts with DPD and aging', 'lending', true, 14, now(), now());

-- ============================================================================
-- 4. app_settings (TEXT id, 14 org settings)
-- ============================================================================
INSERT INTO app_settings (id, key, value, value_type, scope, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, 'org_name', 'POS Cursor Multi-Purpose Cooperative', 'string', 'general', true, now(), now()),
  (gen_random_uuid()::text, 'org_address', '123 Dagupan City, Pangasinan', 'string', 'general', true, now(), now()),
  (gen_random_uuid()::text, 'org_tin', '123-456-789-000', 'string', 'general', true, now(), now()),
  (gen_random_uuid()::text, 'org_phone', '+63 75 123 4567', 'string', 'general', true, now(), now()),
  (gen_random_uuid()::text, 'interest_type_default', 'declining', 'string', 'lending', true, now(), now()),
  (gen_random_uuid()::text, 'penalty_rate_per_day', '2.00', 'number', 'lending', true, now(), now()),
  (gen_random_uuid()::text, 'grace_period_days', '3', 'number', 'lending', true, now(), now()),
  (gen_random_uuid()::text, 'max_loan_cycle', '5', 'number', 'lending', true, now(), now()),
  (gen_random_uuid()::text, 'membership_fee', '500.00', 'number', 'membership', true, now(), now()),
  (gen_random_uuid()::text, 'share_capital_par_value', '100.00', 'number', 'membership', true, now(), now()),
  (gen_random_uuid()::text, 'min_share_capital', '1000.00', 'number', 'membership', true, now(), now()),
  (gen_random_uuid()::text, 'savings_interest_rate', '3.00', 'number', 'savings', true, now(), now()),
  (gen_random_uuid()::text, 'coop_year_established', '2015', 'number', 'general', true, now(), now()),
  (gen_random_uuid()::text, 'late_payment_grace_period', '7', 'number', 'lending', true, now(), now());

-- ============================================================================
-- 5. app_role_permissions (TEXT id, 24 role-based permissions)
-- ============================================================================
INSERT INTO app_role_permissions (id, role, permission_key, label, category, enabled, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, 'admin', 'manage_users', 'Manage Users', 'admin', true, now(), now()),
  (gen_random_uuid()::text, 'admin', 'manage_settings', 'Manage Settings', 'admin', true, now(), now()),
  (gen_random_uuid()::text, 'admin', 'view_all_loans', 'View All Loans', 'lending', true, now(), now()),
  (gen_random_uuid()::text, 'admin', 'approve_loans', 'Approve Loans', 'lending', true, now(), now()),
  (gen_random_uuid()::text, 'admin', 'manage_collectors', 'Manage Collectors', 'operations', true, now(), now()),
  (gen_random_uuid()::text, 'admin', 'view_reports', 'View Reports', 'reports', true, now(), now()),
  (gen_random_uuid()::text, 'admin', 'manage_employees', 'Manage Employees', 'hr', true, now(), now()),
  (gen_random_uuid()::text, 'admin', 'manage_committees', 'Manage Committees', 'governance', true, now(), now()),
  (gen_random_uuid()::text, 'collector', 'record_payment', 'Record Payments', 'collections', true, now(), now()),
  (gen_random_uuid()::text, 'collector', 'view_assigned_loans', 'View Assigned Loans', 'collections', true, now(), now()),
  (gen_random_uuid()::text, 'collector', 'view_collection_logs', 'View Collection Logs', 'collections', true, now(), now()),
  (gen_random_uuid()::text, 'collector', 'submit_remittance', 'Submit Remittance', 'collections', true, now(), now()),
  (gen_random_uuid()::text, 'collector', 'view_borrowers', 'View Borrowers', 'collections', true, now(), now()),
  (gen_random_uuid()::text, 'loan_encoder', 'encode_loans', 'Encode Loans', 'lending', true, now(), now()),
  (gen_random_uuid()::text, 'loan_encoder', 'view_loan_applications', 'View Loan Applications', 'lending', true, now(), now()),
  (gen_random_uuid()::text, 'loan_encoder', 'manage_borrowers', 'Manage Borrowers', 'membership', true, now(), now()),
  (gen_random_uuid()::text, 'payment_encoder', 'encode_payments', 'Encode Payments', 'payments', true, now(), now()),
  (gen_random_uuid()::text, 'payment_encoder', 'view_all_payments', 'View All Payments', 'payments', true, now(), now()),
  (gen_random_uuid()::text, 'expenses_encoder', 'encode_expenses', 'Encode Expenses', 'expenses', true, now(), now()),
  (gen_random_uuid()::text, 'expenses_encoder', 'manage_expense_categories', 'Manage Expense Categories', 'expenses', true, now(), now()),
  (gen_random_uuid()::text, 'expenses_encoder', 'view_expense_reports', 'View Expense Reports', 'expenses', true, now(), now()),
  (gen_random_uuid()::text, 'borrower', 'view_own_loans', 'View Own Loans', 'borrower', true, now(), now()),
  (gen_random_uuid()::text, 'borrower', 'view_own_savings', 'View Own Savings', 'borrower', true, now(), now()),
  (gen_random_uuid()::text, 'borrower', 'view_own_payments', 'View Own Payments', 'borrower', true, now(), now());

-- ============================================================================
-- 6. collection_groups (UUID id, 7 centers, collector_id ::uuid)
-- ============================================================================
INSERT INTO collection_groups (id, name, collector_id, collection_day, group_type, center_day_name, center_time, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Bonuan Center A',    '00000000-0000-0000-0000-000000000003'::uuid, 1, 'center', 'Monday',    '09:00 AM', true, now(), now()),
  (gen_random_uuid(), 'Calasiao Group 1',   '00000000-0000-0000-0000-000000000007'::uuid, 2, 'group',  'Tuesday',   '10:00 AM', true, now(), now()),
  (gen_random_uuid(), 'Lingayen Circle',    '00000000-0000-0000-0000-000000000008'::uuid, 3, 'center', 'Wednesday', '08:30 AM', true, now(), now()),
  (gen_random_uuid(), 'San Carlos Cluster', '00000000-0000-0000-0000-000000000009'::uuid, 4, 'group',  'Thursday',  '09:00 AM', true, now(), now()),
  (gen_random_uuid(), 'Binmaley Assoc',     '00000000-0000-0000-0000-000000000010'::uuid, 5, 'group',  'Friday',    '10:30 AM', true, now(), now()),
  (gen_random_uuid(), 'Bantay Center',      '00000000-0000-0000-0000-000000000013'::uuid, 1, 'center', 'Saturday',  '08:00 AM', true, now(), now()),
  (gen_random_uuid(), 'Downtown Dagupan',   '00000000-0000-0000-0000-000000000011'::uuid, 2, 'group',  'Monday',    '01:00 PM', true, now(), now());

-- ============================================================================
-- 7. app_borrowers (UUID id, 18 borrowers, collector_id ::uuid)
-- ============================================================================
INSERT INTO app_borrowers (id, full_name, first_name, last_name, address, area, collector_id, membership_number, civil_status, contact_no, source_of_income, business, barangay, city_municipality, province, created_at, updated_at)
SELECT
  b.id::uuid,
  b.full_name,
  SPLIT_PART(b.full_name, ' ', 1),
  SPLIT_PART(b.full_name, ' ', ARRAY_LENGTH(STRING_TO_ARRAY(b.full_name, ' '), 1)),
  b.area || ', Pangasinan',
  b.area,
  b.collector_id::uuid,
  b.membership_number,
  CASE b.seq % 3 WHEN 0 THEN 'married' WHEN 1 THEN 'single' ELSE 'married' END,
  '09' || LPAD((100000000 + b.seq)::text, 9, '0'),
  CASE b.seq % 4 WHEN 0 THEN 'employed' WHEN 1 THEN 'self_employed' WHEN 2 THEN 'business' ELSE 'farming' END,
  CASE b.seq % 4 WHEN 0 THEN 'Sari-Sari Store' WHEN 1 THEN 'Rice Trading' WHEN 2 THEN 'Fishing' ELSE 'Poultry' END,
  CASE b.area WHEN 'Dagupan City' THEN 'Bonuan Gueset' WHEN 'Calasiao' THEN 'Nalsian' WHEN 'Lingayen' THEN 'Mabini' WHEN 'San Carlos City' THEN 'San Miguel' WHEN 'Binmaley' THEN 'Dinalaoan' ELSE 'Bantay' END,
  b.area,
  'Pangasinan',
  now(),
  now()
FROM _seed_borrowers b;

-- ============================================================================
-- 8. app_loan_applications (UUID id, 18 applications, borrower_id ::uuid)
-- ============================================================================
DROP TABLE IF EXISTS _seed_applications;
CREATE TEMP TABLE _seed_applications (
  id text PRIMARY KEY,
  borrower_id text,
  product_type text,
  amount numeric,
  status text,
  seq int
);
INSERT INTO _seed_applications
SELECT
  gen_random_uuid()::text,
  b.id,
  CASE b.seq % 7
    WHEN 0 THEN 'micro_enterprise' WHEN 1 THEN 'agri' WHEN 2 THEN 'emergency'
    WHEN 3 THEN 'education' WHEN 4 THEN 'housing' WHEN 5 THEN 'pension_loan'
    ELSE 'salary_loan'
  END,
  CASE b.seq % 7
    WHEN 0 THEN 10000 WHEN 1 THEN 15000 WHEN 2 THEN 5000
    WHEN 3 THEN 10000 WHEN 4 THEN 50000 WHEN 5 THEN 5000
    ELSE 10000
  END,
  CASE b.seq % 5 WHEN 0 THEN 'draft' WHEN 1 THEN 'pending' WHEN 2 THEN 'approved' WHEN 3 THEN 'approved' ELSE 'rejected' END,
  b.seq
FROM _seed_borrowers b;

INSERT INTO app_loan_applications (id, borrower_id, product_id, amount_applied, amount_approved, purpose, application_date, status, approved_by, approved_at, notes, created_at, updated_at)
SELECT
  a.id::uuid,
  a.borrower_id::uuid,
  (SELECT id FROM app_loan_products WHERE product_type = a.product_type LIMIT 1),
  a.amount,
  CASE WHEN a.status = 'approved' THEN a.amount ELSE NULL END,
  CASE a.product_type
    WHEN 'micro_enterprise' THEN 'Pangapital para sa sari-sari store'
    WHEN 'agri' THEN 'Pambili ng binhi at pataba'
    WHEN 'emergency' THEN 'Medical emergency'
    WHEN 'education' THEN 'Tuition fee for school year'
    WHEN 'housing' THEN 'Home renovation and repair'
    WHEN 'pension_loan' THEN 'Daily needs and medication'
    WHEN 'salary_loan' THEN 'Personal expenses and bills'
    ELSE 'General purpose'
  END,
  now() - INTERVAL '30 days' * (1 + a.seq % 6),
  a.status,
  CASE WHEN a.status = 'approved' THEN '00000000-0000-0000-0000-000000000002' ELSE NULL END,
  CASE WHEN a.status = 'approved' THEN now() - INTERVAL '15 days' ELSE NULL END,
  CASE WHEN a.status = 'rejected' THEN 'Insufficient credit history' ELSE 'Standard processing' END,
  now(),
  now()
FROM _seed_applications a;

-- ============================================================================
-- 9. app_loans (TEXT id, 18 loans, TEXT borrower_id/collector_id, application_id ::uuid)
-- ============================================================================
DROP TABLE IF EXISTS _seed_loans;
CREATE TEMP TABLE _seed_loans (
  id text PRIMARY KEY,
  borrower_id text,
  collector_id text,
  loan_number text,
  loan_type text,
  principal_amount numeric,
  interest_rate numeric,
  status text,
  release_date timestamptz,
  cycle int,
  application_id text,
  seq int
);
INSERT INTO _seed_loans
SELECT
  gen_random_uuid()::text,
  b.id,
  b.collector_id,
  'LN-' || LPAD((1000 + b.seq)::text, 6, '0'),
  lp.product_type,
  CASE b.seq % 5
    WHEN 0 THEN 5000 WHEN 1 THEN 15000 WHEN 2 THEN 8000
    WHEN 3 THEN 20000 WHEN 4 THEN 12000 END,
  lp.default_rate_percent,
  CASE b.seq % 6
    WHEN 0 THEN 'paid' WHEN 1 THEN 'active' WHEN 2 THEN 'active'
    WHEN 3 THEN 'active' WHEN 4 THEN 'active' ELSE 'defaulted'
  END,
  now() - INTERVAL '6 months' + INTERVAL '1 month' * b.seq,
  1 + b.seq % 3,
  (SELECT a.id FROM _seed_applications a WHERE a.borrower_id = b.id LIMIT 1),
  b.seq
FROM _seed_borrowers b
CROSS JOIN LATERAL (
  SELECT product_type, default_rate_percent FROM app_loan_products ORDER BY random() LIMIT 1
) lp;

INSERT INTO app_loans (id, borrower_id, loan_number, loan_type, principal_amount, interest_rate, interest_type, term, term_unit, frequency, total_amount, installment_amount, release_date, first_payment_date, maturity_date, status, cycle, collector_id, encoded_by, is_delinquent, dpd, aging_bucket, application_id, created_at, updated_at)
SELECT
  l.id,
  l.borrower_id,
  l.loan_number,
  l.loan_type,
  l.principal_amount,
  l.interest_rate,
  'declining',
  6, 'months', 'monthly',
  l.principal_amount * (1 + l.interest_rate / 100 * 6),
  ROUND((l.principal_amount * (1 + l.interest_rate / 100 * 6)) / 6, 2),
  l.release_date,
  l.release_date + INTERVAL '30 days',
  l.release_date + INTERVAL '6 months',
  l.status,
  l.cycle,
  l.collector_id,
  '00000000-0000-0000-0000-000000000002',
  CASE WHEN l.status = 'defaulted' THEN true ELSE false END,
  CASE WHEN l.status = 'defaulted' THEN 45 + l.seq % 90 ELSE 0 END,
  CASE WHEN l.status = 'defaulted' AND l.seq % 90 > 60 THEN '90+' WHEN l.status = 'defaulted' THEN '31-60' ELSE 'current' END,
  l.application_id::uuid,
  now(),
  now()
FROM _seed_loans l;

-- ============================================================================
-- 10. app_payment_schedules (TEXT id, 108 rows, 6 per loan)
-- ============================================================================
DROP TABLE IF EXISTS _seed_schedules;
CREATE TEMP TABLE _seed_schedules (
  id text PRIMARY KEY,
  loan_id text,
  due_date timestamptz,
  scheduled_amount numeric,
  status text
);
DO $$
DECLARE
  r RECORD;
  i INT;
  num_months INT := 6;
BEGIN
  FOR r IN SELECT id, release_date, principal_amount, interest_rate, status FROM _seed_loans LOOP
    FOR i IN 0..num_months-1 LOOP
      INSERT INTO _seed_schedules VALUES (
        gen_random_uuid()::text,
        r.id,
        r.release_date + INTERVAL '1 month' * i,
        ROUND((r.principal_amount * (1 + r.interest_rate / 100 * 6)) / 6, 2),
        CASE
          WHEN r.status = 'paid' THEN 'paid'
          WHEN r.status = 'active' AND i <= 2 THEN 'paid'
          WHEN r.status = 'active' AND i = 3 THEN 'pending'
          WHEN r.status = 'defaulted' AND i <= 1 THEN 'paid'
          WHEN r.status = 'defaulted' AND i = 2 THEN 'overdue'
          ELSE 'pending'
        END
      );
    END LOOP;
  END LOOP;
END $$;

INSERT INTO app_payment_schedules (id, loan_id, due_date, scheduled_amount, status, created_at, updated_at)
SELECT s.id, s.loan_id, s.due_date, s.scheduled_amount, s.status, now(), now()
FROM _seed_schedules s;

-- ============================================================================
-- 11. app_payments (TEXT id, 54 rows)
-- ============================================================================
DROP TABLE IF EXISTS _seed_payments;
CREATE TEMP TABLE _seed_payments (
  id text PRIMARY KEY,
  loan_id text,
  borrower_id text,
  schedule_id text,
  collector_id text,
  amount numeric,
  payment_date timestamptz
);
INSERT INTO _seed_payments
SELECT
  gen_random_uuid()::text,
  s.loan_id,
  l.borrower_id,
  s.id,
  l.collector_id,
  s.scheduled_amount,
  s.due_date - INTERVAL '1 day'
FROM _seed_schedules s
JOIN _seed_loans l ON l.id = s.loan_id
WHERE s.status = 'paid';

INSERT INTO app_payments (id, loan_id, borrower_id, schedule_id, collector_id, amount, payment_date, encoded_at, created_at, updated_at)
SELECT
  p.id, p.loan_id, p.borrower_id, p.schedule_id, p.collector_id,
  p.amount, p.payment_date, p.payment_date, now(), now()
FROM _seed_payments p;

-- ============================================================================
-- 12. app_loan_penalties (TEXT id, 8 rows, BIGINT penalty_date)
-- ============================================================================
INSERT INTO app_loan_penalties (id, loan_id, amount, penalty_date, reason, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  l.id,
  50 + (ROW_NUMBER() OVER ())::int % 4 * 25,
  EXTRACT(EPOCH FROM now() - INTERVAL '1 month' * (1 + (ROW_NUMBER() OVER ())::int % 3)) * 1000,
  CASE (ROW_NUMBER() OVER ())::int % 4 WHEN 0 THEN 'Late payment penalty' WHEN 1 THEN 'Missed installment fee' WHEN 2 THEN 'Late payment surcharge' ELSE 'Overdue account fee' END,
  now(), now()
FROM _seed_loans l
WHERE l.status IN ('active', 'defaulted')
LIMIT 8;

-- ============================================================================
-- 13. app_guarantors (UUID id, 12 rows)
-- ============================================================================
INSERT INTO app_guarantors (id, loan_id, application_id, guarantor_name, contact_no, relationship, created_at, updated_at)
SELECT
  gen_random_uuid(),
  x.id,
  x.application_id::uuid,
  CASE x.s % 5 WHEN 0 THEN 'Roberto S. Mendoza' WHEN 1 THEN 'Lorna M. Villanueva'
    WHEN 2 THEN 'Ricardo D. Fernandez' WHEN 3 THEN 'Marlene O. Castillo' ELSE 'Edwin P. Reyes' END,
  '09' || LPAD((300000000 + x.s)::text, 9, '0'),
  CASE x.s % 4 WHEN 0 THEN 'spouse' WHEN 1 THEN 'sibling' WHEN 2 THEN 'parent' ELSE 'friend' END,
  now(), now()
FROM (SELECT id, application_id, ROW_NUMBER() OVER () AS s FROM _seed_loans WHERE status IN ('active', 'paid') LIMIT 12) x;

-- ============================================================================
-- 14. app_savings_transactions (TEXT id, 18 rows)
-- ============================================================================
INSERT INTO app_savings_transactions (id, borrower_id, type, amount, reference_id, date, notes, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  b.id,
  CASE b.seq % 5 WHEN 0 THEN 'deposit' WHEN 1 THEN 'deposit' WHEN 2 THEN 'deposit' WHEN 3 THEN 'withdrawal' ELSE 'interest' END,
  CASE b.seq % 5 WHEN 0 THEN 500 WHEN 1 THEN 200 WHEN 2 THEN 1000 WHEN 3 THEN 300 ELSE 50 END,
  CASE WHEN b.seq % 5 = 4 THEN (SELECT l.id FROM _seed_loans l WHERE l.borrower_id = b.id LIMIT 1) ELSE NULL END,
  now() - INTERVAL '1 month' * (1 + b.seq % 12),
  CASE b.seq % 5 WHEN 0 THEN 'Monthly savings deposit' WHEN 1 THEN 'Voluntary savings'
    WHEN 2 THEN 'Loan savings requirement' WHEN 3 THEN 'Emergency withdrawal' ELSE 'Interest credit' END,
  now(), now()
FROM _seed_borrowers b
LIMIT 18;

-- ============================================================================
-- 15. app_share_capital_transactions (UUID id, 16 rows, BIGINT dates)
-- ============================================================================
INSERT INTO app_share_capital_transactions (id, member_id, transaction_type, share_type, number_of_shares, par_value, amount, running_balance_shares, running_balance_amount, reference_number, date, notes, recorded_by, created_at, updated_at)
SELECT
  gen_random_uuid(),
  b.id::uuid,
  CASE b.seq % 4 WHEN 0 THEN 'subscription' WHEN 1 THEN 'subscription' WHEN 2 THEN 'subscription' ELSE 'dividend_credit' END,
  'common',
  CASE b.seq % 4 WHEN 0 THEN 10 WHEN 1 THEN 5 WHEN 2 THEN 15 ELSE 2 END,
  100,
  CASE b.seq % 4 WHEN 0 THEN 1000 WHEN 1 THEN 500 WHEN 2 THEN 1500 ELSE 200 END,
  CASE b.seq % 4 WHEN 0 THEN 10 WHEN 1 THEN 15 WHEN 2 THEN 30 ELSE 32 END,
  CASE b.seq % 4 WHEN 0 THEN 1000 WHEN 1 THEN 1500 WHEN 2 THEN 3000 ELSE 3200 END,
  'SC-' || LPAD((4000 + b.seq)::text, 6, '0'),
  EXTRACT(EPOCH FROM now() - INTERVAL '1 month' * (1 + b.seq % 12)) * 1000,
  CASE b.seq % 4 WHEN 0 THEN 'Initial share capital subscription' WHEN 1 THEN 'Additional share capital'
    WHEN 2 THEN 'Required share capital for loan' ELSE 'Annual dividend credit' END,
  '00000000-0000-0000-0000-000000000002',
  EXTRACT(EPOCH FROM now()) * 1000,
  EXTRACT(EPOCH FROM now()) * 1000
FROM _seed_borrowers b
LIMIT 16;

-- ============================================================================
-- 16. app_dependents (UUID id, 15 rows, BIGINT dates)
-- ============================================================================
INSERT INTO app_dependents (id, member_id, name, age, relationship, date_of_birth, created_at, updated_at)
SELECT
  gen_random_uuid(),
  x.id::uuid,
  CASE x.s % 10 WHEN 0 THEN 'Juan Miguel Dela Cruz Jr.' WHEN 1 THEN 'Maria Elena Santos'
    WHEN 2 THEN 'Pedro Reyes III' WHEN 3 THEN 'Ana Marie Garcia'
    WHEN 4 THEN 'Luisa Salvador' WHEN 5 THEN 'Carlos Gonzales Jr.'
    WHEN 6 THEN 'Sofia Mendoza' WHEN 7 THEN 'Diego Morales'
    WHEN 8 THEN 'Isabella Flores' WHEN 9 THEN 'Rafael Torres' END,
  5 + x.s % 15,
  CASE x.s % 3 WHEN 0 THEN 'child' WHEN 1 THEN 'spouse' ELSE 'parent' END,
  EXTRACT(EPOCH FROM now() - INTERVAL '1 year' * (10 + x.s % 40)) * 1000,
  EXTRACT(EPOCH FROM now()) * 1000,
  EXTRACT(EPOCH FROM now()) * 1000
FROM (SELECT id, ROW_NUMBER() OVER () AS s FROM _seed_borrowers ORDER BY random() LIMIT 15) x;

-- ============================================================================
-- 17. app_children (UUID id, 15 rows, BIGINT dates)
-- ============================================================================
INSERT INTO app_children (id, member_id, full_name, date_of_birth, age, created_at, updated_at)
SELECT
  gen_random_uuid(),
  x.id::uuid,
  CASE x.s % 10 WHEN 0 THEN 'Angel Dela Cruz' WHEN 1 THEN 'Mark Tan Reyes'
    WHEN 2 THEN 'Bianca Bautista' WHEN 3 THEN 'Paolo Salvador'
    WHEN 4 THEN 'Samantha Gonzales' WHEN 5 THEN 'Miguel Villanueva'
    WHEN 6 THEN 'Andrea Mendoza' WHEN 7 THEN 'Gabriel Rivera'
    WHEN 8 THEN 'Chloe Ramos' WHEN 9 THEN 'Ethan Aquino' END,
  EXTRACT(EPOCH FROM now() - INTERVAL '1 year' * (3 + x.s % 15)) * 1000,
  3 + x.s % 15,
  EXTRACT(EPOCH FROM now()) * 1000,
  EXTRACT(EPOCH FROM now()) * 1000
FROM (SELECT id, ROW_NUMBER() OVER () AS s FROM _seed_borrowers ORDER BY random() LIMIT 15) x;

-- ============================================================================
-- 18. app_employees (UUID id, 10 rows)
-- ============================================================================
INSERT INTO app_employees (id, name, role, base_salary, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Marites Villaruel',  'Branch Manager',      35000, true, now(), now()),
  (gen_random_uuid(), 'Efren Bautista',     'Loan Officer',        22000, true, now(), now()),
  (gen_random_uuid(), 'Luningning Corpuz',  'Accountant',          28000, true, now(), now()),
  (gen_random_uuid(), 'Rogelio Del Rosario','Field Collector',     18000, true, now(), now()),
  (gen_random_uuid(), 'Belen Magtanggol',   'Administrative Clerk',15000, true, now(), now()),
  (gen_random_uuid(), 'Armando Dimaguiba',  'IT Support',          20000, true, now(), now()),
  (gen_random_uuid(), 'Corazon Salazar',    'Cashier',             17000, true, now(), now()),
  (gen_random_uuid(), 'Isagani Magsaysay',  'Audit Officer',       25000, true, now(), now()),
  (gen_random_uuid(), 'Divina Pascual',     'HR Coordinator',      19000, true, now(), now()),
  (gen_random_uuid(), 'Leopoldo Galang',    'Maintenance Staff',   14000, true, now(), now());

-- ============================================================================
-- 19. app_payrolls (UUID id, 30 rows, employee_id ::uuid)
-- ============================================================================
DROP TABLE IF EXISTS _seed_employees;
CREATE TEMP TABLE _seed_employees AS SELECT id, base_salary, ROW_NUMBER() OVER () AS s FROM app_employees ORDER BY id;

INSERT INTO app_payrolls (id, employee_id, period_start, period_end, base_salary, deductions, allowances, net_pay, status, created_at, updated_at)
SELECT
  gen_random_uuid(),
  e.id,
  now() - INTERVAL '1 month' * m,
  (now() - INTERVAL '1 month' * m) + INTERVAL '15 days',
  e.base_salary,
  ROUND(e.base_salary * 0.12, 2),
  500 + (e.s % 3) * 500,
  ROUND(e.base_salary - e.base_salary * 0.12 + 500 + (e.s % 3) * 500, 2),
  CASE m WHEN 1 THEN 'paid' WHEN 2 THEN 'finalized' ELSE 'draft' END,
  now(), now()
FROM _seed_employees e
CROSS JOIN generate_series(1, 3) AS m
ORDER BY e.s, m
LIMIT 30;

-- ============================================================================
-- 20. app_expenses (TEXT id, 20 rows)
-- ============================================================================
DROP TABLE IF EXISTS _seed_expense_cats;
CREATE TEMP TABLE _seed_expense_cats AS SELECT id, name, ROW_NUMBER() OVER () AS s FROM app_expense_categories ORDER BY name;

INSERT INTO app_expenses (id, category, description, amount, expense_date, frequency, encoded_by, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  ec.name,
  CASE gs.rn % 5
    WHEN 0 THEN 'Monthly electricity bill' WHEN 1 THEN 'Office rent payment'
    WHEN 2 THEN 'Field transportation allowance' WHEN 3 THEN 'Office supplies replenishment'
    ELSE 'Internet and phone charges' END,
  500 + gs.rn % 20 * 250,
  now() - INTERVAL '1 month' * (1 + gs.rn % 6),
  CASE gs.rn % 3 WHEN 0 THEN 'monthly' WHEN 1 THEN 'weekly' ELSE 'one_time' END,
  '00000000-0000-0000-0000-000000000002',
  now(), now()
FROM (SELECT generate_series(1, 20) AS rn) gs
CROSS JOIN LATERAL (SELECT name FROM _seed_expense_cats WHERE s = 1 + gs.rn % 10) ec;

-- ============================================================================
-- 21. app_cash_transactions (TEXT id, 14 rows)
-- ============================================================================
INSERT INTO app_cash_transactions (id, transaction_date, particulars, type, amount, remarks, recorded_by, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  now() - INTERVAL '1 day' * gs.rn,
  CASE gs.rn % 7
    WHEN 0 THEN 'Petty cash replenishment' WHEN 1 THEN 'Office supplies purchase'
    WHEN 2 THEN 'Transportation fare' WHEN 3 THEN 'Client refreshments'
    WHEN 4 THEN 'Bank deposit slip' WHEN 5 THEN 'Staff salary advance'
    ELSE 'Emergency repair payment' END,
  CASE gs.rn % 2 WHEN 0 THEN 'credit' ELSE 'debit' END,
  200 + gs.rn * 150,
  CASE gs.rn % 3 WHEN 0 THEN 'Approved by manager' WHEN 1 THEN '' ELSE 'For reconciliation' END,
  '00000000-0000-0000-0000-000000000002',
  now(), now()
FROM (SELECT generate_series(1, 14) AS rn) gs;

-- ============================================================================
-- 22. app_bank_accounts (TEXT id, 4 rows)
-- ============================================================================
INSERT INTO app_bank_accounts (id, bank_name, account_name, account_number, starting_balance, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, 'BDO Unibank',                      'POS Cursor MPC - Savings',  '0003-1234-5678-90',  150000, now(), now()),
  (gen_random_uuid()::text, 'Land Bank of the Philippines',     'POS Cursor MPC - Current',  '0523-0000-1111-22',  250000, now(), now()),
  (gen_random_uuid()::text, 'BPI',                              'POS Cursor MPC - Payroll',  '0801-3333-4444-55',  100000, now(), now()),
  (gen_random_uuid()::text, 'PNB',                              'POS Cursor MPC - Trust',    '1002-5555-6666-77',   75000, now(), now());

-- ============================================================================
-- 23. app_bank_transactions (TEXT id, 12 rows)
-- ============================================================================
DROP TABLE IF EXISTS _seed_bank_accounts;
CREATE TEMP TABLE _seed_bank_accounts AS SELECT id, ROW_NUMBER() OVER () AS s FROM app_bank_accounts ORDER BY id;

INSERT INTO app_bank_transactions (id, bank_account_id, transaction_date, type, amount, particulars, remarks, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  ba.id,
  now() - INTERVAL '1 week' * gs.rn,
  CASE gs.rn % 2 WHEN 0 THEN 'deposit' ELSE 'withdrawal' END,
  2000 + gs.rn * 500,
  CASE gs.rn % 4
    WHEN 0 THEN 'Loan collections deposit' WHEN 1 THEN 'ATM withdrawal'
    WHEN 2 THEN 'Interest income credit' WHEN 3 THEN 'Check payment' END,
  CASE gs.rn % 3 WHEN 0 THEN 'Verified' ELSE '' END,
  now(), now()
FROM (SELECT generate_series(1, 12) AS rn) gs
CROSS JOIN LATERAL (SELECT id FROM _seed_bank_accounts WHERE s = 1 + gs.rn % 4) ba;

-- ============================================================================
-- 24. app_collection_logs (TEXT id, 10 rows)
-- ============================================================================
INSERT INTO app_collection_logs (id, collector_id, log_date, total_collected, cash_on_hand_start, cash_on_hand_end, notes, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  CASE gs.rn % 7
    WHEN 0 THEN '00000000-0000-0000-0000-000000000003'
    WHEN 1 THEN '00000000-0000-0000-0000-000000000007'
    WHEN 2 THEN '00000000-0000-0000-0000-000000000008'
    WHEN 3 THEN '00000000-0000-0000-0000-000000000009'
    WHEN 4 THEN '00000000-0000-0000-0000-000000000010'
    WHEN 5 THEN '00000000-0000-0000-0000-000000000011'
    ELSE '00000000-0000-0000-0000-000000000013'
  END,
  now() - INTERVAL '1 day' * gs.rn,
  3000 + gs.rn * 500,
  500 + gs.rn * 200,
  3500 + gs.rn * 700,
  CASE gs.rn % 3 WHEN 0 THEN 'All accounts collected' WHEN 1 THEN '2 accounts rescheduled' ELSE 'Normal collection day' END,
  now(), now()
FROM (SELECT generate_series(1, 10) AS rn) gs;

-- ============================================================================
-- 25. app_remittances (TEXT id, 10 rows)
-- ============================================================================
INSERT INTO app_remittances (id, collector_id, amount, remittance_date, status, approved_by, notes, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  CASE gs.rn % 7
    WHEN 0 THEN '00000000-0000-0000-0000-000000000003'
    WHEN 1 THEN '00000000-0000-0000-0000-000000000007'
    WHEN 2 THEN '00000000-0000-0000-0000-000000000008'
    WHEN 3 THEN '00000000-0000-0000-0000-000000000009'
    WHEN 4 THEN '00000000-0000-0000-0000-000000000010'
    WHEN 5 THEN '00000000-0000-0000-0000-000000000011'
    ELSE '00000000-0000-0000-0000-000000000013'
  END,
  5000 + gs.rn * 1000,
  now() - INTERVAL '1 week' * gs.rn,
  CASE gs.rn % 4 WHEN 0 THEN 'pending' WHEN 1 THEN 'approved' WHEN 2 THEN 'approved' ELSE 'rejected' END,
  CASE WHEN gs.rn % 4 IN (1, 2) THEN '00000000-0000-0000-0000-000000000002' ELSE NULL END,
  CASE gs.rn % 3 WHEN 0 THEN 'Weekly remittance' WHEN 1 THEN 'Daily remittance' ELSE 'Bi-weekly remittance' END,
  now(), now()
FROM (SELECT generate_series(1, 10) AS rn) gs;

-- ============================================================================
-- 26. app_committees (UUID id, 6 rows, BIGINT dates)
-- ============================================================================
INSERT INTO app_committees (id, name, type, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Credit Committee',          'standing', true, EXTRACT(EPOCH FROM now()) * 1000, EXTRACT(EPOCH FROM now()) * 1000),
  (gen_random_uuid(), 'Audit Committee',           'standing', true, EXTRACT(EPOCH FROM now()) * 1000, EXTRACT(EPOCH FROM now()) * 1000),
  (gen_random_uuid(), 'Election Committee',        'ad_hoc',   true, EXTRACT(EPOCH FROM now()) * 1000, EXTRACT(EPOCH FROM now()) * 1000),
  (gen_random_uuid(), 'Education & Training Com',  'standing', true, EXTRACT(EPOCH FROM now()) * 1000, EXTRACT(EPOCH FROM now()) * 1000),
  (gen_random_uuid(), 'Grievance Committee',       'standing', true, EXTRACT(EPOCH FROM now()) * 1000, EXTRACT(EPOCH FROM now()) * 1000),
  (gen_random_uuid(), 'Membership Committee',      'standing', true, EXTRACT(EPOCH FROM now()) * 1000, EXTRACT(EPOCH FROM now()) * 1000);

-- ============================================================================
-- 27. app_committee_members (UUID id, 18 rows, BIGINT dates)
-- ============================================================================
DROP TABLE IF EXISTS _seed_committees;
CREATE TEMP TABLE _seed_committees AS SELECT id, ROW_NUMBER() OVER () AS s FROM app_committees ORDER BY id;

INSERT INTO app_committee_members (id, committee_id, member_id, position, term_start, term_end, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  brw.id::uuid,
  CASE ((c.s - 1) * 3 + brw.s2) % 5 WHEN 0 THEN 'Chairperson' WHEN 1 THEN 'Vice-Chair' WHEN 2 THEN 'Secretary' WHEN 3 THEN 'Treasurer' ELSE 'Member' END,
  EXTRACT(EPOCH FROM now() - INTERVAL '6 months') * 1000,
  EXTRACT(EPOCH FROM now() + INTERVAL '18 months') * 1000,
  true,
  EXTRACT(EPOCH FROM now()) * 1000,
  EXTRACT(EPOCH FROM now()) * 1000
FROM _seed_committees c
CROSS JOIN (SELECT id, ROW_NUMBER() OVER () AS s2 FROM _seed_borrowers ORDER BY random() LIMIT 3) brw
LIMIT 18;

-- ============================================================================
-- 28. app_board_resolutions (UUID id, 5 rows, BIGINT dates)
-- ============================================================================
INSERT INTO app_board_resolutions (id, resolution_number, title, description, resolution_date, type, status, approved_by, reference_entity_type, reference_entity_id, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'BR-2024-001', 'Loan Write-off Policy Update',
   'Revised policy for writing off loans delinquent beyond 180 days.',
   EXTRACT(EPOCH FROM now() - INTERVAL '6 months') * 1000,
   'policy', 'approved', '00000000-0000-0000-0000-000000000002', 'loan', NULL,
   EXTRACT(EPOCH FROM now()) * 1000, EXTRACT(EPOCH FROM now()) * 1000),
  (gen_random_uuid(), 'BR-2024-002', 'New Member Approval',
   'Batch approval of 25 new cooperative members for Q2 2024.',
   EXTRACT(EPOCH FROM now() - INTERVAL '5 months') * 1000,
   'membership', 'approved', '00000000-0000-0000-0000-000000000002', 'borrower', NULL,
   EXTRACT(EPOCH FROM now()) * 1000, EXTRACT(EPOCH FROM now()) * 1000),
  (gen_random_uuid(), 'BR-2024-003', 'Interest Rate Adjustment',
   'Reduction of emergency loan interest from 5% to 4.5% per month.',
   EXTRACT(EPOCH FROM now() - INTERVAL '4 months') * 1000,
   'policy', 'approved', '00000000-0000-0000-0000-000000000002', 'product', NULL,
   EXTRACT(EPOCH FROM now()) * 1000, EXTRACT(EPOCH FROM now()) * 1000),
  (gen_random_uuid(), 'BR-2024-004', 'Branch Expansion Feasibility',
   'Feasibility study for opening a new branch in Urdaneta City.',
   EXTRACT(EPOCH FROM now() - INTERVAL '3 months') * 1000,
   'strategic', 'pending', NULL, 'branch', NULL,
   EXTRACT(EPOCH FROM now()) * 1000, EXTRACT(EPOCH FROM now()) * 1000),
  (gen_random_uuid(), 'BR-2024-005', 'Audit Committee Annual Report',
   'Acceptance of the Audit Committee annual report for FY 2023.',
   EXTRACT(EPOCH FROM now() - INTERVAL '2 months') * 1000,
   'report', 'approved', '00000000-0000-0000-0000-000000000002', 'audit', NULL,
   EXTRACT(EPOCH FROM now()) * 1000, EXTRACT(EPOCH FROM now()) * 1000);

-- ============================================================================
-- 29. app_meeting_attendance (UUID id, 18 rows, BIGINT dates)
-- ============================================================================
INSERT INTO app_meeting_attendance (id, member_id, meeting_type, meeting_date, is_present, notes, created_at, updated_at)
SELECT
  gen_random_uuid(),
  x.id::uuid,
  CASE x.s % 3 WHEN 0 THEN 'general_assembly' WHEN 1 THEN 'center_meeting' ELSE 'committee_meeting' END,
  EXTRACT(EPOCH FROM now() - INTERVAL '1 month' * (1 + x.s % 12)) * 1000,
  CASE x.s % 5 WHEN 0 THEN false ELSE true END,
  CASE WHEN x.s % 5 = 0 THEN 'Absent with notice' ELSE 'Present and participated' END,
  EXTRACT(EPOCH FROM now()) * 1000,
  EXTRACT(EPOCH FROM now()) * 1000
FROM (SELECT id, ROW_NUMBER() OVER () AS s FROM _seed_borrowers ORDER BY random() LIMIT 18) x;

-- ============================================================================
-- 30. app_file_cases (UUID id, 4 rows, BIGINT dates)
-- ============================================================================
INSERT INTO app_file_cases (id, loan_id, borrower_id, case_number, filed_date, status, notes, filed_by, created_at, updated_at)
SELECT
  gen_random_uuid(),
  x.id::uuid,
  x.borrower_id::uuid,
  'FC-' || LPAD((2000 + x.s)::text, 6, '0'),
  EXTRACT(EPOCH FROM now() - INTERVAL '1 month' * (1 + x.s)) * 1000,
  CASE x.s WHEN 1 THEN 'open' WHEN 2 THEN 'open' WHEN 3 THEN 'resolved' ELSE 'pending' END,
  CASE x.s WHEN 1 THEN 'Filed at MTC Dagupan - Small Claims Case No. 2345'
    WHEN 2 THEN 'Filed at RTC Lingayen - Civil Case No. 5678'
    WHEN 3 THEN 'Amicable settlement reached - case closed'
    ELSE 'Demand letter sent - awaiting response' END,
  '00000000-0000-0000-0000-000000000002',
  EXTRACT(EPOCH FROM now()) * 1000,
  EXTRACT(EPOCH FROM now()) * 1000
FROM (SELECT id, borrower_id, ROW_NUMBER() OVER () AS s FROM _seed_loans WHERE status = 'defaulted' LIMIT 4) x;

-- ============================================================================
-- 31. app_financial_snapshots (TEXT id, 3 rows)
-- ============================================================================
INSERT INTO app_financial_snapshots (id, snapshot_date, total_assets, total_equity, total_liabilities, loan_loss_reserve, operating_revenue, financial_costs, subsidy_adjustment, inflation_adjustment, risk_weighted_assets, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, now() - INTERVAL '3 months', 2500000, 1800000, 700000, 50000, 350000, 45000, 0, 12000, 1800000, now(), now()),
  (gen_random_uuid()::text, now() - INTERVAL '2 months', 2650000, 1920000, 730000, 52000, 380000, 48000, 0, 13000, 1920000, now(), now()),
  (gen_random_uuid()::text, now() - INTERVAL '1 month',  2800000, 2050000, 750000, 55000, 420000, 50000, 5000, 14000, 2050000, now(), now());

-- ============================================================================
-- 32. app_action_logs (TEXT id, 15 rows)
-- ============================================================================
INSERT INTO app_action_logs (id, entity_type, entity_id, action, performed_by, old_data, new_data, timestamp, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  CASE gs.rn % 6
    WHEN 0 THEN 'loan' WHEN 1 THEN 'borrower' WHEN 2 THEN 'payment'
    WHEN 3 THEN 'application' WHEN 4 THEN 'collection' ELSE 'remittance' END,
  LPAD(gs.rn::text, 36, '0'),
  CASE gs.rn % 7
    WHEN 0 THEN 'created' WHEN 1 THEN 'updated' WHEN 2 THEN 'approved'
    WHEN 3 THEN 'deleted' WHEN 4 THEN 'exported' WHEN 5 THEN 'logged_in'
    ELSE 'logged_out' END,
  '00000000-0000-0000-0000-000000000002',
  CASE WHEN gs.rn % 3 = 0 THEN '{"status":"pending"}' ELSE NULL END,
  CASE WHEN gs.rn % 3 = 0 THEN '{"status":"approved"}' ELSE NULL END,
  now() - INTERVAL '1 hour' * gs.rn,
  now(), now()
FROM (SELECT generate_series(1, 15) AS rn) gs;

-- ============================================================================
-- CLEANUP: Drop temp tables
-- ============================================================================
DROP TABLE IF EXISTS _seed_borrowers;
DROP TABLE IF EXISTS _seed_applications;
DROP TABLE IF EXISTS _seed_loans;
DROP TABLE IF EXISTS _seed_schedules;
DROP TABLE IF EXISTS _seed_payments;
DROP TABLE IF EXISTS _seed_employees;
DROP TABLE IF EXISTS _seed_expense_cats;
DROP TABLE IF EXISTS _seed_bank_accounts;
DROP TABLE IF EXISTS _seed_committees;

-- ============================================================================
-- DONE: All 32 tables seeded with mock data.
-- ============================================================================
