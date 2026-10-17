import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Clipboard, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { v4 as uuid } from 'uuid';
import { database } from '../../../src/database';
import AgriParcel from '../../../src/database/models/AgriParcel';
import { useAuth } from '../../../src/store/AuthContext';
import { Colors } from '../../../src/constants/colors';
import { useResponsiveLayout } from '../../../src/hooks/useResponsiveLayout';
import { MappingMode, MappingSnapshot, useParcelMapping } from '../../../src/hooks/useParcelMapping';
import { useParcelGpsCapture } from '../../../src/hooks/useParcelGpsCapture';
import { parseGpsCoordinatesStrict } from '../../../src/utils/coordinates';
import { measureParcelGeometry, validateBlockLayout, validateParcelGeometry } from '../../../src/utils/parcelGeometry';
import { AgriBlockService } from '../../../src/services/AgriBlockService';
import AgriBlockAssignment from '../../../src/database/models/AgriBlockAssignment';
import { deriveAssignmentStatus } from '../../../src/services/AgriBlockAssignmentService';
import { assertAgriDatabaseUsable } from '../../../src/services/AgriWriteSafety';
import { ParcelMap } from '../../../src/components/ParcelMap';
import { ParcelMapFeature } from '../../../src/components/ParcelMap/types';
import { MappingToolbar } from '../../../src/components/ParcelMap/MappingToolbar';
import { ParcelDetailsPanel } from '../../../src/components/ParcelMap/ParcelDetailsPanel';
import { BoundaryEditorPanel } from '../../../src/components/ParcelMap/BoundaryEditorPanel';
import { BlockDivisionPanel } from '../../../src/components/ParcelMap/BlockDivisionPanel';
import { BlockMonitoringPanel } from '../../../src/components/ParcelMap/BlockMonitoringPanel';
import { ConfirmDialog } from '../../../src/components/ConfirmDialog';

interface DialogSpec { title: string; message: string; mode: 'confirm' | 'alert'; confirmLabel?: string; onConfirm?: () => void }
function readGeometry(parcel: AgriParcel) {
    const outer = parseGpsCoordinatesStrict(parcel.gpsCoordinates);
    const holes = parcel.gpsExclusions ? JSON.parse(parcel.gpsExclusions) : [];
    if (!Array.isArray(holes) || holes.some(ring => !Array.isArray(ring))) throw new Error('Saved exclusions are malformed.');
    const geometry = { outer, holes };
    if (outer.length >= 2 || holes.length) {
        const errors = validateParcelGeometry(geometry);
        if (errors.length) throw new Error(errors.join('; '));
    }
    return geometry;
}

export default function GPSMappingScreen() {
    const params = useLocalSearchParams<{ parcelId?: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const [parcels, setParcels] = useState<AgriParcel[]>([]);
    const [selectedId, setSelectedId] = useState(params.parcelId || '');
    const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState<string | null>(null);
    const registryMounted = useRef(true), registryGeneration = useRef(0);
    const latestRouteTarget = useRef(params.parcelId); latestRouteTarget.current = params.parcelId;
    const load = useCallback(async () => {
        const session = ++registryGeneration.current;
        const current = () => registryMounted.current && registryGeneration.current === session;
        setLoading(true); setLoadError(null);
        try {
            assertAgriDatabaseUsable(database);
            const list = await database.get<AgriParcel>('agri_parcels').query(Q.where('deleted_at', null)).fetch();
            assertAgriDatabaseUsable(database);
            if (current()) {
                const routeTarget = latestRouteTarget.current;
                setParcels(list); setSelectedId(id => list.some(p => p.id === routeTarget) ? routeTarget! : list.some(p => p.id === id) ? id : list[0]?.id || '');
            }
        } catch (e) { if (current()) { setParcels([]); setLoadError(e instanceof Error ? e.message : 'Parcel registry could not be loaded.'); } }
        finally { if (current()) setLoading(false); }
    }, []);
    useEffect(() => {
        registryMounted.current = true; void load();
        return () => { registryMounted.current = false; registryGeneration.current += 1; };
    }, [load]);
    const selected = parcels.find(p => p.id === selectedId);
    if (loading) return <View className="flex-1 bg-gray-50 items-center justify-center"><ActivityIndicator color={Colors.primary} accessibilityLabel="Loading parcels" /></View>;
    if (!selected) return <View className="flex-1 bg-gray-50 p-6 justify-center gap-4">
        <Text className="text-2xl font-bold text-gray-900">GPS Parcel Mapping</Text>
        <Text className="text-gray-700" accessibilityRole={loadError ? 'alert' : undefined}>{loadError || 'No parcels registered yet. Register the landowner and parcel, then draw or record its boundary. No estimated hectare value is required.'}</Text>
        {loadError ? <Pressable accessibilityRole="button" onPress={load} className="min-h-12 bg-green-800 p-3 rounded-xl"><Text className="text-white text-center font-bold">Retry registry</Text></Pressable> :
            <Pressable testID="register-mapping-parcel" accessibilityRole="button" accessibilityLabel="Register parcel to measure on map" onPress={() => router.push({ pathname: '/(admin)/agribusiness/parcels', params: { mapRegistration: '1' } })} className="min-h-12 bg-green-800 p-3 rounded-xl"><Text className="text-white text-center font-bold">Register parcel & map boundary</Text></Pressable>}
    </View>;
    // Operator changes own a fresh workspace lifetime, including a return to the same operator.
    return <ParcelMappingWorkspace key={`${user?.id || 'unknown-operator'}:${selected.id}`} parcel={selected} parcels={parcels} onSelect={setSelectedId} />;
}

function ParcelMappingWorkspace({ parcel, parcels, onSelect }: { parcel: AgriParcel; parcels: AgriParcel[]; onSelect: (id: string) => void }) {
    const router = useRouter(), navigation = useNavigation();
    const params = useLocalSearchParams<{ parcelId?: string; blockId?: string }>();
    const { user } = useAuth();
    const [showTasks, setShowTasks] = useState(false), [taskWriting, setTaskWriting] = useState(false);
    const [blockFilter, setBlockFilter] = useState('all'), [taskRefresh, setTaskRefresh] = useState(0);
    const [taskRows, setTaskRows] = useState<AgriBlockAssignment[]>([]), [taskError, setTaskError] = useState('');
    const mounted = useRef(true), taskWritingRef = useRef(false), taskBusyOwners = useRef(0);
    const editGeneration = useRef(0);
    const clearOwnership = useRef<{ operation: { revision: number; id: string }; edit: number; operatorId: string } | null>(null);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearOwnership.current = null; }; }, []);
    const mutate = <Args extends unknown[], Result,>(action: (...args: Args) => Result) => (...args: Args): Result | undefined => {
        if (!mounted.current || clearOwnership.current) return;
        editGeneration.current += 1;
        return action(...args);
    };
    const tokens = useResponsiveLayout(), insets = useSafeAreaInsets(), dimensions = useWindowDimensions();
    const [dialog, setDialog] = useState<DialogSpec | null>(null);
    const [search, setSearch] = useState(''), [expanded, setExpanded] = useState(true);
    const [fitRequest, setFitRequest] = useState(0), [layer, setLayer] = useState<'satellite' | 'street'>('satellite');
    const [mapSpace, setMapSpace] = useState(Math.max(240, dimensions.height * 0.55));
    const [sourceError, setSourceError] = useState<string | null>(null), [blocksLoading, setBlocksLoading] = useState(true);
    const [blockIntegrity, setBlockIntegrity] = useState(false), [clearing, setClearing] = useState(false);
    const clearOperation = useRef<{ revision: number; id: string } | null>(null);
    const [snapshot, setSnapshot] = useState<MappingSnapshot>(() => {
        try { return { parcelId: parcel.id, revision: parcel.layoutRevision || 0, geometry: readGeometry(parcel), blocks: [] }; }
        catch { return { parcelId: parcel.id, revision: parcel.layoutRevision || 0, geometry: { outer: [], holes: [] }, blocks: [] }; }
    });
    const [registeredArea, setRegisteredArea] = useState(parcel.areaHectares);
    const [boundarySavedAt, setBoundarySavedAt] = useState(parcel.boundarySavedAt);
    useEffect(() => {
        let active = true;
        const source = { id: parcel.id, revision: parcel.layoutRevision, outer: parcel.gpsCoordinates, holes: parcel.gpsExclusions };
        let parent: ReturnType<typeof readGeometry> | null = null;
        setBlockIntegrity(false);
        try { parent = readGeometry(parcel); } catch (e) { setSourceError(`Saved geometry needs review: ${e instanceof Error ? e.message : 'Invalid coordinates'}. It has not been silently repaired or overwritten.`); }
        const loadBlocks = async () => {
            assertAgriDatabaseUsable(database);
            const rows = await database.get<any>('agri_parcel_blocks').query(Q.where('parcel_id', source.id), Q.where('deleted_at', null)).fetch();
            assertAgriDatabaseUsable(database);
            return rows;
        };
        loadBlocks().then(rows => {
            if (!active) return;
            if (parcel.id !== source.id || parcel.layoutRevision !== source.revision || parcel.gpsCoordinates !== source.outer || parcel.gpsExclusions !== source.holes) {
                throw new Error('Parcel source changed while loading its blocks. Reload the accepted layout.');
            }
            if (!Number.isSafeInteger(source.revision) || source.revision < 0) throw new Error('Saved layout revision is invalid.');
            const ids = new Set<string>();
            const blocks = rows.filter(row => row.status !== 'archived').map(row => {
                if (row.parcelId !== source.id || row.layoutRevision !== source.revision) throw new Error('Saved block parent or layout revision does not match the parcel.');
                if (typeof row.id !== 'string' || !row.id.trim() || ids.has(row.id)) throw new Error('Saved block IDs must be unique and nonempty.');
                ids.add(row.id);
                const geometry = JSON.parse(row.geometryJson);
                const errors = validateParcelGeometry(geometry);
                if (errors.length) throw new Error(errors.join('; '));
                return { id: row.id, name: row.name, geometry };
            });
            // A corrupt parent without retained blocks can still be explicitly cleared.
            // With blocks, validate the complete usable layout before exposing any selection.
            if (blocks.length) {
                if (!parent) throw new Error('Saved blocks have an invalid parent boundary.');
                const errors = validateBlockLayout(parent, blocks.map(block => block.geometry));
                if (errors.length) throw new Error(errors.join('; '));
            }
            setSnapshot(old => ({ ...old, blocks })); setBlockIntegrity(true);
        }).catch(e => { if (active) setSourceError(`Saved block layout could not be loaded safely: ${e instanceof Error ? e.message : 'Unknown error'}. Saving is disabled.`); })
            .finally(() => { if (active) setBlocksLoading(false); });
        return () => { active = false; };
    }, [parcel]);
    const mapping = useParcelMapping({ operatorId: user?.id || 'unknown-operator', snapshot, onSave: async input => {
        if (!user?.id || sourceError || blocksLoading) throw new Error('Resolve the saved layout and operator identity before saving.');
        const accepted = await AgriBlockService.saveLayout(input, database, user.id);
        if (mounted.current) {
            setRegisteredArea(measureParcelGeometry(input.geometry).areaHectares); setBoundarySavedAt(new Date());
            setSnapshot({ parcelId: parcel.id, revision: accepted, geometry: input.geometry, blocks: input.blocks });
        }
        return accepted;
    } });
    useEffect(() => {
        if (params.blockId && snapshot.blocks.some(block => block.id === params.blockId)) {
            mapping.setSelectedBlockId(params.blockId); setShowTasks(true); setExpanded(true);
        }
    }, [params.blockId, snapshot.blocks, mapping.setSelectedBlockId]);
    const mappingRef = useRef(mapping); mappingRef.current = mapping;
    const operatorRef = useRef(user?.id); operatorRef.current = user?.id;
    const gps = useParcelGpsCapture({ onCoordinate: point => {
        if (!mounted.current || clearOwnership.current) return;
        const state = mappingRef.current;
        editGeneration.current += 1; state.changePoints([...state.points, point]);
    } });
    const permitNavigation = useRef(false);
    const guard = useCallback((action: () => void) => {
        if (clearOwnership.current || mapping.saving || taskWritingRef.current || clearing) return;
        if (!mapping.dirty) { gps.finish(); action(); return; }
        setDialog({ title: 'Unsaved Changes', message: 'Discard this parcel draft before leaving? Keep Editing retains the coordinates and layout.', mode: 'confirm', confirmLabel: 'Discard', onConfirm: () => { mapping.discard(); gps.finish(); action(); } });
    }, [mapping, gps, taskWriting, clearing]);
    const routeGuard = useRef(guard); routeGuard.current = guard;
    const lastRouteTarget = useRef(params.parcelId);
    useEffect(() => {
        if (lastRouteTarget.current === params.parcelId) return;
        lastRouteTarget.current = params.parcelId;
        if (params.parcelId && params.parcelId !== parcel.id && parcels.some(p => p.id === params.parcelId)) {
            routeGuard.current(() => onSelect(params.parcelId!));
        }
        // Route changes use the same explicit discard guard as parcel chips.
    }, [params.parcelId, parcel.id]);
    useEffect(() => {
        const blur = navigation.addListener('blur', () => gps.pause());
        const remove = navigation.addListener('beforeRemove', (event: any) => {
            if (permitNavigation.current || (!mapping.dirty && !mapping.saving && !taskWriting && !clearing)) return;
            event.preventDefault();
            guard(() => { permitNavigation.current = true; navigation.dispatch(event.data.action); });
        });
        const beforeUnload = (event: BeforeUnloadEvent) => { if (mapping.dirty || mapping.saving || taskWriting || clearing) { event.preventDefault(); event.returnValue = ''; } };
        const browserWindow = Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.addEventListener === 'function' ? window : null;
        browserWindow?.addEventListener('beforeunload', beforeUnload);
        return () => { blur(); remove(); browserWindow?.removeEventListener('beforeunload', beforeUnload); };
    }, [navigation, mapping.dirty, mapping.saving, guard, gps.pause, taskWriting, clearing]);
    const setMode = (mode: MappingMode) => {
        if (clearOwnership.current || mapping.saving || mapping.draftLoading || blocksLoading || sourceError) return;
        if (mode !== 'gps') gps.finish();
        mutate(mapping.begin)(mode); setExpanded(true);
    };
    const selectParcel = (id: string) => { if (id !== parcel.id) guard(() => onSelect(id)); };
    useEffect(() => {
        let active = true;
        if (!snapshot.blocks.length) { setTaskRows([]); setTaskError(''); return; }
        const loadTasks = async () => {
            assertAgriDatabaseUsable(database);
            const rows = await database.get<AgriBlockAssignment>('agri_block_assignments').query(Q.where('block_id', Q.oneOf(snapshot.blocks.map(b => b.id))), Q.where('deleted_at', null)).fetch();
            assertAgriDatabaseUsable(database);
            if (active) { setTaskRows(rows); setTaskError(''); }
        };
        void loadTasks().catch(e => { if (active) { setTaskRows([]); setTaskError(`Task status unavailable: ${e instanceof Error ? e.message : 'Refresh required'}`); } });
        return () => { active = false; };
    }, [snapshot.blocks, taskRefresh]);
    const blockStatuses = useCallback((id: string) => {
        if (taskError) return ['unknown'];
        const rows = taskRows.filter(a => a.blockId === id);
        const statuses = [...new Set(rows.flatMap(a => [a.status, deriveAssignmentStatus(a)]))];
        return !rows.length || rows.every(a => a.status === 'cancelled') ? ['unassigned', ...statuses] : statuses;
    }, [taskRows, taskError]);
    const visibleBlocks = useMemo(() => mapping.blocks.filter(b => blockFilter === 'all' || blockStatuses(b.id).includes(blockFilter)), [mapping.blocks, blockFilter, blockStatuses]);
    const features = useMemo<ParcelMapFeature[]>(() => {
        const nearby: ParcelMapFeature[] = [];
        parcels.forEach(p => {
            if (p.id === parcel.id) return;
            try { const geometry = readGeometry(p), measurements = measureParcelGeometry(geometry); nearby.push({ id: p.id, name: p.name, kind: 'parcel', coordinates: geometry.outer, holes: geometry.holes, areaHectares: measurements.areaHectares, labelCoordinate: measurements.labelCoordinate }); } catch { /* Invalid/unmeasured neighbors are listed, never silently repaired. */ }
        });
        visibleBlocks.forEach(block => { const m = measureParcelGeometry(block.geometry), statuses = blockStatuses(block.id); nearby.push({ id: block.id, name: `${block.name} · ${statuses.join(' / ')}`, kind: 'block', coordinates: block.geometry.outer, holes: block.geometry.holes, areaHectares: m.areaHectares, labelCoordinate: m.labelCoordinate, selected: mapping.selectedBlockId === block.id, status: ['overdue', 'in_progress', 'assigned', 'completed', 'unassigned'].find(status => statuses.includes(status)) }); });
        if (mapping.blocks.length || mapping.preview) (mapping.preview?.remainder ?? mapping.remainder)?.forEach((geometry, index) => {
            const m = measureParcelGeometry(geometry);
            nearby.push({ id: `remainder-${index}`, name: 'Unassigned remainder', kind: 'block', coordinates: geometry.outer, holes: geometry.holes, areaHectares: m.areaHectares, labelCoordinate: m.labelCoordinate, status: 'unassigned' });
        });
        if (mapping.closed && ['cut', 'block', 'exclude'].includes(mapping.mode) && mapping.geometry.outer.length >= 3) nearby.push({ id: parcel.id, name: parcel.name, kind: 'parcel', coordinates: mapping.geometry.outer, holes: mapping.geometry.holes, selected: true, labelCoordinate: mapping.measurements?.labelCoordinate });
        mapping.preview?.blocks.forEach(block => { const m = measureParcelGeometry(block.geometry); nearby.push({ id: `preview-${block.id}`, name: `Preview · ${block.name}`, kind: 'block', coordinates: block.geometry.outer, holes: block.geometry.holes, areaHectares: m.areaHectares, labelCoordinate: m.labelCoordinate }); });
        return nearby;
    }, [parcels, parcel, mapping.blocks, visibleBlocks, blockStatuses, mapping.remainder, mapping.selectedBlockId, mapping.mode, mapping.geometry, mapping.closed, mapping.measurements, mapping.preview]);
    const persist = async () => {
        if (clearOwnership.current) return;
        gps.finish();
        const accepted = await mapping.save();
        if (!mounted.current) return;
        if (accepted) setDialog({ title: 'Boundary Saved', message: 'Parcel geometry and blocks saved on this device with audit history. Cloud layout sync is not enabled in this release; satellite imagery still requires internet.', mode: 'alert' });
        else setDialog({ title: 'Save Failed', message: mappingRef.current.error || 'Save failed. Your draft remains available for correction or retry.', mode: 'alert' });
    };
    const reviewSave = () => {
        if (clearOwnership.current) return;
        if (mapping.geometry.outer.length < 3) { setDialog({ title: 'Boundary Incomplete', message: 'A measured boundary needs at least three non-crossing vertices. Clearing draft points does not erase registered hectares.', mode: 'alert' }); return; }
        const errors = validateParcelGeometry(mapping.geometry);
        if (errors.length) { setDialog({ title: 'Boundary Invalid', message: errors.join('; '), mode: 'alert' }); return; }
        if (mapping.closed !== true) { setDialog({ title: 'Boundary Open', message: 'Use Close boundary before reviewing and saving this draft. Your points and live measurement estimates are retained.', mode: 'alert' }); return; }
        setDialog({ title: 'Review Measured Area', message: `Registered area: ${registeredArea.toFixed(4)} ha. Measured usable area: ${mapping.measurements!.areaHectares.toFixed(4)} ha (${Math.round(mapping.measurements!.areaSquareMeters).toLocaleString('en-US')} m²). Exclusions are deducted. Save replaces registered hectares with this GPS-derived estimate, not a legal survey.`, mode: 'confirm', confirmLabel: 'Save reviewed layout', onConfirm: () => { void persist(); } });
    };
    const copyCoordinates = async () => {
        const text = JSON.stringify(mapping.geometry, null, 2);
        try {
            if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) await navigator.clipboard.writeText(text);
            else Clipboard.setString(text);
            setDialog({ title: 'Coordinates Copied', message: 'Outer boundary and exclusions copied in decimal degrees.', mode: 'alert' });
        } catch { setDialog({ title: 'Copy Coordinates', message: text, mode: 'alert' }); }
    };
    const requestClear = () => {
        if (!user?.id || clearOwnership.current || clearing || mapping.saving || taskWriting || mapping.dirty || mapping.draftLoading || !blockIntegrity || snapshot.blocks.length) return;
        const requestedEdit = editGeneration.current;
        setDialog({ title: 'Clear Saved Boundary', message: 'Explicitly remove saved GPS geometry and exclusions? Recorded hectares and crop history remain unchanged. This is audited and revision-checked; retained blocks must be archived first.', mode: 'confirm', confirmLabel: 'Clear saved geometry', onConfirm: () => {
            const state = mappingRef.current;
            if (!mounted.current || clearOwnership.current || operatorRef.current !== user.id || state.saving || state.dirty || state.draftLoading || taskWritingRef.current || state.revision !== snapshot.revision || editGeneration.current !== requestedEdit) return;
            if (clearOperation.current?.revision !== snapshot.revision) clearOperation.current = { revision: snapshot.revision, id: uuid() };
            const ownership = { operation: clearOperation.current, edit: requestedEdit, operatorId: user.id };
            // Own the operation synchronously, before React can disable rendered controls.
            clearOwnership.current = ownership;
            const current = () => mounted.current && clearOwnership.current === ownership && clearOperation.current === ownership.operation && operatorRef.current === ownership.operatorId;
            setClearing(true); gps.finish();
            void AgriBlockService.clearBoundary({ parcelId: parcel.id, expectedRevision: snapshot.revision, operationId: ownership.operation.id }, database, user.id).then(accepted => {
                if (!current()) return;
                const latest = mappingRef.current;
                if (editGeneration.current === ownership.edit && latest.revision === ownership.operation.revision && !latest.dirty) latest.discard();
                setSnapshot({ parcelId: parcel.id, revision: accepted, geometry: { outer: [], holes: [] }, blocks: [] }); setSourceError(null); setBoundarySavedAt(new Date());
                setDialog({ title: 'Saved Boundary Cleared', message: 'GPS geometry was cleared locally. Recorded hectares and crop history were preserved. Draw a replacement and review its measured area before saving.', mode: 'alert' });
            }).catch(e => { if (current()) setDialog({ title: 'Clear Failed', message: e instanceof Error ? e.message : 'Could not clear saved geometry. Nothing is silently repaired.', mode: 'alert' }); }).finally(() => {
                if (clearOwnership.current !== ownership) return;
                clearOwnership.current = null;
                if (mounted.current) setClearing(false);
            });
        } });
    };
    const locked = mapping.saving || taskWriting || clearing || mapping.draftLoading || blocksLoading || !!sourceError || !user?.id;
    const inspector = <>
        <ParcelDetailsPanel name={parcel.name} registeredArea={registeredArea} measurements={mapping.measurements} createdAt={parcel.createdAt} boundarySavedAt={boundarySavedAt} onCopy={() => { void copyCoordinates(); }} onOpenMaps={() => {
            const point = mapping.measurements?.labelCoordinate;
            if (point) Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`).catch(() => setDialog({ title: 'Maps Unavailable', message: 'Unable to open maps. Copy the representative coordinates instead.', mode: 'alert' }));
        }} />
        {Platform.OS === 'web' && <Text testID="mapping-storage-notice" className="px-4 pb-4 text-amber-800">Browser storage can be temporary in private browsing. Autosave is asynchronous; abrupt closure or a crash can lose recent saves. Copy coordinates for backup. Cloud layout sync is disabled.</Text>}
        {mapping.recoverableDraft && <View className="p-4 gap-2 bg-amber-50"><Text className="text-gray-900 font-bold">An unsaved local draft is available</Text><Pressable testID="recover-mapping-draft" accessibilityRole="button" disabled={clearing} onPress={mutate(mapping.recoverDraft)} className="min-h-12 bg-green-800 p-3 rounded-xl"><Text className="text-white font-bold">Recover draft</Text></Pressable><Pressable testID="discard-mapping-draft" accessibilityRole="button" disabled={clearing} onPress={mutate(mapping.discardDraft)} className="min-h-12 p-3"><Text className="text-gray-900 font-bold">Discard stored draft</Text></Pressable></View>}
        {blockIntegrity && !snapshot.blocks.length && <Pressable testID="clear-saved-boundary" accessibilityRole="button" disabled={mapping.dirty || mapping.saving || taskWriting || clearing || !user?.id} onPress={requestClear} className="min-h-12 m-4 p-3 border border-red-300 rounded-xl"><Text className="text-red-700 font-bold">{clearing ? 'Clearing saved geometry…' : 'Clear saved boundary (preserve recorded hectares)'}</Text></Pressable>}
        {(sourceError || mapping.error) && <Text testID="mapping-error" accessibilityRole="alert" className="p-4 text-red-700">{sourceError || mapping.error}</Text>}
        {mapping.mode === 'gps' && <View className="p-4 bg-blue-50 gap-3"><Text className="text-gray-900 font-bold">Foreground GPS · {gps.status}</Text><Text className="text-gray-700">Record points at least 5 m apart with accuracy within 10 m. Pause before leaving the screen; resume explicitly.</Text>
            {gps.liveFix && <Text testID="walk-accuracy" className="text-gray-700">Accuracy: {gps.liveFix.accuracyMeters == null ? 'unknown' : `±${Math.round(gps.liveFix.accuracyMeters)} m`} · Last fix {new Date(gps.liveFix.timestamp).toLocaleTimeString()}</Text>}
            {gps.feedback && <Text accessibilityRole="alert" className="text-amber-800">{gps.feedback}</Text>}
            <View className="flex-row flex-wrap gap-2">{gps.status === 'recording' ? <Pressable testID="pause-walk" accessibilityRole="button" onPress={gps.pause} className="min-h-12 p-3 bg-blue-700 rounded-lg"><Text className="text-white font-bold">Pause</Text></Pressable> : <Pressable testID="start-walk" accessibilityRole="button" disabled={locked || gps.status === 'requesting'} onPress={gps.start} className="min-h-12 p-3 bg-blue-700 rounded-lg"><Text className="text-white font-bold">{gps.status === 'paused' ? 'Resume' : 'Start'} recording</Text></Pressable>}<Pressable testID="stop-walk" accessibilityRole="button" onPress={mutate(() => { gps.finish(); mapping.closeBoundary(); })} className="min-h-12 p-3 bg-gray-800 rounded-lg"><Text className="text-white font-bold">Finish</Text></Pressable></View>
        </View>}
        {mapping.mode !== 'browse' && <BoundaryEditorPanel points={mapping.points} selectedIndex={mapping.selectedVertexIndex} onSelect={mutate(mapping.setSelectedVertexIndex)} onDelete={mutate(mapping.deleteVertex)} onManual={mutate(mapping.addManual)} onUndo={mutate(mapping.undo)} onRedo={mutate(mapping.redo)} onClose={mutate(mapping.closeBoundary)} onCancel={mutate(() => { gps.finish(); mapping.cancelIntent(); })} onClear={mutate(() => setDialog({ title: 'Clear Draft Points', message: 'Remove points from this editing draft? Saved geometry and registered hectares remain unchanged until a valid reviewed save.', mode: 'confirm', confirmLabel: 'Clear draft', onConfirm: mutate(() => mapping.changePoints([])) }))} error={mapping.error} />}
        {mapping.mode === 'exclude' && <Pressable testID="accept-exclusion" accessibilityRole="button" onPress={mutate(mapping.acceptExclusion)} className="min-h-12 m-4 p-3 bg-green-800 rounded-xl"><Text className="text-white font-bold text-center">Accept excluded pocket</Text></Pressable>}
        {(mapping.mode === 'cut' || mapping.mode === 'block') && <BlockDivisionPanel mode={mapping.mode} preview={mapping.preview} onPreview={mutate(mapping.previewDivision)} onAccept={mutate(mapping.acceptDivision)} onCancel={mutate(mapping.cancelIntent)} />}
        {mapping.measurements && mapping.remainderError && <Text accessibilityRole="alert" className="p-4 text-red-700">Remainder needs correction: {mapping.remainderError}</Text>}
        {mapping.blocks.length > 0 && <View className="p-4 gap-2"><Text className="text-gray-900 font-bold">Labor blocks · select for tasks or division</Text>
            <Text className="text-gray-600">Filters match individual tasks; a block can have several task statuses. Percentages are not averaged.</Text>
            {taskError && <Text accessibilityRole="alert" className="text-red-700">{taskError}</Text>}
            <View className="flex-row flex-wrap gap-2">{['all', 'unassigned', 'assigned', 'in_progress', 'completed', 'overdue'].map(value => <Pressable key={value} testID={`block-filter-${value}`} accessibilityRole="radio" accessibilityLabel={`Block filter ${value}`} accessibilityState={{ selected: value === blockFilter, checked: value === blockFilter }} aria-checked={value === blockFilter} onPress={() => setBlockFilter(value)} className={`min-h-12 p-3 rounded-xl ${value === blockFilter ? 'bg-blue-100' : 'bg-gray-100'}`}><Text className="text-gray-900">{value.replace('_', ' ')}</Text></Pressable>)}</View>
            <Pressable accessibilityRole="button" accessibilityLabel="Refresh block statuses" onPress={() => setTaskRefresh(n => n + 1)} className="min-h-12 p-3 border border-gray-300 rounded-xl"><Text className="text-gray-900">Refresh statuses</Text></Pressable>
            {visibleBlocks.map(block => <Pressable key={block.id} testID={`select-block-${block.id}`} accessibilityRole="button" accessibilityLabel={`Select block ${block.name}`} accessibilityState={{ selected: mapping.selectedBlockId === block.id }} {...(Platform.OS === 'web' ? { 'aria-pressed': mapping.selectedBlockId === block.id } : {})} disabled={taskWriting} onPress={() => { if (!taskWritingRef.current) mapping.setSelectedBlockId(block.id); }} className={`min-h-12 p-3 rounded-xl border ${mapping.selectedBlockId === block.id ? 'bg-blue-50 border-blue-600' : 'border-gray-300'}`}><Text className="text-gray-900 font-semibold">{mapping.selectedBlockId === block.id ? 'Selected · ' : ''}{block.name} · {measureParcelGeometry(block.geometry).areaHectares.toFixed(4)} ha</Text></Pressable>)}</View>}
        {showTasks && mapping.selectedBlockId && <BlockMonitoringPanel key={mapping.selectedBlockId} blockId={mapping.selectedBlockId} parcelId={parcel.id} operatorId={user?.id || ''} disabled={mapping.dirty || mapping.saving || clearing || !!sourceError} onBusy={busy => { if (mounted.current) { taskBusyOwners.current = Math.max(0, taskBusyOwners.current + (busy ? 1 : -1)); const writing = taskBusyOwners.current > 0; taskWritingRef.current = writing; setTaskWriting(writing); if (!writing) setTaskRefresh(n => n + 1); } }} />}
    </>;
    return <KeyboardAvoidingView className="flex-1 bg-gray-50" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center gap-3 p-3 bg-white border-b border-gray-200"><Pressable testID="mapping-back" accessibilityRole="button" accessibilityLabel="Back from mapping" onPress={() => guard(() => router.back())} className="min-h-12 min-w-12 justify-center"><Text className="text-gray-900 font-bold">Back</Text></Pressable><Text className="flex-1 text-xl text-gray-900 font-bold">GPS Parcel Mapping</Text>{mapping.dirty && <Text testID="unsaved-badge" className="text-amber-800 font-bold">UNSAVED</Text>}</View>
        <View className="bg-white p-3 gap-2"><TextInput value={search} onChangeText={setSearch} accessibilityLabel="Search registered parcels" placeholder="Search parcels by name or code" placeholderTextColor="#9CA3AF" className="text-gray-900 min-h-12 border border-gray-300 rounded-xl p-3" /><ScrollView horizontal showsHorizontalScrollIndicator={false}>{parcels.filter(p => `${p.name} ${p.code || ''}`.toLowerCase().includes(search.toLowerCase())).map(p => <Pressable key={p.id} testID={`parcel-chip-${p.id}`} accessibilityRole="button" accessibilityState={{ selected: p.id === parcel.id }} {...(Platform.OS === 'web' ? { 'aria-pressed': p.id === parcel.id } : {})} onPress={() => selectParcel(p.id)} className={`min-h-12 px-4 mr-2 rounded-xl justify-center ${p.id === parcel.id ? 'bg-green-800' : 'bg-gray-100'}`}><Text className={p.id === parcel.id ? 'text-white font-bold' : 'text-gray-900 font-bold'}>{p.name} ({p.code || 'No code'})</Text></Pressable>)}</ScrollView></View>
        <MappingToolbar mode={mapping.mode} onMode={setMode} disabled={locked} onCurrentPosition={mutate(() => { if (mapping.mode === 'browse') mapping.begin('boundary'); setExpanded(true); void gps.capturePoint(); })} onAssign={() => {
            if (!mapping.selectedBlockId) { setDialog({ title: 'Select a Block', message: 'Save the layout and select a named block before assigning existing active workers.', mode: 'alert' }); return; }
            setShowTasks(true); setExpanded(true); gps.finish();
        }} />
        <View className={tokens.isDesktopOrLarger ? 'flex-1 flex-row' : 'flex-1'}>
            <View className="flex-1 min-h-0" onLayout={event => { if (event.nativeEvent.layout.height > 0) setMapSpace(event.nativeEvent.layout.height); }}>
                <ParcelMap coordinates={mapping.points} holes={['exclude', 'cut', 'block'].includes(mapping.mode) ? [] : mapping.geometry.holes} onChange={mutate(mapping.changePoints)} editable={!locked && mapping.mode !== 'browse' && mapping.mode !== 'gps'} height={mapSpace} closed={mapping.closed && !['cut', 'block', 'exclude'].includes(mapping.mode)} liveCoordinate={gps.liveFix?.coordinate || null} features={features} selectedFeatureId={mapping.selectedBlockId || parcel.id} selectedVertexIndex={mapping.selectedVertexIndex} onVertexSelect={mutate(mapping.setSelectedVertexIndex)} onFeatureSelect={id => { if (clearOwnership.current || taskWritingRef.current || mapping.saving || clearing) return; if (mapping.blocks.some(b => b.id === id)) { mapping.setSelectedBlockId(id); setExpanded(true); } else if (parcels.some(p => p.id === id)) selectParcel(id); }} fitRequest={fitRequest} showEdgeLengths mapLayer={layer} />
                {mapping.geometry.outer.length === 0 && <Text testID="empty-boundary-state" className="bg-white p-3 text-gray-700">No boundary captured. Choose Draw boundary, Record GPS, or Enter coordinates.</Text>}
                <View className="absolute top-3 right-3 gap-2"><Pressable accessibilityRole="button" accessibilityLabel="Fit selected geometry" onPress={() => setFitRequest(n => n + 1)} className="min-h-12 bg-white p-3 rounded-xl border border-gray-300"><Text className="text-gray-900 font-bold">Fit</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Change map imagery" onPress={() => setLayer(old => old === 'satellite' ? 'street' : 'satellite')} className="min-h-12 bg-white p-3 rounded-xl border border-gray-300"><Text className="text-gray-900 font-bold">{layer === 'satellite' ? 'Street' : 'Satellite'}</Text></Pressable></View>
            </View>
            <View className={tokens.isDesktopOrLarger ? 'w-96 bg-white border-l border-gray-200' : 'bg-white border-t border-gray-300'} style={tokens.isDesktopOrLarger ? undefined : { maxHeight: expanded ? dimensions.height * 0.45 : 52 }}>
                {!tokens.isDesktopOrLarger && <Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Collapse parcel details' : 'Expand parcel details'} accessibilityState={{ expanded }} onPress={() => setExpanded(old => !old)} className="min-h-12 p-3"><Text className="text-gray-900 text-center font-bold">{expanded ? 'Hide details' : `${parcel.name} · Details`}</Text></Pressable>}
                {(tokens.isDesktopOrLarger || expanded) && <ScrollView keyboardShouldPersistTaps="handled" className="flex-shrink" contentContainerStyle={{ paddingBottom: 12 }}>{inspector}</ScrollView>}
            </View>
        </View>
        <View className="bg-white p-3 border-t border-gray-200" style={{ paddingBottom: Math.max(12, insets.bottom) }}><Pressable testID="save-boundary" accessibilityRole="button" accessibilityLabel="Review and save parcel layout" disabled={locked} onPress={reviewSave} className={`min-h-12 p-3 rounded-xl ${locked ? 'bg-gray-400' : 'bg-green-800'}`}><Text className="text-white text-center font-bold">{mapping.saving ? 'Saving reviewed layout…' : 'Review & Save layout'}</Text></Pressable></View>
        <ConfirmDialog visible={!!dialog} title={dialog?.title || ''} message={dialog?.message || ''} mode={dialog?.mode || 'confirm'} confirmLabel={dialog?.confirmLabel} cancelLabel="Keep Editing" onConfirm={() => { const action = dialog?.onConfirm; setDialog(null); action?.(); }} onCancel={() => setDialog(null)} />
    </KeyboardAvoidingView>;
}
