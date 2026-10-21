import { useCallback, useEffect, useState } from 'react';
import { SettingsService } from '../services/SettingsService';

import { isAgribusinessFeatureKey } from '../utils/featureFlags';

export function useFeatureFlags() {
    const [flags, setFlags] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            setFlags(await SettingsService.getFeatureFlagMap());
        } catch (error) {
            console.warn('[useFeatureFlags] Falling back to enabled feature flags:', error);
            setFlags({});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void reload();
        if (typeof (SettingsService as any).subscribeToFeatureFlags === 'function') {
            const unsubscribe = (SettingsService as any).subscribeToFeatureFlags((newFlags: Record<string, boolean>) => {
                setFlags(newFlags);
                setLoading(false);
            });
            return () => {
                unsubscribe();
            };
        }
    }, [reload]);

    const isEnabled = useCallback((key?: string) => {
        if (!key) return true;
        if (flags[key] === true) return true;
        if (flags[key] === false) return false;
        // No feature_flags row for the key. Fail open only for the features this build actually
        // ships - a stale row name from a pre-teardown database, or a typo, stays hidden rather
        // than lighting up navigation that has no route behind it.
        return isAgribusinessFeatureKey(key);
    }, [flags]);

    return { flags, loading, reload, isEnabled };
}

export function useRolePermissions(role: string | null | undefined) {
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            setPermissions(await SettingsService.getRolePermissionMap(role));
        } catch (error) {
            console.warn('[useRolePermissions] Falling back to default role permissions:', error);
            setPermissions({});
        } finally {
            setLoading(false);
        }
    }, [role]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const isAllowed = useCallback((key?: string) => {
        if (!key) return true;
        return permissions[key] !== false;
    }, [permissions]);

    return { permissions, loading, reload, isAllowed };
}
