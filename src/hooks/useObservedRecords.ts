import { useCallback, useEffect, useState } from 'react';
import { Observable } from 'rxjs';

interface UseObservedRecordsOptions<T> {
    /**
     * The query chain to follow, built by the caller inside useMemo. Pass null when there is
     * nothing to observe yet (no resolved user id, for example).
     */
    records$: Observable<T> | null;
    /** Value used before the first emission and while records$ is null. Must be a stable reference. */
    empty: T;
    /** Prefix for the console line when observation fails, e.g. the hook name. */
    label: string;
    /** Work a data subscription cannot do on its own, e.g. a sync pass behind pull-to-refresh. */
    onRefresh?: () => void | Promise<void>;
}

/**
 * Subscribes to an observed WatermelonDB query chain and keeps `records` current. Reads arrive on
 * their own, so pull-to-refresh has nothing to refetch and only runs the caller's task.
 */
export function useObservedRecords<T>({
    records$,
    empty,
    label,
    onRefresh,
}: UseObservedRecordsOptions<T>) {
    const [records, setRecords] = useState<T>(empty);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (!records$) {
            setRecords(empty);
            setLoading(false);
            return;
        }

        const subscription = records$.subscribe({
            next: (value) => {
                setRecords(value);
                setLoading(false);
                setRefreshing(false);
            },
            error: (error) => {
                console.error(`[${label}] Observation failed`, error);
                setLoading(false);
                setRefreshing(false);
            },
        });

        return () => subscription.unsubscribe();
    }, [records$, empty, label]);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await onRefresh?.();
        } catch (error) {
            console.error(`[${label}] Refresh task failed`, error);
        } finally {
            setRefreshing(false);
        }
    }, [label, onRefresh]);

    return { records, loading, refreshing, refresh };
}
