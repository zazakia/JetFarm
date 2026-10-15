import { renderHook, act } from '@testing-library/react-native';
import { useDynamicSearch } from '../useDynamicSearch';

describe('useDynamicSearch hook', () => {
    interface TestItem {
        id: string;
        name: string;
        category: string;
        amount: number;
    }

    const mockItems: TestItem[] = [
        { id: '1', name: 'Fertilizer Urea', category: 'Inputs', amount: 1200 },
        { id: '2', name: 'Cassava Seedlings', category: 'Planting', amount: 3500 },
        { id: '3', name: 'Tractor Fuel', category: 'Inputs', amount: 5000 },
        { id: '4', name: 'Herbicide Glyphosate', category: 'Chemicals', amount: 800 },
    ];

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('initializes with default query and categories', () => {
        const { result } = renderHook(() =>
            useDynamicSearch({
                data: mockItems,
                searchKeys: ['name', 'category'],
                categories: ['All', 'Inputs', 'Planting', 'Chemicals'],
                debounceMs: 100,
            })
        );

        expect(result.current.query).toBe('');
        expect(result.current.selectedCategory).toBe('All');
        expect(result.current.filteredData.length).toBe(4);
        expect(result.current.isSearching).toBe(false);
    });

    it('filters data by category selection', () => {
        const { result } = renderHook(() =>
            useDynamicSearch({
                data: mockItems,
                searchKeys: ['name'],
                categories: ['All', 'Inputs', 'Planting', 'Chemicals'],
                categoryKey: 'category',
                debounceMs: 100,
            })
        );

        act(() => {
            result.current.setSelectedCategory('Inputs');
        });

        expect(result.current.selectedCategory).toBe('Inputs');
        expect(result.current.filteredData.length).toBe(2);
        expect(result.current.filteredData.map(i => i.name)).toEqual([
            'Fertilizer Urea',
            'Tractor Fuel',
        ]);
        expect(result.current.isSearching).toBe(true);
    });

    it('debounces query input and filters results dynamically', () => {
        const { result } = renderHook(() =>
            useDynamicSearch({
                data: mockItems,
                searchKeys: ['name'],
                debounceMs: 200,
            })
        );

        act(() => {
            result.current.setQuery('Urea');
        });

        // Immediately before timer expires, query is updated but debouncedQuery is still empty
        expect(result.current.query).toBe('Urea');
        expect(result.current.debouncedQuery).toBe('');

        // Fast forward timers
        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(result.current.debouncedQuery).toBe('Urea');
        expect(result.current.filteredData.length).toBe(1);
        expect(result.current.filteredData[0].name).toBe('Fertilizer Urea');
    });

    it('resets query and selected category on clearSearch', () => {
        const { result } = renderHook(() =>
            useDynamicSearch({
                data: mockItems,
                searchKeys: ['name'],
                categories: ['All', 'Inputs'],
                categoryKey: 'category',
                debounceMs: 100,
            })
        );

        act(() => {
            result.current.setQuery('Seedlings');
            result.current.setSelectedCategory('Inputs');
            jest.advanceTimersByTime(100);
        });

        act(() => {
            result.current.clearSearch();
            jest.advanceTimersByTime(100);
        });

        expect(result.current.query).toBe('');
        expect(result.current.debouncedQuery).toBe('');
        expect(result.current.selectedCategory).toBe('All');
        expect(result.current.filteredData.length).toBe(4);
    });

    it('supports custom dynamic filters', () => {
        const { result } = renderHook(() =>
            useDynamicSearch({
                data: mockItems,
                searchKeys: ['name'],
                debounceMs: 50,
            })
        );

        act(() => {
            result.current.setFilter('minAmount', 2000);
            jest.advanceTimersByTime(50);
        });

        // custom filter callback can filter
        const customFilteredHook = renderHook(() =>
            useDynamicSearch({
                data: mockItems,
                searchKeys: ['name'],
                debounceMs: 50,
                customFilter: (item) => item.amount >= 2000,
            })
        );

        expect(customFilteredHook.result.current.filteredData.length).toBe(2);
        expect(customFilteredHook.result.current.filteredData.map(i => i.name)).toEqual([
            'Cassava Seedlings',
            'Tractor Fuel',
        ]);
    });
});
