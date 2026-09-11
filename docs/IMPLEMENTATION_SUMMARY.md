# Offline-First Borrower Management System - Implementation Summary

## Overview

This document provides a complete summary of the offline-first borrower management and payment system implementation for the POSCursor React Native (Expo) application.

---

## What Has Been Implemented

### 1. Custom Hooks

#### `useBorrowers()` - `/src/hooks/useBorrowers.ts`

```typescript
// Fetches borrowers assigned to the current collector
const { borrowers, loading, error, refetch } = useBorrowers({
    collectorId?: string,        // Optional override
    sortBy?: 'name' | 'date' | 'area'
});
```

**Features:**
- Automatically filters by current user's `collector_id`
- Supports custom sorting (name, date, area)
- Real-time updates when database changes
- Error handling and loading states
- Manual refetch capability

---

#### `useCollectors()` - `/src/hooks/useCollectors.ts`

```typescript
// Fetches all active collectors
const { collectors, loading, error, refetch } = useCollectors();
```

**Features:**
- Queries WatermelonDB `user_profiles` table
- Filters for `role = 'collector'` and `is_active = true`
- Returns sorted list of collectors with id, name, email
- Useful for collector selection modals

---

#### `useSync()` - `/src/hooks/useSync.ts`

```typescript
// Manages sync operations and tracks state
const {
    sync,                          // Trigger manual sync (force?: boolean)
    isSyncing,                     // Is sync in progress
    isOnline,                      // Network connectivity status
    syncProgress,                  // { status, progress, currentModel, error }
    pendingChanges,                // Count of unsynced records
    lastSyncAt,                    // Timestamp of last successful sync
    getPendingCount,               // Get async pending count
    verifyBorrowerAssignments,     // Verify data consistency
} = useSync();
```

**Features:**
- Monitors network status automatically
- Triggers auto-sync when reconnected
- Tracks sync progress and errors
- Provides pending changes count
- Verifies data consistency for collectors

---

### 2. Enhanced SyncService

**Location:** `/src/services/SyncService.ts`

**New Methods:**

```typescript
// Get current collector ID from auth store
private getCurrentCollectorId(): string | null

// Verify borrowers assigned to collector are in local DB
public async verifyCollectorBorrowers(collectorId?: string): Promise<boolean>

// Get count of assigned borrowers
public async getAssignedBorrowerCount(): Promise<number>
```

**Collector-Specific Filtering:**

Tables that are filtered by `collector_id`:
- `borrowers`
- `loans`
- `payments`
- `collection_logs`

**Implementation:**
```typescript
// In fetchTableChanges()
if (COLLECTOR_SPECIFIC_TABLES.includes(tableName)) {
    const collectorId = this.getCurrentCollectorId();
    if (collectorId) {
        activeQuery = activeQuery.eq('collector_id', collectorId);
    }
}
```

---

### 3. CollectorSelector Component

**Location:** `/src/components/CollectorSelector.tsx`

```typescript
<CollectorSelector
    visible={boolean}
    selectedCollectorId={string}
    onSelect={(collectorId: string, collectorName: string) => void}
    onClose={() => void}
    error={string}
/>
```

**Features:**
- Modal interface for selecting collectors
- Search by name or email
- Real-time filtering
- Visual feedback for selected collector
- Displays collector count
- Loading state during data fetch

---

### 4. Offline Utils

**Location:** `/src/utils/offlineUtils.ts`

#### UUID Generation
```typescript
generateUUID(): string
```

#### Borrower Operations
```typescript
// Create borrower offline-first
async createBorrowerOffline(borrowerData: {
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
}): Promise<Borrower>

// Update borrower and mark for sync
async updateBorrowerOffline(borrowerId: string, updates): Promise<Borrower>

// Get borrowers filtered by collector
async getBorrowersByCollector(collectorId: string): Promise<Borrower[]>

// Assign collector to borrower
async assignCollectorToBorrower(borrowerId: string, collectorId: string): Promise<Borrower>
```

#### Payment Operations
```typescript
// Record payment offline
async createPaymentOffline(paymentData: {
    loanId: string,
    scheduleId?: string,
    collectorId: string,
    amount: number,
    paymentDate?: number,
    receiptNumber?: string,
    notes?: string,
}): Promise<Payment>
```

#### Sync Management
```typescript
// Get count of pending unsynced changes
async getPendingChangesCount(): Promise<number>

// Verify offline data consistency
async verifyOfflineData(collectorId: string): Promise<{
    isValid: boolean,
    borrowerCount: number,
    hasData: boolean,
}>

// Get sync status of a record
async getRecordSyncStatus(tableName: string, recordId: string): Promise<{
    status: 'created' | 'updated' | 'deleted' | 'synced' | 'unknown',
    lastUpdated: Date,
}>
```

---

### 5. Enhanced BorrowerForm Component

**Location:** `/src/components/BorrowerFormWithCollector.tsx`

**Features:**
- Full borrower management form with all fields
- Integrated CollectorSelector modal
- Displays "Assigned Collector" field below gender
- Shows collector name and ID
- Validation for required fields
- Offline-first form submission
- Auto-updates collector assignment
- Loading and saving states

**Key Sections:**
- Full Name (required)
- Phone (required, encrypted)
- Address (optional, encrypted)
- Gender (Male/Female/Other)
- **Assigned Collector (required, NEW)**
- Area/Route (optional)
- Date of Birth (optional)
- Save/Cancel buttons

---

### 6. Comprehensive Documentation

**Location:** `/OFFLINE_FIRST_GUIDE.md`

Includes:
- Architecture overview with data flow diagram
- Complete usage guide with code examples
- API reference for all hooks and utilities
- Database schema documentation
- Conflict resolution strategy
- Network connectivity handling
- Testing examples (unit and integration)
- Debugging tips
- Deployment checklist
- Common issues and solutions

---

## Data Flow Diagram

```
User Creates/Updates Borrower
           ↓
    BorrowerFormWithCollector
    (Validates & Collects Data)
           ↓
    offlineUtils.createBorrowerOffline()
    (Writes to WatermelonDB first)
           ↓
  WatermelonDB (Local SQLite)
  [Record marked with _status: 'created']
           ↓
    UI Updates Immediately
    (useBorrowers hook triggered)
           ↓
   [Network Detection]
        ↙        ↘
    Offline      Online
       │            │
     Queue       SyncService
     Pending    .checkAndSync()
       │            │
     Store        Pull Changes
    Locally     (Supabase → WatermelonDB,
                 filtered by collector_id)
       │            │
      When       Push Changes
    Online    (WatermelonDB → Supabase,
                 marked as synced)
       │            │
    Sync +── ┌ ──┘
             │
        Update UI
       (Hooks re-render)
```

---

## Key Features

### ✅ Offline-First Architecture
- All writes happen to WatermelonDB first
- No direct Supabase writes from UI
- Records automatically marked for sync
- Network operations happen in background

### ✅ Collector Data Isolation
- Each collector only syncs their assigned borrowers
- SyncService filters by `collector_id`
- Supabase RLS policies should enforce this
- Prevents cross-collector data conflicts

### ✅ Real-Time UI Updates
- Hooks reflect database changes immediately
- Auto-refresh when sync completes
- Pending changes count displayed
- Network status indicator

### ✅ Sync Metadata Tracking
- `_status`: Record sync state
- `created_at`: Record creation time
- `updated_at`: Last modification time
- All timestamps in milliseconds

### ✅ Conflict Resolution
- Last-Write-Wins (LWW) strategy
- Supabase upsert handles conflicts
- Soft-deletes prevent orphaned references
- Collector filtering prevents conflicts

### ✅ Network Awareness
- Auto-detect online/offline status
- Auto-sync when reconnected
- Queue operations while offline
- Graceful error handling

---

## Integration Guide

### Step 1: Update Your App Root

```typescript
import { useNetworkStatus } from './src/hooks/useNetworkStatus';

export default function App() {
    useNetworkStatus();  // Start monitoring network
    
    return (
        // Your app structure
    );
}
```

### Step 2: Replace BorrowerForm

```typescript
import { BorrowerFormWithCollector } from './src/components/BorrowerFormWithCollector';

// Use instead of old BorrowerSelector/Form
<BorrowerFormWithCollector
    borrowerId={optionalId}
    onSuccess={(borrower) => {
        // Handle success
    }}
    onCancel={() => {
        // Handle cancel
    }}
/>
```

### Step 3: Display Borrowers in Dashboard

```typescript
import { useBorrowers } from './src/hooks/useBorrowers';

export function CollectorDashboard() {
    const { borrowers, loading } = useBorrowers();
    
    return (
        <FlatList
            data={borrowers}
            renderItem={({ item }) => <BorrowerCard borrower={item} />}
        />
    );
}
```

### Step 4: Add Sync Button

```typescript
import { useSync } from './src/hooks/useSync';

export function SyncButton() {
    const { sync, isSyncing, isOnline, pendingChanges } = useSync();
    
    return (
        <Pressable
            onPress={() => sync(false)}
            disabled={isSyncing || !isOnline}
        >
            <Text>
                Sync {pendingChanges > 0 && `(${pendingChanges})`}
            </Text>
        </Pressable>
    );
}
```

### Step 5: Record Payments Offline

```typescript
import { createPaymentOffline } from './src/utils/offlineUtils';
import { useAuthStore } from './src/stores/authStore';

export function PaymentForm({ loanId }) {
    const { user } = useAuthStore();
    
    const handleRecordPayment = async (amount) => {
        await createPaymentOffline({
            loanId,
            collectorId: user.id,
            amount,
        });
        // Payment will sync when online
    };
}
```

---

## File Structure

```
src/
├── hooks/
│   ├── useBorrowers.ts         ✅ NEW
│   ├── useCollectors.ts        ✅ NEW
│   ├── useSync.ts              ✅ NEW
│   └── useNetworkStatus.ts     (existing)
├── components/
│   ├── CollectorSelector.tsx   ✅ NEW
│   ├── BorrowerFormWithCollector.tsx  ✅ NEW
│   └── (other components)
├── database/
│   ├── models/
│   │   ├── Borrower.ts         (updated)
│   │   ├── Loan.ts             (updated)
│   │   ├── Payment.ts          (updated)
│   │   └── UserProfile.ts      (existing)
│   └── (schema, supabase config)
├── services/
│   ├── SyncService.ts          ✅ ENHANCED
│   └── (other services)
├── stores/
│   ├── authStore.ts            (existing)
│   └── syncStore.ts            (existing)
└── utils/
    ├── offlineUtils.ts         ✅ NEW
    └── (other utils)
```

---

## Database Schema Requirements

### Borrowers Table
```sql
- id (UUID, primary key)
- full_name (text)
- phone (text, encrypted)
- address (text, encrypted)
- collector_id (UUID, foreign key to user_profiles)
- gender (text)
- area (text)
- date_of_birth (timestamp)
- notes (text)
- created_by (UUID)
- latitude (numeric)
- longitude (numeric)
- created_at (bigint, milliseconds)
- updated_at (bigint, milliseconds)
- deleted_at (timestamp, soft-delete)
```

### Payments Table
```sql
- id (UUID, primary key)
- loan_id (UUID, foreign key)
- schedule_id (UUID)
- collector_id (UUID, foreign key)
- amount (numeric)
- payment_date (bigint, milliseconds)
- receipt_number (text)
- notes (text)
- encoded_at (bigint, milliseconds)
- created_at (bigint, milliseconds)
- updated_at (bigint, milliseconds)
- deleted_at (timestamp, soft-delete)
```

### UserProfiles Table
```sql
- id (UUID, primary key)
- full_name (text)
- email (text)
- role (text)  -- 'collector', 'admin', etc.
- is_active (boolean)
- created_at (bigint, milliseconds)
- updated_at (bigint, milliseconds)
```

---

## Supabase RLS Policies

### Collectors see only their borrowers
```sql
CREATE POLICY "Collectors view own borrowers"
ON borrowers FOR SELECT
USING (collector_id = auth.uid());
```

### Collectors update their borrowers
```sql
CREATE POLICY "Collectors update own borrowers"
ON borrowers FOR UPDATE
USING (collector_id = auth.uid());
```

### Collectors view their payments
```sql
CREATE POLICY "Collectors view own payments"
ON payments FOR SELECT
USING (collector_id = auth.uid());
```

---

## Testing Checklist

- [ ] Offline borrower creation works without network
- [ ] Borrower appears in list after creation
- [ ] Collector assignment persists and saves
- [ ] Payment recorded offline syncs when online
- [ ] Sync filters by collector_id correctly
- [ ] Network reconnection triggers auto-sync
- [ ] Pending changes count updates correctly
- [ ] Borrower form validation works
- [ ] CollectorSelector modal opens/closes
- [ ] Offline banner shows when offline
- [ ] Sync errors display user-friendly messages
- [ ] Records marked as synced after successful sync
- [ ] Multiple collectors don't see each other's data

---

## Performance Considerations

### WatermelonDB Queries
- Indexed `collector_id` for fast filtering
- Sorted results in memory where appropriate
- Limit query results for large datasets

### Sync Optimization
- Batch push operations (WatermelonDB handles this)
- Incremental sync using `lastPulledAt`
- Collector filtering reduces data volume
- Table-by-table sync with progress tracking

### Network Optimization
- Compress data where possible
- Batch API requests
- Exponential backoff for retries
- Detect network type (WiFi vs cellular)

---

## Troubleshooting

### Borrowers not appearing after sync
```typescript
// Verify data consistency
const verified = await verifyOfflineData(currentCollectorId);
if (!verified.isValid) {
    await SyncService.checkAndSync({ force: true });
}
```

### Payment not syncing
```typescript
// Check if online
import { useSyncStore } from './stores/syncStore';
const { isOnline } = useSyncStore();
if (!isOnline) console.log('Waiting for network...');

// Check pending count
const pending = await getPendingChangesCount();
console.log('Pending changes:', pending);
```

### Collector modal not showing
```typescript
// Verify UserProfiles table has active collectors
const collectors = useCollectors();
if (!collectors.length) console.warn('No collectors available');
```

---

## Next Steps

1. **Supabase Configuration**
   - Create RLS policies for collector filtering
   - Verify database schema matches documentation
   - Test with real Supabase instance

2. **App Integration**
   - Replace existing borrower forms
   - Integrate new hooks into existing screens
   - Add sync button to collector dashboard

3. **Testing**
   - Run offline-first flow end-to-end
   - Test with slow network conditions
   - Verify sync with multiple collectors

4. **Deployment**
   - Monitor sync performance in production
   - Set up error logging and alerts
   - Document deployment procedures

---

## Support & References

- **WatermelonDB**: https://watermelondb.org
- **Supabase**: https://supabase.com
- **React Native**: https://reactnative.dev
- **Expo**: https://expo.dev

---

## Summary of New Files Created

✅ `/src/hooks/useBorrowers.ts` - Hook for fetching collector's borrowers
✅ `/src/hooks/useCollectors.ts` - Hook for fetching collectors
✅ `/src/hooks/useSync.ts` - Hook for managing sync operations
✅ `/src/components/CollectorSelector.tsx` - Modal for collector selection
✅ `/src/components/BorrowerFormWithCollector.tsx` - Enhanced borrower form
✅ `/src/utils/offlineUtils.ts` - Offline-first CRUD utilities
✅ `/OFFLINE_FIRST_GUIDE.md` - Comprehensive implementation guide

## Summary of Enhanced Files

✅ `/src/services/SyncService.ts` - Added collector filtering and verification methods

---

All components follow Domain-Driven Design principles with proper separation of concerns. Business logic is encapsulated in Services and Models, with UI components relying on custom hooks for data access.
