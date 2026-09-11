BEGIN;
CREATE OR REPLACE FUNCTION public.mock10_uuid(ns int, n int)
RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-' || lpad(ns::text, 4, '0') || '-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;

INSERT INTO public.user_profiles (id, full_name, role, is_active, email, created_at, updated_at)
SELECT format('mock10-profile-%s', lpad(i::text, 2, '0')), format('MOCK10 User %s', lpad(i::text, 2, '0')), (ARRAY['admin','collector','loan_encoder','payment_encoder','expenses_encoder','borrower','main_office','collector','borrower','collector'])[i], true, format('mock10.user.%s@example.test', lpad(i::text, 2, '0')), now(), now()
FROM generate_series(1, 10) s(i)
ON CONFLICT (id) DO UPDATE SET full_name=excluded.full_name, role=excluded.role, is_active=true, email=excluded.email, updated_at=now();

INSERT INTO public.app_collectors (id, full_name, auth_id, is_active, created_at, updated_at, deleted_at)
SELECT public.mock10_uuid(1000,i)::text, format('MOCK10 Collector %s', lpad(i::text,2,'0')), NULL, true, now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET full_name=excluded.full_name, is_active=true, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_borrowers (id, full_name, first_name, last_name, address, phone, area, route_index, collector_id, date_of_birth, gender, notes, latitude, longitude, "group", co_maker_name, business, created_at, updated_at, deleted_at)
SELECT public.mock10_uuid(2000,i), format('MOCK10 Borrower %s', lpad(i::text,2,'0')), 'MOCK10', format('Borrower %s', lpad(i::text,2,'0')), format('Mock Street %s, Test City', i), format('0917000%s', lpad(i::text,4,'0')), format('Area %s', ((i-1)%5)+1), i, public.mock10_uuid(1000, ((i-1)%10)+1), now() - interval '20 years' - (i * interval '30 days'), CASE WHEN i%2=0 THEN 'Female' ELSE 'Male' END, 'MOCK10 borrower seed record', 16.04+(i*0.001), 120.33+(i*0.001), format('MOCK10 Group %s', ((i-1)%3)+1), format('MOCK10 Co-maker %s', i), format('Mock Business %s', i), now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET full_name=excluded.full_name, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_loans (id, borrower_id, loan_number, loan_type, principal_amount, interest_rate, interest_type, term, term_unit, frequency, total_amount, installment_amount, release_date, first_payment_date, maturity_date, status, is_reloan, encoded_by, collector_id, deposit_amount, insurance_amount, processing_fee, collection_fee, notarial_fee, rod_fee, lto_fee, udi_rebatable_fee, vat_on_interest, vat_on_charges, dst_fee, rebate_amount, savings_per_payment, deducted_amount, batch, cycle, notes, interest_amount, created_at, updated_at, deleted_at)
SELECT format('mock10-loan-%s', lpad(i::text,2,'0')), public.mock10_uuid(2000,i)::text, format('MOCK10-LN-%s', lpad(i::text,3,'0')), CASE WHEN i%2=0 THEN 'reloan' ELSE 'new' END, 5000+(i*1000), 20, 'flat', 60, 'days', 'daily', (5000+(i*1000))*1.2, round(((5000+(i*1000))*1.2)/60,2), now()-(i*interval '3 days'), now()-(i*interval '2 days'), now()+interval '60 days', CASE WHEN i IN (9,10) THEN 'pending' ELSE 'active' END, i%3=0, 'mock10-seed', public.mock10_uuid(1000, ((i-1)%10)+1)::text, 500,100,150,50,100,0,0,0,0,0,0,0,20,0,1,i,'MOCK10 loan seed record', ((5000+(i*1000))*0.2), now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET borrower_id=excluded.borrower_id, loan_number=excluded.loan_number, status=excluded.status, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_payment_schedules (id, loan_id, due_date, scheduled_amount, status, fees_amount, principal_amount, interest_amount, created_at, updated_at, deleted_at)
SELECT format('mock10-schedule-%s', lpad(i::text,2,'0')), format('mock10-loan-%s', lpad(i::text,2,'0')), now()+(i*interval '1 day'), 150+(i*10), CASE WHEN i%4=0 THEN 'paid' ELSE 'pending' END, 10, 120+(i*8), 20+(i*2), now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET scheduled_amount=excluded.scheduled_amount, status=excluded.status, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_payments (id, loan_id, borrower_id, schedule_id, collector_id, amount, payment_date, receipt_number, notes, encoded_at, created_at, updated_at, deleted_at)
SELECT format('mock10-payment-%s', lpad(i::text,2,'0')), format('mock10-loan-%s', lpad(i::text,2,'0')), public.mock10_uuid(2000,i)::text, format('mock10-schedule-%s', lpad(i::text,2,'0')), public.mock10_uuid(1000, ((i-1)%10)+1)::text, 100+(i*25), now()-(i*interval '1 day'), format('MOCK10-RCPT-%s', lpad(i::text,3,'0')), 'MOCK10 payment seed record', now(), now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET amount=excluded.amount, payment_date=excluded.payment_date, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_loan_penalties (id, loan_id, amount, penalty_date, reason, created_at, updated_at, deleted_at)
SELECT format('mock10-penalty-%s', lpad(i::text,2,'0')), format('mock10-loan-%s', lpad(i::text,2,'0')), 25+(i*5), floor(extract(epoch from (now()-(i*interval '1 day')))*1000)::bigint, 'MOCK10 late payment penalty', now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET amount=excluded.amount, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_expense_categories (id, name, is_active, created_at, updated_at, deleted_at)
SELECT format('mock10-category-%s', lpad(i::text,2,'0')), format('MOCK10 Category %s', lpad(i::text,2,'0')), true, now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET name=excluded.name, is_active=true, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_expenses (id, category, description, amount, expense_date, frequency, encoded_by, created_at, updated_at, deleted_at)
SELECT format('mock10-expense-%s', lpad(i::text,2,'0')), format('MOCK10 Category %s', lpad(i::text,2,'0')), format('MOCK10 Expense %s', i), 200+(i*30), now()-(i*interval '1 day'), 'one-time', 'mock10-seed', now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET amount=excluded.amount, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_cash_transactions (id, transaction_date, particulars, type, amount, remarks, recorded_by, created_at, updated_at, deleted_at)
SELECT format('mock10-cash-%s', lpad(i::text,2,'0')), now()-(i*interval '1 day'), format('MOCK10 Cash Transaction %s', i), CASE WHEN i%2=0 THEN 'in' ELSE 'out' END, 1000+(i*100), 'MOCK10 cash seed', 'mock10-seed', now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET amount=excluded.amount, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_bank_accounts (id, bank_name, account_name, account_number, starting_balance, created_at, updated_at, deleted_at)
SELECT format('mock10-bank-account-%s', lpad(i::text,2,'0')), format('MOCK10 Bank %s', i), format('MOCK10 Account %s', i), format('MOCK10-ACCT-%s', lpad(i::text,4,'0')), 10000+(i*1000), now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET starting_balance=excluded.starting_balance, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_bank_transactions (id, bank_account_id, transaction_date, type, amount, particulars, remarks, created_at, updated_at, deleted_at)
SELECT format('mock10-bank-transaction-%s', lpad(i::text,2,'0')), format('mock10-bank-account-%s', lpad(i::text,2,'0')), now()-(i*interval '1 day'), CASE WHEN i%2=0 THEN 'deposit' ELSE 'withdrawal' END, 500+(i*75), format('MOCK10 Bank Transaction %s', i), 'MOCK10 bank seed', now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET amount=excluded.amount, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_collection_logs (id, collector_id, log_date, total_collected, cash_on_hand_start, cash_on_hand_end, notes, created_at, updated_at, deleted_at)
SELECT format('mock10-collection-log-%s', lpad(i::text,2,'0')), public.mock10_uuid(1000,i)::text, now()-(i*interval '1 day'), 1000+(i*100), 500+(i*50), 1500+(i*150), 'MOCK10 collection log seed', now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET total_collected=excluded.total_collected, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_financial_snapshots (id, snapshot_date, total_assets, total_equity, total_liabilities, loan_loss_reserve, operating_revenue, financial_costs, subsidy_adjustment, inflation_adjustment, risk_weighted_assets, created_at, updated_at, deleted_at)
SELECT format('mock10-snapshot-%s', lpad(i::text,2,'0')), now()-(i*interval '7 days'), 100000+(i*5000), 60000+(i*3000), 40000+(i*2000), 2000+(i*100), 10000+(i*500), 1500+(i*75), 0, 0, 50000+(i*2500), now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET total_assets=excluded.total_assets, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_remittances (id, collector_id, amount, remittance_date, status, approved_by, notes, created_at, updated_at, deleted_at)
SELECT format('mock10-remittance-%s', lpad(i::text,2,'0')), public.mock10_uuid(1000,i)::text, 800+(i*100), now()-(i*interval '1 day'), CASE WHEN i%3=0 THEN 'pending' ELSE 'approved' END, 'mock10-admin', 'MOCK10 remittance seed', now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET amount=excluded.amount, status=excluded.status, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_savings_transactions (id, borrower_id, type, amount, reference_id, date, notes, created_at, updated_at, deleted_at)
SELECT format('mock10-saving-%s', lpad(i::text,2,'0')), public.mock10_uuid(2000,i)::text, CASE WHEN i%2=0 THEN 'deposit' ELSE 'withdrawal' END, 100+(i*10), format('mock10-payment-%s', lpad(i::text,2,'0')), now()-(i*interval '1 day'), 'MOCK10 savings seed', now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET amount=excluded.amount, updated_at=now(), deleted_at=NULL;

INSERT INTO public.collection_groups (id, name, collector_id, collection_day, is_active, created_at, updated_at, deleted_at)
SELECT public.mock10_uuid(3000,i), format('MOCK10 Group %s', lpad(i::text,2,'0')), public.mock10_uuid(1000,i), ((i-1)%7), true, now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET name=excluded.name, is_active=true, updated_at=now(), deleted_at=NULL;

INSERT INTO public.demo_inquiries (id, full_name, business_name, contact_number, email, message, status, created_at, updated_at)
SELECT public.mock10_uuid(4000,i), format('MOCK10 Inquiry %s', lpad(i::text,2,'0')), format('MOCK10 Business %s', i), format('0918123%s', lpad(i::text,4,'0')), format('mock10.inquiry.%s@example.test', lpad(i::text,2,'0')), 'MOCK10 demo inquiry seed message', CASE WHEN i%3=0 THEN 'contacted' ELSE 'new' END, now(), now()
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET full_name=excluded.full_name, status=excluded.status, updated_at=now();

INSERT INTO public.haier_service_requests (id, haier_sr_no, customer_name, address, tel_no, dealer, date, dop, sr_no, s_code, item, model, serial_no, complain, accessories, diagnosis, created_at, updated_at, deleted_at)
SELECT public.mock10_uuid(5000,i), format('MOCK10-HSR-%s', lpad(i::text,3,'0')), format('MOCK10 Haier Customer %s', i), format('Mock Address %s', i), format('0922000%s', lpad(i::text,4,'0')), 'MOCK10 Dealer', now()-(i*interval '1 day'), now()-interval '1 year', format('SR-%s', i), format('SC-%s', i), 'Aircon', format('HAIER-MODEL-%s', i), format('HSN-%s', i), 'MOCK10 cooling issue', 'Remote', 'MOCK10 diagnostic note', now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET customer_name=excluded.customer_name, updated_at=now(), deleted_at=NULL;

DROP FUNCTION public.mock10_uuid(int, int);
COMMIT;
BEGIN;
CREATE OR REPLACE FUNCTION public.mock10_uuid(ns int, n int)
RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-' || lpad(ns::text, 4, '0') || '-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;

INSERT INTO public.app_areas (id, name, code, ao_id, is_active, created_at, updated_at, deleted_at)
SELECT public.mock10_uuid(1100,i), format('MOCK10 Area %s', lpad(i::text,2,'0')), format('M10A%s', lpad(i::text,2,'0')), format('mock10-profile-%s', lpad((((i-1)%10)+1)::text,2,'0')), true, now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET name=excluded.name, code=excluded.code, is_active=true, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_loan_products (id, product_type, label, description, default_rate_percent, default_term, default_term_unit, default_frequency, default_processing_fee_rate, default_processing_fee_flat, default_notarial_fee, notarial_fee_threshold, notarial_fee_above_threshold, default_savings_per_payment, default_principal, max_principal, min_term_months, max_term_months, is_active, sort_order, created_at, updated_at, deleted_at)
SELECT format('mock10-product-%s', lpad(i::text,2,'0')), format('mock10-product-type-%s', lpad(i::text,2,'0')), format('MOCK10 Loan Product %s', lpad(i::text,2,'0')), 'MOCK10 loan product seed', 20, 2+i, 'months', CASE WHEN i%2=0 THEN 'weekly' ELSE 'monthly' END, 2, 100, 100, 10000, 200, 50, 5000+(i*1000), 50000+(i*5000), 1, 12, true, i, now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET label=excluded.label, is_active=true, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_loan_applications (id, borrower_id, product_id, amount_applied, amount_approved, purpose, application_date, status, approved_by, approved_at, notes, created_at, updated_at, deleted_at)
SELECT public.mock10_uuid(1200,i), public.mock10_uuid(2000,i), format('mock10-product-%s', lpad(i::text,2,'0')), 10000+(i*1000), 9000+(i*1000), format('MOCK10 Purpose %s', i), now()-(i*interval '1 day'), CASE WHEN i%3=0 THEN 'approved' ELSE 'draft' END, 'mock10-profile-01', CASE WHEN i%3=0 THEN now() ELSE NULL END, 'MOCK10 application seed', now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET amount_applied=excluded.amount_applied, status=excluded.status, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_guarantors (id, loan_id, application_id, guarantor_name, contact_no, relationship, member_id, created_at, updated_at, deleted_at)
SELECT public.mock10_uuid(1300,i), format('mock10-loan-%s', lpad(i::text,2,'0')), public.mock10_uuid(1200,i), format('MOCK10 Guarantor %s', lpad(i::text,2,'0')), format('0944000%s', lpad(i::text,4,'0')), CASE WHEN i%2=0 THEN 'Spouse' ELSE 'Sibling' END, public.mock10_uuid(2000,i), now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET guarantor_name=excluded.guarantor_name, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_employees (id, name, role, base_salary, is_active, created_at, updated_at, deleted_at)
SELECT public.mock10_uuid(1400,i), format('MOCK10 Employee %s', lpad(i::text,2,'0')), (ARRAY['manager','collector','encoder','cashier','technician','admin','hr','accountant','auditor','assistant'])[i], 15000+(i*1000), true, now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET name=excluded.name, role=excluded.role, base_salary=excluded.base_salary, is_active=true, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_payrolls (id, employee_id, period_start, period_end, base_salary, deductions, allowances, net_pay, status, created_at, updated_at, deleted_at)
SELECT public.mock10_uuid(1500,i), public.mock10_uuid(1400,i), date_trunc('month', now()), date_trunc('month', now()) + interval '1 month' - interval '1 day', 15000+(i*1000), 500, 1000, 15000+(i*1000)-500+1000, CASE WHEN i%3=0 THEN 'paid' ELSE 'draft' END, now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET base_salary=excluded.base_salary, net_pay=excluded.net_pay, status=excluded.status, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_settings (id, key, value, value_type, scope, is_active, created_at, updated_at, deleted_at)
SELECT format('mock10-setting-%s', lpad(i::text,2,'0')), format('mock10.setting.%s', lpad(i::text,2,'0')), format('value-%s', i), 'string', 'global', true, now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET value=excluded.value, is_active=true, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_feature_flags (id, key, label, description, category, enabled, sort_order, created_at, updated_at, deleted_at)
SELECT format('mock10-feature-%s', lpad(i::text,2,'0')), format('mock10.feature.%s', lpad(i::text,2,'0')), format('MOCK10 Feature %s', i), 'MOCK10 feature flag seed', 'mock', i%2=0, i, now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET label=excluded.label, enabled=excluded.enabled, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_role_permissions (id, role, permission_key, label, category, enabled, created_at, updated_at, deleted_at)
SELECT format('mock10-role-permission-%s', lpad(i::text,2,'0')), (ARRAY['admin','collector','loan_encoder','payment_encoder','expenses_encoder','borrower','main_office','collector','borrower','admin'])[i], format('mock10.permission.%s', lpad(i::text,2,'0')), format('MOCK10 Permission %s', i), 'mock', true, now(), now(), NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET role=excluded.role, permission_key=excluded.permission_key, enabled=true, updated_at=now(), deleted_at=NULL;

INSERT INTO public.app_file_cases (id, loan_id, borrower_id, case_number, filed_date, status, notes, filed_by, created_at, updated_at, deleted_at)
SELECT public.mock10_uuid(1600,i), public.mock10_uuid(2000,i), public.mock10_uuid(2000,i), format('MOCK10-FC-%s', lpad(i::text,3,'0')), floor(extract(epoch from now())*1000)::bigint, CASE WHEN i%3=0 THEN 'closed' ELSE 'open' END, 'MOCK10 file case seed', 'mock10-profile-01', floor(extract(epoch from now())*1000)::bigint, floor(extract(epoch from now())*1000)::bigint, NULL
FROM generate_series(1,10) s(i)
ON CONFLICT (id) DO UPDATE SET status=excluded.status, notes=excluded.notes, updated_at=excluded.updated_at, deleted_at=NULL;

DROP FUNCTION public.mock10_uuid(int, int);
COMMIT;



