import { SyncService, deterministicUuid } from '../SyncService';
import syncTableContract from '../syncTableContract.json';

jest.mock('@nozbe/watermelondb/sync', () => ({
    synchronize: jest.fn(),
}));

jest.mock('../../database', () => ({
    database: {},
}));

jest.mock('../../database/supabase', () => ({
    supabase: {},
    withTimeout: jest.fn((promise: Promise<unknown>) => Promise.resolve(promise)),
}));

jest.mock('../../stores/syncStore', () => ({
    useSyncStore: {
        getState: jest.fn(() => ({
            setSyncProgress: jest.fn(),
            addLog: jest.fn(),
        })),
        setState: jest.fn(),
    },
}));

jest.mock('../ErrorService', () => ({
    ErrorService: {
        handleError: jest.fn((error: any, context?: string, defaultType: any = 'sync') => ({
            type: defaultType,
            message: error?.message || String(error),
            originalError: error,
            context,
        })),
    },
    ErrorType: { SYNC: 'sync' },
}));

describe('SyncService Push Integrity & Sanitization Tests', () => {
    let service: SyncService;
    let mockSupabase: any;

    beforeEach(() => {
        mockSupabase = {
            from: jest.fn(),
        };
        service = new SyncService({} as any, mockSupabase, {
            beginSession: jest.fn(),
            startAttempt: jest.fn(),
            record: jest.fn(),
            recordFailure: jest.fn(),
            completeSession: jest.fn(),
            failSession: jest.fn(),
        } as any);
    });

    test('syncTableContract ensures journal_entries precedes journal_entry_lines in coreTables', () => {
        const jeIndex = syncTableContract.coreTables.indexOf('journal_entries');
        const jelIndex = syncTableContract.coreTables.indexOf('journal_entry_lines');
        expect(jeIndex).toBeGreaterThan(-1);
        expect(jelIndex).toBeGreaterThan(-1);
        expect(jeIndex).toBeLessThan(jelIndex);
    });

    describe('sanitizeRecord normalizations', () => {
        test('preserves text module_id for business_units and does not nullify it', () => {
            const raw = {
                id: '00000000-0000-4000-8000-000000000001',
                name: 'Tayasan Branch',
                slug: 'ck-tayasan',
                module_id: 'crispy-king',
                is_active: true,
                created_at: 1773000000000,
                updated_at: 1773000000000,
            };
            const sanitized = (service as any).sanitizeRecord(raw, 'business_units');
            expect(sanitized.module_id).toBe('crispy-king');
        });

        test('defaults missing module_id on business_units to crispy-king', () => {
            const raw = {
                id: '00000000-0000-4000-8000-000000000002',
                name: 'Main Branch',
                slug: 'ck-main',
                module_id: '',
            };
            const sanitized = (service as any).sanitizeRecord(raw, 'business_units');
            expect(sanitized.module_id).toBe('crispy-king');
        });

        test('converts non-UUID buyer_id on marketplace_orders to deterministic UUID', () => {
            const raw = {
                id: '00000000-0000-4000-8000-000000000003',
                buyer_id: 'branch-bagacay',
                order_number: 'ORD-2026-001',
                total_amount: 150,
            };
            const sanitized = (service as any).sanitizeRecord(raw, 'marketplace_orders');
            expect(SyncService.UUID_REGEX.test(sanitized.buyer_id)).toBe(true);
            expect(sanitized.buyer_id).toBe(deterministicUuid('buyer-branch-bagacay'));
        });

        test('maps menu product code on marketplace_order_items to canonical UUID', () => {
            const raw = {
                id: '00000000-0000-4000-8000-000000000004',
                sub_order_id: '00000000-0000-4000-8000-000000000003',
                product_id: 'ck-scut',
                quantity: 2,
                unit_price: 50,
            };
            const sanitized = (service as any).sanitizeRecord(raw, 'marketplace_order_items');
            expect(SyncService.UUID_REGEX.test(sanitized.product_id)).toBe(true);
            expect(sanitized.product_id).toBe(deterministicUuid('prod-CK-SCUT'));
        });

        test('converts non-UUID sub_order_id on marketplace_order_items to deterministic UUID', () => {
            const raw = {
                id: '00000000-0000-4000-8000-000000000005',
                sub_order_id: 'legacy-suborder-1',
                product_id: '00000000-0000-4000-8000-1f961abe1f96',
                quantity: 1,
            };
            const sanitized = (service as any).sanitizeRecord(raw, 'marketplace_order_items');
            expect(SyncService.UUID_REGEX.test(sanitized.sub_order_id)).toBe(true);
            expect(sanitized.sub_order_id).toBe(deterministicUuid('suborder-legacy-suborder-1'));
        });

        test('nullifies invalid source_id UUID on journal_entries', () => {
            const raw = {
                id: '00000000-0000-4000-8000-000000000006',
                reference_number: 'JE-2026-000001',
                source_id: 'non-uuid-source-id',
            };
            const sanitized = (service as any).sanitizeRecord(raw, 'journal_entries');
            expect(sanitized.source_id).toBeNull();
        });

        test('normalizes camelCase properties for business_units, marketplace_orders, marketplace_order_items, journal_entries, and journal_entry_lines', () => {
            // business_units camelCase
            const bu = (service as any).sanitizeRecord({
                id: '00000000-0000-4000-8000-0000000000b1',
                moduleId: 'crispy-king',
                isActive: true,
                areaId: '00000000-0000-4000-8000-0000000000a1',
                areaSupervisorId: 'user-001',
            }, 'business_units');
            expect(bu.module_id).toBe('crispy-king');
            expect(bu.is_active).toBe(true);
            expect(bu.area_id).toBe('00000000-0000-4000-8000-0000000000a1');
            expect(bu.area_supervisor_id).toBe('user-001');
            expect(bu.moduleId).toBeUndefined();

            // marketplace_orders camelCase
            const mo = (service as any).sanitizeRecord({
                id: '00000000-0000-4000-8000-0000000000m1',
                buyerId: 'user-borrower-01',
                orderNumber: 'ORD-101',
                totalAmount: 250,
                paymentMethod: 'cash',
                paymentStatus: 'paid',
            }, 'marketplace_orders');
            expect(SyncService.UUID_REGEX.test(mo.buyer_id)).toBe(true);
            expect(mo.order_number).toBe('ORD-101');
            expect(mo.total_amount).toBe(250);
            expect(mo.payment_method).toBe('cash');
            expect(mo.payment_status).toBe('paid');
            expect(mo.buyerId).toBeUndefined();

            // marketplace_order_items camelCase
            const moi = (service as any).sanitizeRecord({
                id: '00000000-0000-4000-8000-0000000000e1',
                subOrderId: 'sub-001',
                productId: 'ck-scut',
                unitPrice: 50,
                totalPrice: 100,
            }, 'marketplace_order_items');
            expect(SyncService.UUID_REGEX.test(moi.product_id)).toBe(true);
            expect(SyncService.UUID_REGEX.test(moi.sub_order_id)).toBe(true);
            expect(moi.unit_price).toBe(50);
            expect(moi.total_price).toBe(100);
            expect(moi.productId).toBeUndefined();

            // journal_entries camelCase
            const je = (service as any).sanitizeRecord({
                id: '00000000-0000-4000-8000-0000000000f1',
                referenceNumber: 'JE-2026-000005',
                entryType: 'auto',
                isPosted: true,
                totalDebit: 500,
                totalCredit: 500,
            }, 'journal_entries');
            expect(je.reference_number).toBe('JE-2026-000005');
            expect(je.entry_type).toBe('auto');
            expect(je.is_posted).toBe(true);
            expect(je.total_debit).toBe(500);
            expect(je.total_credit).toBe(500);
            expect(je.referenceNumber).toBeUndefined();

            // journal_entry_lines camelCase
            const jel = (service as any).sanitizeRecord({
                id: '00000000-0000-4000-8000-0000000000f2',
                journalEntryId: '00000000-0000-4000-8000-0000000000f1',
                accountCode: '1010',
                accountName: 'Cash on Hand',
                debitAmount: 500,
                creditAmount: 0,
            }, 'journal_entry_lines');
            expect(jel.journal_entry_id).toBe('00000000-0000-4000-8000-0000000000f1');
            expect(jel.account_code).toBe('1010');
            expect(jel.account_name).toBe('Cash on Hand');
            expect(jel.debit_amount).toBe(500);
            expect(jel.credit_amount).toBe(0);
            expect(jel.journalEntryId).toBeUndefined();
        });
    });

    describe('two-phase double-entry journal posting flow', () => {
        test('pushes journal_entries with is_posted: false then updates to is_posted: true after lines push', async () => {
            const jeId = '00000000-0000-4000-8000-000000000010';
            const lineId = '00000000-0000-4000-8000-000000000011';

            const upsertCalls: Record<string, any[]> = {};
            const updateCalls: Record<string, any> = {};

            mockSupabase.from.mockImplementation((tableName: string) => {
                const builder: any = {
                    upsert: jest.fn().mockImplementation((rows: any[]) => {
                        upsertCalls[tableName] = rows;
                        return Promise.resolve({ data: rows, error: null });
                    }),
                    update: jest.fn().mockImplementation((fields: any) => {
                        return {
                            in: jest.fn().mockImplementation((field: string, ids: string[]) => {
                                updateCalls[tableName] = { fields, field, ids };
                                return Promise.resolve({ data: [], error: null });
                            }),
                            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
                        };
                    }),
                    select: jest.fn().mockImplementation((columns: string) => ({
                        in: jest.fn().mockImplementation((field: string, ids: string[]) => {
                            // If querying journal_entry_lines, return 2 lines for jeId so it is eligible to be posted
                            if (tableName === 'journal_entry_lines') {
                                return Promise.resolve({
                                    data: [
                                        { journal_entry_id: jeId, deleted_at: null },
                                        { journal_entry_id: jeId, deleted_at: null },
                                    ],
                                    error: null,
                                });
                            }
                            return Promise.resolve({ data: [], error: null });
                        }),
                    })),
                };
                return builder;
            });

            const changes = {
                journal_entries: {
                    created: [
                        {
                            id: jeId,
                            reference_number: 'JE-2026-000005',
                            is_posted: true,
                            total_debit: 100,
                            total_credit: 100,
                        },
                    ],
                    updated: [],
                    deleted: [],
                },
                journal_entry_lines: {
                    created: [
                        {
                            id: lineId,
                            journal_entry_id: jeId,
                            account_code: '1010',
                            debit_amount: 100,
                            credit_amount: 0,
                        },
                        {
                            id: '00000000-0000-4000-8000-000000000012',
                            journal_entry_id: jeId,
                            account_code: '2010',
                            debit_amount: 0,
                            credit_amount: 100,
                        },
                    ],
                    updated: [],
                    deleted: [],
                },
            };

            await (service as any).pushChangesToSupabase(changes);

            expect(upsertCalls['journal_entries']).toBeDefined();
            expect(upsertCalls['journal_entries'][0].id).toBe(jeId);
            expect(upsertCalls['journal_entries'][0].is_posted).toBe(false);

            expect(upsertCalls['journal_entry_lines']).toBeDefined();
            expect(upsertCalls['journal_entry_lines'][0].id).toBe(lineId);

            expect(updateCalls['journal_entries']).toBeDefined();
            expect(updateCalls['journal_entries'].fields).toEqual({ is_posted: true });
            expect(updateCalls['journal_entries'].ids).toEqual([jeId]);
        });

        test('leaves journal_entries with 0 lines as unposted drafts without throwing trigger error', async () => {
            const orphanJeId = '00000000-0000-4000-8000-000000000020';
            const updateCalls: Record<string, any> = {};

            mockSupabase.from.mockImplementation((tableName: string) => ({
                upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
                update: jest.fn().mockImplementation((fields: any) => ({
                    in: jest.fn().mockImplementation((field: string, ids: string[]) => {
                        updateCalls[tableName] = { fields, field, ids };
                        return Promise.resolve({ data: [], error: null });
                    }),
                })),
                select: jest.fn().mockReturnValue({
                    in: jest.fn().mockResolvedValue({ data: [], error: null }), // 0 lines returned
                }),
            }));

            const changes = {
                journal_entries: {
                    created: [
                        {
                            id: orphanJeId,
                            reference_number: 'JE-2026-000005',
                            is_posted: true,
                        },
                    ],
                    updated: [],
                    deleted: [],
                },
            };

            // Should complete cleanly without error
            await expect((service as any).pushChangesToSupabase(changes)).resolves.not.toThrow();
            // Should NOT have attempted to update the orphan entry to is_posted: true
            expect(updateCalls['journal_entries']).toBeUndefined();
        });
    });
});
