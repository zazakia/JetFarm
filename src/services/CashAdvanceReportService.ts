import { escapeHtml, money, reportDate, simpleReportHtml } from './reportFormatters';

export interface CashAdvanceReportRow {
    clientNumber: string;
    establishment?: string;
    institution?: string;
    clientName: string;
    date?: Date | number;
    maturityDate?: Date | number;
    termsInMonths: number;
    ratePerMonth: number;
    chequeAmount?: number;
    cashAmount?: number;
    deductions?: string;
    transaction?: string;
}

export class CashAdvanceReportService {
    static totalAdvance(row: CashAdvanceReportRow): number {
        return (row.chequeAmount || 0) + (row.cashAmount || 0);
    }

    static buildHtml(rows: CashAdvanceReportRow[], title = 'CASH ADVANCES'): string {
        const totals = rows.reduce((acc, row) => ({
            cheque: acc.cheque + (row.chequeAmount || 0),
            cash: acc.cash + (row.cashAmount || 0),
        }), { cheque: 0, cash: 0 });
        const body = rows.map((row, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(row.clientNumber)}</td>
                <td>${escapeHtml(row.establishment || '')}</td>
                <td>${escapeHtml(row.institution || '')}</td>
                <td>${escapeHtml(row.clientName)}</td>
                <td>${reportDate(row.date)}</td>
                <td>${reportDate(row.maturityDate)}</td>
                <td class="amount">${row.termsInMonths}</td>
                <td class="amount">${((row.ratePerMonth || 0) * 100).toFixed(2)}%</td>
                <td class="amount">${money(row.chequeAmount)}</td>
                <td class="amount">${money(row.cashAmount)}</td>
                <td>${escapeHtml(row.deductions || '')}</td>
            </tr>
        `).join('');
        const grandTotal = totals.cheque + totals.cash;
        const table = `<table><thead><tr><th>S/N</th><th>Client No.</th><th>Establishment</th><th>Institution</th><th>Client Name</th><th>Date</th><th>Maturity Date</th><th class="amount">Terms</th><th class="amount">Rate/Month</th><th class="amount">Cheque</th><th class="amount">Cash</th><th>Deductions</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="9">TOTAL</td><td class="amount">${money(totals.cheque)}</td><td class="amount">${money(totals.cash)}</td><td class="amount">${money(grandTotal)}</td></tr></tfoot></table>`;
        return simpleReportHtml(title, 'Cash advance monitoring report', table);
    }
}

