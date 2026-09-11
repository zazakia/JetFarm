-- Migration to add columns for Petty Cash and Bank Reconciliation

ALTER TABLE public.app_cash_transactions 
ADD COLUMN IF NOT EXISTS is_petty_cash BOOLEAN DEFAULT FALSE;

ALTER TABLE public.app_bank_transactions 
ADD COLUMN IF NOT EXISTS is_cleared BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ;
