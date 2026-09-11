# Collector-Borrower Relationship Analysis

## Overview
Borrowers are assigned to field collectors (agents) to manage loan collection activities. The relationship is stored in the `collector_id` field on the Borrower model.

---

## 1. Data Model Relationships

### Borrower Model
**File:** [src/database/models/Borrower.ts](../src/database/models/Borrower.ts)

```typescript
export default class Borrower extends Model {
    static table = 'borrowers'

    @field('full_name') fullName: string;
    @field('address') address: string;
    @field('phone') phone: string;
    @field('area') area: string;                          // Geographic area for routing
    @field('route_index') routeIndex: number;             // Route order/sequence
    @field('collector_id') collectorId: string;           // ← COLLECTOR ASSIGNMENT (FK)
    @field('auth_id') authId: string;
    @date('date_of_birth') dateOfBirth: number;
    @field('gender') gender: string;
    @field('notes') notes: string;
    @field('created_by') createdBy: string;
    @field('latitude') latitude: number;
    @field('longitude') longitude: number;
    @date('created_at') createdAt: number;
    @date('updated_at') updatedAt: number;

    @children('loans') loans: any;  // Relationship to Loans

    get decryptedPhone(): string | null {
        return EncryptionService.decrypt(this.phone);
    }
    get decryptedAddress(): string | null {
        return EncryptionService.decrypt(this.address);
    }
}
```

### UserProfile Model (Collectors)
**File:** [src/database/models/UserProfile.ts](../src/database/models/UserProfile.ts)

```typescript
export default class UserProfile extends Model {
    static table = 'user_profiles'

    @field('full_name') fullName: string;
    @field('email') email: string;
    @field('role') role: string;              // 'collector', 'admin', etc.
    @field('is_active') isActive: boolean;
    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
}
```

### Database Schema
**File:** [src/database/schema.ts](../src/database/schema.ts)

```typescript
tableSchema({
    name: 'borrowers',
    columns: [
        { name: 'full_name', type: 'string' },
        { name: 'address', type: 'string', isOptional: true },
        { name: 'phone', type: 'string', isOptional: true },
        { name: 'area', type: 'string', isOptional: true },
        { name: 'route_index', type: 'number', isOptional: true },
        { name: 'collector_id', type: 'string', isOptional: true },  // ← KEY FIELD
        { name: 'auth_id', type: 'string', isOptional: true },
        { name: 'date_of_birth', type: 'number', isOptional: true },
        { name: 'gender', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'created_by', type: 'string', isOptional: true },
        { name: 'latitude', type: 'number', isOptional: true },
        { name: 'longitude', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
    ]
}),
```

---

## 2. Borrower Assignment to Collectors

### Creating a New Borrower with Collector Assignment
**Files:** [app/(admin)/borrowers/new.tsx](../app/(admin)/borrowers/new.tsx)

```typescript
const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
        await database.write(async () => {
            await database.collections.get<Borrower>('borrowers').create(borrower => {
                borrower._raw.id = uuid.v4().toString();
                borrower.fullName = data.fullName.trim();
                borrower.address = EncryptionService.encrypt(data.address?.trim() || null);
                borrower.phone = EncryptionService.encrypt(data.phone?.trim() || null);
                borrower.gender = data.gender || null;
                borrower.notes = data.notes?.trim() || null;
                borrower.collectorId = data.collectorId || null;  // ← ASSIGNMENT HERE
                borrower.createdBy = user?.id || null;
            });
        });
        router.back();
    } catch (error) {
        console.error('Failed to save borrower', error);
    }
};
```

### Editing Borrower Collector Assignment
**Files:** [app/(admin)/borrowers/[id].tsx](app/(admin)/borrowers/[id].tsx)

```typescript
useEffect(() => {
    const loadData = async () => {
        try {
            const b = await database.collections.get<Borrower>('borrowers').find(id);
            // Load all active collectors from database
            const users = await database.collections.get<UserProfile>('user_profiles')
                .query(Q.where('role', 'collector'))
                .fetch();
            
            setCollectors(users);
            // ... populate form with current assignment
        }
    };
}, [id]);

const onSubmit = async (data: FormData) => {
    if (!borrower) return;
    await database.write(async () => {
        await borrower.update(b => {
            b.collectorId = data.collectorId || null;  // ← UPDATE ASSIGNMENT
        });
    });
};
```

### UI for Collector Assignment
Both new and edit screens show a selector:
```typescript
<View className="mb-4">
    <Text className="text-xs font-bold text-gray-500 mb-2 uppercase">Assign to Collector</Text>
    <Controller
        control={control}
        name="collectorId"
        render={({ field: { onChange, value } }) => (
            <View className="border border-gray-200 rounded-xl overflow-hidden">
                {collectors.length === 0 ? (
                    <Text className="p-4 text-gray-400">No collectors found.</Text>
                ) : (
                    collectors.map((c, i) => (
                        <Pressable
                            key={c.id}
                            onPress={() => onChange(value === c.id ? '' : c.id)}
                            className={`p-4 flex-row justify-between items-center ${
                                value === c.id ? 'bg-blue-50' : 'bg-gray-50'
                            }`}
                        >
                            <Text className={value === c.id ? 'font-bold text-blue-700' : 'text-gray-700'}>
                                {c.fullName}
                            </Text>
                        </Pressable>
                    ))
                )}
            </View>
        )}
    />
</View>
```

---

## 3. Querying Borrowers for a Collector

### Collector Dashboard - Get Assigned Borrowers
**File:** [app/(collector)/index.tsx](../app/(collector)/index.tsx)

```typescript
const fetchData = async () => {
    if (!user) return;
    try {
        // Step 1: Get all borrowers assigned to this collector
        const assignedBorrowers = await database.collections.get<Borrower>('borrowers')
            .query(Q.where('collector_id', user.id))  // ← KEY QUERY
            .fetch();

        setBorrowers(assignedBorrowers);

        const borrowerIds = assignedBorrowers.map(b => b.id);
        if (borrowerIds.length === 0) {
            setStats({ todayCollection: 0, outstanding: 0, activeClients: 0, efficiency: 0 });
            return;
        }

        // Step 2: Get active loans for these borrowers
        const activeLoans = await database.collections.get<Loan>('loans')
            .query(
                Q.where('borrower_id', Q.oneOf(borrowerIds)), 
                Q.where('status', 'active')
            )
            .fetch();

        // Step 3: Calculate statistics based on loans and schedules
        // ... (payment calculations)
    } catch (error) {
        console.error('Failed to fetch collector data', error);
    }
};
```

### Collection Sheet Screen - Filtered & Sorted Borrowers
**File:** [app/(collector)/collection-sheet.tsx](../app/(collector)/collection-sheet.tsx)

```typescript
const fetchData = useCallback(async () => {
    if (!user) return;
    try {
        const today = new Date();
        const endOfToday = endOfDay(today).getTime();

        // 1. Get borrowers assigned to this collector
        const assignedBorrowers = await database.collections.get<Borrower>('borrowers')
            .query(Q.where('collector_id', user.id))
            .fetch();

        const borrowerIds = assignedBorrowers.map(b => b.id);
        if (borrowerIds.length === 0) {
            setItems([]);
            return;
        }

        // 2. Get active loans for these borrowers
        const activeLoans = await database.collections.get<Loan>('loans')
            .query(
                Q.where('borrower_id', Q.oneOf(borrowerIds)), 
                Q.where('status', 'active')
            )
            .fetch();

        // 3. Get schedules due today or earlier that are unpaid
        const dueSchedules = await database.collections.get<PaymentSchedule>('payment_schedules')
            .query(
                Q.where('loan_id', Q.oneOf(activeLoanIds)),
                Q.where('due_date', Q.lte(endOfToday)),
                Q.where('status', Q.notEq('paid'))
            )
            .fetch();

        // 4. Map them together
        const collectionItems: CollectionItem[] = dueSchedules.map(sch => {
            const loan = activeLoans.find(l => l.id === sch.loanId)!;
            const borrower = assignedBorrowers.find(b => b.id === loan.borrowerId)!;
            return { borrower, loan, schedule: sch };
        });

        // 5. SORT by route_index, then area (important for field visit optimization)
        collectionItems.sort((a, b) => {
            if (a.borrower.routeIndex !== b.borrower.routeIndex) {
                return (a.borrower.routeIndex || 0) - (b.borrower.routeIndex || 0);
            }
            const areaA = a.borrower.area || '';
            const areaB = b.borrower.area || '';
            return areaA.localeCompare(areaB);
        });

        setItems(collectionItems);
    } catch (error) {
        console.error('Failed to fetch collection sheet', error);
    }
}, [user]);
```

---

## 4. Collectors Admin Screen

### List All Collectors
**File:** [app/(admin)/collectors/index.tsx](../app/(admin)/collectors/index.tsx)

```typescript
const loadData = async () => {
    try {
        const fetched = await database.collections.get<UserProfile>('user_profiles')
            .query(Q.where('role', 'collector'))  // ← QUERY BY ROLE
            .fetch();
        setCollectors(fetched);
    } catch (error) {
        console.error('Failed to load collectors:', error);
    }
};

// Display collectors in a list
const renderItem = ({ item }: { item: UserProfile }) => (
    <Pressable
        onPress={() => router.push(`/(admin)/collectors/${item.id}`)}
    >
        {/* Collector card UI */}
    </Pressable>
);
```

---

## 5. Sync & Linking Logic

### Sync Service - Borrowers Table
**File:** [src/services/SyncService.ts](../src/services/SyncService.ts)

The SyncService includes 'borrowers' in `SYNC_TABLES`:
```typescript
const SYNC_TABLES = [
    'user_profiles',
    'borrowers',  // ← Synced with Collector assignments
    'loans',
    'payment_schedules',
    'payments',
    'expenses',
    'cash_transactions',
    'bank_accounts',
    'bank_transactions',
    'collection_logs',
    'financial_snapshots',
    'remittances',
];
```

When syncing:
1. Pulls borrower changes from Supabase (including `collector_id` updates)
2. Pushes local borrower changes to Supabase
3. Bidirectional sync ensures assignments are consistent across devices

---

## 6. Test Coverage - Assignment Logic
**File:** [src/services/__tests__/Phase6.integration.test.ts](../src/services/__tests__/Phase6.integration.test.ts)

```typescript
it('should correctly filter and sort borrowers in collection sheet logic', async () => {
    // Create borrowers with different collectors
    await mockTestDb.write(async () => {
        // Collector A gets 3 borrowers
        await mockTestDb.get<Borrower>('borrowers').create(b => { 
            b._raw.id = 'b1'; 
            b.fullName = 'Zeta'; 
            b.collectorId = 'coll-A';  // ← ASSIGNMENT
            b.routeIndex = 2; 
            b.area = 'North'; 
        });
        // ... more borrowers
        
        // Collector B gets different borrowers
        await mockTestDb.get<Borrower>('borrowers').create(b => { 
            b._raw.id = 'b4'; 
            b.fullName = 'Gamma'; 
            b.collectorId = 'coll-B';  // ← DIFFERENT COLLECTOR
        });
    });

    // Query borrowers for Collector A
    const assigned = await mockTestDb.collections.get<Borrower>('borrowers')
        .query(Q.where('collector_id', 'coll-A'))  // ← FILTER BY COLLECTOR
        .fetch();

    expect(assigned.length).toBe(3);

    // Sort by route for field visit optimization
    assigned.sort((a, b) => {
        if (a.routeIndex !== b.routeIndex) {
            return (a.routeIndex || 0) - (b.routeIndex || 0);
        }
        const areaA = a.area || '';
        const areaB = b.area || '';
        return areaA.localeCompare(areaB);
    });

    expect(assigned[0].fullName).toBe('Beta');   // Route 1, Area North
    expect(assigned[1].fullName).toBe('Alpha');  // Route 1, Area South
    expect(assigned[2].fullName).toBe('Zeta');   // Route 2
});
```

---

## 7. Summary: Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│ ADMIN INTERFACE - Assignmen                                  │
├──────────────────────────────────────────────────────────────┤
│ new.tsx / [id].tsx                                           │
│                                                              │
│ 1. Load all UserProfiles with role='collector'              │
│ 2. Display selector: User picks collector                    │
│ 3. Save borrower.collectorId = selectedCollector.id          │
│ 4. Synced to Supabase                                       │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ SUPABASE (Remote Database)                                   │
├──────────────────────────────────────────────────────────────┤
│ borrowers table:                                             │
│   - id, full_name, collector_id, area, route_index, ...     │
│ user_profiles table:                                         │
│   - id, full_name, role='collector', ...                     │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼ SyncService.sync()
┌──────────────────────────────────────────────────────────────┐
│ LOCAL WATERMELON DATABASE                                    │
├──────────────────────────────────────────────────────────────┤
│ Borrower.collectorId stays in sync                          │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ COLLECTOR APP INTERFACE                                      │
├──────────────────────────────────────────────────────────────┤
│ index.tsx / collection-sheet.tsx                            │
│                                                              │
│ 1. Query: borrowers where collector_id = user.id            │
│ 2. Get assigned borrowers                                    │
│ 3. Fetch their active loans & payment schedules             │
│ 4. Sort by route_index, then area                           │
│ 5. Display collection sheet                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Key Query Patterns

### Query Borrowers by Collector
```typescript
const assignedBorrowers = await database.collections.get<Borrower>('borrowers')
    .query(Q.where('collector_id', '${collectorId}'))
    .fetch();
```

### Query Collectors (for assignment dropdown)
```typescript
const collectors = await database.collections.get<UserProfile>('user_profiles')
    .query(Q.where('role', 'collector'))
    .fetch();
```

### Query Active Loans for Borrowers (on path to collector)
```typescript
const activeLoans = await database.collections.get<Loan>('loans')
    .query(
        Q.where('borrower_id', Q.oneOf(borrowerIds)),
        Q.where('status', 'active')
    )
    .fetch();
```

### Sort Borrowers by Route for Field Visits
```typescript
borrowers.sort((a, b) => {
    if (a.routeIndex !== b.routeIndex) {
        return (a.routeIndex || 0) - (b.routeIndex || 0);
    }
    return (a.area || '').localeCompare(b.area || '');
});
```

---

## 9. Related Fields in Borrower Model

- **collector_id**: String - The UserProfile.id of assigned collector
- **area**: String - Geographic area for route/field optimization
- **route_index**: Number - Sequence in collector's daily route
- **latitude/longitude**: Number - Geolocation for mapping

These fields enable collectors to efficiently visit borrowers in optimized routes.
