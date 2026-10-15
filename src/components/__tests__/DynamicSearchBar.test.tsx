import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { DynamicSearchBar } from '../DynamicSearchBar';

describe('DynamicSearchBar component', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('renders search input with placeholder and accessibility colors', () => {
        const onChangeText = jest.fn();
        const { getByPlaceholderText } = render(
            <DynamicSearchBar
                value=""
                onChangeText={onChangeText}
                placeholder="Search parcels, loans, expenses..."
            />
        );

        const input = getByPlaceholderText('Search parcels, loans, expenses...');
        expect(input).toBeTruthy();
        expect(input.props.placeholderTextColor).toBe('#9CA3AF');
    });

    it('handles typing and clear button correctly', () => {
        const onChangeText = jest.fn();
        const onClear = jest.fn();
        const { getByPlaceholderText, getByTestId, rerender } = render(
            <DynamicSearchBar
                value=""
                onChangeText={onChangeText}
                onClear={onClear}
            />
        );

        const input = getByPlaceholderText('Search...');
        fireEvent.changeText(input, 'Cassava');
        expect(onChangeText).toHaveBeenCalledWith('Cassava');

        // Rerender with value
        rerender(
            <DynamicSearchBar
                value="Cassava"
                onChangeText={onChangeText}
                onClear={onClear}
            />
        );

        const clearBtn = getByTestId('dynamic-search-clear');
        fireEvent.press(clearBtn);

        expect(onChangeText).toHaveBeenCalledWith('');
        expect(onClear).toHaveBeenCalled();
    });

    it('renders category chips and handles category selection', () => {
        const onChangeText = jest.fn();
        const onSelectCategory = jest.fn();
        const categories = ['All', 'Parcels', 'Loans', 'Expenses'];

        const { getByText } = render(
            <DynamicSearchBar
                value=""
                onChangeText={onChangeText}
                categories={categories}
                selectedCategory="All"
                onSelectCategory={onSelectCategory}
            />
        );

        expect(getByText('All')).toBeTruthy();
        expect(getByText('Parcels')).toBeTruthy();
        expect(getByText('Loans')).toBeTruthy();
        expect(getByText('Expenses')).toBeTruthy();

        fireEvent.press(getByText('Parcels'));
        expect(onSelectCategory).toHaveBeenCalledWith('Parcels');
    });

    it('debounces onChangeText callback when onDebouncedChangeText is provided', () => {
        const onChangeText = jest.fn();
        const onDebouncedChangeText = jest.fn();

        const { getByPlaceholderText } = render(
            <DynamicSearchBar
                value=""
                onChangeText={onChangeText}
                onDebouncedChangeText={onDebouncedChangeText}
                debounceMs={250}
            />
        );

        const input = getByPlaceholderText('Search...');
        fireEvent.changeText(input, 'Harvest');

        expect(onChangeText).toHaveBeenCalledWith('Harvest');
        expect(onDebouncedChangeText).not.toHaveBeenCalled();

        act(() => {
            jest.advanceTimersByTime(250);
        });

        expect(onDebouncedChangeText).toHaveBeenCalledWith('Harvest');
    });

    it('renders filter button when showFilterButton is true', () => {
        const onFilterPress = jest.fn();
        const { getByTestId, getByText } = render(
            <DynamicSearchBar
                value=""
                onChangeText={jest.fn()}
                showFilterButton={true}
                filterBadgeCount={2}
                onFilterPress={onFilterPress}
            />
        );

        const filterBtn = getByTestId('dynamic-search-filter-button');
        expect(filterBtn).toBeTruthy();
        expect(getByText('2')).toBeTruthy();

        fireEvent.press(filterBtn);
        expect(onFilterPress).toHaveBeenCalled();
    });
});
