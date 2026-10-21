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

// The search reads two entity tables now: borrowers and loans went with the lending teardown, and
// BaseModelService throws on a collection the WatermelonDB schema no longer declares.
jest.mock('../../services/BaseModelService', () => ({
    fetchActive: jest.fn().mockImplementation((table: string) => {
        if (table === 'agri_parcels') {
            return Promise.resolve([
                { id: 'p1', name: 'Bagacay Parcel One', areaHectares: 4.5, soilType: 'Clay Loam', code: 'PAR-001', status: 'Active' },
                { id: 'p2', name: 'Daro Crossing Plot', areaHectares: 2.1, soilType: 'Sandy Loam', status: 'Fallowed' },
            ]);
        }
        if (table === 'agri_farm_expenses') {
            return Promise.resolve([
                { id: 'e1', description: 'Organic Fertilizer Batch 4', amount: 18500, category: 'Farm Input' },
            ]);
        }
        return Promise.resolve([]);
    }),
}));

const input = (getByPlaceholderText: (t: string) => any) => getByPlaceholderText('Search menus & reports...');

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

        await act(async () => {
            fireEvent(input(getByPlaceholderText), 'focus');
            fireEvent.changeText(input(getByPlaceholderText), 'Balance Sheet');
        });

        await waitFor(() => {
            expect(getByText('Balance Sheet')).toBeTruthy();
        });
    });

    it('filters matching parcel names from BaseModelService', async () => {
        const { getByPlaceholderText, getByText } = render(
            <GlobalSearch onNavigate={mockOnNavigate} />
        );
        await act(async () => {});

        await act(async () => {
            fireEvent(input(getByPlaceholderText), 'focus');
            fireEvent.changeText(input(getByPlaceholderText), 'Bagacay');
        });

        await waitFor(() => {
            expect(getByText('Bagacay Parcel One')).toBeTruthy();
        });
    });

    it('navigates to selected result route and clears query', async () => {
        const { getByPlaceholderText, getByText } = render(
            <GlobalSearch onNavigate={mockOnNavigate} />
        );
        await act(async () => {});

        await act(async () => {
            fireEvent(input(getByPlaceholderText), 'focus');
            fireEvent.changeText(input(getByPlaceholderText), 'Bagacay');
        });

        await waitFor(() => {
            expect(getByText('Bagacay Parcel One')).toBeTruthy();
        });

        await act(async () => {
            fireEvent.press(getByText('Bagacay Parcel One'));
        });

        expect(mockPush).toHaveBeenCalledWith('/(admin)/agribusiness/parcels');
        expect(mockOnNavigate).toHaveBeenCalled();
    });

    it('shows no results found message when query has no match', async () => {
        const { getByPlaceholderText, getByText } = render(
            <GlobalSearch onNavigate={mockOnNavigate} />
        );
        await act(async () => {});

        await act(async () => {
            fireEvent(input(getByPlaceholderText), 'focus');
            fireEvent.changeText(input(getByPlaceholderText), 'NonExistentXYZ');
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

        await act(async () => {
            fireEvent(input(getByPlaceholderText), 'focus');
            fireEvent.changeText(input(getByPlaceholderText), 'Harvest');
        });

        await waitFor(() => {
            expect(getByText('Harvest Scale Terminal')).toBeTruthy();
        });
    });

    it('returns no POS, franchise or lending row', async () => {
        // Those menu arrays are deleted, so this is absent-by-construction rather than mode-gated.
        const { getByPlaceholderText, queryByText } = render(
            <GlobalSearch onNavigate={mockOnNavigate} />
        );
        await act(async () => {});

        for (const term of ['Touch POS Terminal', 'Borrowers & Members', 'Franchise Agreements CRM', 'Loan Accounts']) {
            await act(async () => {
                fireEvent(input(getByPlaceholderText), 'focus');
                fireEvent.changeText(input(getByPlaceholderText), term);
            });
            expect(queryByText(term)).toBeNull();
        }
    });

    it('matches items across different fields using multi-token search', async () => {
        const { getByPlaceholderText, getByText } = render(
            <GlobalSearch onNavigate={mockOnNavigate} />
        );
        await act(async () => {});

        await act(async () => {
            fireEvent(input(getByPlaceholderText), 'focus');
            fireEvent.changeText(input(getByPlaceholderText), 'PAR-001 Clay');
        });

        await waitFor(() => {
            expect(getByText('Bagacay Parcel One')).toBeTruthy();
        });
    });

    it('searches farm expenses by description and amount', async () => {
        const { getByPlaceholderText, getByText } = render(
            <GlobalSearch onNavigate={mockOnNavigate} />
        );
        await act(async () => {});

        await act(async () => {
            fireEvent(input(getByPlaceholderText), 'focus');
            fireEvent.changeText(input(getByPlaceholderText), 'Fertilizer');
        });

        await waitFor(() => {
            expect(getByText('Organic Fertilizer Batch 4')).toBeTruthy();
        });
    });

    it('filters results by category tab', async () => {
        const { getByPlaceholderText, getByText, queryByText } = render(
            <GlobalSearch onNavigate={mockOnNavigate} />
        );
        await act(async () => {});

        await act(async () => {
            fireEvent(input(getByPlaceholderText), 'focus');
            fireEvent.changeText(input(getByPlaceholderText), 'Bagacay');
        });

        await waitFor(() => {
            expect(getByText('Bagacay Parcel One')).toBeTruthy();
        });

        // Click Menus tab
        const menusTab = getByText('Menus');
        await act(async () => {
            fireEvent.press(menusTab);
        });

        // Under Menus tab, the parcel is excluded
        expect(queryByText('Bagacay Parcel One')).toBeNull();

        // Click Parcels tab
        const parcelsTab = getByText('Parcels');
        await act(async () => {
            fireEvent.press(parcelsTab);
        });

        // Under Parcels tab, it is visible again
        expect(getByText('Bagacay Parcel One')).toBeTruthy();
    });

    it('offers only the surviving entity categories as tabs', async () => {
        const { getByPlaceholderText, getByText, queryByText } = render(
            <GlobalSearch onNavigate={mockOnNavigate} showCategoryChips />
        );
        await act(async () => {});

        await act(async () => {
            fireEvent(input(getByPlaceholderText), 'focus');
            fireEvent.changeText(input(getByPlaceholderText), 'Bagacay');
        });
        await waitFor(() => {
            expect(getByText('Parcels')).toBeTruthy();
        });

        expect(queryByText('Borrowers')).toBeNull();
        expect(queryByText('Loan Accounts')).toBeNull();
    });
});
