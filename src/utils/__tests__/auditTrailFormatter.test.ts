import {
    resolveOperator,
    formatEntityInfo,
    generateActionNarrative,
    formatFieldChanges,
    buildAuditExportData,
    OperatorInfo,
    EntityInfo
} from '../auditTrailFormatter';

describe('auditTrailFormatter', () => {
    describe('resolveOperator', () => {
        const userMap = new Map<string, { id: string; fullName: string; role: string; email: string }>([
            ['00000000-0000-0000-0000-000000000002', { id: '00000000-0000-0000-0000-000000000002', fullName: 'Cybergada Master', role: 'admin', email: 'cybergada@gmail.com' }],
            ['user-uuid-123', { id: 'user-uuid-123', fullName: 'Maria Santos', role: 'expenses_encoder', email: 'maria@poscursor.com' }]
        ]);

        it('resolves known seed admin user UUID', () => {
            const operator = resolveOperator('00000000-0000-0000-0000-000000000002', userMap);
            expect(operator.name).toBe('Cybergada Master');
            expect(operator.role).toBe('Admin');
            expect(operator.initials).toBe('CM');
        });

        it('resolves user from database userMap', () => {
            const operator = resolveOperator('user-uuid-123', userMap);
            expect(operator.name).toBe('Maria Santos');
            expect(operator.role).toBe('Expenses Encoder');
            expect(operator.initials).toBe('MS');
        });

        it('handles system automated action', () => {
            const operator = resolveOperator('system', userMap);
            expect(operator.name).toBe('System Automated Engine');
            expect(operator.role).toBe('System');
            expect(operator.initials).toBe('SY');
        });

        it('handles unknown UUID gracefully with formatted fallback', () => {
            const operator = resolveOperator('8f3c11e2-9b28-44d3-b248-123456789abc');
            expect(operator.name).toContain('User (8f3c11e2)');
            expect(operator.role).toBe('User');
        });

        it('handles empty or undefined user ID', () => {
            const operator = resolveOperator('');
            expect(operator.name).toBe('System Process');
            expect(operator.role).toBe('System');
        });
    });

    describe('formatEntityInfo', () => {
        it('formats feature_flags with descriptive title and module', () => {
            const info = formatEntityInfo(
                'feature_flags',
                'flag-agri-analytics',
                null,
                { name: 'Yield Analytics Board', is_enabled: true }
            );

            expect(info.entityName).toBe('Feature Flag');
            expect(info.module).toBe('System & Config');
            expect(info.title).toBe('Yield Analytics Board');
            expect(info.badgeColor).toBe('purple');
        });

        it('formats agri_parcels with parcel code, name and area', () => {
            const info = formatEntityInfo(
                'agri_parcels',
                'parcel-001',
                null,
                { code: 'PRC-014', name: 'Aloha Block 3', area_hectares: 3.5, location_address: 'Aloha, Marawi City' }
            );

            expect(info.entityName).toBe('Farm Parcel');
            expect(info.module).toBe('Agribusiness Operations');
            expect(info.title).toBe('Aloha Block 3 (PRC-014)');
            expect(info.subtitle).toBe('Area: 3.5 ha');
        });

        it('formats agri_crop_cycles with cycle code and crop', () => {
            const info = formatEntityInfo(
                'agri_crop_cycles',
                'cycle-001',
                null,
                { cycle_code: 'CYC-2026-01', crop_type: 'Cassava' }
            );

            expect(info.entityName).toBe('Crop Cycle');
            expect(info.title).toBe('Crop Cycle CYC-2026-01');
            expect(info.subtitle).toBe('Crop: Cassava');
        });

        it('formats agri_weekly_settlements with net payout due', () => {
            const info = formatEntityInfo(
                'agri_weekly_settlements',
                'set-001',
                null,
                { week_number: 6, net_payout_due_this_week: 48500 }
            );

            expect(info.entityName).toBe('Harvest Settlement');
            expect(info.title).toBe('Weekly Settlement #6');
            expect(info.subtitle).toContain('PHP 48,500.00');
        });

        it('formats agri_investors as a capital partner entry', () => {
            const info = formatEntityInfo(
                'agri_investors',
                'inv-001',
                null,
                { company_name: 'BioGreen Partners', contact_number: '09170001111' }
            );

            expect(info.entityName).toBe('Capital Partner');
            expect(info.module).toBe('Agribusiness Operations');
            expect(info.title).toBe('BioGreen Partners');
            expect(info.subtitle).toBe('Contact: 09170001111');
        });

        it('formats journal entries with reference number', () => {
            const info = formatEntityInfo(
                'journal_entries',
                'je-001',
                null,
                { description: 'Harvest offtake collection', reference_number: 'OR-AGR-001' }
            );

            expect(info.entityName).toBe('Journal Entry');
            expect(info.module).toBe('Accounting & Finance');
            expect(info.title).toBe('Harvest offtake collection');
            expect(info.subtitle).toBe('Ref #OR-AGR-001');
        });

        it('formats stock movements as farm input movements', () => {
            const info = formatEntityInfo(
                'stock_movements',
                'sm-1',
                null,
                { product_name: 'Fertilizer 14-14-14', quantity: 20, movement_type: 'inbound' }
            );

            expect(info.entityName).toBe('Stock Movement');
            expect(info.module).toBe('Farm Inputs & Supplies');
            expect(info.title).toContain('Fertilizer 14-14-14');
        });

        it('formats suppliers as an accounting contact', () => {
            const info = formatEntityInfo(
                'suppliers',
                'sup-1',
                null,
                { name: 'Agri Inputs Trading', phone: '09171234567' }
            );

            expect(info.entityName).toBe('Supplier');
            expect(info.title).toBe('Agri Inputs Trading');
            expect(info.subtitle).toBe('Contact: 09171234567');
        });

        it('formats unknown tables gracefully', () => {
            const info = formatEntityInfo('custom_table', 'custom-1', null, { title: 'Special Item' });
            expect(info.entityName).toBe('Custom Table');
            expect(info.module).toBe('General Operations');
            expect(info.title).toBe('Special Item');
        });

        it('no longer maps lending, POS, payroll or water-station tables to a business module', () => {
            ['loans', 'payments', 'borrowers', 'marketplace_orders', 'franchise_contracts', 'payroll_runs', 'ws_deliveries']
                .forEach(table => {
                    const info = formatEntityInfo(table, 'x-1', null, {});
                    expect(info.module).toBe('General Operations');
                });
        });
    });

    describe('generateActionNarrative', () => {
        it('generates clear summary for CREATE', () => {
            const narrative = generateActionNarrative(
                'CREATE',
                'agri_parcels',
                'p-1',
                null,
                { code: 'PRC-020', area_hectares: 2 }
            );
            expect(narrative).toContain('Created Farm Parcel');
            expect(narrative).toContain('PRC-020');
        });

        it('generates clear summary for UPDATE with changed values', () => {
            const narrative = generateActionNarrative(
                'UPDATE',
                'feature_flags',
                'f-1',
                { name: 'Yield Analytics Board', is_enabled: false },
                { name: 'Yield Analytics Board', is_enabled: true }
            );
            expect(narrative).toContain('Updated Feature Flag');
            expect(narrative.toLowerCase()).toContain('enabled');
        });

        it('generates clear summary for DELETE', () => {
            const narrative = generateActionNarrative(
                'DELETE',
                'expenses',
                'exp-1',
                { description: 'Fuel for haul truck', amount: 500 },
                null
            );
            expect(narrative).toContain('Deleted Expense');
            expect(narrative).toContain('Fuel for haul truck');
        });
    });

    describe('formatFieldChanges', () => {
        it('identifies and formats modified fields', () => {
            const oldData = { amount: 1000, is_active: false, _status: 'synced' };
            const newData = { amount: 1500, is_active: true, _status: 'updated' };

            const changes = formatFieldChanges(oldData, newData);
            expect(changes.length).toBe(2); // _status excluded

            const amountChange = changes.find(c => c.key === 'amount');
            expect(amountChange?.oldValueFormatted).toContain('PHP 1,000.00');
            expect(amountChange?.newValueFormatted).toContain('PHP 1,500.00');

            const statusChange = changes.find(c => c.key === 'is_active');
            expect(statusChange?.oldValueFormatted).toBe('No / Disabled');
            expect(statusChange?.newValueFormatted).toBe('Yes / Enabled');
        });
    });

    describe('buildAuditExportData', () => {
        it('generates CSV string with proper columns', () => {
            const logs = [
                {
                    id: 'log-1',
                    action: 'CREATE' as const,
                    entityType: 'agri_crop_cycles',
                    entityId: 'cycle-1',
                    performedBy: '00000000-0000-0000-0000-000000000002',
                    oldData: '',
                    newData: JSON.stringify({ cycle_code: 'CYC-001', crop_type: 'Cassava' }),
                    timestamp: 1773179200000,
                }
            ];

            const csv = buildAuditExportData(logs as any);
            expect(csv).toContain('Timestamp,Date & Time,Action,Module,Entity Type,Entity Title,Entity ID,Performed By,Role,Summary');
            expect(csv).toContain('CREATE');
            expect(csv).toContain('Cybergada Master');
            expect(csv).toContain('CYC-001');
        });
    });
});
