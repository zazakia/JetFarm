import { useEffect, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Borrower from '../database/models/Borrower';
import { useAuthStore } from '../stores/authStore';

interface UseBorrowersOptions {
    collectorId?: string;
    sortBy?: 'name' | 'date' | 'area';
}

/**
 * Hook to fetch borrowers assigned to the current collector
 * Automatically filters by collector_id from current user
 * Updates in real-time when database changes
 */
export function useBorrowers(options: UseBorrowersOptions = {}) {
    const { user } = useAuthStore();
    const [borrowers, setBorrowers] = useState<Borrower[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchBorrowers = async () => {
        try {
            setLoading(true);
            setError(null);

            const collectorId = options.collectorId || user?.id;
            if (!collectorId) {
                setError('No collector ID available');
                setBorrowers([]);
                return;
            }

            const collection = database.collections.get<Borrower>('borrowers');
            
            // Build sort clause
            let sortClause;
            if (options.sortBy === 'date') {
                sortClause = Q.sortBy('created_at', Q.desc);
            } else if (options.sortBy === 'area') {
                sortClause = Q.sortBy('area', Q.asc);
            } else {
                sortClause = Q.sortBy('full_name', Q.asc);
            }

            const data = await collection
                .query(Q.where('collector_id', collectorId), sortClause)
                .fetch();
            
            setBorrowers(data);
        } catch (err: any) {
            console.error('[useBorrowers] Error fetching borrowers:', err);
            setError(err?.message ?? 'Failed to fetch borrowers');
            setBorrowers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBorrowers();
    }, [user?.id, options.collectorId, options.sortBy]);

    return {
        borrowers,
        loading,
        error,
        refetch: fetchBorrowers,
    };
}
