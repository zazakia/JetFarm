import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { buildParcelMapHtml, ParcelMapMessage } from './webview-html';
import { ParcelMapProps, PARCEL_MAP_DEFAULT_HEIGHT } from './types';
import { GPSCoordinate } from '../../utils/coordinates';

/**
 * Native ParcelMap: Leaflet rendered inside a WebView.
 * The WebView forwards add/move/remove gestures via postMessage; React Native
 * remains the single source of truth for coordinates.
 */
export function ParcelMap({
    coordinates,
    onChange,
    editable = false,
    height = PARCEL_MAP_DEFAULT_HEIGHT,
    liveCoordinate = null,
}: ParcelMapProps) {
    const webViewRef = useRef<WebView>(null);
    const html = useMemo(() => buildParcelMapHtml(), []);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const pushState = useCallback(
        (coords: GPSCoordinate[], isEditable: boolean) => {
            webViewRef.current?.injectJavaScript(
                `window.updateParcel && window.updateParcel(${JSON.stringify({
                    coordinates: coords,
                    editable: isEditable,
                })}); true;`
            );
        },
        []
    );

    const pushLive = useCallback((coordinate: GPSCoordinate | null) => {
        webViewRef.current?.injectJavaScript(
            `window.setLiveCoordinate && window.setLiveCoordinate(${JSON.stringify(coordinate)}); true;`
        );
    }, []);

    const handleMessage = useCallback(
        (event: WebViewMessageEvent) => {
            let msg: ParcelMapMessage;
            try {
                msg = JSON.parse(event.nativeEvent.data);
            } catch {
                return;
            }
            if (msg.type === 'add' && msg.latitude != null && msg.longitude != null && onChangeRef.current) {
                onChangeRef.current([...coordinates, { latitude: msg.latitude, longitude: msg.longitude }]);
            } else if (msg.type === 'move' && msg.index != null && onChangeRef.current) {
                const next = coordinates.map((c, i) =>
                    i === msg.index ? { latitude: msg.latitude!, longitude: msg.longitude! } : c
                );
                onChangeRef.current(next);
            } else if (msg.type === 'remove' && msg.index != null && onChangeRef.current) {
                onChangeRef.current(coordinates.filter((_, i) => i !== msg.index));
            } else if (msg.type === 'ready') {
                pushState(coordinates, editable);
                pushLive(liveCoordinate);
            }
        },
        [coordinates, editable, liveCoordinate, pushState, pushLive]
    );

    return (
        <View style={[styles.container, { height }]}>
            <WebView
                ref={webViewRef}
                source={{ html }}
                originWhitelist={['*']}
                onMessage={handleMessage}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                style={styles.webview}
                testID="parcel-map-webview"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        overflow: 'hidden',
        borderRadius: 12,
        backgroundColor: '#E5E7EB',
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
});

export default ParcelMap;
