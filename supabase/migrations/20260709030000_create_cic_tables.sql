-- ============================================================
-- Migration: Create CIC compliance tables
-- Purpose:
--   1. cic_submissions — append-only audit log of every
--      extraction/validation/submission attempt (RA 9510 compliance)
--   2. cic_settings — cooperative-level CIC configuration
--      (provider code, contract type mappings, alert settings)
-- These tables live in the public schema but are gated by
-- admin-only RLS — no write access from non-admin roles.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. CIC Settings table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cic_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code       TEXT NOT NULL DEFAULT 'PF022730',      -- CIC-issued provider code
  branch_code         TEXT,                                   -- null = head office
  cooperative_name    TEXT NOT NULL DEFAULT 'COOPERATIVE',
  default_currency    TEXT NOT NULL DEFAULT 'PHP',
  default_contract_type INTEGER NOT NULL DEFAULT 22,          -- CIC ContractTypeDomain: 22 = Microfinance
  -- Loan type → CIC contract type overrides (JSONB map)
  -- e.g. {"regular": 22, "emergency": 22, "business": 14}
  loan_type_map       JSONB NOT NULL DEFAULT '{}',
  -- Alert settings
  alert_push_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  alert_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  alert_email_address TEXT,                                   -- email for deadline alerts
  -- Internal submission deadlines (day of month)
  extract_by_day      INTEGER NOT NULL DEFAULT 3,
  validate_by_day     INTEGER NOT NULL DEFAULT 5,
  submit_by_day       INTEGER NOT NULL DEFAULT 8,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one settings row per cooperative
CREATE UNIQUE INDEX IF NOT EXISTS cic_settings_singleton
  ON cic_settings ((TRUE));

-- Seed default settings row
INSERT INTO cic_settings (provider_code, cooperative_name)
VALUES ('PF022730', 'COOPERATIVE')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. CIC Submissions audit table (append-only)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cic_submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period            TEXT NOT NULL,              -- 'YYYY-MM' e.g. '2024-05'
  submission_type   TEXT NOT NULL,              -- 'regular' | 'special'
  file_name         TEXT,                        -- generated filename
  file_hash         TEXT,                        -- SHA-256 of Excel file
  record_count      INTEGER,                     -- total rows (ID+CI+NE)
  ds_count          INTEGER,                     -- ID rows
  ci_count          INTEGER,                     -- CI rows
  ne_count          INTEGER,                     -- NE rows
  validation_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'passed'|'failed'|'partial'
  validation_errors JSONB,                       -- per-record failures [{borrower_id, field, reason}]
  status            TEXT NOT NULL DEFAULT 'draft',    -- 'draft'|'validated'|'submitted'|'rejected'|'accepted'
  oer_response      TEXT,                        -- CIC portal response (manual entry by staff)
  dispute_ref       TEXT,                        -- Dispute Correction Notice ref number
  notes             TEXT,
  submitted_at      TIMESTAMPTZ,
  submitted_by      TEXT,                        -- auth user email
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NO updated_at, NO deleted_at — append-only compliance log
  -- To correct: insert a new row; never update existing rows
);

CREATE INDEX IF NOT EXISTS cic_submissions_period_idx
  ON cic_submissions (period, submission_type);

-- ────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────
ALTER TABLE cic_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cic_submissions ENABLE ROW LEVEL SECURITY;

-- cic_settings: admin can read and update; no public access
CREATE POLICY "admin_can_read_cic_settings"
  ON cic_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()::TEXT
        AND role = 'admin'
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "admin_can_update_cic_settings"
  ON cic_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()::TEXT
        AND role = 'admin'
        AND deleted_at IS NULL
    )
  );

-- cic_submissions: admin can read and insert; NO update or delete (append-only)
CREATE POLICY "admin_can_read_cic_submissions"
  ON cic_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()::TEXT
        AND role = 'admin'
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "admin_can_insert_cic_submissions"
  ON cic_submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()::TEXT
        AND role = 'admin'
        AND deleted_at IS NULL
    )
  );
-- No UPDATE or DELETE policy on cic_submissions intentionally.

COMMENT ON TABLE cic_submissions IS
  'Append-only audit log of all CIC submission attempts. Never update or delete — insert new rows to correct.';
COMMENT ON TABLE cic_settings IS
  'Cooperative-level CIC configuration (provider code, contract type mapping, alert settings).';
