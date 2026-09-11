-- Migration: Add Deceased status and Date of Death columns to app_borrowers
-- Date: 2026-07-06

ALTER TABLE public.app_borrowers ADD COLUMN IF NOT EXISTS deceased BOOLEAN DEFAULT FALSE;
ALTER TABLE public.app_borrowers ADD COLUMN IF NOT EXISTS date_of_death TIMESTAMPTZ;
