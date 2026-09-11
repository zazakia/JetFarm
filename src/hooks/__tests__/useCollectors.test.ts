import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useCollectors } from '../useCollectors';

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

describe('useCollectors', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockReturnValue({ fetch: mockFetch });
        mockFetch.mockResolvedValue([]);
    });

    it('returns empty list initially while loading', async () => {
        mockFetch.mockResolvedValue([]);
        const { result } = renderHook(() => useCollectors());
        expect(result.current.loading).toBe(true);
        expect(result.current.collectors).toEqual([]);

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
    });

    it('fetches and returns collectors sorted by name', async () => {
        const mockProfiles = [
            { id: 'c-2', fullName: 'Zoe', email: 'zoe@test.com' },
            { id: 'c-1', fullName: 'Alice', email: 'alice@test.com' },
        ];
        mockFetch.mockResolvedValue(mockProfiles);

        const { result } = renderHook(() => useCollectors());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.collectors).toEqual([
            { id: 'c-1', name: 'Alice', email: 'alice@test.com' },
            { id: 'c-2', name: 'Zoe', email: 'zoe@test.com' },
        ]);
        expect(result.current.error).toBeNull();
    });

    it('handles empty response', async () => {
        mockFetch.mockResolvedValue([]);

        const { result } = renderHook(() => useCollectors());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.collectors).toEqual([]);
    });

    it('sets error state on fetch failure', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useCollectors());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe('Network error');
        expect(result.current.collectors).toEqual([]);
    });

    it('provides refetch function that refreshes data', async () => {
        mockFetch.mockResolvedValue([
            { id: 'c-1', fullName: 'Alice', email: 'alice@test.com' },
        ]);

        const { result } = renderHook(() => useCollectors());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.collectors).toHaveLength(1);

        // Add another collector
        mockFetch.mockResolvedValue([
            { id: 'c-1', fullName: 'Alice', email: 'alice@test.com' },
            { id: 'c-2', fullName: 'Bob', email: 'bob@test.com' },
        ]);

        await act(async () => {
            await result.current.refetch();
        });

        expect(result.current.collectors).toHaveLength(2);
    });

    it('handles error message from non-standard error', async () => {
        mockFetch.mockRejectedValue({ code: 'UNKNOWN' });

        const { result } = renderHook(() => useCollectors());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe('Failed to fetch collectors');
    });
});
