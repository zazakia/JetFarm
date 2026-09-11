import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import MarketplaceOrder from '../database/models/MarketplaceOrder';
import MarketplaceSubOrder from '../database/models/MarketplaceSubOrder';
import MarketplaceOrderItem from '../database/models/MarketplaceOrderItem';
import MarketplaceProduct from '../database/models/MarketplaceProduct';
import SavingsTransaction from '../database/models/SavingsTransaction';
import ActionLogService from './ActionLogService';

export interface CartLineItem {
    productId: string;
    storeId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
}

export interface CheckoutParams {
    buyerId: string;
    items: CartLineItem[];
    paymentMethod: 'wallet' | 'payroll_deduction' | 'gcash' | 'maya' | 'cash_on_delivery';
    commissionRate?: number; // e.g. 0.035 for 3.5%
}

export interface CheckoutResult {
    order: MarketplaceOrder;
    subOrders: MarketplaceSubOrder[];
}

export class MarketplaceOrderService {
    /**
     * Group cart line items by seller store and create parent order + sub-orders
     */
    static async checkout(params: CheckoutParams): Promise<CheckoutResult> {
        const commissionRate = params.commissionRate ?? 0.035; // Default 3.5% coop commission
        
        // Group items by storeId
        const storeGroups = new Map<string, CartLineItem[]>();
        let grandTotal = 0;

        for (const item of params.items) {
            const itemTotal = item.unitPrice * item.quantity;
            grandTotal += itemTotal;
            if (!storeGroups.has(item.storeId)) {
                storeGroups.set(item.storeId, []);
            }
            storeGroups.get(item.storeId)!.push(item);
        }

        const now = Date.now();
        const orderNumber = `ORD-${now.toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        let createdOrder: MarketplaceOrder;
        const createdSubOrders: MarketplaceSubOrder[] = [];

        await database.write(async () => {
            // Handle Wallet balance debit if paymentMethod === 'wallet'
            if (params.paymentMethod === 'wallet') {
                const savingsRecords = await database.get<SavingsTransaction>('savings_transactions')
                    .query(Q.where('borrower_id', params.buyerId), Q.where('deleted_at', Q.eq(null)))
                    .fetch();
                
                const currentBalance = savingsRecords.reduce((acc, tx) => {
                    return tx.type === 'deposit' ? acc + tx.amount : acc - tx.amount;
                }, 0);

                if (currentBalance < grandTotal) {
                    throw new Error(`Insufficient coop savings wallet balance (Balance: ₱${currentBalance.toFixed(2)}, Order: ₱${grandTotal.toFixed(2)})`);
                }

                // Record withdrawal / wallet payment
                await database.get<SavingsTransaction>('savings_transactions').create(tx => {
                    tx.borrowerId = params.buyerId;
                    tx.type = 'withdrawal';
                    tx.amount = grandTotal;
                    tx.date = now;
                    tx.notes = `Marketplace Order Checkout (${orderNumber})`;
                });
            }

            // Create parent order
            createdOrder = await database.get<MarketplaceOrder>('marketplace_orders').create(o => {
                o.buyerId = params.buyerId;
                o.orderNumber = orderNumber;
                o.totalAmount = grandTotal;
                o.paymentMethod = params.paymentMethod;
                o.paymentStatus = params.paymentMethod === 'cash_on_delivery' ? 'pending' : 'paid';
            });

            // Create sub-orders per store
            let storeIndex = 1;
            for (const [storeId, groupItems] of storeGroups.entries()) {
                const subOrderNumber = `${orderNumber}-${storeIndex}`;
                storeIndex++;

                const subtotal = groupItems.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0);
                const commissionAmount = Math.round(subtotal * commissionRate * 100) / 100;
                const shippingFee = 0; // Default branch pickup / seller delivery
                const netPayout = Math.round((subtotal - commissionAmount + shippingFee) * 100) / 100;

                const subOrder = await database.get<MarketplaceSubOrder>('marketplace_sub_orders').create(so => {
                    so.orderId = createdOrder.id;
                    so.storeId = storeId;
                    so.subOrderNumber = subOrderNumber;
                    so.subtotal = subtotal;
                    so.commissionAmount = commissionAmount;
                    so.shippingFee = shippingFee;
                    so.netPayout = netPayout;
                    so.fulfillmentStatus = 'processing';
                    so.payoutStatus = 'pending';
                });

                createdSubOrders.push(subOrder);

                // Create sub-order items & deduct stock
                for (const item of groupItems) {
                    await database.get<MarketplaceOrderItem>('marketplace_order_items').create(oi => {
                        oi.subOrderId = subOrder.id;
                        oi.productId = item.productId;
                        oi.variantId = item.variantId || null;
                        oi.quantity = item.quantity;
                        oi.unitPrice = item.unitPrice;
                        oi.totalPrice = item.unitPrice * item.quantity;
                    });

                    // Deduct stock from product
                    try {
                        const product = await database.get<MarketplaceProduct>('marketplace_products').find(item.productId);
                        await product.update(p => {
                            p.stockQuantity = Math.max(0, p.stockQuantity - item.quantity);
                        });
                    } catch (err) {
                        console.warn(`Product ${item.productId} not found for stock deduction`, err);
                    }
                }
            }
        });

        await ActionLogService.logAction({
            entityType: 'marketplace_orders',
            entityId: createdOrder!.id,
            action: 'CREATE',
            newData: { orderNumber, totalAmount: grandTotal, subOrdersCount: createdSubOrders.length },
        });

        return {
            order: createdOrder!,
            subOrders: createdSubOrders,
        };
    }

    static async fetchBuyerOrders(buyerId: string): Promise<MarketplaceOrder[]> {
        return await database.get<MarketplaceOrder>('marketplace_orders')
            .query(Q.where('buyer_id', buyerId), Q.where('deleted_at', Q.eq(null)))
            .fetch();
    }

    static async fetchStoreSubOrders(storeId: string): Promise<MarketplaceSubOrder[]> {
        return await database.get<MarketplaceSubOrder>('marketplace_sub_orders')
            .query(Q.where('store_id', storeId), Q.where('deleted_at', Q.eq(null)))
            .fetch();
    }

    static async updateFulfillmentStatus(subOrderId: string, status: 'processing' | 'ready_for_pickup' | 'shipped' | 'completed' | 'cancelled'): Promise<MarketplaceSubOrder> {
        const subOrder = await database.get<MarketplaceSubOrder>('marketplace_sub_orders').find(subOrderId);
        await database.write(async () => {
            await subOrder.update(so => {
                so.fulfillmentStatus = status;
            });
        });
        return subOrder;
    }
}

export default MarketplaceOrderService;
