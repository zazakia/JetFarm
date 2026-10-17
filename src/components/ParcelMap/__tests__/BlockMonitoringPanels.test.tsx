import React from 'react';
import { Pressable } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { BlockAssignmentPanel } from '../BlockAssignmentPanel';
import { BlockProgressPanel } from '../BlockProgressPanel';

// React's test renderer exposes the function inside memo(Pressable).
const pressableType = (Pressable as unknown as React.MemoExoticComponent<React.ComponentType<any>>).type;
const workers = [{ id: 'w1', name: 'Worker One', status: 'active' }, { id: 'w2', name: 'Worker Two', status: 'active' }, { id: 'w3', name: 'Inactive Worker', status: 'inactive' }];
const assignment: any = { id: 'a1', workerId: 'w1', task: 'Weeding', progressPercent: 20, status: 'in_progress', startDate: new Date(2026, 9, 1), dueDate: new Date(2026, 9, 3) };

describe('supervisor block forms', () => {
    it('mirrors worker checkbox changes in explicit aria-checked and rendered native state', () => {
        const ui = render(<BlockAssignmentPanel blockId="b1" blockName="North" workers={workers} cycles={[]} onSubmit={jest.fn()} />);
        const expectWorkers = (checked: boolean[]) => {
            // Inspect real Pressable inputs: native Pressable consumes aria-checked before rendering its host View.
            const checkboxes = ui.UNSAFE_getAllByType(pressableType).filter(node => node.props.accessibilityRole === 'checkbox');
            expect(checkboxes).toHaveLength(2);
            checkboxes.forEach((node, index) => {
                expect(node.props['aria-checked']).toBe(checked[index]);
                expect(node.props.accessibilityState.checked).toBe(checked[index]);
                expect(ui.getByRole('checkbox', { name: `Assign ${workers[index].name}`, checked: checked[index] })).toBeTruthy();
            });
        };
        expectWorkers([false, false]);
        fireEvent.press(ui.getByLabelText('Assign Worker One'));
        expectWorkers([true, false]);
        fireEvent.press(ui.getByLabelText('Assign Worker Two'));
        expectWorkers([true, true]);
        fireEvent.press(ui.getByLabelText('Assign Worker One'));
        expectWorkers([false, true]);
    });

    it('moves crop-cycle checked state between actual radios and back to no cycle', () => {
        const cycles = [{ id: 'DUMMY: cycle-1', label: 'DUMMY: Crop cycle one' }, { id: 'DUMMY: cycle-2', label: 'DUMMY: Crop cycle two' }];
        const ui = render(<BlockAssignmentPanel blockId="b1" blockName="North" workers={workers} cycles={cycles} onSubmit={jest.fn()} />);
        const expectCycle = (selected: number) => {
            const radios = ui.UNSAFE_getAllByType(pressableType).filter(node => node.props.accessibilityRole === 'radio');
            expect(radios).toHaveLength(3);
            radios.forEach((node, index) => {
                expect(node.props['aria-checked']).toBe(index === selected);
                expect(node.props.accessibilityState.checked).toBe(index === selected);
            });
            expect(ui.getAllByRole('radio', { checked: true })).toHaveLength(1);
            expect(ui.getAllByRole('radio', { checked: false })).toHaveLength(2);
        };
        expectCycle(0);
        fireEvent.press(ui.getByText(cycles[0].label));
        expectCycle(1);
        fireEvent.press(ui.getByText(cycles[1].label));
        expectCycle(2);
        fireEvent.press(ui.getByText('No crop cycle'));
        expectCycle(0);
    });

    it('moves progress-status checked state between actual radios', () => {
        const ui = render(<BlockProgressPanel assignment={assignment} history={[]} onSubmit={jest.fn()} />);
        const statuses = ['assigned', 'in_progress', 'completed', 'cancelled'];
        const expectStatus = (selected: string) => {
            const radios = ui.UNSAFE_getAllByType(pressableType).filter(node => node.props.accessibilityRole === 'radio');
            expect(radios).toHaveLength(statuses.length);
            radios.forEach((node, index) => {
                expect(node.props['aria-checked']).toBe(statuses[index] === selected);
                expect(node.props.accessibilityState.checked).toBe(statuses[index] === selected);
                expect(ui.getByRole('radio', { name: `Status ${statuses[index]}`, checked: statuses[index] === selected })).toBeTruthy();
            });
        };
        expectStatus('in_progress');
        for (const status of ['completed', 'cancelled', 'assigned', 'in_progress']) {
            fireEvent.press(ui.getByLabelText(`Status ${status}`));
            expectStatus(status);
        }
    });

    it('submits both selected active workers, task and real local dates without payroll fields', async () => {
        const submit = jest.fn(async () => {});
        const ui = render(<BlockAssignmentPanel blockId="b1" blockName="North" workers={workers} cycles={[]} onSubmit={submit} />);
        expect(ui.queryByText('Inactive Worker')).toBeNull();
        fireEvent.press(ui.getByLabelText('Assign Worker One'));
        fireEvent.press(ui.getByLabelText('Assign Worker Two'));
        fireEvent.changeText(ui.getByLabelText('Assignment task'), ' Weeding ');
        fireEvent.changeText(ui.getByLabelText('Start date'), '2026-10-01');
        fireEvent.changeText(ui.getByLabelText('Due date'), '2026-10-03');
        fireEvent.press(ui.getByLabelText('Save worker assignments'));
        await waitFor(() => expect(ui.getByText('Assignments saved locally.')).toBeTruthy());
        expect(submit).toHaveBeenCalledWith({ blockId: 'b1', workerIds: ['w1', 'w2'], task: 'Weeding', startDate: new Date(2026, 9, 1).getTime(), dueDate: new Date(2026, 9, 3).getTime(), submissionId: expect.any(String) });
    });

    it.each(['2026-02-30', '2026-10-1', '2026-10-01junk'])('rejects invalid or partially parsed start date %s', async date => {
        const submit = jest.fn(async () => {});
        const ui = render(<BlockAssignmentPanel blockId="b1" blockName="North" workers={workers} cycles={[]} onSubmit={submit} />);
        fireEvent.press(ui.getByLabelText('Assign Worker One'));
        fireEvent.changeText(ui.getByLabelText('Assignment task'), 'Weeding');
        fireEvent.changeText(ui.getByLabelText('Start date'), date);
        fireEvent.press(ui.getByLabelText('Save worker assignments'));
        expect(ui.getByText(/valid dates in YYYY-MM-DD/)).toBeTruthy();
        expect(submit).not.toHaveBeenCalled();
    });

    it('retains entered values and submission identity after a failed retry', async () => {
        const submit = jest.fn().mockRejectedValueOnce(new Error('Offline write failed')).mockResolvedValueOnce(undefined);
        const ui = render(<BlockAssignmentPanel blockId="b1" blockName="North" workers={workers} cycles={[]} onSubmit={submit} />);
        fireEvent.press(ui.getByLabelText('Assign Worker One'));
        fireEvent.changeText(ui.getByLabelText('Assignment task'), 'Weeding');
        fireEvent.press(ui.getByLabelText('Save worker assignments'));
        await waitFor(() => expect(ui.getByText('Offline write failed')).toBeTruthy());
        const id = submit.mock.calls[0][0].submissionId;
        fireEvent.press(ui.getByLabelText('Save worker assignments'));
        await waitFor(() => expect(ui.getByText('Assignments saved locally.')).toBeTruthy());
        expect(submit.mock.calls[1][0].submissionId).toBe(id);
    });

    it('rejects partial percentages and completion below 100', () => {
        const submit = jest.fn(async () => {});
        const ui = render(<BlockProgressPanel assignment={assignment} history={[]} onSubmit={submit} />);
        fireEvent.changeText(ui.getByLabelText('Progress percentage'), '30junk');
        fireEvent.press(ui.getByLabelText('Save progress update'));
        expect(ui.getByText(/percentage from 0 to 100/)).toBeTruthy();
        fireEvent.changeText(ui.getByLabelText('Progress percentage'), '30');
        fireEvent.press(ui.getByLabelText('Status completed'));
        fireEvent.press(ui.getByLabelText('Save progress update'));
        expect(ui.getByText(/Completion requires 100/)).toBeTruthy();
        expect(submit).not.toHaveBeenCalled();
    });

    it('appends a correction of the selected history snapshot rather than modifying the previous record', async () => {
        const submit = jest.fn(async () => {});
        const history: any[] = [{ id: 'h1', updateDate: new Date(2026, 9, 2), progressPercent: 20, status: 'in_progress', notes: 'Earlier note', correctionOfId: null }];
        const ui = render(<BlockProgressPanel assignment={assignment} history={history} onSubmit={submit} />);
        fireEvent.press(ui.getByLabelText('Correct update h1'));
        fireEvent.changeText(ui.getByLabelText('Progress percentage'), '35');
        fireEvent.changeText(ui.getByLabelText('Update date'), '2026-10-04');
        fireEvent.changeText(ui.getByLabelText('Progress notes'), 'Supervisor correction');
        fireEvent.press(ui.getByLabelText('Save progress update'));
        await waitFor(() => expect(ui.getByText('Progress saved locally.')).toBeTruthy());
        expect(submit).toHaveBeenCalledWith(expect.objectContaining({ assignmentId: 'a1', progressPercent: 35, status: 'in_progress', updateDate: new Date(2026, 9, 4).getTime(), notes: 'Supervisor correction', correctionOfId: 'h1' }));
        expect(history[0].progressPercent).toBe(20);
        expect(ui.getByText(/Earlier note/)).toBeTruthy();
    });
});
