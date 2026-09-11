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



