import React from 'react';
import { render, waitFor, screen } from '@testing-library/react-native';
import LoanApplicationDetailScreen from '../[id]';
import { loanApplicationService } from '../../../../src/services/LoanApplicationService';

jest.mock('../../../../src/services/LoanApplicationService', () => ({
    loanApplicationService: {
        getApplicationById: jest.fn(),
    },
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = { id: 'app-1' };
jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush, back: mockBack }),
    useLocalSearchParams: () => mockParams,
}));

const app = {
    id: 'app-1',
    borrowerId: 'b-1',
    productId: 'p-1',
    amountApplied: 15000,
    amountApproved: 12000,
    purpose: 'Seeds and fertilizer',
    applicationDate: new Date('2026-10-01T00:00:00Z').getTime(),
    status: 'approved',
    approvedBy: 'u-1',
    approvedAt: new Date('2026-10-02T00:00:00Z').getTime(),
    notes: 'Docs verified',
    createdAt: new Date('2026-10-01T00:00:00Z').getTime(),
    updatedAt: new Date('2026-10-02T00:00:00Z').getTime(),
    deletedAt: null,
};

describe('LoanApplicationDetailScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockParams = { id: 'app-1' };
    });

    it('shows the full application record', async () => {
        (loanApplicationService.getApplicationById as jest.Mock).mockResolvedValue(app);
        render(<LoanApplicationDetailScreen />);

        await waitFor(() => {
            expect(screen.getByText('Seeds and fertilizer')).toBeTruthy();
        });
        expect(screen.getByText(/12,?000/)).toBeTruthy();
        expect(screen.getByText('approved')).toBeTruthy();
        expect(screen.getByText('Docs verified')).toBeTruthy();
        expect(loanApplicationService.getApplicationById).toHaveBeenCalledWith('app-1');
    });

    it('shows a friendly message when the application does not exist', async () => {
        (loanApplicationService.getApplicationById as jest.Mock).mockResolvedValue(null);
        mockParams = { id: 'missing-id' };
        render(<LoanApplicationDetailScreen />);

        await waitFor(() => {
            expect(screen.getByText(/not found/i)).toBeTruthy();
        });
    });
});
