import React from 'react';
import { act, render } from '@testing-library/react-native';
import { ParcelMap } from '../ParcelMap.web';

let mockMarkers: any[] = [];
let mockPolygons: any[] = [];
let mockPolylines: any[] = [];
let mockTooltips: any[] = [];
let mockLiveDots: any[] = [];
let mockGestures: any;
const mockMap = { setView: jest.fn(), fitBounds: jest.fn(), invalidateSize: jest.fn(), getZoom: () => 17, on: jest.fn(), off: jest.fn() };
jest.mock('leaflet/dist/leaflet.css', () => ({}));
jest.mock('leaflet', () => ({
    __esModule: true,
    default: { divIcon: (options: any) => options, latLngBounds: () => ({ pad: () => ({}) }), DomEvent: { stopPropagation: jest.fn((event: any) => {
        // Mirrors leaflet-src.js DomEvent.stopPropagation: a real DOM event only gets
        // native stopPropagation (no _stopped flag); only the Leaflet wrapper event sets
        // originalEvent._stopped, which is what map._fireDOMEvent checks to stop bubbling.
        if (event.stopPropagation) { event.stopPropagation(); }
        else if (event.originalEvent) { event.originalEvent._stopped = true; }
        else { event.cancelBubble = true; }
    }) } },
}));
jest.mock('react-leaflet', () => {
    const ReactLib = require('react');
    const { View } = require('react-native');
    return {
        MapContainer: ({ children }: any) => ReactLib.createElement(View, null, children),
        TileLayer: () => null,
        Polygon: (props: any) => {
            // React-Leaflet creates interactive SVG targets on mount, not on prop updates.
            const interactiveAtMount = ReactLib.useRef(props.interactive !== false).current;
            mockPolygons.push({ ...props, interactiveAtMount });
            return props.children ?? null;
        },
        Polyline: (props: any) => { mockPolylines.push(props); return null; },
        Marker: (props: any) => { mockMarkers.push(props); return props.children ?? null; },
        CircleMarker: (props: any) => { mockLiveDots.push(props); return null; },
        Tooltip: (props: any) => { mockTooltips.push(props); return null; },
        useMap: () => mockMap,
        useMapEvents: (events: any) => { mockGestures = events; return mockMap; },
    };
});
const coords = [{ latitude: 8, longitude: 125 }, { latitude: 8.001, longitude: 125 }];
const clickPoint = { lat: 8.0005, lng: 125.0005 };

// Route captured handlers with Leaflet's interactive-target / _stopped / bubbling rules.
// The browser spec separately proves real SVG hit-testing with ordinary pointer clicks.
function clickLayer(layer: any) {
    const originalEvent: any = { stopPropagation: jest.fn() };
    const event = { originalEvent, latlng: clickPoint };
    const interactive = layer.interactiveAtMount ?? layer.interactive !== false;
    if (interactive) {
        layer.eventHandlers?.click?.(event);
        if (originalEvent._stopped || layer.bubblingMouseEvents === false) return;
    }
    mockGestures.click(event);
}

describe('web ParcelMap interactions', () => {
    beforeEach(() => { jest.clearAllMocks(); mockMarkers = []; mockPolygons = []; mockPolylines = []; mockTooltips = []; mockLiveDots = []; });

    it.each(['parcel', 'block'] as const)('selects %s areas in browse, draws through them in edit, and restores selection', kind => {
        const onChange = jest.fn(), onFeatureSelect = jest.fn();
        const feature = { id: 'DUMMY: saved-feature', name: 'DUMMY: saved area', kind, coordinates: [...coords, { latitude: 8.001, longitude: 125.001 }] };
        const props = { coordinates: [], features: [feature], onChange, onFeatureSelect };
        const { rerender } = render(<ParcelMap {...props} />);
        act(() => clickLayer(mockPolygons.at(-1)));
        expect(onFeatureSelect).toHaveBeenCalledWith(feature.id);
        expect(onChange).not.toHaveBeenCalled();

        onFeatureSelect.mockClear();
        rerender(<ParcelMap {...props} editable />);
        act(() => clickLayer(mockPolygons.at(-1)));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith([{ latitude: clickPoint.lat, longitude: clickPoint.lng }]);
        expect(onFeatureSelect).not.toHaveBeenCalled();
        onChange.mockClear();
        act(() => clickLayer(mockTooltips.at(-1)));
        act(() => clickLayer(mockMarkers.at(-1)));
        expect(onFeatureSelect).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();

        rerender(<ParcelMap {...props} editable={false} />);
        act(() => clickLayer(mockPolygons.at(-1)));
        expect(onFeatureSelect).toHaveBeenCalledTimes(1);
        expect(onChange).not.toHaveBeenCalled();
    });

    it.each([true, false])('consumes live-dot clicks with editable=%s without changing background clicks', editable => {
        const onChange = jest.fn(), onFeatureSelect = jest.fn(), onVertexSelect = jest.fn();
        render(<ParcelMap coordinates={coords} editable={editable} liveCoordinate={coords[0]} onChange={onChange} onFeatureSelect={onFeatureSelect} onVertexSelect={onVertexSelect} />);
        act(() => clickLayer(mockLiveDots[0]));
        expect(onChange).not.toHaveBeenCalled();
        expect(onFeatureSelect).not.toHaveBeenCalled();
        expect(onVertexSelect).not.toHaveBeenCalled();
        expect(require('leaflet').default.DomEvent.stopPropagation).toHaveBeenCalledTimes(1);
        act(() => mockGestures.click({ latlng: clickPoint }));
        expect(onChange).toHaveBeenCalledTimes(editable ? 1 : 0);
        if (editable) expect(onChange).toHaveBeenCalledWith([...coords, { latitude: clickPoint.lat, longitude: clickPoint.lng }]);
    });

    it('keeps edge-length pills pointer-transparent while vertices stay tappable during drawing', () => {
        // Playwright caught a 38.2 m pill intercepting the first vertex tap at close zoom:
        // an informational pill must never sit between the pointer and a vertex or the map.
        const onChange = jest.fn(), onVertexSelect = jest.fn();
        render(<ParcelMap coordinates={coords} editable showEdgeLengths onChange={onChange} onVertexSelect={onVertexSelect} />);
        const edgeMarkers = mockMarkers.filter(marker => marker.icon?.className === 'parcel-edge-length');
        expect(edgeMarkers).toHaveLength(1); // open 2-point line: one edge label
        expect(edgeMarkers[0].interactive).toBe(false);
        const element: any = { style: {} };
        edgeMarkers[0].eventHandlers.add({ target: { getElement: () => element } });
        expect(element.style.pointerEvents).toBe('none');
        act(() => mockMarkers.forEach(clickLayer));
        expect(onVertexSelect.mock.calls).toEqual([[0], [1]]);
        // The pill no longer consumes its click, so a map tap under it adds a point.
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith([...coords, { latitude: clickPoint.lat, longitude: clickPoint.lng }]);
    });

    it('tags each saved feature outline with a per-parcel path class so E2E can tell neighbors apart', () => {
        // A deep-linked unmapped parcel shares the overlay pane with saved neighbors;
        // only a per-feature class lets a test assert "this parcel has no own boundary".
        const featureA = { id: 'parcel-a', name: 'Saved A', kind: 'parcel' as const, coordinates: [...coords, { latitude: 8.001, longitude: 125.001 }] };
        const featureB = { id: 'parcel-b', name: 'Block B', kind: 'block' as const, coordinates: [...coords, { latitude: 8.001, longitude: 125.001 }] };
        render(<ParcelMap coordinates={[]} features={[featureA, featureB]} onChange={jest.fn()} />);
        expect(mockPolygons.map(p => p.pathOptions.className)).toEqual(['feature-boundary-parcel-a', 'feature-boundary-parcel-b']);
        // pathOptions.className alone never reaches the DOM: react-leaflet creates the
        // Leaflet polygon before pathOptions are merged, and setStyle() does not re-apply
        // class. The 'add' handler must put the class on the real SVG path element.
        const fakePaths = mockPolygons.map(() => {
            const classes: string[] = [];
            // add() is called detached (el.classList.add(c)) — closure, not this.
            return { classes, classList: { add: (c: string) => { classes.push(c); } } };
        });
        mockPolygons.forEach((polygon, index) => polygon.eventHandlers.add({ target: { getElement: () => fakePaths[index] } }));
        expect(fakePaths.map(path => path.classes)).toEqual([['feature-boundary-parcel-a'], ['feature-boundary-parcel-b']]);
    });

    it('renders a two-point boundary as an open polyline', () => {
        render(<ParcelMap coordinates={coords} editable onChange={jest.fn()} />);
        expect(mockPolygons).toHaveLength(0);
        expect(mockPolylines).toHaveLength(1);
        expect(mockPolylines[0].positions).toEqual([[8, 125], [8.001, 125]]);
    });

    it('anchors interactive labels at the supplied interior position and consumes their clicks', () => {
        const onChange = jest.fn();
        const onFeatureSelect = jest.fn();
        const feature = { id: 'p1', name: '<safe label>', kind: 'parcel' as const, coordinates: [...coords, { latitude: 8.001, longitude: 125.001 }], labelCoordinate: { latitude: 8.0005, longitude: 125.0002 } };
        render(<ParcelMap coordinates={[]} features={[feature]} onChange={onChange} onFeatureSelect={onFeatureSelect} />);
        expect(mockTooltips[0].interactive).toBe(true);
        expect(mockTooltips[0].position).toEqual([8.0005, 125.0002]);
        act(() => mockTooltips[0].eventHandlers.click({ originalEvent: {} }));
        expect(require('leaflet').default.DomEvent.stopPropagation).toHaveBeenCalled();
        expect(onFeatureSelect).toHaveBeenCalledWith('p1');
        expect(onChange).not.toHaveBeenCalled();
    });

    it('normalizes repeated-world longitudes and rejects invalid click or drag positions', () => {
        const onChange = jest.fn();
        render(<ParcelMap coordinates={coords} editable onChange={onChange} />);
        act(() => mockGestures.click({ latlng: { lat: 8, lng: 485 } }));
        expect(onChange).toHaveBeenLastCalledWith([...coords, { latitude: 8, longitude: 125 }]);
        onChange.mockClear();
        act(() => mockGestures.click({ latlng: { lat: NaN, lng: 125 } }));
        act(() => mockMarkers[0].eventHandlers.dragend({ target: { getLatLng: () => ({ lat: 92, lng: 125 }) } }));
        expect(onChange).not.toHaveBeenCalled();
        act(() => mockMarkers[0].eventHandlers.dragend({ target: { getLatLng: () => ({ lat: 8.002, lng: 485 }) } }));
        expect(onChange).toHaveBeenCalledWith([{ latitude: 8.002, longitude: 125 }, coords[1]]);
    });

    it('selects a vertex without deleting it', () => {
        const onChange = jest.fn();
        const onVertexSelect = jest.fn();
        render(<ParcelMap coordinates={coords} editable onChange={onChange} onVertexSelect={onVertexSelect} />);
        act(() => mockMarkers[0].eventHandlers.click({ originalEvent: {} }));
        expect(onVertexSelect).toHaveBeenCalledWith(0);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('does not reframe on every coordinate edit', () => {
        const { rerender } = render(<ParcelMap coordinates={coords} selectedFeatureId="p1" onChange={jest.fn()} editable />);
        const count = mockMap.fitBounds.mock.calls.length;
        rerender(<ParcelMap coordinates={[...coords, { latitude: 8.001, longitude: 125.001 }]} selectedFeatureId="p1" onChange={jest.fn()} editable />);
        expect(mockMap.fitBounds).toHaveBeenCalledTimes(count);
    });

    it('ignores map clicks in browse mode', () => {
        const onChange = jest.fn();
        render(<ParcelMap coordinates={coords} editable={false} onChange={onChange} />);
        act(() => mockGestures.click({ latlng: { lat: 8.1, lng: 125.1 } }));
        expect(onChange).not.toHaveBeenCalled();
    });
});
