import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useParcelMapping } from '../useParcelMapping';

const outer = [
    { latitude: 8, longitude: 125 }, { latitude: 8, longitude: 125.002 },
    { latitude: 8.002, longitude: 125.002 }, { latitude: 8.002, longitude: 125 },
];
const source = { parcelId: 'p1', revision: 0, geometry: { outer, holes: [] }, blocks: [] };
const setup = (snapshot = source, save = jest.fn(async () => 1)) => renderHook(() => useParcelMapping({ operatorId: 'supervisor', snapshot, onSave: save }));

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });
afterEach(async () => { await act(async () => {}); });

describe('parcel mapping controller', () => {
    it.each(['boundary', 'manual', 'gps'] as const)('requires explicit close for a valid open %s draft even after cancelling to Browse', async mode => {
        const save = jest.fn(async () => 1);
        const { result } = setup(source, save);
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin(mode));
        const edited = outer.slice(0, 3);
        act(() => result.current.changePoints(edited));
        expect(result.current.closed).toBe(false);
        expect(result.current.measurements!.areaHectares).toBeGreaterThan(0);
        await act(async () => { expect(await result.current.save()).toBe(false); });
        expect(result.current.error).toMatch(/close boundary/i);
        expect(save).not.toHaveBeenCalled();
        expect(result.current.geometry.outer).toEqual(edited);
        expect(result.current.dirty).toBe(true);
        await waitFor(async () => {
            const draft = JSON.parse((await AsyncStorage.getItem('parcel-mapping:supervisor:p1'))!);
            expect(draft.geometry.outer).toEqual(edited);
            expect(draft.closed).toBe(false);
        });
        act(() => result.current.cancelIntent());
        expect(result.current.mode).toBe('browse');
        expect(result.current.dirty).toBe(true);
        await act(async () => { expect(await result.current.save()).toBe(false); });
        expect(result.current.error).toMatch(/close boundary/i);
        expect(save).not.toHaveBeenCalled();
        expect(result.current.geometry.outer).toEqual(edited);
    });

    it('closes synchronously for same-event save and retains operation identity across failed close/save retries', async () => {
        const save = jest.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(1);
        const { result } = setup(source, save);
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin('boundary'));
        act(() => result.current.changePoints(outer.slice(0, 3)));
        await act(async () => {
            expect(result.current.closeBoundary()).toBe(true);
            expect(await result.current.save()).toBe(false);
        });
        expect(result.current.closed).toBe(true);
        expect(result.current.dirty).toBe(true);
        expect(result.current.error).toContain('disk full');
        await act(async () => {
            expect(result.current.closeBoundary()).toBe(true);
            expect(await result.current.save()).toBe(true);
        });
        expect(save).toHaveBeenCalledTimes(2);
        expect(save.mock.calls[0][0].operationId).toBe(save.mock.calls[1][0].operationId);
        expect(result.current.dirty).toBe(false);
    });

    it('reopens a previously saved boundary on a later edit and refuses another save', async () => {
        const save = jest.fn(async () => 1);
        const { result } = setup(source, save);
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin('boundary'));
        act(() => result.current.changePoints(outer));
        act(() => result.current.closeBoundary());
        await act(async () => { expect(await result.current.save()).toBe(true); });
        act(() => result.current.begin('boundary'));
        // The new edit and save share an event; an accepted-clean shortcut must not hide it.
        await act(async () => {
            result.current.changePoints(outer.slice(0, 3));
            expect(await result.current.save()).toBe(false);
        });
        expect(result.current.closed).toBe(false);
        expect(result.current.dirty).toBe(true);
        expect(result.current.geometry.outer).toHaveLength(3);
        expect(result.current.error).toMatch(/close boundary/i);
        expect(save).toHaveBeenCalledTimes(1);
    });

    it('persists a later edit closed in the same event instead of reusing the accepted-clean shortcut', async () => {
        const save = jest.fn(async () => 1);
        const { result, rerender } = renderHook(({ snapshot }) => useParcelMapping({ operatorId: 'supervisor', snapshot, onSave: save }), { initialProps: { snapshot: source } });
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        await act(async () => { expect(await result.current.save()).toBe(true); });
        rerender({ snapshot: { ...source, revision: 1 } });
        await act(async () => {
            result.current.begin('boundary');
            result.current.changePoints(outer.slice(0, 3));
            expect(result.current.closeBoundary()).toBe(true);
            expect(await result.current.save()).toBe(true);
        });
        expect(save).toHaveBeenCalledTimes(2);
        expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ expectedRevision: 1, geometry: { outer: outer.slice(0, 3), holes: [] } }));
    });

    it('allows legacy saved Browse geometry to be reconciled without editing or closing again', async () => {
        const save = jest.fn(async () => 1);
        const { result } = setup(source, save);
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        expect(result.current.closed).toBe(true);
        await act(async () => { expect(await result.current.save()).toBe(true); });
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ geometry: source.geometry, expectedRevision: 0 }));
    });

    it.each([
        ['incomplete', outer.slice(0, 2), /at least three/i],
        ['crossing', [outer[0], outer[2], outer[1], outer[3]], /cross|intersect/i],
    ] as const)('reports %s topology before the open-boundary requirement', async (_kind, points, expected) => {
        const save = jest.fn(async () => 1);
        const { result } = setup(source, save);
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin('boundary'));
        act(() => result.current.changePoints([...points]));
        act(() => { expect(result.current.closeBoundary()).toBe(false); });
        expect(result.current.closed).toBe(false);
        await act(async () => { expect(await result.current.save()).toBe(false); });
        expect(result.current.error).toMatch(expected);
        expect(result.current.error).not.toMatch(/close boundary/i);
        expect(save).not.toHaveBeenCalled();
        expect(result.current.geometry.outer).toEqual(points);
    });

    it.each(['exclude', 'cut', 'block'] as const)('does not accept a pending %s by auto-closing its open parent', async mode => {
        const { result } = setup();
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin('boundary'));
        act(() => result.current.changePoints(outer));
        act(() => result.current.begin(mode));
        const points = mode === 'cut' ? [{ latitude: 7.9999, longitude: 125.001 }, { latitude: 8.0021, longitude: 125.001 }] : [
            { latitude: 8.0005, longitude: 125.0005 }, { latitude: 8.0005, longitude: 125.001 },
            { latitude: 8.001, longitude: 125.001 }, { latitude: 8.001, longitude: 125.0005 },
        ];
        act(() => result.current.changePoints(points));
        if (mode !== 'exclude') act(() => result.current.previewDivision());
        act(() => { if (mode === 'exclude') result.current.acceptExclusion(); else result.current.acceptDivision(); });
        expect(result.current.closed).toBe(false);
        expect(result.current.error).toMatch(/close boundary/i);
        expect(result.current.points).toEqual(points);
        expect(result.current.geometry.holes).toHaveLength(0);
        expect(result.current.blocks).toHaveLength(0);
        act(() => { expect(result.current.closeBoundary()).toBe(true); });
        act(() => { if (mode === 'exclude') result.current.acceptExclusion(); else result.current.acceptDivision(); });
        expect(result.current.closed).toBe(true);
        expect(result.current.mode).toBe('browse');
        expect(result.current.points).toEqual(result.current.geometry.outer);
        expect(result.current.preview).toBeNull();
        expect(mode === 'exclude' ? result.current.geometry.holes.length : result.current.blocks.length).toBeGreaterThan(0);
    });

    it('starts in browse and ignores unintended point mutations', async () => {
        const { result } = setup();
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.changePoints([]));
        expect(result.current.mode).toBe('browse');
        expect(result.current.geometry.outer).toEqual(outer);
        expect(result.current.dirty).toBe(false);
    });

    it('supports explicit edits, undo/redo and cancel without changing saved data', async () => {
        const { result } = setup();
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin('boundary'));
        act(() => result.current.deleteVertex(1));
        expect(result.current.geometry.outer).toHaveLength(3);
        expect(result.current.dirty).toBe(true);
        act(() => result.current.undo());
        expect(result.current.geometry.outer).toEqual(outer);
        act(() => result.current.redo());
        expect(result.current.geometry.outer).toHaveLength(3);
        act(() => result.current.discard());
        expect(result.current.geometry.outer).toEqual(outer);
        expect(result.current.dirty).toBe(false);
    });

    it('rejects partial numeric input and accepts full decimal coordinates', async () => {
        const { result } = setup();
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin('manual'));
        act(() => result.current.addManual('8junk', '125'));
        expect(result.current.geometry.outer).toHaveLength(4);
        expect(result.current.error).toContain('decimal');
        act(() => result.current.addManual('8.001', '124.999'));
        expect(result.current.geometry.outer).toHaveLength(5);
    });

    it('previews exclusions and deducts unusable area only on acceptance', async () => {
        const { result } = setup();
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        const area = result.current.measurements!.areaSquareMeters;
        act(() => result.current.begin('exclude'));
        act(() => result.current.changePoints([
            { latitude: 8.0005, longitude: 125.0005 }, { latitude: 8.0005, longitude: 125.001 },
            { latitude: 8.001, longitude: 125.001 }, { latitude: 8.001, longitude: 125.0005 },
        ]));
        expect(result.current.geometry.holes).toHaveLength(0);
        act(() => result.current.acceptExclusion());
        expect(result.current.geometry.holes).toHaveLength(1);
        expect(result.current.measurements!.areaSquareMeters).toBeLessThan(area);
        expect(result.current.measurements!.totalBoundaryMeters).toBeGreaterThan(result.current.measurements!.outerPerimeterMeters);
    });

    it('previews every cut piece, cancels safely and accepts names without losing area', async () => {
        const { result } = setup();
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin('cut'));
        act(() => result.current.changePoints([{ latitude: 7.9999, longitude: 125.001 }, { latitude: 8.0021, longitude: 125.001 }]));
        act(() => result.current.previewDivision());
        expect(result.current.preview!.blocks).toHaveLength(2);
        expect(result.current.blocks).toHaveLength(0);
        act(() => result.current.cancelIntent());
        expect(result.current.blocks).toHaveLength(0);
        act(() => result.current.begin('cut'));
        act(() => result.current.changePoints([{ latitude: 7.9999, longitude: 125.001 }, { latitude: 8.0021, longitude: 125.001 }]));
        act(() => result.current.previewDivision());
        act(() => result.current.acceptDivision(['West', 'East']));
        expect(result.current.blocks.map(block => block.name)).toEqual(['West', 'East']);
        expect(result.current.remainder).toHaveLength(0);
    });

    it('requires accepting or cancelling an unfinished intent before switching tools', async () => {
        const { result } = setup();
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin('cut'));
        const endpoints = [{ latitude: 7.9999, longitude: 125.001 }, { latitude: 8.0021, longitude: 125.001 }];
        act(() => result.current.changePoints(endpoints));
        act(() => result.current.begin('boundary'));
        expect(result.current.mode).toBe('cut');
        expect(result.current.points).toEqual(endpoints);
        expect(result.current.error).toMatch(/accept or cancel/i);
    });

    it('rejects invalid/outside outlines while keeping the unfinished intent', async () => {
        const { result } = setup();
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin('block'));
        act(() => result.current.changePoints(outer.map(point => ({ ...point, latitude: point.latitude + 0.005 }))));
        act(() => result.current.previewDivision());
        expect(result.current.preview).toBeNull();
        expect(result.current.error).toContain('outside');
        expect(result.current.points).toHaveLength(4);
    });

    it('retains a failed save draft and retries with the identical operation ID', async () => {
        const save = jest.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(1);
        const { result } = setup(source, save);
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin('boundary'));
        act(() => result.current.changePoints(outer.map(point => ({ ...point, latitude: point.latitude + 0.0001 }))));
        act(() => result.current.closeBoundary());
        await act(async () => { await result.current.save(); });
        expect(result.current.dirty).toBe(true);
        expect(result.current.error).toContain('disk full');
        await act(async () => { await result.current.save(); });
        expect(save.mock.calls[0][0].operationId).toBe(save.mock.calls[1][0].operationId);
        expect(result.current.dirty).toBe(false);
        expect(result.current.revision).toBe(1);
    });

    it('loads asynchronously fetched blocks at the same revision while the draft is clean', async () => {
        const { result, rerender } = renderHook(({ snapshot }) => useParcelMapping({ operatorId: 'supervisor', snapshot, onSave: async () => 1 }), { initialProps: { snapshot: source as any } });
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        rerender({ snapshot: { ...source, blocks: [{ id: 'existing-block', name: 'Existing', geometry: source.geometry }] } });
        expect(result.current.blocks).toHaveLength(1);
    });

    it('locks editing and discard until the captured save operation finishes', async () => {
        let resolve!: (revision: number) => void;
        const save = jest.fn(() => new Promise<number>(done => { resolve = done; }));
        const { result } = setup(source, save as any);
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin('boundary'));
        const edited = outer.map(point => ({ ...point, latitude: point.latitude + 0.0001 }));
        act(() => result.current.changePoints(edited));
        act(() => result.current.closeBoundary());
        let saving!: Promise<boolean>;
        act(() => { saving = result.current.save(); });
        act(() => { result.current.begin('cut'); result.current.changePoints([]); result.current.undo(); result.current.discard(); });
        expect(result.current.geometry.outer).toEqual(edited);
        expect(result.current.mode).toBe('boundary');
        act(() => { result.current.acceptExclusion(); result.current.previewDivision(); result.current.acceptDivision(); });
        expect(result.current.error).toBeNull();
        act(() => { result.current.discardDraft(); result.current.recoverDraft(); });
        expect(result.current.mode).toBe('boundary');
        await act(async () => { resolve(1); await saving; });
        expect(result.current.geometry.outer).toEqual(edited);
        expect(result.current.dirty).toBe(false);
    });

    it('reports successful persistence separately from failed draft cleanup', async () => {
        const { result } = setup();
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin('boundary'));
        act(() => result.current.changePoints(outer));
        act(() => result.current.closeBoundary());
        const realRemove = (AsyncStorage.removeItem as jest.Mock).getMockImplementation()!;
        const remove = jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('cleanup denied'));
        let accepted: unknown;
        await act(async () => { accepted = await result.current.save(); });
        expect(accepted).toBe(true);
        expect(result.current.dirty).toBe(false);
        expect(result.current.error).toContain('saved');
        remove.mockImplementation(realRemove);
    });

    it('cancels an unaccepted cut without marking the saved layout changed', async () => {
        const { result } = setup();
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin('cut'));
        act(() => result.current.changePoints([{ latitude: 7.9999, longitude: 125.001 }, { latitude: 8.0021, longitude: 125.001 }]));
        act(() => result.current.cancelIntent());
        expect(result.current.dirty).toBe(false);
        expect(result.current.geometry).toEqual(source.geometry);
    });

    it('waits for writes from an unmounted editor before recovering the same parcel draft', async () => {
        const realSet = (AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
        let release!: () => void;
        const set = jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce((key, value) => new Promise<void>(resolve => {
            release = () => { void realSet(key, value).then(resolve); };
        }));
        const first = setup();
        await waitFor(() => expect(first.result.current.draftLoading).toBe(false));
        act(() => first.result.current.begin('boundary'));
        act(() => first.result.current.deleteVertex(0));
        await waitFor(() => expect(set).toHaveBeenCalledTimes(1));
        first.unmount();
        const second = setup();
        await act(async () => {});
        expect(second.result.current.draftLoading).toBe(true);
        await act(async () => { release(); });
        await waitFor(() => expect(second.result.current.draftLoading).toBe(false));
        expect(second.result.current.recoverableDraft?.geometry.outer).toHaveLength(3);
        set.mockImplementation(realSet);
    });

    it('returns false when manual points are ignored in browse or a third cut endpoint is rejected', async () => {
        const { result } = setup();
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        let accepted: unknown;
        act(() => { accepted = result.current.addManual('8', '125'); });
        expect(accepted).toBe(false);
        act(() => result.current.begin('cut'));
        act(() => result.current.addManual('8', '125'));
        act(() => result.current.addManual('8.001', '125'));
        act(() => { accepted = result.current.addManual('8.002', '125'); });
        expect(accepted).toBe(false);
        expect(result.current.points).toHaveLength(2);
    });

    it('does not delete a replacement editor draft when an obsolete save resolves', async () => {
        let resolve!: (revision: number) => void;
        const first = setup(source, jest.fn(() => new Promise<number>(done => { resolve = done; })) as any);
        await waitFor(() => expect(first.result.current.draftLoading).toBe(false));
        act(() => first.result.current.begin('boundary'));
        act(() => first.result.current.changePoints(outer));
        act(() => first.result.current.closeBoundary());
        let saving!: Promise<boolean>;
        act(() => { saving = first.result.current.save(); });
        first.unmount();
        const second = setup();
        await waitFor(() => expect(second.result.current.draftLoading).toBe(false));
        act(() => second.result.current.begin('boundary'));
        const newer = outer.map(p => ({ ...p, latitude: p.latitude + 0.0002 }));
        act(() => second.result.current.changePoints(newer));
        await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('parcel-mapping:supervisor:p1'))!).geometry.outer).toEqual(newer));
        await act(async () => { resolve(1); await saving; });
        expect(JSON.parse((await AsyncStorage.getItem('parcel-mapping:supervisor:p1'))!).geometry.outer).toEqual(newer);
        expect(second.result.current.dirty).toBe(true);
    });

    it.each(['parcel', 'operator'])('does not write the previous dirty session into a new %s draft key', async kind => {
        const target = kind === 'parcel' ? { ...source, parcelId: 'p2' } : source;
        const nextOperator = kind === 'operator' ? 'other-supervisor' : 'supervisor';
        const destinationKey = `parcel-mapping:${nextOperator}:${target.parcelId}`;
        const destination = JSON.stringify({ ...target, geometry: { outer: outer.slice(0, 3), holes: [] }, operationId: 'destination-op', mode: 'boundary', points: [], closed: true });
        await AsyncStorage.setItem(destinationKey, destination);
        const { result, rerender } = renderHook(({ operatorId, snapshot }) => useParcelMapping({ operatorId, snapshot, onSave: async () => 1 }), { initialProps: { operatorId: 'supervisor', snapshot: source } });
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin('boundary'));
        act(() => result.current.changePoints(outer.map(p => ({ ...p, latitude: p.latitude + 0.0001 }))));
        await waitFor(async () => expect(await AsyncStorage.getItem('parcel-mapping:supervisor:p1')).not.toBeNull());
        rerender({ operatorId: nextOperator, snapshot: target });
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        await act(async () => {});
        expect(await AsyncStorage.getItem(destinationKey)).toBe(destination);
        expect(result.current.recoverableDraft?.operationId).toBe('destination-op');
        expect(result.current.dirty).toBe(false);
        expect(result.current.geometry.outer).toEqual(outer);
    });

    it('does not resubmit an unchanged accepted layout with a reused UUID and new revision', async () => {
        const save = jest.fn(async () => 1);
        const { result } = setup(source, save);
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        act(() => result.current.begin('boundary'));
        act(() => result.current.changePoints(outer));
        act(() => result.current.closeBoundary());
        await act(async () => { expect(await result.current.save()).toBe(true); });
        await act(async () => { expect(await result.current.save()).toBe(true); });
        expect(save).toHaveBeenCalledTimes(1);
        expect(result.current.revision).toBe(1);
    });

    it('distinguishes a correction-required remainder from fully assigned usable land', async () => {
        const { result } = setup({ ...source, blocks: [{ id: 'near-full', name: 'Near full', geometry: { outer: outer.map(p => ({ ...p, longitude: p.longitude === 125.002 ? p.longitude - 1e-10 : p.longitude })), holes: [] } }] } as any);
        await waitFor(() => expect(result.current.draftLoading).toBe(false));
        expect(result.current.remainderError).toMatch(/fragment/i);
        expect(result.current.remainder).toBeNull();
    });

    it('offers draft recovery explicitly and refuses stale revision recovery', async () => {
        const saved = { ...source, geometry: { outer: outer.map(point => ({ ...point, latitude: point.latitude + 0.0001 })), holes: [] }, operationId: 'draft-op', mode: 'boundary', points: [], closed: true };
        await AsyncStorage.setItem('parcel-mapping:supervisor:p1', JSON.stringify(saved));
        const { result, unmount } = setup();
        await waitFor(() => expect(result.current.recoverableDraft).not.toBeNull());
        expect(result.current.geometry.outer).toEqual(outer);
        act(() => result.current.recoverDraft());
        expect(result.current.geometry.outer).toEqual(saved.geometry.outer);
        await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('parcel-mapping:supervisor:p1'))!).geometry.outer).toEqual(saved.geometry.outer));
        await act(async () => {});
        unmount();
        await AsyncStorage.setItem('parcel-mapping:supervisor:p1', JSON.stringify({ ...saved, revision: 99 }));
        const second = setup();
        await waitFor(() => expect(second.result.current.draftLoading).toBe(false));
        act(() => second.result.current.recoverDraft());
        expect(second.result.current.geometry.outer).toEqual(outer);
        expect(second.result.current.error).toContain('revision');
    });
});
