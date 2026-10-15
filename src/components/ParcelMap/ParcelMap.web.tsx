import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import L from 'leaflet';
import {
    MapContainer,
    TileLayer,
    Polygon,
    Marker,
    CircleMarker,
    useMap,
    useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ParcelMapProps, PARCEL_MAP_DEFAULT_HEIGHT } from './types';
import { GPSCoordinate } from '../../utils/coordinates';
import { PARCEL_MAP_DEFAULT_CENTER } from './webview-html';

const PARCEL_COLOR = '#0F766E';
const LIVE_COLOR = '#2563EB';

const vertexIcon = (index: number) =>
    L.divIcon({
        className: 'parcel-vertex-icon',
        html: `<div data-vertex-index="${index}" style="width:14px;height:14px;border-radius:7px;background:${PARCEL_COLOR};border:2px solid #FFFFFF;box-sizing:border-box;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
    });

/** Fits the map to the polygon whenever the vertex list materially changes. */
function FitBounds({ coordinates }: { coordinates: GPSCoordinate[] }) {
    const map = useMap();
    const lastSig = useRef('');

    useEffect(() => {
        const sig = coordinates.map((c) => `${c.latitude.toFixed(6)},${c.longitude.toFixed(6)}`).join('|');
        if (sig === lastSig.current) return;
        lastSig.current = sig;

        if (coordinates.length === 0) {
            map.setView(PARCEL_MAP_DEFAULT_CENTER, 13);
        } else if (coordinates.length === 1) {
            map.setView([coordinates[0].latitude, coordinates[0].longitude], 16);
        } else {
            const bounds = L.latLngBounds(coordinates.map((c) => [c.latitude, c.longitude] as [number, number]));
            map.fitBounds(bounds.pad(0.15));
        }
    }, [coordinates, map]);

    return null;
}

/** Forwards map clicks as vertex additions when editable. */
function MapGestures({ editable, coordinates, onChange }: {
    editable: boolean;
    coordinates: GPSCoordinate[];
    onChange?: (next: GPSCoordinate[]) => void;
}) {
    useMapEvents({
        click: (e) => {
            if (!editable || !onChange) return;
            onChange([...coordinates, { latitude: e.latlng.lat, longitude: e.latlng.lng }]);
        },
    });
    return null;
}

export function ParcelMap({
    coordinates,
    onChange,
    editable = false,
    height = PARCEL_MAP_DEFAULT_HEIGHT,
    liveCoordinate = null,
}: ParcelMapProps) {
    const positions = useMemo(
        () => coordinates.map((c) => [c.latitude, c.longitude] as [number, number]),
        [coordinates]
    );

    return (
        <View
            style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden' }}
            testID="parcel-map"
        >
            <MapContainer
                center={PARCEL_MAP_DEFAULT_CENTER}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                attributionControl
            >
                <TileLayer
                    attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    maxZoom={19}
                />
                <FitBounds coordinates={coordinates} />
                <MapGestures editable={editable} coordinates={coordinates} onChange={onChange} />
                {positions.length >= 2 && (
                    <Polygon
                        positions={positions}
                        pathOptions={{ color: PARCEL_COLOR, weight: 2, fillColor: PARCEL_COLOR, fillOpacity: 0.2 }}
                    />
                )}
                {editable
                    ? coordinates.map((c, i) => (
                        <Marker
                            key={`${i}-${c.latitude.toFixed(6)}-${c.longitude.toFixed(6)}`}
                            position={[c.latitude, c.longitude]}
                            icon={vertexIcon(i)}
                            draggable
                            eventHandlers={{
                                dragend: (e) => {
                                    const ll = (e.target as L.Marker).getLatLng();
                                    onChange?.(coordinates.map((prev, idx) => (idx === i ? { latitude: ll.lat, longitude: ll.lng } : prev)));
                                },
                                click: () => {
                                    onChange?.(coordinates.filter((_, idx) => idx !== i));
                                },
                            }}
                        />
                    ))
                    : coordinates.map((c, i) => (
                        <Marker
                            key={`${i}-${c.latitude.toFixed(6)}-${c.longitude.toFixed(6)}`}
                            position={[c.latitude, c.longitude]}
                            icon={vertexIcon(i)}
                            interactive={false}
                        />
                    ))}
                {liveCoordinate && (
                    <CircleMarker
                        center={[liveCoordinate.latitude, liveCoordinate.longitude]}
                        radius={7}
                        pathOptions={{ color: LIVE_COLOR, fillColor: LIVE_COLOR, fillOpacity: 0.7, weight: 2 }}
                    />
                )}
            </MapContainer>
        </View>
    );
}

export default ParcelMap;
