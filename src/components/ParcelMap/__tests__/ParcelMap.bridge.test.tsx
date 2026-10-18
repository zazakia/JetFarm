import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { ParcelMap } from '../ParcelMap';

const mockInject = jest.fn();
let mockWebViewProps: any;
jest.mock('react-native-webview', () => {
    const ReactLib = require('react');
    const { View } = require('react-native');
    return {
        WebView: ReactLib.forwardRef((props: any, ref: any) => {
            mockWebViewProps = props;
            ReactLib.useImperativeHandle(ref, () => ({ injectJavaScript: mockInject }));
            return ReactLib.createElement(View, { testID: props.testID });
        }),
    };
});

const coords = [{ latitude: 8, longitude: 125 }, { latitude: 8.001, longitude: 125 }];
const send = (message: unknown) => act(() => mockWebViewProps.onMessage({ nativeEvent: { data: JSON.stringify(message) } }));
const latestPayload = () => {
    let payload: any;
    for (const [script] of mockInject.mock.calls) {
        Function('window', script)({ updateParcel: (value: unknown) => { payload = value; }, setLiveCoordinate: () => {} });
    }
    return payload;
};

describe('native ParcelMap bridge', () => {
    beforeEach(() => jest.clearAllMocks());

    it('allows retry after an offline failure and gates edits until reloaded ready', () => {
        const onChange = jest.fn();
        const { getByTestId, queryByTestId } = render(<ParcelMap coordinates={coords} editable onChange={onChange} />);
        send({ type: 'ready' });
        const revision = latestPayload().revision;
        send({ type: 'error' });
        expect(getByTestId('parcel-map-offline')).toBeTruthy();
        send({ type: 'add', latitude: 8, longitude: 125, revision });
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.press(getByTestId('parcel-map-retry'));
        expect(queryByTestId('parcel-map-offline')).toBeNull();
        mockInject.mockClear();
        send({ type: 'add', latitude: 8, longitude: 125, revision });
        expect(onChange).not.toHaveBeenCalled();
        send({ type: 'ready' });
        expect(latestPayload().coordinates).toEqual(coords);
    });

    it('republishes the latest state and live coordinate after a WebView reload', () => {
        const live = { latitude: 8, longitude: 125 };
        render(<ParcelMap coordinates={coords} liveCoordinate={live} />);
        send({ type: 'ready' });
        act(() => mockWebViewProps.onLoadStart());
        mockInject.mockClear();
        send({ type: 'ready' });
        expect(latestPayload().coordinates).toEqual(coords);
        expect(mockInject.mock.calls.some(([script]) => script.includes(JSON.stringify(live)))).toBe(true);
    });

    it('pushes changed geometry and live position after ready without another ready event', () => {
        const { rerender } = render(<ParcelMap coordinates={coords} editable onChange={jest.fn()} />);
        send({ type: 'ready' });
        const next = [...coords, { latitude: 8.001, longitude: 125.001 }];
        const live = { latitude: 8.0005, longitude: 125.0005 };
        rerender(<ParcelMap coordinates={next} editable liveCoordinate={live} onChange={jest.fn()} />);
        expect(latestPayload().coordinates).toEqual(next);
        expect(mockInject.mock.calls.some(([script]) => script.includes(JSON.stringify(live)))).toBe(true);
    });

    it('rejects mutations in browse mode even if a WebView sends one', () => {
        const onChange = jest.fn();
        render(<ParcelMap coordinates={coords} editable={false} onChange={onChange} />);
        send({ type: 'ready' });
        send({ type: 'add', latitude: 8, longitude: 125, revision: latestPayload()?.revision });
        expect(onChange).not.toHaveBeenCalled();
    });

    it('rejects stale, out-of-range and malformed edits', () => {
        const onChange = jest.fn();
        render(<ParcelMap coordinates={coords} editable onChange={onChange} />);
        send({ type: 'ready' });
        const revision = latestPayload()?.revision;
        send({ type: 'add', latitude: 8, longitude: 125, revision: revision - 1 });
        send({ type: 'add', latitude: 98, longitude: 125, revision });
        send({ type: 'move', index: 99, latitude: 8, longitude: 125, revision });
        act(() => mockWebViewProps.onMessage({ nativeEvent: { data: '{broken' } }));
        expect(onChange).not.toHaveBeenCalled();
    });

    it('selects a vertex rather than deleting it on tap', () => {
        const onChange = jest.fn();
        const onVertexSelect = jest.fn();
        render(<ParcelMap coordinates={coords} editable onChange={onChange} onVertexSelect={onVertexSelect} />);
        send({ type: 'ready' });
        send({ type: 'selectVertex', index: 0, revision: latestPayload()?.revision });
        expect(onVertexSelect).toHaveBeenCalledWith(0);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('applies valid current-state moves to the latest coordinates', () => {
        const onChange = jest.fn();
        render(<ParcelMap coordinates={coords} editable onChange={onChange} />);
        send({ type: 'ready' });
        send({ type: 'move', index: 1, latitude: 8.002, longitude: 125, revision: latestPayload()?.revision });
        expect(onChange).toHaveBeenCalledWith([coords[0], { latitude: 8.002, longitude: 125 }]);
    });

    it('rejects an in-flight add from a previous tool when only the edit intent changed', () => {
        // Empty-outline tool switches serialize to an identical map state; without the
        // intent epoch the revision stays the same and the stale add would be accepted
        // by the newly-selected tool.
        const onChange = jest.fn();
        const { rerender } = render(<ParcelMap coordinates={[]} editable intent={1} onChange={onChange} />);
        send({ type: 'ready' });
        const staleRevision = latestPayload().revision;
        rerender(<ParcelMap coordinates={[]} editable intent={2} onChange={onChange} />);
        send({ type: 'add', latitude: 8, longitude: 125, revision: staleRevision });
        expect(onChange).not.toHaveBeenCalled();
        send({ type: 'add', latitude: 8, longitude: 125, revision: latestPayload().revision });
        expect(onChange).toHaveBeenCalledTimes(1);
    });
});
