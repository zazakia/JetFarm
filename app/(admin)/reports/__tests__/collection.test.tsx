import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { startOfDay, startOfMonth, startOfYear, subDays } from 'date-fns';
import CollectionReportScreen from '../collection';
import { database } from '../../../../src/database';

jest.mock('../../../../src/database');

jest.mock('expo-router', () => {
    const React = require('react');
    return {
        useFocusEffect: (cb: any) => React.useEffect(() => {
            cb();
        }, []),
        useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    };
});

describe('CollectionReportScreen', () => {
    let testDb: any;

    beforeEach(async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-15T12:00:00Z'));
        testDb = database;
        await testDb.write(async () => {
            const tables = ['payments', 'loans', 'borrowers', 'collectors'];
            for (const table of tables) {
                const records = await testDb.collections.get(table).query().fetch();
                for (const record of records) {
                    await record.destroyPermanently();
                }
            }
        });
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const seedData = async () => {
        const today = startOfDay(new Date());
        const monthStart = startOfMonth(today);
        const yearStart = startOfYear(today);
        const priorYear = subDays(yearStart, 10);

        await testDb.write(async () => {
            const collectorA = await testDb.collections.get('collectors').create((c: any) => {
                c.fullName = 'Collector A';
                c.isActive = true;
            });
            const collectorB = await testDb.collections.get('collectors').create((c: any) => {
                c.fullName = 'Collector B';
                c.isActive = true;
            });

            const borrowerA = await testDb.collections.get('borrowers').create((b: any) => {
                b.fullName = 'Borrower A';
                b.address = 'Alpha Street';
                b.collectorId = collectorA.id;
            });
            const borrowerB = await testDb.collections.get('borrowers').create((b: any) => {
                b.fullName = 'Borrower B';
                b.address = 'Beta Street';
                b.collectorId = collectorB.id;
            });

            const loanA = await testDb.collections.get('loans').create((l: any) => {
                l.borrowerId = borrowerA.id;
                l.collectorId = collectorA.id;
                l.loanNumber = 'LN-A';
                l.principalAmount = 1000;
                l.interestAmount = 200;
                l.totalAmount = 1200;
                l.installmentAmount = 40;
                l.status = 'active';
                l.frequency = 'daily';
            });
            const loanB = await testDb.collections.get('loans').create((l: any) => {
                l.borrowerId = borrowerB.id;
                l.collectorId = collectorB.id;
                l.loanNumber = 'LN-B';
                l.principalAmount = 1500;
                l.interestAmount = 300;
                l.totalAmount = 1800;
                l.installmentAmount = 60;
                l.status = 'active';
                l.frequency = 'weekly';
            });

            await testDb.collections.get('payments').create((p: any) => {
                p.loanId = loanA.id;
                p.collectorId = collectorA.id;
                p.amount = 100;
                p.paymentDate = today.getTime();
                p.receiptNumber = 'OR-001';
            });

            await testDb.collections.get('payments').create((p: any) => {
                p.loanId = loanA.id;
                p.collectorId = collectorA.id;
                p.amount = 50;
                p.paymentDate = monthStart.getTime();
                p.receiptNumber = 'OR-002';
            });

            await testDb.collections.get('payments').create((p: any) => {
                p.loanId = loanB.id;
                p.collectorId = collectorB.id;
                p.amount = 200;
                p.paymentDate = yearStart.getTime();
                p.receiptNumber = 'OR-003';
            });

            await testDb.collections.get('payments').create((p: any) => {
                p.loanId = loanB.id;
                p.collectorId = collectorB.id;
                p.amount = 300;
                p.paymentDate = priorYear.getTime();
                p.receiptNumber = 'OR-004';
            });
        });
    };

    it('defaults to month-to-date and supports preset plus collector filtering', async () => {
        await seedData();

        render(<CollectionReportScreen />);

        await waitFor(() => {
            expect(screen.getByText('Collection Report')).toBeTruthy();
            expect(screen.getAllByText('Borrower A').length).toBeGreaterThan(0);
        });

        expect(screen.getByText('MTD')).toBeTruthy();
        expect(screen.getByText('PHP 150.00')).toBeTruthy();
        expect(screen.queryByText('Borrower B')).toBeNull();

        fireEvent.press(screen.getByTestId('preset-pill-ytd'));

        await waitFor(() => {
            expect(screen.getByText('Borrower B')).toBeTruthy();
            expect(screen.getByText('PHP 350.00')).toBeTruthy();
        });

        fireEvent.press(screen.getByTestId('collector-pill-filter-collector-a'));

        await waitFor(() => {
            expect(screen.queryByText('Borrower B')).toBeNull();
            expect(screen.getByText('PHP 150.00')).toBeTruthy();
        });

        fireEvent.press(screen.getByTestId('preset-pill-today'));

        await waitFor(() => {
            expect(screen.getByText('PHP 100.00')).toBeTruthy();
            expect(screen.queryByText('OR-002')).toBeNull();
        });
    });
});
