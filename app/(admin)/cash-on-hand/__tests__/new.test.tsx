import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NewCashTransactionScreen from '../new';

jest.mock('../../../../src/database', () => {
    return require('../../../../src/database/__mocks__');
});

jest.mock('expo-router', () => {
    return {
        useRouter: () => ({
            push: jest.fn(),
            back: jest.fn(),
        }),
    };
});

jest.mock('../../../../src/store/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'admin-1', email: 'admin@poscursor.test' },
        role: 'admin',
    }),
}));

describe('NewCashTransactionScreen (Issue #68)', () => {
    it('displays only fund transfer categories and does not display Regular Cash, Source of Funds, or Misc Income', async () => {
        const { getByText, queryByText } = render(<NewCashTransactionScreen />);

        await waitFor(() => {
            expect(getByText('Cash & Fund Transfer Entry')).toBeTruthy();
        });

        // Verify transfer options exist
        expect(getByText('COH → Petty Cash')).toBeTruthy();
        expect(getByText('COH → Bank')).toBeTruthy();
        expect(getByText('Bank Withdrawal → COH')).toBeTruthy();

        // Verify Issue #68 removals
        expect(queryByText('Regular Cash')).toBeNull();
        expect(queryByText('Source of Funds')).toBeNull();
        expect(queryByText('Misc Income')).toBeNull();
        expect(queryByText('Cash In')).toBeNull();
        expect(queryByText('Cash Out')).toBeNull();
    });
});
