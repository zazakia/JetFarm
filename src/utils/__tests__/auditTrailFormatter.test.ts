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
            ['user-uuid-123', { id: 'user-uuid-123', fullName: 'Maria Santos', role: 'collector', email: 'maria@poscursor.com' }]
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
            expect(operator.role).toBe('Collector');
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
                'feature-pos-terminal-v2',
                null,
                { name: 'Touch POS Terminal', is_enabled: true }
            );

            expect(info.entityName).toBe('Feature Flag');
            expect(info.module).toBe('System & Config');
            expect(info.title).toBe('Touch POS Terminal');
            expect(info.badgeColor).toBe('purple');
        });

        it('formats loans with loan number and borrower name', () => {
            const info = formatEntityInfo(
                'loans',
                'loan-001',
                null,
                { loan_number: 'LN-2026-001', total_amount: 15000, borrower_name: 'Juan Dela Cruz' }
            );

            expect(info.entityName).toBe('Loan Account');
            expect(info.module).toBe('Lending & Loans');
            expect(info.title).toBe('Loan #LN-2026-001 • Juan Dela Cruz');
            expect(info.badgeColor).toBe('blue');
        });

        it('formats payments with amount', () => {
            const info = formatEntityInfo(
                'payments',
                'pay-001',
                null,
                { amount: 1500, reference_number: 'OR-88231', payment_method: 'cash' }
            );

            expect(info.entityName).toBe('Payment Entry');
            expect(info.module).toBe('Lending & Loans');
            expect(info.title).toContain('PHP 1,500.00');
        });

        it('formats products with product name', () => {
            const info = formatEntityInfo(
                'marketplace_products',
                'prod-1',
                null,
                { name: '1-pc Crispy Fried Chicken', price: 75 }
            );

            expect(info.entityName).toBe('Product');
            expect(info.module).toBe('Crispy King POS');
            expect(info.title).toBe('1-pc Crispy Fried Chicken');
        });

        it('formats sales orders with order reference and total', () => {
            const info = formatEntityInfo(
                'marketplace_orders',
                'ord-500',
                null,
                { order_number: 'CK-1092', total_amount: 450 }
            );

            expect(info.entityName).toBe('POS Sales Order');
            expect(info.module).toBe('Crispy King POS');
            expect(info.title).toContain('CK-1092');
        });

        it('formats stock movements with stock type and quantity', () => {
            const info = formatEntityInfo(
                'stock_movements',
                'sm-1',
                null,
                { product_name: 'Marinated Wings', quantity: 20, movement_type: 'inbound' }
            );

            expect(info.entityName).toBe('Stock Movement');
            expect(info.module).toBe('Inventory & Bodega');
            expect(info.title).toContain('Marinated Wings');
        });

        it('formats unknown tables gracefully', () => {
            const info = formatEntityInfo('custom_table', 'custom-1', null, { title: 'Special Item' });
            expect(info.entityName).toBe('Custom Table');
            expect(info.title).toBe('Special Item');
        });
    });

    describe('generateActionNarrative', () => {
        it('generates clear summary for CREATE', () => {
            const narrative = generateActionNarrative(
                'CREATE',
                'loans',
                'l-1',
                null,
                { loan_number: 'LN-100', principal_amount: 10000, borrower_name: 'Ana Cruz' }
            );
            expect(narrative).toContain('Created Loan Account');
            expect(narrative).toContain('LN-100');
        });

        it('generates clear summary for UPDATE with changed values', () => {
            const narrative = generateActionNarrative(
                'UPDATE',
                'feature_flags',
                'f-1',
                { name: 'Touch POS', is_enabled: false },
                { name: 'Touch POS', is_enabled: true }
            );
            expect(narrative).toContain('Updated Feature Flag');
            expect(narrative.toLowerCase()).toContain('enabled');
        });

        it('generates clear summary for DELETE', () => {
            const narrative = generateActionNarrative(
                'DELETE',
                'expenses',
                'exp-1',
                { description: 'Office Supplies', amount: 500 },
                null
            );
            expect(narrative).toContain('Deleted Store Expense');
            expect(narrative).toContain('Office Supplies');
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
                    entityType: 'loans',
                    entityId: 'loan-1',
                    performedBy: '00000000-0000-0000-0000-000000000002',
                    oldData: '',
                    newData: JSON.stringify({ loan_number: 'LN-001', amount: 5000 }),
                    timestamp: 1773179200000,
                }
            ];

            const csv = buildAuditExportData(logs as any);
            expect(csv).toContain('Timestamp,Date & Time,Action,Module,Entity Type,Entity Title,Entity ID,Performed By,Role,Summary');
            expect(csv).toContain('CREATE');
            expect(csv).toContain('Cybergada Master');
            expect(csv).toContain('LN-001');
        });
    });
});
