import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react-native';
import GPSMappingScreen from '../mapping';
import { AgriParcelService } from '../../../../src/services/AgriParcelService';

// --- Mocks ---------------------------------------------------------------

const mockParcels = [
    {
        id: 'parcel-with-gps',
        name: 'Parcel Alpha',
        code: 'HVN-01',
        gpsCoordinates: JSON.stringify([
            { latitude: 8.35, longitude: 124.86 },
            { latitude: 8.36, longitude: 124.86 },
            { latitude: 8.36, longitude: 124.87 },
        ]),
    },
    {
        id: 'parcel-no-gps',
        name: 'Parcel Beta',
        code: 'RVF-02',
        gpsCoordinates: null,
    },
];

jest.mock('../../../../src/database', () => ({
    database: {
        get: jest.fn(() => ({
            query: jest.fn(() => ({
                fetch: jest.fn(async () => mockParcels),
            })),
        })),
    },
}));

jest.mock('expo-router', () => ({
    useLocalSearchParams: () => ({}),
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

// ParcelMap renders through a WebView/Leaflet — replace with a probe that
// surfaces the coordinates prop so tests can assert what the screen passes.
jest.mock('../../../../src/components/ParcelMap', () => {
    const ReactNative = require('react-native');
    const ReactLib = require('react');
    return {
        ParcelMap: (props: any) =>
            ReactLib.createElement(
                ReactNative.View,
                { testID: 'parcel-map-mock' },
                ReactLib.createElement(
                    ReactNative.Text,
                    { testID: 'map-vertex-count' },
                    `map-vertices-${props.coordinates.length}`
                )
            ),
    };
});

// Drive the real dialog semantics without pulling in BlurView/native modal
// plumbing: render the props as plain, addressable buttons.
jest.mock('../../../../src/components/ConfirmDialog', () => {
    const ReactNative = require('react-native');
    const ReactLib = require('react');
    return {
        ConfirmDialog: (props: any) => {
            if (!props.visible) return null;
            return ReactLib.createElement(
                ReactNative.View,
                { testID: 'confirm-dialog' },
                ReactLib.createElement(ReactNative.Text, { testID: 'confirm-dialog-title' }, props.title),
                ReactLib.createElement(ReactNative.Text, { testID: 'confirm-dialog-message' }, props.message),
                props.mode !== 'alert' &&
                    ReactLib.createElement(
                        ReactNative.Text,
                        {
                            testID: 'confirm-dialog-cancel',
                            onPress: props.onCancel,
                            accessibilityRole: 'button',
                        },
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

jest.mock('../../../../src/services/ErrorService', () => ({
    ErrorService: { handleError: jest.fn() },
    ErrorType: {
        NETWORK: 'NETWORK',
        AUTH: 'AUTH',
        SYNC: 'SYNC',
        CONFIGURATION: 'CONFIGURATION',
        CONSTRAINT: 'CONSTRAINT',
        TIMEOUT: 'TIMEOUT',
        VALIDATION: 'VALIDATION',
        DATABASE: 'DATABASE',
        UNKNOWN: 'UNKNOWN',
    },
}));

const updateParcelSpy = jest
    .spyOn(AgriParcelService, 'updateParcel')
    .mockResolvedValue(undefined as any);

let mockWalkCallback: ((fix: any) => void) | null = null;
const mockWatchRemove = jest.fn();
jest.mock('../../../../src/services/LocationService', () => ({
    locationProvider: {
        requestPermission: jest.fn(async () => 'granted'),
        watchPosition: jest.fn((onFix: (fix: any) => void) => {
            mockWalkCallback = onFix;
            return Promise.resolve({ remove: mockWatchRemove });
        }),
    },
}));

// --- Helpers -------------------------------------------------------------

const LOAD_TIMEOUT = { timeout: 5000 };

async function renderLoaded() {
    render(<GPSMappingScreen />);
    await waitFor(
        () => expect(screen.getByTestId('map-vertex-count').props.children).toBe('map-vertices-3'),
        LOAD_TIMEOUT
    );
}

function vertexCount(): number {
    const text = String(screen.getByTestId('map-vertex-count').props.children);
    return Number(text.replace('map-vertices-', ''));
}

function expectDialogTitle(title: string) {
    expect(screen.getByTestId('confirm-dialog-title').props.children).toBe(title);
}

function pressDialogConfirm() {
    fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));
}

function pressDialogCancel() {
    fireEvent.press(screen.getByTestId('confirm-dialog-cancel'));
}

/** Dismisses the currently open dialog and waits for it to unmount. */
async function dismissDialog() {
    pressDialogConfirm();
    await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).toBeNull());
}

// --- Tests ---------------------------------------------------------------

describe('GPSMappingScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('loads the first parcel and shows its real coordinates', async () => {
        await renderLoaded();
        expect(screen.queryByTestId('empty-boundary-state')).toBeNull();
    });

    it('shows the empty state when selecting a parcel without GPS data (no stale bleed)', async () => {
        await renderLoaded();

        fireEvent.press(screen.getByTestId('parcel-chip-parcel-no-gps'));

        await waitFor(() => expect(vertexCount()).toBe(0));
        expect(screen.getByTestId('empty-boundary-state')).toBeTruthy();
        expect(screen.getByText('No vertices recorded.')).toBeTruthy();
    });

    it('flags unsaved changes after an edit and requires confirmation to discard', async () => {
        await renderLoaded();

        // Delete a vertex → dirty
        fireEvent.press(screen.getByTestId('remove-vertex-0'));
        expect(vertexCount()).toBe(2);
        expect(screen.getByTestId('unsaved-badge')).toBeTruthy();

        // Switching parcels must ask before discarding
        fireEvent.press(screen.getByTestId('parcel-chip-parcel-no-gps'));
        expectDialogTitle('Unsaved Changes');
        expect(screen.getByTestId('confirm-dialog-confirm').props.children).toBe('Discard');

        // Cancel keeps the edits in place
        pressDialogCancel();
        await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).toBeNull());
        expect(vertexCount()).toBe(2);
        expect(screen.getByTestId('unsaved-badge')).toBeTruthy();

        // Confirm discards, applies the new parcel, and clears dirty
        fireEvent.press(screen.getByTestId('parcel-chip-parcel-no-gps'));
        pressDialogConfirm();
        await waitFor(() => expect(vertexCount()).toBe(0));
        expect(screen.queryByTestId('unsaved-badge')).toBeNull();
        expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    });

    it('shows inline feedback for an invalid manual coordinate and adds nothing', async () => {
        await renderLoaded();

        fireEvent.changeText(screen.getByPlaceholderText('Latitude (e.g. 8.3512)'), '999');
        fireEvent.changeText(screen.getByPlaceholderText('Longitude (e.g. 124.8621)'), '124.86');
        fireEvent.press(screen.getByTestId('add-vertex'));

        expect(screen.getByTestId('vertex-input-error')).toBeTruthy();
        expect(vertexCount()).toBe(3);
        expect(screen.queryByTestId('confirm-dialog')).toBeNull();
        expect(updateParcelSpy).not.toHaveBeenCalled();

        // Correcting the input clears the error and appends the vertex
        fireEvent.changeText(screen.getByPlaceholderText('Latitude (e.g. 8.3512)'), '8.3512');
        fireEvent.press(screen.getByTestId('add-vertex'));
        expect(screen.queryByTestId('vertex-input-error')).toBeNull();
        expect(vertexCount()).toBe(4);
    });

    it('blocks saving an incomplete boundary (1–2 vertices)', async () => {
        await renderLoaded();

        fireEvent.press(screen.getByTestId('remove-vertex-0'));
        fireEvent.press(screen.getByTestId('remove-vertex-0'));

        expect(vertexCount()).toBe(1);
        fireEvent.press(screen.getByTestId('save-boundary'));

        expectDialogTitle('Boundary Incomplete');
        expect(screen.getByTestId('confirm-dialog-confirm').props.children).toBe('OK');
        await dismissDialog();
        expect(updateParcelSpy).not.toHaveBeenCalled();
    });

    it('saves a complete boundary with recalculated area', async () => {
        await renderLoaded();

        fireEvent.press(screen.getByTestId('save-boundary'));

        await waitFor(() => expect(updateParcelSpy).toHaveBeenCalledTimes(1));
        const [id, updates] = updateParcelSpy.mock.calls[0];
        expect(id).toBe('parcel-with-gps');
        expect(updates.gpsCoordinates).toHaveLength(3);
        expect(updates.areaHectares).toBeGreaterThan(0);

        await waitFor(() => expectDialogTitle('Boundary Saved'));
        expect(screen.getByTestId('confirm-dialog-message').props.children).toMatch(/3 GPS vertices/);
        expect(screen.queryByTestId('unsaved-badge')).toBeNull();
        await dismissDialog();
    });

    it('confirms before clearing a boundary to NULL', async () => {
        await renderLoaded();

        fireEvent.press(screen.getByTestId('clear-boundary'));
        expectDialogTitle('Clear Boundary');
        pressDialogConfirm();

        await waitFor(() => expect(vertexCount()).toBe(0));

        fireEvent.press(screen.getByTestId('save-boundary'));
        expectDialogTitle('Clear Boundary');
        expect(screen.getByTestId('confirm-dialog-confirm').props.children).toBe('Clear Boundary');
        pressDialogConfirm();

        await waitFor(() => expect(updateParcelSpy).toHaveBeenCalledTimes(1));
        expect(updateParcelSpy.mock.calls[0][1].gpsCoordinates).toEqual([]);
        await waitFor(() => expectDialogTitle('Boundary Saved'));
        await dismissDialog();
    });

    it('surfaces a save failure instead of failing silently', async () => {
        await renderLoaded();

        updateParcelSpy.mockRejectedValueOnce(new Error('boundary write rejected'));

        fireEvent.press(screen.getByTestId('save-boundary'));

        await waitFor(() => expectDialogTitle('Save Failed'));
        expect(screen.getByTestId('confirm-dialog-message').props.children).toMatch(/rejected/);
        await dismissDialog();
    });

    it('captures walked boundary vertices with accuracy gating', async () => {
        await renderLoaded();

        // Switch to the parcel with no boundary so the walk starts from zero
        fireEvent.press(screen.getByTestId('parcel-chip-parcel-no-gps'));
        await waitFor(() => expect(vertexCount()).toBe(0));

        fireEvent.press(screen.getByTestId('start-walk'));
        await waitFor(() => expect(mockWalkCallback).not.toBeNull());

        // First fix → becomes vertex 1
        act(() => mockWalkCallback!({
            coordinate: { latitude: 8.35, longitude: 124.86 },
            accuracyMeters: 6,
            timestamp: 1,
        }));
        await waitFor(() => expect(vertexCount()).toBe(1));

        // Moved ~8.9 m (≥ 5 m threshold) → vertex 2
        act(() => mockWalkCallback!({
            coordinate: { latitude: 8.35008, longitude: 124.86 },
            accuracyMeters: 6,
            timestamp: 2,
        }));
        await waitFor(() => expect(vertexCount()).toBe(2));

        // Moved again but accuracy too poor → rejected
        act(() => mockWalkCallback!({
            coordinate: { latitude: 8.35016, longitude: 124.86 },
            accuracyMeters: 40,
            timestamp: 3,
        }));
        await waitFor(() => {
            expect(vertexCount()).toBe(2);
            expect(screen.getByTestId('walk-accuracy')).toBeTruthy();
        });

        fireEvent.press(screen.getByTestId('stop-walk'));
        expect(mockWatchRemove).toHaveBeenCalled();
        expect(screen.queryByTestId('walk-accuracy')).toBeNull();
    });
});
