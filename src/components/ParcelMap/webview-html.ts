// HTML template for the native ParcelMap WebView.
// Leaflet is loaded from CDN; all user interaction is forwarded to React Native
// via window.ReactNativeWebView.postMessage so the parent owns the single
// source of truth for the polygon coordinates.

export const PARCEL_MAP_CDN_LEAFLET_CSS =
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
export const PARCEL_MAP_CDN_LEAFLET_JS =
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

export interface ParcelMapMessage {
    type: 'add' | 'move' | 'remove' | 'ready' | 'error';
    index?: number;
    latitude?: number;
    longitude?: number;
    message?: string;
}

export const PARCEL_MAP_DEFAULT_CENTER: [number, number] = [8.3512, 124.8621];

export function buildParcelMapHtml(): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="${PARCEL_MAP_CDN_LEAFLET_CSS}" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #E5E7EB; }
  #fallback {
    display: none; height: 100%; align-items: center; justify-content: center;
    text-align: center; color: #4B5563; font-family: sans-serif; padding: 24px;
  }
</style>
</head>
<body>
<div id="map"></div>
<div id="fallback"><p>Map could not load.<br/>Please check your internet connection.</p></div>
<script src="${PARCEL_MAP_CDN_LEAFLET_JS}"
        onerror="document.getElementById('map').style.display='none';document.getElementById('fallback').style.display='flex';"></script>
<script>
(function () {
    if (typeof L === 'undefined') return;
    var map = L.map('map', { zoomControl: true });
    var editable = false;
    var polygon = null;
    var markers = [];
    var liveMarker = null;

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    }).addTo(map);

    function send(payload) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
    }

    function vertexIcon() {
        return L.divIcon({
            className: 'parcel-vertex',
            html: '<div style="width:14px;height:14px;border-radius:7px;background:#0F766E;border:2px solid #FFFFFF;box-sizing:border-box;"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
        });
    }

    function fitToPolygon() {
        if (polygon) {
            map.fitBounds(polygon.getBounds().pad(0.15));
        }
    }

    function render(coordinates) {
        if (polygon) { map.removeLayer(polygon); polygon = null; }
        markers.forEach(function (m) { map.removeLayer(m); });
        markers = [];

        if (!coordinates || coordinates.length === 0) {
            map.setView([${PARCEL_MAP_DEFAULT_CENTER[0]}, ${PARCEL_MAP_DEFAULT_CENTER[1]}], 13);
            return;
        }

        var latLngs = coordinates.map(function (c) { return [c.latitude, c.longitude]; });
        if (coordinates.length >= 2) {
            polygon = L.polygon(latLngs, {
                color: '#0F766E', weight: 2, fillColor: '#0F766E', fillOpacity: 0.2,
            }).addTo(map);
        }

        coordinates.forEach(function (c, i) {
            var marker = L.marker([c.latitude, c.longitude], {
                icon: vertexIcon(),
                draggable: editable,
            }).addTo(map);

            if (editable) {
                marker.on('dragend', function () {
                    var ll = marker.getLatLng();
                    send({ type: 'move', index: i, latitude: ll.lat, longitude: ll.lng });
                });
                marker.on('click', function () {
                    send({ type: 'remove', index: i });
                });
            }
            markers.push(marker);
        });

        fitToPolygon();
    }

    function setEditable(value) {
        editable = !!value;
        markers.forEach(function (m) {
            if (editable) {
                m.dragging.enable();
                m.off('dragend').off('click');
                (function (marker, i) {
                    marker.on('dragend', function () {
                        var ll = marker.getLatLng();
                        send({ type: 'move', index: i, latitude: ll.lat, longitude: ll.lng });
                    });
                    marker.on('click', function () { send({ type: 'remove', index: i }); });
                })(m, markers.indexOf(m));
            } else if (m.dragging) {
                m.dragging.disable();
            }
        });
    }

    map.on('click', function (e) {
        if (!editable) return;
        send({ type: 'add', latitude: e.latlng.lat, longitude: e.latlng.lng });
    });

    window.updateParcel = function (payload) {
        // payload: { coordinates: [{latitude, longitude}], editable: boolean }
        render(payload.coordinates);
        setEditable(payload.editable);
    };

    window.setLiveCoordinate = function (coordinate) {
        if (liveMarker) { map.removeLayer(liveMarker); liveMarker = null; }
        if (coordinate && coordinate.latitude != null) {
            liveMarker = L.circleMarker([coordinate.latitude, coordinate.longitude], {
                radius: 7, color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.7, weight: 2,
            }).addTo(map);
        }
    };

    send({ type: 'ready' });
})();
</script>
</body>
</html>`;
}
