import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { MappingToolbar } from '../MappingToolbar';
import { ParcelDetailsPanel } from '../ParcelDetailsPanel';
import { BoundaryEditorPanel } from '../BoundaryEditorPanel';
import { BlockDivisionPanel } from '../BlockDivisionPanel';

const coordinates = [{ latitude: 8, longitude: 125 }, { latitude: 8.001, longitude: 125 }];

describe('mapping panels', () => {
    it('exposes explicit browse/edit actions with accessible button labels', () => {
        const onMode = jest.fn();
        const { getByLabelText } = render(<MappingToolbar mode="browse" onMode={onMode} onCurrentPosition={jest.fn()} onAssign={jest.fn()} disabled={false} />);
        fireEvent.press(getByLabelText('Draw boundary'));
        expect(onMode).toHaveBeenCalledWith('boundary');
        fireEvent.press(getByLabelText('Browse parcels'));
        expect(onMode).toHaveBeenCalledWith('browse');
    });

    it('flips web aria-pressed on rerender while preserving button names and native selection', () => {
        const originalOS = Platform.OS;
        Platform.OS = 'web';
        try {
            const props = { onMode: jest.fn(), onCurrentPosition: jest.fn(), onAssign: jest.fn() };
            const ui = render(<MappingToolbar mode="browse" {...props} />);
            const expectModes = (selected: string) => {
                const modes = ['browse', 'boundary', 'gps', 'manual', 'exclude', 'cut', 'block'];
                modes.forEach(mode => {
                    expect(ui.getByTestId(`mapping-mode-${mode}`).props['aria-pressed']).toBe(mode === selected);
                    expect(ui.getByTestId(`mapping-mode-${mode}`).props.accessibilityState.selected).toBe(mode === selected);
                });
            };
            expectModes('browse');
            expect(ui.getByRole('button', { name: 'Browse parcels' })).toBeTruthy();
            fireEvent.press(ui.getByRole('button', { name: 'Record GPS' }));
            expect(props.onMode).toHaveBeenCalledWith('gps');
            ui.rerender(<MappingToolbar mode="gps" {...props} />);
            expectModes('gps');
            expect(ui.getByRole('button', { name: 'Add current position' }).props['aria-pressed']).toBeUndefined();
            expect(ui.getByRole('button', { name: 'Assign workers' }).props['aria-pressed']).toBeUndefined();
        } finally {
            Platform.OS = originalOS;
        }
    });

    it('keeps aria-pressed off native toolbar buttons', () => {
        const originalOS = Platform.OS;
        Platform.OS = 'ios';
        try {
            const ui = render(<MappingToolbar mode="browse" onMode={jest.fn()} onCurrentPosition={jest.fn()} onAssign={jest.fn()} />);
            expect(ui.getByTestId('mapping-mode-browse').props['aria-pressed']).toBeUndefined();
            expect(ui.getByTestId('mapping-mode-browse').props.accessibilityState.selected).toBe(true);
            expect(ui.getByTestId('mapping-mode-gps').props.accessibilityState.selected).toBe(false);
        } finally {
            Platform.OS = originalOS;
        }
    });

    it('distinguishes outer perimeter, total boundaries and representative coordinates', () => {
        const { getByText, getByLabelText } = render(<ParcelDetailsPanel name="Test parcel" registeredArea={1.2} measurements={{ areaSquareMeters: 10000, areaHectares: 1, outerPerimeterMeters: 400, totalBoundaryMeters: 500, edgeLengthsMeters: [], labelCoordinate: { latitude: 8, longitude: 125 } }} onCopy={jest.fn()} onOpenMaps={jest.fn()} />);
        expect(getByText('10,000 m²')).toBeTruthy();
        expect(getByText('Outer perimeter')).toBeTruthy();
        expect(getByText('Total boundary length')).toBeTruthy();
        expect(getByText(/not a guaranteed entrance/)).toBeTruthy();
        expect(getByLabelText('Open representative coordinate in maps')).toBeTruthy();
    });

    it('selects coordinate rows and removes only by an explicit delete action', () => {
        const onSelect = jest.fn(), onDelete = jest.fn();
        const { getByTestId } = render(<BoundaryEditorPanel points={coordinates} onSelect={onSelect} onDelete={onDelete} onManual={jest.fn()} onUndo={jest.fn()} onRedo={jest.fn()} onClose={jest.fn()} onCancel={jest.fn()} onClear={jest.fn()} />);
        fireEvent.press(getByTestId('select-vertex-0'));
        expect(onSelect).toHaveBeenCalledWith(0);
        expect(onDelete).not.toHaveBeenCalled();
        fireEvent.press(getByTestId('remove-vertex-0'));
        expect(onDelete).toHaveBeenCalledWith(0);
    });

    it('previews all names and remainder before committing a division', () => {
        const onAccept = jest.fn();
        const blocks = [{ id: 'b1', name: 'Block 1', geometry: { outer: [{ latitude: 8, longitude: 125 }, { latitude: 8.001, longitude: 125 }, { latitude: 8.001, longitude: 125.001 }], holes: [] } }];
        const { getByTestId, getByText } = render(<BlockDivisionPanel mode="cut" preview={{ blocks, remainder: [] }} onPreview={jest.fn()} onAccept={onAccept} onCancel={jest.fn()} />);
        expect(getByText('No unassigned remainder')).toBeTruthy();
        fireEvent.changeText(getByTestId('block-name-b1'), 'North field');
        fireEvent.press(getByTestId('accept-division'));
        expect(onAccept).toHaveBeenCalledWith(['North field']);
    });
});
