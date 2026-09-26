import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('ChartOfAccountsService', () => {
    let database: Database;
    let service: typeof ChartOfAccountsService;

    beforeEach(async () => {
        database = createTestDatabase();
        service = ChartOfAccountsService;
        // Inject test database instance to service (it defaults to globalDatabase, but we want our test database)
        (service as any).db = database;
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('should seed default accounts correctly', async () => {
        expect(await service.isSeeded()).toBe(false);
        const count = await service.seed('TestUser');
        expect(count).toBeGreaterThan(30); // Seeded accounts count
        expect(await service.isSeeded()).toBe(true);
        
        // Seeding again should be idempotent
        const secondCount = await service.seed('TestUser');
        expect(secondCount).toBe(0);

        // Agribusiness accounts should be present
        const bioAsset = await service.getByCode('1240');
        expect(bioAsset).toBeDefined();
        expect(bioAsset?.name).toContain('Biological Assets');

        const agriRevenue = await service.getByCode('4140');
        expect(agriRevenue).toBeDefined();
        expect(agriRevenue?.name).toContain('Crop Harvest Sales');

        const landOwnerSettlementExp = await service.getByCode('5160');
        expect(landOwnerSettlementExp).toBeDefined();
        expect(landOwnerSettlementExp?.name).toContain('Land Owner Crop Share');

        const farmLaborExp = await service.getByCode('5161');
        expect(farmLaborExp).toBeDefined();
        expect(farmLaborExp?.name).toContain('Farm Field Labor');
    });

    it('should fetch tree structure correctly', async () => {
        await service.seed('TestUser');
        const tree = await service.getTree();
        
        expect(tree.assets.length).toBeGreaterThan(0);
        expect(tree.liabilities.length).toBeGreaterThan(0);
        expect(tree.equity.length).toBeGreaterThan(0);
        
        // Find cash account in assets
        const assetsHeader = tree.assets.find(a => a.code === '1000');
        expect(assetsHeader).toBeDefined();
        expect(assetsHeader?.isHeader).toBe(true);
        
        const cashNode = assetsHeader?.children.find(c => c.code === '1010');
        expect(cashNode).toBeDefined();
        expect(cashNode?.name).toBe('Cash on Hand (COH)');
        const pettyCashChild = cashNode?.children.find(c => c.code === '1011');
        expect(pettyCashChild).toBeDefined();
        expect(pettyCashChild?.name).toBe('Cash on Hand — Petty Cash');
    });

    it('should create new accounts and prevent duplicate codes', async () => {
        const acc = await service.create({
            code: '1016',
            name: 'Petty Cash Custom',
            accountType: 'asset',
            normalBalance: 'debit',
        }, 'TestUser');

        expect(acc.code).toBe('1016');
        
        // Attempting to create duplicate code must throw
        await expect(service.create({
            code: '1016',
            name: 'Duplicate Account',
            accountType: 'asset',
            normalBalance: 'debit',
        }, 'TestUser')).rejects.toThrow();
    });

    it('should update accounts and prevent deletion of accounts', async () => {
        const acc = await service.create({
            code: '6000',
            name: 'Temp Account',
            accountType: 'expense',
            normalBalance: 'debit',
        }, 'TestUser');

        await service.update(acc.id, { name: 'Updated Temp Account' }, 'TestUser');
        const updated = await service.getById(acc.id);
        expect(updated?.name).toBe('Updated Temp Account');

        // Delete must throw prevention error
        await expect(service.softDelete(acc.id, 'TestUser')).rejects.toThrow(/cannot be deleted/i);
    });

    it('should fetch accounts by type correctly', async () => {
        await service.seed('TestUser');
        const assets = await service.getByType('asset');
        const liabilities = await service.getByType('liability');

        expect(assets.length).toBeGreaterThan(0);
        expect(liabilities.length).toBeGreaterThan(0);
        expect(assets.every(a => a.accountType === 'asset')).toBe(true);
        expect(liabilities.every(l => l.accountType === 'liability')).toBe(true);
    });

    it('should return null for getById when ID is not found or invalid', async () => {
        const found = await service.getById('non-existent-id');
        expect(found).toBeNull();
    });

    it('should prevent updating an account code to a code that already exists', async () => {
        await service.seed('TestUser');
        
        // Create two new accounts
        const acc1 = await service.create({
            code: '7001',
            name: 'Account 1',
            accountType: 'expense',
            normalBalance: 'debit',
        }, 'TestUser');

        await service.create({
            code: '7002',
            name: 'Account 2',
            accountType: 'expense',
            normalBalance: 'debit',
        }, 'TestUser');

        // Try to update acc1's code to '7002', which exists
        await expect(
            service.update(acc1.id, { code: '7002' }, 'TestUser')
        ).rejects.toThrow(/already exists/);
    });

    it('should change isActive status and log action in setActive', async () => {
        const acc = await service.create({
            code: '8000',
            name: 'Status Account',
            accountType: 'expense',
            normalBalance: 'debit',
        }, 'TestUser');

        expect(acc.isActive).toBe(true);

        // Deactivate
        await service.setActive(acc.id, false, 'TestUser');
        let updated = await service.getById(acc.id);
        expect(updated?.isActive).toBe(false);

        // Reactivate
        await service.setActive(acc.id, true, 'TestUser');
        updated = await service.getById(acc.id);
        expect(updated?.isActive).toBe(true);
    });

    it('should prevent soft deleting an account if journal postings exist', async () => {
        const acc = await service.create({
            code: '9000',
            name: 'Postable Account',
            accountType: 'expense',
            normalBalance: 'debit',
        }, 'TestUser');

        // Mock some journal posting line using this code
        const jelCollection = database.get('journal_entry_lines');
        await database.write(async () => {
            await jelCollection.create((r: any) => {
                r.journalEntryId = 'je-abc';
                r.accountCode = '9000';
                r.debitAmount = 500;
                r.creditAmount = 0;
            });
        });

        // Attempting to delete acc should throw since deletion of accounts is blocked
        await expect(
            service.softDelete(acc.id, 'TestUser')
        ).rejects.toThrow(/cannot be deleted/i);
    });

    it('should return 0 from seed() if CoA already fully seeded', async () => {
        await service.seed('TestUser');
        const second = await service.seed('TestUser');
        expect(second).toBe(0);
    });

    it('should seed without a performedBy (no action log written)', async () => {
        // seed() has an "if (performedBy)" branch — test without arg
        const count = await service.seed();
        expect(count).toBeGreaterThan(0);
    });

    it('should update account fields without a code change', async () => {
        const acc = await service.create({
            code: '6000',
            name: 'Original Name',
            accountType: 'expense',
            normalBalance: 'debit',
        }, 'TestUser');

        // Update name only (no code change)
        const updated = await service.update(acc.id, { name: 'Updated Name' }, 'TestUser');
        expect(updated.name).toBe('Updated Name');
        expect(updated.code).toBe('6000');
    });

    it('should build account tree via getTree and include children', async () => {
        await service.seed('TestUser');
        const tree = await service.getTree();
        expect(tree.assets.length).toBeGreaterThan(0);
        expect(tree.liabilities.length).toBeGreaterThan(0);
        expect(tree.equity.length).toBeGreaterThan(0);
        expect(tree.income.length).toBeGreaterThan(0);
        expect(tree.expenses.length).toBeGreaterThan(0);
    });
});
