import { Colors } from '../../constants/colors';

export const PARCEL_MAP_CDN_LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
export const PARCEL_MAP_CDN_LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
export const PARCEL_MAP_DEFAULT_CENTER: [number, number] = [8.3512, 124.8621];

export interface ParcelMapMessage {
    type: 'add' | 'move' | 'selectVertex' | 'selectFeature' | 'ready' | 'error';
    revision?: number;
    id?: string;
    index?: number;
    latitude?: number;
    longitude?: number;
    message?: string;
}

/** Only app-owned code is interpolated; feature labels use DOM textContent, never user HTML. */
export function buildParcelMapHtml(): string {
    return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com; style-src 'unsafe-inline' https://unpkg.com; img-src data: https://server.arcgisonline.com https://*.tile.openstreetmap.org; connect-src https://server.arcgisonline.com https://*.tile.openstreetmap.org;" />
<link rel="stylesheet" href="${PARCEL_MAP_CDN_LEAFLET_CSS}" />
<style>html,body,#map{height:100%;margin:0;background:${Colors.background}}.parcel-label{font:600 12px sans-serif;text-align:center}.parcel-vertex{border-radius:50%;border:2px solid ${Colors.surface};background:${Colors.error};width:16px;height:16px;box-sizing:border-box}.parcel-edge{font:12px sans-serif;color:${Colors.text};background:${Colors.surface};border:0;border-radius:5px;padding:3px}.leaflet-control-zoom a{width:44px!important;height:44px!important;line-height:44px!important}</style>
</head><body><div id="map"></div>
<script src="${PARCEL_MAP_CDN_LEAFLET_JS}" onerror="window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'error'}))"></script>
<script>(function(){
if(typeof L==='undefined')return;
var colors=${JSON.stringify(Colors)},map=L.map('map',{zoomControl:true}).setView(${JSON.stringify(PARCEL_MAP_DEFAULT_CENTER)},13);
var group=L.layerGroup().addTo(map),liveMarker=null,tile=null,tileKind='',state={coordinates:[],editable:false,revision:0},lastFit='';
function send(message){message.revision=state.revision;if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(message));}
function positions(ring){return ring.map(function(c){return[c.latitude,c.longitude];});}
function rings(outer,holes){return[positions(outer)].concat((holes||[]).map(positions));}
function text(value){var node=document.createElement('div');node.className='parcel-label';node.textContent=value;return node;}
function color(feature){return feature.selected?colors.error:feature.kind==='parcel'?colors.success:feature.status==='completed'?colors.success:feature.status==='in_progress'?colors.info:colors.warning;}
function changeTile(kind){if(kind===tileKind)return;if(tile)map.removeLayer(tile);tileKind=kind;tile=L.tileLayer(kind==='street'?'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png':'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:kind==='street'?'&copy; OpenStreetMap contributors':'Tiles &copy; Esri, Maxar, Earthstar Geographics'}).addTo(map);}
function render(){
group.clearLayers();changeTile(state.mapLayer||'satellite');
(state.features||[]).forEach(function(feature){if(feature.coordinates.length<3)return;function select(e){L.DomEvent.stopPropagation(e.originalEvent||e);if(!state.editable)send({type:'selectFeature',id:feature.id});}var path=L.polygon(rings(feature.coordinates,feature.holes),{color:color(feature),fillColor:color(feature),fillOpacity:feature.selected?0.2:0.18,weight:feature.selected?4:2,interactive:!state.editable,bubblingMouseEvents:false}).addTo(group);path.on('click',select);var label=(feature.selected?'Selected · ':'')+feature.name+(typeof feature.areaHectares==='number'?' '+feature.areaHectares.toFixed(2)+' ha':'');var anchor=feature.labelCoordinate||feature.coordinates[0];L.tooltip({permanent:true,interactive:true,bubblingMouseEvents:false,direction:'center',className:'parcel-label'}).setLatLng([anchor.latitude,anchor.longitude]).setContent(text(label)).addTo(group).on('click',select);});
var coords=state.coordinates||[];
if(coords.length>=2){var path=state.closed&&coords.length>=3?L.polygon(rings(coords,state.holes),{color:colors.error,weight:4,fillColor:colors.success,fillOpacity:0.22,interactive:false}):L.polyline(positions(coords),{color:colors.error,weight:3,dashArray:'6 5',interactive:false});path.addTo(group);}
if(state.editable)coords.forEach(function(c,i){var marker=L.marker([c.latitude,c.longitude],{icon:L.divIcon({className:'',html:'<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center"><div class="parcel-vertex"'+(state.selectedVertexIndex===i?' style="width:22px;height:22px;background:'+colors.info+'"':'')+'></div></div>',iconSize:[44,44],iconAnchor:[22,22]}),draggable:true,bubblingMouseEvents:false}).addTo(group);marker.on('click',function(e){L.DomEvent.stopPropagation(e.originalEvent||e);send({type:'selectVertex',index:i});});marker.on('dragend',function(){var ll=marker.getLatLng();send({type:'move',index:i,latitude:ll.lat,longitude:wrapLongitude(ll.lng)});});});
if(state.showEdgeLengths&&coords.length>=2&&map.getZoom()>=15){var count=state.closed?coords.length:coords.length-1;for(var i=0;i<count;i++){var a=coords[i],b=coords[(i+1)%coords.length],mid=[(a.latitude+b.latitude)/2,(a.longitude+b.longitude)/2];L.marker(mid,{icon:L.divIcon({className:'parcel-edge',html:map.distance([a.latitude,a.longitude],[b.latitude,b.longitude]).toFixed(1)+' m',iconSize:[70,20],iconAnchor:[35,10]}),bubblingMouseEvents:false}).addTo(group).on('click',function(e){L.DomEvent.stopPropagation(e.originalEvent||e);});}}
var fitKey=(state.selectedFeatureId||'')+'|'+(state.fitRequest||0);if(fitKey!==lastFit){var target=coords;var selected=(state.features||[]).find(function(f){return f.id===state.selectedFeatureId;});if(selected)target=selected.coordinates;if(target.length){lastFit=fitKey;if(target.length>1)map.fitBounds(L.latLngBounds(positions(target)).pad(0.15));else map.setView(positions(target)[0],17);}}
map.invalidateSize();
}
function wrapLongitude(value){return value>=-180&&value<=180?value:((value+180)%360+360)%360-180;}
map.on('click',function(e){if(state.editable)send({type:'add',latitude:e.latlng.lat,longitude:wrapLongitude(e.latlng.lng)});});
map.on('zoomend',function(){render();});
window.updateParcel=function(payload){state=payload;render();};
window.setLiveCoordinate=function(coordinate){if(liveMarker){map.removeLayer(liveMarker);liveMarker=null;}if(coordinate)liveMarker=L.circleMarker([coordinate.latitude,coordinate.longitude],{radius:7,color:colors.info,fillColor:colors.info,fillOpacity:0.7,weight:2,bubblingMouseEvents:false}).addTo(map).on('click',function(e){L.DomEvent.stopPropagation(e.originalEvent||e);});};
send({type:'ready'});
})();</script></body></html>`;
}
