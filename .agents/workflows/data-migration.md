---
description: How to migrate data from Excel spreadsheets to Supabase for POSCursor
---

# Data Migration Workflow (Excel → Supabase)

## Prerequisites

1. Excel file placed in project root (e.g., `DCM-as-of-march-21.xlsx`)
2. `.env` configured with target Supabase credentials
3. Dependencies installed: `xlsx`, `@supabase/supabase-js`, `dotenv`, `crypto`

## Step 1: Verify Connection
// turbo
Run: `node scripts/verify-connection.mjs`

## Step 2: Backup Existing Data
Run: `node scripts/backup.js`

This creates a backup of current Supabase data before migration.

## Step 3: Check Excel Structure
Inspect the Excel file to understand its layout:
- Sheet name (typically `'DATA of Clients'`)
- Column mapping (Name, Address, Phone, Collector, Dates, Amounts)
- Date format (Excel serial numbers vs string dates)

## Step 4: Run Extraction (Optional — JSON intermediate)
If you want to inspect data before migrating:
// turbo
Run: `node scripts/extract-excel.js`

Output: `src/assets/migration_data.json`

Review the JSON to verify borrower count, loan details, and payment data.

## Step 5: Run Full Migration
Run: `node scripts/migrate_excel.js`

This script:
1. Reads `DCM-as-of-march-21.xlsx`
2. Creates/matches collectors in `app_collectors`
3. Creates borrowers in `app_borrowers` (deduplicates by name)
4. Creates loans in `app_loans` with rollover detection
5. Creates payments in `app_payments` from date columns
6. Inserts in batches of 50

### What Gets Created
- **Collectors**: Matched by name or created new
- **Borrowers**: With `first_name`, `last_name`, `full_name`, `address`, `phone`, `business`
- **Loans**: With `principal_amount`, `interest_rate`, `term`, `installment_amount`, status detection
- **Payments**: From date-header columns, including rollover clearing payments

### Rollover Detection Logic
The script detects when a borrower refinances:
```
if |currentPrincipal - previousBalance - netLoanProceeds| < 5:
    → Previous loan marked as 'paid'
    → Current loan gets previous_loan_id set
    → Clearing payment created for previous balance
```

## Step 6: Generate Payment Schedules
Run: `node scripts/backfill-payment-schedules.js`

Creates `app_payment_schedules` records for each loan based on term and frequency.

## Step 7: Recompute Schedule Statuses
Run: `node scripts/recompute-schedules.js`

Marks schedules as 'paid', 'partial', or 'pending' based on actual payments.

## Step 8: Verify Migration
// turbo
Run: `node scripts/verify_excel_vs_supabase.js`

Then:
// turbo
Run: `node scripts/verify_balances.js`

Check for:
- Borrower count matches Excel
- Loan amounts align
- Payment totals match
- No orphaned records

## Step 9: Deep Verification
Run: `node scripts/deep_verify.js`

Multi-table consistency check across borrowers, loans, payments, and schedules.

## Step 10: Sync App
Force sync from the app's Sync Center to pull migrated data into WatermelonDB.

## Rollback
If migration has issues:
Run: `node scripts/restore_local.js`

This restores from the backup created in Step 2.

## Common Issues

| Issue | Fix |
|-------|-----|
| Duplicate borrowers | Script deduplicates by `full_name.toLowerCase()` — check for name variants |
| Wrong date parsing | Excel serial numbers use epoch 1900-01-01; verify with `excelDateToJSDate()` |
| Missing collector IDs | Script auto-creates collectors; verify collector names in Excel |
| Loan status incorrect | Check `Total Loan Balance` column; 0 or negative = 'paid' |
| Payments missing | Verify date-header columns match `MM/DD/YYYY` pattern |
