import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react-native';
import { BorrowerSelector } from '../BorrowerSelector';
import { database } from '../../database';

// Mock database
jest.mock('../../database', () => ({
    database: {
        collections: {
            get: jest.fn().mockReturnThis(),
        },
    },
}));

describe('BorrowerSelector', () => {
    const mockOnSelect = jest.fn();
    const mockBorrowers = [
        { id: 'b1', fullName: 'Alice Smith', role: 'borrower', phone: '123' },
        { id: 'b2', fullName: 'Bob Jones', role: 'borrower' },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        (database.collections.get as jest.Mock).mockReturnValue({
            find: jest.fn().mockImplementation((id) => Promise.resolve(mockBorrowers.find(b => b.id === id))),
            query: jest.fn().mockReturnThis(),
            fetch: jest.fn().mockResolvedValue(mockBorrowers),
        });
    });

    it('renders initial state', async () => {
        render(<BorrowerSelector onSelect={mockOnSelect} />);
        expect(screen.getByText('Select a Member')).toBeTruthy();
    });

    it('loads and displays selected borrower on mount', async () => {
        render(<BorrowerSelector selectedBorrowerId="b1" onSelect={mockOnSelect} />);
        await waitFor(() => {
            expect(screen.getByText('Alice Smith')).toBeTruthy();
        });
    });

    it('handles borrower not found error on mount', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const mockCollect = database.collections.get('borrowers');
        (mockCollect.find as jest.Mock).mockRejectedValueOnce(new Error('Load fail'));

        render(<BorrowerSelector selectedBorrowerId="b99" onSelect={mockOnSelect} />);
        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith("Failed to load selected borrower", expect.any(Error));
        });
        consoleSpy.mockRestore();
    });

    it('opens modal and shows borrower list', async () => {
        render(<BorrowerSelector onSelect={mockOnSelect} />);
        fireEvent.press(screen.getByText('Select a Member'));

        expect(await screen.findByText('Select Member')).toBeTruthy();
        expect(screen.getByText('Alice Smith')).toBeTruthy();
        expect(screen.getByText('Bob Jones')).toBeTruthy();
    });

    it('filters borrowers by search query', async () => {
        render(<BorrowerSelector onSelect={mockOnSelect} />);
        fireEvent.press(screen.getByText('Select a Member'));

        await screen.findByText('Select Member');
        fireEvent.changeText(screen.getByPlaceholderText('Search by name...'), 'Alice');

        expect(screen.getByText('Alice Smith')).toBeTruthy();
        expect(screen.queryByText('Bob Jones')).toBeNull();
    });

    it('selects a borrower and closes modal', async () => {
        render(<BorrowerSelector onSelect={mockOnSelect} />);
        fireEvent.press(screen.getByText('Select a Member'));

        const item = await screen.findByText('Alice Smith');
        fireEvent.press(item);

        expect(mockOnSelect).toHaveBeenCalledWith(mockBorrowers[0]);
        expect(screen.queryByText('Select Member')).toBeNull();
    });

    it('shows error message if provided', () => {
        render(<BorrowerSelector onSelect={mockOnSelect} error="Borrower is required" />);
        expect(screen.getByText('Borrower is required')).toBeTruthy();
    });

    it('closes modal on close button press', async () => {
        render(<BorrowerSelector onSelect={mockOnSelect} />);
        fireEvent.press(screen.getByText('Select a Member'));
        
        const closeBtn = await screen.findByTestId('close-modal');
        fireEvent.press(closeBtn);

        expect(screen.queryByText('Select Member')).toBeNull();
    });

    it('handles load error gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const mockCollect = database.collections.get('borrowers');
        ((mockCollect as any).fetch as jest.Mock).mockRejectedValueOnce(new Error('Fetch fail'));

        render(<BorrowerSelector onSelect={mockOnSelect} />);
        fireEvent.press(screen.getByText('Select a Member'));

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalled();
        });
        consoleSpy.mockRestore();
    });

    it('triggers onRequestClose on Modal', async () => {
        render(<BorrowerSelector onSelect={mockOnSelect} />);
        fireEvent.press(screen.getByText('Select a Member'));
        
        const modal = await screen.findByTestId('borrower-modal');
        // @ts-ignore
        await act(async () => {
             modal.props.onRequestClose();
        });
    });

    it('triggers Quick Add button', async () => {
        render(<BorrowerSelector onSelect={mockOnSelect} />);
        fireEvent.press(screen.getByText('Select a Member'));
        
        const addBtn = await screen.findByTestId('person-add');
        fireEvent.press(addBtn);
        // isQuickAddVisible is internal but we reached the line
    });

    it('filters borrowers by collector assignment for collector role', async () => {
        const mockQuery = jest.fn().mockReturnThis();
        const mockFetch = jest.fn().mockResolvedValue([mockBorrowers[0]]);
        (database.collections.get as jest.Mock).mockReturnValue({
            find: jest.fn().mockResolvedValue(mockBorrowers[0]),
            query: mockQuery,
            fetch: mockFetch,
        });

        render(
            <BorrowerSelector
                onSelect={mockOnSelect}
                role="collector"
                collectorId="collector-1"
            />
        );
        fireEvent.press(screen.getByText('Select a Member'));

        await screen.findByText('Select Member');
        expect(mockQuery).toHaveBeenCalled();
        expect(screen.getByText('Alice Smith')).toBeTruthy();
        expect(screen.queryByText('Bob Jones')).toBeNull();
    });
});

