import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { database } from '../../../../src/database';
import { resetDatabase } from '../../../../src/database/__mocks__';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { createTestData } from '../../../../src/__tests__/test-utils';

jest.mock('expo-file-system/legacy', () => ({
    __esModule: true,
    documentDirectory: 'mock-dir/',
    writeAsStringAsync: jest.fn().mockResolvedValue(true),
    EncodingType: { UTF8: 'utf8', Base64: 'base64' },
}));



jest.mock('expo-sharing', () => ({
    __esModule: true,
    shareAsync: jest.fn().mockResolvedValue({}),
}));

jest.mock('expo-print', () => ({
    __esModule: true,
    printToFileAsync: jest.fn().mockResolvedValue({ uri: 'mock-uri' }),
}));


jest.mock('../../../../src/database', () => {
    return require('../../../../src/database/__mocks__');
});

jest.mock('expo-router', () => {
    const React = require('react');
    return {
        router: {
            push: jest.fn(),
        },
        useRouter: () => ({
            push: jest.fn(),
        }),
        useFocusEffect: (cb: any) => React.useEffect(() => {
            cb();
            return undefined;
        }, []),
        useLocalSearchParams: () => ({}),
    };
});

jest.mock('xlsx', () => ({
    utils: {
        book_new: jest.fn().mockReturnValue({}),
        json_to_sheet: jest.fn(),
        book_append_sheet: jest.fn(),
    },
    write: jest.fn().mockReturnValue('mock-binary-data'),
}));

describe('DailyCollectionReport', () => {
    jest.setTimeout(30000);
    beforeEach(async () => {
        jest.clearAllMocks();
        resetDatabase();
        await createTestData(database, { collectorName: 'Main Agent' });
    });

    it('renders loading state initially', async () => {
        const DailyCollectionReport = require('../daily-collection').default;
        const { getByTestId, queryByTestId } = render(<DailyCollectionReport />);
        expect(getByTestId('loading-indicator')).toBeTruthy();

        await waitFor(() => {
            expect(queryByTestId('loading-indicator')).toBeNull();
        }, { timeout: 5000 });
    });

    it('renders report data after loading', async () => {
        const DailyCollectionReport = require('../daily-collection').default;
        const { getByText, queryByTestId, getAllByText } = render(<DailyCollectionReport />);
        
        await waitFor(() => {
            expect(queryByTestId('loading-indicator')).toBeNull();
        }, { timeout: 5000 });

        expect(getByText('Test Borrower')).toBeTruthy();
        expect(getAllByText('Main Agent').length).toBeGreaterThan(0);
        expect(getByText('Total Payments')).toBeTruthy();
        expect(getAllByText('40.00').length).toBeGreaterThan(0); // Target Collection
        expect(getAllByText('0.00').length).toBeGreaterThan(0); // Total Payments should be 0.00
    });

    it('filters data by collector', async () => {
        const DailyCollectionReport = require('../daily-collection').default;
        const { getByText, getByTestId, queryByText } = render(<DailyCollectionReport />);
        
        await waitFor(() => expect(queryByText('Test Borrower')).toBeTruthy());

        const collectors = await database.get('collectors').query().fetch();
        const mainAgent = collectors[0];
        
        const collectorAlphaPill = getByTestId(`collector-pill-${mainAgent.id}`);
        await act(async () => {
            fireEvent.press(collectorAlphaPill);
        });

        await waitFor(() => {
            expect(getByText('Test Borrower')).toBeTruthy();
        });
    });

    it('exports to Excel', async () => {
        const DailyCollectionReport = require('../daily-collection').default;
        const { getByTestId, queryByText } = render(<DailyCollectionReport />);
        
        await waitFor(() => expect(queryByText('Test Borrower')).toBeTruthy());

        const exportButton = getByTestId('export-csv');
        await act(async () => {
            fireEvent.press(exportButton);
        });

        await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
    });

    it('prints to PDF', async () => {
        const DailyCollectionReport = require('../daily-collection').default;
        const { getByTestId, queryByText } = render(<DailyCollectionReport />);
        
        await waitFor(() => expect(queryByText('Test Borrower')).toBeTruthy());

        const printButton = getByTestId('print-pdf');
        await act(async () => {
            fireEvent.press(printButton);
        });

        expect(Print.printToFileAsync).toHaveBeenCalled();
    });
});
