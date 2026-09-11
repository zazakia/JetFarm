# Quick Start Guide - Offline-First System

## 5-Minute Setup

### 1. Install the System

All files are already created in your project. No additional installations needed. The system uses existing dependencies:
- ✅ WatermelonDB (already in your project)
- ✅ Zustand (for state management)
- ✅ Supabase (for remote storage)
- ✅ React Native NetInfo (for network detection)

### 2. Import the Hooks

```typescript
import { useBorrowers } from './src/hooks/useBorrowers';
import { useCollectors } from './src/hooks/useCollectors';
import { useSync } from './src/hooks/useSync';
```

### 3. Use in Your Components

#### Display Borrowers
```typescript
export function BorrowerList() {
    const { borrowers } = useBorrowers();
    
    return borrowers.map(b => <Text>{b.fullName}</Text>);
}
```

#### Create Borrower (Offline-First)
```typescript
import { createBorrowerOffline } from './src/utils/offlineUtils';

const borrower = await createBorrowerOffline({
    fullName: 'John Doe',
    phone: '09123456789',
    address: '123 Main St',
    collectorId: currentUserId,
});
```

#### Sync Data
```typescript
const { sync, pendingChanges, isOnline } = useSync();

await sync(true); // Manual sync
// Or automatic on network reconnect
```

---

## Key Concepts

### 1. Offline-First
**Data is written locally FIRST, synced later**

```
User Action → WatermelonDB → UI Update → Background Sync → Supabase
```

### 2. Collector Isolation
**Each collector only sees their own data**

```typescript
// Automatic filtering by collector_id
const { borrowers } = useBorrowers(); // Only this collector's borrowers
```

### 3. Local Caching
**Fast access to data without network**

```typescript
// Instant response from local database
const { borrowers } = useBorrowers(); // No network needed
```

### 4. Auto-Sync
**Sync happens automatically when online**

```typescript
// When network returns:
// 1. Auto-sync triggers
// 2. Pending changes pushed
// 3. UI refreshes automatically
```

---

## Common Tasks

### Display Assigned Borrowers in Dashboard

```typescript
import { useBorrowers } from './src/hooks/useBorrowers';
import { useSync } from './src/hooks/useSync';

export function CollectorDashboard() {
    const { borrowers, loading } = useBorrowers();
    const { isOnline, pendingChanges } = useSync();

    return (
        <View>
            {!isOnline && <Text>Offline Mode</Text>}
            {pendingChanges > 0 && <Text>Pending: {pendingChanges}</Text>}
            
            <FlatList
                data={borrowers}
                renderItem={({ item }) => (
                    <Text>{item.fullName}</Text>
                )}
            />
        </View>
    );
}
```

### Create New Borrower with Collector

```typescript
import { BorrowerFormWithCollector } from './src/components/BorrowerFormWithCollector';

export function CreateBorrower() {
    return (
        <BorrowerFormWithCollector
            onSuccess={(borrower) => {
                console.log('Borrower created:', borrower.id);
                // Navigate or refresh
            }}
            onCancel={() => {
                // Handle cancel
            }}
        />
    );
}
```

### Record Payment Offline

```typescript
import { createPaymentOffline } from './src/utils/offlineUtils';

const handlePayment = async (loanId, amount) => {
    const payment = await createPaymentOffline({
        loanId,
        collectorId: currentUserId,
        amount,
    });
    // Payment saved locally, will sync when online
};
```

### Manual Sync Trigger

```typescript
import { useSync } from './src/hooks/useSync';

export function SyncButton() {
    const { sync, isSyncing, isOnline } = useSync();

    return (
        <Pressable
            onPress={() => sync(true)}
            disabled={isSyncing || !isOnline}
        >
            <Text>{isSyncing ? 'Syncing...' : 'Sync Now'}</Text>
        </Pressable>
    );
}
```

### Select Collector for Borrower

```typescript
import { CollectorSelector } from './src/components/CollectorSelector';
import { useState } from 'react';

export function EditBorrowerCollector() {
    const [showModal, setShowModal] = useState(false);
    const [selectedCollector, setSelectedCollector] = useState(null);

    return (
        <>
            <Pressable onPress={() => setShowModal(true)}>
                <Text>{selectedCollector?.name || 'Select Collector'}</Text>
            </Pressable>

            <CollectorSelector
                visible={showModal}
                onSelect={(id, name) => {
                    setSelectedCollector({ id, name });
                    setShowModal(false);
                }}
                onClose={() => setShowModal(false)}
            />
        </>
    );
}
```

---

## Architecture at a Glance

```
┌─────────────────────────────────────┐
│     React Components (UI)            │
│  (Buttons, Forms, Lists, etc)        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│     Custom Hooks                     │
│  - useBorrowers()                    │
│  - useCollectors()                   │
│  - useSync()                         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│     Services & Utilities             │
│  - SyncService (offline-first sync)  │
│  - offlineUtils (CRUD operations)    │
│  - EncryptionService (PII protection)│
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
   ┌───▼───────┐    ┌──▼────────┐
   │ WatermelonDB   │ Supabase   │
   │ (Local SQLite) │ (Remote)   │
   │ INSTANT        │ Synced     │
   └────────────┘    └───────────┘
```

---

## What Happens When...

### User Creates Borrower (Offline)
```
1. User fills form
2. Click Save
3. Data written to WatermelonDB instantly ✓
4. UI updates immediately ✓
5. Record marked for sync
6. When online → synced to Supabase
```

### User Goes Offline
```
1. Network detected as down
2. Offline banner shows
3. Operations queue locally
4. No network errors shown to user
5. User can continue working
```

### Network Reconnects
```
1. Network detected as online
2. Offline banner hides
3. Auto-sync triggered immediately
4. Pending changes pushed to Supabase
5. Latest remote changes pulled
6. UI refreshes automatically
```

### User Taps Manual Sync
```
1. Sync process starts
2. Loading indicator shows
3. Pull phase (Supabase → Local)
4. Push phase (Local → Supabase)
5. Pending count updated
6. Success message shown
```

---

## Debugging Tips

### See Pending Changes
```typescript
import { getPendingChangesCount } from './src/utils/offlineUtils';

const pending = await getPendingChangesCount();
console.log('Pending changes:', pending);
```

### Check Sync Logs
```typescript
import { useSyncStore } from './src/stores/syncStore';

export function DebugSyncLogs() {
    const { logs } = useSyncStore();
    
    return logs.map(log => (
        <Text key={log.id}>{log.message}</Text>
    ));
}
```

### Verify Offline Data
```typescript
import { verifyOfflineData } from './src/utils/offlineUtils';

const { isValid, borrowerCount } = await verifyOfflineData(collectorId);
console.log('Data valid?', isValid, 'Borrowers:', borrowerCount);
```

### Monitor Network Status
```typescript
import { useSyncStore } from './src/stores/syncStore';

const { isOnline } = useSyncStore();
console.log('Online?', isOnline);
```

---

## File Map

| File | Purpose |
|------|---------|
| `src/hooks/useBorrowers.ts` | Fetch borrowers for collector |
| `src/hooks/useCollectors.ts` | Fetch all collectors |
| `src/hooks/useSync.ts` | Manage sync state |
| `src/components/CollectorSelector.tsx` | Select collector modal |
| `src/components/BorrowerFormWithCollector.tsx` | Create/edit borrower |
| `src/utils/offlineUtils.ts` | Offline CRUD operations |
| `src/services/SyncService.ts` | Sync orchestration (enhanced) |
| `OFFLINE_FIRST_GUIDE.md` | Comprehensive documentation |
| `IMPLEMENTATION_SUMMARY.md` | Complete implementation details |
| `EXAMPLE_DASHBOARD.tsx` | Example usage in real component |

---

## Quick Checklist

- ✅ Hooks created and tested
- ✅ Components created and styled
- ✅ Utilities for offline operations
- ✅ SyncService enhanced with collector filtering
- ✅ Documentation complete
- ✅ Example dashboard provided

### To integrate into your app:

- [ ] Update your screens to use new hooks
- [ ] Replace old BorrowerForm with BorrowerFormWithCollector
- [ ] Add useNetworkStatus() to app root
- [ ] Configure Supabase RLS policies
- [ ] Test offline-first flow
- [ ] Deploy to App Store/Play Store

---

## Common Issues

**Q: Borrowers not appearing?**
A: Call `verifyOfflineData()` - if no borrowers, trigger manual sync

**Q: Payment not saving?**
A: Check internet - works offline; will sync when online

**Q: Collector showing wrong data?**
A: Verify RLS policies in Supabase and SyncService filtering

**Q: Sync very slow?**
A: Check network speed; collector filtering reduces data volume

**Q: How to see what's syncing?**
A: Use syncProgress from useSync() hook or check useSyncStore logs

---

## Next Steps

1. **Integrate into Dashboard**
   - Replace existing borrower display with useBorrowers()
   - Add new borrower creation with BorrowerFormWithCollector

2. **Configure Network**
   - Ensure useNetworkStatus() called on app start
   - Test offline/online transitions

3. **Set Up Supabase**
   - Create RLS policies for collector filtering
   - Test with real Supabase instance

4. **Test End-to-End**
   - Create borrower offline
   - Go online → verify sync
   - Record payment offline
   - Restart app → verify persistence

5. **Monitor & Optimize**
   - Check sync performance
   - Monitor error rates
   - Gather user feedback

---

## Support

For detailed information, see:
- **OFFLINE_FIRST_GUIDE.md** - Complete reference
- **IMPLEMENTATION_SUMMARY.md** - Technical details
- **EXAMPLE_DASHBOARD.tsx** - Real component example

Get started with the quick examples above! 🚀
