import { format } from 'date-fns';
import { COMPANY_NAME } from '../constants/brand';
import { escapeHtml, money, reportDate, simpleReportHtml } from './reportFormatters';

export interface MonthlySalesReportRow {
    dueDate: Date | number;
    customerName: string;
    establishment?: string;
    accountNumber: string;
    status?: string;
    datePaid?: Date | number | null;
    amountPaid: number;
    principal: number;
    interest: number;
    vat: number;
    unclaimedRebates?: number;
}

export class MonthlySalesReportService {
    static totals(rows: MonthlySalesReportRow[]) {
        return rows.reduce((acc, row) => ({
            amountPaid: acc.amountPaid + (row.amountPaid || 0),
            principal: acc.principal + (row.principal || 0),
            interest: acc.interest + (row.interest || 0),
            vat: acc.vat + (row.vat || 0),
            unclaimedRebates: acc.unclaimedRebates + (row.unclaimedRebates || 0),
        }), { amountPaid: 0, principal: 0, interest: 0, vat: 0, unclaimedRebates: 0 });
    }

    static buildHtml(rows: MonthlySalesReportRow[], month: Date): string {
        const totals = this.totals(rows);
        const body = rows.map((row, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${reportDate(row.dueDate)}</td>
                <td>${escapeHtml(row.customerName)}</td>
                <td>${escapeHtml(row.establishment || '')}</td>
                <td>${escapeHtml(row.accountNumber)}</td>
                <td>${escapeHtml(row.status || '')}</td>
                <td>${reportDate(row.datePaid)}</td>
                <td class="amount">${money(row.amountPaid)}</td>
                <td class="amount">${money(row.principal)}</td>
                <td class="amount">${money(row.interest)}</td>
                <td class="amount">${money(row.vat)}</td>
                <td class="amount">${money(row.unclaimedRebates)}</td>
            </tr>
        `).join('');
        const table = `<table><thead><tr><th>S/N</th><th>Due Date</th><th>Customer Name</th><th>Establishment</th><th>Account No.</th><th>Status</th><th>Date Paid</th><th class="amount">Amount Paid</th><th class="amount">Principal</th><th class="amount">Interest</th><th class="amount">Fees</th><th class="amount">Unclaimed Rebates</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="7">ACTUAL</td><td class="amount">${money(totals.amountPaid)}</td><td class="amount">${money(totals.principal)}</td><td class="amount">${money(totals.interest)}</td><td class="amount">${money(totals.vat)}</td><td class="amount">${money(totals.unclaimedRebates)}</td></tr></tfoot></table>`;
        return simpleReportHtml(`${COMPANY_NAME} MONTHLY COLLECTIONS`, format(month, 'MMMM yyyy').toUpperCase(), table);
    }
}
