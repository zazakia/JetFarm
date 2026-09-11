# Sync Error Analysis & Solutions

## Summary of Issues (Message 11)

Your sync is failing with 4 distinct errors:

```
1. [SyncService] Failed to push upserts for borrowers: 
   insert or update on table "borrowers" violates foreign key constraint "borrowers_created_by_fkey"

2. [SyncService] Failed to push upserts for loans: 
   invalid input syntax for type bigint: "2026-09-05T05:08:47.948Z"

3. [SyncService] Failed to push upserts for payment_schedules: 
   invalid input syntax for type bigint: "2026-09-05T05:08:47.948Z"
```

---

## Root Causes Analysis

### Issue #1: Foreign Key Constraint Violation
**Error**: `borrowers_created_by_fkey`  
**Cause**: The `created_by` field is being saved as `null` or with an invalid user ID when creating borrowers  
**Why it happens**: When you create a borrower locally, WatermelonDB doesn't automatically set `created_by` to the current user

**Example**:
```typescript
// WRONG: This creates a borrower with null created_by
const borrower = {
  id: uuid(),
  name: 'John Doe',
  collector_id: collectorId,
  // created_by is missing! → NULL in database → FK violation
};
```

### Issue #2 & #3: Invalid Input Syntax for Type BIGINT
**Error**: `invalid input syntax for type bigint: "2026-09-05T05:08:47.948Z"`  
**Cause**: Your Supabase schema has certain columns defined as `BIGINT` (numeric), but my code was converting them to ISO 8601 string format  
**Why it happened**: The previous SyncService blindly converted ALL date-like fields to ISO strings

**Column Type Mismatch**:
```sql
-- Your schema probably has some columns like this:
loans.created_at BIGINT  -- Expects milliseconds, got "2026-09-05T05:08:47.948Z" ✗
payments.created_at BIGINT  -- Expects milliseconds, got ISO string ✗

-- While others are like this:
borrowers.created_at TIMESTAMP  -- Expects ISO string, got milliseconds ✗
```

---

## Solutions Implemented

### Solution #1: Foreign Key Validation & Filtering
**What was fixed**: Updated `pushChangesToSupabase()` to:

1. **Validate before pushing**: Check that all required foreign keys are present
2. **Filter invalid records**: Skip records with missing FKs instead of crashing
3. **Better logging**: Shows exactly which records failed and why

```typescript
// NEW: Validates before pushing
const fkValidation = this.validateForeignKeys(sanitized, tableName);
if (fkValidation.isValid) {
    validRecords.push(sanitized);
} else {
    invalidRecords.push({
        id: record.id,
        errors: fkValidation.errors,
    });
}
```

**Impact**: Records with missing FKs are now skipped (not lost), and you see clear error messages

### Solution #2: Schema-Aware Column Type Handling
**What was fixed**: Created `SCHEMA_COLUMN_TYPES` mapping for each table

```typescript
const SCHEMA_COLUMN_TYPES: Record<string, Record<string, 'timestamp' | 'bigint'>> = {
    loans: {
        created_at: 'bigint',      // ← Stays as milliseconds
        release_date: 'timestamp',  // ← Converts to ISO string
    },
    payments: {
        payment_date: 'timestamp',  // ← Convert to ISO
    },
};
```

Now the code **only converts TIMESTAMP columns to ISO strings** and leaves **BIGINT columns as milliseconds**.

---

## Next Steps to Complete the Fix

### Step 1: Identify Your Actual Schema Types
Run this diagnostic to see what types your columns actually are:

```typescript
// In your admin or debug screen:
import { checkSupabaseSchema, inspectSampleRecords } from '../utils/checkSupabaseSchema';

checkSupabaseSchema();    // Shows all column types
inspectSampleRecords();   // Shows actual data types
findOrphanRecords();      // Shows records violating FK constraints
```

**Look for this output**:
```
### LOANS ###
  id: uuid
  created_at: bigint          ← If you see "bigint", add to SCHEMA_COLUMN_TYPES
  release_date: timestamp     ← If you see "timestamp", already handling correctly
  payment_date: bigint        ← Add to SCHEMA_COLUMN_TYPES
```

### Step 2: Update SCHEMA_COLUMN_TYPES Based on Findings

Once you know your actual schema, update `/src/services/SyncService.ts`:

```typescript
const SCHEMA_COLUMN_TYPES: Record<string, Record<string, 'timestamp' | 'bigint'>> = {
    loans: {
        created_at: 'bigint',        // Based on diagnostic findings
        updated_at: 'bigint',
        release_date: 'timestamp',
        payment_date: 'bigint',      // Add any BIGINT columns here
    },
    payments: {
        created_at: 'bigint',        // Adjust based on your schema
        payment_date: 'timestamp',
    },
};
```

### Step 3: Fix Record Creation to Include Required Foreign Keys

In your `BorrowerFormWithCollector.tsx` and anywhere you create records:

```typescript
// BEFORE (buggy):
const borrower = {
    id: generateUUID(),
    name: formData.name,
    collector_id: selectedCollector.id,
    // Missing: created_by!
};

// AFTER (fixed):
const borrower = {
    id: generateUUID(),
    name: formData.name,
    collector_id: selectedCollector.id,
    created_by: useAuthStore.getState().user?.id,  // ← ADD THIS
    created_at: Date.now(),
    updated_at: Date.now(),
};
```

### Step 4: Check for Orphan Records

Run this to find records that are causing FK violations:

```typescript
import { findOrphanRecords } from '../utils/checkSupabaseSchema';
await findOrphanRecords();

// Output example:
// Found 2 borrowers with missing foreign keys:
//   ID: borr-123, collector_id: null, created_by: null
//   ID: borr-456, collector_id: valid-id, created_by: null
```

**Fix orphan records manually**:
```typescript
// In Supabase SQL editor:
UPDATE borrowers SET created_by = collector_id WHERE created_by IS NULL;
UPDATE borrowers SET collector_id = (SELECT id FROM user_profiles LIMIT 1) WHERE collector_id IS NULL;
```

---

## Testing the Fix

### 1. Verify Schema Mapping
```bash
# Run diagnostic
checkSupabaseSchema()
inspectSampleRecords()

# Check console output - verify BIGINT vs TIMESTAMP
```

### 2. Create New Record Offline
- Open app in airplane mode
- Go to Borrower form
- Create a new borrower
- Fields should populate correctly

### 3. Go Online & Sync
- Open Wi-Fi/LTE
- Manually trigger sync
- **Expected**: No "invalid input syntax for type bigint" errors
- **Expected**: No "foreign key constraint" errors
- **Expected**: Record appears in Supabase

### 4. Check Sync Log
```
✓ "Sync completed successfully (X pulled)"
✓ "Pushed X local changes"
✓ No console errors
```

---

## What Changed in SyncService.ts

### New Methods Added
1. **`validateForeignKeys()`**: Checks if required FKs are present
2. **Improved `sanitizeRecord()`**: 
   - Uses SCHEMA_COLUMN_TYPES mapping
   - Only converts TIMESTAMP columns to ISO
   - Keeps BIGINT columns as milliseconds
   - Better error messages

### Improved Methods
1. **`pushChangesToSupabase()`**:
   - Validates all records before pushing
   - Filters out invalid records (instead of failing completely)
   - Logs exactly which records failed and why
   - Shows validation errors: "ID: X - Missing required foreign key: created_by"

---

## Configuration Reference

### FOREIGN_KEY_REQUIREMENTS
Defines which fields are required (must not be null) per table:

```typescript
const FOREIGN_KEY_REQUIREMENTS: Record<string, string[]> = {
    borrowers: ['collector_id', 'created_by'],  // Both required
    loans: ['borrower_id', 'collector_id'],      // Both required
    payments: ['loan_id', 'borrower_id', 'collector_id'],  // All required
};
```

If a record is missing any of these, it will be **skipped** with a warning message.

### SCHEMA_COLUMN_TYPES
Maps column names to their types for proper conversion:

```typescript
const SCHEMA_COLUMN_TYPES: Record<string, Record<string, 'timestamp' | 'bigint'>> = {
    loans: {
        created_at: 'bigint',        // Stays as milliseconds
        release_date: 'timestamp',   // Converts to ISO string
    },
};
```

**How it works**:
- If column is `timestamp`: Convert milliseconds → ISO 8601
- If column is `bigint`: Keep as milliseconds (don't convert)
- If not listed: Auto-detect based on field name

---

## Troubleshooting

### Still getting "invalid input syntax for type bigint"?
1. Run `inspectSampleRecords()` to see actual value types
2. Check your SCHEMA_COLUMN_TYPES mapping
3. Verify the column definition in Supabase SQL editor:
   ```sql
   SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name = 'loans' AND column_name LIKE '%_at';
   ```

### Still getting foreign key violations?
1. Run `findOrphanRecords()` to identify problem records
2. Check which FKs are missing
3. Fix with diagnostic cleanup script or manually in Supabase

### Records not syncing at all?
1. Check console logs - look for "FKs validation failed"
2. See which fields are `null` that shouldn't be
3. Update code creating records to include all required fields

---

## Files Modified
- `/src/services/SyncService.ts` - Enhanced with schema mapping, FK validation, and smart type conversion
- `/src/utils/checkSupabaseSchema.ts` - NEW - Diagnostic tools to inspect schema and find orphan records

## Next Action
1. Run the diagnostic tools to find your actual schema
2. Update SCHEMA_COLUMN_TYPES based on findings
3. Ensure all record creation includes required foreign keys
4. Test sync again

