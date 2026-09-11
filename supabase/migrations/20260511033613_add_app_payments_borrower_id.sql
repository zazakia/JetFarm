ALTER TABLE public.app_payments
ADD COLUMN IF NOT EXISTS borrower_id TEXT;

CREATE INDEX IF NOT EXISTS idx_app_payments_borrower_id
ON public.app_payments(borrower_id);
