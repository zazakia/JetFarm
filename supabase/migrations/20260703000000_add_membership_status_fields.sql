-- Add membership_status and source_of_income fields to app_borrowers
ALTER TABLE app_borrowers
ADD COLUMN IF NOT EXISTS membership_status TEXT DEFAULT 'Active',
ADD COLUMN IF NOT EXISTS source_of_income TEXT,
ADD COLUMN IF NOT EXISTS civil_status TEXT;
