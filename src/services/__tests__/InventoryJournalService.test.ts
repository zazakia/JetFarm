import { InventoryJournalService } from '../InventoryJournalService';
import { JournalEntryService } from '../JournalEntryService';
import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('InventoryJournalService', () => {
    let database: Database;
    let invService: typeof InventoryJournalService;
    let jeService: typeof JournalEntryService;

    beforeEach(async () => {
        database = createTestDatabase();
        invService = InventoryJournalService;
        jeService = JournalEntryService;
        (invService as any).db = database;
        (invService as any).journalEntryService = jeService;
        (jeService as any).db = database;
        (ChartOfAccountsService as any).db = database;
        await ChartOfAccountsService.seed('TestUser');
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('records beginning balance, purchases, and computes running stock & WAC', async () => {
        const productId = 'AGRI-FEED-01';

        // 1. Beginning inventory: 100 bags @ ₱500 = ₱50,000
        await invService.recordBeginningBalance({
            productId,
            productSource: 'agri_products',
            moduleId: 'agri-store',
            quantity: 100,
            unitCost: 500,
            date: new Date(2026, 0, 1),
            performedBy: 'Admin',
        });

        let stock = await invService.getCurrentStock(productId, 'agri_products');
        expect(stock).toBe(100);

        let wac = await invService.computeWAC(productId, 'agri_products');
        expect(wac).toBe(500);

        // 2. Additional purchase: 50 bags @ ₱560 = ₱28,000
        await invService.recordMovement({
            productId,
            productSource: 'agri_products',
            moduleId: 'agri-store',
            movementType: 'purchase',
            quantityIn: 50,
            unitCost: 560,
            movementDate: new Date(2026, 0, 10),
            performedBy: 'Admin',
        });

        stock = await invService.getCurrentStock(productId, 'agri_products');
        expect(stock).toBe(150);

        // WAC: (50,000 + 28,000) / (100 + 50) = 78,000 / 150 = 520
        wac = await invService.computeWAC(productId, 'agri_products');
        expect(wac).toBe(520);

        // 3. Sale movement: 30 bags sold
        await invService.recordMovement({
            productId,
            productSource: 'agri_products',
            moduleId: 'agri-store',
            movementType: 'sale',
            quantityOut: 30,
            movementDate: new Date(2026, 0, 15),
            performedBy: 'Admin',
        });

        stock = await invService.getCurrentStock(productId, 'agri_products');
        expect(stock).toBe(120);

        // Check journal entries posted
        const entries = await jeService.getEntries();
        expect(entries.length).toBeGreaterThanOrEqual(3);
    });

    it('records adjustments and updates stock balance correctly', async () => {
        const productId = 'PHARM-MED-01';

        // 1. Initial 20 units
        await invService.recordMovement({
            productId,
            productSource: 'pharmacy_products',
            moduleId: 'pharmacy',
            movementType: 'beginning',
            quantityIn: 20,
            unitCost: 15,
            movementDate: new Date(2026, 0, 1),
        });

        // 2. Damaged/discrepancy stock adjustment (decrease by 2)
        await invService.recordMovement({
            productId,
            productSource: 'pharmacy_products',
            moduleId: 'pharmacy',
            movementType: 'adjustment_decrease',
            quantityOut: 2,
            unitCost: 15,
            movementDate: new Date(2026, 0, 5),
            notes: 'Expired items disposed',
        });

        const stock = await invService.getCurrentStock(productId, 'pharmacy_products');
        expect(stock).toBe(18);

        const summaries = await invService.getInventorySummary('pharmacy');
        expect(summaries).toHaveLength(1);
        expect(summaries[0].currentStock).toBe(18);
        expect(summaries[0].totalCostValue).toBe(270); // 18 * 15
    });
});
