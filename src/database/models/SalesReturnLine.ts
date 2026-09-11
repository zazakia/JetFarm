import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';

export default class SalesReturnLine extends Model {
    static table = 'sales_return_lines';

    @field('sales_return_id') salesReturnId!: string;
    @field('product_id') productId!: string;
    @field('product_name') productName!: string;
    @field('sku') sku?: string;
    @field('return_quantity') returnQuantity!: number;
    @field('uom') uom?: string;
    @field('uom_multiplier') uomMultiplier?: number;
    @field('base_quantity') baseQuantity!: number;
    @field('unit_price') unitPrice!: number;
    @field('total_amount') totalAmount!: number;
    /** 'good' | 'damaged' | 'expired' */
    @field('condition') condition!: string;
    /** 'restock_shelf' | 'waste_log' */
    @field('restock_action') restockAction!: string;

    @readonly @date('created_at') createdAt!: Date;
    @readonly @date('updated_at') updatedAt!: Date;
    @date('deleted_at') deletedAt?: Date;

    @relation('sales_returns', 'sales_return_id') salesReturn!: any;
}
