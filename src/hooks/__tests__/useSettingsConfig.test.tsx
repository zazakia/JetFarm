import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useLoanProductPresets, useFeatureFlags, useRolePermissions } from '../useSettingsConfig';
import { SettingsService } from '../../services/SettingsService';
import { LOAN_PRODUCT_PRESETS } from '../../utils/loanProducts';

// Mock SettingsService
jest.mock('../../services/SettingsService', () => ({
    SettingsService: {
        getLoanProductPresetMap: jest.fn(),
        getFeatureFlagMap: jest.fn(),
        getRolePermissionMap: jest.fn(),
    },
}));

// Helper to get typed mock for any SettingsService method
const mockPresetMap = () => SettingsService.getLoanProductPresetMap as jest.Mock;
const mockFeatureMap = () => SettingsService.getFeatureFlagMap as jest.Mock;
const mockPermMap = () => SettingsService.getRolePermissionMap as jest.Mock;

// ---------------------------------------------------------------------------
// useLoanProductPresets
// ---------------------------------------------------------------------------
describe('useLoanProductPresets', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPresetMap().mockResolvedValue(LOAN_PRODUCT_PRESETS);
    });

    it('starts with loading=true and built-in presets', () => {
        const { result } = renderHook(() => useLoanProductPresets());

        expect(result.current.loading).toBe(true);
        expect(result.current.presets).toEqual(LOAN_PRODUCT_PRESETS);
    });

    it('fetches presets from SettingsService and sets loading=false', async () => {
        const customPresets = {
            ...LOAN_PRODUCT_PRESETS,
            standard: { ...LOAN_PRODUCT_PRESETS.standard, label: 'Custom Standard' },
        };
        mockPresetMap().mockResolvedValue(customPresets);

        const { result } = renderHook(() => useLoanProductPresets());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.presets).toEqual(customPresets);
        expect(mockPresetMap()).toHaveBeenCalledTimes(1);
    });

    it('falls back to built-in presets on fetch error', async () => {
        mockPresetMap().mockRejectedValue(new Error('DB connection lost'));
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const { result } = renderHook(() => useLoanProductPresets());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.presets).toEqual(LOAN_PRODUCT_PRESETS);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[useLoanProductPresets]'),
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });

    it('reload function refetches presets', async () => {
        const firstPresets = { ...LOAN_PRODUCT_PRESETS };
        const secondPresets = {
            ...LOAN_PRODUCT_PRESETS,
            standard: { ...LOAN_PRODUCT_PRESETS.standard, label: 'Updated' },
        };
        mockPresetMap()
            .mockResolvedValueOnce(firstPresets)
            .mockResolvedValueOnce(secondPresets);

        const { result } = renderHook(() => useLoanProductPresets());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
        expect(result.current.presets).toEqual(firstPresets);

        await act(async () => {
            await result.current.reload();
        });

        expect(result.current.presets).toEqual(secondPresets);
        expect(mockPresetMap()).toHaveBeenCalledTimes(2);
    });

    it('reload sets loading back to false after error', async () => {
        mockPresetMap()
            .mockResolvedValueOnce(LOAN_PRODUCT_PRESETS)
            .mockRejectedValueOnce(new Error('Fail on reload'));

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const { result } = renderHook(() => useLoanProductPresets());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.reload();
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.presets).toEqual(LOAN_PRODUCT_PRESETS);
        warnSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// useFeatureFlags
// ---------------------------------------------------------------------------
describe('useFeatureFlags', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFeatureMap().mockResolvedValue({});
    });

    it('starts with loading=true and empty flags', () => {
        const { result } = renderHook(() => useFeatureFlags());

        expect(result.current.loading).toBe(true);
        expect(result.current.flags).toEqual({});
    });

    it('fetches feature flags and sets loading=false', async () => {
        const flags = { dark_mode: true, beta_features: false };
        mockFeatureMap().mockResolvedValue(flags);

        const { result } = renderHook(() => useFeatureFlags());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.flags).toEqual(flags);
        expect(mockFeatureMap()).toHaveBeenCalledTimes(1);
    });

    it('falls back to empty flags on fetch error', async () => {
        mockFeatureMap().mockRejectedValue(new Error('Network error'));
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const { result } = renderHook(() => useFeatureFlags());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.flags).toEqual({});
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[useFeatureFlags]'),
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });

    it('reload function refetches flags', async () => {
        const firstFlags = { flag_a: true };
        const secondFlags = { flag_a: true, flag_b: false };
        mockFeatureMap()
            .mockResolvedValueOnce(firstFlags)
            .mockResolvedValueOnce(secondFlags);

        const { result } = renderHook(() => useFeatureFlags());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
        expect(result.current.flags).toEqual(firstFlags);

        await act(async () => {
            await result.current.reload();
        });

        expect(result.current.flags).toEqual(secondFlags);
        expect(mockFeatureMap()).toHaveBeenCalledTimes(2);
    });

    describe('isEnabled', () => {
        it('returns true when key is undefined', async () => {
            const { result } = renderHook(() => useFeatureFlags());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.isEnabled()).toBe(true);
            expect(result.current.isEnabled(undefined)).toBe(true);
        });

        it('returns true when key is an empty string', async () => {
            const { result } = renderHook(() => useFeatureFlags());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Empty string is falsy, so !key is true -> returns true
            expect(result.current.isEnabled('')).toBe(true);
        });

        it('returns true for enabled flag', async () => {
            mockFeatureMap().mockResolvedValue({ beta: true });

            const { result } = renderHook(() => useFeatureFlags());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.isEnabled('beta')).toBe(true);
        });

        it('returns false for disabled flag (enabled=false)', async () => {
            mockFeatureMap().mockResolvedValue({ beta: false });

            const { result } = renderHook(() => useFeatureFlags());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.isEnabled('beta')).toBe(false);
        });

        it('returns true for unknown flag key (not in map)', async () => {
            mockFeatureMap().mockResolvedValue({ beta: true });

            const { result } = renderHook(() => useFeatureFlags());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // unknown_key not in map -> flags['unknown_key'] is undefined,
            // undefined !== false is true
            expect(result.current.isEnabled('unknown_key')).toBe(true);
        });
    });
});

// ---------------------------------------------------------------------------
// useRolePermissions
// ---------------------------------------------------------------------------
describe('useRolePermissions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPermMap().mockResolvedValue({});
    });

    it('starts with loading=true and empty permissions', () => {
        const { result } = renderHook(() => useRolePermissions('admin'));

        expect(result.current.loading).toBe(true);
        expect(result.current.permissions).toEqual({});
    });

    it('fetches permissions for a given role', async () => {
        const perms = { manage_users: true, delete_records: false };
        mockPermMap().mockResolvedValue(perms);

        const { result } = renderHook(() => useRolePermissions('admin'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.permissions).toEqual(perms);
        expect(mockPermMap()).toHaveBeenCalledWith('admin');
    });

    it('falls back to empty permissions on fetch error', async () => {
        mockPermMap().mockRejectedValue(new Error('Permission denied'));
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const { result } = renderHook(() => useRolePermissions('collector'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.permissions).toEqual({});
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[useRolePermissions]'),
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });

    it('reload function refetches permissions', async () => {
        const firstPerms = { can_edit: true };
        const secondPerms = { can_edit: true, can_delete: false };
        mockPermMap()
            .mockResolvedValueOnce(firstPerms)
            .mockResolvedValueOnce(secondPerms);

        const { result } = renderHook(() => useRolePermissions('admin'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
        expect(result.current.permissions).toEqual(firstPerms);

        await act(async () => {
            await result.current.reload();
        });

        expect(result.current.permissions).toEqual(secondPerms);
        expect(mockPermMap()).toHaveBeenCalledTimes(2);
    });

    it('re-fetches when role changes', async () => {
        mockPermMap().mockResolvedValue({ manage_users: true });

        const { result, rerender } = renderHook(
            ({ role }: { role: string | null | undefined }) => useRolePermissions(role),
            { initialProps: { role: 'admin' as string | null | undefined } }
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
        expect(mockPermMap()).toHaveBeenCalledWith('admin');

        mockPermMap().mockClear();
        mockPermMap().mockResolvedValue({ view_reports: false });

        rerender({ role: 'collector' });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
        expect(mockPermMap()).toHaveBeenCalledWith('collector');
        expect(result.current.permissions).toEqual({ view_reports: false });
    });

    it('handles null role gracefully', async () => {
        mockPermMap().mockResolvedValue({});

        const { result } = renderHook(() => useRolePermissions(null));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockPermMap()).toHaveBeenCalledWith(null);
        expect(result.current.permissions).toEqual({});
    });

    it('handles undefined role gracefully', async () => {
        mockPermMap().mockResolvedValue({});

        const { result } = renderHook(() => useRolePermissions(undefined));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockPermMap()).toHaveBeenCalledWith(undefined);
        expect(result.current.permissions).toEqual({});
    });

    describe('isAllowed', () => {
        it('returns true when key is undefined', async () => {
            mockPermMap().mockResolvedValue({ can_edit: true });

            const { result } = renderHook(() => useRolePermissions('admin'));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.isAllowed()).toBe(true);
            expect(result.current.isAllowed(undefined)).toBe(true);
        });

        it('returns true when key is empty string', async () => {
            const { result } = renderHook(() => useRolePermissions('admin'));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Empty string is falsy, so !key is true -> returns true
            expect(result.current.isAllowed('')).toBe(true);
        });

        it('returns true for allowed permission', async () => {
            mockPermMap().mockResolvedValue({ manage_users: true });

            const { result } = renderHook(() => useRolePermissions('admin'));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.isAllowed('manage_users')).toBe(true);
        });

        it('returns false for denied permission (enabled=false)', async () => {
            mockPermMap().mockResolvedValue({ delete_records: false });

            const { result } = renderHook(() => useRolePermissions('admin'));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.isAllowed('delete_records')).toBe(false);
        });

        it('returns true for unknown permission key', async () => {
            mockPermMap().mockResolvedValue({ can_edit: true });

            const { result } = renderHook(() => useRolePermissions('admin'));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Unknown key is undefined, undefined !== false is true
            expect(result.current.isAllowed('unknown_perm')).toBe(true);
        });

        it('checks action.edit and action.delete permissions correctly', async () => {
            mockPermMap().mockResolvedValue({ 'action.edit': true, 'action.delete': false });

            const { result } = renderHook(() => useRolePermissions('loan_encoder'));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.isAllowed('action.edit')).toBe(true);
            expect(result.current.isAllowed('action.delete')).toBe(false);
        });
    });
});
