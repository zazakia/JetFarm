import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SupervisorApprovalModal } from '../SupervisorApprovalModal';
import { SupervisorApprovalService } from '../../services/SupervisorApprovalService';

jest.mock('../../services/SupervisorApprovalService');

describe('SupervisorApprovalModal', () => {
    const mockOnClose = jest.fn();
    const mockOnApproved = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (SupervisorApprovalService.getEligibleSupervisors as jest.Mock).mockResolvedValue([
            {
                id: 'sup-1',
                role: 'branch_manager',
                fullName: 'Manager Santos',
                branchId: 'branch-bagacay',
            },
        ]);
    });

    it('renders null when not visible', () => {
        const { queryByText } = render(
            <SupervisorApprovalModal
                visible={false}
                onClose={mockOnClose}
                onApproved={mockOnApproved}
                branchId="branch-bagacay"
                actionTitle="Void Order"
            />
        );
        expect(queryByText('Supervisor Override')).toBeNull();
    });

    it('renders modal with action title and branch info', async () => {
        const { getByText } = render(
            <SupervisorApprovalModal
                visible={true}
                onClose={mockOnClose}
                onApproved={mockOnApproved}
                branchId="branch-bagacay"
                actionTitle="Void Order"
                actionDescription="Supervisor approval required to cancel items"
            />
        );

        await waitFor(() => {
            expect(getByText('Supervisor Override')).toBeTruthy();
            expect(getByText('Void Order')).toBeTruthy();
            expect(getByText('Supervisor approval required to cancel items')).toBeTruthy();
        });
    });

    it('authorizes successfully with valid supervisor PIN', async () => {
        (SupervisorApprovalService.validateApproval as jest.Mock).mockResolvedValue({
            authorized: true,
            supervisorId: 'sup-1',
            supervisorName: 'Manager Santos',
        });

        const { getByText, getByPlaceholderText } = render(
            <SupervisorApprovalModal
                visible={true}
                onClose={mockOnClose}
                onApproved={mockOnApproved}
                branchId="branch-bagacay"
                actionTitle="Void Order"
            />
        );

        await waitFor(() => {
            expect(getByText('Manager Santos')).toBeTruthy();
        });

        const pinInput = getByPlaceholderText('Enter 4-digit PIN');
        fireEvent.changeText(pinInput, '8888');

        const authorizeButton = getByText('Authorize');
        fireEvent.press(authorizeButton);

        await waitFor(() => {
            expect(SupervisorApprovalService.validateApproval).toHaveBeenCalledWith(
                expect.objectContaining({
                    pin: '8888',
                    targetBranchId: 'branch-bagacay',
                    actionType: 'Void Order',
                })
            );
            expect(mockOnApproved).toHaveBeenCalledWith({
                supervisorId: 'sup-1',
                supervisorName: 'Manager Santos',
            });
            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    it('displays error message when PIN is invalid', async () => {
        (SupervisorApprovalService.validateApproval as jest.Mock).mockResolvedValue({
            authorized: false,
            error: 'Invalid supervisor PIN. Please re-enter.',
        });

        const { getByText, getByPlaceholderText } = render(
            <SupervisorApprovalModal
                visible={true}
                onClose={mockOnClose}
                onApproved={mockOnApproved}
                branchId="branch-bagacay"
                actionTitle="Void Order"
            />
        );

        await waitFor(() => {
            expect(getByText('Manager Santos')).toBeTruthy();
        });

        const pinInput = getByPlaceholderText('Enter 4-digit PIN');
        fireEvent.changeText(pinInput, '0000');

        const authorizeButton = getByText('Authorize');
        fireEvent.press(authorizeButton);

        await waitFor(() => {
            expect(getByText('Invalid supervisor PIN. Please re-enter.')).toBeTruthy();
            expect(mockOnApproved).not.toHaveBeenCalled();
        });
    });
});
