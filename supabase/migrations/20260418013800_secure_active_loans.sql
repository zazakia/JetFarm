-- Step 2: Apply Supabase migration for partial unique index
-- This ensures that only one active loan can exist for a borrower at any given time.

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_loan_per_borrower 
ON public.app_loans (borrower_id) 
WHERE (status = 'active' AND deleted_at IS NULL);
