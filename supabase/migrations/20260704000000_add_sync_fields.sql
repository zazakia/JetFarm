-- Add missing sync columns to app_borrowers, app_loans, app_payments
-- These columns exist in local WatermelonDB schema but were missing in remote database.

-- 1. Add fields to app_borrowers
ALTER TABLE public.app_borrowers
ADD COLUMN IF NOT EXISTS member_id TEXT,
ADD COLUMN IF NOT EXISTS cycle_id INTEGER,
ADD COLUMN IF NOT EXISTS loan_code TEXT,
ADD COLUMN IF NOT EXISTS date_joined BIGINT;

-- 2. Add field to app_loans
ALTER TABLE public.app_loans
ADD COLUMN IF NOT EXISTS savings_amount NUMERIC DEFAULT 0;

-- 3. Add field to app_payments
ALTER TABLE public.app_payments
ADD COLUMN IF NOT EXISTS payment_type TEXT;
