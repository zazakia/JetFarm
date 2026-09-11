import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import BusinessUnit from '../database/models/BusinessUnit';
import { ChartOfAccountsServiceClass } from './ChartOfAccountsService';
import ActionLogService from './ActionLogService';
import { CoopModule } from '../modules/core/BaseModule';

export class BusinessUnitServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    /**
     * Get all active business units
     */
    async getAll(): Promise<BusinessUnit[]> {
        return await this.db.collections.get<BusinessUnit>('business_units').query(
            Q.where('deleted_at', Q.eq(null))
        ).fetch();
    }

    /**
     * Get active business unit by slug
     */
    async getBySlug(slug: string): Promise<BusinessUnit | null> {
        const results = await this.db.collections.get<BusinessUnit>('business_units').query(
            Q.where('slug', slug),
            Q.where('deleted_at', Q.eq(null))
        ).fetch();
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Get active business unit by module ID
     */
    async getByModuleId(moduleId: string): Promise<BusinessUnit | null> {
        const results = await this.db.collections.get<BusinessUnit>('business_units').query(
            Q.where('module_id', moduleId),
            Q.where('deleted_at', Q.eq(null))
        ).fetch();
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Registers and enables a business unit module
     */
    async registerModule(module: CoopModule, performedBy?: string): Promise<BusinessUnit> {
        const existing = await this.getByModuleId(module.id);
        if (existing) {
            if (!existing.isActive) {
                // Reactivate
                await this.db.write(async () => {
                    await existing.update(record => {
                        record.isActive = true;
                    });
                });
                await ActionLogService.logAction({
                    entityType: 'business_units',
                    entityId: existing.id,
                    action: 'UPDATE',
                    newData: existing._raw,
                    performedBy
                });
            }
            return existing;
        }

        // Create new record
        let newBU!: BusinessUnit;
        await this.db.write(async () => {
            newBU = await this.db.get<BusinessUnit>('business_units').create(record => {
                record.name = module.name;
                record.slug = module.id;
                record.moduleId = module.id;
                record.isActive = true;
                record.description = module.description;
            });
        });

        await ActionLogService.logAction({
            entityType: 'business_units',
            entityId: newBU.id,
            action: 'CREATE',
            newData: newBU._raw,
            performedBy
        });

        // Seed Chart of Accounts for this module
        await this.seedModuleAccounts(module, performedBy);

        return newBU;
    }

    /**
     * Seeds the business unit module accounts if they don't already exist
     */
    private async seedModuleAccounts(module: CoopModule, performedBy?: string) {
        const coaService = new ChartOfAccountsServiceClass(this.db);
        for (const account of module.defaultCoA) {
            try {
                // Prefix/namespace code with the segment code if needed (manifest handles code structure)
                await coaService.create(account, performedBy);
            } catch (err: any) {
                // If it already exists (e.g. re-enabling or seeded previously), skip it
                console.warn(`[BusinessUnitService] Skipping seeding of account ${account.code}: ${err.message}`);
            }
        }
    }

    /**
     * Set active state of a business unit
     */
    async setActiveState(slug: string, isActive: boolean, performedBy?: string): Promise<BusinessUnit> {
        const bu = await this.getBySlug(slug);
        if (!bu) {
            throw new Error(`Business unit with slug "${slug}" not found.`);
        }

        await this.db.write(async () => {
            await bu.update(record => {
                record.isActive = isActive;
            });
        });

        await ActionLogService.logAction({
            entityType: 'business_units',
            entityId: bu.id,
            action: 'UPDATE',
            newData: bu._raw,
            performedBy
        });

        return bu;
    }
}

export const BusinessUnitService = new BusinessUnitServiceClass();
export default BusinessUnitService;
