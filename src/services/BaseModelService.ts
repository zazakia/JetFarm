import { Database, Model, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import ActionLogService, { ActionType } from './ActionLogService';
import { perf } from '../utils/PerformanceTracker';

export class BaseModelServiceClass {
  protected db: Database;

  constructor(db: Database = globalDatabase) {
    this.db = db;
  }

  /**
   * Fetch only active (non-deleted) records for a given table
   */
  async fetchActive<T extends Model>(tableName: string) {
    return await perf.measure(`DB.fetchActive(${tableName})`, async () => {
      return await this.db.collections.get<T>(tableName).query(
        Q.where('deleted_at', Q.eq(null))
      ).fetch();
    });
  }

  /**
   * Fetch records with pagination and custom clauses
   */
  async fetchPaginated<T extends Model>(tableName: string, clauses: Q.Clause[], skip: number, limit: number) {
    return await perf.measure(`DB.fetchPaginated(${tableName})`, async () => {
      return await this.db.collections.get<T>(tableName).query(
        Q.where('deleted_at', Q.eq(null)),
        ...clauses,
        Q.skip(skip),
        Q.take(limit)
      ).fetch();
    });
  }


  /**
   * Fetch only deleted records for a given table
   */
  async fetchDeleted<T extends Model>(tableName: string) {
    return await perf.measure(`DB.fetchDeleted(${tableName})`, async () => {
      return await this.db.collections.get<T>(tableName).query(
        Q.where('deleted_at', Q.notEq(null)),
        Q.sortBy('deleted_at', Q.desc)
      ).fetch();
    });
  }

  /**
   * Perform a soft delete by setting deleted_at
   */
  async softDelete(model: any, performedBy?: string) {
    const tableName = (model.constructor as any).table;
    const oldData = model._raw;
    
    await this.db.write(async () => {
      await model.update((record: any) => {
        record.deletedAt = Date.now();
      });
    });

    await ActionLogService.logAction({
      entityType: tableName,
      entityId: model.id,
      action: 'DELETE',
      oldData,
      performedBy
    });
  }

  /**
   * Permanently delete a record with logging
   */
  async delete<T extends Model>(model: T, performedBy?: string) {
    const tableName = (model.constructor as any).table;
    const oldData = model._raw;

    await this.db.write(async () => {
      await model.destroyPermanently();
    });

    await ActionLogService.logAction({
      entityType: tableName,
      entityId: model.id,
      action: 'DELETE', // Logged as DELETE
      oldData,
      performedBy
    });
  }

  /**
   * Restore a soft-deleted record
   */
  async restore(model: any, performedBy?: string) {
    const tableName = (model.constructor as any).table;
    const oldData = model._raw;

    await this.db.write(async () => {
      await model.update((record: any) => {
        record.deletedAt = null;
      });
    });

    await ActionLogService.logAction({
      entityType: tableName,
      entityId: model.id,
      action: 'RESTORE',
      oldData,
      newData: model._raw,
      performedBy
    });
  }

  /**
   * Create a record with logging
   */
  async create<T extends Model>(tableName: string, createFn: (record: T) => void, performedBy?: string) {
    let newRecord: T;
    await this.db.write(async () => {
      newRecord = await this.db.get<T>(tableName).create(createFn);
    });

    await ActionLogService.logAction({
      entityType: tableName,
      entityId: newRecord!.id,
      action: 'CREATE',
      newData: newRecord!._raw,
      performedBy
    });

    return newRecord!;
  }

  /**
   * Update a record with logging
   */
  async update<T extends Model>(model: T, updateFn: (record: T) => void, performedBy?: string) {
    const tableName = (model.constructor as any).table;
    const oldData = { ...model._raw };

    await this.db.write(async () => {
      await model.update(updateFn);
    });

    await ActionLogService.logAction({
      entityType: tableName,
      entityId: model.id,
      action: 'UPDATE',
      oldData,
      newData: model._raw,
      performedBy
    });

    return model;
  }

}

const instance = new BaseModelServiceClass();
export { instance as BaseModelService };
export default instance;
