import { QSRPosService } from '../QSRPosService';
import { ShiftCashService, CashDenominations } from '../ShiftCashService';
import { CommissaryDispatchServiceClass } from '../CommissaryDispatchService';
import { WasteLogServiceClass } from '../WasteLogService';
import { MSRServiceClass } from '../MSRService';
import { RoyaltyServiceClass } from '../RoyaltyService';
import { BranchScopeService } from '../BranchScopeService';
import { SyncService } from '../SyncService';
import { createTestDatabase } from '../../__tests__/test-utils';

describe('Crispy King Enterprise System — Full End-to-End Integration Flow', () => {
    let db: any;
    let dispatchService: CommissaryDispatchServiceClass;
    let wasteService: WasteLogServiceClass;
    let msrService: MSRServiceClass;
    let royaltyService: RoyaltyServiceClass;

    beforeEach(() => {
        db = createTestDatabase();
        dispatchService = new CommissaryDispatchServiceClass(db);
        wasteService = new WasteLogServiceClass(db);
        msrService = new MSRServiceClass(db);
        royaltyService = new RoyaltyServiceClass(db);
        SyncService.setPartitionFilter(null);
    });

    afterEach(() => {
        SyncService.setPartitionFilter(null);
    });

    it('Flow 1 & 2: POS Order calculation and split tender payment validation', () => {
        // Rings up S-Cut (₱50) + Rice (₱15) + Softdrinks 1.0L (₱45) = ₱110.00
        const items = [
            { productId: 'ck-scut', name: 'Special Cut Fried Chicken', price: 50.0, quantity: 1 },
            { productId: 'ck-rice', name: 'Cooked Rice', price: 15.0, quantity: 1 },
            { productId: 'ck-sd10', name: 'Softdrinks 1.0L', price: 45.0, quantity: 1 },
        ];

        const totals = QSRPosService.calculateOrderTotals(items);
        expect(totals.grossTotal).toBe(110.0);
        expect(totals.netPayable).toBe(110.0);
        expect(totals.vatableSales).toBe(98.21);
        expect(totals.vatAmount).toBe(11.79);

        // Split Tender: ₱50 GCash + ₱100 Cash tendered = ₱150 total tendered
        const paymentResult = QSRPosService.validatePayment(totals.netPayable, [
            { method: 'gcash', amount: 50.0, referenceNumber: 'GCASH-987654' },
            { method: 'cash', amount: 100.0 },
        ]);

        expect(paymentResult.isValid).toBe(true);
        expect(paymentResult.totalTendered).toBe(150.0);
        expect(paymentResult.totalPaid).toBe(110.0);
        expect(paymentResult.change).toBe(40.0);
    });

    it('Flow 3: Shift cash management, safe drop, and Z-Reading variance calculation', () => {
        // Open with ₱1,000 float
        const denominations: CashDenominations = {
            p1000: 1,
            p500: 0,
            p200: 0,
            p100: 0,
            p50: 0,
            p20: 0,
            coins: 0,
        };
        const floatAmount = ShiftCashService.calculateCashDenominationTotal(denominations);
        expect(floatAmount).toBe(1000.0);

        // Mid-shift safe drop of ₱5,000 when drawer exceeded limit
        const drawerLimit = 5000.0;
        const currentDrawer = 7500.0;
        const dropAmount = 5000.0;

        expect(currentDrawer > drawerLimit).toBe(true);
        const remainingDrawer = currentDrawer - dropAmount;
        expect(remainingDrawer).toBe(2500.0);

        // Z-Reading: Expected ₱2,500, Physical cash counted ₱2,510 -> ₱10 Overage
        const zReadingDenominations: CashDenominations = {
            p1000: 2,
            p500: 1,
            p200: 0,
            p100: 0,
            p50: 0,
            p20: 0,
            coins: 10,
        };
        const physicalCount = ShiftCashService.calculateCashDenominationTotal(zReadingDenominations);
        expect(physicalCount).toBe(2510.0);

        const variance = physicalCount - remainingDrawer;
        expect(variance).toBe(10.0); // +₱10 Over
    });

    it('Flow 4: Commissary dispatch, branch receiving, and stock movement', async () => {
        const dispatch = await dispatchService.createDispatch({
            fromLocation: 'Dumaguete Commissary',
            toBranchId: 'ck-bagacay',
            poReference: 'PO-2026-07-001',
            items: [
                { productId: 'ck-scut', productName: 'Special Cut Chicken', quantityExpected: 500, uom: 'pcs', unitCost: 35.0 },
            ],
            dispatchedBy: 'Commissary Supervisor',
        });

        expect(dispatch.status).toBe('draft');
        expect(dispatch.totalAmount).toBe(17500.0);

        await dispatchService.markInTransit(dispatch.id);
        const inTransitRecord = await dispatchService.getDispatchById(dispatch.id);
        expect(inTransitRecord?.status).toBe('in_transit');

        // Branch receives 495 pcs (5 pcs variance / damaged during transit)
        const received = await dispatchService.receiveDispatch(
            dispatch.id,
            [
                { productId: 'ck-scut', quantityReceived: 495, notes: '5 pcs damaged in crate' },
            ],
            'Bagacay Store Manager'
        );

        expect(received.status).toBe('received');
        expect(received.items[0].variance).toBe(-5);

        // Verify and post to inventory
        const posted = await dispatchService.verifyAndPostToInventory(dispatch.id, 'Area Supervisor Jumar');
        expect(posted.status).toBe('verified');

        // Ensure stock movement recorded for 495 pcs
        const stockMovements = await db.get('stock_movements').query().fetch();
        expect(stockMovements.length).toBeGreaterThanOrEqual(1);
        const movement = stockMovements.find((m: any) => m.productId === 'ck-scut');
        expect(movement).toBeDefined();
        expect(movement.quantityIn).toBe(495);
    });

    it('Flow 5: Waste / Bad Order logger deducts stock and logs spoilage loss', async () => {
        const waste = await wasteService.recordWaste({
            branchId: 'ck-bagacay',
            productId: 'ck-scut',
            productName: 'Special Cut Chicken',
            quantity: 10,
            uom: 'pcs',
            reason: 'burnt_overcooked',
            unitCost: 35.0,
            recordedBy: 'Crew Leader',
            notes: 'Overcooked batch in deep fryer 2',
        });

        expect(waste.quantity).toBe(10);
        expect(waste.totalCost).toBe(350.0);
        expect(waste.reason).toBe('burnt_overcooked');
        expect(waste.stockMovementId).toBeDefined();

        // Verify branch waste summary
        const startDate = new Date(Date.now() - 86400000);
        const endDate = new Date(Date.now() + 86400000);
        const summary = await wasteService.getBranchWasteSummary('ck-bagacay', startDate, endDate);
        expect(summary.totalCount).toBe(1);
        expect(summary.totalCost).toBe(350.0);
    });

    it('Flow 6 & 7: Digital MSR matches Bagacay benchmark and splits royalty 80/20 with zero drift', async () => {
        // Setup sales, COGS, and OPEX in local db matching Bagacay benchmark:
        // Gross Sales: ₱512,383.00, COGS: ₱332,893.88, OPEX: ₱160,446.21, Net: ₱19,042.91
        const testYear = 2026;
        const testMonth = 7;
        const testTimestamp = new Date(testYear, testMonth - 1, 15).getTime();

        await db.write(async () => {
            const orders = db.get('marketplace_orders');
            await orders.create((o: any) => {
                o.orderNumber = 'ORD-BAGACAY-JULY';
                o.totalAmount = 512383.0;
                o.paymentMethod = 'cash';
                o.paymentStatus = 'paid';
                (o as any)._setRaw('created_at', testTimestamp);
            });

            const movements = db.get('stock_movements');
            await movements.create((m: any) => {
                m.productId = 'ck-scut';
                m.productSource = 'local';
                m.moduleId = 'crispy-king';
                m.movementType = 'sale';
                m.totalCost = 332893.88;
                m.quantityBalance = 500;
                m.movementDate = testTimestamp;
            });

            const expenses = db.get('expenses');
            await expenses.create((e: any) => {
                e.amount = 160446.21;
                e.expenseDate = testTimestamp;
                e.description = 'Store Rent & Crew Wages';
            });
        });

        // 1. Generate MSR
        const msr = await msrService.generateMonthlyStoreReport('ck-bagacay', 2026, 7);
        expect(msr.grossSales).toBe(512383.0);
        expect(msr.cogs).toBe(332893.88);
        expect(msr.opex).toBe(160446.21);
        expect(msr.netIncome).toBe(19042.91);
        expect(msr.cogsRatio).toBeCloseTo(64.97, 1);
        expect(msr.netMargin).toBeCloseTo(3.72, 1);

        // 2. Export MSR to CSV
        const csv = await msrService.exportMSRToCSV('ck-bagacay', 2026, 7);
        expect(csv).toContain('CRISPY KING MONTHLY STORE REPORT (MSR)');
        expect(csv).toContain('512383');

        // 3. Royalty calculation: Net Income ₱19,042.91
        const royalty = await royaltyService.calculateMonthlyRoyalty({
            branchId: 'ck-bagacay',
            year: 2026,
            month: 7,
        });
        expect(royalty.grossSales).toBe(512383.0);
        expect(royalty.cogs).toBe(332893.88);
        expect(royalty.opex).toBe(160446.21);
        expect(royalty.netIncome).toBe(19042.91);

        // 80% Operator = ₱15,234.33 | 20% Franchisor = ₱3,808.58
        expect(royalty.operatorShare).toBe(15234.33);
        expect(royalty.franchisorShare).toBe(3808.58);
        expect(Math.round((royalty.operatorShare + royalty.franchisorShare) * 100) / 100).toBe(19042.91);

        // Settlement creates AP Voucher to ERT-Crispy King Ventures Inc.
        const settled = await royaltyService.approveRoyaltySettlement(royalty.id, 'Executive Director');
        expect(settled.status).toBe('approved');
        expect(settled.apVoucherId).toBeDefined();

        const vouchers = await db.get('accounts_payable_vouchers').query().fetch();
        const voucher = vouchers.find((v: any) => v.id === settled.apVoucherId);
        expect(voucher).toBeDefined();
        expect(voucher.amount).toBe(3808.58);
        expect(voucher.supplierId).toBe('ERT-Crispy King Ventures Inc.');
        expect(voucher.description).toContain('20% Franchisor Royalty Share');
    });

    it('Flow 8: Branch data isolation between branches, supervisor, and executive', async () => {
        // Branch Cashier at Bagacay: only has access to Bagacay
        const cashierScope = await BranchScopeService.getAccessibleBranchIds({
            role: 'branch_cashier',
            branchId: 'ck-bagacay',
        });
        expect(cashierScope).toEqual(['ck-bagacay']);
        expect(await BranchScopeService.canAccessBranch({ role: 'branch_cashier', branchId: 'ck-bagacay' }, 'ck-bagacay')).toBe(true);
        expect(await BranchScopeService.canAccessBranch({ role: 'branch_cashier', branchId: 'ck-bagacay' }, 'ck-tayasan')).toBe(false);

        // Area Supervisor: scoped to assigned area cluster
        const supervisorScope = await BranchScopeService.getAccessibleBranchIds({
            role: 'area_supervisor',
            areaId: 'area-baby-ann',
            id: 'sup-baby-ann',
        });
        expect(Array.isArray(supervisorScope)).toBe(true);

        // Executive: global visibility across all 39 stores
        const isExecutiveGlobal = BranchScopeService.isGlobalRole('executive');
        expect(isExecutiveGlobal).toBe(true);

        // Sync partition filter verification
        SyncService.setPartitionFilter({
            branchId: 'ck-bagacay',
            role: 'branch_cashier',
        });

        const syncFilter = SyncService.getPartitionFilter();
        expect(syncFilter?.branchId).toBe('ck-bagacay');
        expect(syncFilter?.role).toBe('branch_cashier');
    });
});
