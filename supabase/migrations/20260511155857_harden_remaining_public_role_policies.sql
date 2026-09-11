-- Remove final legacy public-role RLS policies discovered on production.
-- Data-safe: policy metadata only; no row updates/deletes.

DROP POLICY IF EXISTS "Enable delete for all users" ON public.app_loan_penalties;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.app_loan_penalties;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.app_loan_penalties;
DROP POLICY IF EXISTS "Enable update for all users" ON public.app_loan_penalties;

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT *
    FROM (VALUES
      ('collection_groups', 'Allow authenticated delete'),
      ('collection_groups', 'Allow authenticated insert'),
      ('collection_groups', 'Allow authenticated read'),
      ('collection_groups', 'Allow authenticated update')
    ) AS policies(table_name, policy_name)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = policy_record.table_name
        AND policyname = policy_record.policy_name
    ) THEN
      EXECUTE format(
        'ALTER POLICY %I ON public.%I TO authenticated',
        policy_record.policy_name,
        policy_record.table_name
      );
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
