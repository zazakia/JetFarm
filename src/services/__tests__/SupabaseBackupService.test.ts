import { Platform } from 'react-native';

import { SupabaseBackupService } from '../SupabaseBackupService';
import { supabase } from '../../database/supabase';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import syncTableContract from '../syncTableContract.json';

// Mock all external dependencies
jest.mock('../../database/supabase', () => {
    const mockChain = {
        select: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockResolvedValue({ error: null }),
    };
    return {
        supabase: {
            from: jest.fn(() => ({
                select: jest.fn().mockReturnValue({
                    range: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
                upsert: jest.fn().mockResolvedValue({ error: null }),
            })),
        },
    };
});

jest.mock('expo-file-system', () => ({
    cacheDirectory: '/mock/cache/',
    writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
    readAsStringAsync: jest.fn().mockResolvedValue('{}'),
}));

jest.mock('expo-sharing', () => ({
    isAvailableAsync: jest.fn().mockResolvedValue(true),
    shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-document-picker', () => ({
    getDocumentAsync: jest.fn().mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///mock/backup.json', file: null }],
    }),
}));

jest.mock('../../components/AppToast', () => ({
    show: jest.fn(),
}));

const mockFrom = supabase.from as jest.Mock;

describe('SupabaseBackupService', () => {
    const originalDocument = global.document;
    const originalUrl = global.URL;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        // Default: return empty data for all tables
        mockFrom.mockReturnValue({
            select: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
                upsert: jest.fn().mockResolvedValue({ error: null }),
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        global.document = originalDocument;
        global.URL = originalUrl;
    });

    describe('exportBackup', () => {
        it('exports data from all tables on native (non-web)', async () => {
            // Override Platform for this test
            const originalOS = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

            const result = await SupabaseBackupService.exportBackup(true);
            expect(result.success).toBe(true);

            Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
        });

        it('exports data from all tables on web', async () => {
            jest.useFakeTimers();
            const originalOS = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

            // Mock DOM APIs for web
            const mockElement = {
                style: { display: '' },
                href: '',
                setAttribute: jest.fn(),
                click: jest.fn(),
            };
            const createElement = jest.fn().mockReturnValue(mockElement as any);
            const appendChild = jest.fn().mockImplementation(() => mockElement as any);
            const removeChild = jest.fn().mockImplementation(() => mockElement as any);
            (global as any).document = {
                createElement,
                body: {
                    appendChild,
                    removeChild,
                },
            };
            (global as any).URL = {
                createObjectURL: jest.fn().mockReturnValue('blob:url'),
                revokeObjectURL: jest.fn(),
            };

            const result = await SupabaseBackupService.exportBackup(false);
            expect(result.success).toBe(true);
            expect(result.message).toContain('downloaded');
            expect(createElement).toHaveBeenCalledWith('a');
            expect(appendChild).toHaveBeenCalled();

            // Run the timer to trigger cleanup callback
            jest.advanceTimersByTime(500);
            expect(removeChild).toHaveBeenCalledWith(mockElement);
            expect((global as any).URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');

            Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
            jest.useRealTimers();
        });

        it('fetches only tables that still exist in the sync contract', async () => {
            // The lending remote tables are retired on this variant. A stale hard-coded list
            // makes the whole export throw on the first missing relation, because every fetch
            // error is rethrown by exportBackup.
            const originalOS = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

            await SupabaseBackupService.exportBackup(true);

            const remote = new Set<string>(Object.values(syncTableContract.remoteTableMap));
            const called = (mockFrom.mock.calls as any[]).map((c) => c[0]);
            const stale = called.filter((t) => !remote.has(t));

            expect(stale).toEqual([]);

            Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
        });

        it('excludes the retired lending remote tables from the backup scope', async () => {
            const originalOS = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

            await SupabaseBackupService.exportBackup(true);

            const called = (mockFrom.mock.calls as any[]).map((c) => c[0]);
            expect(called).not.toContain('app_borrowers');
            expect(called).not.toContain('app_loans');
            expect(called).not.toContain('app_payments');
            expect(called).not.toContain('app_loan_products');

            Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
        });

        it('skips download side effects for silent web exports', async () => {
            const originalOS = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

            const createObjectURL = jest.fn();
            (global as any).URL = { createObjectURL };

            const result = await SupabaseBackupService.exportBackup(true);

            expect(result.success).toBe(true);
            expect(createObjectURL).not.toHaveBeenCalled();

            Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
        });

        it('handles pagination when table has more than 1000 rows', async () => {
            let callCount = 0;
            mockFrom.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    range: jest.fn().mockImplementation(() => {
                        callCount++;
                        if (callCount === 1) {
                            // First page: 1000 rows
                            return Promise.resolve({
                                data: new Array(1000).fill({ id: 'row' }),
                                error: null,
                            });
                        }
                        // Second page: less than 1000 (end of data)
                        return Promise.resolve({
                            data: [{ id: 'last' }],
                            error: null,
                        });
                    }),
                }),
                upsert: jest.fn().mockResolvedValue({ error: null }),
            });

            const originalOS = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

            const result = await SupabaseBackupService.exportBackup(true);
            expect(result.success).toBe(true);

            Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
        });

        it('throws on fetch error', async () => {
            mockFrom.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    range: jest.fn().mockResolvedValue({
                        data: null,
                        error: { message: 'network timeout' },
                    }),
                }),
            });

            await expect(SupabaseBackupService.exportBackup(true)).rejects.toThrow('network timeout');
        });

        it('shares on native when not silent', async () => {
            const originalOS = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

            const result = await SupabaseBackupService.exportBackup(false);
            expect(result.success).toBe(true);
            expect(Sharing.shareAsync).toHaveBeenCalled();

            Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
        });

        it('throws when sharing is not available', async () => {
            const originalOS = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
            (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);

            await expect(SupabaseBackupService.exportBackup(false)).rejects.toThrow('Sharing is not available');

            Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
        });
    });

    describe('importBackup', () => {
        const validBackupJson = JSON.stringify({
            version: 1,
            timestamp: Date.now(),
            data: {
                user_profiles: [{ id: '1', full_name: 'Test' }],
            },
        });
        const mockSafetyBackup = () =>
            jest.spyOn(SupabaseBackupService, 'exportBackup').mockResolvedValue({
                success: true,
                message: 'mocked safety backup',
            } as any);

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('returns cancelled when user cancels picker', async () => {
            const exportSpy = mockSafetyBackup();
            (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
                canceled: true,
            });

            const result = await SupabaseBackupService.importBackup();
            expect(result.success).toBe(false);
            expect(result.message).toContain('cancelled');
            expect(exportSpy).toHaveBeenCalledWith(true);
        });

        it('imports valid backup file on native', async () => {
            const originalOS = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
            const exportSpy = mockSafetyBackup();

            (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
                canceled: false,
                assets: [{ uri: 'file:///backup.json' }],
            });
            (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(validBackupJson);

            const result = await SupabaseBackupService.importBackup();
            expect(result.success).toBe(true);
            expect(exportSpy).toHaveBeenCalledWith(true);

            Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
        });

        it('imports valid backup file on web using file.text()', async () => {
            const originalOS = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
            const exportSpy = mockSafetyBackup();

            (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
                canceled: false,
                assets: [{
                    uri: 'blob:url',
                    file: { text: jest.fn().mockResolvedValue(validBackupJson) },
                }],
            });

            const result = await SupabaseBackupService.importBackup();
            expect(result.success).toBe(true);
            expect(exportSpy).toHaveBeenCalledWith(false);

            Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
        });

        it('imports via fetch on web when file object lacks text()', async () => {
            const originalOS = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
            const exportSpy = mockSafetyBackup();

            (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
                canceled: false,
                assets: [{ uri: 'blob:url', file: null }],
            });

            global.fetch = jest.fn().mockResolvedValue({
                text: jest.fn().mockResolvedValue(validBackupJson),
            }) as any;

            const result = await SupabaseBackupService.importBackup();
            expect(result.success).toBe(true);
            expect(exportSpy).toHaveBeenCalledWith(false);

            Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
        });

        it('throws on invalid backup format', async () => {
            const originalOS = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
            mockSafetyBackup();

            (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
                canceled: false,
                assets: [{ uri: 'file:///bad.json' }],
            });
            (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
                JSON.stringify({ version: 1 }) // Missing 'data' key
            );

            await expect(SupabaseBackupService.importBackup()).rejects.toEqual(expect.objectContaining({ message: expect.stringContaining('Invalid backup file format') }));

            Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
        });

        it('throws on upsert error during restore', async () => {
            const originalOS = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
            mockSafetyBackup();

            (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
                canceled: false,
                assets: [{ uri: 'file:///backup.json' }],
            });
            (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(validBackupJson);

            mockFrom.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    range: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
                upsert: jest.fn().mockResolvedValue({ error: { message: 'upsert failed' } }),
            });

            await expect(SupabaseBackupService.importBackup()).rejects.toEqual(expect.objectContaining({ message: expect.stringContaining('upsert failed') }));

            Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
        });

        it('reports progress during restore', async () => {
            const originalOS = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
            const exportSpy = mockSafetyBackup();

            (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
                canceled: false,
                assets: [{ uri: 'file:///backup.json' }],
            });
            (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(validBackupJson);

            const progressCallback = jest.fn();
            const result = await SupabaseBackupService.importBackup(progressCallback);
            expect(result.success).toBe(true);
            expect(progressCallback).toHaveBeenCalled();
            expect(exportSpy).toHaveBeenCalledWith(true);

            Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
        });
    });
});
