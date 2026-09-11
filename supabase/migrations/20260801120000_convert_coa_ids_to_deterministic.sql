-- Convert Chart of Accounts IDs to deterministic UUIDs based on md5(code)
-- This resolves duplicate key / unique constraint violations (idx_chart_of_accounts_code)
-- because both client and server will compute the same ID based on the account code.

UPDATE public.chart_of_accounts
SET id = cast(md5(code) as uuid)
WHERE deleted_at IS NULL;
