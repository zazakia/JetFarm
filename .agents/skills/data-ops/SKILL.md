---
name: data-ops
description: Script catalog, data migration pipelines, and reconciliation tools for POSCursor
---

# Data Operations Skill — POSCursor (WatermelonDB/Supabase Offline-First)

## Script Catalog

All scripts are in `scripts/`. Most use `dotenv` to load `.env` and connect to Supabase directly.

### Auth & User Management

| Script | Purpose | Usage |
|--------|---------|-------|
| `seed-test-users.mjs` | Creates admin + collector users with auth | `node scripts/seed-test-users.mjs` |
| `seed-collectors.mjs` | Seeds collector records in `app_collectors` | `node scripts/seed-collectors.mjs` |
| `signup-collectors.js` | Signs up collectors via Supabase Auth API | `node scripts/signup-collectors.js` |
| `create_test_user.js` | Creates one test user | `node scripts/create_test_user.js` |
| `create_user.js` | Generic user creation | `node scripts/create_user.js` |
| `signup-bernie.js` | Creates specific user "Bernie" | `node scripts/signup-bernie.js` |
| `link-profile.mjs` | Links auth user to user_profile | `node scripts/link-profile.mjs` |
| `auth-and-link.mjs` | Combined auth creation + profile link | `node scripts/auth-and-link.mjs` |

### Data Import & Migration

| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `extract-excel.js` | Extracts borrower/loan data from Excel → JSON | `brayan Import migration cleanup.xlsx` | `src/assets/migration_data.json` |
| `extract-excel.ts` | TypeScript version of above | Same | Same |
| `migrate_excel.js` | Full Excel → Supabase migration with rollover detection | `DCM-as-of-march-21.xlsx` | Direct DB writes |
| `migrate_savings_cbu_v2.mjs` | Import Savings/CBU from Excel, de-duplicate and fuzzy match | `savings and cbu2025 (1).xlsx` | Supabase |
| `migrate-brayan.ts` | Legacy migration script (15KB) | Excel file | Supabase |
| `import-weekly-borrowers.mjs` | Imports weekly borrower batch | - | `app_borrowers` |
| `import_excel.js` | Generic Excel import | - | Supabase |
| `sync_excel_payments.js` | Syncs payment records from Excel | - | `app_payments` |

### Verification & Audit

| Script | Purpose |
|--------|---------|
| `verify-auth.mjs` | Checks auth.users ↔ user_profiles sync |
| `verify_balances.js` | Validates cash balance calculations |
| `verify_db_balances.js` | Checks DB-level balance integrity |
| `verify-color-balance.js` | Checks color-coded balance matches |
| `verify_collector_logins.mjs` | Tests collector login credentials |
| `verify_dupes.js` | Finds duplicate records |
| `verify_excel_vs_supabase.js` | Compares Excel data against Supabase |
| `verify-connection.mjs` | Tests Supabase connectivity |
| `deep_verify.js` | Deep verification with multi-table checks |
| `check-migration-net-loans.js` | Validates migration net loan calculations |

### Data Fixes & Cleanup

| Script | Purpose |
|--------|---------|
| `fix_schedule_statuses.js` | Fixes payment schedule statuses |
| `fix_net_loan_released.js` | Corrects net loan released amounts |
| `fix_missing_tables.sql` | SQL to create missing tables |
| `fix_rls_local.sql` | Disables RLS for local development |
| `cleanup-undefined.ts` | Removes records with undefined values |
| `adjust_balances.js` | Adjusts balance discrepancies |

### Sync & Reconciliation

| Script | Purpose |
|--------|---------|
| `sync-execution.js` | Monitors sync execution |
| `sync-global.js` | Global sync operations |
| `sync-loan-alignment.js` | Aligns loan data between sources |
| `recompute-schedules.js` | Recomputes payment schedules from loan terms |
| `reconcile-master-import.js` | Master import reconciliation |
| `backfill-payment-schedules.js` | Generates missing payment schedules |

### Reports & Analysis

| Script | Purpose |
|--------|---------|
| `collector_totals_report.js` | Generates collector totals report |
| `combined_analysis.js` | Multi-dimensional data analysis |
| `discrepancy_details.js` | Details on data discrepancies |
| `final_reconciliation_audit.js` | Final audit report |

### Backup & Restore

| Script | Purpose |
|--------|---------|
| `backup.js` | Creates Supabase data backup |
| `restore_local.js` | Restores from backup |
| `create_empty_backups.js` | Creates empty backup structure |
| `merge_backup.js` | Merges multiple backup files |

### Schema & Debug

| Script | Purpose |
|--------|---------|
| `check-schema.mjs` | Checks Supabase schema |
| `check-columns.mjs` | Lists table columns |
| `check-users.mjs` | Lists auth users |
| `check_project.mjs` | Checks project config |
| `check_schedules.mjs` | Validates payment schedules |
| `debug_schema.js` | Debug schema issues |
| `fetch_schema.mjs` | Fetches full schema |
| `setup_local_schema.sql` | SQL for local schema setup |
| `test-admin.mjs` | Test admin functionality |
| `test-login.mjs` | Test login flow |
| `test_insert.mjs` | Test insert operations |

### Specialized

| Script | Purpose |
|--------|---------|
| `generate_hash.js` | Generates bcrypt password hashes |
| `build-loan-map.js` | Builds borrower→loan mapping |
| `count-json.js` | Counts records in JSON files |
| `inject_penalties.js` | Injects penalty records |
| `map-collectors.js` | Maps collector names |
| `split_names.js` | Splits full names → first/last |
| `run_memu.ps1` | PowerShell script for MEmu emulator |

### ⚠️ Legacy/Temporary (Safe to Delete)

These `tmp_*` files are one-off debugging scripts created during development. They are not referenced anywhere and can be safely removed:

| Script | Size | Purpose |
|--------|------|---------|
| `tmp_check_row_690.js` | 413B | Checked specific Excel row |
| `tmp_find_all_florenda.js` | 578B | Searched for specific borrower |
| `tmp_inspect_keys.js` | 645B | Inspected object keys |
| `tmp_list_all_headers.js` | 406B | Listed Excel headers |
| `tmp_read_excel_struct.js` | 715B | Read Excel structure |
| `tmp_read_headers.js` | 479B | Read Excel headers |
| `tmp_search_excel.js` | 1KB | Searched Excel data |
| `tmp_search_florenda_data.js` | 452B | Searched for specific data |
| `tmp_search_loan.js` | 1KB | Searched loan records |
| `tmp_search_name.js` | 1.2KB | Searched by name |
| `tmp_test_event.js` | 621B | Tested event handling |

**Total: 11 files, ~7KB** — All safe to delete.

## Excel → Supabase Migration Pipeline

### Overview

The primary migration tool is `scripts/migrate_excel.js`. It reads from `DCM-as-of-march-21.xlsx` and writes directly to Supabase.

### Pipeline Steps

1. **Extract**: Read Excel file with `xlsx` library
2. **Map Collectors**: Match collector names to existing `app_collectors` records (create if missing)
3. **Create Borrowers**: Split names (handles "Last, First" format), create `app_borrowers` records, deduplicate
4. **Create Loans**: Parse dates (handles Excel serial numbers), calculate interest rates, detect paid/active status from balance
5. **Rollover Detection**: Automatically detects loan rollovers by comparing `Net Loan` proceeds with expected amounts. Marks previous loans as `paid` and links via `previous_loan_id`
6. **Payment Extraction**: Reads payment amounts from date-header columns in the Excel sheet
7. **Batch Insert**: All records inserted in batches of 50 to avoid Supabase rate limits

### Key Functions

- `excelDateToJSDate(serial)` — Converts Excel serial number to JS Date
- `splitName(fullName)` — Handles "Last, First" and "First Last" formats
- Rollover detection formula: `|principal - previousBalance - netLoanProceeds| < 5`

### Running a Migration

```bash
# 1. Ensure .env has correct Supabase credentials
# 2. Place Excel file in project root
# 3. Run migration
node scripts/migrate_excel.js

# 4. Verify
node scripts/verify_excel_vs_supabase.js
node scripts/verify_balances.js
```

### Post-Migration Steps

1. Run `scripts/backfill-payment-schedules.js` to generate payment schedules
2. Run `scripts/recompute-schedules.js` if schedule statuses need recalculation
3. Run `scripts/verify_balances.js` to confirm cash calculations match
4. Sync app: force sync from the Sync Center screen
