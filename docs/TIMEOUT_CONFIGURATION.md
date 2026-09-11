# Quick Reference: Initialization Timeout Configuration

## Current Timeout Values

```typescript
// AuthContext.tsx - Session restoration
SESSION_TIMEOUT_MS = 8000;              // 8 seconds

// AuthContext.tsx - Role fetch
ROLE_FETCH_TIMEOUT_MS = 5000;          // 5 seconds

// loading.tsx - Complete sync operation
SYNC_TIMEOUT_MS = 30000;               // 30 seconds

// SyncService.ts - Per table sync
TABLE_TIMEOUT_MS = 5000;               // 5 seconds per table

// SyncService.ts - Overall sync operation
SYNC_TIMEOUT_MS = 30000;               // 30 seconds total
```

---

## What to Adjust If...

### 🐌 App still freezes on slow networks
- Increase `SESSION_TIMEOUT_MS` from 8000 to 12000
- Increase `SYNC_TIMEOUT_MS` from 30000 to 45000
- Increase `TABLE_TIMEOUT_MS` from 5000 to 8000

**Example:**
```typescript
// In AuthContext.tsx
const SESSION_TIMEOUT_MS = 12000; // 12 seconds instead of 8

// In loading.tsx
const SYNC_TIMEOUT_MS = 45000; // 45 seconds instead of 30
```

### ⚡ App takes too long on fast networks
- Decrease timeouts by 25%
- Session: 6000ms, Sync: 22500ms, Table: 3750ms

**Example:**
```typescript
const SESSION_TIMEOUT_MS = 6000;  // Faster timeout
const SYNC_TIMEOUT_MS = 22500;
const TABLE_TIMEOUT_MS = 3750;
```

### 😞 Auth always times out (Supabase very slow)
- Set `SESSION_TIMEOUT_MS` to huge value (60000+)
- OR check Supabase status: https://status.supabase.io
- OR check your network connectivity

### 📡 Sync never completes (too many records)
- Increase `SYNC_TIMEOUT_MS` to 60000 (60 seconds)
- Check Supabase query performance (too many rows?)
- Consider archiving old records

### 📊 Specific table always times out
1. Find which table times out in console logs
2. Increase that table's `TABLE_TIMEOUT_MS` only
3. Consider fetching that table in background after sync

---

## Console Indicators

### ✅ Healthy Startup
```
[AuthContext] 🔄 Starting authentication initialization...
[AuthContext] ✅ Session restored: user abc123
[AuthContext] ✅ User role loaded: collector
[Loading] ✅ Auth initialized with user, starting sync with timeout...
[SyncService] Starting sync cycle...
[SyncService] Pulled borrowers in 1234ms (45 rows)
[SyncService] Pulled loans in 567ms (12 rows)
[SyncService] Sync completed in 3450ms
[Loading] ✅ Redirecting to home: /(collector)
```

### ⏱️ Timeout During Auth
```
[AuthContext] 🔄 Starting authentication initialization...
[AuthContext] ❌ Auth initialization error: Session restore timed out after 8000ms
[AuthContext] ⏱️ Session restore timed out - proceeding to login
[AuthContext] 🔄 Auth fully initialized (no user)
[Loading] 👤 No authenticated user, skipping sync
[Loading] 🚪 No user - redirecting to login
```

### 🐌 Timeout During Sync
```
[SyncService] Starting sync cycle...
[SyncService] Pulled user_profiles in 1200ms (1 rows)
[SyncService] ⏱️ Table borrowers sync failed (Table borrowers fetch timed out) - skipping this table
[SyncService] Pulled loans in 800ms (5 rows)
... (other tables)
[SyncService] 📊 COMPLETE: pushed in 2300ms
[SyncService] Sync completed in 5000ms (partial: skipped borrowers)
[Loading] ✅ Redirecting to home (with partial data)
```

### 🔴 Fatal Error (Check Logs)
```
[AuthContext] ❌ Auth initialization error: Network error
[ErrorService] 🔴 AUTH ERROR: Network error
[Loading] 🚪 No user - redirecting to login
```

---

## Testing: How to Simulate Timeouts

### Chrome DevTools Network Throttling
1. Open DevTools (F12)
2. Go to **Network** tab
3. Click "No throttling" dropdown
4. Select "Slow 3G" or custom:
   - Download: 400 kbps
   - Upload: 400 kbps
   - Latency: 400ms
5. Reload app

### Intentional Supabase Breakage
```typescript
// In supabase.ts, temporarily make queries fail:
const supabase = createClient(url, key, {
    auth: {
        ...config,
        // Add this to test
        autoRefreshToken: false,
    }
});
```

### Intentional Database Breakage
```typescript
// In SyncService.ts, simulate slow fetch:
const tableData = await new Promise(resolve => {
    setTimeout(() => resolve({ created: [], updated: [], deleted: [] }), 6000);
});
```

---

## Performance Targets

| Network | Target Time | Session | Sync | Notes |
|---------|------------|---------|------|-------|
| Fiber (100+ Mbps) | 2-3s | <500ms | 1-2s | Instant |
| WiFi (25 Mbps) | 3-5s | 1-2s | 2-3s | Good |
| 4G LTE (10 Mbps) | 5-8s | 2-4s | 3-5s | OK |
| 3G (~1 Mbps) | 10-15s | 5-8s | 5-10s | Slow but acceptable |
| Offline | 1-2s | Cache | Cache | Cached data only |

---

## Quick Fixes (Copy-Paste)

### Fix 1: Session Timeout Too Short
**File:** `src/store/AuthContext.tsx`
```diff
- const SESSION_TIMEOUT_MS = 8000;
+ const SESSION_TIMEOUT_MS = 12000;
```

### Fix 2: Sync Timeout Too Short
**File:** `app/loading.tsx`
```diff
- const SYNC_TIMEOUT_MS = 30000;
+ const SYNC_TIMEOUT_MS = 45000;
```

### Fix 3: Allow Offline Mode Faster
**File:** `app/loading.tsx`
```typescript
// Change redirect delay
- const AUTO_REDIRECT_DELAY_MS = 1000;
+ const AUTO_REDIRECT_DELAY_MS = 500; // Faster redirect
```

### Fix 4: Show All Sync Details
**File:** `src/services/SyncService.ts`
```typescript
// Add detailed logging in console
console.time('SyncService.sync');
// ... sync code
console.timeEnd('SyncService.sync');
```

---

## Restart Required?

✅ **No reload needed** for these changes:
- Timeout value adjustments
- Console.log additions

❌ **Reload/restart needed** for these changes:
- Import statements (supabase.ts)
- Function signature changes
- State variable types (AuthContext.tsx)

---

## When to Contact Support

Reach out if:
1. App still freezes even after increasing timeouts to 30s+
2. Specific errors in console that aren't timeout-related
3. Supabase queries mysteriously failing
4. Network requests never completing (check Network tab)
5. IndexedDB quota errors on web

Provide:
1. Your timeout values
2. Full console output (copy from DevTools)
3. Network tab screenshot (DevTools > Network)
4. Which operation times out (auth? sync? specific table?)
