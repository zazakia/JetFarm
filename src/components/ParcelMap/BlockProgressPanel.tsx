import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type AgriBlockAssignment from '../../database/models/AgriBlockAssignment';
import type { BlockAssignmentStatus } from '../../database/models/AgriBlockAssignment';
import type AgriBlockProgress from '../../database/models/AgriBlockProgress';
import type { RecordBlockProgressInput } from '../../services/AgriBlockAssignmentService';
import { formatDate } from '../../utils/dates';
import { localDateText, MonitoringDraft, MonitoringField, strictLocalDate, useMonitoringDraft, useMonitoringSubmission } from './monitoringForm';

export interface ProgressDraftValues { percent: string; status: BlockAssignmentStatus; updateDate: string; notes: string; correctionOfId?: string }
export const initialProgressDraft = (assignment: AgriBlockAssignment): ProgressDraftValues => ({ percent: String(assignment.progressPercent), status: assignment.status, updateDate: localDateText(), notes: '' });
interface Props { assignment: AgriBlockAssignment; history: AgriBlockProgress[]; onSubmit: (input: RecordBlockProgressInput) => Promise<unknown>; disabled?: boolean; draft?: MonitoringDraft<ProgressDraftValues> }
export function BlockProgressPanel({ assignment, history, onSubmit, disabled, draft: controlled }: Props) {
    const draft = useMonitoringDraft(() => initialProgressDraft(assignment), controlled);
    const { percent, status, updateDate, notes, correctionOfId } = draft.current.values;
    const change = (patch: Partial<ProgressDraftValues>) => draft.update({ values: { ...draft.current.values, ...patch } });
    const form = useMonitoringSubmission<Omit<RecordBlockProgressInput, 'submissionId'>, ProgressDraftValues>(onSubmit, draft);
    const locked = disabled || form.saving;
    const save = () => {
        if (locked) return;
        const progressPercent = /^\d+(?:\.\d+)?$/.test(percent.trim()) ? Number(percent) : NaN;
        if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100) { form.setMessage('Enter a full percentage from 0 to 100.'); return; }
        if (status === 'completed' && progressPercent !== 100) { form.setMessage('Completion requires 100% progress.'); return; }
        const date = strictLocalDate(updateDate);
        if (date === null) { form.setMessage('Enter valid dates in YYYY-MM-DD format.'); return; }
        if (notes.length > 2000) { form.setMessage('Notes must be at most 2,000 characters.'); return; }
        void form.submit({ assignmentId: assignment.id, progressPercent, status, updateDate: date, ...(notes.trim() ? { notes: notes.trim() } : {}), ...(correctionOfId ? { correctionOfId } : {}) }, 'Progress saved locally.');
    };
    return <View testID={`block-progress-${assignment.id}`} className="p-4 gap-3 border-t border-gray-200">
        <Text className="text-gray-900 text-lg font-bold">Supervisor progress · {assignment.task}</Text>
        <Text className="text-gray-700">Each update is a percentage snapshot, not added to other tasks. Cancelled work and corrections retain history.</Text>
        <MonitoringField label="Progress percentage" value={percent} onChange={percent => change({ percent })} disabled={locked} numeric />
        <View className="flex-row flex-wrap gap-2">{(['assigned', 'in_progress', 'completed', 'cancelled'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`Status ${value}`} accessibilityState={{ checked: value === status, selected: value === status }} aria-checked={value === status} disabled={locked} onPress={() => change({ status: value })} className={`min-h-12 p-3 rounded-xl border ${value === status ? 'bg-blue-50 border-blue-700' : 'border-gray-300'}`}><Text className="text-gray-900">{value.replace('_', ' ')}</Text></Pressable>)}</View>
        <MonitoringField label="Update date" value={updateDate} onChange={updateDate => change({ updateDate })} disabled={locked} />
        <MonitoringField label="Progress notes" value={notes} onChange={notes => change({ notes })} disabled={locked} multiline />
        {correctionOfId && <View><Text className="text-amber-800">Appending correction of {correctionOfId}</Text><Pressable accessibilityRole="button" disabled={locked} onPress={() => change({ correctionOfId: undefined })} className="min-h-12 p-3"><Text className="text-gray-900">Cancel correction</Text></Pressable></View>}
        {form.message && <Text accessibilityRole="alert" className="text-gray-900">{form.message}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Save progress update" disabled={locked} onPress={save} className="min-h-12 p-3 bg-green-800 rounded-xl"><Text className="text-white text-center font-bold">{form.saving ? 'Saving…' : 'Save progress update'}</Text></Pressable>
        <Text className="text-gray-900 font-bold">Update history</Text>
        {!history.length && <Text className="text-gray-700">No supervisor updates yet.</Text>}
        {history.map(row => <View key={row.id} className="border border-gray-200 rounded-xl p-3"><Text className="text-gray-900">{formatDate(row.updateDate)} · {row.progressPercent}% · {row.status.replace('_', ' ')}{row.correctionOfId ? ' · Correction' : ''}</Text><Text className="text-gray-700">{row.notes || 'No notes'}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Correct update ${row.id}`} disabled={locked} onPress={() => change({ correctionOfId: row.id, percent: String(row.progressPercent), status: row.status, notes: row.notes || '' })} className="min-h-12 justify-center"><Text className="text-blue-700 font-bold">Append correction</Text></Pressable></View>)}
    </View>;
}
