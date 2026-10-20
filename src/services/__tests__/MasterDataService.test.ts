import { Database } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { MasterDataService } from '../MasterDataService';

describe('MasterDataService', () => {
    let database: Database;
    let service: typeof MasterDataService;

    beforeEach(() => {
        database = createTestDatabase();
        service = MasterDataService;
        (service as any).db = database;
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    describe('Branches Management', () => {
        it('creates, reads, updates, and toggles branch status', async () => {
            const branch = await service.createBranch({
                name: 'Crispy King Tagbilaran Main',
                code: 'CK-TAG-01',
                isHq: true,
                isActive: true,
            });

            expect(branch.id).toBeDefined();
            expect(branch.name).toBe('Crispy King Tagbilaran Main');
            expect(branch.code).toBe('CK-TAG-01');
            expect(branch.isHq).toBe(true);
            expect(branch.isActive).toBe(true);

            // Read
            let branches = await service.getBranches();
            expect(branches.some(b => b.id === branch.id)).toBe(true);

            // Update
            const updated = await service.updateBranch(branch.id, {
                name: 'Crispy King Tagbilaran Central',
                code: 'CK-TAG-C1',
            });
            expect(updated.name).toBe('Crispy King Tagbilaran Central');
            expect(updated.code).toBe('CK-TAG-C1');

            // Toggle active
            const toggled = await service.toggleBranchActive(branch.id);
            expect(toggled.isActive).toBe(false);

            // Fetch active only
            const activeBranches = await service.getBranches(false);
            expect(activeBranches.some(b => b.id === branch.id)).toBe(false);
        });
    });

    describe('Warehouses Management', () => {
        it('creates, reads, updates, and toggles warehouse status', async () => {
            const branch = await service.createBranch({
                name: 'Ubay Commissary Hub',
                code: 'UBY-01',
            });

            const wh = await service.createWarehouse({
                branchId: branch.id,
                name: 'Cold Storage Room A',
                type: 'commissary',
                isActive: true,
            });

            expect(wh.id).toBeDefined();
            expect(wh.branchId).toBe(branch.id);
            expect(wh.name).toBe('Cold Storage Room A');
            expect(wh.type).toBe('commissary');

            // Read
            let warehouses = await service.getWarehouses(branch.id);
            expect(warehouses.length).toBe(1);
            expect(warehouses[0].name).toBe('Cold Storage Room A');

            // Update
            const updated = await service.updateWarehouse(wh.id, {
                name: 'Cold Storage Room A - Meat Freezer',
            });
            expect(updated.name).toBe('Cold Storage Room A - Meat Freezer');

            // Toggle active
            const toggled = await service.toggleWarehouseActive(wh.id);
            expect(toggled.isActive).toBe(false);
        });
    });

    describe('Statutory Contribution Rates Management', () => {
        it('creates, reads, updates, and deletes statutory rate brackets', async () => {
            const rate = await service.createStatutoryRate({
                rateType: 'sss',
                bracketMin: 5000,
                bracketMax: 10000,
                employeeShare: 225,
                employerShare: 475,
                effectiveFrom: new Date('2026-01-01'),
                description: 'SSS Tier 1 Minimum Bracket 2026',
            });

            expect(rate.id).toBeDefined();
            expect(rate.rateType).toBe('sss');
            expect(rate.bracketMin).toBe(5000);
            expect(rate.employeeShare).toBe(225);

            let rates = await service.getStatutoryRates('sss');
            expect(rates.some(r => r.id === rate.id)).toBe(true);

            const updated = await service.updateStatutoryRate(rate.id, {
                employeeShare: 250,
                employerShare: 500,
            });
            expect(updated.employeeShare).toBe(250);
            expect(updated.employerShare).toBe(500);

            await service.deleteStatutoryRate(rate.id);
            rates = await service.getStatutoryRates('sss');
            expect(rates.some(r => r.id === rate.id)).toBe(false);
        });
    });

    describe('Suppliers Management', () => {
        it('creates, reads, updates, and toggles supplier status', async () => {
            const supplier = await service.createSupplier({
                name: 'San Miguel Poultry Depot',
                contactPerson: 'Manager Raul',
                phone: '09181234567',
                email: 'raul@sanmiguel.ph',
                tin: '123-456-789-000',
                paymentTermsDays: 15,
            });

            expect(supplier.id).toBeDefined();
            expect(supplier.name).toBe('San Miguel Poultry Depot');

            const list = await service.getSuppliers();
            expect(list.some(s => s.id === supplier.id)).toBe(true);

            const updated = await service.updateSupplier(supplier.id, {
                paymentTermsDays: 30,
            });
            expect(updated.paymentTermsDays).toBe(30);

            const toggled = await service.toggleSupplierActive(supplier.id);
            expect(toggled.isActive).toBe(false);
        });
    });
});
