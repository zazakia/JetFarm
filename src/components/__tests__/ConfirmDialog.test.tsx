import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ConfirmDialog from '../ConfirmDialog';

describe('ConfirmDialog', () => {
    const mockOnConfirm = jest.fn();
    const mockOnCancel = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders text content correctly', () => {
        const { getByText } = render(
            <ConfirmDialog 
                visible={true}
                title="Delete Account"
                message="Are you sure you want to delete this account?"
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        expect(getByText('Delete Account')).toBeTruthy();
        expect(getByText('Are you sure you want to delete this account?')).toBeTruthy();
        expect(getByText('Confirm')).toBeTruthy();
        expect(getByText('Cancel')).toBeTruthy();
    });

    it('renders custom labels when provided', () => {
        const { getByText } = render(
            <ConfirmDialog 
                visible={true}
                title="Warning"
                message="Oops!"
                confirmLabel="Yes, Delete"
                cancelLabel="No, Wait"
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        expect(getByText('Yes, Delete')).toBeTruthy();
        expect(getByText('No, Wait')).toBeTruthy();
    });

    it('calls onConfirm when confirm button is pressed', () => {
        const { getByText } = render(
            <ConfirmDialog 
                visible={true}
                title="Action"
                message="Message"
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        fireEvent.press(getByText('Confirm'));
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
        expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('calls onCancel when cancel button is pressed', () => {
        const { getByText } = render(
            <ConfirmDialog 
                visible={true}
                title="Action"
                message="Message"
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        fireEvent.press(getByText('Cancel'));
        expect(mockOnCancel).toHaveBeenCalledTimes(1);
        expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('handles non-destructive state', () => {
        const { getByText } = render(
            <ConfirmDialog 
                visible={true}
                title="Info"
                message="Some info."
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                isDestructive={false}
            />
        );
        expect(getByText('Info')).toBeTruthy();
    });
});
