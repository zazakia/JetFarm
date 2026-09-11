-- Main Office users share the admin app surface and must be able to read/write
-- the same borrower/loan/payment rows as encoders for cross-device sync.
CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS boolean AS $$
  SELECT public.get_current_role() IN (
    'admin',
    'main_office',
    'loan_encoder',
    'payment_encoder',
    'expenses_encoder'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
