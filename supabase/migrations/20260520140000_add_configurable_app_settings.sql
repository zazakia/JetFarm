-- Add synced, admin-editable configuration tables for Settings-driven app behavior.
-- IDs are text so deterministic built-in defaults can sync without per-device UUID duplication.

CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text,
  value_type text NOT NULL DEFAULT 'string',
  scope text NOT NULL DEFAULT 'global',
  is_active boolean DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.app_loan_products (
  id text PRIMARY KEY,
  product_type text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  default_rate_percent numeric NOT NULL DEFAULT 0,
  default_term numeric NOT NULL DEFAULT 1,
  default_term_unit text NOT NULL DEFAULT 'months',
  default_frequency text NOT NULL DEFAULT 'monthly',
  default_processing_fee_rate numeric DEFAULT 0,
  default_processing_fee_flat numeric DEFAULT 0,
  default_notarial_fee numeric DEFAULT 0,
  notarial_fee_threshold numeric DEFAULT 0,
  notarial_fee_above_threshold numeric DEFAULT 0,
  default_savings_per_payment numeric DEFAULT 0,
  default_principal numeric DEFAULT 0,
  max_principal numeric DEFAULT 0,
  min_term_months numeric DEFAULT 0,
  max_term_months numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.app_feature_flags (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  category text,
  enabled boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.app_role_permissions (
  id text PRIMARY KEY,
  role text NOT NULL,
  permission_key text NOT NULL,
  label text NOT NULL,
  category text,
  enabled boolean DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(role, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at ON public.app_settings(updated_at);
CREATE INDEX IF NOT EXISTS idx_app_loan_products_updated_at ON public.app_loan_products(updated_at);
CREATE INDEX IF NOT EXISTS idx_app_feature_flags_updated_at ON public.app_feature_flags(updated_at);
CREATE INDEX IF NOT EXISTS idx_app_role_permissions_updated_at ON public.app_role_permissions(updated_at);
CREATE INDEX IF NOT EXISTS idx_app_role_permissions_role ON public.app_role_permissions(role);

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'app_settings',
    'app_loan_products',
    'app_feature_flags',
    'app_role_permissions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can read %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage %s" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Authenticated users can read %s" ON public.%I FOR SELECT TO authenticated USING (true)',
      tbl,
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "Admins can manage %s" ON public.%I FOR ALL TO authenticated USING (public.get_current_role() IN (''admin'', ''main_office'')) WITH CHECK (public.get_current_role() IN (''admin'', ''main_office''))',
      tbl,
      tbl
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
