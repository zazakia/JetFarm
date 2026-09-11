import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NewCollectorScreen from '../new';
import { database } from '../../../../src/database';
import { Alert } from 'react-native';

jest.mock('expo-router', () => ({
    useRouter: () => ({ back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() }),
}));

jest.mock('../../../../src/database', () => ({
    database: {
        write: jest.fn().mockImplementation((cb) => cb()),
        batch: jest.fn().mockResolvedValue(undefined),
        collections: {
            get: jest.fn(),
        },
    },
}));

jest.mock('../../../../src/services/ActionLogService', () => ({
    prepareLogActions: jest.fn().mockResolvedValue([]),
}));

describe('NewCollectorScreen', () => {
    const mockPrepareCreate = jest.fn((cb) => {
        const record: any = { _raw: {} };
        cb(record);
        return record;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        const mockCollection = {
            prepareCreate: mockPrepareCreate,
            query: jest.fn().mockReturnValue({
                fetch: jest.fn().mockResolvedValue([]), // Default to no duplicates
            }),
        };

        (database.collections.get as jest.Mock).mockReturnValue(mockCollection);
        jest.spyOn(Alert, 'alert');
    });

    it('creates both UserProfile and Collector records on form submission', async () => {
        const { getByPlaceholderText, getByText } = render(<NewCollectorScreen />);
        
        fireEvent.changeText(getByPlaceholderText('e.g. Juan De La Cruz'), 'John Doe');
        fireEvent.changeText(getByPlaceholderText('collector@poscursor.com'), 'john@example.com');
        
        fireEvent.press(getByText('Register Agent'));

        await waitFor(() => {
            // Check that database.collections.get was called for both tables
            expect(database.collections.get).toHaveBeenCalledWith('user_profiles');
            expect(database.collections.get).toHaveBeenCalledWith('collectors');
            
            // Check that prepareCreate was called twice (once for each table)
            expect(mockPrepareCreate).toHaveBeenCalledTimes(2);
            expect(database.batch).toHaveBeenCalled();
            
            expect(Alert.alert).toHaveBeenCalledWith("Success", "Collector profile created.");
        });
    });
});
