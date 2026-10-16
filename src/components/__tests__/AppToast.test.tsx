import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import Toast, { WebToastEmitter } from '../AppToast.web';

describe('AppToast.web', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('renders null initially when no toast is active', () => {
        const { queryByTestId } = render(<Toast />);
        expect(queryByTestId('web-toast-container')).toBeNull();
    });

    it('displays toast on Toast.show and auto-dismisses after visibilityTime', () => {
        const { getByTestId, getByText, queryByTestId } = render(<Toast />);

        act(() => {
            Toast.show({
                type: 'success',
                text1: 'Batch Recorded',
                text2: 'Harvest scale batch #123 saved successfully',
                visibilityTime: 2000,
            });
        });

        expect(getByTestId('web-toast-container')).toBeTruthy();
        expect(getByText('Batch Recorded')).toBeTruthy();
        expect(getByText('Harvest scale batch #123 saved successfully')).toBeTruthy();

        // Advance timer past visibility time
        act(() => {
            jest.advanceTimersByTime(2500);
        });

        expect(queryByTestId('web-toast-container')).toBeNull();
    });

    it('allows manual dismissal via close button', () => {
        const { getByTestId, queryByTestId } = render(<Toast />);

        act(() => {
            Toast.show({
                type: 'error',
                text1: 'Failed to Save',
                text2: 'Validation error occurred',
            });
        });

        expect(getByTestId('web-toast-container')).toBeTruthy();

        act(() => {
            fireEvent.press(getByTestId('web-toast-dismiss-button'));
        });

        expect(queryByTestId('web-toast-container')).toBeNull();
    });

    it('allows manual dismissal via Toast.hide()', () => {
        const { getByTestId, queryByTestId } = render(<Toast />);

        act(() => {
            Toast.show({
                type: 'info',
                text1: 'Processing',
                text2: 'Please wait...',
            });
        });

        expect(getByTestId('web-toast-container')).toBeTruthy();

        act(() => {
            Toast.hide();
        });

        expect(queryByTestId('web-toast-container')).toBeNull();
    });
});
