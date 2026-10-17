import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { v4 as uuid } from 'uuid';
import { createTestDatabase } from '../../../__tests__/test-utils';
import { AgriParcelService } from '../../../services/AgriParcelService';
import { AgriBlockService } from '../../../services/AgriBlockService';
import { AgriBlockAssignmentService } from '../../../services/AgriBlockAssignmentService';
import { runAuditedAgriBatch } from '../../../services/AgriWriteSafety';
import { BlockMonitoringPanel } from '../BlockMonitoringPanel';
import { BlockAssignmentPanel } from '../BlockAssignmentPanel';
import { BlockProgressPanel } from '../BlockProgressPanel';

jest.mock('../../../database', () => ({ database: {} }));
jest.mock('../../../services/AuthService', () => ({ AuthService: { getCurrentUserId: jest.fn(async () => 'DUMMY: supervisor') } }));

async function fixture() {
    const db = createTestDatabase();
    const parcel = await AgriParcelService.createParcel({ name: 'DUMMY: field', landOwnerId: 'DUMMY: owner', areaHectares: 1 }, db);
    const geometry = { outer: [{ latitude: 0, longitude: 0 }, { latitude: 0.001, longitude: 0 }, { latitude: 0.001, longitude: 0.001 }, { latitude: 0, longitude: 0.001 }], holes: [] };
    const blockId = uuid();
    await AgriBlockService.saveLayout({ parcelId: parcel.id, expectedRevision: 0, operationId: uuid(), geometry, blocks: [{ id: blockId, name: 'North', geometry }] }, db);
    const worker = await db.write(() => db.get<any>('agri_farm_workers').create(w => { w.name = 'DUMMY: worker'; w.status = 'active'; }));
    return { db, parcel, blockId, worker };
}

afterEach(() => jest.restoreAllMocks());

it('serializes assignment and progress submissions across two forms before rerender', async () => {
    const { db, parcel, blockId, worker } = await fixture();
    const [assignment] = await AgriBlockAssignmentService.assignWorkers({ blockId, workerIds: [worker.id], task: 'DUMMY: weed', startDate: 0, submissionId: uuid() }, db);
    const ui = render(<BlockMonitoringPanel db={db} blockId={blockId} parcelId={parcel.id} operatorId="DUMMY: supervisor" />);
    await waitFor(() => expect(ui.getByLabelText(`Update assignment ${assignment.id}`)).toBeTruthy());
    fireEvent.press(ui.getByLabelText(`Update assignment ${assignment.id}`));
    await waitFor(() => expect(ui.getByText('No supervisor updates yet.')).toBeTruthy());
    const assign = ui.UNSAFE_getByType(BlockAssignmentPanel).props.onSubmit;
    const progress = ui.UNSAFE_getByType(BlockProgressPanel).props.onSubmit;
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const original = AgriBlockAssignmentService.assignWorkers.bind(AgriBlockAssignmentService);
    jest.spyOn(AgriBlockAssignmentService, 'assignWorkers').mockImplementation(async (...args) => { await barrier; return original(...args); });
    let first!: Promise<unknown>, second!: Promise<unknown>;
    act(() => {
        first = assign({ blockId, workerIds: [worker.id], task: 'DUMMY: harvest', startDate: 0, submissionId: uuid() });
        second = progress({ assignmentId: assignment.id, progressPercent: 40, status: 'in_progress', updateDate: 0, submissionId: uuid() });
        // Capture immediately so a deliberately rejected submission isn't unhandled.
        second.catch(() => undefined);
    });
    await act(async () => {
        release();
        await first;
        await expect(second).rejects.toThrow(/wait for the current write/i);
    });
    expect(await db.get('agri_block_progress').query().fetchCount()).toBe(0);
    expect((await AgriBlockAssignmentService.listAssignments(blockId, db))).toHaveLength(2);
});

it('does not render cached task data if the database becomes quarantined during a load', async () => {
    const { db, parcel, blockId } = await fixture();
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const blocks = db.get('agri_parcel_blocks');
    const original = blocks.find.bind(blocks);
    jest.spyOn(blocks, 'find').mockImplementation(async id => { const row = await original(id); await barrier; return row; });
    const ui = render(<BlockMonitoringPanel db={db} blockId={blockId} parcelId={parcel.id} operatorId="DUMMY: supervisor" />);
    // All reads started on the usable database, then one uncertain batch invalidates their cache.
    await act(async () => {
        const batch = jest.spyOn(db, 'batch').mockRejectedValueOnce(new Error('DUMMY: uncertain storage result'));
        await expect(runAuditedAgriBatch(db, () => [])).rejects.toHaveProperty('code', 'AGRI_DATABASE_REOPEN_REQUIRED');
        batch.mockRestore();
        release();
    });
    await waitFor(() => expect(ui.getByText(/Discard this Database.*reopen persisted storage/i)).toBeTruthy());
    expect(ui.queryByLabelText('Assign DUMMY: worker')).toBeNull();
});
