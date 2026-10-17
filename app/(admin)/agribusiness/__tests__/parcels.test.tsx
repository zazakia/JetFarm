import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import ParcelsRegistryScreen from '../parcels';
import { AgriParcelService } from '../../../../src/services/AgriParcelService';
import { LookupDataService } from '../../../../src/services/LookupDataService';
import Toast from '../../../../src/components/AppToast';

// --- Mocks ---------------------------------------------------------------

const mockList = [
    {
        parcel: {
            id: 'p1',
            name: 'Parcel Alpha',
            code: 'PCL-001',
            areaHectares: 3.5,
            locationAddress: 'Brgy. Poblacion',
            soilType: 'Clay Loam',
            status: 'available',
        },
        landOwner: { id: 'o1', name: 'Don Ramon', contactNumber: '0917-000-0001' },
        activeCycle: null,
    },
];

let mockParams: any = {};
const mockPush = jest.fn();
jest.mock('../../../../src/database', () => ({
    database: {
        get: jest.fn(() => ({ query: jest.fn(() => ({ fetch: jest.fn(async () => []) })), create: jest.fn(async (fill: any) => { const record = { id: 'new-owner' }; fill(record); return record; }) })),
        write: jest.fn(async (fn: any) => fn()),
    },
}));

jest.mock('expo-router', () => ({
    useLocalSearchParams: () => mockParams,
    useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
    useFocusEffect: (cb: any) => require('react').useEffect(cb, []),
}));

// Web-safe dialog rendered as addressable buttons (mirrors mapping.test.tsx)
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

jest.mock('../../../../src/services/LookupDataService', () => ({
    LookupDataService: { getActiveOptions: jest.fn(async () => ['Loam', 'Clay Loam']) },
}));

const listSpy = jest.spyOn(AgriParcelService, 'listParcels').mockResolvedValue(mockList as any);
const updateSpy = jest.spyOn(AgriParcelService, 'updateParcel').mockResolvedValue({ id: 'p1' } as any);
const deleteSpy = jest.spyOn(AgriParcelService, 'deleteParcel').mockResolvedValue({ id: 'p1' } as any);
const createSpy = jest.spyOn(AgriParcelService, 'createParcel').mockResolvedValue({ id: 'new-parcel' } as any);

// --- Helpers -------------------------------------------------------------

async function renderLoaded() {
    render(<ParcelsRegistryScreen />);
    await waitFor(() => expect(screen.getByTestId('parcel-card-p1')).toBeTruthy(), { timeout: 5000 });
}

function dialogTitle(): string {
    return String(screen.getByTestId('confirm-dialog-title').props.children);
}

describe('Parcels Registry screen — edit & delete', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockParams = {};
        listSpy.mockResolvedValue(mockList as any);
    });

    it('offers edit and delete actions on every registered parcel', async () => {
        await renderLoaded();

        expect(screen.getByTestId('parcel-edit-p1')).toBeTruthy();
        expect(screen.getByTestId('parcel-delete-p1')).toBeTruthy();
    });

    it('opens the modal prefilled with the parcel and saves through updateParcel', async () => {
        await renderLoaded();

        fireEvent.press(screen.getByTestId('parcel-edit-p1'));

        expect(screen.getByTestId('parcel-name-input').props.value).toBe('Parcel Alpha');
        expect(screen.getByTestId('parcel-area-input').props.value).toBe('3.5');

        fireEvent.changeText(screen.getByTestId('parcel-name-input'), 'Parcel Alpha North');
        fireEvent.changeText(screen.getByTestId('parcel-area-input'), '4.1');
        fireEvent.press(screen.getByTestId('save-parcel-button'));

        await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
        const [id, updates] = updateSpy.mock.calls[0];
        expect(id).toBe('p1');
        expect(updates.name).toBe('Parcel Alpha North');
        expect(updates.areaHectares).toBe(4.1);
    });

    it('locks the landowner field when editing so contract terms cannot be reassigned', async () => {
        await renderLoaded();

        fireEvent.press(screen.getByTestId('parcel-edit-p1'));

        expect(screen.getByTestId('landowner-name-input').props.editable).toBe(false);
        expect(screen.getByTestId('landowner-name-input').props.value).toBe('Don Ramon');
    });

    it('asks for confirmation before deleting, then soft-deletes through the service', async () => {
        await renderLoaded();

        fireEvent.press(screen.getByTestId('parcel-delete-p1'));
        expect(dialogTitle()).toBe('Delete Land Parcel');
        expect(deleteSpy).not.toHaveBeenCalled();

        fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));

        await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('p1'));
        expect(Toast.show).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'success', text1: 'Parcel Deleted' })
        );
    });

    it('does not delete when the confirmation is cancelled', async () => {
        await renderLoaded();

        fireEvent.press(screen.getByTestId('parcel-delete-p1'));
        fireEvent.press(screen.getByTestId('confirm-dialog-cancel'));

        await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).toBeNull());
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('surfaces the guard reason when the service blocks the delete', async () => {
        await renderLoaded();

        deleteSpy.mockRejectedValueOnce(
            new Error('Cannot delete this parcel: it still has an active crop cycle (CYC-2026-A).')
        );

        fireEvent.press(screen.getByTestId('parcel-delete-p1'));
        fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));

        await waitFor(() => expect(dialogTitle()).toBe('Cannot Delete Parcel'));
        expect(screen.getByTestId('confirm-dialog-message').props.children).toMatch(/active crop cycle/);
    });

    it('keeps the register-parcel flow intact after the edit refactor', async () => {
        await renderLoaded();

        fireEvent.press(screen.getByTestId('register-parcel-button'));
        expect(screen.getByTestId('landowner-name-input').props.editable).toBe(true);

        fireEvent.changeText(screen.getByTestId('parcel-name-input'), 'New Parcel');
        fireEvent.changeText(screen.getByTestId('landowner-name-input'), 'New Owner');
        fireEvent.changeText(screen.getByTestId('parcel-area-input'), '2');
        fireEvent.press(screen.getByTestId('save-parcel-button'));

        await waitFor(() => expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Parcel', landOwnerId: 'new-owner', areaHectares: 2 })));
        expect(LookupDataService.getActiveOptions).toHaveBeenCalled();
        expect(updateSpy).not.toHaveBeenCalled();
    });

    it('registers an explicitly unmeasured parcel and returns its real ID to mapping', async () => {
        mockParams = { mapRegistration: '1' };
        await renderLoaded();
        fireEvent.press(screen.getByTestId('register-parcel-button'));
        fireEvent.changeText(screen.getByTestId('parcel-name-input'), 'Unmeasured parcel');
        fireEvent.changeText(screen.getByTestId('landowner-name-input'), 'Existing registration owner');
        expect(screen.getByText(/Area will be measured/)).toBeTruthy();
        fireEvent.press(screen.getByTestId('save-parcel-button'));
        await waitFor(() => expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ areaHectares: 0, landOwnerId: 'new-owner' })));
        expect(mockPush).toHaveBeenCalledWith({ pathname: '/(admin)/agribusiness/mapping', params: { parcelId: 'new-parcel' } });
    });

    it('still requires positive hectares for ordinary registration', async () => {
        await renderLoaded(); fireEvent.press(screen.getByTestId('register-parcel-button'));
        fireEvent.changeText(screen.getByTestId('parcel-name-input'), 'Ordinary parcel');
        fireEvent.changeText(screen.getByTestId('landowner-name-input'), 'Owner');
        fireEvent.press(screen.getByTestId('save-parcel-button'));
        expect(createSpy).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled();
    });
});
