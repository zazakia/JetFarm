import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import CollectionGroup from '../database/models/CollectionGroup';
import Area from '../database/models/Area';
import { BaseModelServiceClass } from './BaseModelService';
import { ErrorService, ErrorType } from './ErrorService';

export class GroupService extends BaseModelServiceClass {
    constructor() {
        super();
    }

    /**
     * Create a new AGAP Solidarity Group
     */
    async createSolidarityGroup(data: {
        name: string;
        collectorId: string;
        areaId: string;
        centerDayName: string;
        centerTime: string;
    }): Promise<CollectionGroup> {
        return this.db.write(async () => {
            return await this.db.get<CollectionGroup>('collection_groups').create((record: any) => {
                record.name = data.name;
                record.collectorId = data.collectorId;
                // Mapping centerDayName to 0-6 index if needed for backward compatibility
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                record.collectionDay = days.indexOf(data.centerDayName) >= 0 ? days.indexOf(data.centerDayName) : 1;
                record.groupType = 'agap_solidarity';
                record.areaId = data.areaId;
                record.centerDayName = data.centerDayName;
                record.centerTime = data.centerTime;
                record.isActive = true;
            });
        });
    }

    /**
     * Fetch all active solidarity groups
     */
    async getSolidarityGroups(): Promise<CollectionGroup[]> {
        try {
            return await this.db.get<CollectionGroup>('collection_groups')
                .query(
                    Q.where('group_type', 'agap_solidarity'),
                    Q.where('is_active', true),
                    Q.where('deleted_at', null)
                )
                .fetch();
        } catch (error) {
            throw ErrorService.handleError(error, 'GroupService.getSolidarityGroups', ErrorType.DATABASE);
        }
    }

    /**
     * Fetch all areas
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
            throw ErrorService.handleError(error, 'GroupService.getAreas', ErrorType.DATABASE);
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

export const groupService = new GroupService();
