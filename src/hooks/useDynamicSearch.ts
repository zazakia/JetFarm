import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    flexibleSearch,
    SearchKey,
    FilterCondition,
    FlexibleSearchResult,
} from '../utils/flexibleSearch';

export interface UseDynamicSearchProps<T> {
    data: T[];
    searchKeys: SearchKey<T>[];
    categories?: string[];
    categoryKey?: keyof T | ((item: T) => string);
    initialCategory?: string;
    initialQuery?: string;
    debounceMs?: number;
    filters?: FilterCondition<T>[] | Record<string, any>;
    customFilter?: (item: T, query: string, category: string) => boolean;
    limit?: number;
    matchMode?: 'all' | 'any';
}

export interface UseDynamicSearchReturn<T> {
    query: string;
    setQuery: (q: string) => void;
    debouncedQuery: string;
    selectedCategory: string;
    setSelectedCategory: (cat: string) => void;
    categories: string[];
    filteredData: T[];
    searchResults: FlexibleSearchResult<T>[];
    resultCount: number;
    isSearching: boolean;
    isDebouncing: boolean;
    setFilter: (key: string, value: any) => void;
    clearSearch: () => void;
    reset: () => void;
}

export function useDynamicSearch<T>(props: UseDynamicSearchProps<T>): UseDynamicSearchReturn<T> {
    const {
        data = [],
        searchKeys,
        categories = ['All'],
        categoryKey,
        initialCategory = 'All',
        initialQuery = '',
        debounceMs = 200,
        filters: initialExternalFilters,
        customFilter,
        limit,
        matchMode = 'all',
    } = props;

    const [query, setQuery] = useState<string>(initialQuery);
    const [debouncedQuery, setDebouncedQuery] = useState<string>(initialQuery);
    const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
    const [dynamicFilters, setDynamicFilters] = useState<Record<string, any>>({});

    // Debounce query changes
    useEffect(() => {
        if (debounceMs <= 0 || query === '') {
            setDebouncedQuery(query);
            return;
        }

        const handler = setTimeout(() => {
            setDebouncedQuery(query);
        }, debounceMs);

        return () => {
            clearTimeout(handler);
        };
    }, [query, debounceMs]);

    const setFilter = useCallback((key: string, value: any) => {
        setDynamicFilters(prev => ({
            ...prev,
            [key]: value,
        }));
    }, []);

    const clearSearch = useCallback(() => {
        setQuery('');
        setDebouncedQuery('');
        setSelectedCategory('All');
        setDynamicFilters({});
    }, []);

    const reset = clearSearch;

    // Build combined filters
    const combinedFilters = useMemo(() => {
        const filtersList: FilterCondition<T>[] = [];

        // 1. External filter conditions
        if (initialExternalFilters) {
            if (Array.isArray(initialExternalFilters)) {
                filtersList.push(...initialExternalFilters);
            } else {
                for (const [k, v] of Object.entries(initialExternalFilters)) {
                    filtersList.push({ field: k as any, operator: 'equals', value: v });
                }
            }
        }

        // 2. Dynamic internal filter states
        for (const [k, v] of Object.entries(dynamicFilters)) {
            if (v !== undefined && v !== null && v !== 'all') {
                filtersList.push({ field: k as any, operator: 'equals', value: v });
            }
        }

        // 3. Category filter
        if (categoryKey && selectedCategory && selectedCategory.toLowerCase() !== 'all') {
            filtersList.push({
                predicate: (item: T) => {
                    if (typeof categoryKey === 'function') {
                        return String(categoryKey(item)).toLowerCase() === selectedCategory.toLowerCase();
                    }
                    const val = (item as any)[categoryKey];
                    return String(val).toLowerCase() === selectedCategory.toLowerCase();
                },
            });
        }

        // 4. Custom filter predicate
        if (customFilter) {
            filtersList.push({
                predicate: (item: T) => customFilter(item, debouncedQuery, selectedCategory),
            });
        }

        return filtersList;
    }, [initialExternalFilters, dynamicFilters, categoryKey, selectedCategory, customFilter, debouncedQuery]);

    // Perform flexible search
    const searchResults = useMemo(() => {
        return flexibleSearch(data, debouncedQuery, {
            keys: searchKeys,
            matchMode,
            filters: combinedFilters,
            limit,
            sortBy: 'relevance',
        });
    }, [data, debouncedQuery, searchKeys, matchMode, combinedFilters, limit]);

    const filteredData = useMemo(() => {
        return searchResults.map(r => r.item);
    }, [searchResults]);

    const isSearching =
        query.trim() !== '' ||
        (selectedCategory.toLowerCase() !== 'all' && selectedCategory.trim() !== '') ||
        Object.keys(dynamicFilters).length > 0;

    const isDebouncing = query !== debouncedQuery;

    return {
        query,
        setQuery,
        debouncedQuery,
        selectedCategory,
        setSelectedCategory,
        categories,
        filteredData,
        searchResults,
        resultCount: searchResults.length,
        isSearching,
        isDebouncing,
        setFilter,
        clearSearch,
        reset,
    };
}
