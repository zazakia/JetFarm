# Offline-First Borrower Management System

## Overview

This document describes the complete implementation of an offline-first borrower management and payment system for the POSCursor React Native (Expo) application using WatermelonDB (local SQLite) and Supabase (remote PostgreSQL).

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                          UI Layer                            │
│  (React Components using custom hooks)                       │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────▼──────────┐
        │  Custom Hooks      │
        │ - useBorrowers     │
        │ - useCollectors    │
        │ - useSync          │
        └──────────┬─────────┘
                  │
        ┌─────────▼──────────────┐
        │  Offline Utils         │
        │ (CRUD operations)      │
        └──────────┬─────────────┘
                  │
    ┌─────────────┴───────────────┐
    │                              │
┌───▼─────────────┐      ┌────────▼──────────┐
│  WatermelonDB   │      │   SyncService     │
│  (SQLite)       │      │   (Orchestrator)  │
│  LOCAL          │      │                   │
│  CACHE          │────┬─┤  - Pull changes   │
│                 │    │ │  - Push changes   │
│                 │    │ │  - Conflict res.  │
└─────────────────┘    │ └───────┬──────────┘
                       │         │
                       │      ┌──▼──────┐
                       └─────►│ Supabase│
                              │ (RLS)   │
                              └─────────┘
```

### Key Components

1. **Models** (`src/database/models/`)
   - Borrower (has `collector_id` for assignment)
   - Loan (has `collector_id` for tracking)
   - Payment (has `collector_id` for collection tracking)
   - UserProfile (stores collectors with role='collector')

2. **Services** (`src/services/`)
   - **SyncService**: Orchestrates bi-directional sync with collector filtering
   - Handles pull (Supabase → WatermelonDB)
   - Handles push (WatermelonDB → Supabase)
   - Applies collector-specific filtering to relevant tables

3. **Custom Hooks** (`src/hooks/`)
   - **useBorrowers()**: Fetches borrowers for current collector
   - **useCollectors()**: Fetches all collectors for selection
   - **useSync()**: Manages sync operations and state

4. **Utilities** (`src/utils/`)
   - **offlineUtils.ts**: Offline-first CRUD operations
   - UUID generation for new records
   - Sync status verification

---

## Collector-Based Data Isolation

### Data Filtering Strategy

Each collector only syncs and accesses their own data:

#### On Pull (from Supabase):
```typescript
// SyncService applies collector filtering
if (COLLECTOR_SPECIFIC_TABLES.includes(tableName)) {
    const collectorId = getCurrentCollectorId();
    activeQuery = activeQuery.eq('collector_id', collectorId);
}
```

#### On Push (to Supabase):
- Only records with matching `collector_id` from local DB are pushed
- Enforced by WatermelonDB sync mechanism

#### Supabase RLS Policies:
- Should restrict `borrowers`, `loans`, `payments` by `collector_id`
- Example:
```sql
CREATE POLICY "Collectors see only their borrowers"
ON borrowers FOR SELECT
USING (auth.uid() = collector_id);
```

---

## Usage Guide

### 1. Creating a Borrower

```typescript
import { createBorrowerOffline } from '../utils/offlineUtils';
import { useAuthStore } from '../stores/authStore';

export function BorrowerForm() {
    const { user } = useAuthStore();

    const handleCreateBorrower = async (formData) => {
        // All writes happen to WatermelonDB first
        const borrower = await createBorrowerOffline({
            fullName: formData.name,
            phone: formData.phone,
            address: formData.address,
            collectorId: user.id,  // Current collector
            gender: formData.gender,
            area: formData.area,
        });

        // Record is automatically marked for sync
        // No direct Supabase writes from UI
    };
}
```

### 2. Displaying Assigned Borrowers

```typescript
import { useBorrowers } from '../hooks/useBorrowers';

export function BorrowerList() {
    const { borrowers, loading, error } = useBorrowers();

    // Automatically filters by current collector
    // Updates when sync completes
    return (
        <FlatList
            data={borrowers}
            renderItem={({ item }) => (
                <Text>{item.fullName}</Text>
            )}
        />
    );
}
```

### 3. Assigning a Collector to a Borrower

```typescript
import { CollectorSelector } from '../components/CollectorSelector';
import { assignCollectorToBorrower } from '../utils/offlineUtils';

export function EditBorrowerForm({ borrowerId }) {
    const [showCollectorSelector, setShowCollectorSelector] = useState(false);

    const handleSelectCollector = async (collectorId, collectorName) => {
        // Update borrower with collector assignment
        await assignCollectorToBorrower(borrowerId, collectorId);
        setShowCollectorSelector(false);
    };

    return (
        <>
            <Pressable onPress={() => setShowCollectorSelector(true)}>
                <Text>Select Collector</Text>
            </Pressable>

            <CollectorSelector
                visible={showCollectorSelector}
                onSelect={handleSelectCollector}
                onClose={() => setShowCollectorSelector(false)}
            />
        </>
    );
}
```

### 4. Recording Payments Offline

```typescript
import { createPaymentOffline } from '../utils/offlineUtils';
import { useAuthStore } from '../stores/authStore';

export function PaymentForm({ loanId }) {
    const { user } = useAuthStore();

    const handleRecordPayment = async (amount) => {
        // Payment recorded locally
        await createPaymentOffline({
            loanId,
            collectorId: user.id,
            amount,
            paymentDate: Date.now(),
            notes: 'Payment recorded offline',
        });

        // Will be synced when online
    };
}
```

### 5. Triggering Sync Manually

```typescript
import { useSync } from '../hooks/useSync';

export function SyncButton() {
    const { sync, isSyncing, isOnline, syncProgress, pendingChanges } = useSync();

    return (
        <>
            <Pressable
                onPress={() => sync(false)}
                disabled={isSyncing || !isOnline}
            >
                <Text>
                    Sync ({pendingChanges} pending){isSyncing && ' - Syncing...'}
                </Text>
            </Pressable>

            {syncProgress.errorMessage && (
                <Text className="text-red-500">{syncProgress.errorMessage}</Text>
            )}
        </>
    );
}
```

### 6. Verifying Data Consistency

```typescript
import { useSync } from '../hooks/useSync';

export function Dashboard() {
    const { sync, verifyBorrowerAssignments } = useSync();
    const { user } = useAuthStore();

    useEffect(() => {
        const verify = async () => {
            const hasData = await verifyBorrowerAssignments(user.id);
            if (!hasData) {
                // Data missing, trigger sync
                await sync(true);
            }
        };

        verify();
    }, []);
}
```

---

## Offline-First Behavior

### Record Creation
1. User creates a borrower/payment in UI
2. **Immediately written to WatermelonDB** (local SQLite)
3. Record marked with `_status: 'created'`
4. UI updated instantly (no network delay)
5. SyncService picks up on next sync cycle

### Record Updates
1. User edits borrower details
2. **Immediately updated in WatermelonDB**
3. Record marked with `_status: 'updated'`
4. `updated_at` timestamp set to current time
5. SyncService syncs after successful push

### Network-Aware Behavior
```typescript
// useNetworkStatus hook monitors connectivity
useEffect(() => {
    NetInfo.addEventListener((state) => {
        const connected = state.isConnected ?? true;
        setOnline(connected);

        // Auto-sync when reconnected
        if (connected && wasOffline) {
            SyncService.checkAndSync({ force: true });
        }
    });
}, []);
```

### Sync Metadata
Each record tracks:
- `_status`: 'created', 'updated', 'deleted', or synced
- `created_at`: Milliseconds timestamp
- `updated_at`: Last modification time (milliseconds)

---

## Collector Selection Modal

The `CollectorSelector` component provides:
- **Search**: By name or email
- **Local Caching**: Uses WatermelonDB's user_profiles table
- **Visual Feedback**: Highlights selected collector
- **Sorting**: Alphabetical by name
- **Status Info**: Shows collector count

### Integration Example

```typescript
<CollectorSelector
    visible={showModal}
    selectedCollectorId={selectedId}
    onSelect={(id, name) => {
        // Update borrower with collector ID
        updateBorrowerOffline(borrowerId, { collectorId: id });
        showCollectorModal(false);
    }}
    onClose={() => showCollectorModal(false)}
/>
```

---

## Sync Service Enhancements

### Collector-Specific Filtering

Tables filtered by `collector_id`:
- `borrowers`
- `loans`
- `payments`
- `collection_logs`

Tables synced globally:
- `user_profiles` (all collectors)
- `expenses` (shared access)
- `bank_accounts`, `bank_transactions`, etc.

### Key Methods

```typescript
// Get current collector ID
getCurrentCollectorId(): string | null

// Verify collector has borrowers in local DB
verifyCollectorBorrowers(collectorId?: string): Promise<boolean>

// Get count of assigned borrowers
getAssignedBorrowerCount(): Promise<number>

// Trigger sync (auto-detects online status)
checkAndSync(options?: { force?: boolean }): Promise<void>

// Get pending changes count
updatePendingCount(): Promise<number>
```

---

## Custom Hooks Reference

### useBorrowers()
```typescript
const { borrowers, loading, error, refetch } = useBorrowers({
    collectorId: 'optional-override',
    sortBy: 'name' | 'date' | 'area'
});
```

### useCollectors()
```typescript
const { collectors, loading, error, refetch } = useCollectors();
// Returns: [{ id, name, email }, ...]
```

### useSync()
```typescript
const {
    sync,           // Trigger manual sync
    isSyncing,      // Is sync in progress
    isOnline,       // Network status
    syncProgress,   // { status, progress, currentModel, error }
    pendingChanges, // Count of unsynced records
    lastSyncAt,     // Timestamp of last successful sync
    getPendingCount,
    verifyBorrowerAssignments
} = useSync();
```

---

## Offline Utils Reference

### createBorrowerOffline()
```typescript
const borrower = await createBorrowerOffline({
    fullName: string,
    phone: string,
    address: string,
    collectorId: string,
    gender?: string,
    area?: string,
    dateOfBirth?: number,
    notes?: string,
    createdBy?: string,
    latitude?: number,
    longitude?: number,
});
```

### updateBorrowerOffline()
```typescript
const updated = await updateBorrowerOffline(borrowerId, {
    fullName?: string,
    collectorId?: string,
    // ... other fields
});
```

### createPaymentOffline()
```typescript
const payment = await createPaymentOffline({
    loanId: string,
    collectorId: string,
    amount: number,
    scheduleId?: string,
    paymentDate?: number,
    receiptNumber?: string,
    notes?: string,
});
```

### getBorrowersByCollector()
```typescript
const borrowers = await getBorrowersByCollector(collectorId);
```

### verifyOfflineData()
```typescript
const { isValid, borrowerCount, hasData } = await verifyOfflineData(collectorId);
```

---

## Network Connectivity

### Detecting Network Status

```typescript
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSyncStore } from '../stores/syncStore';

export function NetworkIndicator() {
    useNetworkStatus();  // Start monitoring
    const { isOnline } = useSyncStore();

    return (
        <View className={isOnline ? 'bg-green' : 'bg-red'}>
            <Text>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
    );
}
```

### Auto-Sync Behavior

```typescript
// When network is restored:
// 1. isOnline flag is set to true in syncStore
// 2. SyncService.checkAndSync({ force: true }) is triggered
// 3. All pending changes are pushed to Supabase
// 4. Latest remote changes are pulled to local DB
// 5. UI automatically updates through subscribed hooks
```

---

## Database Schema

### Key Fields for Offline-First

#### Borrowers Table
```typescript
{
  id: string (UUID),           // Unique identifier
  full_name: string,
  phone: string (encrypted),
  address: string (encrypted),
  collector_id: string,        // Links to user (collector)
  created_at: number,          // Milliseconds timestamp
  updated_at: number,          // Last sync update
  // ... other fields
}
```

#### Payments Table
```typescript
{
  id: string (UUID),
  loan_id: string,
  collector_id: string,        // Who recorded payment
  amount: number,
  payment_date: number,        // When payment was made
  encoded_at: number,          // When recorded offline
  created_at: number,
  updated_at: number,
}
```

#### UserProfiles Table
```typescript
{
  id: string (UUID),
  full_name: string,
  email: string,
  role: string,                // 'collector', 'admin', etc.
  is_active: boolean,
  created_at: number,
  updated_at: number,
}
```

---

## Conflict Resolution

### Strategy

1. **Last-Write-Wins (LWW)**: Supabase receives updated records via upsert
2. **Deleted Records**: Soft-deletes maintain referential integrity
3. **Collector Filtering**: Prevents cross-collector data conflicts

### How It Works

```typescript
// SyncService.pushChangesToSupabase()
const toUpsert = [...created, ...updated].map(r => sanitizeRecord(r));

// Supabase upsert automatically:
// - Inserts new records (id not found)
// - Updates existing records (id found, overwrites)
await supabase.from(tableName).upsert(toUpsert);

// Deleted records marked with soft-delete
const deletePayload = deleted.map(id => ({
    id,
    deleted_at: new Date().toISOString(),
}));
```

---

## Testing

### Unit Test Example

```typescript
import { createBorrowerOffline, getBorrowersByCollector } from '../utils/offlineUtils';

describe('Offline Utils', () => {
    it('should create borrower offline', async () => {
        const borrower = await createBorrowerOffline({
            fullName: 'John Doe',
            phone: 'encrypted_phone',
            address: 'encrypted_address',
            collectorId: 'collector-123',
        });

        expect(borrower.id).toBeDefined();
        expect(borrower.collectorId).toBe('collector-123');
    });

    it('should filter borrowers by collector', async () => {
        const borrowers = await getBorrowersByCollector('collector-123');
        expect(borrowers.every(b => b.collectorId === 'collector-123')).toBe(true);
    });
});
```

### Integration Test Example

```typescript
describe('Offline-First Sync', () => {
    it('should record payment offline and sync when online', async () => {
        // 1. Go offline
        NetInfo.setIsConnected(false);

        // 2. Create payment offline
        const payment = await createPaymentOffline({
            loanId: 'loan-123',
            collectorId: 'collector-123',
            amount: 5000,
        });

        // 3. Verify it's marked for sync
        const status = await getRecordSyncStatus('payments', payment.id);
        expect(status.status).toBe('created');

        // 4. Go online
        NetInfo.setIsConnected(true);

        // 5. Sync automatically triggers
        await SyncService.checkAndSync({ force: true });

        // 6. Verify synced
        const syncedStatus = await getRecordSyncStatus('payments', payment.id);
        expect(syncedStatus.status).toBe('synced');
    });
});
```

---

## Debugging

### Enable Sync Logs

```typescript
import { useSyncStore } from '../stores/syncStore';

export function SyncDebugPanel() {
    const { logs } = useSyncStore();

    return (
        <ScrollView>
            {logs.map(log => (
                <View key={log.id} className="p-2 border-b border-gray-200">
                    <Text className={`text-${log.type === 'error' ? 'red' : 'gray'}-600`}>
                        [{log.type}] {log.message}
                    </Text>
                    {log.detail && <Text className="text-xs text-gray-500">{log.detail}</Text>}
                    {log.duration && <Text className="text-xs text-gray-500">{log.duration}ms</Text>}
                </View>
            ))}
        </ScrollView>
    );
}
```

### Monitor Pending Changes

```typescript
import { getPendingChangesCount } from '../utils/offlineUtils';

export async function debugSyncStatus() {
    const pending = await getPendingChangesCount();
    console.log('Pending changes:', pending);

    const verified = await verifyOfflineData(currentCollectorId);
    console.log('Data verification:', verified);
}
```

---

## Deployment Checklist

- [ ] Supabase RLS policies configured for collector filtering
- [ ] WatermelonDB schema properly versioned
- [ ] useNetworkStatus hook integrated into app root
- [ ] SyncService initialized on app startup
- [ ] Collector assignment modal integrated into borrower form
- [ ] Offline banner displayed when offline
- [ ] Sync status indicator visible in UI
- [ ] Push notifications set up for sync completion
- [ ] Backup/recovery procedures documented
- [ ] Error handling tested for network failures

---

## Common Issues & Solutions

### Issue: Borrowers not appearing after sync
**Solution**: Call `verifyOfflineData()` and manually trigger `SyncService.checkAndSync({ force: true })`

### Issue: Payment recorded twice
**Solution**: Check `_status` field; duplicate likely in local DB, will be deduplicated on next sync

### Issue: Collector can see other collector's data
**Solution**: Verify Supabase RLS policies and SyncService collector filtering

### Issue: Offline payment never syncs
**Solution**: Check network status with `NetInfo.fetch()`; ensure SyncService started

---

## References

- WatermelonDB Docs: https://watermelondb.org
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- Expo Native Modules: https://docs.expo.dev
- React Native Querying: https://www.sqlite.org/lang_select.html
