import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { v4 as uuid } from 'uuid';
import { createTestDatabase } from '../../../__tests__/test-utils';
import { AgriParcelService } from '../../../services/AgriParcelService';
import { AgriBlockService } from '../../../services/AgriBlockService';
import { AgriBlockAssignmentService } from '../../../services/AgriBlockAssignmentService';
import { runAuditedAgriBatch } from '../../../services/AgriWriteSafety';
import { BlockMonitoringPanel } from '../BlockMonitoringPanel';
import { BlockProgressPanel } from '../BlockProgressPanel';

jest.mock('../../../database', () => ({ database: {} }));
jest.mock('../../../services/AuthService', () => ({ AuthService: { getCurrentUserId: jest.fn(async () => 'DUMMY: supervisor') } }));

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(r => { resolve = r; });
    return { promise, resolve };
}
async function fixture() {
    const db = createTestDatabase();
    const parcel = await AgriParcelService.createParcel({ name: 'DUMMY: field', landOwnerId: 'DUMMY: owner', areaHectares: 1 }, db);
    const geometry = { outer: [{ latitude: 0, longitude: 0 }, { latitude: 0.001, longitude: 0 }, { latitude: 0.001, longitude: 0.001 }, { latitude: 0, longitude: 0.001 }], holes: [] };
    const blockId = uuid();
    await AgriBlockService.saveLayout({ parcelId: parcel.id, expectedRevision: 0, operationId: uuid(), geometry, blocks: [{ id: blockId, name: 'DUMMY: North', geometry }] }, db);
    const worker = await db.write(() => db.get<any>('agri_farm_workers').create(w => { w.name = 'DUMMY: worker'; w.status = 'active'; }));
    const assignments = await AgriBlockAssignmentService.assignWorkers({ blockId, workerIds: [worker.id], task: 'DUMMY: weed A', startDate: 0, submissionId: uuid() }, db);
    const [second] = await AgriBlockAssignmentService.assignWorkers({ blockId, workerIds: [worker.id], task: 'DUMMY: weed B', startDate: 0, submissionId: uuid() }, db);
    return { db, parcelId: parcel.id, blockId, operatorId: 'DUMMY: supervisor', worker, first: assignments[0], second };
}
async function select(ui: ReturnType<typeof render>, f: Awaited<ReturnType<typeof fixture>>, assignmentId: string) {
    await act(async () => {
        fireEvent.press(ui.getByLabelText(`Update assignment ${assignmentId}`));
        // Drain a real history read in the same act as the selection-triggered read.
        await AgriBlockAssignmentService.listProgress(assignmentId, f.db);
    });
}
async function open(f: Awaited<ReturnType<typeof fixture>>, onBusy?: (busy: boolean) => void) {
    const ui = render(<BlockMonitoringPanel {...f} onBusy={onBusy} />);
    await waitFor(() => expect(ui.getByLabelText(`Update assignment ${f.first.id}`)).toBeTruthy());
    await select(ui, f, f.first.id);
    await waitFor(() => expect(ui.getByText('No supervisor updates yet.')).toBeTruthy());
    return ui;
}
function editAssignment(ui: Awaited<ReturnType<typeof open>>) {
    fireEvent.press(ui.getByLabelText('Assign DUMMY: worker'));
    fireEvent.changeText(ui.getByLabelText('Assignment task'), 'DUMMY: unrelated draft');
    fireEvent.changeText(ui.getByLabelText('Start date'), '2026-10-01');
    fireEvent.changeText(ui.getByLabelText('Due date'), '2026-10-31');
}
afterEach(() => jest.restoreAllMocks());

it('retains percent, status, date, notes and correction through A -> B -> A', async () => {
    const f = await fixture();
    const history = await AgriBlockAssignmentService.recordProgress({ assignmentId: f.first.id, progressPercent: 20, status: 'in_progress', updateDate: 0, notes: 'DUMMY: old note', submissionId: uuid() }, f.db);
    const ui = render(<BlockMonitoringPanel {...f} />);
    await waitFor(() => expect(ui.getByLabelText(`Update assignment ${f.first.id}`)).toBeTruthy());
    await select(ui, f, f.first.id);
    await waitFor(() => expect(ui.getByLabelText(`Correct update ${history.id}`)).toBeTruthy());
    fireEvent.press(ui.getByLabelText(`Correct update ${history.id}`));
    fireEvent.changeText(ui.getByLabelText('Progress percentage'), '47.5');
    fireEvent.press(ui.getByLabelText('Status cancelled'));
    fireEvent.changeText(ui.getByLabelText('Update date'), '2026-10-12');
    fireEvent.changeText(ui.getByLabelText('Progress notes'), 'DUMMY: unsaved correction');
    await select(ui, f, f.second.id);
    fireEvent.changeText(ui.getByLabelText('Progress percentage'), '13');
    await select(ui, f, f.first.id);
    expect(ui.getByLabelText('Progress percentage').props.value).toBe('47.5');
    expect(ui.getByLabelText('Status cancelled').props.accessibilityState.selected).toBe(true);
    expect(ui.getByLabelText('Update date').props.value).toBe('2026-10-12');
    expect(ui.getByLabelText('Progress notes').props.value).toBe('DUMMY: unsaved correction');
    expect(ui.getByText(`Appending correction of ${history.id}`)).toBeTruthy();
    await select(ui, f, f.second.id);
    expect(ui.getByLabelText('Progress percentage').props.value).toBe('13');
});

it('retains unrelated assignment draft after progress saves and refresh fails, then refreshes without another progress write', async () => {
    const f = await fixture();
    const ui = await open(f);
    editAssignment(ui);
    const assign = jest.spyOn(AgriBlockAssignmentService, 'assignWorkers').mockRejectedValueOnce(new Error('DUMMY: assignment pre-write failed'));
    fireEvent.press(ui.getByLabelText('Save worker assignments'));
    await waitFor(() => expect(ui.getByText('DUMMY: assignment pre-write failed')).toBeTruthy());
    const assignmentInput = assign.mock.calls[0][0];
    fireEvent.changeText(ui.getByLabelText('Progress percentage'), '40');
    fireEvent.press(ui.getByLabelText('Status in_progress'));
    const blocks = f.db.get('agri_parcel_blocks');
    const find = blocks.find.bind(blocks);
    // The service reference read succeeds; only the post-save screen refresh fails.
    jest.spyOn(blocks, 'find').mockImplementationOnce(find).mockRejectedValueOnce(new Error('DUMMY: refresh failed'));
    fireEvent.press(ui.getByLabelText('Save progress update'));
    await waitFor(() => expect(ui.getByText(/Saved locally; refresh failed/)).toBeTruthy());
    expect(ui.queryByLabelText('Assignment task')).toBeNull();
    expect(await f.db.get('agri_block_progress').query().fetchCount()).toBe(1);
    fireEvent.press(ui.getByLabelText('Refresh block tasks'));
    await waitFor(() => expect(ui.getByLabelText('Assignment task')).toBeTruthy());
    expect(ui.getByLabelText('Assignment task').props.value).toBe('DUMMY: unrelated draft');
    expect(ui.getByLabelText('Assign DUMMY: worker').props.accessibilityState.checked).toBe(true);
    expect(ui.getByLabelText('Start date').props.value).toBe('2026-10-01');
    expect(ui.getByLabelText('Due date').props.value).toBe('2026-10-31');
    expect(ui.getByLabelText('Progress percentage').props.value).toBe('40');
    // Even an unchanged explicit save after recovery must remain idempotent.
    fireEvent.press(ui.getByLabelText('Save progress update'));
    await waitFor(() => expect(ui.getByText('Progress saved locally.')).toBeTruthy());
    expect(await f.db.get('agri_block_progress').query().fetchCount()).toBe(1);
    fireEvent.press(ui.getByLabelText('Save worker assignments'));
    await waitFor(() => expect(ui.getByText('Assignments saved locally.')).toBeTruthy());
    const assignments = await AgriBlockAssignmentService.listAssignments(f.blockId, f.db);
    expect(assignments).toHaveLength(3);
    expect(assignments.find(a => a.task === 'DUMMY: unrelated draft')?.submissionId).toBe(assignmentInput.submissionId);
    expect(assign.mock.calls[1][0]).toEqual(assignmentInput);
    expect(await f.db.get('agri_labor_logs').query().fetchCount()).toBe(0);
    expect(await f.db.get('journal_entries').query().fetchCount()).toBe(0);
});

it('offers a usable Refresh block tasks button after initial load failure', async () => {
    const f = await fixture();
    jest.spyOn(f.db.get('agri_parcel_blocks'), 'find').mockRejectedValueOnce(new Error('DUMMY: initial load failed'));
    const ui = render(<BlockMonitoringPanel {...f} />);
    await waitFor(() => expect(ui.getByText('DUMMY: initial load failed')).toBeTruthy());
    fireEvent.press(ui.getByLabelText('Refresh block tasks'));
    await waitFor(() => expect(ui.getByLabelText('Assignment task')).toBeTruthy());
});

it.each(['resolve', 'reject'] as const)('pairs deferred write busy true/false after unmount on %s', async outcome => {
    const f = await fixture(), busy = jest.fn(), barrier = deferred();
    const ui = await open(f, busy);
    const submit = ui.UNSAFE_getByType(BlockProgressPanel).props.onSubmit;
    const original = AgriBlockAssignmentService.recordProgress.bind(AgriBlockAssignmentService);
    jest.spyOn(AgriBlockAssignmentService, 'recordProgress').mockImplementation(async (...args) => {
        await barrier.promise;
        if (outcome === 'reject') throw new Error('DUMMY: deferred write rejected');
        return original(...args);
    });
    let pending!: Promise<unknown>;
    act(() => { pending = submit({ assignmentId: f.first.id, progressPercent: 40, status: 'in_progress', updateDate: 0, submissionId: uuid() }); pending.catch(() => undefined); });
    expect(busy.mock.calls).toEqual([[true]]);
    ui.unmount();
    await act(async () => { barrier.resolve(); await pending.catch(() => undefined); });
    expect(busy.mock.calls).toEqual([[true], [false]]);
});

it.each(['operator', 'parcel', 'block', 'database'] as const)('discards drafts rather than reusing them after a %s scope switch and return', async scope => {
    const f = await fixture(), other = await fixture();
    const ui = await open(f);
    editAssignment(ui);
    fireEvent.changeText(ui.getByLabelText('Progress percentage'), '61');
    fireEvent.changeText(ui.getByLabelText('Progress notes'), 'DUMMY: previous session');
    const next = scope === 'operator' ? { ...f, operatorId: 'DUMMY: other supervisor' }
        : scope === 'parcel' ? { ...f, parcelId: other.parcelId }
        : scope === 'block' ? { ...f, blockId: other.blockId }
        : { ...f, db: other.db };
    ui.rerender(<BlockMonitoringPanel {...next} />);
    await waitFor(() => expect(ui.queryByLabelText('Loading block tasks')).toBeNull());
    if (scope === 'operator') expect(ui.getByLabelText('Assignment task').props.value).toBe('');
    else expect(ui.queryByLabelText('Assignment task')).toBeNull();
    ui.rerender(<BlockMonitoringPanel {...f} />);
    await waitFor(() => expect(ui.getByLabelText(`Update assignment ${f.first.id}`)).toBeTruthy());
    expect(ui.getByLabelText('Assignment task').props.value).toBe('');
    await select(ui, f, f.first.id);
    expect(ui.getByLabelText('Progress percentage').props.value).toBe('0');
    expect(ui.getByLabelText('Progress notes').props.value).toBe('');
});

it('retains failed submission UUID through selection changes but uses a new identity for edited input', async () => {
    const f = await fixture(), ui = await open(f);
    const original = AgriBlockAssignmentService.recordProgress.bind(AgriBlockAssignmentService);
    const record = jest.spyOn(AgriBlockAssignmentService, 'recordProgress').mockRejectedValueOnce(new Error('DUMMY: pre-write failed'));
    fireEvent.changeText(ui.getByLabelText('Progress percentage'), '39');
    fireEvent.press(ui.getByLabelText('Save progress update'));
    await waitFor(() => expect(ui.getByText('DUMMY: pre-write failed')).toBeTruthy());
    const input = record.mock.calls[0][0];
    await select(ui, f, f.second.id);
    await select(ui, f, f.first.id);
    expect(ui.getByLabelText('Progress percentage').props.value).toBe('39');
    record.mockImplementation(original);
    fireEvent.press(ui.getByLabelText('Save progress update'));
    await waitFor(() => expect(ui.getByText('Progress saved locally.')).toBeTruthy());
    expect((await AgriBlockAssignmentService.listProgress(f.first.id, f.db))[0].submissionId).toBe(input.submissionId);
    fireEvent.changeText(ui.getByLabelText('Progress percentage'), '42');
    fireEvent.press(ui.getByLabelText('Save progress update'));
    await waitFor(() => expect(record).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(ui.getByLabelText('Save progress update')).toBeEnabled());
    const rows = await AgriBlockAssignmentService.listProgress(f.first.id, f.db);
    expect(rows).toHaveLength(2);
    expect(rows[1].submissionId).not.toBe(input.submissionId);
});

it('removes cached tasks and disables refresh when an audited write quarantines storage', async () => {
    const f = await fixture(), ui = await open(f);
    editAssignment(ui);
    const staleSubmit = ui.UNSAFE_getByType(BlockProgressPanel).props.onSubmit;
    const batch = jest.spyOn(f.db, 'batch').mockRejectedValueOnce(new Error('DUMMY: uncertain storage'));
    await act(async () => { await expect(runAuditedAgriBatch(f.db, () => [])).rejects.toHaveProperty('code', 'AGRI_DATABASE_REOPEN_REQUIRED'); });
    batch.mockRestore();
    fireEvent.press(ui.getByLabelText('Refresh block tasks'));
    await waitFor(() => expect(ui.getByText(/Discard this Database.*reopen persisted storage/i)).toBeTruthy());
    expect(ui.queryByLabelText('Assignment task')).toBeNull();
    expect(ui.queryByLabelText(`Update assignment ${f.first.id}`)).toBeNull();
    expect(ui.getByLabelText('Refresh block tasks')).toBeDisabled();
    await expect(staleSubmit({ assignmentId: f.first.id, progressPercent: 30, status: 'assigned', updateDate: 0, submissionId: uuid() })).rejects.toHaveProperty('code', 'AGRI_DATABASE_REOPEN_REQUIRED');
});

it('settles the captured busy callback without releasing a replacement session write lock', async () => {
    const f = await fixture(), oldBusy = jest.fn(), newBusy = jest.fn(), firstBarrier = deferred(), secondBarrier = deferred();
    const ui = await open(f, oldBusy);
    const original = AgriBlockAssignmentService.recordProgress.bind(AgriBlockAssignmentService);
    jest.spyOn(AgriBlockAssignmentService, 'recordProgress')
        .mockImplementationOnce(async (...args) => { await firstBarrier.promise; return original(...args); })
        .mockImplementationOnce(async (...args) => { await secondBarrier.promise; return original(...args); });
    const input = { assignmentId: f.first.id, progressPercent: 30, status: 'assigned', updateDate: 0, submissionId: uuid() };
    let oldWrite!: Promise<unknown>, newWrite!: Promise<unknown>;
    act(() => { oldWrite = ui.UNSAFE_getByType(BlockProgressPanel).props.onSubmit(input); });
    ui.rerender(<BlockMonitoringPanel {...f} operatorId="DUMMY: replacement" onBusy={newBusy} />);
    await waitFor(() => expect(ui.getByLabelText(`Update assignment ${f.first.id}`)).toBeTruthy());
    await select(ui, f, f.first.id);
    const submit = ui.UNSAFE_getByType(BlockProgressPanel).props.onSubmit;
    act(() => { newWrite = submit({ ...input, submissionId: uuid() }); newWrite.catch(() => undefined); });
    await act(async () => { firstBarrier.resolve(); await oldWrite; });
    expect(oldBusy.mock.calls).toEqual([[true], [false]]);
    expect(newBusy.mock.calls).toEqual([[true]]);
    await expect(submit({ ...input, submissionId: uuid() })).rejects.toThrow(/wait for the current write/i);
    await act(async () => { secondBarrier.resolve(); await newWrite; });
    expect(newBusy.mock.calls).toEqual([[true], [false]]);
});

it.each((['resolve', 'reject'] as const).flatMap(outcome => (['old', 'new'] as const).map(first => ({ outcome, first }))))('keeps a shared busy owner locked with old $outcome and $first settling first', async ({ outcome, first }) => {
    const f = await fixture(), busy = jest.fn(), oldBarrier = deferred(), newBarrier = deferred();
    const ui = await open(f, busy);
    const original = AgriBlockAssignmentService.recordProgress.bind(AgriBlockAssignmentService);
    jest.spyOn(AgriBlockAssignmentService, 'recordProgress')
        .mockImplementationOnce(async (...args) => {
            await oldBarrier.promise;
            if (outcome === 'reject') throw new Error('DUMMY: old session failed');
            return original(...args);
        })
        .mockImplementationOnce(async (...args) => { await newBarrier.promise; return original(...args); });
    const input = { assignmentId: f.first.id, progressPercent: 30, status: 'assigned', updateDate: 0, submissionId: uuid() };
    let oldWrite!: Promise<unknown>, newWrite!: Promise<unknown>;
    act(() => { oldWrite = ui.UNSAFE_getByType(BlockProgressPanel).props.onSubmit(input); oldWrite.catch(() => undefined); });
    ui.rerender(<BlockMonitoringPanel {...f} operatorId="DUMMY: replacement" onBusy={busy} />);
    await waitFor(() => expect(ui.getByLabelText(`Update assignment ${f.first.id}`)).toBeTruthy());
    await select(ui, f, f.first.id);
    const submit = ui.UNSAFE_getByType(BlockProgressPanel).props.onSubmit;
    act(() => { newWrite = submit({ ...input, submissionId: uuid() }); });
    if (first === 'old') {
        await act(async () => { oldBarrier.resolve(); await oldWrite.catch(() => undefined); });
        expect(busy.mock.calls).toEqual([[true]]);
        await expect(submit({ ...input, submissionId: uuid() })).rejects.toThrow(/wait for the current write/i);
        await act(async () => { newBarrier.resolve(); await newWrite; });
    } else {
        await act(async () => { newBarrier.resolve(); await newWrite; });
        expect(busy.mock.calls).toEqual([[true]]);
        await act(async () => { oldBarrier.resolve(); await oldWrite.catch(() => undefined); });
    }
    expect(busy.mock.calls).toEqual([[true], [false]]);
});
