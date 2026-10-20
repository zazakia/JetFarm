import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useFeatureFlags } from '../useSettingsConfig';
import { SettingsService } from '../../services/SettingsService';

describe('useFeatureFlags reactive subscription', () => {
    let subscriberCallback: ((flags: Record<string, boolean>) => void) | null = null;
    const unsubscribeMock = jest.fn();

    beforeEach(() => {
        subscriberCallback = null;
        unsubscribeMock.mockClear();

        jest.spyOn(SettingsService, 'getFeatureFlagMap').mockResolvedValue({
            'module.loans': true,
            'module.payroll': false,
        });

        jest.spyOn(SettingsService as any, 'subscribeToFeatureFlags').mockImplementation((cb: any) => {
            subscriberCallback = cb;
            return unsubscribeMock;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('subscribes on mount and unregisters on unmount', async () => {
        const { result, unmount } = renderHook(() => useFeatureFlags());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.flags).toEqual({
            'module.loans': true,
            'module.payroll': false,
        });
        expect(result.current.isEnabled('module.loans')).toBe(true);
        expect(result.current.isEnabled('module.payroll')).toBe(false);

        expect(subscriberCallback).toBeTruthy();

        unmount();
        expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });

    it('reactively updates flags when listener receives changes', async () => {
        const { result } = renderHook(() => useFeatureFlags());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.isEnabled('module.payroll')).toBe(false);

        // Simulate reactive database/sync update
        act(() => {
            subscriberCallback?.({
                'module.loans': true,
                'module.payroll': true,
                'module.accounting': true,
            });
        });

        expect(result.current.isEnabled('module.payroll')).toBe(true);
        expect(result.current.flags['module.accounting']).toBe(true);
    });
});
