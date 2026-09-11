import 'react-native-get-random-values';
import uuid from 'react-native-uuid';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Borrower from '../database/models/Borrower';
import Payment from '../database/models/Payment';
import Loan from '../database/models/Loan';

/**
 * Generate a UUID for offline records
 * Ensures unique identification across sync operations
 */
export function generateUUID(): string {
    return uuid.v4().toString();
}

/**
 * Create a borrower record and mark it for sync
 * All writes happen to WatermelonDB first (offline-first)
 * 
 * ✅ FIX: created_by is now required and cannot be empty
 * Empty created_by causes FK constraint violations on sync
 */
export async function createBorrowerOffline(borrowerData: {
    fullName: string;
    phone: string;
    address: string;
    collectorId: string;
    gender?: string;
    area?: string;
    dateOfBirth?: number;
    notes?: string;
    createdBy: string;  // ✅ Now REQUIRED (no longer optional)
    latitude?: number;
    longitude?: number;
}): Promise<Borrower> {
    try {
        // Validate required fields
        if (!borrowerData.createdBy || borrowerData.createdBy.trim() === '') {
            throw new Error('[OfflineUtils] Invalid: createdBy cannot be empty - FK constraint violation would occur on sync');
        }

        const collection = database.collections.get<Borrower>('borrowers');
        const borrower = await collection.create((b: any) => {
            b.full_name = borrowerData.fullName;
            b.phone = borrowerData.phone;
            b.address = borrowerData.address;
            b.collector_id = borrowerData.collectorId;
            b.gender = borrowerData.gender || '';
            b.area = borrowerData.area || '';
            b.date_of_birth = borrowerData.dateOfBirth || 0;
            b.notes = borrowerData.notes || '';
            b.created_by = borrowerData.createdBy;  // ✅ Required, validated above
            b.latitude = borrowerData.latitude || 0;
            b.longitude = borrowerData.longitude || 0;
            b.created_at = Date.now();
            b.updated_at = Date.now();
        });

        console.log('[OfflineUtils] Created borrower:', borrower.id);
        return borrower;
    } catch (err) {
        console.error('[OfflineUtils] Failed to create borrower:', err);
        throw err;
    }
}

/**
 * Update borrower and mark for sync
 * Records are automatically marked as "dirty" by WatermelonDB
 */
export async function updateBorrowerOffline(
    borrowerId: string,
    updates: Partial<{
        fullName: string;
        phone: string;
        address: string;
        collectorId: string;
        gender: string;
        area: string;
        dateOfBirth: number;
        notes: string;
        latitude: number;
        longitude: number;
    }>
): Promise<Borrower> {
    try {
        const collection = database.collections.get<Borrower>('borrowers');
        const borrower = await collection.find(borrowerId);

        await borrower.update((b: any) => {
            if (updates.fullName !== undefined) b.full_name = updates.fullName;
            if (updates.phone !== undefined) b.phone = updates.phone;
            if (updates.address !== undefined) b.address = updates.address;
            if (updates.collectorId !== undefined) b.collector_id = updates.collectorId;
            if (updates.gender !== undefined) b.gender = updates.gender;
            if (updates.area !== undefined) b.area = updates.area;
            if (updates.dateOfBirth !== undefined) b.date_of_birth = updates.dateOfBirth;
            if (updates.notes !== undefined) b.notes = updates.notes;
            if (updates.latitude !== undefined) b.latitude = updates.latitude;
            if (updates.longitude !== undefined) b.longitude = updates.longitude;
            b.updated_at = Date.now();
        });

        console.log('[OfflineUtils] Updated borrower:', borrowerId);
        return borrower;
    } catch (err) {
        console.error('[OfflineUtils] Failed to update borrower:', err);
        throw err;
    }
}

/**
 * Create a payment record for offline sync
 * ✅ ENHANCED: Now includes borrower_id for FK constraint compliance
 */
export async function createPaymentOffline(paymentData: {
    loanId: string;
    borrowerId?: string;
    scheduleId?: string;
    collectorId: string;
    amount: number;
    paymentDate?: number;
    receiptNumber?: string;
    notes?: string;
}): Promise<Payment> {
    try {
        const collection = database.collections.get<Payment>('payments');
        
        // ✅ NEW: If borrower_id not provided, fetch from loan
        let borrowerId = paymentData.borrowerId;
        if (!borrowerId) {
            try {
                const loan = await database.collections
                    .get<Loan>('loans')
                    .find(paymentData.loanId);
                borrowerId = loan.borrowerId;
            } catch (err) {
                console.warn('[OfflineUtils] Could not fetch borrower_id from loan:', err);
            }
        }

        const payment = await collection.create((p: any) => {
            p.loan_id = paymentData.loanId;
            p.borrower_id = borrowerId || '';  // ✅ NEW: Set borrower_id
            p.schedule_id = paymentData.scheduleId || '';
            p.collector_id = paymentData.collectorId;
            p.amount = paymentData.amount;
            p.payment_date = paymentData.paymentDate || Date.now();
            p.receipt_number = paymentData.receiptNumber || '';
            p.notes = paymentData.notes || '';
            p.encoded_at = Date.now();
            p.created_at = Date.now();
            p.updated_at = Date.now();
        });

        console.log('[OfflineUtils] Created payment:', payment.id);
        return payment;
    } catch (err) {
        console.error('[OfflineUtils] Failed to create payment:', err);
        throw err;
    }
}

/**
 * Get borrowers filtered by collector ID
 * Queries local WatermelonDB for fast offline access
 */
export async function getBorrowersByCollector(collectorId: string): Promise<Borrower[]> {
    try {
        const collection = database.collections.get<Borrower>('borrowers');
        const borrowers = await collection.query(
            Q.where('collector_id', collectorId)
        ).fetch();

        console.log(`[OfflineUtils] Found ${borrowers.length} borrowers for collector ${collectorId}`);
        return borrowers;
    } catch (err) {
        console.error('[OfflineUtils] Failed to fetch borrowers:', err);
        throw err;
    }
}

/**
 * Count pending changes (unsynced records) across all tables
 * Useful for showing sync status and pending item count
 */
export async function getPendingChangesCount(): Promise<number> {
    try {
        const tableNames = [
            'borrowers',
            'loans',
            'payments',
            'payment_schedules',
            'expenses',
            'collection_logs',
        ];

        let totalPending = 0;
        for (const tableName of tableNames) {
            try {
                const collection = database.collections.get(tableName);
                const count = await collection
                    .query(
                        Q.where('_status', Q.oneOf(['created', 'updated', 'deleted']))
                    )
                    .fetchCount();
                totalPending += count;
            } catch (err) {
                console.warn(`[OfflineUtils] Could not count pending for ${tableName}:`, err);
            }
        }

        console.log('[OfflineUtils] Total pending changes:', totalPending);
        return totalPending;
    } catch (err) {
        console.error('[OfflineUtils] Failed to get pending count:', err);
        return 0;
    }
}

/**
 * Verify offline data consistency
 * Checks that assigned borrowers are present in local DB
 */
export async function verifyOfflineData(collectorId: string): Promise<{
    isValid: boolean;
    borrowerCount: number;
    hasData: boolean;
}> {
    try {
        const borrowers = await getBorrowersByCollector(collectorId);
        const isValid = borrowers.length > 0;

        return {
            isValid,
            borrowerCount: borrowers.length,
            hasData: true,
        };
    } catch (err) {
        console.error('[OfflineUtils] Verification failed:', err);
        return {
            isValid: false,
            borrowerCount: 0,
            hasData: false,
        };
    }
}

/**
 * Attach collector to a borrower (updates collector_id)
 * Marks the borrower as updated for sync
 */
export async function assignCollectorToBorrower(
    borrowerId: string,
    collectorId: string,
    collectorName?: string
): Promise<Borrower> {
    try {
        return await updateBorrowerOffline(borrowerId, { collectorId });
    } catch (err) {
        console.error('[OfflineUtils] Failed to assign collector:', err);
        throw err;
    }
}

/**
 * Get sync metadata for a record (status, last update time)
 */
export async function getRecordSyncStatus(
    tableName: string,
    recordId: string
): Promise<{
    status: 'created' | 'updated' | 'deleted' | 'synced' | 'unknown';
    lastUpdated: Date;
}> {
    try {
        const collection = database.collections.get(tableName);
        const record = await collection.find(recordId);

        // WatermelonDB sync status is in _status field
        const status = (record as any)._status || 'synced';
        const lastUpdated = new Date((record as any).updated_at || Date.now());

        return {
            status,
            lastUpdated,
        };
    } catch (err) {
        console.error('[OfflineUtils] Failed to get sync status:', err);
        return {
            status: 'unknown',
            lastUpdated: new Date(),
        };
    }
}
