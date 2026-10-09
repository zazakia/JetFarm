import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import LoanApplicationsListScreen from '../index';
import { loanApplicationService } from '../../../../src/services/LoanApplicationService';

jest.mock('../../../../src/services/LoanApplicationService', () => ({
    loanApplicationService: {
        getApplicationsByStatus: jest.fn(),
    },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush }),
}));

const app = {
    id: 'app-1',
    borrowerId: 'b-1',
    productId: 'p-1',
    amountApplied: 15000,
    amountApproved: null,
    purpose: 'Seeds and fertilizer',
    applicationDate: new Date('2026-10-01T00:00:00Z').getTime(),
    status: 'under_review',
    approvedBy: null,
    approvedAt: null,
    notes: null,
    createdAt: new Date('2026-10-01T00:00:00Z').getTime(),
    updatedAt: new Date('2026-10-01T00:00:00Z').getTime(),
    deletedAt: null,
};

describe('LoanApplicationsListScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (loanApplicationService.getApplicationsByStatus as jest.Mock).mockResolvedValue([app]);
    });

    it('renders applications under review', async () => {
        render(<LoanApplicationsListScreen />);
        await waitFor(() => {
            expect(screen.getByText('Amount: ₱15000')).toBeTruthy();
        });
    });

    it('navigates to the application detail screen instead of a dead-end alert', async () => {
        render(<LoanApplicationsListScreen />);
        await waitFor(() => {
            expect(screen.getByText('View Details')).toBeTruthy();
        });
        fireEvent.press(screen.getByText('View Details'));
        expect(mockPush).toHaveBeenCalledWith('/(loan-encoder)/loan-applications/app-1');
    });
});
