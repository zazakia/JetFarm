ALTER TABLE public.app_payments
ADD COLUMN IF NOT EXISTS current_salary NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS excess_cash NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.app_payments.current_salary IS
'Current salary / ATM withdrawal amount entered during payment posting.';

COMMENT ON COLUMN public.app_payments.excess_cash IS
'Computed excess cash: current_salary less payment amount, floored at zero.';
