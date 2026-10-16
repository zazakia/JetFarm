import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TransactionConfirmationBanner } from '../TransactionConfirmationBanner';

describe('TransactionConfirmationBanner', () => {
    it('renders confirmation message and title', () => {
        const { getByText, getByTestId } = render(
            <TransactionConfirmationBanner
                title="Batch Saved Successfully"
                message="Harvest weigh-in batch BATCH-001 has been recorded."
                transactionCode="BATCH-001"
            />
        );

        expect(getByTestId('transaction-confirmation-banner')).toBeTruthy();
        expect(getByText('Batch Saved Successfully')).toBeTruthy();
        expect(getByText('Harvest weigh-in batch BATCH-001 has been recorded.')).toBeTruthy();
        expect(getByText('BATCH-001')).toBeTruthy();
    });

    it('calls onDismiss when close button is pressed', () => {
        const onDismiss = jest.fn();
        const { getByTestId } = render(
            <TransactionConfirmationBanner
                message="Transaction saved"
                onDismiss={onDismiss}
            />
        );

        fireEvent.press(getByTestId('confirmation-banner-dismiss'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('calls onAction when action button is pressed', () => {
        const onAction = jest.fn();
        const { getByText } = render(
            <TransactionConfirmationBanner
                message="Transaction saved"
                actionLabel="View Details"
                onAction={onAction}
            />
        );

        fireEvent.press(getByText('View Details'));
        expect(onAction).toHaveBeenCalledTimes(1);
    });
});
