import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { ConfirmDialog } from '../ConfirmDialog';

// BlurView is a native module; the jest setup mocks it, but the component is
// irrelevant to these assertions, so keep the tree lean.
jest.mock('expo-blur', () => ({ BlurView: () => null }));

describe('ConfirmDialog', () => {
    const base = {
        title: 'Unsaved Changes',
        message: 'Discard the unsaved boundary edits?',
        onConfirm: jest.fn(),
        onCancel: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders nothing while hidden', () => {
        render(<ConfirmDialog {...base} visible={false} />);
        expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    });

    it('renders both actions in confirm mode and routes presses', () => {
        render(
            <ConfirmDialog
                {...base}
                visible
                mode="confirm"
                confirmLabel="Discard"
                cancelLabel="Keep Editing"
                isDestructive
            />
        );
        expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent('Unsaved Changes');
        expect(screen.getByTestId('confirm-dialog-message')).toHaveTextContent('Discard the unsaved boundary edits?');
        expect(screen.getByTestId('confirm-dialog-cancel')).toHaveTextContent('Keep Editing');
        expect(screen.getByTestId('confirm-dialog-confirm')).toHaveTextContent('Discard');

        fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));
        expect(base.onConfirm).toHaveBeenCalledTimes(1);
        expect(base.onCancel).not.toHaveBeenCalled();

        fireEvent.press(screen.getByTestId('confirm-dialog-cancel'));
        expect(base.onCancel).toHaveBeenCalledTimes(1);
    });

    it(' collapses to a single acknowledgment that dismisses in alert mode', () => {
        render(<ConfirmDialog {...base} visible mode="alert" title="Boundary Incomplete" />);

        expect(screen.queryByTestId('confirm-dialog-cancel')).toBeNull();
        expect(screen.getByTestId('confirm-dialog-confirm')).toHaveTextContent('OK');

        fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));
        // Alert mode only dismisses — it must never fire the confirm callback.
        expect(base.onConfirm).not.toHaveBeenCalled();
        expect(base.onCancel).toHaveBeenCalledTimes(1);
    });

    it('keeps the legacy two-button behaviour when mode is omitted', () => {
        render(<ConfirmDialog {...base} visible confirmText="Yes" cancelText="No" />);
        expect(screen.getByTestId('confirm-dialog-cancel')).toHaveTextContent('No');
        expect(screen.getByTestId('confirm-dialog-confirm')).toHaveTextContent('Yes');
    });

    it('falls back to the original default labels and renders non-destructive content', () => {
        render(
            <ConfirmDialog
                {...base}
                visible
                title="Info"
                message="Nothing to worry about."
                isDestructive={false}
            />
        );
        // Pre-existing contract: 'Confirm' / 'Cancel' when no labels are passed.
        expect(screen.getByTestId('confirm-dialog-confirm')).toHaveTextContent('Confirm');
        expect(screen.getByTestId('confirm-dialog-cancel')).toHaveTextContent('Cancel');
        expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent('Info');
        expect(screen.getByTestId('confirm-dialog-message')).toHaveTextContent('Nothing to worry about.');
    });
});
