import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { buildParcelMapHtml, ParcelMapMessage } from './webview-html';
import { ParcelMapProps } from './types';
import { isValidCoordinate } from '../../utils/coordinates';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { Colors } from '../../constants/colors';

/** Native Leaflet bridge. The React owner, never a WebView message, owns geometry/persistence. */
export function ParcelMap(props: ParcelMapProps) {
    const { coordinates, height, liveCoordinate = null } = props;
    const layout = useResponsiveLayout();
    const mapHeight = height ?? layout.mapHeight;
    const webViewRef = useRef<WebView>(null);
    const ready = useRef(false);
    const revision = useRef(0);
    const latest = useRef(props);
    latest.current = props;
    const [failed, setFailed] = useState(false);
    const html = useMemo(() => buildParcelMapHtml(), []);
    const state = JSON.stringify({
        coordinates, holes: props.holes ?? [], editable: props.editable ?? false,
        features: props.features ?? [], selectedVertexIndex: props.selectedVertexIndex ?? null,
        selectedFeatureId: props.selectedFeatureId ?? '', fitRequest: props.fitRequest ?? 0,
        showEdgeLengths: props.showEdgeLengths ?? false, mapLayer: props.mapLayer ?? 'satellite',
        closed: props.closed ?? coordinates.length >= 3,
        // Tool switches with an empty outline serialize identically without this epoch,
        // which would leave the bridge revision unchanged and accept a stale in-flight add.
        intent: props.intent ?? 0,
    });
    const serialized = useRef(state);
    serialized.current = state;
    const pushState = useCallback(() => {
        if (!ready.current) return;
        const payload = { ...JSON.parse(serialized.current), revision: revision.current };
        const json = JSON.stringify(payload).replace(/</g, '\\u003c');
        webViewRef.current?.injectJavaScript(`window.updateParcel && window.updateParcel(${json}); true;`);
    }, []);
    const pushLive = useCallback(() => {
        if (!ready.current) return;
        webViewRef.current?.injectJavaScript(
            `window.setLiveCoordinate && window.setLiveCoordinate(${JSON.stringify(latest.current.liveCoordinate ?? null)}); true;`
        );
    }, []);
    useEffect(() => { revision.current += 1; pushState(); }, [state, pushState]);
    useEffect(pushLive, [liveCoordinate, pushLive]);

    const handleMessage = useCallback((event: WebViewMessageEvent) => {
        const raw = event.nativeEvent.data;
        if (typeof raw !== 'string' || raw.length > 4096) return;
        let msg: ParcelMapMessage;
        try { msg = JSON.parse(raw); } catch { return; }
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'ready') { ready.current = true; setFailed(false); pushState(); pushLive(); return; }
        if (msg.type === 'error') { ready.current = false; revision.current += 1; setFailed(true); return; }
        if (!ready.current || msg.revision !== revision.current) return;
        const current = latest.current;
        if (msg.type === 'selectFeature') {
            if (typeof msg.id === 'string' && current.features?.some(feature => feature.id === msg.id)) current.onFeatureSelect?.(msg.id);
            return;
        }
        if (!current.editable) return;
        if (msg.type === 'selectVertex') {
            if (Number.isInteger(msg.index) && msg.index! >= 0 && msg.index! < current.coordinates.length) current.onVertexSelect?.(msg.index!);
            return;
        }
        if (!current.onChange || typeof msg.latitude !== 'number' || typeof msg.longitude !== 'number' || !isValidCoordinate(msg.latitude, msg.longitude)) return;
        const coordinate = { latitude: msg.latitude, longitude: msg.longitude };
        if (msg.type === 'add') current.onChange([...current.coordinates, coordinate]);
        else if (msg.type === 'move' && Number.isInteger(msg.index) && msg.index! >= 0 && msg.index! < current.coordinates.length) {
            current.onChange(current.coordinates.map((old, index) => index === msg.index ? coordinate : old));
        }
    }, [pushLive, pushState]);

    return (
        <View style={[styles.container, { height: mapHeight }]} testID="parcel-map-container">
            {failed ? (
                <View className="flex-1 bg-gray-100 p-4" testID="parcel-map-offline">
                    <Text className="text-gray-900 font-bold">Map unavailable</Text>
                    <Text className="text-gray-600 mt-2">Coordinates and GPS recording still work. Reconnect to load satellite imagery.</Text>
                    {coordinates.slice(0, 8).map((coordinate, index) => (
                        <Text key={index} className="text-gray-900 mt-1">{index + 1}. {coordinate.latitude.toFixed(6)}, {coordinate.longitude.toFixed(6)}</Text>
                    ))}
                    <Pressable testID="parcel-map-retry" accessibilityRole="button" accessibilityLabel="Retry loading map"
                        className="mt-3 min-h-12 bg-green-800 rounded-lg p-3 justify-center items-center"
                        onPress={() => { ready.current = false; revision.current += 1; setFailed(false); }}>
                        <Text className="text-white font-bold">Retry map</Text>
                    </Pressable>
                </View>
            ) : (
                <WebView ref={webViewRef} source={{ html }}
                    originWhitelist={['about:*', 'https://unpkg.com', 'https://server.arcgisonline.com', 'https://*.tile.openstreetmap.org']}
                    onMessage={handleMessage} onError={() => { ready.current = false; revision.current += 1; setFailed(true); }}
                    onLoadStart={() => { ready.current = false; revision.current += 1; }}
                    onShouldStartLoadWithRequest={request => !request.isTopFrame || request.url === 'about:blank' || request.url.startsWith('about:srcdoc')}
                    javaScriptEnabled domStorageEnabled startInLoadingState style={styles.webview} testID="parcel-map-webview" />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { width: '100%', overflow: 'hidden', borderRadius: 12, backgroundColor: Colors.border },
    webview: { flex: 1, backgroundColor: 'transparent' },
});
export default ParcelMap;
