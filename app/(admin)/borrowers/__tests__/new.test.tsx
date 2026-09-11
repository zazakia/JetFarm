import React from 'react';
import { render, waitFor, screen } from '@testing-library/react-native';
import NewBorrowerScreen from '../new';
import { database } from '../../../../src/database';

jest.mock('expo-router', () => ({
    useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('../../../../src/store/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'admin1' } }),
}));

jest.mock('../../../../src/database', () => ({
    database: {
        collections: {
            get: jest.fn(),
        },
    },
}));

describe('NewBorrowerScreen', () => {
    const mockCollectors = [
        { id: 'c1', fullName: 'Collector One', isActive: true },
        { id: 'c2', fullName: 'Collector Two', isActive: true }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        (database.collections.get as jest.Mock).mockImplementation((collectionName) => {
            if (collectionName === 'collectors') {
                return {
                    query: jest.fn().mockReturnThis(),
                    fetch: jest.fn().mockResolvedValue(mockCollectors),
                };
            }
            return {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]),
            };
        });
    });

    it('fetches collectors from the correct table and displays them', async () => {
        render(<NewBorrowerScreen />);
        
        await waitFor(() => {
            expect(database.collections.get).toHaveBeenCalledWith('collectors');
            expect(screen.getByText('Collector One')).toBeTruthy();
            expect(screen.getByText('Collector Two')).toBeTruthy();
        });
    });

    it('shows empty message when no collectors are found', async () => {
        (database.collections.get as jest.Mock).mockImplementation(() => ({
            query: jest.fn().mockReturnThis(),
            fetch: jest.fn().mockResolvedValue([]),
        }));

        render(<NewBorrowerScreen />);
        
        await waitFor(() => {
            expect(screen.getByText('No collectors found.')).toBeTruthy();
        });
    });
});
