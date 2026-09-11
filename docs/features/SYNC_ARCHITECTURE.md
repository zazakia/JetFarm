# Resilient Sync Architecture

The POSCursor app uses a custom synchronization layer to bridge the local WatermelonDB (Offline-First) with Supabase (Cloud PostgreSQL Database).

## Key Components

| Component | Role |
|---|---|
| **WatermelonDB (Local)** | Primary data store. All UI interactions read/write to local models first. |
| **Supabase (Remote)** | Cloud backup and cross-device sync provider (PostgreSQL). |
| **SyncService.ts** | Logic engine orchestrating bidirectional data flow. |
| **syncStore (Zustand)** | Global state tracking sync status, progress, and logs. |
| **LoadingScreen** | Entry point that triggers the initial sync after auth is confirmed. |

---

## Full Sync Data Flow

```
User Action (Create/Update/Delete)
        │
        ▼
  WatermelonDB Local DB  ──────────── marks record as _status: 'created'/'updated'/'deleted'
        │
        ▼
  SyncService.sync()
   ├── PULL PHASE ──► Supabase: SELECT * WHERE updated_at > lastSyncDate
   │                       │
   │                       ▼
   │               Merge into local WatermelonDB
   │
   └── PUSH PHASE ──► Collect local dirty records (_status != 'synced')
                       ├── created + updated ──► Supabase: UPSERT
                       └── deleted          ──► Supabase: UPSERT with deleted_at timestamp
```

---

## Push Phase — What Gets Sent to Remote DB

When a sync runs, the push phase sends **all locally modified data** up to Supabase:

### New Records
- Any record created locally while offline (e.g., new borrower, new payment) is sent as an `upsert`. Since its ID won't exist in Supabase, it is **inserted** as a brand new row.

### Updated Records  
- Any record modified locally (e.g., editing borrower details, updating loan status) is sent as an `upsert`. Since its ID already exists in Supabase, the existing row is **updated** with the new values.

### Deleted Records (Soft Delete)
- No records are hard-deleted from Supabase. Instead, a `deleted_at` timestamp is written to the record. The remote record remains in the table but is excluded from future pull queries.

### Record Sanitization
Before pushing, all records are passed through `sanitizeRecord()` which:
1. Strips WatermelonDB internal fields (`_status`, `_changed`)
2. Converts numeric timestamps (milliseconds) back to ISO-8601 date strings
3. Always stamps a fresh `updated_at` on every pushed record

---

## Pull Phase — What's Received From Remote DB

The pull phase fetches **incremental changes** from Supabase:

- On **first sync** (`lastPulledAt = null`): fetches **all records** from every table.
- On **subsequent syncs**: fetches only records where `updated_at >= lastSyncDate` (delta sync).
- Deleted records are fetched separately: records where `deleted_at IS NOT NULL AND deleted_at >= lastSyncDate`.
- All date/timestamp fields in pulled records are converted from ISO strings to millisecond timestamps for WatermelonDB compatibility.

---

## Tables Synced (18 Total)

| Local Table | Remote Table (Supabase) |
|---|---|
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

---

## Loading Screen Sync Lifecycle (Fixed: April 2026)

The app's startup sequence follows this flow:

```
index.tsx → /loading → AuthContext.checkSession()
                │
                ├── user found?  YES → SyncService.checkAndSync() → redirect to role home
                │
                └── user found?  NO  → redirect to /login (500ms delay)
```

**Bug Fixed**: Previously, when no user was logged in, sync was skipped but the loading screen never redirected (waiting for a `completed`/`error` status that never came). Fixed by adding an immediate redirect for the unauthenticated case plus a 15s safety timeout for logged-in edge cases.

---

## Design Decisions

### 1. Table Prefixing (`app_`)
All app-specific Supabase tables use the `app_` prefix to distinguish them from system tables. The `REMOTE_TABLE_MAP` in `SyncService.ts` handles this translation automatically.

### 2. UUID Strictness & Hardening
Supabase enforces strict `UUID` types. The `sanitizeRecord()` function validates UUID columns and nullifies invalid formats to prevent 400 Bad Request errors.

### 3. Incremental (Delta) Sync
Only records changed since `lastPulledAt` are fetched, keeping sync fast even for large datasets. First sync fetches everything; subsequent syncs are incremental.

### 4. Parallel Pulls, Sequential Pushes
All 18 tables are pulled simultaneously using `Promise.allSettled()` — meaning a failure in one table does not block others. Pushes are sequential per-table to maintain consistent ordering.

### 5. Pagination
Each table fetch uses 1000-row pages to handle large datasets without hitting Supabase response size limits.

---

## Sync Center UI

Accessible via the sidebar → **Sync Center** (or directly via `/sync-center`). Provides:
- Real-time sync status (Online/Offline badge)
- Progress bar during active sync
- Last sync timestamp
- Per-table log entries (rows pulled/pushed + duration)
- Manual "Sync Now" button to force a sync cycle

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Loading screen stuck at "Initializing..." | No active session detected | Fixed — now redirects to login immediately |
| Sync skipped on startup | No Supabase session | Log in first, then sync runs automatically |
| 401 Unauthorized during sync | Session expired | Sign out and sign in again |
| 400 Bad Request on push | Invalid date fields (epoch 0) or bad UUID | Check `sanitizeRecord()` output in console |
| Table not syncing | Missing from `SYNC_TABLES` or `REMOTE_TABLE_MAP` | Add table to both arrays in `SyncService.ts` |
| Data not appearing after sync | Schema mismatch between local and Supabase | Run `NOTIFY pgrst, 'reload schema';` in Supabase SQL editor |

