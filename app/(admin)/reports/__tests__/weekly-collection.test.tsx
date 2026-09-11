import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import WeeklyCollectionReport from '../weekly-collection';
import { database } from '../../../../src/database';
import { Platform } from 'react-native';

// We mock the database using the automatic mock from src/database/__mocks__/index.ts
// This ensures that all components and tests share the same instance.
jest.mock('../../../../src/database');

jest.mock('expo-router', () => {
    const React = require('react');
    return {
        useFocusEffect: (cb: any) => React.useEffect(() => {
            cb();
        }, []),
        useLocalSearchParams: () => ({}),
        useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    };
});

jest.mock('expo-print', () => ({
    printToFileAsync: jest.fn().mockResolvedValue({ uri: 'mock-uri' }),
}));

jest.mock('expo-sharing', () => ({
    shareAsync: jest.fn().mockResolvedValue({}),
}));

jest.mock('expo-file-system/legacy', () => ({
    documentDirectory: 'mock-dir/',
    writeAsStringAsync: jest.fn().mockResolvedValue({}),
    EncodingType: { UTF8: 'utf8' }
}));

// Mock logoBase64 to avoid huge string in logs
jest.mock('../../../../src/utils/logoBase64', () => ({
    logoBase64: 'mock-logo'
}));

describe('WeeklyCollectionReport', () => {
    let testDb: any;

    beforeEach(async () => {
        testDb = database;
        // Clean database by deleting all records from relevant tables
        await testDb.write(async () => {
            const tables = ['collectors', 'borrowers', 'loans', 'payment_schedules', 'payments'];
            for (const table of tables) {
                const records = await testDb.collections.get(table).query().fetch();
                for (const record of records) {
                    await record.destroyPermanently();
                }
            }
        });
        jest.clearAllMocks();
    });

    const seedData = async () => {
        await testDb.write(async () => {
            const collector = await testDb.collections.get('collectors').create((c: any) => {
                c.fullName = 'Test Collector';
                c.isActive = true;
            });

            const borrower = await testDb.collections.get('borrowers').create((b: any) => {
                b.fullName = 'Test Borrower';
                b.address = 'Test Address';
            });

            const loan = await testDb.collections.get('loans').create((l: any) => {
                l.borrowerId = borrower.id;
                l.collectorId = collector.id;
                l.principalAmount = 10000;
                l.totalAmount = 11000;
                l.status = 'active';
                l.frequency = 'weekly';
            });

            const now = new Date();
            const dayOfWeek = now.getDay();
            const monday = new Date(now);
            monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
            monday.setHours(12, 0, 0, 0);

            await testDb.collections.get('payment_schedules').create((s: any) => {
                s.loanId = loan.id;
                s.dueDate = monday.getTime();
                s.scheduledAmount = 500;
                s.status = 'pending';
            });

            await testDb.collections.get('payments').create((p: any) => {
                p.loanId = loan.id;
                p.amount = 500;
                p.paymentDate = monday.getTime();
            });
        });
    };

    it('renders and displays collection data', async () => {
        await seedData();
        
        render(<WeeklyCollectionReport />);

        await waitFor(() => {
            expect(screen.getByText('Test Borrower')).toBeTruthy();
        }, { timeout: 8000 });

        expect(screen.getByText('Test Address')).toBeTruthy();
        const collectors = screen.getAllByText('Test Collector');
        expect(collectors.length).toBeGreaterThanOrEqual(1);
        const amounts = screen.getAllByText('500.00');
        expect(amounts.length).toBeGreaterThanOrEqual(1);
    });

    it('navigates weeks', async () => {
        await seedData();
        render(<WeeklyCollectionReport />);
        
        const nextBtn = await screen.findByTestId('next-week');
        const prevBtn = await screen.findByTestId('prev-week');
        
        fireEvent.press(nextBtn);
        await waitFor(() => {
             expect(screen.getByText(/Current Week/i)).toBeTruthy();
        });

        fireEvent.press(prevBtn);
        await waitFor(() => {
             expect(screen.getByText(/Current Week/i)).toBeTruthy();
        });
    });

    it('filters by collector', async () => {
        await seedData();
        render(<WeeklyCollectionReport />);
        
        await waitFor(() => {
            expect(screen.getByText('All')).toBeTruthy();
            const collectors = screen.getAllByText(/Test Collector/i);
            expect(collectors.length).toBeGreaterThanOrEqual(1);
        }, { timeout: 5000 });

        // Click the collector pill if found, but they are wrapped in Pressable
        fireEvent.press(screen.getAllByText('Test Collector')[0]);
        
        await waitFor(() => {
            expect(screen.getByText('Test Borrower')).toBeTruthy();
        });
    });

    it('exports to CSV on native', async () => {
        await seedData();
        // Since we can't easily mock Platform.OS on the fly in some environments,
        // we'll just check that it renders the export button and handles press if Platform is native.
        (Platform as any).OS = 'ios';

        render(<WeeklyCollectionReport />);
        
        await waitFor(() => expect(screen.getByText(/Export/i)).toBeTruthy());
        
        fireEvent.press(screen.getByText(/Export/i));

        const FileSystem = require('expo-file-system/legacy');
        const Sharing = require('expo-sharing');

        await waitFor(() => {
            expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
            expect(Sharing.shareAsync).toHaveBeenCalled();
        });
    });

    it('prints to PDF on native', async () => {
        await seedData();
        (Platform as any).OS = 'ios';

        render(<WeeklyCollectionReport />);
        
        await waitFor(() => expect(screen.getByText(/Print PDF/i)).toBeTruthy());
        
        fireEvent.press(screen.getByText(/Print PDF/i));

        const Print = require('expo-print');
        const Sharing = require('expo-sharing');

        await waitFor(() => {
            expect(Print.printToFileAsync).toHaveBeenCalled();
            expect(Sharing.shareAsync).toHaveBeenCalled();
        });
    });

    it('handles empty state', async () => {
        render(<WeeklyCollectionReport />);
        await waitFor(() => {
            expect(screen.getByText('No collections found for this week.')).toBeTruthy();
        });
    });
});
