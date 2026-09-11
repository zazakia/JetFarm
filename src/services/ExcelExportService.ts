import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ErrorService, ErrorType } from './ErrorService';

export class ExcelExportService {
    /**
     * Generates a CSV file from data and prompts the user to share/save it.
     */
    async exportToCsv(filename: string, headers: string[], data: any[][]): Promise<void> {
        try {
            // Convert data to CSV format
            const csvContent = [
                headers.join(','),
                ...data.map(row => row.map(cell => this.escapeCsvCell(cell)).join(','))
            ].join('\n');

            const fileUri = `${(FileSystem as any).documentDirectory}${filename}.csv`;

            // Write to local file system
            await FileSystem.writeAsStringAsync(fileUri, csvContent, {
                encoding: (FileSystem as any).EncodingType.UTF8
            });

            // Trigger the share dialog for the generated file
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'text/csv',
                    dialogTitle: `Export ${filename}`,
                    UTI: 'public.comma-separated-values-text'
                });
            } else {
                throw new Error('File sharing is not available on this device');
            }
        } catch (error) {
            throw ErrorService.handleError(error, 'ExcelExportService.exportToCsv', ErrorType.UNKNOWN);
        }
    }

    /**
     * Escapes CSV cells containing commas or quotes
     */
    private escapeCsvCell(cell: any): string {
        if (cell === null || cell === undefined) return '';
        const stringCell = String(cell);
        if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
            return `"${stringCell.replace(/"/g, '""')}"`;
        }
        return stringCell;
    }
}

export const excelExportService = new ExcelExportService();
