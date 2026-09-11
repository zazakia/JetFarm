-- =============================================================================
-- AGAP Module Schema Extension
-- Adds: areas, guarantors, loan_applications tables
-- Extends: app_loans (dpd, aging_bucket), app_borrowers (area_id),
--          collection_groups (group_type, area_id, center_day_name, center_time)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. app_areas — geographic area / barangay management
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_areas (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    code        text,                          -- e.g. 'SA' for San Agustin
    parent_area_id uuid REFERENCES app_areas(id),
    ao_id       text REFERENCES user_profiles(id),  -- assigned Account Officer
    is_active   boolean DEFAULT true,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now(),
    deleted_at  timestamptz
);

ALTER TABLE app_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read areas" ON app_areas;
CREATE POLICY "Authenticated users can read areas"
    ON app_areas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert areas" ON app_areas;
CREATE POLICY "Authenticated users can insert areas"
    ON app_areas FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update areas" ON app_areas;
CREATE POLICY "Authenticated users can update areas"
    ON app_areas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. app_loan_applications — formal loan application workflow
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_loan_applications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    borrower_id     uuid NOT NULL REFERENCES app_borrowers(id),
    product_id      text REFERENCES app_loan_products(id),
    amount_applied  numeric NOT NULL,
    amount_approved numeric,
    purpose         text,
    application_date timestamptz DEFAULT now(),
    status          text NOT NULL DEFAULT 'draft',  -- draft, submitted, under_review, approved, rejected
    approved_by     text REFERENCES user_profiles(id),
    approved_at     timestamptz,
    notes           text,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    deleted_at      timestamptz
);

ALTER TABLE app_loan_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read loan applications" ON app_loan_applications;
CREATE POLICY "Authenticated users can read loan applications"
    ON app_loan_applications FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert loan applications" ON app_loan_applications;
CREATE POLICY "Authenticated users can insert loan applications"
    ON app_loan_applications FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update loan applications" ON app_loan_applications;
CREATE POLICY "Authenticated users can update loan applications"
    ON app_loan_applications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. app_guarantors — co-maker / guarantor records per loan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_guarantors (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id         text REFERENCES app_loans(id),
    application_id  uuid REFERENCES app_loan_applications(id),
    guarantor_name  text NOT NULL,
    contact_no      text,
    relationship    text,                      -- e.g. 'spouse', 'relative', 'friend'
    member_id       uuid REFERENCES app_borrowers(id),  -- if guarantor is also a member
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    deleted_at      timestamptz
);

ALTER TABLE app_guarantors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read guarantors" ON app_guarantors;
CREATE POLICY "Authenticated users can read guarantors"
    ON app_guarantors FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert guarantors" ON app_guarantors;
CREATE POLICY "Authenticated users can insert guarantors"
    ON app_guarantors FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update guarantors" ON app_guarantors;
CREATE POLICY "Authenticated users can update guarantors"
    ON app_guarantors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. Extend app_loans — add DPD and aging bucket columns
-- ---------------------------------------------------------------------------
ALTER TABLE app_loans ADD COLUMN IF NOT EXISTS dpd integer DEFAULT 0;
ALTER TABLE app_loans ADD COLUMN IF NOT EXISTS aging_bucket text DEFAULT 'CURRENT';
ALTER TABLE app_loans ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES app_loan_applications(id);

-- ---------------------------------------------------------------------------
-- 5. Extend app_borrowers — add area_id FK and civil_status / contact_no
-- ---------------------------------------------------------------------------
ALTER TABLE app_borrowers ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES app_areas(id);
ALTER TABLE app_borrowers ADD COLUMN IF NOT EXISTS civil_status text;
ALTER TABLE app_borrowers ADD COLUMN IF NOT EXISTS contact_no text;
ALTER TABLE app_borrowers ADD COLUMN IF NOT EXISTS source_of_income text;

-- ---------------------------------------------------------------------------
-- 6. Extend collection_groups — support AGAP solidarity groups
-- ---------------------------------------------------------------------------
ALTER TABLE collection_groups ADD COLUMN IF NOT EXISTS group_type text DEFAULT 'collection';  -- 'collection' or 'agap_solidarity'
ALTER TABLE collection_groups ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES app_areas(id);
ALTER TABLE collection_groups ADD COLUMN IF NOT EXISTS center_day_name text;  -- e.g. 'Monday', 'Tuesday'
ALTER TABLE collection_groups ADD COLUMN IF NOT EXISTS center_time text;      -- e.g. '09:00', '14:00'
