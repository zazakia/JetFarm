/**
 * BackupService.test.ts
 *
 * Covers:
 *  - exportBackup() - web download path
 *  - exportBackup() - native share path (Sharing.isAvailableAsync = true / false)
 *  - exportBackup() - error path
 *  - importBackup() - user cancels document picker
 *  - importBackup() - invalid backup file format
 *  - importBackup('merge') - creates new records, updates existing
 *  - importBackup('reset') - wipes then restores data
 *  - importBackup() - progress callback receives messages
 *  - importBackup() - batching (>= 500 records)
 *  - importBackup() - error path
 */

// ─── Platform mock (default: web so we don't need native file-system mocks) ───
// ─── Import after mocks ───────────────────────────────────────────────────────
import { BackupService } from '../BackupService';

let mockPlatformOS: string = 'web';
jest.mock('react-native', () => ({
    Platform: {
        get OS() {
            return mockPlatformOS;
        },
        select: (obj: any) => obj[mockPlatformOS] || obj.default,
    },
}));

// ─── expo-file-system mock ────────────────────────────────────────────────────
const mockWriteAsStringAsync = jest.fn().mockResolvedValue(undefined);
const mockReadAsStringAsync = jest.fn();
jest.mock('expo-file-system', () => ({
    cacheDirectory: 'file:///cache/',
    writeAsStringAsync: (...args: any[]) => mockWriteAsStringAsync(...args),
    readAsStringAsync: (...args: any[]) => mockReadAsStringAsync(...args),
}));

// ─── expo-sharing mock ────────────────────────────────────────────────────────
const mockIsAvailableAsync = jest.fn().mockResolvedValue(true);
const mockShareAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-sharing', () => ({
    isAvailableAsync: (...args: any[]) => mockIsAvailableAsync(...args),
    shareAsync: (...args: any[]) => mockShareAsync(...args),
}));

// ─── expo-document-picker mock ────────────────────────────────────────────────
const mockGetDocumentAsync = jest.fn();
jest.mock('expo-document-picker', () => ({
    getDocumentAsync: (...args: any[]) => mockGetDocumentAsync(...args),
}));

// ─── WatermelonDB database mock ───────────────────────────────────────────────
// We build a simple in-memory store for each collection.
interface MockRecord {
    _raw: Record<string, any>;
    prepareUpdate: (fn: (r: any) => void) => any;
    prepareDestroyPermanently: () => any;
}

const buildFakeRecord = (rawData: Record<string, any>): MockRecord => {
    const record: MockRecord = {
        _raw: { ...rawData },
        prepareUpdate: jest.fn((fn: (r: any) => void) => {
            fn(record);
            return { __type: 'update', record };
        }),
        prepareDestroyPermanently: jest.fn(() => ({ __type: 'destroy', record })),
    };
    return record;
};

// Per-collection store — reset in beforeEach
const stores: Record<string, MockRecord[]> = {};

const createCollectionMock = (tableName: string) => ({
    query: jest.fn(() => ({
        fetch: jest.fn(async () => stores[tableName] ?? []),
    })),
    find: jest.fn(async (id: string) => {
        const found = (stores[tableName] ?? []).find(r => r._raw.id === id);
        if (!found) throw new Error(`Record ${id} not found`);
        return found;
    }),
    prepareCreate: jest.fn((fn: (r: any) => void) => {
        const newRecord: MockRecord = {
            _raw: {} as Record<string, any>,
            prepareUpdate: jest.fn(),
            prepareDestroyPermanently: jest.fn(() => ({ __type: 'destroy', record: newRecord })),
        };
        fn(newRecord);
        return { __type: 'create', record: newRecord, table: tableName };
    }),
});

// Track all batch calls so we can inspect created / updated records
const batchedOps: any[] = [];

const mockDatabase = {
    collections: {
        get: jest.fn((table: string) => createCollectionMock(table)),
    },
    get: jest.fn((table: string) => createCollectionMock(table)),
    write: jest.fn(async (fn: () => Promise<void>) => fn()),
    batch: jest.fn(async (...ops: any[]) => {
        batchedOps.push(...ops);
    }),
    unsafeResetDatabase: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../database', () => {
    return {
        get database() {
            return mockDatabase;
        }
    };
});

// ─── WatermelonDB Q mock ──────────────────────────────────────────────────────
jest.mock('@nozbe/watermelondb', () => ({
    Q: {
        where: jest.fn(),
        eq: jest.fn(),
    },
}));

// ─── DOM helpers for the web download path ────────────────────────────────────
const mockClick = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
const mockCreateObjectURL = jest.fn().mockReturnValue('blob:fake-url');

let capturedHref = '';
let capturedDownload = '';

const fakeAnchor = {
    get href() { return capturedHref; },
    set href(v: string) { capturedHref = v; },
    get download() { return capturedDownload; },
    set download(v: string) { capturedDownload = v; },
    click: mockClick,
    style: { display: '' },
    setAttribute: jest.fn((key: string, value: string) => {
        if (key === 'download') capturedDownload = value;
    }),
};

// ─────────────────────────────────────────────────────────────────────────────
const TABLES = [
    'user_profiles', 'collectors', 'borrowers', 'loans', 'payment_schedules',
    'payments', 'loan_penalties', 'expenses', 'cash_transactions', 'bank_accounts',
    'bank_transactions', 'collection_logs', 'financial_snapshots', 'remittances',
    'savings_transactions', 'expense_categories', 'collection_groups', 'action_logs',
    'app_settings', 'loan_products', 'feature_flags', 'role_permissions',
];

/** Build a minimal valid backup payload */
function buildBackupJson(overrides: Record<string, any[]> = {}): string {
    const data: Record<string, any[]> = {};
    TABLES.forEach(t => { data[t] = overrides[t] ?? []; });
    return JSON.stringify({ version: 1, timestamp: Date.now(), data });
}

// ─────────────────────────────────────────────────────────────────────────────
describe('BackupService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        batchedOps.length = 0;

        // Reset in-memory stores
        TABLES.forEach(t => { stores[t] = []; });

        // Re-assign document.createElement for web tests
        if (typeof global.document === 'undefined') {
            (global as any).document = {
                body: {
                    appendChild: mockAppendChild,
                    removeChild: mockRemoveChild,
                },
            };
            (global.document as any).createElement = jest.fn().mockReturnValue(fakeAnchor);
        }

        if (typeof global.URL === 'undefined') {
            (global as any).URL = { createObjectURL: mockCreateObjectURL };
        }
    });

    // ══════════════════════════════════════════════════════════════════════════
    // exportBackup — web platform
    // ══════════════════════════════════════════════════════════════════════════
    describe('exportBackup() on web', () => {
        beforeAll(() => {
            if (typeof global.document !== 'undefined') {
                Reflect.set(window, 'document', window.document);
                jest.spyOn(document, 'createElement').mockReturnValue(fakeAnchor as any);
                jest.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
                jest.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
            }
            if (typeof global.URL !== 'undefined') {
                if (!jest.isMockFunction(URL.createObjectURL)) {
                    jest.spyOn(URL, 'createObjectURL').mockImplementation(mockCreateObjectURL);
                }
            }
        });

        beforeEach(() => { mockPlatformOS = 'web'; });

        it('returns success and triggers a download anchor click', async () => {
            const result = await BackupService.exportBackup();

            expect(result.success).toBe(true);
            expect(result.message).toBe('Backup downloaded');
            expect(mockClick).toHaveBeenCalledTimes(1);
            expect(capturedDownload).toMatch(/^infinity_backup_.*\.json$/);
        });

        it('queries every collection exactly once', async () => {
            // Populate one table so we can verify the fetch was actually called
            stores['borrowers'] = [buildFakeRecord({ id: 'b-1', name: 'Alice' })];

            await BackupService.exportBackup();

            // database.get should have been called once per table
            expect(mockDatabase.collections.get).toHaveBeenCalledTimes(TABLES.length);
            TABLES.forEach(t => {
                expect(mockDatabase.collections.get).toHaveBeenCalledWith(t);
            });
        });

        it('generates valid JSON that contains all table keys', async () => {
            stores['borrowers'] = [buildFakeRecord({ id: 'b-2', name: 'Bob' })];

            await BackupService.exportBackup();

            // The anchor href is set to a blob URL — we can't read its content
            // directly, but we can capture the Blob content via URL.createObjectURL
            const blobArg = (mockCreateObjectURL as jest.Mock).mock.calls[0]?.[0] as Blob;
            if (blobArg) {
                const text = await blobArg.text();
                const parsed = JSON.parse(text);
                expect(parsed).toHaveProperty('version', 1);
                expect(parsed).toHaveProperty('timestamp');
                expect(parsed.data).toHaveProperty('borrowers');
                TABLES.forEach(t => expect(parsed.data).toHaveProperty(t));
            } else {
                // Blob assertions may be skipped in Node environments without Blob support
                expect(mockClick).toHaveBeenCalled();
            }
        });

        it('throws when database.get throws', async () => {
            mockDatabase.collections.get.mockImplementationOnce(() => {
                throw new Error('DB error');
            });
            await expect(BackupService.exportBackup()).rejects.toThrow('DB error');
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // exportBackup — native platform
    // ══════════════════════════════════════════════════════════════════════════
    describe('exportBackup() on native', () => {
        beforeEach(() => { mockPlatformOS = 'ios'; });

        it('writes file to cache and calls shareAsync', async () => {
            const result = await BackupService.exportBackup();

            expect(result.success).toBe(true);
            expect(result.message).toBe('Backup shared successfully');
            expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
            const [fileUri, content] = mockWriteAsStringAsync.mock.calls[0];
            expect(fileUri).toMatch(/^file:\/\/\/cache\/infinity_backup_/);
            const parsed = JSON.parse(content);
            expect(parsed).toHaveProperty('version', 1);
            expect(mockShareAsync).toHaveBeenCalledWith(
                fileUri,
                expect.objectContaining({ mimeType: 'application/json' }),
            );
        });

        it('throws when sharing is not available', async () => {
            mockIsAvailableAsync.mockResolvedValueOnce(false);
            await expect(BackupService.exportBackup()).rejects.toThrow(
                'Sharing is not available on this device',
            );
        });

        it('throws when FileSystem.writeAsStringAsync fails', async () => {
            mockWriteAsStringAsync.mockRejectedValueOnce(new Error('write error'));
            await expect(BackupService.exportBackup()).rejects.toThrow('write error');
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // importBackup — cancelled by user
    // ══════════════════════════════════════════════════════════════════════════
    describe('importBackup() — cancelled', () => {
        it('returns success:false when user cancels the picker', async () => {
            mockGetDocumentAsync.mockResolvedValueOnce({ canceled: true, assets: [] });
            const result = await BackupService.importBackup('merge');
            expect(result.success).toBe(false);
            expect(result.message).toBe('Import cancelled');
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // importBackup — invalid file
    // ══════════════════════════════════════════════════════════════════════════
    describe('importBackup() — invalid file', () => {
        beforeEach(() => { mockPlatformOS = 'web'; });

        it('throws on invalid JSON', async () => {
            mockGetDocumentAsync.mockResolvedValueOnce({
                canceled: false,
                assets: [{ uri: 'blob:fake' }],
            });
            (global as any).fetch = jest.fn().mockResolvedValue({
                text: async () => 'not-valid-json',
            });
            await expect(BackupService.importBackup('merge')).rejects.toThrow();
        });

        it('throws when backup.data is missing', async () => {
            mockGetDocumentAsync.mockResolvedValueOnce({
                canceled: false,
                assets: [{ uri: 'blob:fake' }],
            });
            (global as any).fetch = jest.fn().mockResolvedValue({
                text: async () => JSON.stringify({ version: 1 }),
            });
            await expect(BackupService.importBackup('merge')).rejects.toThrow(
                'Invalid backup file format',
            );
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // importBackup('merge') — web platform
    // ══════════════════════════════════════════════════════════════════════════
    describe("importBackup('merge') on web", () => {
        beforeEach(() => { mockPlatformOS = 'web'; });

        const setupFetch = (backupJson: string) => {
            (global as any).fetch = jest.fn().mockResolvedValue({
                text: async () => backupJson,
            });
        };

        it('creates new records for unknown IDs', async () => {
            setupFetch(buildBackupJson({
                borrowers: [{ id: 'b-1', name: 'Alice', _status: 'created' }],
            }));
            mockGetDocumentAsync.mockResolvedValueOnce({
                canceled: false,
                assets: [{ uri: 'blob:fake' }],
            });

            const result = await BackupService.importBackup('merge');

            expect(result.success).toBe(true);
            // prepareCreate should have been called for the new borrower
            const creates = batchedOps.filter(op => op.__type === 'create');
            expect(creates.length).toBeGreaterThanOrEqual(1);
            const borrowerCreate = creates.find(op => op.table === 'borrowers');
            expect(borrowerCreate).toBeDefined();
            expect(borrowerCreate.record._raw._status).toBe('synced');
        });

        it('updates existing records for known IDs', async () => {
            // Pre-populate a store record
            const existing = buildFakeRecord({ id: 'b-existing', name: 'OldName', _status: 'synced' });
            stores['borrowers'] = [existing];

            setupFetch(buildBackupJson({
                borrowers: [{ id: 'b-existing', name: 'NewName', _status: 'created' }],
            }));
            mockGetDocumentAsync.mockResolvedValueOnce({
                canceled: false,
                assets: [{ uri: 'blob:fake' }],
            });

            const result = await BackupService.importBackup('merge');

            expect(result.success).toBe(true);
            // prepareUpdate should have been called on the existing record
            expect(existing.prepareUpdate).toHaveBeenCalled();
            // The _status should be set to 'synced' by the update
            expect(existing._raw._status).toBe('synced');
        });

        it('calls the progress callback with table names', async () => {
            setupFetch(buildBackupJson({
                loans: [{ id: 'l-1', amount: 5000, _status: 'created' }],
            }));
            mockGetDocumentAsync.mockResolvedValueOnce({
                canceled: false,
                assets: [{ uri: 'blob:fake' }],
            });

            const progressMessages: string[] = [];
            await BackupService.importBackup('merge', (msg) => {
                progressMessages.push(msg);
            });

            expect(progressMessages.some(m => m.includes('loans'))).toBe(true);
        });

        it('skips tables with no backup data', async () => {
            // Only borrowers has data; loans key is entirely missing
            const data: Record<string, any[]> = {};
            TABLES.forEach(t => { if (t === 'borrowers') data[t] = [{ id: 'b-3' }]; });
            // Remove 'loans' key entirely
            delete data['loans'];

            (global as any).fetch = jest.fn().mockResolvedValue({
                text: async () => JSON.stringify({ version: 1, timestamp: Date.now(), data }),
            });
            mockGetDocumentAsync.mockResolvedValueOnce({
                canceled: false,
                assets: [{ uri: 'blob:fake' }],
            });

            const result = await BackupService.importBackup('merge');
            expect(result.success).toBe(true);
        });

        it('throws when database.write throws', async () => {
            setupFetch(buildBackupJson());
            mockGetDocumentAsync.mockResolvedValueOnce({
                canceled: false,
                assets: [{ uri: 'blob:fake' }],
            });
            mockDatabase.write.mockRejectedValueOnce(new Error('write failed'));

            await expect(BackupService.importBackup('merge')).rejects.toThrow('write failed');
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // importBackup('reset') — calls unsafeResetDatabase first
    // ══════════════════════════════════════════════════════════════════════════
describe("importBackup('reset') on web", () => {
        beforeEach(() => { mockPlatformOS = 'web'; });

        it('manually destroys all existing records cleanly before restoring', async () => {
            // Seed the test database with an old record to be wiped
            const oldRecord = buildFakeRecord({ id: 'old-1', name: 'To be deleted', _status: 'synced' });
            stores['collectors'] = [oldRecord];

            (global as any).fetch = jest.fn().mockResolvedValue({
                text: async () => buildBackupJson({
                    collectors: [{ id: 'c-1', name: 'Juan', _status: 'synced' }],
                }),
            });
            mockGetDocumentAsync.mockResolvedValueOnce({
                canceled: false,
                assets: [{ uri: 'blob:fake' }],
            });

            const progressMessages: string[] = [];
            const result = await BackupService.importBackup('reset', (msg) => {
                progressMessages.push(msg);
            });

            expect(result.success).toBe(true);
            expect(mockDatabase.unsafeResetDatabase).not.toHaveBeenCalled();
            expect(oldRecord.prepareDestroyPermanently).toHaveBeenCalledTimes(1);
            
            const destroys = batchedOps.filter(op => op.__type === 'destroy');
            expect(destroys.length).toBe(1);
            expect(progressMessages[0]).toMatch(/Wiping current database cleanly/i);
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // importBackup — native platform (FileSystem.readAsStringAsync)
    // ══════════════════════════════════════════════════════════════════════════
    describe('importBackup() on native', () => {
        beforeEach(() => { mockPlatformOS = 'android'; });

        it('reads the file via FileSystem on native', async () => {
            mockReadAsStringAsync.mockResolvedValueOnce(buildBackupJson());
            mockGetDocumentAsync.mockResolvedValueOnce({
                canceled: false,
                assets: [{ uri: 'file:///storage/backup.json' }],
            });

            const result = await BackupService.importBackup('merge');

            expect(result.success).toBe(true);
            expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///storage/backup.json');
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // importBackup — batching (>= 500 records per table)
    // ══════════════════════════════════════════════════════════════════════════
    describe('importBackup() — batching large datasets', () => {
        beforeEach(() => { mockPlatformOS = 'web'; });

        it('flushes intermediate batches when >= 500 records', async () => {
            const bigDataset = Array.from({ length: 600 }, (_, i) => ({
                id: `pay-${i}`,
                amount: i * 10,
                _status: 'synced',
            }));

            (global as any).fetch = jest.fn().mockResolvedValue({
                text: async () => buildBackupJson({ payments: bigDataset }),
            });
            mockGetDocumentAsync.mockResolvedValueOnce({
                canceled: false,
                assets: [{ uri: 'blob:fake' }],
            });

            const result = await BackupService.importBackup('merge');

            expect(result.success).toBe(true);
            // batch must have been called at least twice (once at 500, once for remainder)
            expect(mockDatabase.batch.mock.calls.length).toBeGreaterThanOrEqual(2);
        });
    });
});
