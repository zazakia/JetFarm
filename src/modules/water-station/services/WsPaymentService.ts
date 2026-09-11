import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../../../database';
import WsPayment from '../../../database/models/WsPayment';
import ActionLogService from '../../../services/ActionLogService';
import { ModuleAccountingBridge } from '../../core/ModuleAccountingBridge';
import { WaterStationModule } from '../manifest';

export interface WsPaymentInput {
    customerId: string;
    deliveryId?: string;
    paymentDate: Date;
    amount: number;
    paymentMethod: 'cash' | 'gcash';
    skipAccounting?: boolean;
}

export class WsPaymentServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    async getAll(): Promise<WsPayment[]> {
        return await this.db.collections.get<WsPayment>('ws_payments').query(
            Q.where('deleted_at', Q.eq(null))
        ).fetch();
    }

    async getById(id: string): Promise<WsPayment | null> {
        try {
            return await this.db.collections.get<WsPayment>('ws_payments').find(id);
        } catch {
            return null;
        }
    }

    async createPayment(input: WsPaymentInput, performedBy?: string): Promise<WsPayment> {
        let payment!: WsPayment;
        await this.db.write(async () => {
            payment = await this.db.get<WsPayment>('ws_payments').create(record => {
                record.customerId = input.customerId;
                record.deliveryId = input.deliveryId ?? null;
                record.paymentDate = input.paymentDate.getTime();
                record.amount = input.amount;
                record.paymentMethod = input.paymentMethod;
            });
        });

        await ActionLogService.logAction({
            entityType: 'ws_payments',
            entityId: payment.id,
            action: 'CREATE',
            newData: payment._raw,
            performedBy
        });

        if (!input.skipAccounting) {
            // Post journal entry for payment collection on account:
            // Debit: 1015 (Cash on Hand - Water Station)
            // Credit: 1500 (Other Receivables)
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
                    sourceId: payment.id,
                    postedBy: performedBy
                },
                performedBy
            );
        }

        return payment;
    }
}

export const WsPaymentService = new WsPaymentServiceClass();
export default WsPaymentService;
