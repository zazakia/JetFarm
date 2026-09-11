import { Database } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { BusinessUnitServiceClass } from '../BusinessUnitService';
import { ConsolidationServiceClass } from '../ConsolidationService';
import { ChartOfAccountsServiceClass } from '../ChartOfAccountsService';
import { ModuleAccountingBridge } from '../../modules/core/ModuleAccountingBridge';
import { WaterStationModule } from '../../modules/water-station/manifest';
import { WsCustomerServiceClass } from '../../modules/water-station/services/WsCustomerService';
import { WsDeliveryServiceClass } from '../../modules/water-station/services/WsDeliveryService';
import WsDelivery from '../../database/models/WsDelivery';

describe('MPCO Module Framework & Consolidation', () => {
    let database: Database;
    let businessUnitService: BusinessUnitServiceClass;
    let consolidationService: ConsolidationServiceClass;
    let coaService: ChartOfAccountsServiceClass;
    let customerService: WsCustomerServiceClass;
    let deliveryService: WsDeliveryServiceClass;

    beforeEach(async () => {
        database = createTestDatabase();
        businessUnitService = new BusinessUnitServiceClass(database);
        consolidationService = new ConsolidationServiceClass(database);
        coaService = new ChartOfAccountsServiceClass(database);
        customerService = new WsCustomerServiceClass(database);
        deliveryService = new WsDeliveryServiceClass(database);

        // Explicitly set the database instance on the shared bridge if needed,
        // but here the services receive database as constructor parameter.
        (ModuleAccountingBridge as any).journalEntryService.db = database;

        // Seed base Chart of Accounts
        await coaService.seed('TestAdmin');
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('should register a module and seed its segment Chart of Accounts', async () => {
        const bu = await businessUnitService.registerModule(WaterStationModule, 'TestAdmin');
        expect(bu.name).toBe('Water Station');
        expect(bu.slug).toBe('water-station');
        expect(bu.isActive).toBe(true);

        // Verify the segment accounts were seeded
        const cashAcc = await coaService.getByCode('1015');
        const revenueAcc = await coaService.getByCode('4100');
        const suppliesAcc = await coaService.getByCode('5120');

        expect(cashAcc?.name).toBe('Cash on Hand — Water Station');
        expect(revenueAcc?.name).toBe('Water Sales Revenue');
        expect(suppliesAcc?.name).toBe('Cost of Sales — Water Station Supplies');
    });

    it('should aggregate ledger balances by business unit segment correctly', async () => {
        // Register the module
        await businessUnitService.registerModule(WaterStationModule, 'TestAdmin');

        // Post a Journal Entry tagged to Water Station
        await ModuleAccountingBridge.postModuleEntry(
            WaterStationModule,
            {
                entryDate: new Date(),
                description: 'Sales collection',
                entryType: 'auto',
                lines: [
                    { accountCode: '1015', debitAmount: 500 }, // WS Cash
                    { accountCode: '4100', creditAmount: 500 } // WS Revenue
                ]
            },
            'TestAdmin'
        );

        // Post a Cooperative-wide (non-segment) journal entry
        await ModuleAccountingBridge.postModuleEntry(
            // Use dummy or base structure (Consolidation treats empty as Coop-wide)
            { ...WaterStationModule, id: '' },
            {
                entryDate: new Date(),
                description: 'General membership registration fee',
                entryType: 'auto',
                lines: [
                    { accountCode: '1010', debitAmount: 150 }, // Coop Cash
                    { accountCode: '4030', creditAmount: 150 } // Membership Fees
                ]
            },
            'TestAdmin'
        );

        // Verify segment-specific balances (Water Station only)
        const wsBalances = await consolidationService.getBalances(new Date(), 'water-station');
        expect(wsBalances.get('1015')).toBe(500);
        expect(wsBalances.get('4100')).toBe(500);
        expect(wsBalances.get('1010')).toBeUndefined(); // Coop cash should not appear in WS segment

        // Verify Cooperative Base balances only (excluding Water Station segment)
        const coopBaseBalances = await consolidationService.getBalances(new Date(), 'coop-base');
        expect(coopBaseBalances.get('1010')).toBe(150);
        expect(coopBaseBalances.get('4030')).toBe(150);
        expect(coopBaseBalances.get('1015')).toBeUndefined(); // WS Cash should not appear in Coop Base

        // Verify consolidated balances (Coop + all segments combined)
        const consolidatedBalances = await consolidationService.getBalances(new Date());
        expect(consolidatedBalances.get('1015')).toBe(500);
        expect(consolidatedBalances.get('4100')).toBe(500);
        expect(consolidatedBalances.get('1010')).toBe(150);
        expect(consolidatedBalances.get('4030')).toBe(150);
    });

    it('should process Water Station deliveries and post balanced double-entry journals', async () => {
        // Register Water Station business unit
        await businessUnitService.registerModule(WaterStationModule, 'TestAdmin');

        // Create a customer
        const customer = await customerService.create({
            name: 'Juan Dela Cruz',
            phone: '09123456789',
            address: 'Purok 1, Ormoc',
            isMember: false
        }, 'TestAdmin');

        // Record a Cash Sale delivery: 10 gallons @ 35 PHP
        const delivery = await deliveryService.createDelivery({
            customerId: customer.id,
            deliveryDate: new Date(),
            gallons: 10,
            pricePerGallon: 35,
            isPaidOnDelivery: true,
            paymentMethod: 'cash'
        }, 'TestAdmin');

        expect(delivery.totalAmount).toBe(350);
        expect(delivery.status).toBe('delivered');

        // Verify Cash on Hand for Water Station went up
        const wsBalances = await consolidationService.getBalances(new Date(), 'water-station');
        expect(wsBalances.get('1015')).toBe(350); // Cash on Hand - WS
        expect(wsBalances.get('4100')).toBe(350); // Water Sales Revenue
    });

    it('should support charge deliveries and post payments on account later', async () => {
        // Register Water Station business unit
        await businessUnitService.registerModule(WaterStationModule, 'TestAdmin');

        // Create customer
        const customer = await customerService.create({
            name: 'Maria Clara',
            isMember: false
        }, 'TestAdmin');

        // Record a charge sale delivery: 20 gallons @ 35 PHP
        const delivery = await deliveryService.createDelivery({
            customerId: customer.id,
            deliveryDate: new Date(),
            gallons: 20,
            pricePerGallon: 35,
            isPaidOnDelivery: false // Charge Sale
        }, 'TestAdmin');

        expect(delivery.totalAmount).toBe(700);
        expect(delivery.status).toBe('pending');

        // Verify Other Receivables went up, Cash remains 0
        let wsBalances = await consolidationService.getBalances(new Date(), 'water-station');
        expect(wsBalances.get('1500')).toBe(700); // Receivables
        expect(wsBalances.get('1015')).toBeUndefined(); // Cash is 0/empty
        expect(wsBalances.get('4100')).toBe(700); // Revenue

        // Complete the delivery (collect payment later)
        await deliveryService.completeDelivery(delivery.id, 'gcash', 'TestAdmin');

        // Verify Receivables went down to 0, Cash went up to 700
        wsBalances = await consolidationService.getBalances(new Date(), 'water-station');
        expect(wsBalances.get('1500')).toBe(0); // Receivables cleared
        expect(wsBalances.get('1015')).toBe(700); // Cash collected
        expect(wsBalances.get('4100')).toBe(700); // Revenue unchanged
    });
});
