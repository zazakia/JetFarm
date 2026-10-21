import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const mySchema = appSchema({
    version: 50,
    tables: [
        tableSchema({
            name: 'branches',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'code', type: 'string', isOptional: true },
                { name: 'is_hq', type: 'boolean', isOptional: true },
                { name: 'is_active', type: 'boolean', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'warehouses',
            columns: [
                { name: 'branch_id', type: 'string', isIndexed: true },
                { name: 'name', type: 'string' },
                { name: 'type', type: 'string', isOptional: true }, // e.g. store, transit, quarantine
                { name: 'is_active', type: 'boolean', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'user_branch_roles',
            columns: [
                { name: 'user_id', type: 'string', isIndexed: true },
                { name: 'branch_id', type: 'string', isIndexed: true },
                { name: 'role', type: 'string' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'user_profiles',
            columns: [
                { name: 'full_name', type: 'string' },
                { name: 'email', type: 'string', isOptional: true },
                { name: 'role', type: 'string', isOptional: true },
                { name: 'is_active', type: 'boolean', isOptional: true },
                { name: 'branch_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'area_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'expenses',
            columns: [
                { name: 'category', type: 'string' },
                { name: 'description', type: 'string', isOptional: true },
                { name: 'payee', type: 'string', isOptional: true },
                { name: 'tin', type: 'string', isOptional: true },
                { name: 'invoice_number', type: 'string', isOptional: true },
                { name: 'vat_amount', type: 'number', isOptional: true },
                { name: 'amount', type: 'number' },
                { name: 'expense_date', type: 'number' },
                { name: 'frequency', type: 'string', isOptional: true },
                { name: 'encoded_by', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'cash_transactions',
            columns: [
                { name: 'transaction_date', type: 'number' },
                { name: 'branch_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'particulars', type: 'string' },
                { name: 'type', type: 'string' },
                { name: 'amount', type: 'number' },
                { name: 'remarks', type: 'string', isOptional: true },
                { name: 'recorded_by', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
                { name: 'is_petty_cash', type: 'boolean', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'bank_accounts',
            columns: [
                { name: 'bank_name', type: 'string' },
                { name: 'account_name', type: 'string' },
                { name: 'account_number', type: 'string' },
                { name: 'starting_balance', type: 'number' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'bank_transactions',
            columns: [
                { name: 'bank_account_id', type: 'string', isIndexed: true },
                { name: 'transaction_date', type: 'number' },
                { name: 'type', type: 'string' },
                { name: 'amount', type: 'number' },
                { name: 'particulars', type: 'string' },
                { name: 'remarks', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
                { name: 'is_cleared', type: 'boolean', isOptional: true },
                { name: 'cleared_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'financial_snapshots',
            columns: [
                { name: 'snapshot_date', type: 'number' },
                { name: 'total_assets', type: 'number' },
                { name: 'total_equity', type: 'number' },
                { name: 'total_liabilities', type: 'number' },
                { name: 'loan_loss_reserve', type: 'number' },
                { name: 'operating_revenue', type: 'number' },
                { name: 'financial_costs', type: 'number' },
                { name: 'subsidy_adjustment', type: 'number', isOptional: true },
                { name: 'inflation_adjustment', type: 'number', isOptional: true },
                { name: 'risk_weighted_assets', type: 'number', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'expense_categories',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'is_active', type: 'boolean', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'action_logs',
            columns: [
                { name: 'entity_type', type: 'string', isIndexed: true },
                { name: 'entity_id', type: 'string', isIndexed: true },
                { name: 'action', type: 'string' },
                { name: 'performed_by', type: 'string', isIndexed: true },
                { name: 'old_data', type: 'string', isOptional: true },
                { name: 'new_data', type: 'string', isOptional: true },
                { name: 'timestamp', type: 'number' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'app_settings',
            columns: [
                { name: 'key', type: 'string', isIndexed: true },
                { name: 'value', type: 'string', isOptional: true },
                { name: 'value_type', type: 'string' },
                { name: 'scope', type: 'string', isIndexed: true },
                { name: 'is_active', type: 'boolean', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'feature_flags',
            columns: [
                { name: 'key', type: 'string', isIndexed: true },
                { name: 'label', type: 'string' },
                { name: 'description', type: 'string', isOptional: true },
                { name: 'category', type: 'string', isOptional: true },
                { name: 'enabled', type: 'boolean', isOptional: true },
                { name: 'sort_order', type: 'number', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'role_permissions',
            columns: [
                { name: 'role', type: 'string', isIndexed: true },
                { name: 'permission_key', type: 'string', isIndexed: true },
                { name: 'label', type: 'string' },
                { name: 'category', type: 'string', isOptional: true },
                { name: 'enabled', type: 'boolean', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'areas',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'code', type: 'string', isOptional: true },
                { name: 'parent_area_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'ao_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'is_active', type: 'boolean', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'chart_of_accounts',
            columns: [
                { name: 'code', type: 'string', isIndexed: true },
                { name: 'name', type: 'string' },
                { name: 'account_type', type: 'string' },        // asset | liability | equity | income | expense
                { name: 'normal_balance', type: 'string' },      // debit | credit
                { name: 'parent_code', type: 'string', isOptional: true },
                { name: 'is_header', type: 'boolean', isOptional: true },
                { name: 'is_active', type: 'boolean', isOptional: true },
                { name: 'description', type: 'string', isOptional: true },
                { name: 'sort_order', type: 'number', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'journal_entries',
            columns: [
                { name: 'entry_date', type: 'number', isIndexed: true },
                { name: 'reference_number', type: 'string', isIndexed: true },
                { name: 'description', type: 'string' },
                { name: 'entry_type', type: 'string' },          // auto | manual | adjusting | closing | reversing
                { name: 'source_table', type: 'string', isOptional: true },
                { name: 'source_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'posted_by', type: 'string', isOptional: true },
                { name: 'is_posted', type: 'boolean', isOptional: true },
                { name: 'total_debit', type: 'number' },
                { name: 'total_credit', type: 'number' },
                { name: 'fiscal_year', type: 'number', isOptional: true },
                { name: 'fiscal_month', type: 'number', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'journal_entry_lines',
            columns: [
                { name: 'journal_entry_id', type: 'string', isIndexed: true },
                { name: 'account_code', type: 'string', isIndexed: true },
                { name: 'account_name', type: 'string', isOptional: true },
                { name: 'debit_amount', type: 'number', isOptional: true },
                { name: 'credit_amount', type: 'number', isOptional: true },
                { name: 'description', type: 'string', isOptional: true },
                { name: 'business_unit_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'module_source_table', type: 'string', isOptional: true },
                { name: 'module_source_id', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'statutory_fund_allocations',
            columns: [
                { name: 'fiscal_year', type: 'number', isIndexed: true },
                { name: 'fiscal_month', type: 'number', isOptional: true },
                { name: 'fund_type', type: 'string' }, // reserve | education | union_federation | community_dev | optional | interest_on_capital | patronage_refund
                { name: 'amount', type: 'number' },
                { name: 'percentage', type: 'number' },
                { name: 'notes', type: 'string', isOptional: true },
                { name: 'performed_by', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'financial_period_settings',
            columns: [
                { name: 'fiscal_year', type: 'number', isIndexed: true },
                { name: 'authorized_share_capital', type: 'number' },
                { name: 'subscribed_capital', type: 'number' },
                { name: 'subscription_receivable', type: 'number' },
                { name: 'sundry_assets', type: 'number' },
                { name: 'prior_year_data', type: 'string' }, // JSON string with prior-year comparative figures
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'business_units',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'slug', type: 'string', isIndexed: true },
                { name: 'module_id', type: 'string' },
                { name: 'branch_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'is_active', type: 'boolean', isOptional: true },
                { name: 'description', type: 'string', isOptional: true },
                { name: 'area_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'area_supervisor_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'suppliers',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'contact_person', type: 'string', isOptional: true },
                { name: 'phone', type: 'string', isOptional: true },
                { name: 'email', type: 'string', isOptional: true },
                { name: 'address', type: 'string', isOptional: true },
                { name: 'tin', type: 'string', isOptional: true },
                { name: 'payment_terms_days', type: 'number', isOptional: true },
                { name: 'is_active', type: 'boolean', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'accounts_payable_vouchers',
            columns: [
                { name: 'supplier_id', type: 'string', isIndexed: true },
                { name: 'voucher_number', type: 'string', isIndexed: true },
                { name: 'invoice_number', type: 'string', isOptional: true },
                { name: 'invoice_date', type: 'number' },
                { name: 'due_date', type: 'number', isOptional: true },
                { name: 'description', type: 'string' },
                { name: 'amount', type: 'number' },
                { name: 'amount_paid', type: 'number', isOptional: true },
                { name: 'balance', type: 'number' },
                { name: 'status', type: 'string' },
                { name: 'expense_account_code', type: 'string', isOptional: true },
                { name: 'module_id', type: 'string', isOptional: true },
                { name: 'posted_by', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'stock_movements',
            columns: [
                { name: 'product_id', type: 'string', isIndexed: true },
                { name: 'product_source', type: 'string' },
                { name: 'module_id', type: 'string', isIndexed: true },
                { name: 'warehouse_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'branch_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'movement_type', type: 'string' },
                { name: 'quantity_in', type: 'number', isOptional: true },
                { name: 'quantity_out', type: 'number', isOptional: true },
                { name: 'quantity_balance', type: 'number' },
                { name: 'unit_cost', type: 'number', isOptional: true },
                { name: 'total_cost', type: 'number', isOptional: true },
                { name: 'reference_number', type: 'string', isOptional: true },
                { name: 'source_table', type: 'string', isOptional: true },
                { name: 'source_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'journal_entry_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'movement_date', type: 'number', isIndexed: true },
                { name: 'notes', type: 'string', isOptional: true },
                { name: 'performed_by', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'statutory_rates',
            columns: [
                { name: 'rate_type', type: 'string', isIndexed: true },
                { name: 'bracket_min', type: 'number' },
                { name: 'bracket_max', type: 'number', isOptional: true },
                { name: 'employee_share', type: 'number' },
                { name: 'employer_share', type: 'number' },
                { name: 'effective_from', type: 'number' },
                { name: 'effective_to', type: 'number', isOptional: true },
                { name: 'description', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'agri_parcels',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'code', type: 'string', isOptional: true, isIndexed: true },
                { name: 'land_owner_id', type: 'string', isIndexed: true },
                { name: 'area_hectares', type: 'number' },
                { name: 'location_address', type: 'string', isOptional: true },
                { name: 'gps_coordinates', type: 'string', isOptional: true },
                { name: 'gps_exclusions', type: 'string', isOptional: true },
                { name: 'boundary_revision', type: 'number' },
                { name: 'layout_revision', type: 'number' },
                { name: 'boundary_saved_at', type: 'number', isOptional: true },
                { name: 'soil_type', type: 'string', isOptional: true },
                { name: 'status', type: 'string', isIndexed: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'agri_land_owners',
            columns: [
                { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'name', type: 'string' },
                { name: 'contact_number', type: 'string', isOptional: true },
                { name: 'bank_name', type: 'string', isOptional: true },
                { name: 'account_number', type: 'string', isOptional: true },
                { name: 'default_per_kilo_rate', type: 'number' },
                { name: 'default_guaranteed_minimum', type: 'number' },
                { name: 'notes', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'agri_investors',
            columns: [
                { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'company_name', type: 'string' },
                { name: 'contact_person', type: 'string', isOptional: true },
                { name: 'contact_number', type: 'string', isOptional: true },
                { name: 'email', type: 'string', isOptional: true },
                { name: 'default_offtake_price_per_kg', type: 'number' },
                { name: 'notes', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'agri_crop_cycles',
            columns: [
                { name: 'cycle_code', type: 'string', isIndexed: true },
                { name: 'parcel_id', type: 'string', isIndexed: true },
                { name: 'investor_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'crop_type', type: 'string' },
                { name: 'variety', type: 'string', isOptional: true },
                { name: 'planting_date', type: 'number', isIndexed: true },
                { name: 'target_harvest_date', type: 'number', isOptional: true },
                { name: 'actual_harvest_date', type: 'number', isOptional: true },
                { name: 'area_planted_ha', type: 'number' },
                { name: 'status', type: 'string', isIndexed: true },
                { name: 'expected_yield_kg', type: 'number' },
                { name: 'total_actual_yield_kg', type: 'number' },
                { name: 'capital_allocated', type: 'number' },
                { name: 'land_owner_rate_per_kg', type: 'number' },
                { name: 'land_owner_guaranteed_min', type: 'number' },
                { name: 'offtake_price_per_kg', type: 'number' },
                { name: 'notes', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'agri_growth_checkins',
            columns: [
                { name: 'crop_cycle_id', type: 'string', isIndexed: true },
                { name: 'checkin_date', type: 'number', isIndexed: true },
                { name: 'stage', type: 'string' },
                { name: 'plant_height_cm', type: 'number', isOptional: true },
                { name: 'health_status', type: 'string' },
                { name: 'notes', type: 'string', isOptional: true },
                { name: 'photo_uri', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'agri_harvest_logs',
            columns: [
                { name: 'crop_cycle_id', type: 'string', isIndexed: true },
                { name: 'parcel_id', type: 'string', isIndexed: true },
                { name: 'harvest_date', type: 'number', isIndexed: true },
                { name: 'batch_number', type: 'string', isIndexed: true },
                { name: 'gross_weight_kg', type: 'number' },
                { name: 'tare_weight_kg', type: 'number' },
                { name: 'net_weight_kg', type: 'number' },
                { name: 'quality_grade', type: 'string', isOptional: true },
                { name: 'truck_plate_number', type: 'string', isOptional: true },
                { name: 'weigh_in_supervisor', type: 'string', isOptional: true },
                { name: 'photo_uri', type: 'string', isOptional: true },
                { name: 'notes', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'agri_farm_expenses',
            columns: [
                { name: 'crop_cycle_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'parcel_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'expense_date', type: 'number', isIndexed: true },
                { name: 'category', type: 'string', isIndexed: true },
                { name: 'description', type: 'string' },
                { name: 'amount', type: 'number' },
                { name: 'paid_by', type: 'string' },
                { name: 'receipt_photo_uri', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'agri_farm_workers',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'contact_number', type: 'string', isOptional: true },
                { name: 'specialization', type: 'string', isOptional: true },
                { name: 'daily_rate', type: 'number' },
                { name: 'status', type: 'string', isIndexed: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'agri_labor_logs',
            columns: [
                { name: 'worker_id', type: 'string', isIndexed: true },
                { name: 'crop_cycle_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'work_date', type: 'number', isIndexed: true },
                { name: 'task', type: 'string' },
                { name: 'rate_type', type: 'string' },
                { name: 'units_completed', type: 'number' },
                { name: 'rate_per_unit', type: 'number' },
                { name: 'total_pay', type: 'number' },
                { name: 'payment_status', type: 'string', isIndexed: true },
                { name: 'notes', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'agri_weekly_settlements',
            columns: [
                { name: 'crop_cycle_id', type: 'string', isIndexed: true },
                { name: 'land_owner_id', type: 'string', isIndexed: true },
                { name: 'week_number', type: 'number', isIndexed: true },
                { name: 'week_start_date', type: 'number' },
                { name: 'week_end_date', type: 'number' },
                { name: 'cumulative_kilos', type: 'number' },
                { name: 'rate_per_kilo', type: 'number' },
                { name: 'raw_kilo_earnings', type: 'number' },
                { name: 'guaranteed_minimum', type: 'number' },
                { name: 'target_cumulative_payout', type: 'number' },
                { name: 'previous_cumulative_payout', type: 'number' },
                { name: 'net_payout_due_this_week', type: 'number' },
                { name: 'payment_status', type: 'string', isIndexed: true },
                { name: 'disbursement_date', type: 'number', isOptional: true },
                { name: 'receipt_reference', type: 'string', isOptional: true },
                { name: 'calculation_breakdown_json', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'agri_investor_ledgers',
            columns: [
                { name: 'investor_id', type: 'string', isIndexed: true },
                { name: 'crop_cycle_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'transaction_date', type: 'number', isIndexed: true },
                { name: 'type', type: 'string', isIndexed: true },
                { name: 'kilos_received', type: 'number', isOptional: true },
                { name: 'price_per_kilo', type: 'number', isOptional: true },
                { name: 'amount', type: 'number' },
                { name: 'balance_running', type: 'number' },
                { name: 'notes', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'agri_parcel_blocks',
            columns: [
                { name: 'parcel_id', type: 'string', isIndexed: true },
                { name: 'name', type: 'string' },
                { name: 'code', type: 'string', isOptional: true },
                { name: 'geometry_json', type: 'string' },
                { name: 'area_hectares', type: 'number' },
                { name: 'status', type: 'string', isIndexed: true },
                { name: 'boundary_revision', type: 'number' },
                { name: 'layout_revision', type: 'number' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'agri_block_assignments',
            columns: [
                { name: 'block_id', type: 'string', isIndexed: true },
                { name: 'worker_id', type: 'string', isIndexed: true },
                { name: 'crop_cycle_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'task', type: 'string' },
                { name: 'start_date', type: 'number' },
                { name: 'due_date', type: 'number', isOptional: true },
                { name: 'status', type: 'string', isIndexed: true },
                { name: 'progress_percent', type: 'number' },
                { name: 'created_by', type: 'string' },
                { name: 'assigned_geometry_snapshot', type: 'string' },
                { name: 'assigned_boundary_revision', type: 'number' },
                { name: 'submission_id', type: 'string', isIndexed: true },
                { name: 'request_json', type: 'string' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number', isOptional: true },
            ]
        }),
        tableSchema({
            name: 'agri_block_progress',
            columns: [
                { name: 'assignment_id', type: 'string', isIndexed: true },
                { name: 'update_date', type: 'number' },
                { name: 'progress_percent', type: 'number' },
                { name: 'status', type: 'string' },
                { name: 'notes', type: 'string', isOptional: true },
                { name: 'recorded_by', type: 'string' },
                { name: 'submission_id', type: 'string', isIndexed: true },
                { name: 'correction_of_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'request_json', type: 'string' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ]
        }),
        tableSchema({
            name: 'agri_pending_layout_operations',
            columns: [
                { name: 'operation_id', type: 'string', isIndexed: true },
                { name: 'parcel_id', type: 'string', isIndexed: true },
                { name: 'expected_revision', type: 'number' },
                { name: 'payload_json', type: 'string' },
                { name: 'created_by', type: 'string' },
                { name: 'state', type: 'string', isIndexed: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ]
        }),
    ]
})

