import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import FarmLaborScreen from '../labor';
import FarmWorkersScreen from '../workers';

jest.mock('../../../../src/database', () => ({ database: { get: () => ({ query: () => ({ fetch: async () => [], fetchCount: async () => 0 }) }) } }));
jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    useFocusEffect: (fn: any) => require('react').useEffect(fn, [fn]),
}));

it.each([['labor', FarmLaborScreen], ['workers', FarmWorkersScreen]])('offers separate block task monitoring in %s without replacing wage workflows', async (_name, Component) => {
    const ui = render(<Component />);
    await waitFor(() => expect(ui.getByLabelText('Show block task monitoring')).toBeTruthy());
    expect(ui.getByText(/does not create wage logs or payments/)).toBeTruthy();
});
