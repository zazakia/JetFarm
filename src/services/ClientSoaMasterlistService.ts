import { escapeHtml, money, reportDate, simpleReportHtml } from './reportFormatters';

export interface ClientSoaMasterlistRow {
    lastName: string;
    firstName: string;
    middleInitial?: string;
    accountNumber: string;
    loanType?: string;
    establishment?: string;
    soaReferenceNumber?: string;
    loanDate?: Date | number;
    totalPromissoryNoteAmount: number;
    amountPaid: number;
    principalPaid: number;
}

export class ClientSoaMasterlistService {
    static balance(row: ClientSoaMasterlistRow): number {
        return Math.max(0, (row.totalPromissoryNoteAmount || 0) - (row.amountPaid || 0));
    }

    static buildHtml(rows: ClientSoaMasterlistRow[]): string {
        const totals = rows.reduce((acc, row) => ({
            totalPromissoryNoteAmount: acc.totalPromissoryNoteAmount + (row.totalPromissoryNoteAmount || 0),
            amountPaid: acc.amountPaid + (row.amountPaid || 0),
            principalPaid: acc.principalPaid + (row.principalPaid || 0),
            balance: acc.balance + this.balance(row),
        }), { totalPromissoryNoteAmount: 0, amountPaid: 0, principalPaid: 0, balance: 0 });

        const body = rows.map((row, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(row.lastName)}</td>
                <td>${escapeHtml(row.firstName)}</td>
                <td>${escapeHtml(row.middleInitial || '')}</td>
                <td>${escapeHtml(row.accountNumber)}</td>
                <td>${escapeHtml(row.loanType || '')}</td>
                <td>${escapeHtml(row.establishment || '')}</td>
                <td>${escapeHtml(row.soaReferenceNumber || `SOA_${row.accountNumber}`)}</td>
                <td>${reportDate(row.loanDate)}</td>
                <td class="amount">${money(row.totalPromissoryNoteAmount)}</td>
                <td class="amount">${money(row.amountPaid)}</td>
                <td class="amount">${money(row.principalPaid)}</td>
                <td class="amount">${money(this.balance(row))}</td>
            </tr>
        `).join('');
        const table = `<table><thead><tr><th>S/N</th><th>Last Name</th><th>First Name</th><th>M.I.</th><th>Account No.</th><th>Type of Loan</th><th>Establishment</th><th>SOA Ref. No.</th><th>Date of Loan</th><th class="amount">Total PN Amt</th><th class="amount">Amt Paid</th><th class="amount">Principal Paid</th><th class="amount">Balance</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="9">TOTAL</td><td class="amount">${money(totals.totalPromissoryNoteAmount)}</td><td class="amount">${money(totals.amountPaid)}</td><td class="amount">${money(totals.principalPaid)}</td><td class="amount">${money(totals.balance)}</td></tr></tfoot></table>`;
        return simpleReportHtml('CLIENTS SOA MASTERLIST', 'All client statement-of-account records', table);
    }
}

