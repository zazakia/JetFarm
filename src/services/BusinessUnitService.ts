import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import BusinessUnit from '../database/models/BusinessUnit';
import ActionLogService from './ActionLogService';

export interface BusinessUnitInput {
    name: string;
    slug: string;
    description?: string | null;
}

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
     * Create a reporting segment (business unit).
     *
     * The coop business-unit module framework is retired on this branch, so segments are created
     * directly rather than registered from a module manifest that also seeded its own Chart of
     * Accounts. Segment accounts belong in the base chart of accounts now.
     */
    async create(input: BusinessUnitInput, performedBy?: string): Promise<BusinessUnit> {
        const existing = await this.getBySlug(input.slug);
        if (existing) {
            if (!existing.isActive) {
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

        let created!: BusinessUnit;
        await this.db.write(async () => {
            created = await this.db.get<BusinessUnit>('business_units').create(record => {
                record.name = input.name;
                record.slug = input.slug;
                // The remote column is NOT NULL and the module framework is gone, so the slug
                // doubles as the legacy module identifier on this branch.
                record.moduleId = input.slug;
                record.isActive = true;
                record.description = input.description ?? null;
            });
        });

        await ActionLogService.logAction({
            entityType: 'business_units',
            entityId: created.id,
            action: 'CREATE',
            newData: created._raw,
            performedBy
        });

        return created;
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
