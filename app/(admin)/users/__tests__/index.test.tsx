import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import UsersListScreen from '../index';
import { database } from '../../../../src/database';
import { ROLES } from '../../../../src/constants/roles';

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn() }),
    useFocusEffect: (cb: any) => cb(),
}));

jest.mock('../../../../src/database', () => ({
    database: {
        collections: {
            get: jest.fn(),
        },
    },
}));

jest.mock('../../../../src/services/SyncService', () => ({
    SyncService: {
        checkAndSync: jest.fn().mockResolvedValue({}),
    },
}));

describe('UsersListScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        (database.collections.get as jest.Mock).mockImplementation((tableName: string) => {
            if (tableName === 'business_units') {
                return {
                    query: jest.fn().mockReturnValue({
                        fetch: jest.fn().mockResolvedValue([
                            { id: 'branch-bagacay', name: 'Bagacay (Benchmark)' },
                        ]),
                    }),
                };
            }
            if (tableName === 'user_profiles') {
                return {
                    query: jest.fn().mockReturnValue({
                        fetch: jest.fn().mockResolvedValue([
                            {
                                id: 'usr-cashier-1',
                                fullName: 'Juana Cashier',
                                email: 'juana@poscursor.com',
                                role: ROLES.branch_cashier,
                                isActive: true,
                                branchId: 'branch-bagacay',
                            },
                        ]),
                    }),
                };
            }
            return {
                query: jest.fn().mockReturnValue({
                    fetch: jest.fn().mockResolvedValue([]),
                }),
            };
        });
    });

    it('renders user list with branch cashier role and branch badge', async () => {
        const { findByText } = render(<UsersListScreen />);

        await waitFor(async () => {
            expect(await findByText('Juana Cashier')).toBeTruthy();
            expect(await findByText('juana@poscursor.com')).toBeTruthy();
            expect(await findByText('Branch Cashier')).toBeTruthy();
            expect(await findByText('Bagacay (Benchmark)')).toBeTruthy();
        });
    });

    it('renders pending user with Pending badge and Activate button', async () => {
        const mockPendingUser = {
            id: 'usr-pending-1',
            fullName: 'Pending Applicant',
            email: 'applicant@example.com',
            role: ROLES.collector,
            isActive: false,
            update: jest.fn(),
        };

        (database.collections.get as jest.Mock).mockImplementation((tableName: string) => {
            if (tableName === 'user_profiles') {
                return {
                    query: jest.fn().mockReturnValue({
                        fetch: jest.fn().mockResolvedValue([mockPendingUser]),
                    }),
                };
            }
            return {
                query: jest.fn().mockReturnValue({
                    fetch: jest.fn().mockResolvedValue([]),
                }),
            };
        });

        const { findByText, findAllByText, getByTestId } = render(<UsersListScreen />);

        expect(await findByText('Pending Applicant')).toBeTruthy();
        expect((await findAllByText('Pending')).length).toBeGreaterThan(0);
        expect(getByTestId('user-activate-usr-pending-1')).toBeTruthy();
    });
});
