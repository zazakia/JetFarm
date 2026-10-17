import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { useRouter } from 'expo-router';
import { database } from '../../database';
import AgriParcelBlock from '../../database/models/AgriParcelBlock';
import AgriBlockAssignment from '../../database/models/AgriBlockAssignment';
import AgriFarmWorker from '../../database/models/AgriFarmWorker';
import { deriveAssignmentStatus } from '../../services/AgriBlockAssignmentService';
import { assertAgriDatabaseUsable } from '../../services/AgriWriteSafety';

interface Task { assignment: AgriBlockAssignment; block: AgriParcelBlock; workerName: string }
/** One directory query per table, separate from wage logs and worker pay metrics. */
export function BlockTaskDirectory() {
    const router = useRouter();
    const [open, setOpen] = useState(false), [loading, setLoading] = useState(false);
    const [tasks, setTasks] = useState<Task[]>([]), [error, setError] = useState('');
    const [overdueOnly, setOverdueOnly] = useState(false), [refresh, setRefresh] = useState(0);
    useEffect(() => {
        if (!open) return;
        let active = true;
        setLoading(true); setError('');
        const load = async () => {
            assertAgriDatabaseUsable(database);
            const [blocks, assignments, workers] = await Promise.all([
                database.get<AgriParcelBlock>('agri_parcel_blocks').query().fetch(),
                database.get<AgriBlockAssignment>('agri_block_assignments').query(Q.where('deleted_at', null)).fetch(),
                database.get<AgriFarmWorker>('agri_farm_workers').query().fetch(),
            ]);
            assertAgriDatabaseUsable(database);
            const byBlock = new Map(blocks.map(b => [b.id, b]));
            const byWorker = new Map(workers.map(w => [w.id, w.name]));
            if (active) setTasks(assignments.filter(a => byBlock.has(a.blockId)).map(assignment => ({ assignment,
                block: byBlock.get(assignment.blockId)!, workerName: byWorker.get(assignment.workerId) || 'Historical worker' })));
        };
        void load().catch(e => { if (active) { setTasks([]); setError(e instanceof Error ? e.message : 'Tasks could not be loaded.'); } })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [open, refresh]);
    return <View className="bg-white border border-gray-200 rounded-xl p-4 mb-6 gap-3">
        <Pressable accessibilityRole="button" accessibilityLabel="Show block task monitoring" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} className="min-h-12 justify-center">
            <Text className="text-green-800 font-bold">Block task monitoring · {open ? 'Hide' : 'Show'}</Text>
        </Pressable>
        <Text className="text-gray-600">Supervisor progress is recorded per worker and task. It does not create wage logs or payments.</Text>
        {open && <>
            <View className="flex-row flex-wrap gap-2">
                <Pressable accessibilityRole="button" accessibilityLabel="Refresh block task directory" onPress={() => setRefresh(n => n + 1)} className="min-h-12 p-3 border border-gray-300 rounded-xl"><Text className="text-gray-900">Refresh</Text></Pressable>
                <Pressable accessibilityRole="checkbox" accessibilityLabel="Show overdue block tasks" accessibilityState={{ checked: overdueOnly }} onPress={() => setOverdueOnly(v => !v)} className="min-h-12 p-3 border border-gray-300 rounded-xl"><Text className="text-gray-900">{overdueOnly ? 'Overdue only' : 'All tasks'}</Text></Pressable>
            </View>
            {loading ? <ActivityIndicator accessibilityLabel="Loading worker block tasks" /> : error ? <Text accessibilityRole="alert" className="text-red-700">{error}</Text> : <>
                {!tasks.length && <Text className="text-gray-700">No block tasks yet. Save named blocks in GPS mapping and assign existing workers.</Text>}
                {tasks.filter(t => !overdueOnly || deriveAssignmentStatus(t.assignment) === 'overdue').map(({ assignment: a, block, workerName }) => <View key={a.id} className="border border-gray-200 rounded-xl p-3">
                    <Text className="text-gray-900">{workerName} · {block.name} · {a.task} · {a.progressPercent}% · {deriveAssignmentStatus(a)}</Text>
                    {block.status === 'active' && !block.deletedAt ? <Pressable accessibilityRole="button" accessibilityLabel={`Open block task ${a.id}`} onPress={() => router.push({ pathname: '/(admin)/agribusiness/mapping', params: { parcelId: block.parcelId, blockId: block.id } })} className="min-h-12 justify-center"><Text className="text-green-800 font-bold">Open block & progress history</Text></Pressable> : <Text className="text-gray-600">Archived block · history retained</Text>}
                </View>)}
            </>}
        </>}
    </View>;
}
