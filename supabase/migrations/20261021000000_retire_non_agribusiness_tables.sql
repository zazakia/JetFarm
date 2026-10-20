-- =============================================================================
-- Agribusiness-only variant: retire every non-agribusiness remote table
-- =============================================================================
--
-- !! LOCAL / VARIANT ONLY - DO NOT APPLY TO PRODUCTION !!
-- This migration DESTROYS DATA. It exists on the agribusiness-only branch only,
-- where the lending, CIC, payroll, franchise, marketplace, QSR/commissary and
-- water-station features have been physically deleted from the app. Production
-- (https://supabase.818.quest) and the future cloud ref pkkcpyhpbkbadnjlpqfv
-- must never receive it; applying either is a human action and is out of scope
-- for this branch. Recovering dropped data requires a backup taken before the
-- run (see "Rollback" in docs/AGRIBUSINESS-ONLY-BRANCH.md).
--
-- WHAT IS BEING RETIRED ------------------------------------------------------------
-- The list is exactly the set of remote table names that left
-- src/services/syncTableContract.json -> remoteTableMap when the non-agribusiness
-- teardown pruned it (91 -> 39 mapped pairs, so 52 names), plus 5 tables that were
-- already unreachable from the client (never in the contract, never pushed or pulled):
--   app_employees              legacy, superseded by employees (both now retired;
--                              the FK between them was already retired by
--                              20261002000000_retire_legacy_payroll_foreign_key.sql)
--   cic_settings, cic_submissions   src/services/cic/ is deleted on this branch
--   production_batches              QSR production (commissary module deleted)
--   sync_conflict_log               no reader or writer anywhere in src/ or app/
--
-- KEPT (deliberate deviations from a pure non-agri sweep) --------------------------
--   stock_movements        still written by the kept InventoryJournalService and
--                          the kept accounting/inventory-journal screen
--   suppliers,             kept for AccountsPayableService + PurchaseJournalService
--   accounts_payable_vouchers
--   statutory_rates,       kept for the statutory-reserve financial statement note
--   statutory_fund_allocations
--   demo_inquiries         kept: app/login.tsx -> InquiryService posts demo requests
--   business_units,        kept: branch/area hierarchy used by the agri + finance core
--   branches, warehouses, areas, user_branch_roles
--
-- OPERATOR SENTINEL ------------------------------------------------------------
-- Mirrors scripts/verify-sync-integrity.mjs ALLOW_PRODUCTION_WRITE: the destructive
-- part is refused unless the target is proven to be a throwaway. The check here is
-- stronger than an env var because it measures the actual loss: if any retired table
-- still holds rows, the migration aborts with the per-table counts and the operator
-- must consciously opt in with
--
--   SET jetfarm.allow_non_agribusiness_data_loss = 'on';
--
-- before the same psql session applies it. A fresh or reset local stack has zero
-- rows in these tables, so `supabase db reset` applies this migration unattended -
-- which is exactly the property that lets it be proved locally without a sentinel.
-- Production never has zero rows in app_borrowers, so it can only be dropped by an
-- operator who has counted the loss and typed the opt-in.
--
-- FK SAFETY ----------------------------------------------------------------------
-- Verified against the local stack: no kept table references a retired table except
-- public.app_cash_transactions.pos_session_id -> pos_sessions. That column is dead
-- in this variant (the local WatermelonDB field is removed with the POS screens), so
-- its constraint AND the column are dropped before pos_sessions goes. Every other
-- edge between retired tables is handled by dropping in reverse-FK order: a table is
-- only dropped once all tables referencing it are gone, so no CASCADE is needed and
-- a CASCADE cannot silently take a kept object with it. app_borrowers is referenced
-- by 9 retired tables, so it goes last.
--
-- Two dependencies the FK order alone does not cover, both found by probing the real
-- database rather than reasoning about it:
--   * an RLS policy is a dependent object of every table its USING clause reads, even
--     when the policy sits on a table that is itself being retired - so all policies on
--     retired tables are dropped first (section 3);
--   * a trigger function cannot be dropped while its table's trigger exists - so
--     auto_post_payroll_journal() goes last, after payroll_runs (section 5).
--
-- Probe evidence (tmp/mig-probe2.sql, replayed inside BEGIN ... ROLLBACK on
-- jetfarm-local): with the sentinel set the whole file executes and leaves exactly 40
-- tables in public, none of them retired.
--
-- After the drops, the only surviving FK edges in public are within the kept core:
-- accounts_payable_vouchers->suppliers, business_units->{app_areas,branches,user_profiles},
-- journal_entry_lines->journal_entries, stock_movements->{branches,warehouses},
-- user_branch_roles->branches, warehouses->branches, app_areas->app_areas and the 12
-- agri_* edges.
--
-- VERIFY AFTER APPLYING ------------------------------------------------------------
--   SELECT count(*) FROM pg_tables WHERE schemaname = 'public';
--       -- expect 40: the 39 names in remoteTableMap plus demo_inquiries
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public'
--     AND (tablename LIKE 'ws_%' OR tablename LIKE 'marketplace_%'
--          OR tablename LIKE 'cic_%'   OR tablename IN
--          ('app_borrowers','app_loans','app_payments','pos_sessions','employees'));
--       -- expect 0 rows
-- src/database/nonAgriSchemaGuards.test.ts asserts the same agreement between this
-- file, schema.ts and syncTableContract.json, so a name that reappears fails CI.
-- =============================================================================

-- 1. Guard: refuse to destroy rows without a conscious operator opt-in.
DO $$
DECLARE
    target  text;
    counted bigint;
    lost    bigint := 0;
    detail  text := '';
BEGIN
    IF current_setting('jetfarm.allow_non_agribusiness_data_loss', true) = 'on' THEN
        RAISE NOTICE 'retirement sentinel set - data loss explicitly accepted';
        RETURN;
    END IF;

    FOREACH target IN ARRAY ARRAY[
        'app_board_resolutions', 'app_children', 'app_collection_logs', 'app_collectors',
        'app_committee_members', 'app_committees', 'app_dependents', 'app_employees',
        'app_file_cases', 'app_guarantors', 'app_loan_penalties', 'app_loans',
        'app_meeting_attendance', 'app_payment_schedules', 'app_payments', 'app_payrolls',
        'app_remittances', 'app_savings_transactions', 'app_share_capital_transactions', 'cic_settings',
        'cic_submissions', 'collection_groups', 'commissary_dispatches', 'device_registry',
        'employee_leaves', 'franchise_royalty_ledger', 'marketplace_categories', 'marketplace_disputes',
        'marketplace_order_items', 'marketplace_payouts', 'marketplace_promotions', 'marketplace_reviews',
        'marketplace_sub_orders', 'module_transactions', 'payroll_lines', 'payroll_runs',
        'pos_sessions', 'production_batches', 'royalty_calculations', 'sales_return_lines',
        'sales_returns', 'store_audits', 'sync_conflict_log', 'waste_logs',
        'ws_containers', 'ws_expenses', 'ws_payments', 'app_loan_applications',
        'app_loan_products', 'employees', 'franchise_contracts', 'marketplace_orders',
        'marketplace_products', 'marketplace_stores', 'ws_deliveries', 'ws_customers',
        'app_borrowers'
    ]
    LOOP
        -- cic_settings is the one retired table a migration deliberately populates:
        -- 20260709030000_create_cic_tables.sql inserts its own placeholder config row.
        -- That row is regenerated by every reset and is not user data, so exempt it -
        -- otherwise `supabase db reset` on this branch would abort on its own guard.
        IF target = 'cic_settings' THEN
            CONTINUE;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = target) THEN
            EXECUTE format('SELECT count(*) FROM public.%I', target) INTO counted;
            IF counted > 0 THEN
                lost := lost + counted;
                detail := detail || format('%s=%s ', target, counted);
            END IF;
        END IF;
    END LOOP;

    IF lost > 0 THEN
        RAISE EXCEPTION
            'refusing to retire % non-agribusiness rows (%). LOCAL/VARIANT ONLY: re-run with SET jetfarm.allow_non_agribusiness_data_loss = ''on'' if this target is a throwaway. Offenders: %',
            lost, 'row-bearing retired tables', trim(detail);
    END IF;
END
$$;

-- 2. The one kept->retired reference: drop it before the table goes.
ALTER TABLE public.app_cash_transactions
    DROP CONSTRAINT IF EXISTS app_cash_transactions_pos_session_id_fkey;

ALTER TABLE public.app_cash_transactions
    DROP COLUMN IF EXISTS pos_session_id;

-- 3. Drop every RLS policy on every retired table before the tables themselves.
-- A policy is a dependent object of the tables its USING clause reads, so policies on
-- a table that is about to be dropped still block DROP TABLE of a table it merely
-- references (PROBE-VERIFIED: 'policy Collectors can access payments for their loans on
-- table app_payments depends on table app_loans' refused the app_loans drop). Removing
-- them first keeps the drops plain and lets the reverse-FK order below stay the only
-- ordering rule, with no CASCADE anywhere.
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'app_board_resolutions', 'app_borrowers', 'app_children', 'app_collection_logs',
              'app_collectors', 'app_committee_members', 'app_committees', 'app_dependents',
              'app_employees', 'app_file_cases', 'app_guarantors', 'app_loan_applications',
              'app_loan_penalties', 'app_loan_products', 'app_loans', 'app_meeting_attendance',
              'app_payment_schedules', 'app_payments', 'app_payrolls', 'app_remittances',
              'app_savings_transactions', 'app_share_capital_transactions', 'cic_settings',
              'cic_submissions', 'collection_groups', 'commissary_dispatches', 'device_registry',
              'employee_leaves', 'employees', 'franchise_contracts', 'franchise_royalty_ledger',
              'marketplace_categories', 'marketplace_disputes', 'marketplace_order_items',
              'marketplace_orders', 'marketplace_payouts', 'marketplace_products',
              'marketplace_promotions', 'marketplace_reviews', 'marketplace_stores',
              'marketplace_sub_orders', 'module_transactions', 'payroll_lines', 'payroll_runs',
              'pos_sessions', 'production_batches', 'royalty_calculations', 'sales_return_lines',
              'sales_returns', 'store_audits', 'sync_conflict_log', 'waste_logs', 'ws_containers',
              'ws_customers', 'ws_deliveries', 'ws_expenses', 'ws_payments'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END
$$;

-- 4. Retire in reverse-FK order (dependents first, app_borrowers last).
DROP TABLE IF EXISTS public."app_board_resolutions";
DROP TABLE IF EXISTS public."app_children";
DROP TABLE IF EXISTS public."app_collection_logs";
DROP TABLE IF EXISTS public."app_collectors";
DROP TABLE IF EXISTS public."app_committee_members";
DROP TABLE IF EXISTS public."app_committees";
DROP TABLE IF EXISTS public."app_dependents";
DROP TABLE IF EXISTS public."app_employees";
DROP TABLE IF EXISTS public."app_file_cases";
DROP TABLE IF EXISTS public."app_guarantors";
DROP TABLE IF EXISTS public."app_loan_penalties";
DROP TABLE IF EXISTS public."app_loans";
DROP TABLE IF EXISTS public."app_meeting_attendance";
DROP TABLE IF EXISTS public."app_payment_schedules";
DROP TABLE IF EXISTS public."app_payments";
DROP TABLE IF EXISTS public."app_payrolls";
DROP TABLE IF EXISTS public."app_remittances";
DROP TABLE IF EXISTS public."app_savings_transactions";
DROP TABLE IF EXISTS public."app_share_capital_transactions";
DROP TABLE IF EXISTS public."cic_settings";
DROP TABLE IF EXISTS public."cic_submissions";
DROP TABLE IF EXISTS public."collection_groups";
DROP TABLE IF EXISTS public."commissary_dispatches";
DROP TABLE IF EXISTS public."device_registry";
DROP TABLE IF EXISTS public."employee_leaves";
DROP TABLE IF EXISTS public."franchise_royalty_ledger";
DROP TABLE IF EXISTS public."marketplace_categories";
DROP TABLE IF EXISTS public."marketplace_disputes";
DROP TABLE IF EXISTS public."marketplace_order_items";
DROP TABLE IF EXISTS public."marketplace_payouts";
DROP TABLE IF EXISTS public."marketplace_promotions";
DROP TABLE IF EXISTS public."marketplace_reviews";
DROP TABLE IF EXISTS public."marketplace_sub_orders";
DROP TABLE IF EXISTS public."module_transactions";
DROP TABLE IF EXISTS public."payroll_lines";
DROP TABLE IF EXISTS public."payroll_runs";
DROP TABLE IF EXISTS public."pos_sessions";
DROP TABLE IF EXISTS public."production_batches";
DROP TABLE IF EXISTS public."royalty_calculations";
DROP TABLE IF EXISTS public."sales_return_lines";
DROP TABLE IF EXISTS public."sales_returns";
DROP TABLE IF EXISTS public."store_audits";
DROP TABLE IF EXISTS public."sync_conflict_log";
DROP TABLE IF EXISTS public."waste_logs";
DROP TABLE IF EXISTS public."ws_containers";
DROP TABLE IF EXISTS public."ws_expenses";
DROP TABLE IF EXISTS public."ws_payments";
DROP TABLE IF EXISTS public."app_loan_applications";
DROP TABLE IF EXISTS public."app_loan_products";
DROP TABLE IF EXISTS public."employees";
DROP TABLE IF EXISTS public."franchise_contracts";
DROP TABLE IF EXISTS public."marketplace_orders";
DROP TABLE IF EXISTS public."marketplace_products";
DROP TABLE IF EXISTS public."marketplace_stores";
DROP TABLE IF EXISTS public."ws_deliveries";
DROP TABLE IF EXISTS public."ws_customers";
DROP TABLE IF EXISTS public."app_borrowers";

-- 5. Last: the trigger function that payroll_runs trg_auto_post_payroll_journal used.
-- It can only go after that table is gone, because the trigger depended on it
-- (PROBE-VERIFIED: dropping it first fails with "other objects depend on it").
DROP FUNCTION IF EXISTS public.auto_post_payroll_journal();

NOTIFY pgrst, 'reload schema';

