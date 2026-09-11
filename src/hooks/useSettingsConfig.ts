import { useCallback, useEffect, useState } from 'react';
import { SettingsService } from '../services/SettingsService';
import { LoanProductPreset, LoanProductType, LOAN_PRODUCT_PRESETS } from '../utils/loanProducts';

export function useLoanProductPresets() {
    const [presets, setPresets] = useState<Record<LoanProductType, LoanProductPreset>>(LOAN_PRODUCT_PRESETS);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            setPresets(await SettingsService.getLoanProductPresetMap());
        } catch (error) {
            console.warn('[useLoanProductPresets] Falling back to built-in loan products:', error);
            setPresets(LOAN_PRODUCT_PRESETS);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    return { presets, loading, reload };
}

import { isLendingFeatureKey } from '../utils/featureFlags';

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
        if (flags['system.lending'] === false && isLendingFeatureKey(key)) {
            return false;
        }
        return flags[key] !== false;
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
