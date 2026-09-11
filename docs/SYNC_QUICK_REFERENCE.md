# Quick Reference - Sync Issue Fix

## Your Errors (What You Saw)
```
❌ foreign key constraint "borrowers_created_by_fkey"
❌ invalid input syntax for type bigint: "2026-09-05T05:08:47.948Z"
❌ invalid input syntax for type bigint (payment_schedules)
```

## Root Causes
1. **Foreign Key**: Records missing `created_by` field when syncing
2. **BIGINT Type**: ISO strings being sent to columns expecting milliseconds
3. **Type Mismatch**: No distinction between BIGINT and TIMESTAMP columns

## What I Fixed

### In `/src/services/SyncService.ts`:
- ✅ Added `SCHEMA_COLUMN_TYPES` mapping (know each column's type)
- ✅ Added `FOREIGN_KEY_REQUIREMENTS` (know required fields)
- ✅ Added `validateForeignKeys()` method (filter bad records)
- ✅ Enhanced `sanitizeRecord()` (smart type conversion)
- ✅ Enhanced `pushChangesToSupabase()` (filter+log invalid records)

### New File `/src/utils/checkSupabaseSchema.ts`:
- ✅ Diagnostic tools to find your actual schema
- ✅ Find orphan records with missing FKs
- ✅ Inspect sample data types

### New Docs:
- ✅ `SYNC_ERROR_ANALYSIS.md` (detailed explanation)
- ✅ `SYNC_FIX_ACTION_GUIDE.md` (step-by-step fix)

---

## What You Need to Do (3 Simple Steps)

### Step 1️⃣: Diagnose Your Schema (5 min)
```typescript
import { checkSupabaseSchema, findOrphanRecords } from './src/utils/checkSupabaseSchema';

await checkSupabaseSchema();   // See what types each column has
await findOrphanRecords();     // See if there are broken records
```

### Step 2️⃣: Update SyncService Config (2 min)
Found `loans.created_at` is BIGINT but your config says TIMESTAMP?  
Edit `/src/services/SyncService.ts` - Update the `SCHEMA_COLUMN_TYPES`:

```typescript
const SCHEMA_COLUMN_TYPES = {
    loans: {
        created_at: 'bigint',      // ← Change based on what you found
        release_date: 'timestamp',  // ← Keep these if correct
    },
};
```

### Step 3️⃣: Test Sync (5 min)
1. Offline: Create borrower
2. Online: Trigger sync
3. Verify: No errors, borrower in Supabase

---

## The Fix In Action

### Before (Broken) 👎
```
WatermelonDB milliseconds: 1774011132039
↓ (old code)
Sent to Supabase as ISO string: "2026-09-05T05:08:47.948Z"
↓
BIGINT column expects number
↓ ❌ "invalid input syntax for type bigint"
```

### After (Fixed) ✅
```
WatermelonDB milliseconds: 1774011132039
↓ (smart conversion)
Goes to TIMESTAMP column? → "2026-09-05T05:08:47.948Z" ✓
Goes to BIGINT column? → 1774011132039 ✓
↓ ✅ Sync successful
```

---

## Console Output Examples

### ✅ What You Want to See
```
[SyncService] Successfully upserted 1 records to borrowers
[SyncService] Successfully upserted 1 records to loans
Sync completed successfully
```

### ❌ What You Will See If Schema Mapping is Wrong
```
[SyncService] Failed to push upserts for loans: 
invalid input syntax for type bigint: "2026-09-05T05:08:47.948Z"
```
→ **Fix**: Check your SCHEMA_COLUMN_TYPES mapping

### ⚠️ What You Will See If Records Have Missing FKs
```
[SyncService] Skipping 1 invalid records for borrowers:
ID: borr-123 - Missing required foreign key: created_by
```
→ **Fix**: Records will be skipped until you set `created_by` correctly

---

## Database Verification

Quick SQL query to check what you have:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'loans' 
AND column_name IN ('created_at', 'release_date', 'payment_date')
ORDER BY column_name;
```

Expected output (or similar):
```
Column Name       Type
created_at        bigint     ← Maps to 'bigint' in code
payment_date      timestamp  ← Maps to 'timestamp' in code
release_date      timestamp  ← Maps to 'timestamp' in code
```

---

## Files You Edited
```
✅ /src/services/SyncService.ts (enhanced with schema mapping + FK validation)
✅ /src/utils/checkSupabaseSchema.ts (NEW - diagnostic tools)
✅ /SYNC_ERROR_ANALYSIS.md (NEW - detailed analysis)
✅ /SYNC_FIX_ACTION_GUIDE.md (NEW - step-by-step guide)
```

---

## Key Concepts

| Term | Explanation |
|------|-------------|
| **TIMESTAMP** | PostgreSQL date column - expects ISO string format like "2026-03-20T12:34:56Z" |
| **BIGINT** | PostgreSQL number column - expects milliseconds like 1774011132039 |
| **WatermelonDB** | Stores all dates as milliseconds (numbers) |
| **Supabase** | Depends on column type - TIMESTAMP wants strings, BIGINT wants numbers |
| **Sync** | Push local changes to Supabase, Pull remote changes locally |
| **Foreign Key** | Reference to another record (e.g., `borrower_id` points to a borrower record) |

---

## Success Criteria ✅

When sync is working:
- [ ] No "invalid input syntax for type bigint" errors
- [ ] No "foreign key constraint" errors
- [ ] Sync log shows "Sync completed successfully"
- [ ] New records appear in Supabase
- [ ] New records appear in app after refresh

---

## Next: Run Diagnostic

Open your Expo app and copy this to your admin/debug screen:

```typescript
import { checkSupabaseSchema, inspectSampleRecords, findOrphanRecords } from './src/utils/checkSupabaseSchema';

// Press a button to run this:
const handleRunDiagnostic = async () => {
  console.log('Running diagnostics...');
  await checkSupabaseSchema();
  await inspectSampleRecords();
  await findOrphanRecords();
  console.log('Diagnostics complete - check console');
};
```

Then check the console output and update your SCHEMA_COLUMN_TYPES accordingly!
