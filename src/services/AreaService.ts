import { Q } from '@nozbe/watermelondb';
import Area from '../database/models/Area';
import { BaseModelServiceClass } from './BaseModelService';
import { ErrorService, ErrorType } from './ErrorService';

/**
 * Area master data for the agribusiness variant.
 *
 * These two methods were lifted out of GroupService unchanged: the (admin)/areas screens only ever
 * called getAreas() and createArea(), while the rest of GroupService is AGAP solidarity groups,
 * which this branch deletes. Keeping the area half in its own service is what lets the lending
 * group model go without taking the area screens with it.
 */
export class AreaService extends BaseModelServiceClass {
    /**
     * List the areas an operator can assign parcels, users or expenses to.
     */
    async getAreas(): Promise<Area[]> {
        try {
            return await this.db.get<Area>('areas')
                .query(
                    Q.where('is_active', true),
                    Q.where('deleted_at', null)
                )
                .fetch();
        } catch (error) {
            throw ErrorService.handleError(error, 'AreaService.getAreas', ErrorType.DATABASE);
        }
    }

    /**
     * Create a new Area
     */
    async createArea(name: string, code?: string, aoId?: string): Promise<Area> {
        return this.db.write(async () => {
            return await this.db.get<Area>('areas').create((record: any) => {
                record.name = name;
                if (code) record.code = code;
                if (aoId) record.aoId = aoId;
                record.isActive = true;
            });
        });
    }
}

export const areaService = new AreaService();
