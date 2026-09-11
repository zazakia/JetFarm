import { AuditService } from '../AuditService';
import { createTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';
import ActionLogService from '../ActionLogService';

jest.mock('../ActionLogService', () => ({
    logAction: jest.fn().mockResolvedValue(undefined),
    logActions: jest.fn().mockResolvedValue(undefined),
}));

describe('AuditService Integration', () => {
    let database: Database;
    let service: AuditService;

    beforeEach(async () => {
        database = createTestDatabase();
        service = new AuditService(database);
    });

    describe('auditLoans', () => {
        it('identifies invalid dates, zero amounts, and future dates', async () => {
            const now = Date.now();
            await database.write(async () => {
                const b = await database.get('borrowers').create((r: any) => { r.fullName = 'B1'; });
                // 1. Maturity < Release
                await database.get('loans').create((l: any) => {
                    l.borrowerId = b.id;
                    l.loanNumber = 'L-1';
                    l.releaseDate = now;
                    l.maturityDate = now - 1000;
                });
                // 2. Zero amount
                await database.get('loans').create((l: any) => {
                    l.borrowerId = b.id;
                    l.loanNumber = 'L-2';
                    l.totalAmount = 0;
                    l.releaseDate = now;
                });
                // 3. Far future date
                await database.get('loans').create((l: any) => {
                    l.borrowerId = b.id;
                    l.loanNumber = 'L-3';
                    l.releaseDate = now + (500 * 24 * 60 * 60 * 1000); // More than 1 year
                });
            });

            const report = await service.runFullAudit();
            expect(report.issues.some(i => i.id.startsWith('loan_invalid_dates'))).toBe(true);
            expect(report.issues.some(i => i.id.startsWith('loan_zero_amount'))).toBe(true);
            expect(report.issues.some(i => i.id.startsWith('loan_future_date'))).toBe(true);
        });

        it('identifies orphan loans', async () => {
            await database.write(async () => {
                await database.get('loans').create((l: any) => {
                    l.borrowerId = 'non-existent';
                    l.loanNumber = 'L-ORPHAN';
                });
            });
            const report = await service.runFullAudit();
            expect(report.issues.some(i => i.id.startsWith('loan_orphan'))).toBe(true);
        });
    });

    describe('auditPayments', () => {
        it('identifies orphan, zero-amount, and future-dated payments', async () => {
            const now = Date.now();
            await database.write(async () => {
                const b = await database.get('borrowers').create((r: any) => { r.fullName = 'B1'; });
                const l = await database.get('loans').create((r: any) => { r.borrowerId = b.id; });
                
                // orphan
                await database.get('payments').create((p: any) => { p.loanId = 'ghost'; p.amount = 100; });
                // zero amount
                await database.get('payments').create((p: any) => { p.loanId = l.id; p.amount = 0; });
                // future date
                await database.get('payments').create((p: any) => { p.loanId = l.id; p.amount = 100; p.paymentDate = now + 100000; });
            });

            const report = await service.runFullAudit();
            expect(report.issues.some(i => i.id.startsWith('payment_orphan'))).toBe(true);
            expect(report.issues.some(i => i.id.startsWith('payment_invalid_amount'))).toBe(true);
            expect(report.issues.some(i => i.id.startsWith('payment_future_date'))).toBe(true);
        });
    });

    describe('auditSchedules and Collectors', () => {
        it('identifies orphan schedules and missing collectors', async () => {
            await database.write(async () => {
                const b = await database.get('borrowers').create((r: any) => { r.fullName = 'B1'; });
                // 1. Orphan schedule
                await database.get('payment_schedules').create((s: any) => { s.loanId = 'no-loan'; });
                // 2. Unknown collector
                await database.get('loans').create((l: any) => {
                    l.borrowerId = b.id;
                    l.collectorId = 'unknown-coll';
                });
            });

            const report = await service.runFullAudit();
            expect(report.issues.some(i => i.id.startsWith('schedule_orphan'))).toBe(true);
            expect(report.issues.some(i => i.id.startsWith('loan_collector_missing'))).toBe(true);
        });
    });

    describe('auditReconciliation', () => {
        it('identifies status mismatches and overpayments', async () => {
            await database.write(async () => {
                const b = await database.get('borrowers').create((r: any) => { r.fullName = 'B1'; });
                // 1. Paid but has balance
                const l1 = await database.get('loans').create((l: any) => {
                    l.borrowerId = b.id;
                    l.totalAmount = 5000;
                    l.status = 'paid';
                });
                // 2. Overpayment
                const l2 = await database.get('loans').create((l: any) => {
                    l.borrowerId = b.id;
                    l.totalAmount = 1000;
                    l.status = 'paid';
                });
                await database.get('payments').create((p: any) => { p.loanId = l2.id; p.amount = 1500; });

                // 3. Renewed but not paid status
                const oldLoan = await database.get('loans').create((l: any) => {
                    l.borrowerId = b.id;
                    l.status = 'active';
                });
                await database.get('loans').create((l: any) => {
                    l.borrowerId = b.id;
                    l.isReloan = true;
                    l.previousLoanId = oldLoan.id;
                });
            });

            const report = await service.runFullAudit();
            expect(report.issues.some(i => i.id.startsWith('recon_status_paid_but_active'))).toBe(true);
            expect(report.issues.some(i => i.id.startsWith('recon_overpayment'))).toBe(true);
            expect(report.issues.some(i => i.id.startsWith('recon_renewed_not_paid'))).toBe(true);
        });

        it('identifies schedule status mismatches (complex branches)', async () => {
            await database.write(async () => {
                const b = await database.get('borrowers').create((r: any) => { r.fullName = 'B1'; });
                const l = await database.get('loans').create((l: any) => {
                    l.borrowerId = b.id;
                    l.totalAmount = 1000;
                    l.status = 'active';
                });
                
                // 1. Paid but status is NOT paid (hits 362)
                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = l.id;
                    s.scheduledAmount = 400;
                    s.status = 'pending';
                    s.dueDate = new Date(2023, 1, 1).getTime();
                });
                // 2. Not paid but status is NOT pending/late (hits 368)
                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = l.id;
                    s.scheduledAmount = 600;
                    s.status = 'paid';
                    s.dueDate = new Date(2023, 1, 2).getTime();
                });
                
                // Total paid 500. 
                // Schedule 1 (400) should be 'paid'. 
                // Schedule 2 (600) should be 'partial'.
                await database.get('payments').create((p: any) => { p.loanId = l.id; p.amount = 500; });
            });

            const report = await service.runFullAudit();
            expect(report.issues.some(i => i.id.startsWith('recon_schedule_status_mismatch'))).toBe(true);
        });

        it('identifies schedule status mismatches when money is exhausted (hits 368)', async () => {
            await database.write(async () => {
                const b = await database.get('borrowers').create((r: any) => { r.fullName = 'B1'; });
                const l = await database.get('loans').create((l: any) => {
                    l.borrowerId = b.id;
                    l.totalAmount = 1000;
                    l.status = 'active';
                });
                
                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = l.id;
                    s.scheduledAmount = 1000;
                    s.status = 'paid'; // Mismatch! No payments made yet.
                    s.dueDate = Date.now();
                });
                // No payments. Cumulative is 0.
            });

            const report = await service.runFullAudit();
            expect(report.issues.some(i => i.id.startsWith('recon_schedule_status_mismatch'))).toBe(true);
        });
    });

    describe('Snapshots and Errors', () => {
        it('identifies negative assets in snapshots', async () => {
            await database.write(async () => {
                await database.get('financial_snapshots').create((s: any) => {
                    (s as any).totalAssets = -500;
                });
            });
            const report = await service.runFullAudit();
            expect(report.issues.some(i => i.id.startsWith('report_neg_assets'))).toBe(true);
        });

        it('handles snapshot retrieval errors', async () => {
            const collection = database.get('financial_snapshots');
            jest.spyOn(collection, 'query').mockImplementationOnce(() => {
                throw new Error('Snap Fail');
            });
            const reconIssues = await service.auditReconciliation();
            expect(reconIssues).toBeDefined();
        });

        it('identifies lack of snapshots', async () => {
            const report = await service.runFullAudit();
            expect(report.issues.some(i => i.id === 'report_no_snapshots')).toBe(true);
        });
    });

    describe('Additional Edge Cases', () => {
        it('identifies borrowers with "undefined" in name', async () => {
            await database.write(async () => {
                await database.get('borrowers').create((r: any) => { r.fullName = 'User undefined Profile'; });
            });
            const report = await service.runFullAudit();
            expect(report.issues.some(i => i.id.startsWith('borrower_name_invalid'))).toBe(true);
        });

        it('identifies term and schedule mismatches', async () => {
            await database.write(async () => {
                const b = await database.get('borrowers').create((r: any) => { r.fullName = 'B2'; });
                // Term is 10, but only 1 schedule
                await database.get('loans').create((l: any) => {
                    l.borrowerId = b.id;
                    l.loanNumber = 'L-TERM-ERR';
                    l.term = 10;
                    l.termUnit = 'days';
                    l.frequency = 'daily';
                    l.totalAmount = 1000;
                    l.status = 'active';
                });
                const loan = (await database.get('loans').query().fetch()).find((l: any) => l.loanNumber === 'L-TERM-ERR');
                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loan.id;
                    s.scheduledAmount = 500; // 500 != 1000
                });
            });
            const report = await service.runFullAudit();
            expect(report.issues.some(i => i.id.startsWith('recon_term_mismatch'))).toBe(true);
            expect(report.issues.some(i => i.id.startsWith('recon_schedule_mismatch'))).toBe(true);
        });


        it('does not flag term mismatch when schedule count matches calculated payment frequency', async () => {
            await database.write(async () => {
                const b = await database.get('borrowers').create((r: any) => { r.fullName = 'B4'; });
                const l = await database.get('loans').create((loan: any) => {
                    loan.borrowerId = b.id;
                    loan.loanNumber = 'L-WEEKLY-OK';
                    loan.term = 6;
                    loan.termUnit = 'months';
                    loan.frequency = 'weekly';
                    loan.totalAmount = 2400;
                    loan.status = 'active';
                });

                for (let i = 0; i < 24; i += 1) {
                    await database.get('payment_schedules').create((schedule: any) => {
                        schedule.loanId = l.id;
                        schedule.scheduledAmount = 100;
                        schedule.status = 'pending';
                        schedule.dueDate = Date.now() + i * 7 * 86400000;
                    });
                }
            });

            const report = await service.runFullAudit();
            expect(report.issues.some(i => i.id.startsWith('recon_term_mismatch'))).toBe(false);
        });

        it('identifies active loans that are fully paid', async () => {
            await database.write(async () => {
                const b = await database.get('borrowers').create((r: any) => { r.fullName = 'B3'; });
                const l = await database.get('loans').create((l: any) => {
                    l.borrowerId = b.id;
                    l.totalAmount = 1000;
                    l.status = 'active';
                });
                await database.get('payments').create((p: any) => { p.loanId = l.id; p.amount = 1000; });
            });
            const report = await service.runFullAudit();
            expect(report.issues.some(i => i.id.startsWith('recon_status_active_but_paid'))).toBe(true);
        });
    });

    describe('recalculateLoanTotals', () => {
        it('recalculates balance and logs the action', async () => {
            let loanId: string;
            await database.write(async () => {
                const b = await database.get('borrowers').create((r: any) => { r.fullName = 'B1'; });
                const l = await database.get('loans').create((r: any) => {
                    r.borrowerId = b.id;
                    r.loanNumber = 'L-TEST';
                    r.totalAmount = 1000;
                    r.status = 'active';
                });
                loanId = l.id;
                
                // Add payment covering full amount
                await database.get('payments').create((p: any) => {
                    p.loanId = l.id;
                    p.amount = 1000;
                    p.paymentDate = Date.now();
                });
            });

            // Recompute
            const result = await service.recalculateLoanTotals(loanId!);
            expect(result.success).toBe(true);
            
            // Check status update
            const updatedLoan = await database.get('loans').find(loanId!) as any;
            expect(updatedLoan.status).toBe('paid');

            // Check logging
            expect(ActionLogService.logAction).toHaveBeenCalledWith(expect.objectContaining({
                entityType: 'Loan',
                entityId: loanId!,
                action: 'UPDATE',
                oldData: expect.objectContaining({ status: 'active' }),
                newData: expect.objectContaining({ status: 'paid' })
            }));
        });
    });
});
