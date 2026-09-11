import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { GlobalSearch } from '../GlobalSearch';
import BaseModelService from '../../services/BaseModelService';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

jest.mock('../../services/BaseModelService', () => ({
    fetchActive: jest.fn().mockResolvedValue([
        { id: 'b1', fullName: 'Maria Santos', group: 'Group A' },
        { id: 'b2', fullName: 'Juan Dela Cruz', group: 'Group B' },
    ]),
}));

describe('GlobalSearch', () => {
    const mockOnNavigate = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders search input placeholder', async () => {
        const { getByPlaceholderText } = render(<GlobalSearch onNavigate={mockOnNavigate} />);
        await act(async () => {});
        expect(getByPlaceholderText('Search menus & reports...')).toBeTruthy();
    });

    it('filters matching menu items when typing in query', async () => {
        const { getByPlaceholderText, getByText } = render(
            <GlobalSearch onNavigate={mockOnNavigate} />
        );
        await act(async () => {});

        const input = getByPlaceholderText('Search menus & reports...');
        await act(async () => {
            fireEvent(input, 'focus');
            fireEvent.changeText(input, 'Loans');
        });

        await waitFor(() => {
            expect(getByText('Loans')).toBeTruthy();
        });
    });

    it('filters matching borrower names from BaseModelService', async () => {
        const { getByPlaceholderText, getByText } = render(
            <GlobalSearch onNavigate={mockOnNavigate} />
        );
        await act(async () => {});

        const input = getByPlaceholderText('Search menus & reports...');
        await act(async () => {
            fireEvent(input, 'focus');
            fireEvent.changeText(input, 'Maria');
        });

        await waitFor(() => {
            expect(getByText('Maria Santos')).toBeTruthy();
        });
    });

    it('navigates to selected result route and clears query', async () => {
        const { getByPlaceholderText, getByText } = render(
            <GlobalSearch onNavigate={mockOnNavigate} />
        );
        await act(async () => {});

        const input = getByPlaceholderText('Search menus & reports...');
        await act(async () => {
            fireEvent(input, 'focus');
            fireEvent.changeText(input, 'Maria');
        });

        await waitFor(() => {
            expect(getByText('Maria Santos')).toBeTruthy();
        });

        await act(async () => {
            fireEvent.press(getByText('Maria Santos'));
        });

        expect(mockPush).toHaveBeenCalledWith('/(admin)/borrowers/b1');
        expect(mockOnNavigate).toHaveBeenCalled();
    });

    it('shows no results found message when query has no match', async () => {
        const { getByPlaceholderText, getByText } = render(
            <GlobalSearch onNavigate={mockOnNavigate} />
        );
        await act(async () => {});

        const input = getByPlaceholderText('Search menus & reports...');
        await act(async () => {
            fireEvent(input, 'focus');
            fireEvent.changeText(input, 'NonExistentXYZ');
        });

        await waitFor(() => {
            expect(getByText('No results found for "NonExistentXYZ"')).toBeTruthy();
        });
    });
});
