import { useEffect, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import UserProfile from '../database/models/UserProfile';

interface UseCollectorsOptions {
    includeAll?: boolean;
}

interface CollectorOption {
    id: string;
    name: string;
    email?: string;
}

/**
 * Hook to fetch all collectors (users with role = 'collector')
 * Prefers local WatermelonDB cache, can fallback to Supabase if needed
 */
export function useCollectors(options: UseCollectorsOptions = {}) {
    const [collectors, setCollectors] = useState<CollectorOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCollectors = async () => {
        try {
            setLoading(true);
            setError(null);

            const collection = database.collections.get<UserProfile>('user_profiles');
            const query = collection.query(
                Q.where('role', 'collector'),
                Q.where('is_active', true)
            );

            const profiles = await query.fetch();

            const collectorList: CollectorOption[] = profiles.map(p => ({
                id: p.id,
                name: p.fullName,
                email: p.email,
            }));

            // Sort by name
            collectorList.sort((a, b) => a.name.localeCompare(b.name));

            setCollectors(collectorList);
        } catch (err: any) {
            console.error('[useCollectors] Error fetching collectors:', err);
            setError(err?.message ?? 'Failed to fetch collectors');
            setCollectors([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCollectors();
    }, []);

    return {
        collectors,
        loading,
        error,
        refetch: fetchCollectors,
    };
}
