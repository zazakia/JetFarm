import { database } from '../../database';
import MarketplaceStoreService from '../MarketplaceStoreService';
import MarketplaceProductService from '../MarketplaceProductService';
import MarketplaceOrderService from '../MarketplaceOrderService';
import MarketplacePayoutService from '../MarketplacePayoutService';

jest.mock('../../database', () => {
    const { createTestDatabase } = jest.requireActual('../../__tests__/test-utils');
    const db = createTestDatabase();
    return { database: db };
});

describe('POS Cursor Marketplace Services Unit Tests', () => {
    beforeEach(async () => {
        await database.write(async () => {
            await database.unsafeResetDatabase();
        });
        jest.clearAllMocks();
    });

    describe('MarketplaceStoreService', () => {
        it('creates a new POS Cursor store in pending state and allows admin approval', async () => {
            const store = await MarketplaceStoreService.createStore({
                borrowerId: 'MEMBER-1001',
                name: 'Bohol Native Handicrafts',
                category: 'Handicrafts & Local Products',
                description: 'Handmade woven products by POS Cursor members',
            });

            expect(store).toBeDefined();
            expect(store.name).toBe('Bohol Native Handicrafts');
            expect(store.status).toBe('pending');
            expect(store.slug).toBe('bohol-native-handicrafts');

            const updatedStore = await MarketplaceStoreService.updateStoreStatus(store.id, 'active', 'ADMIN_USER');
            expect(updatedStore.status).toBe('active');

            const activeStores = await MarketplaceStoreService.fetchActiveStores();
            expect(activeStores.length).toBe(1);
            expect(activeStores[0].id).toBe(store.id);
        });

        it('toggles store holiday mode', async () => {
            const store = await MarketplaceStoreService.createStore({
                borrowerId: 'MEMBER-1002',
                name: 'Organic Farm Store',
            });

            const holidayStore = await MarketplaceStoreService.toggleHolidayMode(store.id, true);
            expect(holidayStore.holidayMode).toBe(true);
        });
    });

    describe('MarketplaceProductService', () => {
        it('seeds default categories and manages seller products', async () => {
            const categories = await MarketplaceProductService.seedDefaultCategories();
            expect(categories.length).toBeGreaterThan(0);

            const store = await MarketplaceStoreService.createStore({
                borrowerId: 'MEMBER-1003',
                name: 'Fresh Vegetables Hub',
            });

            const product = await MarketplaceProductService.createProduct({
                storeId: store.id,
                title: 'Organic Carrots 1kg',
                price: 150.00,
                stockQuantity: 50,
                description: 'Fresh organic carrots harvested daily',
            });

            expect(product.title).toBe('Organic Carrots 1kg');
            expect(product.price).toBe(150.00);
            expect(product.status).toBe('pending_approval');

            const approvedProd = await MarketplaceProductService.updateProductStatus(product.id, 'active');
            expect(approvedProd.status).toBe('active');

            const storeProducts = await MarketplaceProductService.fetchStoreProducts(store.id);
            expect(storeProducts.length).toBe(1);
            expect(storeProducts[0].id).toBe(product.id);
        });
    });

    describe('MarketplaceOrderService & Payouts', () => {
        it('handles multi-seller cart checkout, sub-order fulfillment, and automated wallet payout', async () => {
            // Setup 2 Stores
            const storeA = await MarketplaceStoreService.createStore({ borrowerId: 'MEM-1', name: 'POS Cursor Store A' });
            const storeB = await MarketplaceStoreService.createStore({ borrowerId: 'MEM-2', name: 'POS Cursor Store B' });

            const prodA = await MarketplaceProductService.createProduct({
                storeId: storeA.id,
                title: 'Product A1',
                price: 500.00,
                stockQuantity: 10,
            });

            const prodB = await MarketplaceProductService.createProduct({
                storeId: storeB.id,
                title: 'Product B1',
                price: 1000.00,
                stockQuantity: 5,
            });

            const checkoutResult = await MarketplaceOrderService.checkout({
                buyerId: 'BUYER-001',
                paymentMethod: 'cash_on_delivery',
                commissionRate: 0.035, // 3.5%
                items: [
                    { productId: prodA.id, storeId: storeA.id, quantity: 2, unitPrice: 500.00 }, // 1000 total
                    { productId: prodB.id, storeId: storeB.id, quantity: 1, unitPrice: 1000.00 }, // 1000 total
                ],
            });

            expect(checkoutResult.order.totalAmount).toBe(2000.00);
            expect(checkoutResult.subOrders.length).toBe(2);

            const subOrderA = checkoutResult.subOrders.find(s => s.storeId === storeA.id);
            expect(subOrderA).toBeDefined();
            expect(subOrderA!.subtotal).toBe(1000.00);
            expect(subOrderA!.commissionAmount).toBe(35.00);
            expect(subOrderA!.netPayout).toBe(965.00);

            // Advance fulfillment status from processing -> ready_for_pickup -> shipped -> completed
            await MarketplaceOrderService.updateFulfillmentStatus(subOrderA!.id, 'ready_for_pickup');
            await MarketplaceOrderService.updateFulfillmentStatus(subOrderA!.id, 'shipped');
            await MarketplaceOrderService.updateFulfillmentStatus(subOrderA!.id, 'completed');

            // Verify payout summary and micro-loan cash advance eligibility (70%)
            const payoutSummary = await MarketplacePayoutService.getStorePayoutSummary(storeA.id);
            expect(payoutSummary.pendingSubOrdersCount).toBe(1);
            expect(payoutSummary.netAmount).toBe(965.00);
            expect(payoutSummary.eligibleCashAdvanceAmount).toBe(675.50);

            // Process automated payout transfer to seller's POS Cursor Savings Wallet
            const payout = await MarketplacePayoutService.processPayout(storeA.id, 'savings_wallet');
            expect(payout).toBeDefined();
            expect(payout.netAmount).toBe(965.00);
            expect(payout.status).toBe('processed');

            // Confirm post-payout pending summary is reset
            const postPayoutSummary = await MarketplacePayoutService.getStorePayoutSummary(storeA.id);
            expect(postPayoutSummary.pendingSubOrdersCount).toBe(0);
            expect(postPayoutSummary.netAmount).toBe(0);
        });
    });
});
