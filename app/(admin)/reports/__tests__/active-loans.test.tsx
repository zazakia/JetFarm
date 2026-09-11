// Mock dependencies
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { MfiKpiService } from '../../../../src/services/MfiKpiService';

import ActiveLoansReport from '../active-loans';

jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const { Text } = require('react-native');
    return {
        MaterialIcons: ({ name }: any) => React.createElement(Text, null, name),
    };
});

jest.mock('../../../../src/components/DatePicker', () => {
    const React = require('react');
    const { TextInput } = require('react-native');
    return {
        DatePicker: ({ value, onChange, placeholder }: any) =>
            React.createElement(TextInput, { testID: `datepicker-${placeholder}`, value: value ?? '', onChangeText: onChange }),
    };
});

jest.mock('../../../../src/utils/currency', () => ({
    formatPHP: (v: number) => `₱${v}`,
}));

jest.mock('../../../../src/utils/dates', () => ({
    formatDate: (d: Date) => d.toISOString().split('T')[0],
}));

jest.mock('../../../../src/services/MfiKpiService', () => ({
    MfiKpiService: {
        getActiveLoansReportData: jest.fn(),
    },
}));

jest.mock('expo-sharing', () => ({
    shareAsync: jest.fn().mockResolvedValue({}),
}));

const mockAddRow = jest.fn();
const mockWriteBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
const mockAddWorksheet = jest.fn().mockReturnValue({
    addRow: mockAddRow,
    columns: [],
});
const mockWorkbook = jest.fn().mockImplementation(() => ({
    addWorksheet: mockAddWorksheet,
    xlsx: {
        writeBuffer: mockWriteBuffer,
    },
}));

jest.mock('exceljs', () => ({
    __esModule: true,
    get default() {
        return {
            Workbook: mockWorkbook,
        };
    }
}));

jest.mock('expo-file-system', () => ({
    documentDirectory: 'mock-dir/',
    writeAsStringAsync: jest.fn().mockResolvedValue(true),
    EncodingType: { UTF8: 'utf8', Base64: 'base64' },
}));

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

const mockReportData = [
    {
        clientName: 'John Doe',
        address: '123 Main St',
        collectorName: 'Collector A',
        loanAmount: 10000,
        totalLoanBalance: 8000,
        dayCollectionOutstanding: 500,
        dateRelease: '2023-01-01',
        endDate: '2023-12-31',
        agings: { day1_30: 1000, day31_60: 0, day61_90: 0, day91_180: 0 },
        efficiency: { expectedCollected: 1000, totalCollected: 1000 }
    },
    {
        clientName: 'Jane Smith',
        address: '456 Oak St',
        collectorName: 'Collector B',
        loanAmount: 5000,
        totalLoanBalance: 2000,
        dayCollectionOutstanding: 200,
        dateRelease: '2023-02-01',
        endDate: '2023-08-31',
        agings: { day1_30: 0, day31_60: 500, day61_90: 0, day91_180: 0 },
        efficiency: { expectedCollected: 500, totalCollected: 250 }
    }
];

describe('ActiveLoansReport', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (MfiKpiService.getActiveLoansReportData as jest.Mock).mockResolvedValue(mockReportData);
    });

    it('renders loading state initially', async () => {
        const view = render(<ActiveLoansReport />);
        expect(view.getByTestId('loading-indicator')).toBeTruthy();
        
        // Wait for load to finish to prevent test bleed
        await waitFor(() => {
            expect(view.queryByTestId('loading-indicator')).toBeNull();
        }, { timeout: 2000 });
    });

    it('renders report data after loading', async () => {
        let view: any;
        view = render(<ActiveLoansReport />);
        const { getByText, queryByTestId, getAllByText } = view;
        
        await waitFor(() => {
            expect(queryByTestId('loading-indicator')).toBeNull();
        }, { timeout: 1000 });

        expect(getByText('John Doe')).toBeTruthy();
        expect(getByText('Jane Smith')).toBeTruthy();
        expect(getAllByText('Collector A').length).toBeGreaterThan(0);
        expect(getAllByText('Collector B').length).toBeGreaterThan(0);
    });

    it('filters data by collector', async () => {
        let view: any;
        view = render(<ActiveLoansReport />);
        const { getByText, getByTestId, queryByText } = view;
        
        await waitFor(() => expect(queryByText('John Doe')).toBeTruthy());

        const collectorAPill = getByTestId('collector-pill-Collector A');
        await act(async () => {
            fireEvent.press(collectorAPill);
        });

        await waitFor(() => {
            expect(getByText('John Doe')).toBeTruthy();
            expect(queryByText('Jane Smith')).toBeNull();
        });

        const allPill = getByTestId('collector-pill-all');
        await act(async () => {
            fireEvent.press(allPill);
        });

        await waitFor(() => {
            expect(getByText('John Doe')).toBeTruthy();
            expect(getByText('Jane Smith')).toBeTruthy();
        });
    });

    it('exports to Excel', async () => {
        let view: any;
        view = render(<ActiveLoansReport />);
        const { getByTestId, queryByText } = view;
        
        await waitFor(() => expect(queryByText('John Doe')).toBeTruthy());

        const exportButton = getByTestId('export-excel');
        await act(async () => {
            fireEvent.press(exportButton);
        });

        expect(mockWorkbook).toHaveBeenCalled();
        expect(mockAddWorksheet).toHaveBeenCalledWith('Active Loans');
        expect(mockAddRow).toHaveBeenCalled();
        expect(mockWriteBuffer).toHaveBeenCalled();
    });
});
