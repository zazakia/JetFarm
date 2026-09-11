-- Forward-only repair for CIC schema drift in production.
-- Historical migrations were corrected after their versions had already been recorded,
-- so this migration idempotently applies the effective schema contract.

ALTER TABLE public.app_borrowers
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS name_suffix TEXT,
  ADD COLUMN IF NOT EXISTS mother_maiden_name TEXT,
  ADD COLUMN IF NOT EXISTS sss_number TEXT,
  ADD COLUMN IF NOT EXISTS gsis_number TEXT,
  ADD COLUMN IF NOT EXISTS philhealth_number TEXT;

COMMENT ON COLUMN public.app_borrowers.middle_name IS 'CIC ID Col 9 - required for CIC submission';
COMMENT ON COLUMN public.app_borrowers.name_suffix IS 'CIC ID Col 10 - name suffix';
COMMENT ON COLUMN public.app_borrowers.mother_maiden_name IS 'CIC ID Col 25-27 - mother maiden full name';
COMMENT ON COLUMN public.app_borrowers.sss_number IS 'CIC government ID - SSS number';
COMMENT ON COLUMN public.app_borrowers.gsis_number IS 'CIC government ID - GSIS number';
COMMENT ON COLUMN public.app_borrowers.philhealth_number IS 'CIC government ID - PhilHealth number';

CREATE TABLE IF NOT EXISTS public.cic_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code TEXT NOT NULL DEFAULT 'PF022730',
  branch_code TEXT,
  cooperative_name TEXT NOT NULL DEFAULT 'COOPERATIVE',
  default_currency TEXT NOT NULL DEFAULT 'PHP',
  default_contract_type INTEGER NOT NULL DEFAULT 22,
  loan_type_map JSONB NOT NULL DEFAULT '{}',
  alert_push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  alert_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  alert_email_address TEXT,
  extract_by_day INTEGER NOT NULL DEFAULT 3,
  validate_by_day INTEGER NOT NULL DEFAULT 5,
  submit_by_day INTEGER NOT NULL DEFAULT 8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cic_settings_singleton ON public.cic_settings ((TRUE));
INSERT INTO public.cic_settings (provider_code, cooperative_name)
VALUES ('PF022730', 'COOPERATIVE')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.cic_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL,
  submission_type TEXT NOT NULL,
  file_name TEXT,
  file_hash TEXT,
  record_count INTEGER,
  ds_count INTEGER,
  ci_count INTEGER,
  ne_count INTEGER,
  validation_status TEXT NOT NULL DEFAULT 'pending',
  validation_errors JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  oer_response TEXT,
  dispute_ref TEXT,
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  submitted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cic_submissions_period_idx
  ON public.cic_submissions (period, submission_type);

ALTER TABLE public.cic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cic_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_can_read_cic_settings ON public.cic_settings;
CREATE POLICY admin_can_read_cic_settings
  ON public.cic_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()::TEXT AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS admin_can_update_cic_settings ON public.cic_settings;
CREATE POLICY admin_can_update_cic_settings
  ON public.cic_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()::TEXT AND role = 'admin' AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()::TEXT AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS admin_can_read_cic_submissions ON public.cic_submissions;
CREATE POLICY admin_can_read_cic_submissions
  ON public.cic_submissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()::TEXT AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS admin_can_insert_cic_submissions ON public.cic_submissions;
CREATE POLICY admin_can_insert_cic_submissions
  ON public.cic_submissions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()::TEXT AND role = 'admin' AND deleted_at IS NULL
    )
  );

REVOKE ALL ON TABLE public.cic_settings FROM anon;
REVOKE ALL ON TABLE public.cic_submissions FROM anon;
GRANT SELECT, UPDATE ON TABLE public.cic_settings TO authenticated;
GRANT SELECT, INSERT ON TABLE public.cic_submissions TO authenticated;

COMMENT ON TABLE public.cic_submissions IS 'Append-only audit log of CIC submission attempts.';
COMMENT ON TABLE public.cic_settings IS 'Cooperative-level CIC configuration.';

NOTIFY pgrst, 'reload schema';
