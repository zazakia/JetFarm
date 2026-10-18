import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, StyleSheet } from 'react-native';
import GPSMappingScreen from '../mapping';
import { getResponsiveTokens } from '../../../../src/utils/responsiveLayout';

// jest-expo's Dimensions.get and useWindowDimensions disagree; the screen reads the hook,
// so the test pins it and derives expectations from the same phone viewport.
const PHONY_VIEWPORT: [number, number] = [390, 844];
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
    default: () => ({ fontScale: 1, height: 844, scale: 2, width: 390 }),
}));
import { BlockMonitoringPanel } from '../../../../src/components/ParcelMap/BlockMonitoringPanel';
import { BoundaryEditorPanel } from '../../../../src/components/ParcelMap/BoundaryEditorPanel';

// DUMMY: synthetic geometry and registry records, not surveyed land.
const mockOuter = [
    { latitude: 8, longitude: 125 }, { latitude: 8, longitude: 125.002 },
    { latitude: 8.002, longitude: 125.002 }, { latitude: 8.002, longitude: 125 },
];
const mockParcels = [
    { id: 'parcel-with-gps', name: 'Parcel Alpha', code: 'HVN-01', areaHectares: 4.2, layoutRevision: 0, gpsCoordinates: JSON.stringify(mockOuter), gpsExclusions: null },
    { id: 'parcel-no-gps', name: 'Parcel Beta', code: 'RVF-02', areaHectares: 0, layoutRevision: 0, gpsCoordinates: null, gpsExclusions: null },
];
let mockRegistry = mockParcels;
let mockRegistryPending: Promise<typeof mockParcels> | null = null;
let mockBlocks: any[] = [];
let mockAssignments: any[] = [];
let mockMapProps: any;
let mockWalkCallback: ((fix: any) => void) | null = null;
const mockWatchRemove = jest.fn();
const mockSaveLayout = jest.fn(async (..._args: any[]) => 1);
const mockClearBoundary = jest.fn(async (..._args: any[]) => 1);
const mockPush = jest.fn(), mockBack = jest.fn(), mockDispatch = jest.fn();
const mockListeners: Record<string, (event: any) => void> = {};
const mockNavigation = { addListener: jest.fn((name: string, callback: any) => { mockListeners[name] = callback; return () => { delete mockListeners[name]; }; }), dispatch: mockDispatch };
let mockParams: any = {};
let mockOperatorId = 'supervisor';
let mockDatabaseError: Error | null = null;
let mockBeforeBlocksReturn: (() => void) | null = null;
jest.mock('../../../../src/services/AgriWriteSafety', () => ({ assertAgriDatabaseUsable: () => { if (mockDatabaseError) throw mockDatabaseError; } }));

jest.mock('../../../../src/database', () => ({ database: { get: jest.fn((table: string) => ({ find: async (id: string) => mockBlocks.find(b => b.id === id), query: () => ({ fetch: async () => {
    if (table === 'agri_parcel_blocks') mockBeforeBlocksReturn?.();
    return table === 'agri_parcels' ? mockRegistryPending ?? mockRegistry : table === 'agri_parcel_blocks' ? mockBlocks : table === 'agri_block_assignments' ? mockAssignments : [];
} }) })) } }));
jest.mock('../../../../src/store/AuthContext', () => ({ useAuth: () => ({ user: { id: mockOperatorId } }) }));
jest.mock('../../../../src/services/AgriBlockService', () => ({ AgriBlockService: { saveLayout: (...args: any[]) => mockSaveLayout(...args), clearBoundary: (...args: any[]) => mockClearBoundary(...args) } }));
jest.mock('expo-router', () => ({
    useLocalSearchParams: () => mockParams,
    useRouter: () => ({ push: mockPush, back: mockBack }),
    useNavigation: () => mockNavigation,
}));
jest.mock('../../../../src/components/ParcelMap', () => {
    const RN = require('react-native'), ReactLib = require('react');
    return { ParcelMap: (props: any) => { mockMapProps = props; return ReactLib.createElement(RN.View, { testID: 'parcel-map-mock' }, ReactLib.createElement(RN.Text, { testID: 'map-vertex-count' }, `map-vertices-${props.coordinates.length}`)); } };
});
jest.mock('../../../../src/components/ConfirmDialog', () => {
    const RN = require('react-native'), ReactLib = require('react');
    return { ConfirmDialog: (props: any) => !props.visible ? null : ReactLib.createElement(RN.View, { testID: 'confirm-dialog' },
        ReactLib.createElement(RN.Text, { testID: 'confirm-dialog-title' }, props.title),
        ReactLib.createElement(RN.Text, { testID: 'confirm-dialog-message' }, props.message),
        props.mode !== 'alert' && ReactLib.createElement(RN.Text, { testID: 'confirm-dialog-cancel', onPress: props.onCancel }, props.cancelLabel || 'Cancel'),
        ReactLib.createElement(RN.Text, { testID: 'confirm-dialog-confirm', onPress: props.mode === 'alert' ? props.onCancel : props.onConfirm }, props.confirmLabel || 'OK')) };
});
jest.mock('../../../../src/services/LocationService', () => ({ locationProvider: {
    requestPermission: jest.fn(async () => 'granted'),
    watchPosition: jest.fn((onFix: any) => { mockWalkCallback = onFix; return { remove: mockWatchRemove }; }),
} }));

async function loaded() {
    render(<GPSMappingScreen />);
    await waitFor(() => expect(screen.getByTestId('map-vertex-count').props.children).toBe('map-vertices-4'));
    await waitFor(() => expect(screen.getByTestId('mapping-mode-boundary')).not.toBeDisabled());
}
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
function pressHandler(id: string) {
    let node = screen.getByTestId(id);
    while (typeof node.props.onPress !== 'function' && node.parent) node = node.parent;
    expect(typeof node.props.onPress).toBe('function');
    return node.props.onPress as () => void;
}
const title = (text: string) => expect(screen.getByTestId('confirm-dialog-title').props.children).toBe(text);
const pointCount = () => Number(String(screen.getByTestId('map-vertex-count').props.children).replace('map-vertices-', ''));
async function confirmSave() { press('save-boundary'); title('Review Measured Area'); press('confirm-dialog-confirm'); }
function deferred<T>() {
    let resolve!: (value: T) => void, reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
async function storedDraft() {
    await AsyncStorage.setItem('parcel-mapping:supervisor:parcel-with-gps', JSON.stringify({ parcelId: 'parcel-with-gps', revision: 0, operationId: 'DUMMY:review-draft', geometry: { outer: mockOuter.slice(0, 3), holes: [] }, blocks: [], mode: 'manual', points: [], closed: false }));
}

beforeEach(async () => {
    jest.clearAllMocks(); mockRegistry = mockParcels; mockRegistryPending = null; mockBlocks = []; mockAssignments = []; mockParams = {}; mockOperatorId = 'supervisor'; mockWalkCallback = null; mockDatabaseError = null; mockBeforeBlocksReturn = null;
    mockSaveLayout.mockReset().mockResolvedValue(1); mockClearBoundary.mockReset().mockResolvedValue(1); await AsyncStorage.clear();
});

describe('map-first parcel mapping', () => {
    it('anchors the map to the viewport token and caps it to the space the column grants', async () => {
        // The browser resize check caught the map frozen at its first-layout pixel height, and
        // the phone fit check then caught the opposite: a 380px map inside a 230px row pushes
        // the save bar over the map and swallows real taps. Height comes from the viewport
        // token, capped by the row the parent grants — never inflated by it.
        await loaded();
        const expected = getResponsiveTokens(...PHONY_VIEWPORT).mapHeight;
        expect(mockMapProps.height).toBe(expected);
        expect(typeof screen.getByTestId('mapping-map-area').props.onLayout).toBe('function');
        act(() => screen.getByTestId('mapping-map-area').props.onLayout({ nativeEvent: { layout: { height: 230, width: 390, x: 0, y: 0 } } }));
        expect(mockMapProps.height).toBe(230);
        act(() => screen.getByTestId('mapping-map-area').props.onLayout({ nativeEvent: { layout: { height: 900, width: 390, x: 0, y: 0 } } }));
        expect(mockMapProps.height).toBe(expected);
    });

    it('floats the phone details sheet over the map so it cannot consume the map row', async () => {
        // Header + search + toolbar + save bar already eat most of a 390x844 column, so an
        // in-flow sheet leaves the map either crushed or off-screen. The sheet must overlay.
        await loaded();
        const sheet = screen.getByTestId('parcel-details-sheet');
        expect(StyleSheet.flatten(sheet.props.style)).toMatchObject({ position: 'absolute' });
    });

    it('keeps the desktop details column in flow beside the map', async () => {
        const layout = jest.spyOn(require('../../../../src/hooks/useResponsiveLayout'), 'useResponsiveLayout')
            .mockImplementation(() => ({ ...getResponsiveTokens(...PHONY_VIEWPORT), isDesktopOrLarger: true }));
        try {
            await loaded();
            const sheet = screen.getByTestId('parcel-details-sheet');
            expect(StyleSheet.flatten(sheet.props.style)?.position).not.toBe('absolute');
        } finally { layout.mockRestore(); }
    });

    it('lets the desktop workspace fill the row container instead of a forced pixel height', async () => {
        const layout = jest.spyOn(require('../../../../src/hooks/useResponsiveLayout'), 'useResponsiveLayout')
            .mockImplementation(() => ({ ...getResponsiveTokens(...PHONY_VIEWPORT), isDesktopOrLarger: true }));
        try {
            await loaded();
            expect(mockMapProps.height).toBeUndefined();
            act(() => screen.getByTestId('mapping-map-area').props.onLayout({ nativeEvent: { layout: { height: 123, width: 1440, x: 0, y: 0 } } }));
            expect(mockMapProps.height).toBeUndefined();
        } finally { layout.mockRestore(); }
    });

    it('exposes web pressed parcel/block selections and checked block filters', async () => {
        const platform = jest.replaceProperty(Platform, 'OS', 'web');
        try {
            mockBlocks = [{ id: 'saved-block', parcelId: 'parcel-with-gps', name: 'North', status: 'active', layoutRevision: 0, geometryJson: JSON.stringify({ outer: mockOuter, holes: [] }) }];
            await loaded();
            expect(screen.getByTestId('parcel-chip-parcel-with-gps').props['aria-pressed']).toBe(true);
            expect(screen.getByTestId('parcel-chip-parcel-no-gps').props['aria-pressed']).toBe(false);
            expect(screen.getByTestId('block-filter-all').props.accessibilityState.checked).toBe(true);
            expect(screen.getByTestId('block-filter-unassigned').props.accessibilityState.checked).toBe(false);
            press('block-filter-unassigned');
            expect(screen.getByTestId('block-filter-all').props.accessibilityState.checked).toBe(false);
            expect(screen.getByTestId('block-filter-unassigned').props.accessibilityState.checked).toBe(true);
            expect(screen.getByTestId('select-block-saved-block').props['aria-pressed']).toBe(false);
            press('select-block-saved-block');
            expect(screen.getByTestId('select-block-saved-block').props['aria-pressed']).toBe(true);
            press('parcel-chip-parcel-no-gps');
            await waitFor(() => expect(pointCount()).toBe(0));
            expect(screen.getByTestId('parcel-chip-parcel-with-gps').props['aria-pressed']).toBe(false);
            expect(screen.getByTestId('parcel-chip-parcel-no-gps').props['aria-pressed']).toBe(true);
        } finally { platform.restore(); }
    });

    it('discloses browser autosave and volatile-storage limits instead of promising crash recovery', async () => {
        const platform = jest.replaceProperty(Platform, 'OS', 'web');
        try {
            await loaded();
            expect(screen.getByTestId('mapping-storage-notice').props.children).toMatch(/private browsing.*autosave.*crash.*copy coordinates/i);
        } finally { platform.restore(); }
    });

    it('refuses saved blocks returned after a storage quarantine and keeps saving disabled', async () => {
        mockBlocks = [{ id: 'unsafe-block', parcelId: 'parcel-with-gps', name: 'Unsafe cached block', status: 'active', layoutRevision: 0, geometryJson: JSON.stringify({ outer: mockOuter, holes: [] }) }];
        mockBeforeBlocksReturn = () => { mockDatabaseError = new Error('Close and reopen persisted storage before retrying.'); };
        render(<GPSMappingScreen />);
        await waitFor(() => expect(screen.getByTestId('mapping-error').props.children).toMatch(/reopen persisted storage/i));
        expect(screen.queryByTestId('select-block-unsafe-block')).toBeNull();
        expect(screen.getByTestId('mapping-mode-boundary')).toBeDisabled();
        press('save-boundary'); expect(mockSaveLayout).not.toHaveBeenCalled();
    });

    it.each(['outside', 'overlap', 'excluded', 'wrong-parcel', 'stale-revision', 'duplicate-id', 'changed-source'])('refuses persisted %s block layouts before map selection or saving', async kind => {
        const block = { id: 'unsafe-block', parcelId: 'parcel-with-gps', name: 'Unsafe persisted block', status: 'active', layoutRevision: 0, geometryJson: JSON.stringify({ outer: mockOuter, holes: [] }) };
        mockBlocks = [block];
        if (kind === 'outside') block.geometryJson = JSON.stringify({ outer: mockOuter.map(p => ({ ...p, longitude: p.longitude + 0.01 })), holes: [] });
        if (kind === 'overlap') mockBlocks.push({ ...block, id: 'overlapping-block' });
        if (kind === 'wrong-parcel') block.parcelId = 'other-parcel';
        if (kind === 'stale-revision') block.layoutRevision = 1;
        if (kind === 'duplicate-id') mockBlocks.push({ ...block });
        if (kind === 'excluded') {
            const pocket = mockOuter.map(p => ({ latitude: 8.0005 + (p.latitude - 8) / 2, longitude: 125.0005 + (p.longitude - 125) / 2 }));
            mockRegistry = [{ ...mockParcels[0], gpsExclusions: JSON.stringify([pocket]) }];
            block.geometryJson = JSON.stringify({ outer: pocket, holes: [] });
        }
        if (kind === 'changed-source') {
            mockRegistry = [{ ...mockParcels[0] }];
            mockBeforeBlocksReturn = () => { mockRegistry[0].layoutRevision = 1; };
        }
        render(<GPSMappingScreen />);
        await waitFor(() => expect(screen.getByTestId('mapping-error').props.children).toMatch(/saved block layout.*safely/i));
        expect(screen.queryByTestId('select-block-unsafe-block')).toBeNull();
        expect(screen.getByTestId('mapping-mode-boundary')).toBeDisabled();
        expect(screen.queryByTestId('clear-saved-boundary')).toBeNull();
        press('save-boundary'); expect(mockSaveLayout).not.toHaveBeenCalled();
    });

    it('loads real coordinates in browse mode and does not expose destructive vertex actions', async () => {
        await loaded(); expect(mockMapProps.editable).toBe(false);
        expect(screen.queryByTestId('remove-vertex-0')).toBeNull();
        act(() => mockMapProps.onChange([])); expect(pointCount()).toBe(4);
        expect(screen.getByTestId('parcel-details-panel')).toBeTruthy();
    });
    it('switches to an empty boundary without stale coordinate bleed', async () => {
        await loaded(); press('parcel-chip-parcel-no-gps');
        await waitFor(() => expect(pointCount()).toBe(0));
        expect(screen.getByTestId('empty-boundary-state')).toBeTruthy();
        expect(mockMapProps.editable).toBe(false);
    });
    it('requires discard confirmation for parcel switching and back navigation', async () => {
        await loaded(); press('mapping-mode-boundary'); press('remove-vertex-0');
        expect(pointCount()).toBe(3); expect(screen.getByTestId('unsaved-badge')).toBeTruthy();
        press('parcel-chip-parcel-no-gps'); title('Unsaved Changes'); press('confirm-dialog-cancel');
        expect(pointCount()).toBe(3);
        press('mapping-back'); title('Unsaved Changes'); expect(mockBack).not.toHaveBeenCalled();
        press('confirm-dialog-cancel'); press('parcel-chip-parcel-no-gps'); press('confirm-dialog-confirm');
        await waitFor(() => expect(pointCount()).toBe(0));
        expect(screen.queryByTestId('unsaved-badge')).toBeNull();
    });
    it('guards external navigation and stops GPS on blur', async () => {
        await loaded(); press('mapping-mode-gps'); press('start-walk');
        await waitFor(() => expect(mockWalkCallback).not.toBeNull());
        act(() => mockWalkCallback!({ coordinate: { latitude: 8.001, longitude: 124.999 }, accuracyMeters: 6, timestamp: Date.now() }));
        const preventDefault = jest.fn();
        act(() => mockListeners.beforeRemove({ preventDefault, data: { action: { type: 'GO_BACK' } } }));
        expect(preventDefault).toHaveBeenCalled(); title('Unsaved Changes');
        act(() => mockListeners.blur({})); expect(mockWatchRemove).toHaveBeenCalled();
    });
    it('rejects partial manual numbers but allows corrective edits', async () => {
        await loaded(); press('mapping-mode-manual');
        fireEvent.changeText(screen.getByTestId('manual-latitude'), '8junk');
        fireEvent.changeText(screen.getByTestId('manual-longitude'), '125'); press('add-vertex');
        expect(pointCount()).toBe(4); expect(screen.getByTestId('vertex-input-error')).toBeTruthy();
        fireEvent.changeText(screen.getByTestId('manual-latitude'), '8.001');
        fireEvent.changeText(screen.getByTestId('manual-longitude'), '124.999'); press('add-vertex');
        expect(pointCount()).toBe(5); expect(screen.queryByTestId('vertex-input-error')).toBeNull();
    });
    it('keeps collinear and crossing boundaries editable rather than crashing render', async () => {
        await loaded(); press('mapping-mode-boundary');
        act(() => mockMapProps.onChange([{ latitude: 8, longitude: 125 }, { latitude: 8, longitude: 125.001 }, { latitude: 8, longitude: 125.002 }]));
        expect(pointCount()).toBe(3); expect(screen.queryByTestId('measured-hectares')).toBeNull();
        press('save-boundary'); title('Boundary Invalid'); expect(mockSaveLayout).not.toHaveBeenCalled();
        press('confirm-dialog-confirm');
        act(() => mockMapProps.onChange([mockOuter[0], mockOuter[2], mockOuter[1], mockOuter[3]]));
        expect(screen.queryByTestId('measured-hectares')).toBeNull();
        press('save-boundary'); title('Boundary Invalid');
        expect(screen.getByTestId('confirm-dialog-message').props.children).toMatch(/cross|intersect/i);
        expect(mockSaveLayout).not.toHaveBeenCalled(); press('confirm-dialog-confirm');
        act(() => mockMapProps.onChange(mockOuter)); expect(screen.getByTestId('measured-hectares')).toBeTruthy();
    });
    it('requires Close boundary before Review and Save while retaining live open-draft measurements', async () => {
        await loaded(); press('mapping-mode-boundary');
        const edited = mockOuter.slice(0, 3);
        act(() => mockMapProps.onChange(edited));
        expect(pointCount()).toBe(3);
        expect(mockMapProps.closed).toBe(false);
        expect(screen.getByTestId('measured-hectares')).toBeTruthy();
        press('save-boundary'); title('Boundary Open');
        expect(screen.getByTestId('confirm-dialog-message').props.children).toMatch(/close boundary/i);
        expect(mockSaveLayout).not.toHaveBeenCalled();
        expect(screen.getByTestId('unsaved-badge')).toBeTruthy();
        expect(mockMapProps.coordinates).toEqual(edited);
        await waitFor(async () => {
            const draft = JSON.parse((await AsyncStorage.getItem('parcel-mapping:supervisor:parcel-with-gps'))!);
            expect(draft.geometry.outer).toEqual(edited);
            expect(draft.closed).toBe(false);
        });
        press('confirm-dialog-confirm'); press('close-boundary');
        expect(mockMapProps.closed).toBe(true);
        await confirmSave();
        await waitFor(() => title('Boundary Saved'));
        expect(mockSaveLayout).toHaveBeenCalledTimes(1);
        expect((mockSaveLayout.mock.calls[0][0] as any).geometry.outer).toEqual(edited);
        press('confirm-dialog-confirm'); press('mapping-mode-boundary');
        act(() => mockMapProps.onChange(mockOuter));
        expect(mockMapProps.closed).toBe(false);
        press('save-boundary'); title('Boundary Open');
        expect(mockSaveLayout).toHaveBeenCalledTimes(1);
        expect(mockMapProps.coordinates).toEqual(mockOuter);
    });
    it('refuses Review in Browse after cancel preserves changed open geometry', async () => {
        await loaded(); press('mapping-mode-boundary'); press('remove-vertex-0');
        press('cancel-boundary-edit');
        expect(mockMapProps.editable).toBe(false);
        expect(mockMapProps.closed).toBe(false);
        expect(screen.getByTestId('unsaved-badge')).toBeTruthy();
        press('save-boundary'); title('Boundary Open');
        expect(mockSaveLayout).not.toHaveBeenCalled();
        expect(pointCount()).toBe(3);
    });
    it('requires an explicit measurement review for unchanged legacy Browse geometry before audited layout persistence', async () => {
        await loaded(); expect(mockMapProps.closed).toBe(true);
        press('save-boundary'); title('Review Measured Area');
        expect(screen.getByTestId('confirm-dialog-message').props.children).toMatch(/4.2000 ha/);
        expect(mockSaveLayout).not.toHaveBeenCalled(); press('confirm-dialog-confirm');
        await waitFor(() => expect(mockSaveLayout).toHaveBeenCalledTimes(1));
        const input = mockSaveLayout.mock.calls[0][0] as any;
        expect(input.parcelId).toBe('parcel-with-gps'); expect(input.geometry.outer).toEqual(mockOuter);
        expect(input.expectedRevision).toBe(0); expect(input.operationId).toMatch(/^[0-9a-f-]{36}$/i);
        await waitFor(() => title('Boundary Saved'));
        expect(screen.getByTestId('confirm-dialog-message').props.children).toMatch(/cloud layout sync is not enabled/i);
    });
    it('blocks incomplete boundaries and does not clear registered hectares implicitly', async () => {
        await loaded(); press('mapping-mode-boundary'); press('remove-vertex-0'); press('remove-vertex-0');
        press('save-boundary'); title('Boundary Incomplete'); expect(mockSaveLayout).not.toHaveBeenCalled();
    });
    it('retains failed save edits and retries the same immutable operation', async () => {
        await loaded(); press('mapping-mode-boundary');
        act(() => mockMapProps.onChange(mockOuter.map(p => ({ ...p, latitude: p.latitude + 0.0001 }))));
        press('close-boundary');
        mockSaveLayout.mockRejectedValueOnce(new Error('boundary write rejected'));
        await confirmSave(); await waitFor(() => title('Save Failed'));
        expect(screen.getByTestId('unsaved-badge')).toBeTruthy(); press('confirm-dialog-confirm');
        await confirmSave(); await waitFor(() => title('Boundary Saved'));
        expect((mockSaveLayout.mock.calls[0][0] as any).operationId).toBe((mockSaveLayout.mock.calls[1][0] as any).operationId);
    });
    it.each(['accepted', 'rejected', 'returned-operator'])('isolates a replacement operator draft from an obsolete %s save', async outcome => {
        const pending = deferred<number>(); mockSaveLayout.mockReturnValueOnce(pending.promise);
        const ui = render(<GPSMappingScreen />);
        await waitFor(() => expect(screen.getByTestId('mapping-mode-boundary')).not.toBeDisabled());
        press('mapping-mode-boundary');
        act(() => mockMapProps.onChange(mockOuter.slice(0, 3)));
        press('close-boundary'); await confirmSave();
        await waitFor(() => expect(screen.getByTestId('save-boundary')).toBeDisabled());
        mockOperatorId = 'replacement-supervisor'; ui.rerender(<GPSMappingScreen />);
        await waitFor(() => expect(screen.getByTestId('mapping-mode-boundary')).not.toBeDisabled());
        if (outcome === 'returned-operator') {
            mockOperatorId = 'supervisor'; ui.rerender(<GPSMappingScreen />);
            await waitFor(() => expect(screen.getByTestId('mapping-mode-boundary')).not.toBeDisabled());
        }
        press('mapping-mode-boundary');
        const replacement = mockOuter.map(p => ({ ...p, latitude: p.latitude + 0.0001 }));
        act(() => mockMapProps.onChange(replacement));
        const key = `parcel-mapping:${mockOperatorId}:parcel-with-gps`;
        await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem(key))!).geometry.outer).toEqual(replacement));
        await act(async () => {
            if (outcome === 'rejected') pending.reject(new Error('DUMMY:obsolete operator failure'));
            else pending.resolve(1);
            await pending.promise.catch(() => {});
        });
        expect(mockMapProps.coordinates).toEqual(replacement);
        expect(screen.getByTestId('unsaved-badge')).toBeTruthy();
        expect(screen.getByText(/4.2000/)).toBeTruthy();
        expect(screen.queryByTestId('confirm-dialog')).toBeNull();
        expect(JSON.parse((await AsyncStorage.getItem(key))!).geometry.outer).toEqual(replacement);
    });

    it('keeps an open parent unfilled during exclusion and requires explicit parent close before acceptance', async () => {
        await loaded(); press('mapping-mode-boundary');
        act(() => mockMapProps.onChange(mockOuter));
        press('mapping-mode-exclude');
        const pocket = [
            { latitude: 8.0005, longitude: 125.0005 }, { latitude: 8.0005, longitude: 125.001 },
            { latitude: 8.001, longitude: 125.001 }, { latitude: 8.001, longitude: 125.0005 },
        ];
        act(() => mockMapProps.onChange(pocket));
        expect(mockMapProps.closed).toBe(false);
        expect(mockMapProps.features.some((feature: any) => feature.id === 'parcel-with-gps')).toBe(false);
        press('accept-exclusion');
        expect(screen.getByTestId('mapping-error').props.children).toMatch(/close boundary/i);
        expect(mockMapProps.coordinates).toEqual(pocket);
        expect(mockSaveLayout).not.toHaveBeenCalled();
        press('close-boundary');
        expect(mockMapProps.features.some((feature: any) => feature.id === 'parcel-with-gps')).toBe(true);
        press('accept-exclusion');
        expect(mockMapProps.closed).toBe(true);
        expect(mockMapProps.holes).toEqual([pocket]);
        await confirmSave(); await waitFor(() => title('Boundary Saved'));
    });
    it('deducts an accepted exclusion and previews every straight-cut piece before save', async () => {
        await loaded(); const original = screen.getByTestId('measured-hectares').props.children;
        press('mapping-mode-exclude');
        act(() => mockMapProps.onChange([
            { latitude: 8.0005, longitude: 125.0005 }, { latitude: 8.0005, longitude: 125.001 },
            { latitude: 8.001, longitude: 125.001 }, { latitude: 8.001, longitude: 125.0005 },
        ]));
        press('accept-exclusion'); expect(screen.getByTestId('measured-hectares').props.children).not.toEqual(original);
        expect(mockMapProps.holes).toHaveLength(1); press('mapping-mode-cut');
        act(() => mockMapProps.onChange([{ latitude: 7.9999, longitude: 125.0015 }, { latitude: 8.0021, longitude: 125.0015 }]));
        press('preview-division'); expect(screen.getAllByLabelText(/Name for piece/)).toHaveLength(2);
        expect(mockSaveLayout).not.toHaveBeenCalled(); press('accept-division');
        await confirmSave(); await waitFor(() => expect(mockSaveLayout).toHaveBeenCalled());
        expect((mockSaveLayout.mock.calls[0][0] as any).blocks).toHaveLength(2);
        await waitFor(() => title('Boundary Saved'));
    });
    it('offers explicit recovery instead of silently applying a saved draft', async () => {
        await AsyncStorage.setItem('parcel-mapping:supervisor:parcel-with-gps', JSON.stringify({ parcelId: 'parcel-with-gps', revision: 0, operationId: 'draft-op', geometry: { outer: mockOuter.slice(0, 3), holes: [] }, blocks: [], mode: 'boundary', points: [], closed: false }));
        await loaded(); expect(pointCount()).toBe(4); press('recover-mapping-draft');
        expect(pointCount()).toBe(3); expect(screen.getByTestId('unsaved-badge')).toBeTruthy();
    });
    it('shows the unassigned remainder and filters blocks by independent task statuses', async () => {
        const west = [mockOuter[0], { latitude: 8, longitude: 125.001 }, { latitude: 8.002, longitude: 125.001 }, mockOuter[3]];
        mockBlocks = [{ id: 'west', name: 'West', parcelId: 'parcel-with-gps', status: 'active', layoutRevision: 0, geometryJson: JSON.stringify({ outer: west, holes: [] }) }];
        mockAssignments = [{ id: 'task', blockId: 'west', status: 'in_progress', progressPercent: 40, dueDate: new Date(0) }];
        await loaded();
        await waitFor(() => expect(screen.getByTestId('block-filter-overdue')).toBeTruthy());
        expect(mockMapProps.features.some((f: any) => f.name.includes('Unassigned remainder'))).toBe(true);
        press('block-filter-overdue');
        expect(mockMapProps.features.some((f: any) => f.id === 'west' && f.status === 'overdue')).toBe(true);
        press('block-filter-completed');
        expect(mockMapProps.features.some((f: any) => f.id === 'west')).toBe(false);
        expect(screen.queryByTestId('select-block-west')).toBeNull();
    });
    it('requires explicit confirmation to clear corrupt saved geometry while retaining recorded hectares', async () => {
        mockRegistry = [{ ...mockParcels[0], gpsCoordinates: '[{"latitude":"bad","longitude":125}]' }];
        render(<GPSMappingScreen />);
        await waitFor(() => expect(screen.getByTestId('clear-saved-boundary')).toBeTruthy());
        expect(screen.getByTestId('mapping-mode-boundary')).toBeDisabled();
        press('mapping-mode-boundary'); expect(mockMapProps.editable).toBe(false);
        press('clear-saved-boundary'); title('Clear Saved Boundary');
        expect(mockClearBoundary).not.toHaveBeenCalled();
        press('confirm-dialog-cancel'); expect(mockClearBoundary).not.toHaveBeenCalled();
        press('clear-saved-boundary'); press('confirm-dialog-confirm');
        await waitFor(() => title('Saved Boundary Cleared'));
        expect(mockClearBoundary).toHaveBeenCalledWith(expect.objectContaining({ parcelId: 'parcel-with-gps', expectedRevision: 0, operationId: expect.any(String) }), expect.anything(), 'supervisor');
        expect(screen.getByTestId('parcel-details-panel')).toBeTruthy();
        expect(screen.getByText(/4.2000/)).toBeTruthy();
        expect(pointCount()).toBe(0);
        expect(screen.getByTestId('mapping-mode-boundary').props.disabled).not.toBe(true);
    });

    it('locks recovery and editor mutations synchronously during a deferred clear and reconciles saved geometry', async () => {
        await storedDraft();
        const pending = deferred<number>(); mockClearBoundary.mockReturnValueOnce(pending.promise);
        const ui = render(<GPSMappingScreen />);
        await waitFor(() => expect(screen.getByTestId('mapping-mode-manual')).not.toBeDisabled());
        press('mapping-mode-manual');
        fireEvent.changeText(screen.getByTestId('manual-latitude'), '8.001');
        fireEvent.changeText(screen.getByTestId('manual-longitude'), '124.999');
        const editor = ui.UNSAFE_getByType(BoundaryEditorPanel).props;
        const recover = pressHandler('recover-mapping-draft');
        const discardStored = pressHandler('discard-mapping-draft');
        press('clear-saved-boundary');
        const confirm = screen.getByTestId('confirm-dialog-confirm').props.onPress;
        act(() => { confirm(); recover(); discardStored(); editor.onDelete(0); editor.onManual('8.001', '124.999'); editor.onClose(); editor.onCancel(); });
        expect(mockMapProps.coordinates).toEqual(mockOuter);
        expect(screen.queryByTestId('unsaved-badge')).toBeNull();
        expect(screen.getByTestId('recover-mapping-draft')).toBeDisabled();
        expect(screen.getByTestId('discard-mapping-draft')).toBeDisabled();
        expect(screen.getByTestId('mapping-mode-manual')).toBeDisabled();
        expect(screen.getByTestId('save-boundary')).toBeDisabled();
        expect(mockMapProps.editable).toBe(false);
        expect(screen.getByText(/4.2000/)).toBeTruthy();
        press('remove-vertex-0'); press('add-vertex'); press('mapping-undo'); press('mapping-redo');
        press('close-boundary'); press('clear-boundary'); press('cancel-boundary-edit'); press('recover-mapping-draft');
        act(() => mockMapProps.onChange([]));
        expect(screen.queryByTestId('confirm-dialog')).toBeNull();
        expect(mockMapProps.coordinates).toEqual(mockOuter);
        expect(screen.getByTestId('manual-latitude').props.value).toBe('8.001');
        expect(screen.getByTestId('manual-longitude').props.value).toBe('124.999');
        expect(screen.getByTestId('boundary-editor-panel')).toBeTruthy();
        await act(async () => { pending.resolve(3); await pending.promise; });
        await waitFor(() => title('Saved Boundary Cleared'));
        expect(pointCount()).toBe(0); expect(screen.queryByTestId('unsaved-badge')).toBeNull();
        expect(screen.getByText(/4.2000/)).toBeTruthy();
        expect(screen.getByTestId('mapping-mode-boundary')).not.toBeDisabled();
        expect(screen.queryByTestId('recover-mapping-draft')).toBeNull();
        await waitFor(async () => expect(await AsyncStorage.getItem('parcel-mapping:supervisor:parcel-with-gps')).toBeNull());
        press('confirm-dialog-confirm'); press('mapping-mode-boundary');
        act(() => mockMapProps.onChange(mockOuter)); press('close-boundary'); await confirmSave();
        await waitFor(() => title('Boundary Saved'));
        expect(mockSaveLayout.mock.calls[0][0]).toEqual(expect.objectContaining({ expectedRevision: 3 }));
    });

    it('owns one deferred clear at a time and retains its retry UUID and unchanged editor after failure', async () => {
        const pending = deferred<number>(); mockClearBoundary.mockReturnValueOnce(pending.promise);
        await loaded(); press('mapping-mode-manual');
        fireEvent.changeText(screen.getByTestId('manual-latitude'), '8.001');
        press('clear-saved-boundary');
        const confirm = screen.getByTestId('confirm-dialog-confirm').props.onPress;
        act(() => { confirm(); confirm(); });
        expect(mockClearBoundary).toHaveBeenCalledTimes(1);
        await act(async () => { pending.reject(new Error('DUMMY:clear write rejected')); await pending.promise.catch(() => {}); });
        await waitFor(() => title('Clear Failed'));
        expect(mockMapProps.coordinates).toEqual(mockOuter);
        expect(screen.getByTestId('manual-latitude').props.value).toBe('8.001');
        expect(screen.queryByTestId('unsaved-badge')).toBeNull();
        expect(screen.getByText(/4.2000/)).toBeTruthy();
        expect(screen.getByTestId('mapping-mode-manual')).not.toBeDisabled();
        const first = mockClearBoundary.mock.calls[0][0];
        expect(first.operationId).toMatch(/^[0-9a-f-]{36}$/i);
        press('confirm-dialog-confirm'); press('clear-saved-boundary'); press('confirm-dialog-confirm');
        await waitFor(() => title('Saved Boundary Cleared'));
        expect(mockClearBoundary.mock.calls[1][0]).toEqual(first);
        expect(pointCount()).toBe(0); expect(screen.getByText(/4.2000/)).toBeTruthy();
        press('confirm-dialog-confirm'); press('clear-saved-boundary'); press('confirm-dialog-confirm');
        await waitFor(() => title('Saved Boundary Cleared'));
        expect(mockClearBoundary.mock.calls[2][0].expectedRevision).toBe(1);
        expect(mockClearBoundary.mock.calls[2][0].operationId).not.toBe(first.operationId);
    });

    it('does not start a stale clear confirmation after the edit ownership has changed', async () => {
        await storedDraft(); await loaded();
        press('clear-saved-boundary');
        const confirm = screen.getByTestId('confirm-dialog-confirm').props.onPress;
        press('recover-mapping-draft');
        expect(screen.getByTestId('unsaved-badge')).toBeTruthy();
        act(() => confirm());
        expect(mockClearBoundary).not.toHaveBeenCalled();
        expect(mockMapProps.coordinates).toEqual(mockOuter.slice(0, 3));
        expect(screen.getByText(/4.2000/)).toBeTruthy();
    });

    it('does not let an unmounted deferred clear erase a replacement workspace durable draft', async () => {
        await storedDraft();
        const pending = deferred<number>(); mockClearBoundary.mockReturnValueOnce(pending.promise);
        const first = render(<GPSMappingScreen />);
        await waitFor(() => expect(screen.getByTestId('clear-saved-boundary')).not.toBeDisabled());
        press('clear-saved-boundary'); press('confirm-dialog-confirm'); first.unmount();
        await loaded(); press('recover-mapping-draft');
        const replacement = mockOuter.map(p => ({ ...p, latitude: p.latitude + 0.0001 }));
        act(() => mockMapProps.onChange(replacement));
        await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('parcel-mapping:supervisor:parcel-with-gps'))!).geometry.outer).toEqual(replacement));
        await act(async () => { pending.resolve(1); await pending.promise; });
        expect(mockMapProps.coordinates).toEqual(replacement);
        expect(screen.getByTestId('unsaved-badge')).toBeTruthy();
        expect(screen.queryByTestId('confirm-dialog')).toBeNull();
        expect(screen.getByText(/4.2000/)).toBeTruthy();
        const raw = await AsyncStorage.getItem('parcel-mapping:supervisor:parcel-with-gps');
        expect(raw).not.toBeNull(); expect(JSON.parse(raw!).geometry.outer).toEqual(replacement);
    });

    it('loads saved blocks at the same revision and opens supervisor tasks in the inspector', async () => {
        mockBlocks = [{ id: 'saved-block', parcelId: 'parcel-with-gps', name: 'North', status: 'active', layoutRevision: 0, geometryJson: JSON.stringify({ outer: mockOuter, holes: [] }) }];
        await loaded();
        await waitFor(() => expect(screen.getByTestId('select-block-saved-block')).toBeTruthy());
        press('select-block-saved-block'); press('assign-block-workers');
        await waitFor(() => expect(screen.getByText('North · Supervisor tasks')).toBeTruthy());
        expect(mockPush).not.toHaveBeenCalled();
        expect(screen.getByText(/Unassigned block/)).toBeTruthy();
    });

    it('blocks cached registry reads when database recovery is required', async () => {
        mockDatabaseError = new Error('Storage result uncertain. Close and reopen the app before reading or retrying.');
        render(<GPSMappingScreen />);
        await waitFor(() => expect(screen.getByText(/Close and reopen the app/)).toBeTruthy());
        expect(screen.queryByTestId('parcel-map-mock')).toBeNull();
        expect(screen.queryByTestId('register-mapping-parcel')).toBeNull();
    });
    it('does not replace the selected task panel while its submission is in flight', async () => {
        const middleWest = { latitude: 8.001, longitude: 125 }, middleEast = { latitude: 8.001, longitude: 125.002 };
        const halves = [[middleWest, middleEast, mockOuter[2], mockOuter[3]], [mockOuter[0], mockOuter[1], middleEast, middleWest]];
        mockBlocks = ['North', 'South'].map((name, index) => ({ id: name, parcelId: 'parcel-with-gps', name, status: 'active', layoutRevision: 0, geometryJson: JSON.stringify({ outer: halves[index], holes: [] }) }));
        const ui = render(<GPSMappingScreen />);
        await waitFor(() => expect(screen.getByTestId('select-block-North')).toBeTruthy());
        press('select-block-North'); press('assign-block-workers');
        await waitFor(() => expect(screen.getByText('North · Supervisor tasks')).toBeTruthy());
        act(() => ui.UNSAFE_getByType(BlockMonitoringPanel).props.onBusy(true));
        press('select-block-South');
        act(() => mockMapProps.onFeatureSelect('South'));
        expect(mockMapProps.selectedFeatureId).toBe('North');
        expect(screen.queryByText('South · Supervisor tasks')).toBeNull();
        act(() => ui.UNSAFE_getByType(BlockMonitoringPanel).props.onBusy(false));
    });
    it('keeps the workspace locked while replacement callbacks share an outstanding busy owner', async () => {
        mockBlocks = [{ id: 'saved-block', parcelId: 'parcel-with-gps', name: 'North', status: 'active', layoutRevision: 0, geometryJson: JSON.stringify({ outer: mockOuter, holes: [] }) }];
        const ui = render(<GPSMappingScreen />);
        await waitFor(() => expect(screen.getByTestId('select-block-saved-block')).toBeTruthy());
        press('select-block-saved-block'); press('assign-block-workers');
        await waitFor(() => expect(screen.getByText('North · Supervisor tasks')).toBeTruthy());
        const oldBusy = ui.UNSAFE_getByType(BlockMonitoringPanel).props.onBusy;
        act(() => oldBusy(true));
        const newBusy = ui.UNSAFE_getByType(BlockMonitoringPanel).props.onBusy;
        act(() => newBusy(true));
        act(() => oldBusy(false));
        expect(screen.getByTestId('mapping-mode-boundary')).toBeDisabled();
        press('parcel-chip-parcel-no-gps');
        expect(screen.getByTestId('parcel-chip-parcel-with-gps').props.accessibilityState.selected).toBe(true);
        act(() => newBusy(false));
        expect(screen.getByTestId('mapping-mode-boundary')).not.toBeDisabled();
        press('parcel-chip-parcel-no-gps');
        await waitFor(() => expect(pointCount()).toBe(0));
    });
    it('offers map registration when the registry is empty', async () => {
        mockRegistry = []; render(<GPSMappingScreen />);
        await waitFor(() => expect(screen.getByTestId('register-mapping-parcel')).toBeTruthy());
        press('register-mapping-parcel'); expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(admin)/agribusiness/parcels', params: { mapRegistration: '1' } }));
    });
    it('preserves parcelId deep links', async () => {
        mockParams = { parcelId: 'parcel-no-gps' }; render(<GPSMappingScreen />);
        await waitFor(() => expect(pointCount()).toBe(0)); expect(screen.getByTestId('empty-boundary-state')).toBeTruthy();
    });
    it('selects the latest valid A-to-B route while the initial registry fetch is deferred', async () => {
        const pending = deferred<typeof mockParcels>(); mockRegistryPending = pending.promise;
        mockParams = { parcelId: 'parcel-with-gps' };
        const ui = render(<GPSMappingScreen />);
        expect(screen.getByLabelText('Loading parcels')).toBeTruthy();
        mockParams = { parcelId: 'parcel-no-gps' }; ui.rerender(<GPSMappingScreen />);
        expect(screen.queryByTestId('parcel-map-mock')).toBeNull();
        await act(async () => { pending.resolve(mockParcels); await pending.promise; });
        await waitFor(() => expect(screen.getByTestId('mapping-mode-boundary')).not.toBeDisabled());
        expect(screen.getByTestId('parcel-chip-parcel-no-gps').props.accessibilityState.selected).toBe(true);
        expect(pointCount()).toBe(0); expect(screen.getByText(/0.0000/)).toBeTruthy();
        expect(screen.queryByTestId('unsaved-badge')).toBeNull();
        expect(screen.queryByTestId('confirm-dialog')).toBeNull();
        expect(mockSaveLayout).not.toHaveBeenCalled(); expect(mockClearBoundary).not.toHaveBeenCalled();
    });
    it('keeps a valid initial selection when the latest deferred registry route is unknown', async () => {
        const pending = deferred<typeof mockParcels>(); mockRegistryPending = pending.promise;
        mockParams = { parcelId: 'parcel-with-gps' };
        const ui = render(<GPSMappingScreen />);
        mockParams = { parcelId: 'DUMMY:unknown-parcel' }; ui.rerender(<GPSMappingScreen />);
        await act(async () => { pending.resolve(mockParcels); await pending.promise; });
        await waitFor(() => expect(screen.getByTestId('mapping-mode-boundary')).not.toBeDisabled());
        expect(screen.getByTestId('parcel-chip-parcel-with-gps').props.accessibilityState.selected).toBe(true);
        expect(mockMapProps.coordinates).toEqual(mockOuter); expect(screen.getByText(/4.2000/)).toBeTruthy();
    });
    it('honours changed parcel route parameters without stale selection', async () => {
        const ui = render(<GPSMappingScreen />);
        await waitFor(() => expect(screen.getByTestId('mapping-mode-boundary')).not.toBeDisabled());
        mockParams = { parcelId: 'parcel-no-gps' };
        ui.rerender(<GPSMappingScreen />);
        await waitFor(() => expect(pointCount()).toBe(0));
        expect(screen.getByTestId('empty-boundary-state')).toBeTruthy();
    });
    it('guards changed parcel route parameters while the current draft is dirty', async () => {
        const ui = render(<GPSMappingScreen />);
        await waitFor(() => expect(screen.getByTestId('mapping-mode-boundary')).not.toBeDisabled());
        press('mapping-mode-boundary'); press('remove-vertex-0');
        mockParams = { parcelId: 'parcel-no-gps' };
        ui.rerender(<GPSMappingScreen />);
        await waitFor(() => title('Unsaved Changes'));
        expect(pointCount()).toBe(3);
        press('confirm-dialog-confirm');
        await waitFor(() => expect(pointCount()).toBe(0));
    });
    it('rejects a corrupt saved two-point boundary instead of treating it as measured land', async () => {
        mockRegistry = [{ ...mockParcels[0], gpsCoordinates: JSON.stringify(mockOuter.slice(0, 2)) }];
        render(<GPSMappingScreen />);
        await waitFor(() => expect(screen.getByTestId('mapping-error').props.children).toMatch(/needs review/i));
        expect(screen.getByTestId('mapping-mode-boundary')).toBeDisabled();
        expect(mockSaveLayout).not.toHaveBeenCalled();
    });
});
