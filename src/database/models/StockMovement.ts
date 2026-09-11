import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class StockMovement extends Model {
    static table = 'stock_movements'

    @field('product_id') productId!: string
    /** marketplace_products | agri_products | pharmacy_products */
    @field('product_source') productSource!: string
    @field('module_id') moduleId!: string
    @field('warehouse_id') warehouseId?: string | null
    @field('branch_id') branchId?: string | null
    /** purchase | sale | adjustment | return | transfer | beginning */
    @field('movement_type') movementType!: string
    @field('quantity_in') quantityIn!: number | null
    @field('quantity_out') quantityOut!: number | null
    @field('quantity_balance') quantityBalance!: number
    @field('unit_cost') unitCost!: number | null
    @field('total_cost') totalCost!: number | null
    @field('reference_number') referenceNumber!: string | null
    @field('source_table') sourceTable!: string | null
    @field('source_id') sourceId!: string | null
    @field('journal_entry_id') journalEntryId!: string | null
    @date('movement_date') movementDate!: Date
    @field('notes') notes!: string | null
    @field('performed_by') performedBy!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
