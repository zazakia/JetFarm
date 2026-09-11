import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../../../database';
import WsDelivery from '../../../database/models/WsDelivery';
import ActionLogService from '../../../services/ActionLogService';
import { ModuleAccountingBridge } from '../../core/ModuleAccountingBridge';
import { WaterStationModule } from '../manifest';
import { WsPaymentService } from './WsPaymentService';

export interface WsDeliveryInput {
    customerId: string;
    deliveryDate: Date;
    gallons: number;
    pricePerGallon: number;
    isPaidOnDelivery: boolean;
    paymentMethod?: 'cash' | 'gcash';
}

export class WsDeliveryServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    async getAll(): Promise<WsDelivery[]> {
        return await this.db.collections.get<WsDelivery>('ws_deliveries').query(
            Q.where('deleted_at', Q.eq(null))
        ).fetch();
    }

    async getById(id: string): Promise<WsDelivery | null> {
        try {
            return await this.db.collections.get<WsDelivery>('ws_deliveries').find(id);
        } catch {
            return null;
        }
    }

    async createDelivery(input: WsDeliveryInput, performedBy?: string): Promise<WsDelivery> {
        const totalAmount = input.gallons * input.pricePerGallon;
        let delivery!: WsDelivery;

        await this.db.write(async () => {
            delivery = await this.db.get<WsDelivery>('ws_deliveries').create(record => {
                record.customerId = input.customerId;
                record.deliveryDate = input.deliveryDate.getTime();
                record.gallons = input.gallons;
                record.pricePerGallon = input.pricePerGallon;
                record.totalAmount = totalAmount;
                record.status = input.isPaidOnDelivery ? 'delivered' : 'pending';
            });
        });

        await ActionLogService.logAction({
            entityType: 'ws_deliveries',
            entityId: delivery.id,
            action: 'CREATE',
            newData: delivery._raw,
            performedBy
        });

        // Trigger accounting double-entry
        if (input.isPaidOnDelivery) {
            // Post journal entry directly for Cash sale
            // Debit: 1015 (Cash on Hand - Water Station)
            // Credit: 4100 (Water Sales Revenue)
            await ModuleAccountingBridge.postModuleEntry(
                WaterStationModule,
                {
                    entryDate: input.deliveryDate,
                    description: `Cash Sale - ${input.gallons} gal @ ₱${input.pricePerGallon}/gal`,
                    entryType: 'auto',
                    lines: [
                        {
                            accountCode: '1015',
                            accountName: 'Cash on Hand — Water Station',
                            debitAmount: totalAmount
                        },
                        {
                            accountCode: '4100',
                            accountName: 'Water Sales Revenue',
                            creditAmount: totalAmount
                        }
                    ],
                    sourceTable: 'ws_deliveries',
                    sourceId: delivery.id,
                    postedBy: performedBy
                },
                performedBy
            );

            // Record the payment
            const paymentService = new WsPaymentServiceClass(this.db);
            await paymentService.createPayment({
                customerId: input.customerId,
                deliveryId: delivery.id,
                paymentDate: input.deliveryDate,
                amount: totalAmount,
                paymentMethod: input.paymentMethod ?? 'cash',
                skipAccounting: true // Already posted in the block above
            }, performedBy);
        } else {
            // Post journal entry for Account/Receivable sale
            // Debit: 1500 (Other Receivables / Accounts Receivable)
            // Credit: 4100 (Water Sales Revenue)
            await ModuleAccountingBridge.postModuleEntry(
                WaterStationModule,
                {
                    entryDate: input.deliveryDate,
                    description: `Charge Sale - ${input.gallons} gal @ ₱${input.pricePerGallon}/gal`,
                    entryType: 'auto',
                    lines: [
                        {
                            accountCode: '1500',
                            accountName: 'Other Receivables',
                            debitAmount: totalAmount
                        },
                        {
                            accountCode: '4100',
                            accountName: 'Water Sales Revenue',
                            creditAmount: totalAmount
                        }
                    ],
                    sourceTable: 'ws_deliveries',
                    sourceId: delivery.id,
                    postedBy: performedBy
                },
                performedBy
            );
        }

        return delivery;
    }

    async completeDelivery(id: string, paymentMethod: 'cash' | 'gcash', performedBy?: string): Promise<WsDelivery> {
        const delivery = await this.getById(id);
        if (!delivery) throw new Error(`Delivery with ID ${id} not found.`);
        if (delivery.status === 'delivered') throw new Error(`Delivery is already completed.`);

        await this.db.write(async () => {
            await delivery.update(record => {
                record.status = 'delivered';
            });
        });

        await ActionLogService.logAction({
            entityType: 'ws_deliveries',
            entityId: delivery.id,
            action: 'UPDATE',
            newData: delivery._raw,
            performedBy
        });

        // Since it was 'pending' (Charge Sale), we now collect the payment.
        // This is a payment on account:
        // Debit: 1015 (Cash on Hand - Water Station)
        // Credit: 1500 (Other Receivables)
        const paymentService = new WsPaymentServiceClass(this.db);
        await paymentService.createPayment({
            customerId: delivery.customerId,
            deliveryId: delivery.id,
            paymentDate: new Date(),
            amount: delivery.totalAmount,
            paymentMethod,
            skipAccounting: false // Post accounting entry
        }, performedBy);

        return delivery;
    }
}

// Inline definition to prevent circular dependency
class WsPaymentServiceClass {
    constructor(private db: Database) {}

    async createPayment(
        input: {
            customerId: string;
            deliveryId?: string;
            paymentDate: Date;
            amount: number;
            paymentMethod: 'cash' | 'gcash';
            skipAccounting?: boolean;
        },
        performedBy?: string
    ) {
        let payment;
        await this.db.write(async () => {
            payment = await this.db.get('ws_payments').create((record: any) => {
                record.customerId = input.customerId;
                record.deliveryId = input.deliveryId ?? null;
                record.paymentDate = input.paymentDate.getTime();
                record.amount = input.amount;
                record.paymentMethod = input.paymentMethod;
            });
        });

        await ActionLogService.logAction({
            entityType: 'ws_payments',
            entityId: (payment as any).id,
            action: 'CREATE',
            newData: (payment as any)._raw,
            performedBy
        });

        if (!input.skipAccounting) {
            await ModuleAccountingBridge.postModuleEntry(
                WaterStationModule,
                {
                    entryDate: input.paymentDate,
                    description: `Payment Received on Account - Method: ${input.paymentMethod.toUpperCase()}`,
                    entryType: 'auto',
                    lines: [
                        {
                            accountCode: '1015',
                            accountName: 'Cash on Hand — Water Station',
                            debitAmount: input.amount
                        },
                        {
                            accountCode: '1500',
                            accountName: 'Other Receivables',
                            creditAmount: input.amount
                        }
                    ],
                    sourceTable: 'ws_payments',
                    sourceId: (payment as any).id,
                    postedBy: performedBy
                },
                performedBy
            );
        }
        return payment;
    }
}

export const WsDeliveryService = new WsDeliveryServiceClass();
export default WsDeliveryService;
