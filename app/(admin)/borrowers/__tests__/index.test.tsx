import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react-native';
import BorrowersListScreen from '../index';
import { database } from '../../../../src/database';
import BaseModelService from '../../../../src/services/BaseModelService';

if (typeof window !== 'undefined' && typeof window.dispatchEvent !== 'function') {
    (window as any).dispatchEvent = jest.fn();
}

const mockPush = jest.fn();

jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const { Text } = require('react-native');
    return {
        MaterialIcons: ({ name }: any) => React.createElement(Text, null, name),
        Ionicons: ({ name }: any) => React.createElement(Text, null, name),
    };
});

jest.mock('@nozbe/watermelondb', () => ({
    Q: {
        where: jest.fn().mockImplementation((field, value) => ({ type: 'where', field, value })),
        on: jest.fn().mockReturnValue({}),
        and: jest.fn().mockReturnValue({}),
        or: jest.fn().mockImplementation((...conditions) => ({ type: 'or', conditions })),
        sortBy: jest.fn().mockReturnValue({}),
        asc: 'asc',
        desc: 'desc',
        gte: jest.fn().mockImplementation(value => ({ type: 'gte', value })),
        eq: jest.fn().mockImplementation(value => ({ type: 'eq', value })),
        like: jest.fn().mockImplementation(value => ({ type: 'like', value })),
        sanitizeLikeString: jest.fn().mockImplementation(str => str),
    },
}));

jest.mock('date-fns', () => ({
    format: (d: any, fmt: string) => {
        try {
            return new Date(d).toISOString().split('T')[0];
        } catch(e) {
            return 'Invalid Date';
        }
    },
    isAfter: jest.fn().mockReturnValue(false),
    startOfToday: jest.fn().mockReturnValue(new Date()),
    subDays: jest.fn().mockReturnValue(new Date()),
    startOfWeek: jest.fn().mockReturnValue(new Date()),
    startOfMonth: jest.fn().mockReturnValue(new Date()),
}));

jest.mock('expo-router', () => ({
    __esModule: true,
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: jest.fn().mockImplementation((cb) => {
        const React = require('react');
        React.useEffect(() => cb(), [cb]);
    }),
}));

jest.mock('../../../../src/database', () => ({
    __esModule: true,
    database: {
        collections: {
            get: jest.fn(),
        },
    },
}));

jest.mock('../../../../src/components/SearchBar', () => ({
    __esModule: true,
    SearchBar: ({ value, onChangeText, placeholder }: any) => {
        const { TextInput } = require('react-native');
        return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9CA3AF" />;
    }
}));

jest.mock('../../../../src/components/SwipeableItem', () => {
    const { Pressable, Text, View } = require('react-native');
    const React = require('react');
    return {
        __esModule: true,
        default: (props: any) => React.createElement(
            View,
            {},
            props.children,
            React.createElement(
                Pressable,
                { testID: 'mock-swipe-edit', onPress: props.onEdit },
                React.createElement(Text, null, 'Edit')
            )
        )
    };
});

jest.mock('../../../../src/components/ActionSheet', () => ({
    __esModule: true,
    default: () => null
}));

jest.mock('../../../../src/components/ConfirmDialog', () => ({
    __esModule: true,
    default: () => null
}));

jest.mock('react-native-gesture-handler', () => {
    const React = require('react');
    const View = require('react-native').View;
    return {
        Swipeable: (props: any) => React.createElement(View, {}, props.children),
        GestureHandlerRootView: (props: any) => React.createElement(View, { className: props.className }, props.children),
        default: {
            install: () => {},
        }
    };
});

jest.mock('../../../../src/services/BaseModelService', () => ({
    __esModule: true,
    default: {
        fetchActive: jest.fn(),
        fetchPaginated: jest.fn(),
        cascadeDeleteBorrower: jest.fn(),
    }
}));

describe('BorrowersListScreen', () => {
    const mockBorrowers = [
        { id: 'b1', fullName: 'Alice', group: 'Group A', decryptedPhone: '111', decryptedAddress: 'Street 1', collectorId: 'c1', createdAt: Date.now() },
        { id: 'b2', fullName: 'Bob', group: 'Group B', decryptedPhone: '222', decryptedAddress: 'Street 2', collectorId: 'c2', createdAt: Date.now() },
        { id: 'b3', fullName: 'Charlie', group: 'Group A', decryptedPhone: '333', decryptedAddress: 'Street 3', collectorId: 'c1', createdAt: Date.now() }
    ];

    const mockUsers = [
        { id: 'c1', fullName: 'Collector One' },
        { id: 'c2', fullName: 'Collector Two' }
    ];

    const mockLoans = [
        { id: 'l1', borrowerId: 'b1', frequency: 'daily', status: 'active' },
        { id: 'l2', borrowerId: 'b2', frequency: 'weekly', status: 'active' },
        { id: 'l3', borrowerId: 'b3', frequency: 'monthly', status: 'active' }
    ];

    beforeEach(() => {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent !== 'function') {
            (window as any).dispatchEvent = jest.fn();
        }
        jest.clearAllMocks();
        (BaseModelService.fetchActive as jest.Mock).mockResolvedValue(mockBorrowers);
        (BaseModelService.fetchPaginated as jest.Mock).mockImplementation((tableName, clauses, skip, limit) => {
            if (tableName !== 'borrowers') return Promise.resolve([]);
            let results = [...mockBorrowers];
            
            // Find group filter clause
            const groupClause = clauses.find((c: any) => c && c.field === 'group');
            if (groupClause) {
                const groupValue = groupClause.value?.type === 'eq' ? groupClause.value.value : groupClause.value;
                results = results.filter(b => b.group === groupValue);
            }
            
            // Find search query clause (Q.or)
            const searchClause = clauses.find((c: any) => c && c.type === 'or');
            if (searchClause) {
                const nameCondition = searchClause.conditions.find((c: any) => c && c.field === 'full_name');
                if (nameCondition) {
                    const likeVal = nameCondition.value?.value || nameCondition.value || '';
                    const queryText = likeVal.replace(/%/g, '').toLowerCase();
                    if (queryText) {
                        results = results.filter(b => b.fullName.toLowerCase().includes(queryText));
                    }
                }
            }
            return Promise.resolve(results.slice(skip, skip + limit));
        });
        (database.collections.get as jest.Mock).mockImplementation((collectionName) => {
            if (collectionName === 'borrowers') {
                return {
                    query: jest.fn().mockReturnThis(),
                    fetch: jest.fn().mockResolvedValue(mockBorrowers),
                };
            }
            if (collectionName === 'user_profiles') {
                return {
                    query: jest.fn().mockReturnThis(),
                    fetch: jest.fn().mockResolvedValue(mockUsers),
                };
            }
            if (collectionName === 'loans') {
                return {
                    query: jest.fn().mockReturnThis(),
                    fetch: jest.fn().mockResolvedValue(mockLoans),
                };
            }
            if (collectionName === 'savings_transactions' || collectionName === 'share_capital_transactions') {
                return {
                    query: jest.fn().mockReturnThis(),
                    fetch: jest.fn().mockResolvedValue([]),
                };
            }
            return {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]),
            };
        });
    });

    it('renders and displays all borrowers initially', async () => {
        let view: any;
        view = render(<BorrowersListScreen />);
        await waitFor(() => { expect(view.queryByTestId('loading-indicator')).toBeNull(); }, { timeout: 1000 });
        const { getByText } = view;
        await waitFor(() => {
            expect(getByText('Alice')).toBeTruthy();
            expect(getByText('Bob')).toBeTruthy();
            expect(getByText('Charlie')).toBeTruthy();
        });
    });

    it('filters by payment frequency', async () => {
        let view: any;
        view = render(<BorrowersListScreen />);
        await waitFor(() => { expect(view.queryByTestId('loading-indicator')).toBeNull(); }, { timeout: 1000 });
        const { getByText, queryByText } = view;
        await waitFor(() => {
            expect(getByText('Alice')).toBeTruthy();
        });

        // Click Daily filter
        fireEvent.press(getByText('Daily'));

        await waitFor(() => {
            expect(getByText('Alice')).toBeTruthy();
            expect(queryByText('Bob')).toBeNull();
            expect(queryByText('Charlie')).toBeNull();
        });
    });

    it('filters by group', async () => {
        let view: any;
        view = render(<BorrowersListScreen />);
        await waitFor(() => { expect(view.queryByTestId('loading-indicator')).toBeNull(); }, { timeout: 1000 });
        const { getByText, getAllByText, queryByText } = view;
        await waitFor(() => {
            expect(getByText('Alice')).toBeTruthy();
        });

        // Click Group A filter
        fireEvent.press(getAllByText('Group A')[0]);

        await waitFor(() => {
            expect(getByText('Alice')).toBeTruthy();
            expect(getByText('Charlie')).toBeTruthy();
            expect(queryByText('Bob')).toBeNull();
        });
    });

    it('combines text search with group filter', async () => {
        let view: any;
        view = render(<BorrowersListScreen />);
        await waitFor(() => { expect(view.queryByTestId('loading-indicator')).toBeNull(); }, { timeout: 1000 });
        const { getByText, getAllByText, queryByText, getByPlaceholderText } = view;
        await waitFor(() => {
            expect(getByText('Alice')).toBeTruthy();
        });

        // Search "Alice"
        fireEvent.changeText(getByPlaceholderText('Search name, phone, or address...'), 'Alice');
        // Click Group A
        fireEvent.press(getAllByText('Group A')[0]);

        await waitFor(() => {
            expect(getByText('Alice')).toBeTruthy();
            expect(queryByText('Charlie')).toBeNull(); // Still group A, but doesn't match search
        });
    });

    it('navigates swipe edit actions to a matching borrower edit route', async () => {
        const view = render(<BorrowersListScreen />);

        await waitFor(() => {
            expect(view.getByText('Alice')).toBeTruthy();
        });

        // Click the List view mode button to switch to List view where SwipeableItem is rendered
        fireEvent.press(view.getByText('List'));

        await waitFor(() => {
            expect(view.getAllByTestId('mock-swipe-edit')[0]).toBeTruthy();
        });

        fireEvent.press(view.getAllByTestId('mock-swipe-edit')[0]);

        expect(mockPush).toHaveBeenCalledWith('/(admin)/borrowers/b1/edit');
    });
});
