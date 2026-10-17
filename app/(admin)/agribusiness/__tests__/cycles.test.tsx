import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import CropCyclesScreen from '../cycles';
import { AgriCropCycleService } from '../../../../src/services/AgriCropCycleService';
import Toast from '../../../../src/components/AppToast';

// --- Mocks ---------------------------------------------------------------

const mockCycle = {
    id: 'c1',
    cycleCode: 'CYC-2026-ALPHA',
    parcelId: 'p1',
    investorId: null,
    cropType: 'Cassava',
    variety: 'Golden Yellow',
    plantingDate: new Date('2026-01-10'),
    targetHarvestDate: new Date('2026-10-07'),
    actualHarvestDate: null,
    areaPlantedHa: 2.5,
    status: 'planted',
    expectedYieldKg: 62500,
    totalActualYieldKg: 0,
    capitalAllocated: 10000,
    landOwnerRatePerKg: 1,
    landOwnerGuaranteedMin: 25000,
    offtakePricePerKg: 4,
    notes: 'Original notes',
};

const mockList = [
    {
        cycle: mockCycle,
        parcel: { id: 'p1', name: 'Parcel Alpha', areaHectares: 2.5 },
        investor: null,
    },
];

jest.mock('../../../../src/database', () => ({
    database: {
        get: jest.fn(() => ({ query: jest.fn(() => ({ fetch: jest.fn(async () => []) })) })),
        write: jest.fn(async (fn: any) => fn()),
    },
}));

jest.mock('expo-router', () => ({
    useLocalSearchParams: () => ({}),
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
    useFocusEffect: (cb: any) => require('react').useEffect(cb, []),
}));

jest.mock('../../../../src/components/CropHealthGrowthChart', () => {
    const ReactNative = require('react-native');
    const ReactLib = require('react');
    return {
        __esModule: true,
        CropHealthGrowthChart: () =>
            ReactLib.createElement(ReactNative.Text, { testID: 'health-chart-mock' }, 'chart'),
    };
});

jest.mock('../../../../src/components/ConfirmDialog', () => {
    const ReactNative = require('react-native');
    const ReactLib = require('react');
    return {
        __esModule: true,
        default: (props: any) => {
            if (!props.visible) return null;
            return ReactLib.createElement(
                ReactNative.View,
                { testID: 'confirm-dialog' },
                ReactLib.createElement(ReactNative.Text, { testID: 'confirm-dialog-title' }, props.title),
                ReactLib.createElement(ReactNative.Text, { testID: 'confirm-dialog-message' }, props.message),
                props.mode !== 'alert' &&
                    ReactLib.createElement(
                        ReactNative.Text,
                        { testID: 'confirm-dialog-cancel', onPress: props.onCancel, accessibilityRole: 'button' },
                        props.cancelLabel || 'Cancel'
                    ),
                ReactLib.createElement(
                    ReactNative.Text,
                    {
                        testID: 'confirm-dialog-confirm',
                        onPress: props.mode === 'alert' ? props.onCancel : props.onConfirm,
                        accessibilityRole: 'button',
                    },
                    props.confirmLabel || 'OK'
                )
            );
        },
    };
});

jest.mock('../../../../src/components/AppToast', () => ({
    __esModule: true,
    default: { show: jest.fn() },
}));

const listSpy = jest.spyOn(AgriCropCycleService, 'listCycles').mockResolvedValue(mockList as any);
const updateSpy = jest.spyOn(AgriCropCycleService, 'updateCropCycle').mockResolvedValue(mockCycle as any);
const deleteSpy = jest.spyOn(AgriCropCycleService, 'deleteCropCycle').mockResolvedValue(mockCycle as any);

// --- Helpers -------------------------------------------------------------

async function renderLoaded() {
    render(<CropCyclesScreen />);
    await waitFor(() => expect(screen.getByTestId('cycle-edit-c1')).toBeTruthy(), { timeout: 5000 });
}

function dialogTitle(): string {
    return String(screen.getByTestId('confirm-dialog-title').props.children);
}

describe('Crop Cycles screen — edit & delete', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        listSpy.mockResolvedValue(mockList as any);
    });

    it('offers edit and delete actions on every cycle', async () => {
        await renderLoaded();

        expect(screen.getByTestId('cycle-edit-c1')).toBeTruthy();
        expect(screen.getByTestId('cycle-delete-c1')).toBeTruthy();
    });

    it('opens the edit modal prefilled and saves through updateCropCycle', async () => {
        await renderLoaded();

        fireEvent.press(screen.getByTestId('cycle-edit-c1'));

        expect(screen.getByTestId('edit-cycle-variety-input').props.value).toBe('Golden Yellow');
        expect(screen.getByTestId('edit-cycle-area-input').props.value).toBe('2.5');
        expect(screen.getByTestId('edit-cycle-offtake-input').props.value).toBe('4');
        expect(screen.getByTestId('edit-cycle-notes-input').props.value).toBe('Original notes');

        fireEvent.changeText(screen.getByTestId('edit-cycle-variety-input'), 'Blue Bayong');
        fireEvent.changeText(screen.getByTestId('edit-cycle-area-input'), '3.1');
        fireEvent.press(screen.getByTestId('edit-cycle-status-harvesting'));
        fireEvent.press(screen.getByTestId('save-cycle-edit-button'));

        await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
        const [id, updates] = updateSpy.mock.calls[0];
        expect(id).toBe('c1');
        expect(updates.variety).toBe('Blue Bayong');
        expect(updates.areaPlantedHa).toBe(3.1);
        expect(updates.status).toBe('harvesting');
    });

    it('rejects a non-positive planted area before calling the service', async () => {
        await renderLoaded();

        fireEvent.press(screen.getByTestId('cycle-edit-c1'));
        fireEvent.changeText(screen.getByTestId('edit-cycle-area-input'), '0');
        fireEvent.press(screen.getByTestId('save-cycle-edit-button'));

        await waitFor(() => expect(updateSpy).not.toHaveBeenCalled());
    });

    it('asks for confirmation before deleting, then soft-deletes through the service', async () => {
        await renderLoaded();

        fireEvent.press(screen.getByTestId('cycle-delete-c1'));
        expect(dialogTitle()).toBe('Delete Crop Cycle');
        expect(deleteSpy).not.toHaveBeenCalled();

        fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));

        await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('c1'));
        expect(Toast.show).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'success', text1: 'Cycle Deleted' })
        );
    });

    it('does not delete when the confirmation is cancelled', async () => {
        await renderLoaded();

        fireEvent.press(screen.getByTestId('cycle-delete-c1'));
        fireEvent.press(screen.getByTestId('confirm-dialog-cancel'));

        await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).toBeNull());
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('surfaces the guard reason when the cycle has financial history', async () => {
        await renderLoaded();

        deleteSpy.mockRejectedValueOnce(
            new Error('Cannot delete cycle CYC-2026-ALPHA: it already has 2 harvest weigh-in(s) and 1 weekly settlement(s).')
        );

        fireEvent.press(screen.getByTestId('cycle-delete-c1'));
        fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));

        await waitFor(() => expect(dialogTitle()).toBe('Cannot Delete Cycle'));
        expect(screen.getByTestId('confirm-dialog-message').props.children).toMatch(/harvest weigh-in/);
    });
});
