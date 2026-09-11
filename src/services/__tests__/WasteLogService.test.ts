import { WasteLogService, RecordWasteInput } from '../WasteLogService';
import { database } from '../../database';
import { JournalEntryService } from '../JournalEntryService';

jest.mock('../../database', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn().mockImplementation((cb) => cb()),
        collections: {
            get: jest.fn(),
        },
    },
}));

jest.mock('../JournalEntryService', () => {
    const fn = jest.fn().mockResolvedValue({ id: 'je-mock-001' });
    return {
        __esModule: true,
        createEntry: fn,
        JournalEntryService: {
            createEntry: fn,
        },
        default: {
            createEntry: fn,
        },
    };
});

describe('WasteLogService', () => {
    let mockWasteCollection: any;
    let mockStockMovementCollection: any;
    let mockJournalEntryCollection: any;
    let mockJournalLineCollection: any;
    let mockWasteLogs: any[];
    let mockStockMovements: any[];
    let mockJournalEntries: any[];

    beforeEach(() => {
        jest.clearAllMocks();
        mockWasteLogs = [];
        mockStockMovements = [];
        mockJournalEntries = [];

        mockWasteCollection = {
            create: jest.fn().mockImplementation((cb) => {
                const record: any = {
                    id: `wl-${Date.now()}`,
                    update: jest.fn().mockImplementation((updater) => {
                        updater(record);
                        return Promise.resolve(record);
                    }),
                };
                cb(record);
                mockWasteLogs.push(record);
                return record;
            }),
            query: jest.fn().mockReturnValue({
                fetch: jest.fn().mockImplementation(async () => mockWasteLogs),
            }),
        };

        mockStockMovementCollection = {
            create: jest.fn().mockImplementation((cb) => {
                const record: any = { id: `sm-${Date.now()}` };
                cb(record);
                mockStockMovements.push(record);
                return record;
            }),
            query: jest.fn().mockReturnValue({
                fetch: jest.fn().mockResolvedValue([
                    { quantityBalance: 50 },
                ]),
            }),
        };

        mockJournalEntryCollection = {
            create: jest.fn().mockImplementation((cb) => {
                const record: any = { id: `je-${Date.now()}` };
                cb(record);
                mockJournalEntries.push(record);
                return record;
            }),
        };

        mockJournalLineCollection = {
            create: jest.fn().mockImplementation((cb) => {
                const record: any = { id: `jel-${Date.now()}` };
                cb(record);
                return record;
            }),
        };

        (database.get as jest.Mock).mockImplementation((table: string) => {
            if (table === 'waste_logs') return mockWasteCollection;
            if (table === 'stock_movements') return mockStockMovementCollection;
            if (table === 'journal_entries') return mockJournalEntryCollection;
            if (table === 'journal_entry_lines') return mockJournalLineCollection;
            return {
                create: jest.fn().mockImplementation((cb) => {
                    const record: any = { id: `rec-${Date.now()}` };
                    cb(record);
                    return record;
                }),
                query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) }),
            };
        });
    });

    describe('recordWaste', () => {
        const sampleWaste: RecordWasteInput = {
            branchId: 'branch-bagacay',
            productId: 'ck-chicken-raw',
            productName: 'Raw Dressed Chicken',
            quantity: 3.5,
            uom: 'kg',
            reason: 'burnt_overcooked',
            unitCost: 140.0,
            recordedBy: 'crew-juan',
            notes: 'Batch #4 burned during fryer surge',
        };

        it('creates a waste log, deducts stock via StockMovement, and posts journal entry', async () => {
            const log = await WasteLogService.recordWaste(sampleWaste);

            expect(log).toBeDefined();
            expect(log.branchId).toBe('branch-bagacay');
            expect(log.productId).toBe('ck-chicken-raw');
            expect(log.quantity).toBe(3.5);
            expect(log.uom).toBe('kg');
            expect(log.reason).toBe('burnt_overcooked');
            // 3.5 * 140 = 490.00
            expect(log.totalCost).toBe(490.0);

            // Verify StockMovement creation
            expect(mockStockMovementCollection.create).toHaveBeenCalled();
            expect(mockStockMovements[0].movementType).toBe('adjustment');
            expect(mockStockMovements[0].quantityOut).toBe(3.5);
            expect(mockStockMovements[0].unitCost).toBe(140.0);
            expect(mockStockMovements[0].totalCost).toBe(490.0);

            // Verify Double-Entry Journal Entry
            expect(JournalEntryService.createEntry).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourceTable: 'waste_logs',
                    sourceId: log.id,
                    lines: [
                        expect.objectContaining({ accountCode: '5100', debitAmount: 490.0 }),
                        expect.objectContaining({ accountCode: '1200', creditAmount: 490.0 }),
                    ],
                }),
                'crew-juan'
            );
            expect(log.journalEntryId).toBe('je-mock-001');
        });

        it('throws error for non-positive quantity', async () => {
            await expect(
                WasteLogService.recordWaste({
                    ...sampleWaste,
                    quantity: 0,
                })
            ).rejects.toThrow('Waste quantity must be greater than zero');
        });
    });

    describe('getBranchWasteSummary', () => {
        it('aggregates total cost and breakdown by spoilage reason', async () => {
            mockWasteLogs.push(
                {
                    branchId: 'branch-bagacay',
                    reason: 'burnt_overcooked',
                    totalCost: 300.0,
                    logDate: new Date('2026-07-15').getTime(),
                    deletedAt: null,
                },
                {
                    branchId: 'branch-bagacay',
                    reason: 'burnt_overcooked',
                    totalCost: 150.0,
                    logDate: new Date('2026-07-16').getTime(),
                    deletedAt: null,
                },
                {
                    branchId: 'branch-bagacay',
                    reason: 'expired',
                    totalCost: 200.0,
                    logDate: new Date('2026-07-17').getTime(),
                    deletedAt: null,
                }
            );

            const summary = await WasteLogService.getBranchWasteSummary(
                'branch-bagacay',
                new Date('2026-07-01'),
                new Date('2026-07-31')
            );

            expect(summary.totalCost).toBe(650.0);
            expect(summary.totalCount).toBe(3);
            expect(summary.byReason['burnt_overcooked']).toBe(450.0);
            expect(summary.byReason['expired']).toBe(200.0);
        });
    });
});
