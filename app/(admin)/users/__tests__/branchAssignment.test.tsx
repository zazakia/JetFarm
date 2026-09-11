import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NewUserScreen from '../new';
import { database } from '../../../../src/database';
import { supabase } from '../../../../src/database/supabase';
import { ROLES } from '../../../../src/constants/roles';

jest.mock('expo-router', () => ({
    useRouter: () => ({ back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() }),
}));

jest.mock('../../../../src/database', () => ({
    database: {
        write: jest.fn().mockImplementation((cb) => cb()),
        batch: jest.fn().mockResolvedValue(undefined),
        collections: {
            get: jest.fn(),
        },
    },
}));

jest.mock('../../../../src/database/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
            update: jest.fn().mockReturnThis(),
            or: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
    },
}));

jest.mock('../../../../src/services/ActionLogService', () => ({
    prepareLogActions: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../../src/services/SyncService', () => ({
    SyncService: {
        checkAndSync: jest.fn().mockResolvedValue({}),
    },
}));

describe('NewUserScreen - Branch Assignment', () => {
    let mockCreatedUser: any = null;
    const mockPrepareCreate = jest.fn((cb) => {
        const record: any = { id: 'usr-new-1', _raw: {} };
        cb(record);
        mockCreatedUser = record;
        return record;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockCreatedUser = null;

        (database.collections.get as jest.Mock).mockImplementation((tableName: string) => {
            if (tableName === 'business_units') {
                return {
                    query: jest.fn().mockReturnValue({
                        fetch: jest.fn().mockResolvedValue([
                            { id: 'branch-bagacay', name: 'Bagacay (Benchmark)' },
                            { id: 'branch-daro', name: 'Daro Crossing' },
                        ]),
                    }),
                };
            }
            if (tableName === 'borrowers') {
                return {
                    query: jest.fn().mockReturnValue({
                        fetch: jest.fn().mockResolvedValue([]),
                    }),
                };
            }
            return {
                prepareCreate: mockPrepareCreate,
                query: jest.fn().mockReturnValue({
                    fetch: jest.fn().mockResolvedValue([]),
                }),
            };
        });
    });

    it('renders branch selection buttons for store assignment', async () => {
        const { findByText } = render(<NewUserScreen />);

        expect(await findByText('Bagacay (Benchmark)')).toBeTruthy();
        expect(await findByText('Daro Crossing')).toBeTruthy();
    });

    it('saves user with assigned branchId and role branch_cashier', async () => {
        const { getByPlaceholderText, getByText, findByText } = render(<NewUserScreen />);

        fireEvent.changeText(getByPlaceholderText('Enter full name'), 'Maria Cashier');
        fireEvent.changeText(getByPlaceholderText('user@example.com'), 'maria.cashier@poscursor.com');

        // Select Daro branch
        const daroBranchBtn = await findByText('Daro Crossing');
        fireEvent.press(daroBranchBtn);

        // Submit form
        const submitBtn = getByText('Create Profile');
        fireEvent.press(submitBtn);

        await waitFor(() => {
            expect(mockPrepareCreate).toHaveBeenCalled();
            expect(mockCreatedUser).not.toBeNull();
            expect(mockCreatedUser.fullName).toBe('Maria Cashier');
            expect(mockCreatedUser.email).toBe('maria.cashier@poscursor.com');
            expect(mockCreatedUser.branchId).toBe('branch-daro');
            expect(mockCreatedUser.role).toBe(ROLES.branch_cashier);
        });
    });
});
