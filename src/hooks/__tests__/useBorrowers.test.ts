import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useBorrowers } from '../useBorrowers';
import { useAuthStore } from '../../stores/authStore';

// Mock dependencies
const mockFetch = jest.fn();
const mockQuery = jest.fn().mockReturnValue({ fetch: mockFetch });

jest.mock('../../database', () => ({
    database: {
        collections: {
            get: jest.fn(() => ({
                query: mockQuery,
            })),
        },
    },
}));

jest.mock('../../stores/authStore', () => ({
    useAuthStore: jest.fn(() => ({
        user: { id: 'user-1' },
    })),
}));

describe('useBorrowers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockReturnValue({ fetch: mockFetch });
        mockFetch.mockResolvedValue([]);
        (useAuthStore as unknown as jest.Mock).mockReturnValue({
            user: { id: 'user-1' },
        });
    });

    it('returns borrowers when user is authenticated', async () => {
        const mockBorrowers = [
            { id: 'b-1', fullName: 'Alice' },
            { id: 'b-2', fullName: 'Bob' },
        ];
        mockFetch.mockResolvedValue(mockBorrowers);

        const { result } = renderHook(() => useBorrowers());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.borrowers).toEqual(mockBorrowers);
        expect(result.current.error).toBeNull();
    });

    it('sets error when no collector ID is available', async () => {
        (useAuthStore as unknown as jest.Mock).mockReturnValue({
            user: null,
        });

        const { result } = renderHook(() => useBorrowers());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe('No collector ID available');
        expect(result.current.borrowers).toEqual([]);
    });

    it('uses provided collectorId over user id', async () => {
        const mockBorrowers = [{ id: 'b-1' }];
        mockFetch.mockResolvedValue(mockBorrowers);

        const { result } = renderHook(() =>
            useBorrowers({ collectorId: 'custom-collector' })
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.borrowers).toEqual(mockBorrowers);
    });

    it('handles sort by date', async () => {
        mockFetch.mockResolvedValue([]);

        const { result } = renderHook(() =>
            useBorrowers({ sortBy: 'date' })
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockQuery).toHaveBeenCalled();
    });

    it('handles sort by area', async () => {
        mockFetch.mockResolvedValue([]);

        const { result } = renderHook(() =>
            useBorrowers({ sortBy: 'area' })
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockQuery).toHaveBeenCalled();
    });

    it('handles sort by name (default)', async () => {
        mockFetch.mockResolvedValue([]);

        const { result } = renderHook(() =>
            useBorrowers({ sortBy: 'name' })
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockQuery).toHaveBeenCalled();
    });

    it('sets error state on fetch failure', async () => {
        mockFetch.mockRejectedValue(new Error('DB connection lost'));

        const { result } = renderHook(() => useBorrowers());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe('DB connection lost');
        expect(result.current.borrowers).toEqual([]);
    });

    it('provides refetch function', async () => {
        mockFetch.mockResolvedValue([{ id: 'b-1' }]);

        const { result } = renderHook(() => useBorrowers());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // Update mock data
        mockFetch.mockResolvedValue([{ id: 'b-1' }, { id: 'b-2' }]);

        await act(async () => {
            await result.current.refetch();
        });

        expect(result.current.borrowers).toHaveLength(2);
    });
});
