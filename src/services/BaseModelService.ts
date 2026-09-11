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

  /**
   * Cascade soft-delete for a single Loan.
   * Soft-deletes the loan, its schedules, payments and penalties.
   */
  async cascadeDeleteLoan(loan: any, performedBy?: string) {
    const loanId = loan.id;

    // 1. Fetch all related records
    const payments = await this.db.collections.get('payments').query(
      Q.where('loan_id', loanId),
      Q.where('deleted_at', Q.eq(null))
    ).fetch();

    const paymentSchedules = await this.db.collections.get('payment_schedules').query(
      Q.where('loan_id', loanId),
      Q.where('deleted_at', Q.eq(null))
    ).fetch();

    const penalties = await this.db.collections.get('loan_penalties').query(
      Q.where('loan_id', loanId),
      Q.where('deleted_at', Q.eq(null))
    ).fetch();

    const timestamp = Date.now();

    // 2. Perform cascade soft-delete in a single transaction
    await this.db.write(async () => {
      const allRecords = [
        ...payments,
        ...paymentSchedules,
        ...penalties,
        loan
      ];

      // Mark all as soft deleted
      const updatePromises = allRecords.map(record => 
        record.prepareUpdate((r: any) => {
          r.deletedAt = timestamp;
        })
      );

      await this.db.batch(...updatePromises);
    });

    // 3. Log actions in batch
    const logParamsList = [
      ...payments,
      ...paymentSchedules,
      ...penalties,
      loan
    ].map(record => ({
      entityType: (record.constructor as any).table,
      entityId: record.id,
      action: 'DELETE' as const,
      oldData: record._raw,
      performedBy
    }));

    await ActionLogService.logActions(logParamsList);
  }

  /**
   * Cascade soft-delete for Borrower.
   * Blocks if the borrower has active or defaulted loans.
   * Soft-deletes all related records if allowed.
   */
  async cascadeDeleteBorrower(borrower: any, performedBy?: string) {
    // 1. Fetch all loans for this borrower
    const loans = await this.db.collections.get('loans').query(
      Q.where('borrower_id', borrower.id),
      Q.where('deleted_at', Q.eq(null))
    ).fetch();

    // 2. Guard: Check for active or defaulted loans
    const activeLoans = loans.filter((l: any) => l.status === 'active' || l.status === 'defaulted');
    if (activeLoans.length > 0) {
      throw new Error(`Cannot delete — borrower has ${activeLoans.length} active/defaulted loan(s). Close all loans first.`);
    }

    // 3. Delete allowed. Fetch all related records.
    const loanIds = loans.map(l => l.id);

    let payments: any[] = [];
    let paymentSchedules: any[] = [];
    let penalties: any[] = [];
    let savings: any[] = [];

    if (loanIds.length > 0) {
      payments = await this.db.collections.get('payments').query(
        Q.where('loan_id', Q.oneOf(loanIds)),
        Q.where('deleted_at', Q.eq(null))
      ).fetch();

      paymentSchedules = await this.db.collections.get('payment_schedules').query(
        Q.where('loan_id', Q.oneOf(loanIds)),
        Q.where('deleted_at', Q.eq(null))
      ).fetch();

      penalties = await this.db.collections.get('loan_penalties').query(
        Q.where('loan_id', Q.oneOf(loanIds)),
        Q.where('deleted_at', Q.eq(null))
      ).fetch();
    }

    savings = await this.db.collections.get('savings_transactions').query(
      Q.where('borrower_id', borrower.id),
      Q.where('deleted_at', Q.eq(null))
    ).fetch();

    const timestamp = Date.now();

    // 4. Perform cascade soft-delete in a single transaction
    await this.db.write(async () => {
      const allRecords = [
        ...payments,
        ...paymentSchedules,
        ...penalties,
        ...savings,
        ...loans,
        borrower
      ];

      // Mark all as soft deleted
      const updatePromises = allRecords.map(record => 
        record.prepareUpdate((r: any) => {
          r.deletedAt = timestamp;
        })
      );

      await this.db.batch(...updatePromises);
    });

    // 5. Log actions in batch
    const logParamsList = [
      ...payments,
      ...paymentSchedules,
      ...penalties,
      ...savings,
      ...loans,
      borrower
    ].map(record => ({
      entityType: (record.constructor as any).table,
      entityId: record.id,
      action: 'DELETE' as const,
      oldData: record._raw,
      performedBy
    }));

    await ActionLogService.logActions(logParamsList);
  }
}

const instance = new BaseModelServiceClass();
export { instance as BaseModelService };
export default instance;
