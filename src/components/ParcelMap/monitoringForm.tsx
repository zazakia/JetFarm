import React, { useEffect, useReducer, useRef } from 'react';
import { Text, TextInput, View } from 'react-native';
import { v4 as uuid } from 'uuid';
import { parseDateLocal } from '../../utils/dates';

export function strictLocalDate(text: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const time = parseDateLocal(text);
    if (time === null) return null;
    const d = new Date(time);
    return d.getFullYear() === Number(text.slice(0, 4)) && d.getMonth() + 1 === Number(text.slice(5, 7)) && d.getDate() === Number(text.slice(8, 10)) ? time : null;
}
export function localDateText(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function MonitoringField({ label, value, onChange, disabled, multiline, numeric }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; multiline?: boolean; numeric?: boolean }) {
    return <View className="gap-1"><Text className="text-gray-900 font-semibold">{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled} multiline={multiline} keyboardType={numeric ? 'decimal-pad' : 'default'} placeholder={label.toLowerCase().includes('date') ? 'YYYY-MM-DD' : label} placeholderTextColor="#9CA3AF" className="min-h-12 border border-gray-300 rounded-xl p-3 text-gray-900" /></View>;
}
interface DraftState<T> {
    values: T;
    request: { json: string; id: string } | null;
    saving: boolean;
    message: string;
}
/** The session owns this controller, including retry identity, independently of form mounts. */
export interface MonitoringDraft<T> {
    readonly current: DraftState<T>;
    update: (patch: Partial<DraftState<T>>) => void;
}
export function useMonitoringDrafts() {
    const drafts = useRef(new Map<string, MonitoringDraft<unknown>>());
    const mounted = useRef(true);
    const [, render] = useReducer(value => value + 1, 0);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    return <T,>(key: string, initial: () => T): MonitoringDraft<T> => {
        if (!drafts.current.has(key)) {
            let current: DraftState<T> = { values: initial(), request: null, saving: false, message: '' };
            drafts.current.set(key, {
                get current() { return current; },
                update(patch: Partial<DraftState<T>>) {
                    current = { ...current, ...patch };
                    if (mounted.current) render();
                },
            } as MonitoringDraft<unknown>);
        }
        return drafts.current.get(key) as MonitoringDraft<T>;
    };
}
/** Standalone forms retain their local controller; embedded forms use the session's controller. */
export function useMonitoringDraft<T>(initial: () => T, controlled?: MonitoringDraft<T>) {
    const draft = useMonitoringDrafts()('form', initial);
    return controlled ?? draft;
}
/** Retries use the same UUID only while the immutable request is unchanged. */
export function useMonitoringSubmission<T extends object, V>(onSubmit: (input: T & { submissionId: string }) => Promise<unknown>, draft: MonitoringDraft<V>) {
    const submit = async (input: T, success: string) => {
        if (draft.current.saving) return;
        const json = JSON.stringify(input);
        const request = draft.current.request?.json === json ? draft.current.request : { json, id: uuid() };
        draft.update({ request, saving: true, message: '' });
        try { await onSubmit({ ...JSON.parse(request.json), submissionId: request.id }); draft.update({ message: success }); }
        catch (e) { draft.update({ message: e instanceof Error ? e.message : 'Local write failed. Your inputs are retained for retry.' }); }
        finally { draft.update({ saving: false }); }
    };
    return { submit, saving: draft.current.saving, message: draft.current.message, setMessage: (message: string) => draft.update({ message }) };
}
