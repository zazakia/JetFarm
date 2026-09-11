import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, children } from '@nozbe/watermelondb/decorators';

export default class SalesReturn extends Model {
    static table = 'sales_returns';

    @field('return_number') returnNumber!: string;
    @field('original_order_number') originalOrderNumber?: string;
    @field('original_order_id') originalOrderId?: string;
    @field('customer_id') customerId?: string;
    @field('customer_name') customerName?: string;
    @field('branch_id') branchId!: string;
    @field('warehouse_id') warehouseId?: string;
    /** 'draft' | 'approved' | 'rejected' | 'completed' */
    @field('status') status!: string;
    @field('reason') reason!: string;
    @field('total_refund_amount') totalRefundAmount!: number;
    /** 'cash' | 'credit' | 'charge_invoice' */
    @field('refund_method') refundMethod!: string;
    @field('created_by') createdBy!: string;
    @field('approved_by') approvedBy?: string;
    @date('approved_at') approvedAt?: Date;
    @date('completed_at') completedAt?: Date;
    @field('notes') notes?: string;

    @readonly @date('created_at') createdAt!: Date;
    @readonly @date('updated_at') updatedAt!: Date;
    @date('deleted_at') deletedAt?: Date;

    @children('sales_return_lines') lines!: any;
}
