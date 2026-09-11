-- ============================================================================
-- Seed All Modules with Mock Data — POS Cursor / POSCursor
-- Run: docker exec -i supabase_db_jetfarm-local psql -U postgres < scripts/seed-all-mock-data.sql
-- ============================================================================
-- Populates ALL 37+ tables with realistic Philippine microfinance mock data.
-- Safe to re-run (DELETE + INSERT pattern).
--
-- NOTE: temp table IDs are stored as text with ::text cast for cross-table
-- compatibility. UUID-column tables cast back to uuid on INSERT.
-- ============================================================================

-- No wrapping transaction — each statement auto-commits
-- Errors only affect their specific DELETE/INSERT pair
-- ============================================================================
-- ============================================================================
-- 1. CORE REFERENCE DATA (no FK dependencies)
-- ============================================================================

-- 1a. Areas
DELETE FROM app_areas;
INSERT INTO app_areas (id, name, code, parent_area_id, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Region I - Ilocos', 'REG-01', NULL, true, now(), now()),
  (gen_random_uuid(), 'CAR - Cordillera', 'REG-02', NULL, true, now(), now()),
  (gen_random_uuid(), 'Pangasinan', 'PROV-01', (SELECT id FROM app_areas WHERE code = 'REG-01'), true, now(), now()),
  (gen_random_uuid(), 'La Union', 'PROV-02', (SELECT id FROM app_areas WHERE code = 'REG-01'), true, now(), now()),
  (gen_random_uuid(), 'Dagupan City', 'CITY-01', (SELECT id FROM app_areas WHERE code = 'PROV-01'), true, now(), now()),
  (gen_random_uuid(), 'Calasiao', 'CITY-02', (SELECT id FROM app_areas WHERE code = 'PROV-01'), true, now(), now()),
  (gen_random_uuid(), 'Lingayen', 'CITY-03', (SELECT id FROM app_areas WHERE code = 'PROV-01'), true, now(), now()),
  (gen_random_uuid(), 'San Carlos City', 'CITY-04', (SELECT id FROM app_areas WHERE code = 'PROV-01'), true, now(), now()),
  (gen_random_uuid(), 'Binmaley', 'CITY-05', (SELECT id FROM app_areas WHERE code = 'PROV-01'), true, now(), now()),
  (gen_random_uuid(), 'Bantay', 'BRGY-01', (SELECT id FROM app_areas WHERE code = 'CITY-01'), true, now(), now()),
  (gen_random_uuid(), 'Bonuan Gueset', 'BRGY-02', (SELECT id FROM app_areas WHERE code = 'CITY-01'), true, now(), now()),
  (gen_random_uuid(), 'Bonuan Binloc', 'BRGY-03', (SELECT id FROM app_areas WHERE code = 'CITY-01'), true, now(), now()),
  (gen_random_uuid(), 'Dagupan Heights', 'BRGY-04', (SELECT id FROM app_areas WHERE code = 'CITY-01'), true, now(), now()),
  (gen_random_uuid(), 'Lasip Chico', 'BRGY-05', (SELECT id FROM app_areas WHERE code = 'CITY-01'), true, now(), now()),
  (gen_random_uuid(), 'Mabini', 'BRGY-06', (SELECT id FROM app_areas WHERE code = 'CITY-01'), true, now(), now()),
  (gen_random_uuid(), 'Nalsian', 'BRGY-07', (SELECT id FROM app_areas WHERE code = 'CITY-02'), true, now(), now()),
  (gen_random_uuid(), 'San Miguel', 'BRGY-08', (SELECT id FROM app_areas WHERE code = 'CITY-02'), true, now(), now()),
  (gen_random_uuid(), 'Dinalaoan', 'BRGY-09', (SELECT id FROM app_areas WHERE code = 'CITY-02'), true, now(), now()),
  (gen_random_uuid(), 'Talibaew', 'BRGY-10', (SELECT id FROM app_areas WHERE code = 'CITY-02'), true, now(), now());

-- 1b. Loan Products (text id)
DELETE FROM app_loan_products;
INSERT INTO app_loan_products (id, product_type, label, description, default_rate_percent, default_term, default_term_unit, default_frequency, default_processing_fee_rate, default_notarial_fee, default_savings_per_payment, default_principal, max_principal, min_term_months, max_term_months, is_active, sort_order, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, 'micro_enterprise', 'Micro Enterprise Loan', 'For small business owners and entrepreneurs', 3.5, 6, 'months', 'daily', 2.0, 100, 20, 10000, 50000, 1, 12, true, 1, now(), now()),
  (gen_random_uuid()::text, 'agri', 'Agricultural Loan', 'For farmers and agricultural needs', 2.5, 12, 'months', 'monthly', 1.5, 0, 50, 15000, 100000, 3, 24, true, 2, now(), now()),
  (gen_random_uuid()::text, 'emergency', 'Emergency Loan', 'Quick release for emergency needs', 5.0, 3, 'months', 'monthly', 1.0, 0, 10, 5000, 20000, 1, 6, true, 3, now(), now()),
  (gen_random_uuid()::text, 'education', 'Educational Loan', 'For tuition and school expenses', 2.0, 12, 'months', 'monthly', 1.0, 0, 30, 10000, 50000, 3, 24, true, 4, now(), now()),
  (gen_random_uuid()::text, 'housing', 'Housing Loan', 'For home improvement and construction', 1.5, 24, 'months', 'monthly', 2.5, 500, 100, 50000, 300000, 12, 60, true, 5, now(), now()),
  (gen_random_uuid()::text, 'pension_loan', 'Pension Loan', 'For senior citizens and pensioners', 4.0, 6, 'months', 'monthly', 1.0, 0, 15, 5000, 25000, 1, 12, true, 6, now(), now()),
  (gen_random_uuid()::text, 'salary_loan', 'Salary Loan', 'For employed individuals', 3.0, 6, 'months', 'monthly', 1.5, 0, 25, 10000, 30000, 1, 12, true, 7, now(), now());

-- 1c. Expense Categories (text id)
DELETE FROM app_expense_categories;
INSERT INTO app_expense_categories (id, name, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, 'Utilities', true, now(), now()),
  (gen_random_uuid()::text, 'Rent', true, now(), now()),
  (gen_random_uuid()::text, 'Salaries & Wages', true, now(), now()),
  (gen_random_uuid()::text, 'Transportation', true, now(), now()),
  (gen_random_uuid()::text, 'Office Supplies', true, now(), now()),
  (gen_random_uuid()::text, 'Communication', true, now(), now()),
  (gen_random_uuid()::text, 'Taxes & Licenses', true, now(), now()),
  (gen_random_uuid()::text, 'Maintenance & Repairs', true, now(), now()),
  (gen_random_uuid()::text, 'Marketing & Promotions', true, now(), now()),
  (gen_random_uuid()::text, 'Miscellaneous', true, now(), now());

-- 1d. Feature Flags (text id)
DELETE FROM app_feature_flags;
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

-- 1e. App Settings (text id)
DELETE FROM app_settings;
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

-- 1f. Role Permissions (text id)
DELETE FROM app_role_permissions;
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
-- 2. COLLECTION GROUPS — depends on collectors (both text id)
-- ============================================================================
DELETE FROM collection_groups;
INSERT INTO collection_groups (id, name, collector_id, collection_day, group_type, area_id, center_day_name, center_time, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Bonuan Center A', '00000000-0000-0000-0000-000000000003'::uuid, 1, 'center', NULL, 'Monday', '09:00 AM', true, now(), now()),
  (gen_random_uuid(), 'Calasiao Group 1', '00000000-0000-0000-0000-000000000007'::uuid, 2, 'group', NULL, 'Tuesday', '10:00 AM', true, now(), now()),
  (gen_random_uuid(), 'Lingayen Circle', '00000000-0000-0000-0000-000000000008'::uuid, 3, 'center', NULL, 'Wednesday', '08:30 AM', true, now(), now()),
  (gen_random_uuid(), 'San Carlos Cluster', '00000000-0000-0000-0000-000000000009'::uuid, 4, 'group', NULL, 'Thursday', '09:00 AM', true, now(), now()),
  (gen_random_uuid(), 'Binmaley Association', '00000000-0000-0000-0000-000000000010'::uuid, 5, 'group', NULL, 'Friday', '10:30 AM', true, now(), now()),
  (gen_random_uuid(), 'Bantay Center', '00000000-0000-0000-0000-000000000013'::uuid, 1, 'center', NULL, 'Saturday', '08:00 AM', true, now(), now()),
  (gen_random_uuid(), 'Downtown Dagupan', '00000000-0000-0000-0000-000000000011'::uuid, 2, 'group', NULL, 'Monday', '01:00 PM', true, now(), now());

-- ============================================================================
-- 3. BORROWERS — depends on collectors (borrowers id=uuid, collector_id=uuid)
-- ============================================================================
DROP TABLE IF EXISTS _seed_borrowers;
CREATE TEMP TABLE _seed_borrowers (
  id text PRIMARY KEY,
  full_name text,
  collector_id text,
  area text,
  membership_number text
);

INSERT INTO _seed_borrowers VALUES
  (gen_random_uuid()::text, 'Maria Santos Dela Cruz',   '00000000-0000-0000-0000-000000000003', 'Dagupan City',       'SMPC-2024-001'),
  (gen_random_uuid()::text, 'Juan Miguel Tan Reyes',    '00000000-0000-0000-0000-000000000003', 'Dagupan City',       'SMPC-2024-002'),
  (gen_random_uuid()::text, 'Ana Louise Bautista Garcia', '00000000-0000-0000-0000-000000000007', 'Calasiao',           'SMPC-2024-003'),
  (gen_random_uuid()::text, 'Pedro Cruz Salvador',      '00000000-0000-0000-0000-000000000007', 'Calasiao',           'SMPC-2024-004'),
  (gen_random_uuid()::text, 'Elena Ferrer Gonzales',    '00000000-0000-0000-0000-000000000008', 'Lingayen',           'SMPC-2024-005'),
  (gen_random_uuid()::text, 'Ramon Villanueva Castro',  '00000000-0000-0000-0000-000000000008', 'Lingayen',           'SMPC-2024-006'),
  (gen_random_uuid()::text, 'Carmen Lopez Mendoza',     '00000000-0000-0000-0000-000000000009', 'San Carlos City',    'SMPC-2024-007'),
  (gen_random_uuid()::text, 'Antonio Rivera Morales',   '00000000-0000-0000-0000-000000000009', 'San Carlos City',    'SMPC-2024-008'),
  (gen_random_uuid()::text, 'Luzviminda Aquino Santos', '00000000-0000-0000-0000-000000000010', 'Binmaley',           'SMPC-2024-009'),
  (gen_random_uuid()::text, 'Roberto Ramos Flores',     '00000000-0000-0000-0000-000000000010', 'Binmaley',           'SMPC-2024-010'),
  (gen_random_uuid()::text, 'Gloria Macapagal Torres',  '00000000-0000-0000-0000-000000000013', 'Dagupan City',       'SMPC-2024-011'),
  (gen_random_uuid()::text, 'Ferdinand Castillo Gomez', '00000000-0000-0000-0000-000000000013', 'Dagupan City',       'SMPC-2024-012'),
  (gen_random_uuid()::text, 'Josephine Santiago',       '00000000-0000-0000-0000-000000000003', 'Dagupan City',       'SMPC-2024-013'),
  (gen_random_uuid()::text, 'Dante Mercader Ignacio',   '00000000-0000-0000-0000-000000000007', 'Calasiao',           'SMPC-2024-014'),
  (gen_random_uuid()::text, 'Rosario Panganiban Lee',   '00000000-0000-0000-0000-000000000008', 'Lingayen',           'SMPC-2024-015'),
  (gen_random_uuid()::text, 'Cristina Alegre Valdez',   '00000000-0000-0000-0000-000000000009', 'San Carlos City',    'SMPC-2024-016'),
  (gen_random_uuid()::text, 'Teodoro Bautista Pascual', '00000000-0000-0000-0000-000000000010', 'Binmaley',           'SMPC-2024-017'),
  (gen_random_uuid()::text, 'Nieves Manalo Roxas',      '00000000-0000-0000-0000-000000000011', 'Dagupan City',       'SMPC-2024-018');

DELETE FROM app_borrowers;
INSERT INTO app_borrowers (id, full_name, first_name, last_name, address, area, collector_id, membership_number, civil_status, contact_no, source_of_income, business, meeting_day, barangay, city_municipality, province, created_at, updated_at)
SELECT
  b.id::uuid,
  b.full_name,
  SPLIT_PART(b.full_name, ' ', 1),
  SPLIT_PART(b.full_name, ' ', ARRAY_LENGTH(STRING_TO_ARRAY(b.full_name, ' '), 1)),
  b.area || ', Pangasinan',
  b.area,
  b.collector_id::uuid,
  b.membership_number,
  CASE rn % 3 WHEN 0 THEN 'married' WHEN 1 THEN 'single' ELSE 'married' END,
  '09' || LPAD((100000000 + rn)::text, 9, '0'),
  CASE rn % 4 WHEN 0 THEN 'employed' WHEN 1 THEN 'self_employed' WHEN 2 THEN 'business' ELSE 'farming' END,
  CASE rn % 4 WHEN 0 THEN 'Sari-Sari Store' WHEN 1 THEN 'Rice Trading' WHEN 2 THEN 'Fishing' ELSE 'Poultry' END,
  rn % 7 + 1,
  CASE b.area WHEN 'Dagupan City' THEN 'Bonuan Gueset' WHEN 'Calasiao' THEN 'Nalsian' WHEN 'Lingayen' THEN 'Mabini' WHEN 'San Carlos City' THEN 'San Miguel' WHEN 'Binmaley' THEN 'Dinalaoan' ELSE 'Bantay' END,
  b.area,
  'Pangasinan',
  now(),
  now()
FROM (SELECT *, ROW_NUMBER() OVER () AS rn FROM _seed_borrowers) b;

-- ============================================================================
-- 4. LOAN APPLICATIONS — depends on borrowers (uuid id, uuid borrower_id)
-- ============================================================================
DROP TABLE IF EXISTS _seed_applications;
CREATE TEMP TABLE _seed_applications (
  id text PRIMARY KEY,
  borrower_id text,
  product_type text,
  amount numeric,
  status text
);

INSERT INTO _seed_applications
SELECT
  gen_random_uuid()::text,
  b.id,
  (SELECT product_type FROM app_loan_products ORDER BY random() LIMIT 1),
  CASE (SELECT product_type FROM app_loan_products ORDER BY random() LIMIT 1)
    WHEN 'micro_enterprise' THEN 10000 WHEN 'agri' THEN 15000
    WHEN 'emergency' THEN 5000 WHEN 'education' THEN 10000
    WHEN 'housing' THEN 50000 WHEN 'pension_loan' THEN 5000
    WHEN 'salary_loan' THEN 10000 ELSE 5000
  END,
  CASE rn % 5 WHEN 0 THEN 'draft' WHEN 1 THEN 'pending' WHEN 2 THEN 'approved' WHEN 3 THEN 'approved' ELSE 'rejected' END
FROM (SELECT *, ROW_NUMBER() OVER () AS rn FROM _seed_borrowers) b;

DELETE FROM app_loan_applications;
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
    WHEN 'education' THEN 'Tuition fee'
    WHEN 'housing' THEN 'Home renovation'
    WHEN 'pension_loan' THEN 'Daily needs'
    WHEN 'salary_loan' THEN 'Personal expenses'
    ELSE 'General purpose'
  END,
  now() - INTERVAL '30 days' * (1 + rn % 6),
  a.status,
  CASE WHEN a.status = 'approved' THEN '00000000-0000-0000-0000-000000000002' ELSE NULL END,
  CASE WHEN a.status = 'approved' THEN now() - INTERVAL '15 days' ELSE NULL END,
  CASE WHEN a.status = 'rejected' THEN 'Insufficient credit history' ELSE 'Standard processing' END,
  now(),
  now()
FROM (SELECT a.*, ROW_NUMBER() OVER () AS rn FROM _seed_applications a) a;

-- ============================================================================
-- 5. LOANS — depends on borrowers (text id, text borrower_id, text collector_id)
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
  rn int
);

INSERT INTO _seed_loans
SELECT
  gen_random_uuid()::text,
  b.id,
  b.collector_id,
  'LN-' || LPAD((1000 + ROW_NUMBER() OVER ())::text, 6, '0'),
  lp.product_type,
  CASE WHEN b.full_name LIKE '%Dela Cruz%' THEN 5000
       WHEN b.full_name LIKE '%Reyes%' THEN 15000
       ELSE (1000 + (ROW_NUMBER() OVER ()) % 10 * 1000)::numeric
  END,
  lp.default_rate_percent,
  CASE (ROW_NUMBER() OVER ()) % 6
    WHEN 0 THEN 'paid' WHEN 1 THEN 'active' WHEN 2 THEN 'active'
    WHEN 3 THEN 'active' WHEN 4 THEN 'active' ELSE 'defaulted'
  END,
  now() - INTERVAL '6 months' + INTERVAL '1 month' * (ROW_NUMBER() OVER ()),
  1 + (ROW_NUMBER() OVER ()) % 3,
  (SELECT id FROM _seed_applications sa WHERE sa.borrower_id = b.id LIMIT 1),
  ROW_NUMBER() OVER ()
FROM _seed_borrowers b
CROSS JOIN LATERAL (SELECT product_type, default_rate_percent FROM app_loan_products ORDER BY random() LIMIT 1) lp;

DELETE FROM app_loans;
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
  (l.principal_amount * (1 + l.interest_rate / 100 * 6)) / 6,
  l.release_date,
  l.release_date + INTERVAL '30 days',
  l.release_date + INTERVAL '6 months',
  l.status,
  l.cycle,
  l.collector_id,
  '00000000-0000-0000-0000-000000000002',
  CASE WHEN l.status = 'defaulted' THEN true ELSE false END,
  CASE WHEN l.status = 'defaulted' THEN 45 + l.rn % 90 ELSE 0 END,
  CASE WHEN l.status = 'defaulted' AND l.rn % 90 > 60 THEN '90+' WHEN l.status = 'defaulted' THEN '31-60' ELSE 'current' END,
  l.application_id::uuid,
  now(),
  now()
FROM _seed_loans l;

-- ============================================================================
-- 6. PAYMENT SCHEDULES — depends on loans (text id, text loan_id)
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
        (r.principal_amount * (1 + r.interest_rate / 100 * 6)) / 6,
        CASE
          WHEN r.status = 'paid' AND i <= 3 THEN 'paid'
          WHEN r.status = 'paid' AND i > 3 THEN 'pending'
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

DELETE FROM app_payment_schedules;
INSERT INTO app_payment_schedules (id, loan_id, due_date, scheduled_amount, status, created_at, updated_at)
SELECT
  s.id, s.loan_id, s.due_date,
  s.scheduled_amount, s.status, now(), now()
FROM _seed_schedules s;

-- ============================================================================
-- 7. PAYMENTS — depends on loans, schedules (text ids)
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

DELETE FROM app_payments;
INSERT INTO app_payments (id, loan_id, borrower_id, schedule_id, collector_id, amount, payment_date, encoded_at, created_at, updated_at)
SELECT
  p.id, p.loan_id, p.borrower_id, p.schedule_id, p.collector_id,
  p.amount, p.payment_date, p.payment_date, now(), now()
FROM _seed_payments p;

-- ============================================================================
-- 8. LOAN PENALTIES — depends on loans (text ids)
-- ============================================================================
DELETE FROM app_loan_penalties;
INSERT INTO app_loan_penalties (id, loan_id, amount, penalty_date, reason, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  l.id,
  50 + (ROW_NUMBER() OVER ()) % 4 * 25,
  EXTRACT(EPOCH FROM now() - INTERVAL '1 month' * (1 + (ROW_NUMBER() OVER ()) % 3)) * 1000,
  CASE (ROW_NUMBER() OVER ()) % 4 WHEN 0 THEN 'Late payment' WHEN 1 THEN 'Missed installment' WHEN 2 THEN 'Late payment' ELSE 'Overdue fee' END,
  now(), now()
FROM _seed_loans l
WHERE l.status IN ('active', 'defaulted')
LIMIT 8;

-- ============================================================================
-- 9. GUARANTORS — uuid id, uuid application_id, uuid member_id, text loan_id
-- ============================================================================
DELETE FROM app_guarantors;
INSERT INTO app_guarantors (id, loan_id, application_id, guarantor_name, contact_no, relationship, created_at, updated_at)
SELECT
  gen_random_uuid(),
  l.id,
  l.application_id::uuid,
  CASE rn % 5 WHEN 0 THEN 'Roberto S. Mendoza' WHEN 1 THEN 'Lorna M. Villanueva'
    WHEN 2 THEN 'Ricardo D. Fernandez' WHEN 3 THEN 'Marlene O. Castillo' ELSE 'Edwin P. Reyes' END,
  '09' || LPAD((300000000 + rn)::text, 9, '0'),
  CASE rn % 4 WHEN 0 THEN 'spouse' WHEN 1 THEN 'sibling' WHEN 2 THEN 'parent' ELSE 'friend' END,
  now(), now()
FROM (SELECT *, ROW_NUMBER() OVER () AS seq_rn FROM _seed_loans WHERE status IN ('active', 'paid') LIMIT 12) l;

-- ============================================================================
-- 10. SAVINGS TRANSACTIONS — text ids
-- ============================================================================
DELETE FROM app_savings_transactions;
INSERT INTO app_savings_transactions (id, borrower_id, type, amount, reference_id, date, notes, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  b.id,
  CASE rn % 5 WHEN 0 THEN 'deposit' WHEN 1 THEN 'deposit' WHEN 2 THEN 'deposit' WHEN 3 THEN 'withdrawal' ELSE 'interest' END,
  CASE rn % 5 WHEN 0 THEN 500 WHEN 1 THEN 200 WHEN 2 THEN 1000 WHEN 3 THEN 300 ELSE 50 END,
  CASE WHEN rn % 5 = 4 THEN (SELECT id FROM _seed_loans l WHERE l.borrower_id = b.id LIMIT 1) ELSE NULL END,
  now() - INTERVAL '1 month' * (1 + rn % 12),
  CASE rn % 5 WHEN 0 THEN 'Monthly savings' WHEN 1 THEN 'Voluntary savings'
    WHEN 2 THEN 'Loan savings requirement' WHEN 3 THEN 'Withdrawal for emergency' ELSE 'Interest credit' END,
  now(), now()
FROM (SELECT *, ROW_NUMBER() OVER () AS rn FROM _seed_borrowers) b
LIMIT 20;

-- ============================================================================
-- 11. SHARE CAPITAL TRANSACTIONS — uuid id, uuid member_id
-- ============================================================================
DELETE FROM app_share_capital_transactions;
INSERT INTO app_share_capital_transactions (id, member_id, transaction_type, share_type, number_of_shares, par_value, amount, running_balance_shares, running_balance_amount, reference_number, date, notes, recorded_by, created_at, updated_at)
SELECT
  gen_random_uuid(),
  b.id::uuid,
  CASE rn % 4 WHEN 0 THEN 'subscription' WHEN 1 THEN 'subscription' WHEN 2 THEN 'subscription' ELSE 'dividend_credit' END,
  'common',
  CASE rn % 4 WHEN 0 THEN 10 WHEN 1 THEN 5 WHEN 2 THEN 15 ELSE 2 END,
  100,
  CASE rn % 4 WHEN 0 THEN 1000 WHEN 1 THEN 500 WHEN 2 THEN 1500 ELSE 200 END,
  CASE rn % 4 WHEN 0 THEN 10 WHEN 1 THEN 15 WHEN 2 THEN 30 ELSE 32 END,
  CASE rn % 4 WHEN 0 THEN 1000 WHEN 1 THEN 1500 WHEN 2 THEN 3000 ELSE 3200 END,
  'SC-' || LPAD((4000 + rn)::text, 6, '0'),
  EXTRACT(EPOCH FROM now() - INTERVAL '1 month' * (1 + rn % 12)) * 1000,
  CASE rn % 4 WHEN 0 THEN 'Initial share capital subscription' WHEN 1 THEN 'Additional share capital'
    WHEN 2 THEN 'Required share capital for loan' ELSE 'Annual dividend credit' END,
  '00000000-0000-0000-0000-000000000002',
  EXTRACT(EPOCH FROM now()) * 1000,
  EXTRACT(EPOCH FROM now()) * 1000
FROM (SELECT *, ROW_NUMBER() OVER () AS rn FROM _seed_borrowers) b
LIMIT 16;

-- ============================================================================
-- 12. DEPENDENTS — uuid id, uuid member_id
-- ============================================================================
DELETE FROM app_dependents;
INSERT INTO app_dependents (id, member_id, name, age, relationship, date_of_birth, created_at, updated_at)
SELECT
  gen_random_uuid(),
  b.id::uuid,
  CASE rn % 10 WHEN 0 THEN 'Juan Miguel Dela Cruz Jr.' WHEN 1 THEN 'Maria Elena Santos'
    WHEN 2 THEN 'Pedro Reyes III' WHEN 3 THEN 'Ana Marie Garcia'
    WHEN 4 THEN 'Luisa Salvador' WHEN 5 THEN 'Carlos Gonzales Jr.'
    WHEN 6 THEN 'Sofia Mendoza' WHEN 7 THEN 'Diego Morales'
    WHEN 8 THEN 'Isabella Flores' WHEN 9 THEN 'Rafael Torres' END,
  5 + rn % 15,
  CASE rn % 3 WHEN 0 THEN 'child' WHEN 1 THEN 'spouse' ELSE 'parent' END,
  EXTRACT(EPOCH FROM now() - INTERVAL '1 year' * (10 + rn % 40)) * 1000,
  EXTRACT(EPOCH FROM now()) * 1000,
  EXTRACT(EPOCH FROM now()) * 1000
FROM (SELECT *, ROW_NUMBER() OVER () AS rn FROM _seed_borrowers) b
LIMIT 15;
