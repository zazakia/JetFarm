-- =============================================================================
-- Sync push repair: republish the remote schema production actually lost
--
-- WHY THIS EXISTS -----------------------------------------------------------------------
-- Measured 2026-10-18 with scripts/audit-remote-schema-gap.mjs (local WatermelonDB schema
-- vs. the live PostgREST schema cache) and confirmed at SQL level with
-- supabase/queries/prod-schema-gap-probe.sql: the live database is missing 59 columns
-- across 8 tables and 3 whole tables, while `deploy_schema_migrations` records all 66
-- local migrations as applied. PostgREST answers the push with PGRST204, which
-- pass-throughs as SQLSTATE 42703 "column ... does not exist" -- the columns are really
-- gone, the schema cache is not stale.
--
-- The live symptoms in the browser console:
--   * POST app_borrowers  400 - Could not find the 'barangay' column
--   * POST app_loans      400 - Could not find the 'savings_amount' column
--   * POST app_loan_applications 409 - violates app_loan_applications_borrower_id_fkey
--   * POST app_share_capital_transactions 409 - violates ..._member_id_fkey
-- Both 409s are cascade damage, not schema faults: those tables' columns all exist, but
-- their parent borrowers never landed. Fixing app_borrowers clears them without touching
-- either child table.
--
-- HOW THE LEDGER GOT IT WRONG -----------------------------------------------------------
-- Two idempotent-DDL blind spots, both recorded as successes:
--   1. `ALTER TABLE app_borrowers ADD COLUMN a TEXT, ADD COLUMN b TEXT, ...` (29 columns in
--      ONE statement, 20260626000000) aborts entirely if any single column already exists.
--      The tables created further down the same file survived, the borrower columns did not.
--   2. `CREATE TABLE IF NOT EXISTS public.suppliers` (20260909000000) silently no-oped against
--      an older, same-named table that predates it (live: id,name,contact_person,phone,email,
--      address,created_at,updated_at), so tin / payment_terms_days / is_active / deleted_at
--      were never added.
-- Because the ledger claims both files applied, `npm run db:migrate` reports "Nothing
-- pending" forever. A forward-only NEW file is the only way to converge; nothing here
-- rewrites history.
--
-- TYPE RULES ------------------------------------------------------------------------------
-- Each column reuses the type its originating migration declared, except where that
-- declaration contradicts what SyncService actually sends. sanitizeRecord() converts epoch
-- ms to ISO for every SyncService.DATE_FIELDS name unless the table/field pair is listed in
-- SyncService.TABLE_BIGINT_FIELDS. A mismatch in either direction is a fresh 400 on the
-- whole batch, so:
--   * TIMESTAMPTZ -> date_joined, date_of_death, cleared_at (ISO on the wire)
--     Note 20260704000000 declared `date_joined BIGINT`; borrowers are not in the
--     TABLE_BIGINT_FIELDS list for that field, so the push sends an ISO string and BIGINT
--     would reject it. TIMESTAMPTZ is the type the shipped app can use.
--   * BIGINT      -> date_accepted, pmes_date, spouse_date_of_birth, termination_date
--     (listed bigint) and the agri block/progress timestamp fields, also listed bigint.
--     agri_block_progress.deleted_at is NOT in that list, so it is TIMESTAMPTZ while its
--     created_at/updated_at are BIGINT -- deliberate, and it matches the engine.
--
-- The three agribusiness tables were deferred by the old push-payload contract guard
-- ("Task 6 must replace these deferrals"). This file is that replacement; the deferrals are
-- removed from src/database/schemaContracts.regression.test.ts alongside it.
--
-- Forward-only, additive, idempotent, rewrites no data, drops nothing.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. app_borrowers - 42 columns (cooperative membership, CIC, deceased, sync fields)
-- ---------------------------------------------------------------------------
ALTER TABLE public.app_borrowers
    ADD COLUMN IF NOT EXISTS membership_number      TEXT,
    ADD COLUMN IF NOT EXISTS membership_type        TEXT,
    ADD COLUMN IF NOT EXISTS membership_status      TEXT DEFAULT 'Active';

ALTER TABLE public.app_borrowers
    ADD COLUMN IF NOT EXISTS tin_number             TEXT,
    ADD COLUMN IF NOT EXISTS bod_resolution_number  TEXT,
    ADD COLUMN IF NOT EXISTS date_accepted          BIGINT,
    ADD COLUMN IF NOT EXISTS pmes_completed         BOOLEAN,
    ADD COLUMN IF NOT EXISTS pmes_date              BIGINT,
    ADD COLUMN IF NOT EXISTS birthplace             TEXT,
    ADD COLUMN IF NOT EXISTS religion               TEXT,
    ADD COLUMN IF NOT EXISTS education_level        TEXT,
    ADD COLUMN IF NOT EXISTS employer               TEXT,
    ADD COLUMN IF NOT EXISTS salary                 NUMERIC,
    ADD COLUMN IF NOT EXISTS other_income_source    TEXT,
    ADD COLUMN IF NOT EXISTS nearest_relative       TEXT,
    ADD COLUMN IF NOT EXISTS number_of_dependents   INTEGER,
    ADD COLUMN IF NOT EXISTS spouse_surname         TEXT,
    ADD COLUMN IF NOT EXISTS spouse_first_name      TEXT,
    ADD COLUMN IF NOT EXISTS spouse_middle_name     TEXT,
    ADD COLUMN IF NOT EXISTS spouse_name_extension  TEXT,
    ADD COLUMN IF NOT EXISTS spouse_date_of_birth   BIGINT,
    ADD COLUMN IF NOT EXISTS spouse_birthplace      TEXT,
    ADD COLUMN IF NOT EXISTS spouse_occupation      TEXT,
    ADD COLUMN IF NOT EXISTS spouse_phone           TEXT,
    ADD COLUMN IF NOT EXISTS termination_date       BIGINT,
    ADD COLUMN IF NOT EXISTS termination_resolution TEXT,
    ADD COLUMN IF NOT EXISTS barangay               TEXT,
    ADD COLUMN IF NOT EXISTS city_municipality      TEXT,
    ADD COLUMN IF NOT EXISTS province               TEXT,
    ADD COLUMN IF NOT EXISTS zip_code               TEXT;

ALTER TABLE public.app_borrowers
    ADD COLUMN IF NOT EXISTS member_id              TEXT,
    ADD COLUMN IF NOT EXISTS cycle_id               INTEGER,
    ADD COLUMN IF NOT EXISTS loan_code              TEXT,
    ADD COLUMN IF NOT EXISTS date_joined            TIMESTAMPTZ;

ALTER TABLE public.app_borrowers
    ADD COLUMN IF NOT EXISTS deceased               BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS date_of_death          TIMESTAMPTZ;

ALTER TABLE public.app_borrowers
    ADD COLUMN IF NOT EXISTS middle_name            TEXT,
    ADD COLUMN IF NOT EXISTS name_suffix            TEXT,
    ADD COLUMN IF NOT EXISTS mother_maiden_name     TEXT,
    ADD COLUMN IF NOT EXISTS sss_number             TEXT,
    ADD COLUMN IF NOT EXISTS gsis_number            TEXT,
    ADD COLUMN IF NOT EXISTS philhealth_number      TEXT;

-- Idempotent replacement for the 20260626000000 index, which is unversioned there
-- (plain CREATE INDEX) and therefore cannot be re-run safely.
CREATE INDEX IF NOT EXISTS idx_app_borrowers_membership_number
    ON public.app_borrowers(membership_number);

-- ---------------------------------------------------------------------------
-- 2. Loans, payments, cash and bank - the single-column push blockers
-- ---------------------------------------------------------------------------
ALTER TABLE public.app_loans
    ADD COLUMN IF NOT EXISTS savings_amount NUMERIC DEFAULT 0;

ALTER TABLE public.app_payments
    ADD COLUMN IF NOT EXISTS payment_type TEXT;

ALTER TABLE public.app_cash_transactions
    ADD COLUMN IF NOT EXISTS is_petty_cash BOOLEAN DEFAULT FALSE;

-- branch_id / pos_session_id mirror 20260911020000 exactly (same types, same referents) so
-- the two files cannot disagree. Both referent tables are live and reachable through
-- remoteTableMap, and the columns start NULL for existing rows, so the constraints validate
-- at add time.
ALTER TABLE public.app_cash_transactions
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id),
    ADD COLUMN IF NOT EXISTS pos_session_id UUID REFERENCES public.pos_sessions(id);

ALTER TABLE public.app_bank_transactions
    ADD COLUMN IF NOT EXISTS is_cleared BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 3. user_profiles branch/area scope (20260910120000 never reached production)
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS branch_id TEXT,
    ADD COLUMN IF NOT EXISTS area_id TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_branch_id
    ON public.user_profiles (branch_id)
    WHERE branch_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_area_id
    ON public.user_profiles (area_id)
    WHERE area_id IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4. suppliers - the four columns CREATE TABLE IF NOT EXISTS could not deliver
-- ---------------------------------------------------------------------------
ALTER TABLE public.suppliers
    ADD COLUMN IF NOT EXISTS tin                 TEXT,
    ADD COLUMN IF NOT EXISTS payment_terms_days  INTEGER DEFAULT 30,
    ADD COLUMN IF NOT EXISTS is_active           BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS deleted_at          TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 5. agri_parcels - parcel layout bookkeeping (SyncService strips these from a
--    generic upsert until the layout outbox owns the row, so adding them is inert
--    for today's pushes and required the moment it is not)
-- ---------------------------------------------------------------------------
ALTER TABLE public.agri_parcels
    ADD COLUMN IF NOT EXISTS gps_exclusions     TEXT,
    ADD COLUMN IF NOT EXISTS boundary_revision  BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS layout_revision    BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS boundary_saved_at  BIGINT;

-- ---------------------------------------------------------------------------
-- 6. The three agribusiness block tables (local schema v49, never published remotely)
--
-- No foreign keys: the agri family deliberately keeps bare UUID + index (see
-- agri_parcels.land_owner_id in 20260911030000), and a FK here would turn a normal
-- out-of-order push into another retrying 409 - the exact failure this file repairs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agri_parcel_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    geometry_json TEXT NOT NULL DEFAULT '{}',
    area_hectares NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    boundary_revision BIGINT NOT NULL DEFAULT 0,
    layout_revision BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT
);

CREATE TABLE IF NOT EXISTS public.agri_block_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id UUID NOT NULL,
    worker_id UUID NOT NULL,
    crop_cycle_id UUID,
    task TEXT NOT NULL,
    start_date BIGINT NOT NULL,
    due_date BIGINT,
    status TEXT NOT NULL DEFAULT 'assigned',
    progress_percent INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL DEFAULT '',
    assigned_geometry_snapshot TEXT NOT NULL DEFAULT '{}',
    assigned_boundary_revision BIGINT NOT NULL DEFAULT 0,
    submission_id TEXT NOT NULL DEFAULT '',
    request_json TEXT NOT NULL DEFAULT '{}',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT
);

CREATE TABLE IF NOT EXISTS public.agri_block_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL,
    update_date BIGINT NOT NULL,
    progress_percent INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT '',
    notes TEXT,
    recorded_by TEXT NOT NULL DEFAULT '',
    submission_id TEXT NOT NULL DEFAULT '',
    correction_of_id TEXT,
    request_json TEXT NOT NULL DEFAULT '{}',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    -- TIMESTAMPTZ, not BIGINT: agri_block_progress is absent from
    -- SyncService.TABLE_BIGINT_FIELDS, so the tombstone upsert sends an ISO string here.
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agri_parcel_blocks_parcel ON public.agri_parcel_blocks(parcel_id);
CREATE INDEX IF NOT EXISTS idx_agri_parcel_blocks_status ON public.agri_parcel_blocks(status);
CREATE INDEX IF NOT EXISTS idx_agri_block_assignments_block ON public.agri_block_assignments(block_id);
CREATE INDEX IF NOT EXISTS idx_agri_block_assignments_worker ON public.agri_block_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_agri_block_assignments_cycle ON public.agri_block_assignments(crop_cycle_id);
CREATE INDEX IF NOT EXISTS idx_agri_block_assignments_status ON public.agri_block_assignments(status);
CREATE INDEX IF NOT EXISTS idx_agri_block_assignments_submission ON public.agri_block_assignments(submission_id);
CREATE INDEX IF NOT EXISTS idx_agri_block_progress_assignment ON public.agri_block_progress(assignment_id);
CREATE INDEX IF NOT EXISTS idx_agri_block_progress_submission ON public.agri_block_progress(submission_id);
CREATE INDEX IF NOT EXISTS idx_agri_block_progress_correction ON public.agri_block_progress(correction_of_id);

-- RLS: same policy shape as the rest of the agri family (20260911030000).
ALTER TABLE public.agri_parcel_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agri_block_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agri_block_progress ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY has no IF NOT EXISTS form, and this runner uses ON_ERROR_STOP=1, so a
-- re-run must not die on a policy that already exists.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = 'agri_parcel_blocks'
                   AND policyname = 'Allow authenticated read/write on agri_parcel_blocks') THEN
        CREATE POLICY "Allow authenticated read/write on agri_parcel_blocks"
            ON public.agri_parcel_blocks FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = 'agri_block_assignments'
                   AND policyname = 'Allow authenticated read/write on agri_block_assignments') THEN
        CREATE POLICY "Allow authenticated read/write on agri_block_assignments"
            ON public.agri_block_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = 'agri_block_progress'
                   AND policyname = 'Allow authenticated read/write on agri_block_progress') THEN
        CREATE POLICY "Allow authenticated read/write on agri_block_progress"
            ON public.agri_block_progress FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- PostgREST caches its schema; without this reload the ALTERs can succeed while the API
-- keeps answering PGRST204 for the same columns.
NOTIFY pgrst, 'reload schema';
