CREATE TABLE IF NOT EXISTS app_file_cases (
  id uuid PRIMARY KEY,
  loan_id uuid NOT NULL,
  borrower_id uuid NOT NULL,
  case_number text NOT NULL,
  filed_date bigint NOT NULL,
  status text NOT NULL DEFAULT 'open',
  notes text,
  filed_by text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  deleted_at bigint
);
CREATE INDEX IF NOT EXISTS idx_app_file_cases_loan_id ON app_file_cases(loan_id);
CREATE INDEX IF NOT EXISTS idx_app_file_cases_borrower_id ON app_file_cases(borrower_id);
CREATE INDEX IF NOT EXISTS idx_app_file_cases_updated_at ON app_file_cases(updated_at);
ALTER TABLE app_file_cases ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_file_cases' AND policyname='Authenticated users can read file cases') THEN
    CREATE POLICY "Authenticated users can read file cases" ON app_file_cases FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_file_cases' AND policyname='Authenticated users can insert file cases') THEN
    CREATE POLICY "Authenticated users can insert file cases" ON app_file_cases FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_file_cases' AND policyname='Authenticated users can update file cases') THEN
    CREATE POLICY "Authenticated users can update file cases" ON app_file_cases FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;
