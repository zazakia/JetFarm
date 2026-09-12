const fs = require('fs');
const path = require('path');

const models = {
  'AgriLandOwner.ts': `import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriLandOwner extends Model {
    static table = 'agri_land_owners'

    @field('user_id') userId!: string | null
    @field('name') name!: string
    @field('contact_number') contactNumber!: string | null
    @field('bank_name') bankName!: string | null
    @field('account_number') accountNumber!: string | null
    @field('default_per_kilo_rate') defaultPerKiloRate!: number
    @field('default_guaranteed_minimum') defaultGuaranteedMinimum!: number
    @field('notes') notes!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
`,
  'AgriInvestor.ts': `import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriInvestor extends Model {
    static table = 'agri_investors'

    @field('user_id') userId!: string | null
    @field('company_name') companyName!: string
    @field('contact_person') contactPerson!: string | null
    @field('contact_number') contactNumber!: string | null
    @field('email') email!: string | null
    @field('default_offtake_price_per_kg') defaultOfftakePricePerKg!: number
    @field('notes') notes!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
`,
  'AgriCropCycle.ts': `import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriCropCycle extends Model {
    static table = 'agri_crop_cycles'

    @field('cycle_code') cycleCode!: string
    @field('parcel_id') parcelId!: string
    @field('investor_id') investorId!: string | null
    @field('crop_type') cropType!: string
    @field('variety') variety!: string | null
    @date('planting_date') plantingDate!: Date
    @date('target_harvest_date') targetHarvestDate!: Date | null
    @date('actual_harvest_date') actualHarvestDate!: Date | null
    @field('area_planted_ha') areaPlantedHa!: number
    @field('status') status!: string // planning, land_prep, planted, growing, harvesting, completed, closed
    @field('expected_yield_kg') expectedYieldKg!: number
    @field('total_actual_yield_kg') totalActualYieldKg!: number
    @field('capital_allocated') capitalAllocated!: number
    @field('land_owner_rate_per_kg') landOwnerRatePerKg!: number
    @field('land_owner_guaranteed_min') landOwnerGuaranteedMin!: number
    @field('offtake_price_per_kg') offtakePricePerKg!: number
    @field('notes') notes!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
`,
  'AgriGrowthCheckin.ts': `import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriGrowthCheckin extends Model {
    static table = 'agri_growth_checkins'

    @field('crop_cycle_id') cropCycleId!: string
    @date('checkin_date') checkinDate!: Date
    @field('stage') stage!: string // land_prep, germination, vegetative, root_bulking, maturity
    @field('plant_height_cm') plantHeightCm!: number | null
    @field('health_status') healthStatus!: string // excellent, good, fair, pest_risk, diseased
    @field('notes') notes!: string | null
    @field('photo_uri') photoUri!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
`,
  'AgriHarvestLog.ts': `import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriHarvestLog extends Model {
    static table = 'agri_harvest_logs'

    @field('crop_cycle_id') cropCycleId!: string
    @field('parcel_id') parcelId!: string
    @date('harvest_date') harvestDate!: Date
    @field('batch_number') batchNumber!: string
    @field('gross_weight_kg') grossWeightKg!: number
    @field('tare_weight_kg') tareWeightKg!: number
    @field('net_weight_kg') netWeightKg!: number
    @field('quality_grade') qualityGrade!: string | null
    @field('truck_plate_number') truckPlateNumber!: string | null
    @field('weigh_in_supervisor') weighInSupervisor!: string | null
    @field('photo_uri') photoUri!: string | null
    @field('notes') notes!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
`,
  'AgriFarmExpense.ts': `import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriFarmExpense extends Model {
    static table = 'agri_farm_expenses'

    @field('crop_cycle_id') cropCycleId!: string | null
    @field('parcel_id') parcelId!: string | null
    @date('expense_date') expenseDate!: Date
    @field('category') category!: string
    @field('description') description!: string
    @field('amount') amount!: number
    @field('paid_by') paidBy!: string // jet, investor
    @field('receipt_photo_uri') receiptPhotoUri!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
`,
  'AgriFarmWorker.ts': `import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriFarmWorker extends Model {
    static table = 'agri_farm_workers'

    @field('name') name!: string
    @field('contact_number') contactNumber!: string | null
    @field('specialization') specialization!: string | null
    @field('daily_rate') dailyRate!: number
    @field('status') status!: string // active, inactive

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
`,
  'AgriLaborLog.ts': `import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriLaborLog extends Model {
    static table = 'agri_labor_logs'

    @field('worker_id') workerId!: string
    @field('crop_cycle_id') cropCycleId!: string | null
    @date('work_date') workDate!: Date
    @field('task') task!: string
    @field('rate_type') rateType!: string // daily, piece_rate
    @field('units_completed') unitsCompleted!: number
    @field('rate_per_unit') ratePerUnit!: number
    @field('total_pay') totalPay!: number
    @field('payment_status') paymentStatus!: string // pending, paid
    @field('notes') notes!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
`,
  'AgriWeeklySettlement.ts': `import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriWeeklySettlement extends Model {
    static table = 'agri_weekly_settlements'

    @field('crop_cycle_id') cropCycleId!: string
    @field('land_owner_id') landOwnerId!: string
    @field('week_number') weekNumber!: number
    @date('week_start_date') weekStartDate!: Date
    @date('week_end_date') weekEndDate!: Date
    @field('cumulative_kilos') cumulativeKilos!: number
    @field('rate_per_kilo') ratePerKilo!: number
    @field('raw_kilo_earnings') rawKiloEarnings!: number
    @field('guaranteed_minimum') guaranteedMinimum!: number
    @field('target_cumulative_payout') targetCumulativePayout!: number
    @field('previous_cumulative_payout') previousCumulativePayout!: number
    @field('net_payout_due_this_week') netPayoutDueThisWeek!: number
    @field('payment_status') paymentStatus!: string // draft, approved, paid
    @date('disbursement_date') disbursementDate!: Date | null
    @field('receipt_reference') receiptReference!: string | null
    @field('calculation_breakdown_json') calculationBreakdownJson!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
`,
  'AgriInvestorLedger.ts': `import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriInvestorLedger extends Model {
    static table = 'agri_investor_ledgers'

    @field('investor_id') investorId!: string
    @field('crop_cycle_id') cropCycleId!: string | null
    @date('transaction_date') transactionDate!: Date
    @field('type') type!: string // capital_injection, equipment_provision, harvest_offtake, payout_refund
    @field('kilos_received') kilosReceived!: number | null
    @field('price_per_kilo') pricePerKilo!: number | null
    @field('amount') amount!: number
    @field('balance_running') balanceRunning!: number
    @field('notes') notes!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
`
};

const dir = path.join(__dirname, '..', 'src', 'database', 'models');
for (const [filename, content] of Object.entries(models)) {
  fs.writeFileSync(path.join(dir, filename), content, 'utf8');
  console.log('Created ' + filename);
}
