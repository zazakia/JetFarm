alter table public.app_borrowers
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_branch text;

alter table public.app_expenses
  add column if not exists payee text,
  add column if not exists tin text,
  add column if not exists invoice_number text,
  add column if not exists vat_amount numeric;
