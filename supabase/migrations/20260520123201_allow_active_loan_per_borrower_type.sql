-- Align remote loan uniqueness with app policy: one active loan per borrower per loan type.
-- The app allows separate loan products, but still prevents duplicate active loans
-- for the same borrower and product. Keep soft-deleted and non-active loans out.

DROP INDEX IF EXISTS public.unique_active_loan_per_borrower;

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_loan_per_borrower_type
ON public.app_loans (borrower_id, COALESCE(loan_type, 'standard'))
WHERE (status = 'active' AND deleted_at IS NULL);

NOTIFY pgrst, 'reload schema';
