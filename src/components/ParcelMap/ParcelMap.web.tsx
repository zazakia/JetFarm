import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import L from 'leaflet';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ParcelMapFeature, ParcelMapProps } from './types';
import { GPSCoordinate, distanceMeters, isValidCoordinate } from '../../utils/coordinates';
import { PARCEL_MAP_DEFAULT_CENTER } from './webview-html';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { Colors } from '../../constants/colors';

const positions = (coords: GPSCoordinate[]): [number, number][] => coords.map(c => [c.latitude, c.longitude]);
const featureColor = (feature: ParcelMapFeature) => feature.selected ? Colors.error : feature.kind === 'parcel' || feature.status === 'completed' ? Colors.success : feature.status === 'in_progress' ? Colors.info : Colors.warning;
const vertexIcon = (index: number, selected: boolean) => L.divIcon({
    className: 'parcel-vertex-icon',
    html: `<div data-vertex-index="${index}" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center"><div style="width:${selected ? 22 : 16}px;height:${selected ? 22 : 16}px;border-radius:50%;background:${selected ? Colors.info : Colors.error};border:2px solid ${Colors.surface};box-sizing:border-box"></div></div>`,
    iconSize: [44, 44], iconAnchor: [22, 22],
});

function MapViewport({ coordinates, features, selectedFeatureId, fitRequest, height }: ParcelMapProps & { height: number }) {
    const map = useMap();
    const lastKey = useRef('');
    useEffect(() => {
        const key = `${selectedFeatureId ?? ''}|${fitRequest ?? 0}`;
        if (key === lastKey.current) return;
        const target = features?.find(feature => feature.id === selectedFeatureId)?.coordinates ?? coordinates;
        if (target.length === 0) return;
        lastKey.current = key;
        if (target.length === 1) map.setView(positions(target)[0], 17);
        else map.fitBounds(L.latLngBounds(positions(target)).pad(0.15));
    }, [coordinates, features, selectedFeatureId, fitRequest, map]);
    useEffect(() => { map.invalidateSize(); }, [height, map]);
    return null;
}

function mapCoordinate(latitude: number, rawLongitude: number): GPSCoordinate | null {
    if (!Number.isFinite(rawLongitude)) return null;
    const longitude = rawLongitude >= -180 && rawLongitude <= 180 ? rawLongitude : ((rawLongitude + 180) % 360 + 360) % 360 - 180;
    return isValidCoordinate(latitude, longitude) ? { latitude, longitude } : null;
}

function MapGestures({ editable, coordinates, onChange }: ParcelMapProps) {
    useMapEvents({ click: event => {
        const point = mapCoordinate(event.latlng.lat, event.latlng.lng);
        if (editable && onChange && point) onChange([...coordinates, point]);
    } });
    return null;
}

function EdgeLabels({ coordinates, closed }: { coordinates: GPSCoordinate[]; closed: boolean }) {
    const map = useMap();
    const [zoom, setZoom] = useState(map.getZoom());
    useEffect(() => {
        const update = () => setZoom(map.getZoom());
        map.on('zoomend', update);
        return () => { map.off('zoomend', update); };
    }, [map]);
    if (zoom < 15 || coordinates.length < 2) return null;
    const count = closed ? coordinates.length : coordinates.length - 1;
    return <>{coordinates.slice(0, count).map((a, index) => {
        const b = coordinates[(index + 1) % coordinates.length];
        const meters = distanceMeters(a, b);
        const icon = L.divIcon({ className: 'parcel-edge-length', html: `<span style="font:12px sans-serif;padding:3px 5px;border-radius:5px;background:${Colors.surface};color:${Colors.text};white-space:nowrap">${meters.toFixed(1)} m</span>`, iconSize: [70, 20], iconAnchor: [35, 10] });
        return <Marker key={`edge-${index}`} position={[(a.latitude + b.latitude) / 2, (a.longitude + b.longitude) / 2]} icon={icon}
            bubblingMouseEvents={false} eventHandlers={{ click: event => { if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent); } }} />;
    })}</>;
}

export function ParcelMap(props: ParcelMapProps) {
    const layout = useResponsiveLayout();
    const { coordinates, onChange, editable = false, liveCoordinate = null, features = [], holes = [] } = props;
    const mapHeight = props.height ?? layout.mapHeight;
    const closed = props.closed ?? coordinates.length >= 3;
    const boundary = useMemo(() => [positions(coordinates), ...holes.map(positions)], [coordinates, holes]);

    return (
        <View style={{ height: mapHeight, width: '100%', borderRadius: 12, overflow: 'hidden' }} testID="parcel-map">
            <MapContainer center={PARCEL_MAP_DEFAULT_CENTER} zoom={13} style={{ height: '100%', width: '100%' }} attributionControl>
                <TileLayer key={props.mapLayer ?? 'satellite'}
                    attribution={props.mapLayer === 'street' ? '&copy; OpenStreetMap contributors' : 'Tiles &copy; Esri, Maxar, Earthstar Geographics'}
                    url={props.mapLayer === 'street' ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'} maxZoom={19} />
                <MapViewport {...props} height={mapHeight} />
                <MapGestures {...props} editable={editable} />
                {features.filter(feature => feature.coordinates.length >= 3).map(feature => {
                    const label = feature.labelCoordinate ?? feature.coordinates[0];
                    const select: L.LeafletEventHandlerFn = event => {
                        const originalEvent = (event as L.LeafletMouseEvent).originalEvent;
                        if (originalEvent) L.DomEvent.stopPropagation(originalEvent);
                        if (!editable) props.onFeatureSelect?.(feature.id);
                    };
                    return <React.Fragment key={feature.id}>
                        {/* Leaflet creates interactive SVG targets on mount; remount only the area when drawing toggles. */}
                        <Polygon key={editable ? 'drawing' : 'browse'} positions={[positions(feature.coordinates), ...(feature.holes ?? []).map(positions)]}
                            interactive={!editable} bubblingMouseEvents={false}
                            pathOptions={{ color: featureColor(feature), fillColor: featureColor(feature), fillOpacity: feature.selected ? 0.22 : 0.18, weight: feature.selected ? 4 : 2, dashArray: feature.kind === 'block' ? '5 3' : undefined }}
                            eventHandlers={{ click: select }} />
                        <Marker position={[label.latitude, label.longitude]} bubblingMouseEvents={false}
                            icon={L.divIcon({ className: 'parcel-label-anchor', html: '', iconSize: [0, 0] })} eventHandlers={{ click: select }}>
                            <Tooltip position={[label.latitude, label.longitude]} permanent interactive
                                direction="center" opacity={0.9} eventHandlers={{ click: select }}>
                                {feature.selected ? 'Selected · ' : ''}{feature.name}{feature.areaHectares != null ? ` · ${feature.areaHectares.toFixed(2)} ha` : ''}
                            </Tooltip>
                        </Marker>
                    </React.Fragment>;
                })}
                {coordinates.length >= 2 && (closed && coordinates.length >= 3
                    ? <Polygon positions={boundary} interactive={false} pathOptions={{ color: Colors.error, weight: 4, fillColor: Colors.success, fillOpacity: 0.22 }} />
                    : <Polyline positions={boundary[0]} interactive={false} pathOptions={{ color: Colors.error, weight: 3, dashArray: '6 5' }} />)}
                {editable && coordinates.map((coordinate, index) => (
                    <Marker key={index} position={[coordinate.latitude, coordinate.longitude]}
                        icon={vertexIcon(index, props.selectedVertexIndex === index)} draggable bubblingMouseEvents={false}
                        eventHandlers={{
                            dragend: event => {
                                const point = (event.target as L.Marker).getLatLng();
                                const accepted = mapCoordinate(point.lat, point.lng);
                                if (accepted) onChange?.(coordinates.map((old, i) => i === index ? accepted : old));
                            },
                            click: event => {
                                if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
                                props.onVertexSelect?.(index);
                            },
                        }} />
                ))}
                {props.showEdgeLengths && <EdgeLabels coordinates={coordinates} closed={closed} />}
                {liveCoordinate && <CircleMarker center={[liveCoordinate.latitude, liveCoordinate.longitude]} radius={7}
                    bubblingMouseEvents={false} eventHandlers={{ click: event => { if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent); } }}
                    pathOptions={{ color: Colors.info, fillColor: Colors.info, fillOpacity: 0.7, weight: 2 }} />}
            </MapContainer>
        </View>
    );
}
export default ParcelMap;
