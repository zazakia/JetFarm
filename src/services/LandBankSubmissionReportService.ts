import { format } from 'date-fns';
import { COMPANY_NAME } from '../constants/brand';
import { escapeHtml, money } from './reportFormatters';

export interface LandBankSubmissionRow {
    accountNumber: string;
    accountName: string;
    amount: number;
}

export interface LandBankSubmissionReportInput {
    rows: LandBankSubmissionRow[];
    reportDate: Date;
    branch?: string;
    branchCode?: string;
    batchNumber?: string;
    preparedBy?: string;
    checkedBy?: string;
    notedBy?: string;
}

const normalizeAccountNumber = (value: string) => value.replace(/[^\d-]/g, '').trim();

export class LandBankSubmissionReportService {
    static buildRowsFromBorrowers(
        borrowers: { fullName: string; bankAccountName?: string; bankAccountNumber?: string }[],
        amountByBorrowerName: Record<string, number> = {}
    ): LandBankSubmissionRow[] {
        return borrowers
            .filter(borrower => !!borrower.bankAccountNumber)
            .map(borrower => ({
                accountNumber: normalizeAccountNumber(borrower.bankAccountNumber || ''),
                accountName: (borrower.bankAccountName || borrower.fullName || '').toUpperCase(),
                amount: amountByBorrowerName[borrower.fullName] || 0,
            }));
    }

    static buildHtml(input: LandBankSubmissionReportInput): string {
        const total = input.rows.reduce((sum, row) => sum + (row.amount || 0), 0);
        const rowHtml = input.rows.map(row => `
            <tr>
                <td>${escapeHtml(row.accountNumber)}</td>
                <td>${escapeHtml(row.accountName)}</td>
                <td class="amount">${money(row.amount)}</td>
            </tr>
        `).join('');

        return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
@page { size: A4 portrait; margin: 12mm; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111827; }
.top { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: start; }
h1 { margin: 0; text-align: center; font-size: 18px; }
.company { text-align: center; font-weight: 800; margin: 3px 0; }
.meta { margin: 10px 0 12px; line-height: 1.5; }
table { width: 100%; border-collapse: collapse; }
th, td { border-bottom: 1px solid #cbd5e1; padding: 6px; }
th { text-align: left; background: #f1f5f9; }
.amount { text-align: right; white-space: nowrap; }
.footer { margin-top: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; }
.sig { border-top: 1px solid #334155; padding-top: 4px; min-height: 38px; }
</style></head><body>
<div class="top"><div></div><div>Page No. 1</div></div>
<h1>PAYROLL REGISTER</h1>
<div class="company">${escapeHtml(COMPANY_NAME)}</div>
<div class="company">${escapeHtml(format(input.reportDate, 'MMMM d, yyyy'))}</div>
<div class="meta">
LBP BRANCH: <strong>${escapeHtml(input.branch || 'LA CARLOTA BRANCH')}</strong>
&nbsp;&nbsp; CODE: <strong>[ ${escapeHtml(input.branchCode || '999')} ]</strong><br/>
BATCH <strong>${escapeHtml(input.batchNumber || '00001')}</strong>
</div>
<table>
<thead><tr><th>Account No.</th><th>Account Name</th><th class="amount">Amount</th></tr></thead>
<tbody>${rowHtml}</tbody>
<tfoot><tr><td colspan="2">TOTAL AMOUNT / RECORDS: ${input.rows.length}</td><td class="amount">${money(total)}</td></tr></tfoot>
</table>
<div class="footer">
<div class="sig">${escapeHtml(input.preparedBy || 'Prepared By')}</div>
<div class="sig">${escapeHtml(input.checkedBy || 'Checked By')}</div>
<div class="sig">${escapeHtml(input.notedBy || 'Noted By')}</div>
</div>
</body></html>`;
    }
}

