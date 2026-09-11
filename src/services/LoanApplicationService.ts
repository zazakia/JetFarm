import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import LoanApplication from '../database/models/LoanApplication';
import Guarantor from '../database/models/Guarantor';
import { BaseModelServiceClass } from './BaseModelService';
import { ErrorService, ErrorType } from './ErrorService';

export class LoanApplicationService extends BaseModelServiceClass {
    constructor() {
        super();
    }

    /**
     * Create a new loan application
     */
    async createApplication(data: {
        borrowerId: string;
        productId?: string;
        amountApplied: number;
        purpose?: string;
        guarantors?: { guarantorName: string; contactNo?: string; relationship?: string; memberId?: string }[];
        notes?: string;
    }): Promise<LoanApplication> {
        return this.db.write(async () => {
            const application = await this.db.get<LoanApplication>('loan_applications').create((record: any) => {
                record.borrowerId = data.borrowerId;
                if (data.productId) record.productId = data.productId;
                record.amountApplied = data.amountApplied;
                if (data.purpose) record.purpose = data.purpose;
                record.applicationDate = Date.now();
                record.status = 'under_review';
                if (data.notes) record.notes = data.notes;
            });

            if (data.guarantors && data.guarantors.length > 0) {
                const guarantorCollection = database.get<Guarantor>('guarantors');
                for (const g of data.guarantors) {
                    await guarantorCollection.create((record: any) => {
                        record.applicationId = application.id;
                        record.guarantorName = g.guarantorName;
                        if (g.contactNo) record.contactNo = g.contactNo;
                        if (g.relationship) record.relationship = g.relationship;
                        if (g.memberId) record.memberId = g.memberId;
                    });
                }
            }

            return application;
        });
    }

    /**
     * Get applications by status
     */
    async getApplicationsByStatus(status: string): Promise<LoanApplication[]> {
        try {
            return await this.db.get<LoanApplication>('loan_applications')
                .query(
                    Q.where('status', status),
                    Q.where('deleted_at', null)
                )
                .fetch();
        } catch (error) {
            throw ErrorService.handleError(error, 'LoanApplicationService.getApplicationsByStatus', ErrorType.DATABASE);
        }
    }

    /**
     * Approve a loan application
     */
    async approveApplication(applicationId: string, approvedBy: string, amountApproved: number): Promise<LoanApplication> {
        return this.db.write(async () => {
            const application = await this.db.get<LoanApplication>('loan_applications').find(applicationId);
            if (!application) throw new Error('Application not found');

            await application.update((record: any) => {
                record.status = 'approved';
                record.approvedBy = approvedBy;
                record.amountApproved = amountApproved;
                record.approvedAt = Date.now();
            });

            return application;
        });
    }

    /**
     * Reject a loan application
     */
    async rejectApplication(applicationId: string, notes?: string): Promise<LoanApplication> {
        return this.db.write(async () => {
            const application = await this.db.get<LoanApplication>('loan_applications').find(applicationId);
            if (!application) throw new Error('Application not found');

            await application.update((record: any) => {
                record.status = 'rejected';
                if (notes) {
                    record.notes = record.notes ? `${record.notes}\nRejected: ${notes}` : `Rejected: ${notes}`;
                }
            });

            return application;
        });
    }
}

export const loanApplicationService = new LoanApplicationService();
