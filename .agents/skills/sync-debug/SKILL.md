---
name: sync-debug
description: SyncService architecture, debugging, and performance analysis for WatermelonDB ↔ Supabase sync
---

# Sync Debug Skill — POSCursor

## Architecture Overview

The sync engine lives in `src/services/SyncService.ts` (443 lines). It uses `@nozbe/watermelondb/sync`'s `synchronize()` function with a pull/push pattern to sync 18 local WatermelonDB tables with Supabase remote tables.

```
WatermelonDB (LokiJS/SQLite) ←→ SyncService ←→ Supabase (PostgreSQL)
                                     ↕
                              useSyncStore (Zustand)
```

## Table Mapping

The service maps 18 local WatermelonDB table names to remote Supabase table names:

| Local (WatermelonDB) | Remote (Supabase) |
|---------------------|-------------------|
| `user_profiles` | `user_profiles` |
| `borrowers` | `app_borrowers` |
| `loans` | `app_loans` |
| `payment_schedules` | `app_payment_schedules` |
| `payments` | `app_payments` |
| `expenses` | `app_expenses` |
| `cash_transactions` | `app_cash_transactions` |
| `bank_accounts` | `app_bank_accounts` |
| `bank_transactions` | `app_bank_transactions` |
| `collection_logs` | `app_collection_logs` |
| `financial_snapshots` | `app_financial_snapshots` |
| `remittances` | `app_remittances` |
| `savings_transactions` | `app_savings_transactions` |
| `expense_categories` | `app_expense_categories` |
| `collectors` | `app_collectors` |
| `loan_penalties` | `app_loan_penalties` |
| `collection_groups` | `collection_groups` |
| `action_logs` | `app_action_logs` |

## Sync Flow

### Pull
1. For each of 18 tables, fetch active records (`deleted_at IS NULL`) updated since `lastPulledAt`
2. Fetch deleted records (`deleted_at IS NOT NULL`) since `lastPulledAt`
3. Paginate with 1000-row pages via `.range()`
4. Convert 17 date fields from ISO strings → epoch milliseconds
5. Nullify invalid UUIDs on 9 FK fields
6. All tables fetched concurrently via `Promise.allSettled`

### Push
1. Merge `created` + `updated` records → upsert to Supabase
2. Soft-delete: set `deleted_at` timestamp on deleted records
3. Sanitize: strip `_status`/`_changed` WatermelonDB metadata, convert epoch ms → ISO strings
4. Process tables sequentially

## Date Fields (17 total)

```typescript
['created_at', 'updated_at', 'deleted_at', 'date_of_birth', 'release_date',
 'first_payment_date', 'maturity_date', 'due_date', 'payment_date',
 'penalty_date', 'expense_date', 'transaction_date', 'log_date',
 'snapshot_date', 'encoded_at', 'remittance_date', 'date', 'timestamp']
```

## UUID FK Fields (9 total)

```typescript
['collector_id', 'auth_id', 'created_by', 'encoded_by', 'borrower_id',
 'loan_id', 'schedule_id', 'previous_loan_id', 'bank_account_id']
```

Invalid UUIDs (not matching `^[0-9a-f]{8}-...`) are nullified on both pull and push to prevent FK constraint violations.

## State Management

`useSyncStore` (Zustand, in `src/stores/syncStore.ts`) tracks:
- `status`: `'idle' | 'syncing' | 'completed' | 'error'`
- `progress`: 0.0 → 1.0
- `currentModel`: Human-readable current step
- `pendingChanges`: Count of records with `_status` = created/updated/deleted
- `lastSyncAt`: Timestamp of last successful sync
- `errorMessage`: Last error description
- `logs[]`: Array of sync log entries

## Performance Tracking

Sync operations are wrapped in `perf.measure()` from `src/utils/PerformanceTracker.ts`:
- `'Sync.Pull'` — Total pull duration
- `'Sync.Push'` — Total push duration

## Dependency Injection

```typescript
constructor(
    private db = database,
    private supabase = globalSupabase
) {}
```

Static methods delegate to a singleton: `private static instance = new SyncService()`.

For testing, inject a test DB and mock Supabase client:
```typescript
const service = new SyncService(testDatabase, mockSupabase);
```

## Debugging Sync Issues

### 1. Check Pending Changes
```typescript
// In app or test:
const count = await SyncService.updatePendingCount();
console.log('Pending changes:', count);
```
This iterates all 18 tables and counts records with `_status` = `created`, `updated`, or `deleted`.

### 2. Force Sync
```typescript
await SyncService.sync(true); // force=true bypasses the isSyncing guard
```

### 3. Read Sync Logs
Access via `useSyncStore.getState().logs` — each entry has:
- `timestamp`, `type` ('info'|'table'|'success'|'error'), `message`, `detail`, `duration`, `rowCount`

### 4. Common Sync Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| Sync returns 0 rows | Wrong Supabase URL | Check `.env` matches project with data |
| "Invalid Refresh Token" | Stale session token | Clear localStorage (web) or AsyncStorage (native) |
| FK constraint error on push | Invalid UUID in FK field | UUID sanitization should catch this; check for new FK fields not in the list |
| Sync hangs indefinitely | `isSyncing` lock not released | Force sync with `sync(true)` |
| "Failed active records fetch" | RLS blocking reads | Ensure user has authenticated session; check RLS policies |
| Partial sync (some tables fail) | `Promise.allSettled` continues on per-table errors | Check console warnings for specific table failures |

### 5. SQL Queries for Debugging (via supabase-mcp-server)

```sql
-- Check record counts per table
SELECT 'app_borrowers' as tbl, count(*) FROM app_borrowers
UNION ALL SELECT 'app_loans', count(*) FROM app_loans
UNION ALL SELECT 'app_payments', count(*) FROM app_payments;

-- Check for recently updated records
SELECT id, updated_at FROM app_loans ORDER BY updated_at DESC LIMIT 10;

-- Check soft-deleted records
SELECT id, deleted_at FROM app_borrowers WHERE deleted_at IS NOT NULL;
```

## Test Files

- `src/services/__tests__/SyncService.test.ts` — Unit tests (mock supabase)
- `src/services/__tests__/SyncService.integration.test.ts` — Integration tests
- `src/services/__tests__/performance.test.ts` — Performance benchmarks
