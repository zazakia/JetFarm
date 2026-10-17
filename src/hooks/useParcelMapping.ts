import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuid } from 'uuid';
import { GPSCoordinate, isValidCoordinate, parseCoordinateNumber } from '../utils/coordinates';
import { ParcelGeometry, measureParcelGeometry, validateParcelGeometry, validateBlockLayout, subtractBlocks, splitParcelByLine, snapCoordinateToGeometry } from '../utils/parcelGeometry';

export type MappingMode = 'browse' | 'boundary' | 'manual' | 'gps' | 'exclude' | 'cut' | 'block';
export interface MappingBlock { id: string; name: string; geometry: ParcelGeometry }
export interface MappingSnapshot { parcelId: string; revision: number; geometry: ParcelGeometry; blocks: MappingBlock[] }
export interface MappingSaveInput extends MappingSnapshot { expectedRevision: number; operationId: string }
interface Draft extends MappingSnapshot { operationId: string; mode: MappingMode; points: GPSCoordinate[]; closed: boolean }
interface EditState { geometry: ParcelGeometry; blocks: MappingBlock[]; points: GPSCoordinate[]; closed: boolean }
interface DivisionPreview { blocks: MappingBlock[]; remainder: ParcelGeometry[] }
interface Options { operatorId: string; snapshot: MappingSnapshot; onSave: (input: MappingSaveInput) => Promise<number> }
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const stateOf = (snapshot: MappingSnapshot): EditState => ({ geometry: copy(snapshot.geometry), blocks: copy(snapshot.blocks), points: [], closed: snapshot.geometry.outer.length >= 3 });
const modes: MappingMode[] = ['browse', 'boundary', 'manual', 'gps', 'exclude', 'cut', 'block'];
// Shared by remounts: recovery must not overtake a previous editor's durable write.
const draftQueues = new Map<string, Promise<unknown>>();
const ringValid = (points: unknown): points is GPSCoordinate[] => Array.isArray(points) && points.length <= 10000 && points.every(p => p && isValidCoordinate(p.latitude, p.longitude));
function draftValid(value: any): value is Draft {
    return value && typeof value.parcelId === 'string' && Number.isInteger(value.revision) && value.revision >= 0 &&
        typeof value.operationId === 'string' && modes.includes(value.mode) && typeof value.closed === 'boolean' && ringValid(value.points) &&
        value.geometry && ringValid(value.geometry.outer) && Array.isArray(value.geometry.holes) && value.geometry.holes.every(ringValid) &&
        Array.isArray(value.blocks) && value.blocks.length <= 1000 && value.blocks.every((block: any) => block && typeof block.id === 'string' && typeof block.name === 'string' && validateParcelGeometry(block.geometry).length === 0);
}

/** Renderer-independent editing, topology previews and operator-scoped durable drafts. */
export function useParcelMapping({ operatorId, snapshot, onSave }: Options) {
    const key = `parcel-mapping:${operatorId}:${snapshot.parcelId}`;
    const [editKey, setEditKey] = useState(key);
    const [edit, setEdit] = useState<EditState>(() => stateOf(snapshot));
    const [mode, setMode] = useState<MappingMode>('browse');
    const [dirty, setDirty] = useState(false);
    const [revision, setRevision] = useState(snapshot.revision);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<DivisionPreview | null>(null);
    const [saving, setSaving] = useState(false);
    const [draftLoading, setDraftLoading] = useState(true);
    const [recoverableDraft, setRecoverableDraft] = useState<Draft | null>(null);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
    const baseline = useRef(snapshot);
    const undoStack = useRef<EditState[]>([]);
    const redoStack = useRef<EditState[]>([]);
    const currentEdit = useRef(edit);
    currentEdit.current = edit;
    const currentMode = useRef(mode);
    currentMode.current = mode;
    const currentDirty = useRef(dirty);
    currentDirty.current = dirty;
    const operation = useRef(uuid());
    const savingRef = useRef(false);
    const acceptedClean = useRef(false);
    const session = useRef(0);
    const enqueue = useCallback((work: () => Promise<unknown>) => {
        const queued = (draftQueues.get(key) ?? Promise.resolve()).catch(() => {}).then(work);
        draftQueues.set(key, queued);
        const cleanup = () => { if (draftQueues.get(key) === queued) draftQueues.delete(key); };
        void queued.then(cleanup, cleanup);
        return queued;
    }, [key]);

    useEffect(() => {
        let active = true;
        session.current += 1;
        savingRef.current = false; acceptedClean.current = false; setSaving(false);
        baseline.current = snapshot;
        undoStack.current = []; redoStack.current = [];
        operation.current = uuid();
        setEditKey(key); setEdit(stateOf(snapshot)); setMode('browse'); setDirty(false); setRevision(snapshot.revision);
        setSelectedBlockId(null); setSelectedVertexIndex(null); setPreview(null); setError(null); setRecoverableDraft(null); setDraftLoading(true);
        enqueue(() => AsyncStorage.getItem(key)).then(raw => {
            if (!active) return;
            if (typeof raw === 'string' && raw.length <= 2000000) {
                try {
                    const value = JSON.parse(raw);
                    if (!draftValid(value) || value.parcelId !== snapshot.parcelId) throw new Error('Invalid draft');
                    setRecoverableDraft(value);
                } catch { setError('Saved draft is invalid. Discard it before editing.'); }
            }
        }).catch(() => { if (active) setError('Draft storage is unavailable. Keep this screen open until saving.'); })
            .finally(() => { if (active) setDraftLoading(false); });
        return () => { active = false; session.current += 1; };
        // Parcel/operator changes are explicit screen decisions; revision changes are handled below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, enqueue]);

    useEffect(() => {
        if (savingRef.current || snapshot.parcelId !== baseline.current.parcelId || snapshot.revision < baseline.current.revision || JSON.stringify(snapshot) === JSON.stringify(baseline.current)) return;
        if (currentDirty.current) {
            setError('Parcel revision changed. Discard or review the draft against the latest saved boundary before applying it.');
            return;
        }
        baseline.current = snapshot;
        setEdit(stateOf(snapshot)); setRevision(snapshot.revision);
    }, [snapshot]);

    useEffect(() => {
        // A key-changing render still contains the previous session's state until
        // the reset effect renders. Never label that state as the destination draft.
        if (editKey !== key || !dirty || draftLoading || !snapshot.parcelId) return;
        const draft: Draft = { parcelId: snapshot.parcelId, revision, geometry: edit.geometry, blocks: edit.blocks, operationId: operation.current, mode, points: edit.points, closed: edit.closed };
        const generation = session.current;
        enqueue(() => AsyncStorage.setItem(key, JSON.stringify(draft))).catch(() => {
            if (session.current === generation) setError('Draft could not be stored. Keep this screen open until saving.');
        });
    }, [dirty, draftLoading, edit, editKey, mode, key, revision, snapshot.parcelId, enqueue]);

    const commit = useCallback((next: EditState) => {
        if (savingRef.current) return;
        undoStack.current.push(copy(currentEdit.current)); redoStack.current = [];
        currentEdit.current = next; currentDirty.current = true;
        setEdit(next); setDirty(true); setError(null); setPreview(null); operation.current = uuid();
    }, []);
    const begin = useCallback((next: MappingMode) => {
        if (savingRef.current) return;
        if (['exclude', 'cut', 'block'].includes(currentMode.current) && currentEdit.current.points.length) {
            setError('Accept or cancel the unfinished exclusion/division before switching tools.'); return;
        }
        setMode(next); currentMode.current = next; setError(null); setPreview(null); setSelectedVertexIndex(null);
        setEdit(old => ({ ...old, points: [], closed: next === 'boundary' || next === 'gps' || next === 'manual' ? false : old.closed }));
    }, []);
    const points = mode === 'exclude' || mode === 'cut' || mode === 'block' ? edit.points : edit.geometry.outer;
    const changePoints = useCallback((next: GPSCoordinate[]) => {
        if (savingRef.current || currentMode.current === 'browse' || !ringValid(next)) return false;
        const old = currentEdit.current;
        if (['exclude', 'cut', 'block'].includes(currentMode.current)) {
            if (currentMode.current === 'cut' && next.length > 2) { setError('A straight cut uses exactly two points. Undo or replace an endpoint.'); return false; }
            commit({ ...old, points: copy(next) });
        } else commit({ ...old, geometry: { ...old.geometry, outer: copy(next) }, closed: false });
        return true;
    }, [commit]);
    const addManual = useCallback((latitudeText: string, longitudeText: string) => {
        const latitude = parseCoordinateNumber(latitudeText), longitude = parseCoordinateNumber(longitudeText);
        if (latitude === null || longitude === null || !isValidCoordinate(latitude, longitude)) {
            setError('Enter full decimal degrees: latitude −90…90 and longitude −180…180.'); return false;
        }
        const old = currentEdit.current;
        const activePoints = ['exclude', 'cut', 'block'].includes(currentMode.current) ? old.points : old.geometry.outer;
        return changePoints([...activePoints, { latitude, longitude }]);
    }, [changePoints]);
    const deleteVertex = useCallback((index: number) => {
        if (!Number.isInteger(index) || index < 0) return;
        const old = currentEdit.current;
        const activePoints = ['exclude', 'cut', 'block'].includes(currentMode.current) ? old.points : old.geometry.outer;
        if (index >= activePoints.length) return;
        changePoints(activePoints.filter((_, i) => i !== index)); setSelectedVertexIndex(null);
    }, [changePoints]);
    const history = useCallback((from: { current: EditState[] }, to: { current: EditState[] }) => {
        if (savingRef.current) return;
        const next = from.current.pop(); if (!next) return;
        to.current.push(copy(currentEdit.current)); currentEdit.current = next; setEdit(next); setDirty(true); setError(null); setPreview(null); operation.current = uuid();
    }, []);
    const undo = useCallback(() => history(undoStack, redoStack), [history]);
    const redo = useCallback(() => history(redoStack, undoStack), [history]);
    const discard = useCallback(() => {
        if (savingRef.current) return;
        baseline.current = snapshot;
        setEdit(stateOf(snapshot)); setRevision(snapshot.revision); setMode('browse'); setDirty(false); setPreview(null); setError(null); setRecoverableDraft(null);
        undoStack.current = []; redoStack.current = []; operation.current = uuid();
        enqueue(() => AsyncStorage.removeItem(key)).catch(() => setError('Could not discard the stored draft.'));
    }, [snapshot, key, enqueue]);
    const discardDraft = useCallback(() => {
        if (savingRef.current) return;
        setRecoverableDraft(null); setError(null);
        enqueue(() => AsyncStorage.removeItem(key)).catch(() => setError('Could not discard the stored draft.'));
    }, [key, enqueue]);
    const recoverDraft = useCallback(() => {
        if (savingRef.current || !recoverableDraft) return;
        if (recoverableDraft.revision !== snapshot.revision) { setError('Draft revision differs from the saved parcel. Review coordinates and start a fresh layout; stale drafts cannot be applied.'); return; }
        setEdit({ geometry: copy(recoverableDraft.geometry), blocks: copy(recoverableDraft.blocks), points: copy(recoverableDraft.points), closed: recoverableDraft.closed });
        setMode(recoverableDraft.mode); setDirty(true); operation.current = recoverableDraft.operationId; setRecoverableDraft(null); setError(null);
    }, [recoverableDraft, snapshot.revision]);
    const cancelIntent = useCallback(() => {
        if (savingRef.current) return;
        const old = currentEdit.current;
        const stillDirty = JSON.stringify({ geometry: old.geometry, blocks: old.blocks }) !== JSON.stringify({ geometry: baseline.current.geometry, blocks: baseline.current.blocks });
        currentEdit.current = { ...old, points: [] };
        currentMode.current = 'browse';
        setPreview(null); setMode('browse'); setEdit(currentEdit.current); setDirty(stillDirty); setError(null);
        if (!stillDirty) {
            undoStack.current = []; redoStack.current = [];
            enqueue(() => AsyncStorage.removeItem(key)).catch(() => setError('Could not discard the stored draft.'));
        }
    }, [key, enqueue]);
    const closeBoundary = useCallback(() => {
        if (savingRef.current) return false;
        const errors = validateParcelGeometry(currentEdit.current.geometry);
        if (errors.length) { setError(errors.join('; ')); return false; }
        currentEdit.current = { ...currentEdit.current, closed: true };
        setEdit(currentEdit.current); setError(null); return true;
    }, []);
    const acceptExclusion = useCallback(() => {
        if (savingRef.current || currentMode.current !== 'exclude') return;
        const old = currentEdit.current;
        const geometry = { ...old.geometry, holes: [...old.geometry.holes, old.points] };
        const errors = validateBlockLayout(geometry, old.blocks.map(block => block.geometry));
        if (errors.length) { setError(errors.join('; ')); return; }
        if (old.closed !== true) { setError('Use Close boundary before accepting an exclusion.'); return; }
        commit({ ...old, geometry, points: [] }); setMode('browse');
    }, [commit]);
    const previewDivision = useCallback(() => {
        if (savingRef.current || !['cut', 'block'].includes(currentMode.current)) return;
        try {
            const old = currentEdit.current;
            const selected = old.blocks.find(block => block.id === selectedBlockId);
            if (currentMode.current === 'cut' && old.blocks.length > 0 && !selected) throw new Error('Select an unassigned block to cut, or outline a new block in the remainder.');
            const target = selected?.geometry ?? old.geometry;
            const acceptedPoints = old.points.map(point => snapCoordinateToGeometry(point, target));
            const pieces = currentMode.current === 'cut' ? splitParcelByLine(target, acceptedPoints as [GPSCoordinate, GPSCoordinate]) : [{ outer: acceptedPoints, holes: [] }];
            const retained = currentMode.current === 'cut' && selected ? old.blocks.filter(block => block.id !== selected.id) : old.blocks;
            const blocks = [...retained, ...pieces.map((geometry, index) => ({ id: uuid(), name: `Block ${retained.length + index + 1}`, geometry }))];
            const errors = validateBlockLayout(old.geometry, blocks.map(block => block.geometry));
            if (errors.length) throw new Error(errors.join('; '));
            setPreview({ blocks, remainder: subtractBlocks(old.geometry, blocks.map(block => block.geometry)) }); setError(null);
        } catch (e) { setPreview(null); setError(e instanceof Error ? e.message : 'Division failed. Adjust the points.'); }
    }, [selectedBlockId]);
    const acceptDivision = useCallback((names?: string[]) => {
        if (savingRef.current || !preview || !['cut', 'block'].includes(currentMode.current)) return;
        const blocks = preview.blocks.map((block, index) => ({ ...block, name: names?.[index]?.trim() || block.name }));
        if (blocks.some(block => !block.name || block.name.length > 100)) { setError('Block names must contain 1–100 characters.'); return; }
        const old = currentEdit.current;
        const errors = validateBlockLayout(old.geometry, blocks.map(block => block.geometry));
        if (errors.length) { setError(errors.join('; ')); return; }
        if (old.closed !== true) { setError('Use Close boundary before accepting a division.'); return; }
        commit({ ...old, blocks, points: [] }); setMode('browse'); setSelectedBlockId(null);
    }, [preview, commit]);
    const measurements = useMemo(() => {
        try { return measureParcelGeometry(edit.geometry); } catch { return null; }
    }, [edit.geometry]);
    const remainderResult = useMemo(() => {
        try { return { geometry: subtractBlocks(edit.geometry, edit.blocks.map(block => block.geometry)), error: null }; }
        catch (e) { return { geometry: null, error: e instanceof Error ? e.message : 'Remainder could not be measured. Correct the layout before saving.' }; }
    }, [edit.geometry, edit.blocks]);
    const remainder = remainderResult.geometry;
    const remainderError = remainderResult.error;
    const save = useCallback(async () => {
        if (savingRef.current) return false;
        const old = currentEdit.current;
        const errors = validateBlockLayout(old.geometry, old.blocks.map(block => block.geometry));
        if (errors.length) { setError(errors.join('; ')); return false; }
        if (old.closed !== true) { setError('Use Close boundary before reviewing or saving the layout.'); return false; }
        if (acceptedClean.current && !currentDirty.current) return true;
        if (revision !== snapshot.revision) { setError('Parcel revision changed. Review or discard the draft before saving.'); return false; }
        if (remainderError) { setError(remainderError); return false; }
        if (['exclude', 'cut', 'block'].includes(currentMode.current) && old.points.length) { setError('Accept or cancel the unfinished exclusion/division first.'); return false; }
        savingRef.current = true; setSaving(true); setError(null);
        const generation = session.current;
        const current = () => session.current === generation;
        const input: MappingSaveInput = { parcelId: snapshot.parcelId, revision, expectedRevision: revision, geometry: copy(old.geometry), blocks: copy(old.blocks), operationId: operation.current };
        try {
            const accepted = await onSave(input);
            // A saved operation owns only its own draft, never a replacement editor's work.
            let cleanupFailed = false;
            try {
                await enqueue(async () => {
                    const raw = await AsyncStorage.getItem(key);
                    if (raw && JSON.parse(raw).operationId === input.operationId) await AsyncStorage.removeItem(key);
                });
            } catch { cleanupFailed = true; }
            if (!current()) return false;
            baseline.current = { parcelId: input.parcelId, geometry: input.geometry, blocks: input.blocks, revision: accepted };
            operation.current = uuid(); acceptedClean.current = true;
            currentDirty.current = false; currentMode.current = 'browse';
            setRevision(accepted); setDirty(false); setMode('browse'); setEdit({ ...old, closed: true });
            undoStack.current = []; redoStack.current = [];
            if (cleanupFailed) setError('Layout saved successfully, but the old local draft could not be removed. Discard that stale draft when storage is available.');
            return true;
        } catch (e) { if (current()) setError(e instanceof Error ? e.message : 'Save failed. Your draft is retained.'); return false; }
        finally { if (current()) { savingRef.current = false; setSaving(false); } }
    }, [revision, snapshot.revision, snapshot.parcelId, onSave, key, enqueue, remainderError]);
    return { geometry: edit.geometry, blocks: edit.blocks, points, mode, dirty, revision, error, preview, saving, measurements, remainder, remainderError,
        closed: edit.closed, selectedBlockId, setSelectedBlockId, selectedVertexIndex, setSelectedVertexIndex,
        draftLoading, recoverableDraft, recoverDraft, discardDraft, begin, changePoints, addManual, deleteVertex,
        undo, redo, discard, cancelIntent, closeBoundary, acceptExclusion, previewDivision, acceptDivision, save };
}
