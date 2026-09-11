# SYNC FIX - Action Guide

## What Was Done

I've fixed your SyncService to handle the 3 critical issues:

### 1. **Foreign Key Constraint Violations** ✓ FIXED
- **Problem**: Records missing `created_by` or `collector_id` 
- **Solution**: Added `validateForeignKeys()` method that filters invalid records before pushing
- **Benefit**: Clear error messages showing exactly which records failed and why

### 2. **BIGINT Type Errors** ✓ FIXED  
- **Problem**: ISO strings being sent to BIGINT columns (expecting milliseconds)
- **Solution**: Added `SCHEMA_COLUMN_TYPES` mapping for type-aware conversion
- **Benefit**: Each table/column is handled correctly based on its actual type

### 3. **Timestamp Conversion** ✓ FIXED
- **Problem**: Milliseconds converted to ISO strings indiscriminately
- **Solution**: Smart conversion that respects column types
- **Benefit**: TIMESTAMP columns get ISO strings, BIGINT columns stay as milliseconds

---

## What You Need to Do Now

### STEP 1: Diagnose Your Database Schema (5 minutes)

Open your Expo app and run these diagnostic functions in your debug/admin screen:

```typescript
import { 
    checkSupabaseSchema, 
    inspectSampleRecords, 
    findOrphanRecords 
} from './src/utils/checkSupabaseSchema';

// Run these in sequence:
await checkSupabaseSchema();      // Shows all column types
await inspectSampleRecords();     // Shows actual data types
await findOrphanRecords();        // Shows FK constraint violations
```

**Expected output**:
```
### LOANS ###
  id: uuid
  created_at: bigint ← Note this type
  release_date: timestamp ← Note this type
  payment_date: bigint ← Note this type
  collector_id: uuid

### BORROWERS ###
  id: uuid
  created_at: bigint or timestamp? ← Find out!
  date_of_birth: bigint or timestamp? ← Find out!
  collector_id: uuid
  created_by: uuid

Found 2 borrowers with missing foreign keys:
  ID: borr-123, collector_id: null, created_by: null
```

### STEP 2: Verify Your Column Types in Supabase

Log into Supabase SQL editor and run this for each critical table:

```sql
-- For loans table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'loans' 
AND (column_name LIKE '%_at' OR column_name LIKE '%date%')
ORDER BY column_name;

-- Repeat for: borrowers, payments, payment_schedules
```

**Look for this pattern**:
```
Column Name          Type
created_at          bigint     ← BIGINT - stays as milliseconds
release_date        timestamp  ← TIMESTAMP - converts to ISO string
payment_date        bigint     ← BIGINT - stays as milliseconds
```

### STEP 3: Update SyncService SCHEMA_COLUMN_TYPES

Edit `/src/services/SyncService.ts` and update the mapping:

```typescript
const SCHEMA_COLUMN_TYPES: Record<string, Record<string, 'timestamp' | 'bigint'>> = {
    // FROM YOUR DIAGNOSTIC AND SQL QUERY, UPDATE THESE:
    
    loans: {
        created_at: 'bigint',          // ← Was this BIGINT or TIMESTAMP?
        updated_at: 'bigint',          // ← Find out and update
        deleted_at: 'timestamp',       // ← Update based on results
        release_date: 'timestamp',     // ← Update based on results
        first_payment_date: 'timestamp',
        maturity_date: 'timestamp',
    },
    
    borrowers: {
        created_at: 'timestamp',       // ← Update based on YOUR schema
        updated_at: 'timestamp',
        date_of_birth: 'timestamp',    // ← Update based on YOUR schema
    },

    payments: {
        created_at: 'bigint',          // ← Update based on YOUR schema
        payment_date: 'bigint',        // ← Update based on YOUR schema
        encoded_at: 'timestamp',
    },

    payment_schedules: {
        created_at: 'bigint',          // ← Update based on YOUR schema
        due_date: 'bigint',            // ← Update based on YOUR schema
    },
};
```

### STEP 4: Fix Orphan Records

If `findOrphanRecords()` found any, fix them in Supabase SQL editor:

```sql
-- Fix borrowers missing created_by
UPDATE borrowers 
SET created_by = collector_id 
WHERE created_by IS NULL;

-- Fix borrowers missing collector_id (shouldn't exist, but just in case)
UPDATE borrowers 
SET collector_id = (
    SELECT id FROM user_profiles 
    WHERE role = 'collector' LIMIT 1
) 
WHERE collector_id IS NULL;

-- Fix loans missing collector_id
UPDATE loans 
SET collector_id = (
    SELECT collector_id FROM borrowers 
    WHERE borrowers.id = loans.borrower_id
) 
WHERE collector_id IS NULL;
```

### STEP 5: Test the Fix

1. **Go Offline**: Enable airplane mode on your phone
2. **Create a Borrower**: 
   - Open Borrower form
   - Fill in: Name, Phone, Address, Collector
   - Save
3. **Go Online**: Disable airplane mode
4. **Sync**: Open Sync Center and trigger sync
5. **Verify**:
   - ✓ No "invalid input syntax for type bigint" error
   - ✓ No "foreign key constraint" error
   - ✓ Sync log shows "Sync completed successfully"
   - ✓ New borrower appears in Supabase

### STEP 6: Verify in Supabase

Check that your borrower made it to the cloud:

```sql
-- In Supabase SQL editor:
SELECT id, full_name, collector_id, created_by, created_at, updated_at 
FROM borrowers 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## Troubleshooting

### Still getting "invalid input syntax for type bigint"?
1. Check your SCHEMA_COLUMN_TYPES - is that column mapped correctly?
2. Run diagnostic again to verify actual column type
3. Common mistake: `created_at: 'timestamp'` when it should be `'bigint'`

### Still getting "foreign key constraint" errors?
1. Run `findOrphanRecords()` - shows which records are problematic
2. Check if records have `created_by` and `collector_id` set
3. Use the SQL fix scripts above to clean up

### Records still not syncing?
1. Check console: "FKs validation failed" = record is being filtered
2. Reason: Missing required foreign key
3. Fix: Ensure all records have proper `created_by` and `collector_id`

---

## What Changed in SyncService.ts

### New Constants
- `SCHEMA_COLUMN_TYPES` - Maps each table/column to its type (timestamp or bigint)
- `FOREIGN_KEY_REQUIREMENTS` - Defines required foreign keys per table

### New Methods
- `validateForeignKeys()` - Checks if all required FKs are present
- Enhanced `sanitizeRecord()` - Smart type conversion based on SCHEMA_COLUMN_TYPES

### Enhanced Methods
- `pushChangesToSupabase()` - Now filters and logs invalid records instead of crashing

---

## Files Involved

### Modified
- `/src/services/SyncService.ts` - Core sync logic with type-aware conversion and FK validation

### New
- `/src/utils/checkSupabaseSchema.ts` - Diagnostic tools to inspect your schema
- `/SYNC_ERROR_ANALYSIS.md` - Detailed analysis of the 3 errors and solutions

---

## Quick Checklist

- [ ] Run `checkSupabaseSchema()` and note actual column types
- [ ] Run SQL query to verify column types match findings
- [ ] Update SCHEMA_COLUMN_TYPES in SyncService.ts
- [ ] Run `findOrphanRecords()` and fix any orphans
- [ ] Test: Create borrower offline → Go online → Sync → Verify in Supabase
- [ ] Check sync log for success (no bigint or FK errors)

---

## Success Indicators

When it's working correctly, you'll see:

```
✓ Sync completed successfully (X pulled)
✓ Successfully upserted 1 records to borrowers
✓ Successfully upserted 1 records to loans
✓ No console errors about type conversion
✓ New borrower visible in Supabase
✓ Borrower appears in app after refresh
```

---

## Need Help?

If you're still stuck:
1. Check the console output from diagnostic functions
2. Look at SYNC_ERROR_ANALYSIS.md for detailed explanations
3. Verify your SCHEMA_COLUMN_TYPES matches your actual database schema
4. Make sure all records have required foreign keys set

The core fix is done. You just need to configure it for your specific database schema!
