import { ExcelExportService } from '../ExcelExportService';

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Mock expo modules
jest.mock('expo-file-system', () => ({
    documentDirectory: 'file://document/dir/',
    writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
    EncodingType: { UTF8: 'utf8' },
}));

jest.mock('expo-sharing', () => ({
    isAvailableAsync: jest.fn().mockResolvedValue(true),
    shareAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('ExcelExportService', () => {
    let service: ExcelExportService;

    beforeEach(() => {
        service = new ExcelExportService();
        jest.clearAllMocks();
    });

    describe('exportToCsv', () => {
        it('generates a CSV file and triggers sharing', async () => {
            const headers = ['ID', 'Name', 'Amount'];
            const data = [
                ['1', 'John Doe', 100],
                ['2', 'Jane Smith', 200]
            ];

            await service.exportToCsv('TestReport', headers, data);

            expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
                'file://document/dir/TestReport.csv',
                expect.stringContaining('ID,Name,Amount\n1,John Doe,100\n2,Jane Smith,200'),
                expect.any(Object)
            );

            expect(Sharing.shareAsync).toHaveBeenCalledWith(
                'file://document/dir/TestReport.csv',
                expect.objectContaining({ mimeType: 'text/csv' })
            );
        });

        it('escapes cells with commas or quotes properly', async () => {
            const headers = ['Notes'];
            const data = [
                ['A note, with a comma'],
                ['He said "Hello"']
            ];

            await service.exportToCsv('EscapedReport', headers, data);

            expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('Notes\n"A note, with a comma"\n"He said ""Hello"""'),
                expect.any(Object)
            );
        });

        it('throws an error if sharing is unavailable', async () => {
            (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

            await expect(service.exportToCsv('FailReport', ['A'], [['1']])).rejects.toEqual(expect.objectContaining({ message: expect.stringContaining('File sharing is not available') }));
        });
    });
});
