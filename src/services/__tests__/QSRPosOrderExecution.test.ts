import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { QSRPosService } from '../QSRPosService';

describe('QSRPosService.processOrder execution', () => {
    let db: any;

    beforeEach(() => {
        db = createTestDatabase();
    });

    afterEach(async () => {
        await closeTestDatabase(db);
    });

    it('processes order successfully and creates records in database', async () => {
        const service = new QSRPosService(db);
        const result = await service.processOrder({
            branchId: 'branch-bagacay',
            cashierId: 'cashier-1',
            items: [
                { productId: 'ck-scut', name: 'Special Cut Fried Chicken', price: 50, quantity: 1 },
                { productId: 'ck-rice', name: 'Cooked Rice', price: 15, quantity: 1 }
            ],
            discount: { type: 'none' },
            tenders: [{ method: 'cash', amount: 65 }]
        });

        expect(result.orderNumber).toBeDefined();
        expect(result.totals.netPayable).toBe(65);
        expect(result.paymentResult.isValid).toBe(true);

        const orders = await db.get('marketplace_orders').query().fetch();
        expect(orders.length).toBe(1);
        expect(orders[0].totalAmount).toBe(65);

        const items = await db.get('marketplace_order_items').query().fetch();
        expect(items.length).toBe(2);

        const cashTxns = await db.get('cash_transactions').query().fetch();
        expect(cashTxns.length).toBe(1);
        expect(cashTxns[0].amount).toBe(65);
    });

    it('Gate G-11: handles concurrent orders atomically without state corruption or deadlock', async () => {
        const service = new QSRPosService(db);
        const orderPayload = {
            branchId: 'branch-bagacay',
            cashierId: 'cashier-1',
            items: [
                { productId: 'ck-scut', name: 'Special Cut Fried Chicken', price: 50, quantity: 1 }
            ],
            discount: { type: 'none' as const },
            tenders: [{ method: 'cash' as const, amount: 50 }]
        };

        const [res1, res2] = await Promise.all([
            service.processOrder(orderPayload),
            service.processOrder(orderPayload),
        ]);

        expect(res1.orderNumber).toBeDefined();
        expect(res2.orderNumber).toBeDefined();
        expect(res1.orderNumber).not.toBe(res2.orderNumber);

        const orders = await db.get('marketplace_orders').query().fetch();
        expect(orders.length).toBe(2);

        const cashTxns = await db.get('cash_transactions').query().fetch();
        expect(cashTxns.length).toBe(2);
    });
});

