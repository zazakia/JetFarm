-- Migration: Add app_file_cases table and new loan fields (schema v28)

-- Add delinquent and approval fields to app_loans
ALTER TABLE app_loans
  ADD COLUMN IF NOT EXISTS is_delinquent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delinquent_since bigint,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at bigint;

-- Create app_file_cases table
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_file_cases_loan_id ON app_file_cases(loan_id);
CREATE INDEX IF NOT EXISTS idx_app_file_cases_borrower_id ON app_file_cases(borrower_id);
CREATE INDEX IF NOT EXISTS idx_app_file_cases_updated_at ON app_file_cases(updated_at);

-- Enable RLS
ALTER TABLE app_file_cases ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read file cases"
  ON app_file_cases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert file cases"
  ON app_file_cases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update file cases"
  ON app_file_cases FOR UPDATE
  TO authenticated
  USING (true);
