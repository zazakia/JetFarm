# CRUD + Persistence Audit — per module

**Date:** 2026-09-27
**Method:** `node scripts/audit-crud-persistence.mjs` (deterministic, six-source cross-reference) + manual verification of every finding against raw SQL and WatermelonDB internals.
**Gates:** `npx tsc --noEmit` clean, `npm run lint` clean, `npx jest --no-coverage` 206 suites / 1645 tests passing (§8).

---

## 1. What was audited

Every WatermelonDB table was cross-referenced across six independent sources of truth:

| # | Source | What it proves |
|---|--------|----------------|
| 1 | `src/database/schema.ts` | local columns that exist on device (88 `tableSchema` entries) |
| 2 | `src/database/models/*.ts` | `static table` + `@field`/`@date` decorators (88 models) |
| 3 | `src/services/syncTableContract.json` | `coreTables` (33) / `configTables` (55) / `remoteTableMap` (88) / `apiOnlyTables` (2) |
| 4 | `supabase/migrations/*.sql` | remote `CREATE TABLE` / `ADD COLUMN` / RLS / policies (95 remote tables) |
| 5 | `app/**`, `src/**` | which screens/services reference the table (create / update / delete / read surface) |
| 6 | `src/modules/{module}/manifest.ts` | which coop module claims ownership of the table |

The audited universe is **95 rows**: 88 registered local tables, 6 manifest-declared tables that exist in no layer, and 1 remote table with no client at all.

### Reproduce

```bash
node scripts/audit-crud-persistence.mjs                 # per-domain matrix + module section
node scripts/audit-crud-persistence.mjs --domain payroll
node scripts/audit-crud-persistence.mjs --json          # machine-readable
```

### Result

Snapshot of the audit run, before remediation (see §8 for the post-fix numbers and §9 for what changed):

```
tables audited: 95   HIGH: 4   MED: 12   clean: 79
```

| domain | tables | core | config | flagged |
|---|---|---|---|---|
| accounting | 5 | 4 | 1 | 0 |
| agri-store | 3 | 0 | 1 | 2 |
| agribusiness | 11 | 0 | 11 | 0 |
| banking | 1 | 1 | 0 | 0 |
| cash | 1 | 1 | 0 | 0 |
| collections | 4 | 4 | 0 | 0 |
| expenses | 2 | 2 | 0 | 0 |
| identity | 5 | 2 | 3 | 0 |
| lending | 10 | 9 | 1 | 0 |
| other (settings/config) | 38 | 3 | 35 | 3 |
| payroll | 6 | 2 | 3 | 2 |
| pharmacy | 2 | 0 | 0 | 2 |
| transport | 2 | 0 | 0 | 2 |
| water-station | 5 | 5 | 0 | 5 |

**Lending, accounting, collections, expenses, banking, cash, identity and agribusiness are clean.** Every finding concentrates in payroll, collectors, device/HR config, the legacy `app_*` payroll pair, the water-station duplicate migrations, and the three unimplemented coop modules.

---

## 2. The mechanism that turns a column mismatch into an app-wide failure

This is the single most important thing this audit established, because it changes the severity of four otherwise-benign-looking rows. Read it before judging any finding below.

1. **The push payload is the entire local record.** WatermelonDB builds the change set from `Object.assign({}, record._raw)`
   (`node_modules/@nozbe/watermelondb/src/sync/impl/fetchLocal.js:37-43`).
2. **`_raw` always contains every column of the local `tableSchema`.** `sanitizedRaw()` iterates `tableSchema.columnArray` and calls `_setRaw` for each key, writing `null` for unset optionals — the type contract is stated verbatim in `node_modules/@nozbe/watermelondb/src/RawRecord/index.js:22-27` ("it has exactly the fields described by TableSchema").
3. **`SyncService.sanitizeRecord` does not filter to remote columns.** It strips exactly two keys: `const { _status, _changed, ...clean } = record;` (`src/services/SyncService.ts:1567`). Everything else — including local-only columns and columns whose value is `null` — goes into the payload built at `src/services/SyncService.ts:1178-1180`.
4. **PostgREST rejects the whole batch on one unknown column.** `PGRST204` is classified as `failureKind: 'schema'` by `getSyncFailureKind` (`src/services/SyncService.ts:91`).
5. **A `schema` failure is never deferred.** The two deferral paths in the push loop cover only (a) a *missing table* on an optional table (`isMissingRemoteTableError`, `src/services/SyncService.ts:1331`) and (b) a *constraint* error on an optional table (`src/services/SyncService.ts:1363`). A column mismatch on any table falls through to the hard branch at `src/services/SyncService.ts:1394-1413`, which records the failure and continues to the next table.
6. **Then the whole cycle throws.** `if (failures.length > 0) throw new Error('Push failed for N table(s)…')` (`src/services/SyncService.ts:1425-1427`) → `pushChanges` rejects → `synchronize()` rejects → `markLocalChangesAsSynced` never runs, so the poisoned rows keep their `_status` and are retried, identically, on every future sync.
7. **`deleted_at` makes this unconditional for soft deletes.** The delete path builds its payload as `{ id, deleted_at, updated_at }` (`src/services/SyncService.ts:1285-1289`), so a remote table without a `deleted_at` column fails even when nothing was ever deleted locally.

**Consequence:** one extra local column, or one missing remote `deleted_at`, on a synced table is not a warning. It is a permanent, self-retrying sync failure for that table, and a red error banner for the whole sync run — with the rows stuck in `created`/`updated`/`deleted` forever. `OPTIONAL_REMOTE_TABLES` (`src/services/SyncService.ts:64`, = `configTables`) does not rescue it: only a *missing table* is tolerated there.

This also explains why the design comment at `src/services/SyncService.ts:61-63` is right to be paranoid: skipping a core-table failure would advance the watermark and make the loss permanent. The engine correctly refuses to hide the error — it just has no way to avoid producing it.

---

## 3. HIGH findings

All four are repaired by one forward migration and locked by the CI guards — see the §9 table.
The analysis below is kept as written, including the "fix" SQL, which is what the migration applies.

### H1 — `collectors` → `app_collectors`: two local-only columns (`commission_rate`, `member_id`)

| | |
|---|---|
| Local schema | `src/database/schema.ts:69-76` — `commission_rate`, `member_id` |
| Local model | `src/database/models/Collector.ts:10-11` — `@field('commission_rate')`, `@field('member_id')` |
| Remote table | `supabase/migrations/20260401000000_initial_schema.sql:41` — `id, full_name, auth_id, is_active, created_at, updated_at, deleted_at`. Neither column exists, and **no migration ever adds them** (`commission_rate` has zero hits across all 95 migration files; `member_id` is added only to `app_borrowers` in `20260704000000_add_sync_fields.sql:6`) |
| Sync group | **core** (`syncTableContract.json` → `coreTables`) — no deferral path |
| Live writers | `src/services/CollectorCommissionService.ts:45-46,54-56` (both `commissionRate` and `memberId`), `src/services/SampleDataService.ts:234` |

**Impact:** every push of `collectors` fails, because `_raw` carries `commission_rate` and `member_id` unconditionally (§2). Creating or editing any collector in `app/(admin)/collectors/` produces a row that can never leave the device. The sync run reports `Push failed for 1 table(s): collectors: …`, permanently, on every device that has ever touched a collector.

**Fix (recommended): add the columns forward.**
```sql
-- supabase/migrations/<ts>_add_collector_commission_columns.sql
ALTER TABLE public.app_collectors
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS member_id       TEXT;
NOTIFY pgrst, 'reload schema';
```
Forward-only migration, matches the existing `20260704000000_add_sync_fields.sql` precedent for exactly this class of drift, no data rewrite, no local change. `member_id` stays `TEXT` to match `app_borrowers.member_id`.
**Rejected alternative:** dropping the columns locally loses the commission feature and would still need a local schema migration (schema version bump + data loss on-device).

### H2 — `employees` → `employees`: three local-only columns from a superseded employee generation (`name`, `role`, `base_salary`)

| | |
|---|---|
| Local schema | `src/database/schema.ts` (`employees`) declares `name`, `role`, `base_salary` **and** `first_name`, `last_name`, `middle_name`, `position`, `daily_rate` |
| Local model | `src/database/models/Employee.ts:20-21` — `@field('base_salary') baseSalaryField`, `@field('role') roleField`; `name` is written straight into the raw record |
| Remote table | `supabase/migrations/20260910010000_crispyking_payroll_module.sql:98` — `first_name/last_name/middle_name/position/daily_rate…`; **no** `name`, `role` or `base_salary`, and no migration adds them |
| Sync group | **core** |
| Live writers | `src/services/PayrollService.ts:76` (`record.baseSalaryField`), `:74` (`record.roleField`), `:84` (`record._raw.name = fullName`), `:125,131` (update path) |

**Root cause, and it is not a typo:** the app has *two* employee generations. `20260524120000_create_payroll_tables.sql:9` created remote `app_employees (name, role, base_salary)`; `20260910010000` created remote `employees (first_name, last_name, …)` and remapped local `employees` onto it. The local table was merged, the remote was not — so local `employees` still ships the *old* generation's three columns, which now exist only on the abandoned `app_employees` table. `PayrollService.createEmployee` even keeps both shapes alive deliberately via its "Legacy fields" branch.

**Impact:** every `employees` push fails (§2), i.e. no employee created or edited in the app ever reaches Supabase, on every device.

**Fix (recommended): add the three columns to remote `employees`,** mirroring `app_employees` types (`name text`, `role text`, `base_salary numeric`), all nullable, + `NOTIFY pgrst`. This makes remote `employees` a superset of both generations and unblocks the push without touching the legacy-compat code in `PayrollService`.
Follow-up (not required to fix the bug): once remote `employees` carries both shapes, delete `app_employees`/`app_payrolls` (see M2) so there is one employee table.
**Rejected alternative:** removing `name`/`role`/`base_salary` from the local schema means editing `PayrollService`'s legacy branch *and* a destructive local schema migration for a table that already has data on devices.

### H3 — `device_registry`: remote table has no `deleted_at`

- Local schema declares `deleted_at`; remote `device_registry` (`supabase/migrations/20260910020000_crispyking_franchise_hr_device.sql:77-100`) has `created_at`/`updated_at` only, and nothing alters it afterwards.
- Sync group: **config** (optional) — but per §2 step 5, optionality only excuses a *missing table*, never a missing column, so this is still a hard failure.
- The table also has a real write surface (2 creates / 4 updates) and the soft-delete upsert sends `deleted_at` unconditionally (`src/services/SyncService.ts:1285-1289`).

**Impact:** `device_registry` can never push. This is the MDM/lock/wipe control table (`is_locked`, `wipe_requested`) — the remote side is exactly where a wipe request has to be visible, so the failure is not cosmetic: remote device controls are inert.

**Fix:** `ALTER TABLE public.device_registry ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;` + `NOTIFY pgrst, 'reload schema';`

### H4 — `statutory_rates`: remote table has no `deleted_at`

Same shape as H3. Remote `statutory_rates` (`supabase/migrations/20260910010000_crispyking_payroll_module.sql:15-28`) has `created_at`/`updated_at` only; local schema declares `deleted_at`; sync group is config, which does not rescue a column error. Its write surface is currently delete-only in the reference scan (`0/0/2~`), so this one is latent rather than firing today — but the first time a rate bracket is retired the table wedges.

**Fix:** `ALTER TABLE public.statutory_rates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;` + `NOTIFY pgrst, 'reload schema';`

> **Ordering note for all four:** H1–H4 are independent, all forward-only, all idempotent (`IF NOT EXISTS`), and none rewrites data. They can ship as a single migration. Applying them requires the operator path (`scripts/deploy-hetzner.mjs` applies pending migrations through `docker exec supabase-db psql`), so this is an operator action, not a code-only change.

---

## 4. MED findings

### M1 — `ws_*` tables are created twice (`duplicate-create`, 5 rows)

`ws_customers`, `ws_deliveries`, `ws_containers`, `ws_payments`, `ws_expenses` are each created in `20260709010000_water_station.sql` **and again** in `20260714101545_repair_sync_schema_contract.sql`.

Verified harmless *today*: a column-set diff of the two definitions shows they are identical (`10/10, 10/10, 8/8, 9/9, 8/8`), and `CREATE TABLE IF NOT EXISTS` makes the second one a no-op. The risk is prospective: a "repair" migration that re-declares a table can never actually repair a column, because `IF NOT EXISTS` short-circuits on the table, not on the column list. It is also the concrete instance behind open task #9 (collapse duplicate migration pairs + schema-reproducibility guard).

**Fix:** delete the redundant `CREATE TABLE` blocks from the repair migration (keep its RLS/policy/index statements) and add the guard described in §6.

**Applied:** the guard shipped ("never lets two migrations disagree about one table definition"); the duplicates were **not** collapsed, because both files are already applied in production and rewriting applied migrations changes history without changing the schema. The guard compares column sets, so divergence fails CI instead of silently losing to whichever file ran first. Note that the same pattern exists for `cic_settings` and `cic_submissions` (created in `20260709030000_create_cic_tables.sql` and again in `20260715075836_repair_cic_production_schema.sql`); the audit script does not list them as `duplicate-create` because its row universe is synced tables and CIC is `apiOnlyTables`, but the guard sees all seven duplicated definitions and all are identical today.

### M2 — `app_employees` / `app_payrolls`: a dead remote pair with a live FK landmine

`app_employees` has **zero** references in `src/` or `app/` and is not in `remoteTableMap` — the client cannot reach it. It survives only because `20260524120000_create_payroll_tables.sql:36` points `app_payrolls.employee_id` at it:

```sql
employee_id  uuid NOT NULL REFERENCES app_employees(id),
```

and local `payrolls` **is** still mapped to `app_payrolls` and registered as a model (`src/database/models/Payroll.ts:5`, `src/database/index.ts:36,130`). So a legacy payroll row whose `employee_id` references a new-generation `employees.id` is rejected by PostgREST with `23503` on push — a constraint error on a **core** table, i.e. another hard failure. Current code creates `payroll_runs`/`payroll_lines`, not `payrolls`, so nothing triggers it today.

**Fix:** confirm no `payrolls`/`app_payrolls` rows exist in production, then retire local `payrolls` + `Payroll` model + the `app_payrolls`/`app_employees` pair in one forward migration. Until then, at minimum drop the stale `REFERENCES app_employees(id)` so a legacy row cannot wedge the `payrolls` push.

**Applied:** the FK drop shipped as `20261002000000_retire_legacy_payroll_foreign_key.sql` (constraint only — no table, column, row or index touched). The full retirement waits on the production row counts, which this audit could not take.

### M3 — Six coop-module tables exist in no layer (`manifest-phantom-table`)

`agri_products`, `agri_sales`, `pharmacy_medicines`, `pharmacy_sales`, `transport_vehicles`, `transport_collections` are declared in `src/modules/{module}/manifest.ts` → `dbTables` and appear in **no** local schema, **no** model, **no** `remoteTableMap`, **no** migration.

Blast radius is limited because `dbTables` is never consumed: the only reader is a shape assertion (`src/modules/__tests__/ModuleRegistry.test.ts:69`) — `grep dbTables` outside the manifests returns exactly that test. Nothing calls `db.get('pharmacy_medicines')`. Note that `agri_products` does appear elsewhere as a *string value* of `stock_movements.product_source` (`src/database/models/StockMovement.ts:8`, `src/services/__tests__/InventoryJournalService.test.ts:33`) — a discriminator token, not a table.

**Fix:** either delete the phantom `dbTables` entries, or (better, see M4) implement the modules against the generic `stock_movements` / `module_transactions` path and let the registry assert what it declares.

**Applied:** the six entries are gone — all three manifests declare `dbTables: []` with the intended column shapes kept as a comment. The new registry guard fails if a future manifest names a table that exists in no layer.

### M4 — Agri-Store, Pharmacy and Transport consoles have no persistence at all

The three screens named by their manifests' `routes` hold business data in `useState`:

| screen | data |
|---|---|
| `app/(admin)/modules/agri-store/index.tsx:16-29` | 5 hardcoded fertilizer/seed products, `salesCount = 14`, `totalRevenue = 48250` |
| `app/(admin)/modules/pharmacy/index.tsx:17-30` | hardcoded medicines, `dispensedCount = 38`, `totalRevenue = 6450` |
| `app/(admin)/modules/transport/index.tsx:17-28` | hardcoded vehicles, `totalCollections = 4400` |

"Record Sale" decrements in-memory stock and adds the price to an in-memory total (`agri-store/index.tsx:33-44`) — then shows an Alert confirming the sale. Nothing is written to WatermelonDB, so nothing syncs, and every reload restores the seed data. The banner presents `₱48,250` as *"Today's Sales"*.

The repo already has the real generic path these modules should use: `stock_movements` + `InventoryJournalService.recordMovement` (`src/services/InventoryJournalService.ts:124-160`, driven from `app/(admin)/accounting/inventory-journal.tsx:61`), plus `module_transactions` (mapped, modelled, synced) which currently has **no writer or reader outside its own model file** — it is an empty socket waiting for exactly these modules. Water-station is the proof the pattern works: 5 real tables, 4 screens, all model-backed (`WsCustomer`/`WsDelivery`/`WsContainer`).

**Fix:** product decision, not a bug fix — either wire these three consoles to `stock_movements`/`module_transactions` and post through their existing `defaultCoA`, or hide them behind their feature flags (`feature.modules.agri_store.enabled` etc., already declared) so they cannot be mistaken for live books. `src/constants/configDefaults.ts:75` shows `module.payroll` defaults to `false`, so the flag machinery is the right lever.

**Applied (honest state, not persistence):** the three flags now default to `false`, each console renders `DemoDataNotice`, the period-claiming KPI labels became "Preview … (sample)", the `COA Segment` badges read `(planned)`, and the action alerts state that nothing was saved. Locked by `src/modules/__tests__/modulePersistenceGuards.test.ts`. The build itself stays open — see §9 note 1, including the caveat that `ensureFeatureFlags()` will not flip an already-seeded row.

### M5 — 4 tables ship RLS through a dynamic `DO` block the auditors can't see

`app_settings`, `app_role_permissions`, `app_loan_products`, `app_feature_flags` are protected by `20260520140000_add_configurable_app_settings.sql:75-102`, which loops a table array through `format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl)` and creates one read + one admin-only `FOR ALL` policy per table, with `REVOKE ALL … FROM anon`.

This audit initially reported all four as `no-rls` — **a false positive**, corrected in §7. Nothing to fix in SQL. Recorded here because any future tool that greps for literal `ALTER TABLE … ENABLE ROW LEVEL SECURITY` will re-derive the same wrong answer, and because it means four config tables are protected by a construct no static analysis resolves.

---

## 5. Things audited and found correct

Worth stating explicitly, because their absence is a result:

- **Delete path.** `BaseModelService.delete()` (`src/services/BaseModelService.ts:76-93`) calls `destroyPermanently()` but has **no production caller**. The live path is `softDelete` (18 `deletedAt = Date.now()` sites), which matches the sync contract's soft-delete push. No accidental hard-delete-then-tombstone-confusion surface exists.
- **Soft-delete column coverage.** Every other synced table (86 of 88) declares `deleted_at` on both sides. H3/H4 are the only exceptions.
- **`id` type drift.** Checked as a candidate failure class, because `22P02 invalid_text_representation` on a `uuid` column is the same hard-failure shape as §2. All 88 mapped remote tables were resolved to their `id` declaration: **20 keep `id text`** (the whole `20260401000000_initial_schema.sql` `app_*` generation plus the four `20260520140000` config tables), the other 68 are `uuid`. Local WatermelonDB ids are `string` either way and the generator emits UUID v4 (`src/database/index.ts`), so nothing in the local→remote direction can fail to parse. The residual risk is the one already documented in M2 (`payrolls.employee_id` string → `app_payrolls.employee_id uuid` with an FK to a table the client cannot reach), not column typing.
- **Double-entry ordering.** `journal_entries` precedes `journal_entry_lines` in `coreTables`, asserted by `src/services/__tests__/SyncServicePushIntegrity.test.ts:57-63`; the two-phase draft-then-post push (`SyncService.ts:1183-1242`) is coherent with `trg_enforce_balanced_journal_insert`.
- **Lending / accounting / collections / expenses / banking / cash / identity / agribusiness:** 39 tables, zero findings.

---

## 6. Guards to add (so this cannot regress)

The audit's central lesson is that **nothing in the repo compares local schema columns to remote columns.** The only column-level assertion that exists is `requiredRemoteColumns`, and it covers 3 tables (`borrowers`, `cic_settings`, `cic_submissions`) and is additive — `scripts/verify-sync-integrity.mjs:160-162` selects `id` plus those columns, so an *extra local* column is invisible to it by construction.

Proposed, in cost order — status recorded after remediation:

1. **`contract.remoteColumns` (static).** *Added, with one deviation.* The assertion exists ("pushes only columns that the remote table actually has"), but the remote column set is **parsed from `supabase/migrations/*.sql` at test time** instead of being duplicated into `syncTableContract.json`. 88 hand-maintained column lists would drift from the migrations that actually create the columns; the migrations are the source of truth, they are already in the repo, and the test needs no credentials or network either way. Catches H1–H4 in CI. It is also exactly what `sanitizeRecord`'s missing whitelist would need if the team ever prefers filtering over failing.
2. **Fail fast in dev/test instead of at the edge.** *Not implemented.* `sanitizeRecord` still ships every local column. Deliberate: silently dropping a column from a push converts a loud sync failure into quiet data loss, and the guard above now catches the mismatch before it ships.
3. **Module registry assertion.** *Added* ("keeps the coop module registry honest about the tables it claims") — every `dbTables` name must resolve to a local `tableSchema` entry or a remote table in the migration history. Kills M3 permanently.
4. **Schema-reproducibility guard.** *Added* ("never lets two migrations disagree about one table definition"). Narrowed from "no `CREATE TABLE` may appear twice" to "copies must define the same columns", because the existing duplicates are in already-applied migrations that must not be rewritten.
5. **New during remediation:** every foreign key in the migration history must aim at a table the client can reach, or be explicitly dropped. This is the M2 class of failure and nothing else in the repo saw it.

---

## 7. Corrections made to the audit itself

The script produced four wrong answers before its parsers were fixed. Recorded so the numbers above can be trusted, and so the same traps aren't re-introduced:

| Wrong claim | Why the tool said it | Fix |
|---|---|---|
| `no-rls` on 4 `app_*` config tables | RLS applied through `EXECUTE format('… %I …')` in a `DO` block; static regex can't resolve `format()` | parse `FOREACH … IN ARRAY ARRAY[…]` loops (`audit-crud-persistence.mjs`, Migrations section) |
| `cash_transactions` local-only `branch_id`, `pos_session_id` | both columns **are** added — inside `IF EXISTS (…) THEN ALTER TABLE …` in `20260911020000_enterprise_pos_sessions_and_cash_controls.sql:30-35`; splitting on `;` and requiring the statement to *start* with `ALTER` skipped it | anchor on every `ALTER TABLE` occurrence and read forward to the next `;` |
| 8 × `hard-delete-no-softdelete-column` | the manifest parser leaked *column* names (`name`, `status`, `amount`, …) into the table-name vocabulary, creating ~46 fake tables | extract only depth-1 objects of the `dbTables` array |
| `app_collectors`/`app_cash_transactions` reported as unmapped local tables | probed `coreTables` with remote names instead of local names | `group` is now derived from the contract's own local names and printed per row |

Also verified as **not** a defect: the M1 duplicate `CREATE TABLE` blocks are byte-equivalent in column set, so the migration history is redundant rather than wrong.

---

## 8. Verification state

Audit run as originally reported: `95 / 4 HIGH / 12 MED / 79 clean`. Post-remediation run:
`89 / 0 HIGH / 6 MED / 83 clean`, and `--fail-on-high` exits 0. The 6 rows that left the table list
are the six phantom manifest tables (M3), which the script had been counting as unmapped remote
orphans; the remaining 6 MED are the 5 `duplicate-create` rows (M1) plus 1 `remote-table-unmapped`.

- Findings H1–H4 and M1–M2 were each re-derived by reading the migration SQL directly (file:line quoted above), not from the script's output alone.
- §2 was established from the installed WatermelonDB source, not from inference.
- **No production database was contacted** — for the audit or for the fixes. It is static analysis plus SQL reading. `node scripts/verify-sync-integrity.mjs --production` remains the live confirmation step.
- The two new migrations have been **written, not executed**. Applying them is an operator action through the Hetzner path (`scripts/deploy-hetzner.mjs` applies pending migrations via `docker exec supabase-db psql` + `NOTIFY pgrst`).
- Regression gates after remediation: `npx tsc --noEmit` exit 0, `npm run lint` exit 0, `npx jest --no-coverage` **211 suites / 1693 tests passed** (53.8s).
- The new FK guard was verified RED before the migration existed (by temporarily removing the file) and GREEN after, so the assertion is known to bite rather than merely to pass.

---

## 9. Remediation applied

| finding | change | enforced by |
|---|---|---|
| H1 `app_collectors` missing `commission_rate`, `member_id` | `20260927000000_sync_push_repair_missing_remote_columns.sql` — additive, `IF NOT EXISTS`, `NOTIFY pgrst` | "pushes only columns that the remote table actually has"; "keeps the repaired push columns available locally, remotely, and in the typed sample" |
| H2 `employees` missing `name`, `role`, `base_salary` | same migration | same two tests |
| H3 `device_registry` missing `deleted_at` | same migration | the push-payload test, which requires `deleted_at` on every pushed table |
| H4 `statutory_rates` missing `deleted_at` | same migration | the push-payload test |
| M1 `ws_*` created twice | **deliberately not collapsed.** Both files are applied in production; rewriting them changes history without changing the database, and both copies use `CREATE TABLE IF NOT EXISTS`, so the second block is a no-op. The real risk is future divergence, so that is asserted instead. | "never lets two migrations disagree about one table definition" |
| M2 stale `app_payrolls → app_employees` FK | `20261002000000_retire_legacy_payroll_foreign_key.sql` drops `app_payrolls_employee_id_fkey` and nothing else — no table, column, row or index touched | "keeps every surviving foreign key pointed at a table the client can reach" + "retires the legacy payroll foreign key in a forward-only migration" |
| M3 six phantom `dbTables` | `agri-store`, `pharmacy`, `transport` manifests now declare `dbTables: []`, keeping the intended column shapes as a comment so the future build has the contract on record | "keeps the coop module registry honest about the tables it claims" + `modulePersistenceGuards.test.ts` |
| M4 three consoles with no persistence | Shipped dark and labelled rather than silently rewritten — see note below. The three `feature.modules.*.enabled` defaults became `false`; each console renders `DemoDataNotice`; period-claiming KPI labels ("Today's Sales / Revenue / Collections") became "Preview … (sample)"; the `COA Segment: X` badges read `(planned)`; the action alerts say "Preview Only — Nothing Was Saved" instead of confirming a write. | `src/modules/__tests__/modulePersistenceGuards.test.ts` (5 guards) + `src/components/__tests__/DemoDataNotice.test.tsx` |
| CI gate | `node scripts/audit-crud-persistence.mjs --fail-on-high` exits 1 on any HIGH table row or any phantom manifest table, in the human and `--json` paths; `--json` gained a `summary` block | the script |
| typed sample drift | `src/database/types.ts` `app_collectors` gained `commission_rate` / `member_id` in Row/Insert/Update | the typed-sample assertion above |

Two things this pass deliberately did **not** do:

1. **M4 is a decision to build, not to patch.** Gating and labelling removes the harm (fake books
   presented as real numbers); it does not give the units persistence. The generic path already knows
   these module ids — `InventoryJournalService.ts:23,30` maps `agri-store → 1210 / 5130`, and
   `SampleDataService.ts:657,678` writes `stock_movements` with `moduleId: 'agri-store'` — while
   `module_transactions` is mapped, modelled and synced with no writer or reader at all. Wiring the
   consoles through `InventoryJournalService.recordMovement` + each manifest's `defaultCoA` is the
   real work and needs product input on what each unit records.
2. **The flag default only governs fresh databases.** `SettingsService.ensureFeatureFlags()` skips
   rows that already exist, so an installation that seeded these flags enabled stays enabled until
   they are switched off in Settings > Feature Flags. The screen-level labelling is what protects an
   existing install, which is why it was done as well as the flip.

## 10. Order of work left for the operator

1. Apply the two forward migrations: `npm run db:migrate` (dry run, shows what is pending), then `npm run db:migrate:apply -- --only 20260927000000,20261002000000`. `scripts/apply-hetzner-migrations.mjs` is a schema-only runner — same SSH + `docker exec supabase-db psql` path and same `deploy_schema_migrations` ledger as `deploy-hetzner.mjs` Stage 2, but it does not touch the site directory, the web bundle, or any env file, and it stops on the first error instead of warning and deploying anyway. It re-verifies the columns and the FK afterwards; `npm run db:migrate:verify` re-runs just that check.
2. `node scripts/verify-sync-integrity.mjs --production` to confirm the repaired columns against the live database.
3. Turn the three preview module flags off in Settings on any installation that already has them on.
4. Decide the M4 build: which real tables and flows Agri-Store, Pharmacy and Transport need.
5. Put `--fail-on-high` in CI alongside the Jest contract suite.
6. Optional hygiene, roughly by value: retire `payrolls` / `app_payrolls` / `app_employees` once production row counts are confirmed zero (the FK is already disarmed, so this is no longer urgent); regenerate `src/database/types.ts` — it types 18 of the 88 mapped tables and drifts silently (measured now: 8 of those 18 are stale, `app_borrowers` alone missing 50 local columns); then the pre-existing tasks #4, #7, #8, #11.
