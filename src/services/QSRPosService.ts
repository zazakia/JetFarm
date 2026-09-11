import { Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import { JournalEntryServiceClass } from './JournalEntryService';
import MarketplaceOrder from '../database/models/MarketplaceOrder';
import MarketplaceSubOrder from '../database/models/MarketplaceSubOrder';
import MarketplaceOrderItem from '../database/models/MarketplaceOrderItem';
import CashTransaction from '../database/models/CashTransaction';
import { deterministicUuid, SyncService } from './SyncService';

export interface OrderItemInput {
    productId: string;
    name: string;
    price: number;
    quantity: number;
}

export type DiscountType = 'none' | 'sc_pwd_20' | 'percentage' | 'fixed';

export interface DiscountInput {
    type: DiscountType;
    value?: number; // for percentage (e.g. 10) or fixed amount (e.g. 50)
    idNumber?: string; // SC or PWD ID number
    name?: string;
}

export interface OrderTotals {
    grossTotal: number;
    discountType: DiscountType;
    discountValue?: number;
    discountAmount: number;
    vatableSales: number;
    vatAmount: number;
    vatExemptSales: number;
    netPayable: number;
}

export interface PaymentTender {
    method: 'cash' | 'gcash' | 'maya' | 'card' | 'other';
    amount: number;
    referenceNumber?: string;
}

export interface PaymentValidationResult {
    isValid: boolean;
    totalTendered: number;
    totalPaid: number;
    change: number;
    error?: string;
}

export interface ProcessOrderInput {
    branchId: string;
    cashierId: string;
    items: OrderItemInput[];
    discount?: DiscountInput;
    tenders: PaymentTender[];
    notes?: string;
}

export interface MenuItem {
    productId: string;
    code: string;
    name: string;
    category: 'chicken' | 'sides' | 'drinks' | 'specialty' | 'condiments';
    price: number;
    icon: string;
    description: string;
}

export const CRISPY_KING_MENU: MenuItem[] = [
    {
        productId: 'ck-scut',
        code: 'CK-SCUT',
        name: 'Special Cut Fried Chicken',
        category: 'chicken',
        price: 50.0,
        icon: 'fast-food',
        description: 'Crispy deep-fried golden brown chicken piece with gravy',
    },
    {
        productId: 'ck-rice',
        code: 'CK-RICE',
        name: 'Cooked Rice',
        category: 'sides',
        price: 15.0,
        icon: 'restaurant',
        description: 'Steamed white rice',
    },
    {
        productId: 'ck-sd10',
        code: 'CK-SD10',
        name: 'Softdrinks 1.0L',
        category: 'drinks',
        price: 45.0,
        icon: 'wine',
        description: '1 Liter bottled soda (Coke / Sprite / Royal)',
    },
    {
        productId: 'ck-sd15',
        code: 'CK-SD15',
        name: 'Softdrinks 1.5L',
        category: 'drinks',
        price: 65.0,
        icon: 'wine',
        description: '1.5 Liter bottled soda (Coke / Sprite / Royal)',
    },
    {
        productId: 'ck-neck',
        code: 'CK-NECK',
        name: 'Chicken Neck',
        category: 'specialty',
        price: 20.0,
        icon: 'flame',
        description: 'Crispy seasoned fried chicken neck',
    },
    {
        productId: 'ck-flt',
        code: 'CK-FLT',
        name: 'Chicken Fillet',
        category: 'specialty',
        price: 45.0,
        icon: 'nutrition',
        description: 'Boneless breast fillet breaded and deep fried',
    },
    {
        productId: 'ck-bola',
        code: 'CK-BOLA',
        name: 'Bola-Bola',
        category: 'specialty',
        price: 20.0,
        icon: 'radio-button-on',
        description: 'Seasoned fried meatball on stick',
    },
    {
        productId: 'ck-lump',
        code: 'CK-LUMP',
        name: 'Lumpia',
        category: 'specialty',
        price: 15.0,
        icon: 'reorder-four',
        description: 'Crispy fried spring roll',
    },
    {
        productId: 'ck-ngoh',
        code: 'CK-NGOH',
        name: 'Ngohiong',
        category: 'specialty',
        price: 20.0,
        icon: 'color-wand',
        description: 'Cebu-style spiced deep fried ubod/meat roll',
    },
    {
        productId: 'ck-atsr',
        code: 'CK-ATSR',
        name: 'Atsara',
        category: 'condiments',
        price: 10.0,
        icon: 'leaf',
        description: 'Sweet and tangy pickled green papaya cup',
    },
];

export class QSRPosService {
    private db: Database;
    private journalEntryService: JournalEntryServiceClass;

    constructor(db: Database = globalDatabase) {
        this.db = db;
        this.journalEntryService = new JournalEntryServiceClass(db);
    }

    /**
     * Return standard Crispy King menu items
     */
    static getStandardMenu(): MenuItem[] {
        return CRISPY_KING_MENU;
    }

    /**
     * Computes order breakdown including VAT and statutory Philippine discounts (SC/PWD 20%).
     */
    static calculateOrderTotals(items: OrderItemInput[], discount: DiscountInput = { type: 'none' }): OrderTotals {
        const grossTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        if (grossTotal <= 0) {
            return {
                grossTotal: 0,
                discountType: discount.type,
                discountValue: discount.value,
                discountAmount: 0,
                vatableSales: 0,
                vatAmount: 0,
                vatExemptSales: 0,
                netPayable: 0,
            };
        }

        let discountAmount = 0;
        let vatableSales = 0;
        let vatAmount = 0;
        let vatExemptSales = 0;
        let netPayable = 0;

        if (discount.type === 'sc_pwd_20') {
            // Philippine statutory formula (RA 9994 / RA 10754)
            // Gross price is VAT inclusive (12% VAT)
            vatExemptSales = Number((grossTotal / 1.12).toFixed(2));
            vatAmount = 0;
            vatableSales = 0;
            discountAmount = Number((vatExemptSales * 0.20).toFixed(2));
            netPayable = Number((vatExemptSales - discountAmount).toFixed(2));
        } else if (discount.type === 'percentage') {
            const pct = Math.max(0, Math.min(100, discount.value || 0));
            discountAmount = Number(((grossTotal * pct) / 100).toFixed(2));
            netPayable = Math.max(0, Number((grossTotal - discountAmount).toFixed(2)));
            vatableSales = Number((netPayable / 1.12).toFixed(2));
            vatAmount = Number((netPayable - vatableSales).toFixed(2));
        } else if (discount.type === 'fixed') {
            const val = Math.max(0, discount.value || 0);
            discountAmount = Math.min(grossTotal, Number(val.toFixed(2)));
            netPayable = Math.max(0, Number((grossTotal - discountAmount).toFixed(2)));
            vatableSales = Number((netPayable / 1.12).toFixed(2));
            vatAmount = Number((netPayable - vatableSales).toFixed(2));
        } else {
            // Regular sales (VAT inclusive)
            netPayable = Number(grossTotal.toFixed(2));
            vatableSales = Number((grossTotal / 1.12).toFixed(2));
            vatAmount = Number((grossTotal - vatableSales).toFixed(2));
            discountAmount = 0;
        }

        return {
            grossTotal: Number(grossTotal.toFixed(2)),
            discountType: discount.type,
            discountValue: discount.value,
            discountAmount: Number(discountAmount.toFixed(2)),
            vatableSales: Number(vatableSales.toFixed(2)),
            vatAmount: Number(vatAmount.toFixed(2)),
            vatExemptSales: Number(vatExemptSales.toFixed(2)),
            netPayable: Number(netPayable.toFixed(2)),
        };
    }

    /**
     * Validates payment tenders against the net payable amount.
     */
    static validatePayment(netPayable: number, tenders: PaymentTender[]): PaymentValidationResult {
        const roundedPayable = Number(netPayable.toFixed(2));
        let totalCash = 0;
        let totalNonCash = 0;

        for (const t of tenders) {
            if (t.amount <= 0) continue;
            if (t.method === 'cash') {
                totalCash += t.amount;
            } else {
                totalNonCash += t.amount;
            }
        }

        totalCash = Number(totalCash.toFixed(2));
        totalNonCash = Number(totalNonCash.toFixed(2));
        const totalTendered = Number((totalCash + totalNonCash).toFixed(2));

        // Non-cash portion cannot exceed net payable
        if (totalNonCash > roundedPayable) {
            return {
                isValid: false,
                totalTendered,
                totalPaid: 0,
                change: 0,
                error: `Non-cash payment cannot exceed order total of ₱${roundedPayable.toFixed(2)}.`,
            };
        }

        if (totalTendered < roundedPayable) {
            const shortage = Number((roundedPayable - totalTendered).toFixed(2));
            return {
                isValid: false,
                totalTendered,
                totalPaid: totalTendered,
                change: 0,
                error: `Insufficient payment. Short by ₱${shortage.toFixed(2)}.`,
            };
        }

        const change = Number(Math.max(0, totalTendered - roundedPayable).toFixed(2));
        const totalPaid = Number((totalTendered - change).toFixed(2));

        return {
            isValid: true,
            totalTendered,
            totalPaid,
            change,
        };
    }

    /**
     * Generates a sequential order number: CK-YYYYMMDD-XXXXX
     */
    static generateOrderNumber(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
        return `CK-${year}${month}${day}-${randomPart}`;
    }

    /**
     * Processes a completed sale: writes to database and auto-posts double-entry journal vouchers.
     */
    async processOrder(input: ProcessOrderInput): Promise<{
        orderNumber: string;
        totals: OrderTotals;
        paymentResult: PaymentValidationResult;
        journalEntryId?: string;
    }> {
        const totals = QSRPosService.calculateOrderTotals(input.items, input.discount);
        const paymentResult = QSRPosService.validatePayment(totals.netPayable, input.tenders);

        if (!paymentResult.isValid) {
            throw new Error(paymentResult.error || 'Invalid payment tenders');
        }

        const orderNumber = QSRPosService.generateOrderNumber();
        const orderDate = new Date();

        let cashAmount = 0;
        let eWalletAmount = 0;
        for (const t of input.tenders) {
            if (t.method === 'cash') {
                cashAmount += t.amount;
            } else {
                eWalletAmount += t.amount;
            }
        }
        // Deduct change from cash amount
        cashAmount = Math.max(0, Number((cashAmount - paymentResult.change).toFixed(2)));

        let createdOrderId = '';

        await this.db.write(async () => {
            // 1. Create MarketplaceOrder master record
            const ordersCollection = this.db.get<MarketplaceOrder>('marketplace_orders');
            const buyerUuid = SyncService.UUID_REGEX.test(input.branchId)
                ? input.branchId
                : deterministicUuid(`buyer-${input.branchId || 'default'}`);

            const newOrder = await ordersCollection.create((rec) => {
                rec.buyerId = buyerUuid;
                rec.orderNumber = orderNumber;
                rec.totalAmount = totals.netPayable;
                rec.paymentMethod = input.tenders.length > 1 ? 'split' : input.tenders[0]?.method || 'cash';
                rec.paymentStatus = 'paid';
            });
            createdOrderId = newOrder.id;

            // 1b. Create MarketplaceSubOrder record
            const subOrdersCollection = this.db.get<MarketplaceSubOrder>('marketplace_sub_orders');
            const newSubOrder = await subOrdersCollection.create((rec) => {
                rec.orderId = newOrder.id;
                rec.storeId = '00000000-0000-4000-8000-0000000000c1';
                rec.subOrderNumber = `${orderNumber}-1`;
                rec.subtotal = totals.grossTotal;
                rec.commissionAmount = 0;
                rec.shippingFee = 0;
                rec.netPayout = totals.netPayable;
                rec.fulfillmentStatus = 'completed';
                rec.payoutStatus = 'paid';
            });

            // 2. Create Order Items
            const itemsCollection = this.db.get<MarketplaceOrderItem>('marketplace_order_items');
            for (const item of input.items) {
                const productUuid = SyncService.UUID_REGEX.test(item.productId)
                    ? item.productId
                    : deterministicUuid(`prod-${item.productId.toUpperCase()}`);

                await itemsCollection.create((rec) => {
                    rec.subOrderId = newSubOrder.id;
                    rec.productId = productUuid;
                    rec.variantId = null;
                    rec.quantity = item.quantity;
                    rec.unitPrice = item.price;
                    rec.totalPrice = Number((item.price * item.quantity).toFixed(2));
                });
            }

            // 3. Record Cash Transaction in Register
            if (cashAmount > 0) {
                const cashTxnCollection = this.db.get<CashTransaction>('cash_transactions');
                await cashTxnCollection.create((rec) => {
                    rec.amount = cashAmount;
                    rec.type = 'in';
                    rec.particulars = `POS Sale: ${orderNumber} (${input.branchId})`;
                    rec.remarks = 'POS Sale';
                    rec.recordedBy = input.cashierId;
                    rec.transactionDate = orderDate.getTime();
                });
            }
        });

        // 4. Auto-post double-entry journal entry to GL
        let journalEntryId: string | undefined;
        try {
            const lines: any[] = [];

            if (cashAmount > 0) {
                lines.push({
                    accountCode: '1010', // Cash on Hand
                    accountName: 'Cash on Hand',
                    debitAmount: cashAmount,
                    creditAmount: 0,
                    description: `Cash received for ${orderNumber}`,
                });
            }

            if (eWalletAmount > 0) {
                lines.push({
                    accountCode: '1030', // Digital Wallet / Bank
                    accountName: 'Digital Wallet / E-Payment',
                    debitAmount: eWalletAmount,
                    creditAmount: 0,
                    description: `E-Wallet payment for ${orderNumber}`,
                });
            }

            if (totals.discountAmount > 0) {
                lines.push({
                    accountCode: '5200', // Sales Discounts / SC-PWD Expense
                    accountName: 'Sales Discounts & Allowances',
                    debitAmount: totals.discountAmount,
                    creditAmount: 0,
                    description: `Discount on ${orderNumber} (${totals.discountType})`,
                });
            }

            // Credit Sales Revenue
            lines.push({
                accountCode: '4010', // Sales Revenue — QSR / Fried Chicken
                accountName: 'Sales Revenue — Fried Chicken & Meals',
                debitAmount: 0,
                creditAmount: totals.grossTotal,
                description: `Revenue from ${orderNumber}`,
            });

            const entry = await this.journalEntryService.createEntry({
                entryDate: orderDate,
                description: `Crispy King POS Sale — ${orderNumber}`,
                entryType: 'auto',
                sourceTable: 'marketplace_orders',
                sourceId: createdOrderId,
                postedBy: input.cashierId,
                lines,
            });

            journalEntryId = entry.id;
        } catch (jeErr) {
            console.warn('[QSRPosService] Auto-posting journal entry failed:', jeErr);
        }

        return {
            orderNumber,
            totals,
            paymentResult,
            journalEntryId,
        };
    }
}
