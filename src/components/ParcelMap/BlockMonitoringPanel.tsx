import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Database, Q } from '@nozbe/watermelondb';
import { database } from '../../database';
import AgriParcelBlock from '../../database/models/AgriParcelBlock';
import AgriFarmWorker from '../../database/models/AgriFarmWorker';
import AgriCropCycle from '../../database/models/AgriCropCycle';
import AgriBlockAssignment from '../../database/models/AgriBlockAssignment';
import AgriBlockProgress from '../../database/models/AgriBlockProgress';
import { AgriBlockAssignmentService, deriveAssignmentStatus } from '../../services/AgriBlockAssignmentService';
import { BlockAssignmentPanel, initialAssignmentDraft } from './BlockAssignmentPanel';
import { BlockProgressPanel, initialProgressDraft } from './BlockProgressPanel';
import { assertAgriDatabaseUsable } from '../../services/AgriWriteSafety';
import { useMonitoringDrafts } from './monitoringForm';

type Filter = 'all' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
type BusyOwner = (busy: boolean) => void;
// Stable callbacks identify busy owners across overlapping session lifetimes.
const busyOwners = new WeakMap<BusyOwner, number>();
function reportOwnerBusy(owner: BusyOwner | undefined, busy: boolean) {
    if (!owner) return;
    const count = busyOwners.get(owner) ?? 0;
    if (busy) {
        busyOwners.set(owner, count + 1);
        if (!count) owner(true);
    } else if (count > 1) busyOwners.set(owner, count - 1);
    else if (count === 1) { busyOwners.delete(owner); owner(false); }
}
interface Props { blockId: string; parcelId: string; operatorId: string; db?: Database; disabled?: boolean; onBusy?: BusyOwner }
export function BlockMonitoringPanel({ db = database, ...props }: Props) {
    const scope = useRef({ db, blockId: props.blockId, parcelId: props.parcelId, operatorId: props.operatorId, key: 0 });
    if (scope.current.db !== db || scope.current.blockId !== props.blockId || scope.current.parcelId !== props.parcelId || scope.current.operatorId !== props.operatorId) {
        scope.current = { db, blockId: props.blockId, parcelId: props.parcelId, operatorId: props.operatorId, key: scope.current.key + 1 };
    }
    // Remount synchronously on every scope transition, including a return to a previous scope.
    return <BlockMonitoringSession key={scope.current.key} {...props} db={db} />;
}
function BlockMonitoringSession({ blockId, parcelId, operatorId, db = database, disabled, onBusy }: Props) {
    const getDraft = useMonitoringDrafts();
    const [block, setBlock] = useState<AgriParcelBlock | null>(null), [workers, setWorkers] = useState<AgriFarmWorker[]>([]), [cycles, setCycles] = useState<AgriCropCycle[]>([]);
    const [assignments, setAssignments] = useState<AgriBlockAssignment[]>([]), [history, setHistory] = useState<AgriBlockProgress[]>([]);
    const [selected, setSelected] = useState<string | null>(null), [filter, setFilter] = useState<Filter>('all');
    const [loading, setLoading] = useState(true), [error, setError] = useState(''), [writing, setWriting] = useState(false);
    const generation = useRef(0), mounted = useRef(true), writingRef = useRef(false), lifetime = useRef(0);
    const load = useCallback(async () => {
        const session = ++generation.current;
        try {
            assertAgriDatabaseUsable(db);
            const [saved, workerRows, cycleRows, rows] = await Promise.all([
                db.get<AgriParcelBlock>('agri_parcel_blocks').find(blockId),
                db.get<AgriFarmWorker>('agri_farm_workers').query().fetch(),
                db.get<AgriCropCycle>('agri_crop_cycles').query(Q.where('parcel_id', parcelId), Q.where('deleted_at', null)).fetch(),
                AgriBlockAssignmentService.listAssignments(blockId, db),
            ]);
            assertAgriDatabaseUsable(db);
            if (saved.parcelId !== parcelId) throw new Error('Block does not belong to the selected parcel.');
            if (!mounted.current || session !== generation.current) return;
            setBlock(saved); setWorkers(workerRows); setCycles(cycleRows); setAssignments(rows); setError(''); setLoading(false);
        } catch (e) {
            if (mounted.current && session === generation.current) {
                setBlock(null); setWorkers([]); setCycles([]); setAssignments([]); setHistory([]);
                setError(e instanceof Error ? e.message : 'Tasks could not be loaded.'); setLoading(false);
            }
            throw e;
        }
    }, [blockId, parcelId, db]);
    useEffect(() => {
        mounted.current = true; lifetime.current += 1; writingRef.current = false;
        setLoading(true);
        void load().catch(() => undefined);
        return () => { mounted.current = false; generation.current += 1; lifetime.current += 1; };
    }, [load]);
    useEffect(() => {
        let active = true;
        setHistory([]);
        if (block && selected && assignments.some(row => row.id === selected)) void AgriBlockAssignmentService.listProgress(selected, db).then(rows => {
            assertAgriDatabaseUsable(db);
            if (active) setHistory(rows);
        }).catch(e => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [block, selected, assignments, db]);
    const write = async (work: () => Promise<unknown>) => {
        if (!mounted.current || !operatorId || disabled || writingRef.current) throw new Error('Save the layout and wait for the current write before updating tasks.');
        assertAgriDatabaseUsable(db);
        const session = lifetime.current;
        const current = () => mounted.current && lifetime.current === session;
        const reportBusy = onBusy;
        writingRef.current = true; setWriting(true);
        try {
            reportOwnerBusy(reportBusy, true);
            await work();
            if (!current()) return;
            try { await load(); }
            catch (e) { if (current()) setError(`Saved locally; refresh failed: ${e instanceof Error ? e.message : 'Unknown error'}. Retry loading, not the submission.`); }
        } finally {
            if (current()) { writingRef.current = false; setWriting(false); }
            // Settle this request without unlocking overlapping writes for the same owner.
            reportOwnerBusy(reportBusy, false);
        }
    };
    let databaseError = '';
    try { assertAgriDatabaseUsable(db); }
    catch (e) { databaseError = e instanceof Error ? e.message : 'Reopen persisted storage before retrying.'; }
    const refresh = <Pressable accessibilityRole="button" accessibilityLabel="Refresh block tasks" disabled={writing || !!databaseError} onPress={() => { void load().catch(() => undefined); }} className="min-h-12 p-3 border border-gray-300 rounded-xl"><Text className="text-gray-900">Refresh tasks</Text></Pressable>;
    if (loading && !databaseError) return <ActivityIndicator accessibilityLabel="Loading block tasks" />;
    if (!block || databaseError) return <View className="p-4 gap-2"><Text accessibilityRole="alert" className="text-red-700">{databaseError || error || 'Save this block layout before assigning workers.'}</Text>{refresh}</View>;
    const now = Date.now();
    const selectedAssignment = assignments.find(row => row.id === selected);
    return <View testID="block-monitoring-panel" className="border-t border-gray-200">
        <View className="p-4 gap-2"><Text className="text-lg font-bold text-gray-900">{block.name} · Supervisor tasks</Text>
            <Text className="text-gray-700">{assignments.length ? `${assignments.filter(a => a.status === 'assigned' || a.status === 'in_progress').length} unfinished · ${assignments.filter(a => a.status === 'completed').length} completed · ${assignments.filter(a => deriveAssignmentStatus(a, now) === 'overdue').length} overdue` : 'Unassigned block · no tasks yet'}</Text>
            <Text className="text-gray-700">Active tasks lock this block's boundary. Complete or cancel them before dividing or archiving.</Text>
            {error && <Text accessibilityRole="alert" className="text-red-700">{error}</Text>}
            {refresh}
            <View className="flex-row flex-wrap gap-2">{(['all', 'assigned', 'in_progress', 'completed', 'cancelled', 'overdue'] as Filter[]).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`Task filter ${value}`} accessibilityState={{ selected: value === filter, checked: value === filter }} aria-checked={value === filter} onPress={() => setFilter(value)} className={`min-h-12 p-3 rounded-xl ${value === filter ? 'bg-blue-100' : 'bg-gray-100'}`}><Text className="text-gray-900">{value.replace('_', ' ')}</Text></Pressable>)}</View>
            {assignments.filter(row => filter === 'all' || (filter === 'overdue' ? deriveAssignmentStatus(row, now) === filter : row.status === filter)).map(row => <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`Update assignment ${row.id}`} disabled={writing} onPress={() => setSelected(row.id)} className="min-h-12 p-3 border border-gray-300 rounded-xl"><Text className="text-gray-900">{workers.find(w => w.id === row.workerId)?.name || `Worker ${row.workerId}`} · {row.task} · {row.progressPercent}% · {deriveAssignmentStatus(row, now)}</Text></Pressable>)}
        </View>
        {selectedAssignment && <BlockProgressPanel key={selectedAssignment.id} draft={getDraft(`progress:${selectedAssignment.id}`, () => initialProgressDraft(selectedAssignment))} assignment={selectedAssignment} history={history} disabled={disabled || writing} onSubmit={input => write(() => AgriBlockAssignmentService.recordProgress(input, db, operatorId))} />}
        {block.status === 'active' && !block.deletedAt && <BlockAssignmentPanel draft={getDraft('assignment', initialAssignmentDraft)} blockId={blockId} blockName={block.name} workers={workers.filter(w => !w.deletedAt)} cycles={cycles.filter(c => !['completed', 'closed', 'cancelled'].includes(c.status)).map(c => ({ id: c.id, label: c.cycleCode || c.cropType || c.id }))} disabled={disabled || writing} onSubmit={input => write(() => AgriBlockAssignmentService.assignWorkers(input, db, operatorId))} />}
    </View>;
}
