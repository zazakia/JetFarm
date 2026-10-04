-- =============================================================================
-- Sync push repair: add the remote columns the app already ships
--
-- WHY: SyncService.sanitizeRecord strips only `_status`/`_changed`, and
-- WatermelonDB's sanitizedRaw() guarantees record._raw carries *every* column of
-- the local tableSchema (null for unset optionals). The whole raw object is what
-- gets upserted, so one local column missing on the remote makes PostgREST reject
-- the ENTIRE batch for that table (PGRST204 -> failureKind 'schema'). The push
-- loop defers only a missing *table* on an optional table -- never a column --
-- so the table's push hard-fails, synchronize() throws, and those rows stay
-- pending and are retried forever.
--
-- Evidence per column: docs/CRUD-PERSISTENCE-AUDIT.md sections 2-3 (H1-H4).
-- Guard that added these: src/database/schemaContracts.regression.test.ts
-- ("local columns must exist remotely").
--
-- This migration is forward-only, additive, idempotent, and rewrites no data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- H1. app_collectors: commission_rate + member_id
-- Local: src/database/schema.ts `collectors`, written by
-- src/services/CollectorCommissionService.ts (commissionRate, memberId).
-- member_id stays TEXT to match app_borrowers.member_id (20260704000000).
-- ---------------------------------------------------------------------------
ALTER TABLE public.app_collectors
    ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(8,4),
    ADD COLUMN IF NOT EXISTS member_id       TEXT;

-- ---------------------------------------------------------------------------
-- H2. employees: the superseded app_employees generation
-- `name`, `role` and `base_salary` came from app_employees
-- (20260524120000_create_payroll_tables.sql:9) and are still written by
-- PayrollService.createEmployee's legacy branch (:74, :76, :84) and its update
-- path (:125, :131). The live remote table (20260910010000_crispyking_payroll_module.sql:98)
-- only has first_name/last_name/middle_name/position/daily_rate, so every
-- `employees` push was rejected. Nullable so existing rows are untouched.
-- ---------------------------------------------------------------------------
ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS name        TEXT,
    ADD COLUMN IF NOT EXISTS role        TEXT,
    ADD COLUMN IF NOT EXISTS base_salary NUMERIC(12,2);

-- ---------------------------------------------------------------------------
-- H3/H4. deleted_at tombstone columns
-- The soft-delete push always sends { id, deleted_at, updated_at }
-- (src/services/SyncService.ts:1285-1289), so a synced table without a remote
-- `deleted_at` can never push a delete -- or, because the local schema declares
-- the column, any push at all.
--
-- device_registry matters most: it carries is_locked / wipe_requested, i.e. the
-- remote side is exactly where a device control has to become visible.
-- ---------------------------------------------------------------------------
ALTER TABLE public.device_registry
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.statutory_rates
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- No new indexes: both tables are small configuration tables and the pull query
-- filters on updated_at, which is not covered by either new column.

NOTIFY pgrst, 'reload schema';
