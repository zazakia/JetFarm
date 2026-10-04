-- =============================================================================
-- Sync push repair (M2): retire the stale app_payrolls -> app_employees FK
-- =============================================================================
-- WHY THIS EXISTS -----------------------------------------------------------------
-- docs/CRUD-PERSISTENCE-AUDIT.md section 4 (M2).
--
-- `app_employees` is unreachable from the client: zero references in src/ or app/,
-- and it is absent from src/services/syncTableContract.json -> remoteTableMap, so
-- SyncService will never pull or push it. `app_payrolls`, however, IS still the
-- remote target of local `payrolls` (src/database/models/Payroll.ts, registered in
-- src/database/index.ts) and is a mapped sync table.
--
-- That combination leaves a landmine. The FK was declared inline
-- (20260524120000_create_payroll_tables.sql:36, so Postgres auto-named it
-- `app_payrolls_employee_id_fkey`) and requires every pushed `employee_id` to match
-- a row in a table nothing in the app can write. A legacy row carrying a new-generation
-- `employees.id` is rejected with SQLSTATE 23503. getSyncFailureKind() classifies a
-- constraint violation on a *core* table as a hard failure: the table's push throws,
-- the cycle throws, and those rows are retried forever and never marked synced -- the
-- same stall shape as the missing-column findings H1-H4, just reached from the other
-- side of the contract.
--
-- Dropping the constraint removes the failure mode without touching data. The column
-- stays NOT NULL, so payrolls rows still carry an employee reference; referential
-- integrity for the live payroll path lives in payroll_runs / payroll_lines, which
-- PayrollService writes (src/services/PayrollService.ts) -- not in this legacy pair.
--
-- Forward-only and idempotent: safe to re-run, and a no-op on a database where the
-- constraint was never created.
--
-- BEFORE APPLYING IN PRODUCTION, confirm the legacy pair is actually empty so the
-- follow-up retirement (dropping app_payrolls / app_employees and local `payrolls`)
-- can be planned without data loss:
--   SELECT count(*) FROM public.app_payrolls;
--   SELECT count(*) FROM public.app_employees;

ALTER TABLE public.app_payrolls
    DROP CONSTRAINT IF EXISTS app_payrolls_employee_id_fkey;

-- No new index: dropping a foreign key in PostgreSQL does not remove an index it
-- never created (FKs are not auto-indexed), and the sync pull query filters on
-- updated_at.

NOTIFY pgrst, 'reload schema';
