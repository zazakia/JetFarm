import { SyncService, SYNC_TABLES } from '../SyncService';
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

        // Push order is derived from SYNC_TABLES (the array fetch/push iterate), not from the
        // raw JSON, so the two-phase posting contract requires the derived order to match.
        expect(SYNC_TABLES.indexOf('journal_entries'))
            .toBeLessThan(SYNC_TABLES.indexOf('journal_entry_lines'));

        // Both must stay required core tables: as optional config tables a missing remote
        // table would be skipped instead of failing the cycle, and the ledger would silently
        // advance its watermark past unposted entries.
        expect(syncTableContract.configTables).not.toContain('journal_entries');
        expect(syncTableContract.configTables).not.toContain('journal_entry_lines');
        expect(syncTableContract.localOnlyTables).not.toContain('journal_entries');
        expect(syncTableContract.localOnlyTables).not.toContain('journal_entry_lines');
    });

    // Stage 8 of the agribusiness-only teardown pruned the sync contract from 91 to 39 tables.
    // This pins that the deleted domains cannot re-enter the sync surface by name.
    test('no retired non-agribusiness table name appears in the sync contract', () => {
        const retiredTables = [
            'loans', 'payments', 'borrowers', 'collectors', 'collection_logs', 'collection_groups',
            'children', 'dependents', 'guarantors', 'file_cases', 'loan_applications', 'loan_penalties',
            'loan_products', 'payment_schedules', 'remittances', 'savings_transactions',
            'share_capital_transactions', 'board_resolutions', 'committees', 'committee_members',
            'meeting_attendance', 'marketplace_orders', 'marketplace_order_items', 'marketplace_sub_orders',
            'marketplace_products', 'marketplace_categories', 'marketplace_stores', 'marketplace_payouts',
            'marketplace_promotions', 'marketplace_reviews', 'marketplace_disputes',
            'payrolls', 'payroll_lines', 'employees', 'employee_leaves', 'payroll_runs',
            'franchise_contracts', 'franchise_royalty_ledger', 'royalty_calculations', 'store_audits',
            'commissary_dispatches', 'waste_logs', 'sales_returns', 'sales_return_lines', 'pos_sessions',
            'device_registry', 'module_transactions',
            'ws_containers', 'ws_customers', 'ws_deliveries', 'ws_expenses', 'ws_payments',
        ];

        const localNames = Object.keys(syncTableContract.remoteTableMap);
        const remoteNames = Object.values(syncTableContract.remoteTableMap);
        const allContractTables = [
            ...syncTableContract.coreTables,
            ...syncTableContract.configTables,
            ...syncTableContract.localOnlyTables,
            ...syncTableContract.apiOnlyTables,
        ];

        for (const retired of retiredTables) {
            expect(localNames).not.toContain(retired);
            expect(remoteNames).not.toContain(retired);
            // the retired domains were also published under the app_* remote prefix
            expect(remoteNames).not.toContain(`app_${retired}`);
            expect(allContractTables).not.toContain(retired);
        }

        // The pruned contract is exactly the 39 synced tables of schema v50; the one local-only
        // table stays out of the remote map and no API-only table has been smuggled back in.
        expect(localNames).toHaveLength(39);
        const expectedRemoteTables = allContractTables.filter(
            tableName => !syncTableContract.localOnlyTables.includes(tableName)
        );
        expect(new Set(localNames)).toEqual(new Set(expectedRemoteTables));
        expect(syncTableContract.localOnlyTables).toEqual(['agri_pending_layout_operations']);
        expect(syncTableContract.apiOnlyTables).toEqual([]);
    });

    describe('sanitizeRecord normalizations', () => {
        test('preserves text module_id for business_units and does not nullify it', () => {
            const raw = {
                id: '00000000-0000-4000-8000-000000000001',
                name: 'Tayasan Branch',
                slug: 'agri-tayasan',
                module_id: 'agri-block-layout',
                is_active: true,
                created_at: 1773000000000,
                updated_at: 1773000000000,
            };
            const sanitized = (service as any).sanitizeRecord(raw, 'business_units');
            expect(sanitized.module_id).toBe('agri-block-layout');
        });

        // Deleted 2026-10-20 (agribusiness-only teardown, Stage 8):
        //  - 'defaults missing module_id on business_units to crispy-king' - the crispy-king
        //    franchise menu default is retired domain vocabulary; the surviving table keeps a
        //    plain text module_id and no longer synthesises a QSR tenant.
        //  - 'converts non-UUID buyer_id on marketplace_orders to deterministic UUID'
        //  - 'maps menu product code on marketplace_order_items to canonical UUID'
        //  - 'converts non-UUID sub_order_id on marketplace_order_items to deterministic UUID'
        // The marketplace_* tables and their deterministic-UUID fallbacks were deleted with the
        // marketplace domain, and no surviving table has a mandatory client-synthesised UUID FK,
        // so the sanitizer nullifies invalid referents instead (covered by the nullify tests in
        // SyncService.test.ts).

        test('nullifies invalid source_id UUID on journal_entries', () => {
            const raw = {
                id: '00000000-0000-4000-8000-000000000006',
                reference_number: 'JE-2026-000001',
                source_id: 'non-uuid-source-id',
            };
            const sanitized = (service as any).sanitizeRecord(raw, 'journal_entries');
            expect(sanitized.source_id).toBeNull();
        });

        // Retargeted 2026-10-20: the marketplace_orders / marketplace_order_items camelCase
        // blocks were dropped with those tables; the surviving camelCase -> snake_case
        // normalizers are business_units, journal_entries and journal_entry_lines.
        test('normalizes camelCase properties for business_units, journal_entries, and journal_entry_lines', () => {
            // business_units camelCase
            const bu = (service as any).sanitizeRecord({
                id: '00000000-0000-4000-8000-0000000000b1',
                moduleId: 'agri-block-layout',
                isActive: true,
                areaId: '00000000-0000-4000-8000-0000000000a1',
                areaSupervisorId: 'user-001',
            }, 'business_units');
            expect(bu.module_id).toBe('agri-block-layout');
            expect(bu.is_active).toBe(true);
            expect(bu.area_id).toBe('00000000-0000-4000-8000-0000000000a1');
            expect(bu.area_supervisor_id).toBe('user-001');
            expect(bu.moduleId).toBeUndefined();

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
