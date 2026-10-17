import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { BlockTaskDirectory } from '../BlockTaskDirectory';

const mockPush = jest.fn();
const mockRows: Record<string, any[]> = {
    agri_parcel_blocks: [{ id: 'b1', parcelId: 'p1', name: 'North', status: 'active' }],
    agri_block_assignments: [
        { id: 'a1', blockId: 'b1', workerId: 'w1', task: 'Weeding', status: 'in_progress', progressPercent: 40, dueDate: new Date(0) },
        { id: 'a2', blockId: 'b1', workerId: 'w2', task: 'Planting', status: 'completed', progressPercent: 100, dueDate: new Date(0) },
    ],
    agri_farm_workers: [{ id: 'w1', name: 'DUMMY: One' }, { id: 'w2', name: 'DUMMY: Two' }],
};
const mockGet = jest.fn((table: string) => ({ query: () => ({ fetch: async () => mockRows[table] || [] }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../../database', () => ({ database: { get: (...args: any[]) => mockGet(args[0]) } }));
beforeEach(() => jest.clearAllMocks());

it('opens saved per-worker tasks without treating unrelated percentages as parcel progress', async () => {
    const ui = render(<BlockTaskDirectory />);
    fireEvent.press(ui.getByLabelText('Show block task monitoring'));
    await waitFor(() => expect(ui.getByText('DUMMY: One · North · Weeding · 40% · overdue')).toBeTruthy());
    expect(ui.getByText('DUMMY: Two · North · Planting · 100% · completed')).toBeTruthy();
    expect(mockGet.mock.calls.map(([table]) => table).sort()).toEqual(['agri_block_assignments', 'agri_farm_workers', 'agri_parcel_blocks']);
    fireEvent.press(ui.getByLabelText('Show overdue block tasks'));
    expect(ui.queryByText(/DUMMY: Two/)).toBeNull();
    fireEvent.press(ui.getByLabelText('Open block task a1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(admin)/agribusiness/mapping', params: { parcelId: 'p1', blockId: 'b1' } });
});
