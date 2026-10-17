import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AssignWorkersInput } from '../../services/AgriBlockAssignmentService';
import { localDateText, MonitoringDraft, MonitoringField, strictLocalDate, useMonitoringDraft, useMonitoringSubmission } from './monitoringForm';

export interface AssignmentDraftValues { workerIds: string[]; task: string; startDate: string; dueDate: string; cropCycleId?: string }
export const initialAssignmentDraft = (): AssignmentDraftValues => ({ workerIds: [], task: '', startDate: localDateText(), dueDate: '' });
interface Props {
    blockId: string; blockName: string;
    workers: Array<{ id: string; name: string; status: string }>;
    cycles: Array<{ id: string; label: string }>;
    onSubmit: (input: AssignWorkersInput) => Promise<unknown>;
    disabled?: boolean;
    draft?: MonitoringDraft<AssignmentDraftValues>;
}
export function BlockAssignmentPanel({ blockId, blockName, workers, cycles, onSubmit, disabled, draft: controlled }: Props) {
    const draft = useMonitoringDraft(initialAssignmentDraft, controlled);
    const { workerIds, task, startDate, dueDate, cropCycleId } = draft.current.values;
    const change = (patch: Partial<AssignmentDraftValues>) => draft.update({ values: { ...draft.current.values, ...patch } });
    const form = useMonitoringSubmission<Omit<AssignWorkersInput, 'submissionId'>, AssignmentDraftValues>(onSubmit, draft);
    const locked = disabled || form.saving;
    const save = () => {
        if (locked) return;
        const activeIds = new Set(workers.filter(w => w.status === 'active').map(w => w.id));
        if (!workerIds.length || workerIds.some(id => !activeIds.has(id))) { form.setMessage('Select at least one active worker.'); return; }
        if (!task.trim() || task.trim().length > 500) { form.setMessage('Enter a task of 1–500 characters.'); return; }
        const start = strictLocalDate(startDate), due = dueDate ? strictLocalDate(dueDate) : undefined;
        if (start === null || due === null) { form.setMessage('Enter valid dates in YYYY-MM-DD format.'); return; }
        if (due !== undefined && due < start) { form.setMessage('Due date cannot be before start date.'); return; }
        if (cropCycleId && !cycles.some(c => c.id === cropCycleId)) { form.setMessage('Select a matching crop cycle or no cycle.'); return; }
        void form.submit({ blockId, workerIds, task: task.trim(), startDate: start, ...(due !== undefined ? { dueDate: due } : {}), ...(cropCycleId ? { cropCycleId } : {}) }, 'Assignments saved locally.');
    };
    return <View testID="block-assignment-panel" className="p-4 gap-3 border-t border-gray-200">
        <Text className="text-lg font-bold text-gray-900">Assign workers · {blockName}</Text>
        <Text className="text-gray-700">One independent assignment per worker. This does not create wages or payments.</Text>
        {workers.filter(w => w.status === 'active').map(worker => <Pressable key={worker.id} accessibilityRole="checkbox" accessibilityLabel={`Assign ${worker.name}`} accessibilityState={{ checked: workerIds.includes(worker.id), disabled: !!locked }} aria-checked={workerIds.includes(worker.id)} disabled={locked} onPress={() => { const ids = draft.current.values.workerIds; change({ workerIds: ids.includes(worker.id) ? ids.filter(id => id !== worker.id) : [...ids, worker.id] }); }} className={`min-h-12 p-3 border rounded-xl ${workerIds.includes(worker.id) ? 'border-green-700 bg-green-50' : 'border-gray-300'}`}><Text className="text-gray-900">{workerIds.includes(worker.id) ? 'Selected · ' : ''}{worker.name}</Text></Pressable>)}
        {!workers.some(w => w.status === 'active') && <Text className="text-gray-700">No active workers. Register or reactivate workers in Farm Workers.</Text>}
        <MonitoringField label="Assignment task" value={task} onChange={task => change({ task })} disabled={locked} />
        <MonitoringField label="Start date" value={startDate} onChange={startDate => change({ startDate })} disabled={locked} />
        <MonitoringField label="Due date" value={dueDate} onChange={dueDate => change({ dueDate })} disabled={locked} />
        <Text className="text-gray-700">Optional matching crop cycle</Text>
        {[{ id: '', label: 'No crop cycle' }, ...cycles].map(c => <Pressable key={c.id} accessibilityRole="radio" accessibilityState={{ checked: (cropCycleId || '') === c.id, selected: (cropCycleId || '') === c.id }} aria-checked={(cropCycleId || '') === c.id} disabled={locked} onPress={() => change({ cropCycleId: c.id || undefined })} className="min-h-12 p-3 border border-gray-300 rounded-xl"><Text className="text-gray-900">{(cropCycleId || '') === c.id ? 'Selected · ' : ''}{c.label}</Text></Pressable>)}
        {form.message && <Text accessibilityRole="alert" className="text-gray-900">{form.message}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Save worker assignments" disabled={locked} onPress={save} className="min-h-12 p-3 bg-green-800 rounded-xl"><Text className="text-white text-center font-bold">{form.saving ? 'Saving…' : 'Save worker assignments'}</Text></Pressable>
    </View>;
}
