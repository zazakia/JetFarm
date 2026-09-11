-- ============================================================
-- Migration: Add CIC-required fields to borrowers table
-- Purpose: Support Credit Information Corporation (CIC) reporting
--          under RA 9510. These fields are required for ID record
--          generation. All columns are nullable (no breaking change).
-- ============================================================

ALTER TABLE public.app_borrowers
  ADD COLUMN IF NOT EXISTS middle_name           TEXT,
  ADD COLUMN IF NOT EXISTS name_suffix           TEXT,         -- Jr., Sr., III, etc.
  ADD COLUMN IF NOT EXISTS mother_maiden_name    TEXT,         -- Full maiden name of mother
  ADD COLUMN IF NOT EXISTS sss_number            TEXT,         -- SSS ID (fallback if no TIN)
  ADD COLUMN IF NOT EXISTS gsis_number           TEXT,         -- GSIS ID (fallback if no TIN)
  ADD COLUMN IF NOT EXISTS philhealth_number     TEXT;         -- PhilHealth (fallback)

COMMENT ON COLUMN public.app_borrowers.middle_name        IS 'CIC ID Col 9 — required for CIC submission';
COMMENT ON COLUMN public.app_borrowers.name_suffix        IS 'CIC ID Col 10 — name suffix (Jr./Sr./III)';
COMMENT ON COLUMN public.app_borrowers.mother_maiden_name IS 'CIC ID Col 25-27 — mother maiden full name';
COMMENT ON COLUMN public.app_borrowers.sss_number        IS 'CIC gov ID — SSS number (fallback when TIN is null)';
COMMENT ON COLUMN public.app_borrowers.gsis_number        IS 'CIC gov ID — GSIS number (fallback when TIN/SSS is null)';
COMMENT ON COLUMN public.app_borrowers.philhealth_number  IS 'CIC gov ID — PhilHealth number (tertiary fallback)';
