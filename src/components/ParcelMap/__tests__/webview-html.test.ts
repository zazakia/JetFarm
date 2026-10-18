import { buildParcelMapHtml } from '../webview-html';

// Execute the generated app-owned bootstrap, not a duplicate of its logic.
function bootstrap() {
    const messages: any[] = [];
    const layers: any[] = [];
    const handlers: Record<string, (...args: any[]) => void> = {};
    const map: any = {
        setView: jest.fn().mockReturnThis(), fitBounds: jest.fn(), invalidateSize: jest.fn(),
        removeLayer: jest.fn(), getZoom: () => 17, distance: () => 10,
        on: (event: string, callback: (...args: any[]) => void) => { handlers[event] = callback; },
    };
    const layer = (kind: string, position?: any, options?: any): any => {
        const result: any = {
            kind, position, options, handlers: {},
            addTo: () => { layers.push(result); return result; },
            on: (event: string, callback: any) => { result.handlers[event] = callback; return result; },
            bindTooltip: (content: any, opts: any) => { result.tooltip = { content, options: opts }; return result; },
            setLatLng: (value: any) => { result.position = value; return result; },
            setContent: (value: any) => { result.content = value; return result; },
            getLatLng: () => ({ lat: 8, lng: 125 }),
        };
        return result;
    };
    const L: any = {
        map: () => map, layerGroup: () => ({ addTo: function() { return this; }, clearLayers: () => { layers.length = 0; } }),
        polygon: (position: any, options: any) => layer('polygon', position, options),
        polyline: (position: any, options: any) => layer('polyline', position, options),
        marker: (position: any, options: any) => layer('marker', position, options),
        tooltip: (options: any) => layer('tooltip', null, options),
        circleMarker: (position: any, options: any) => layer('circle', position, options),
        tileLayer: () => layer('tile'), divIcon: (options: any) => options,
        latLngBounds: () => ({ pad: () => ({}) }), DomEvent: { stopPropagation: jest.fn((event: any) => {
            // Mirrors leaflet-src.js DomEvent.stopPropagation: only the Leaflet wrapper
            // event sets originalEvent._stopped; a real DOM event gets native stop only.
            if (event.stopPropagation) { event.stopPropagation(); }
            else if (event.originalEvent) { event.originalEvent._stopped = true; }
            else { event.cancelBubble = true; }
        }) },
    };
    const window: any = { ReactNativeWebView: { postMessage: (json: string) => messages.push(JSON.parse(json)) } };
    const document: any = { createElement: () => ({ textContent: '', className: '' }) };
    const script = buildParcelMapHtml().match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeDefined();
    Function('L', 'window', 'document', script!)(L, window, document);
    // Leaflet routes noninteractive areas to the map, and stops interactive clicks
    // on either _stopped or bubblingMouseEvents=false. Run the generated handlers.
    const clickLayer = (target: any) => {
        const originalEvent: any = { stopPropagation: jest.fn() };
        const event = { originalEvent, latlng: { lat: 8.0005, lng: 125.0005 } };
        if (target.options.interactive !== false) {
            target.handlers.click?.(event);
            if (originalEvent._stopped || target.options.bubblingMouseEvents === false) return;
        }
        handlers.click(event);
    };
    return { map, layers, handlers, L, window, messages, clickLayer };
}

const coordinates = [{ latitude: 8, longitude: 125 }, { latitude: 8.001, longitude: 125 }];

describe('generated native Leaflet bootstrap', () => {
    it('parses the entire generated inline JavaScript', () => {
        const scripts = [...buildParcelMapHtml().matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(script => script.trim());
        expect(scripts).toHaveLength(1);
        scripts.forEach(script => expect(() => Function(script)).not.toThrow());
    });

    it.each(['parcel', 'block'] as const)('selects %s areas in browse, draws through them in edit, and restores selection', kind => {
        const run = bootstrap();
        const feature = { id: 'DUMMY: saved-feature', name: 'DUMMY: saved area', kind, coordinates: [...coordinates, { latitude: 8.001, longitude: 125.001 }] };
        const state = { coordinates: [], features: [feature], revision: 1, editable: false };
        run.window.updateParcel(state);
        run.clickLayer(run.layers.find(layer => layer.kind === 'polygon'));
        expect(run.messages.at(-1)).toEqual({ type: 'selectFeature', id: feature.id, revision: 1 });
        run.messages.length = 0;

        run.window.updateParcel({ ...state, editable: true, revision: 2 });
        run.clickLayer(run.layers.find(layer => layer.kind === 'polygon'));
        expect(run.messages).toEqual([{ type: 'add', latitude: 8.0005, longitude: 125.0005, revision: 2 }]);
        run.messages.length = 0;
        run.clickLayer(run.layers.find(layer => layer.kind === 'tooltip'));
        expect(run.messages).toHaveLength(0);

        run.window.updateParcel({ ...state, revision: 3 });
        run.clickLayer(run.layers.find(layer => layer.kind === 'polygon'));
        expect(run.messages).toEqual([{ type: 'selectFeature', id: feature.id, revision: 3 }]);
    });

    it.each([true, false])('consumes live-dot clicks with editable=%s without changing background clicks', editable => {
        const run = bootstrap();
        run.window.updateParcel({ coordinates, editable, revision: 5 });
        run.window.setLiveCoordinate(coordinates[0]);
        const liveDot = run.layers.find(layer => layer.kind === 'circle');
        run.messages.length = 0;
        run.clickLayer(liveDot);
        expect(run.messages).toHaveLength(0);
        expect(run.L.DomEvent.stopPropagation).toHaveBeenCalledTimes(1);
        run.handlers.click({ latlng: { lat: 8.0005, lng: 125.0005 } });
        expect(run.messages).toEqual(editable ? [{ type: 'add', latitude: 8.0005, longitude: 125.0005, revision: 5 }] : []);
        run.window.setLiveCoordinate(null);
        expect(run.map.removeLayer).toHaveBeenCalledWith(liveDot);
    });

    it('keeps edge-length pills pointer-transparent while vertices stay tappable during drawing', () => {
        // A 38.2 m pill sat on top of a vertex in the browser run and swallowed the tap:
        // informational labels must never intercept the pointer from a vertex or the map.
        const run = bootstrap();
        run.window.updateParcel({ coordinates, editable: true, showEdgeLengths: true, revision: 6 });
        run.messages.length = 0;
        const edge = run.layers.find(layer => layer.kind === 'marker' && layer.options.icon?.className === 'parcel-edge');
        expect(edge).toBeDefined();
        expect(edge.options.interactive).toBe(false);
        expect(buildParcelMapHtml()).toMatch(/\.parcel-edge\{[^}]*pointer-events:none/);
        run.layers.filter(layer => layer.kind === 'marker').forEach(run.clickLayer);
        expect(run.messages).toEqual([
            { type: 'selectVertex', index: 0, revision: 6 },
            { type: 'selectVertex', index: 1, revision: 6 },
            { type: 'add', latitude: 8.0005, longitude: 125.0005, revision: 6 },
        ]);
    });

    it('boots and fits geometry arriving after the initial empty state only once', () => {
        const run = bootstrap();
        expect(run.messages[0].type).toBe('ready');
        run.window.updateParcel({ coordinates: [], revision: 1, selectedFeatureId: 'p1' });
        run.window.updateParcel({ coordinates, revision: 2, selectedFeatureId: 'p1', editable: true, closed: false });
        expect(run.map.fitBounds).toHaveBeenCalledTimes(1);
        expect(run.layers.find(layer => layer.kind === 'polyline')?.position).toEqual([[8, 125], [8.001, 125]]);
        run.window.updateParcel({ coordinates: [...coordinates, { latitude: 8.002, longitude: 125 }], revision: 3, selectedFeatureId: 'p1' });
        expect(run.map.fitBounds).toHaveBeenCalledTimes(1);
    });

    it('renders safe interactive labels at the supplied interior point without adding vertices', () => {
        const run = bootstrap();
        run.window.updateParcel({ coordinates: [], revision: 4, editable: true, features: [{ id: 'p1', name: '<img onerror=evil()>', kind: 'parcel', coordinates: [...coordinates, { latitude: 8.001, longitude: 125.001 }], labelCoordinate: { latitude: 8.0005, longitude: 125.0002 } }] });
        const label = run.layers.find(layer => layer.kind === 'tooltip');
        expect(label?.position).toEqual([8.0005, 125.0002]);
        expect(label?.content.textContent).toBe('<img onerror=evil()>');
        expect(label?.options.interactive).toBe(true);
        label.handlers.click({ originalEvent: {} });
        expect(run.L.DomEvent.stopPropagation).toHaveBeenCalled();
        expect(run.messages.filter(message => message.type === 'add')).toHaveLength(0);
    });

    it('wraps repeated-world clicks and uses a 44-point native vertex hit target', () => {
        const run = bootstrap();
        run.window.updateParcel({ coordinates, editable: true, revision: 7 });
        run.handlers.click({ latlng: { lat: 8, lng: 485 } });
        expect(run.messages.at(-1)).toEqual({ type: 'add', latitude: 8, longitude: 125, revision: 7 });
        const marker = run.layers.find(layer => layer.kind === 'marker');
        expect(marker.options.icon.iconSize).toEqual([44, 44]);
    });
});
