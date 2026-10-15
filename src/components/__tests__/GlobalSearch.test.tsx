import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { GlobalSearch } from '../GlobalSearch';
import BaseModelService from '../../services/BaseModelService';
import { setDeploymentMode, resetDeploymentMode } from '../../config/deployment';

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

    it('finds Agribusiness Outgrower Platform items in search results', async () => {
        const { getByPlaceholderText, getByText } = render(
            <GlobalSearch onNavigate={mockOnNavigate} />
        );
        await act(async () => {});

        const input = getByPlaceholderText('Search menus & reports...');
        await act(async () => {
            fireEvent(input, 'focus');
            fireEvent.changeText(input, 'Harvest');
        });

        await waitFor(() => {
            expect(getByText('Harvest Scale Terminal')).toBeTruthy();
        });
    });

    it('does NOT return Crispy King Store Operations in search results in agribusiness mode', async () => {
        setDeploymentMode('agri');
        try {
            const { getByPlaceholderText, queryByText } = render(
                <GlobalSearch onNavigate={mockOnNavigate} />
            );
            await act(async () => {});

            const input = getByPlaceholderText('Search menus & reports...');
            await act(async () => {
                fireEvent(input, 'focus');
                fireEvent.changeText(input, 'Touch POS Terminal');
            });

            await waitFor(() => {
                expect(queryByText('Touch POS Terminal')).toBeNull();
            });
        } finally {
            resetDeploymentMode();
        }
    });

    it('matches items across different fields using multi-token search', async () => {
        const { getByPlaceholderText, getByText } = render(
            <GlobalSearch onNavigate={mockOnNavigate} />
        );
        await act(async () => {});

        const input = getByPlaceholderText('Search menus & reports...');
        await act(async () => {
            fireEvent(input, 'focus');
            fireEvent.changeText(input, 'Santos Maria');
        });

        await waitFor(() => {
            expect(getByText('Maria Santos')).toBeTruthy();
        });
    });

    it('filters results by category tab', async () => {
        const { getByPlaceholderText, getByText, queryByText } = render(
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

        // Click Menus tab
        const menusTab = getByText('Menus');
        await act(async () => {
            fireEvent.press(menusTab);
        });

        // Under Menus tab, Maria Santos (a borrower) is excluded
        expect(queryByText('Maria Santos')).toBeNull();

        // Click Borrowers tab
        const borrowersTab = getByText('Borrowers');
        await act(async () => {
            fireEvent.press(borrowersTab);
        });

        // Under Borrowers tab, Maria Santos is visible again
        expect(getByText('Maria Santos')).toBeTruthy();
    });
});

