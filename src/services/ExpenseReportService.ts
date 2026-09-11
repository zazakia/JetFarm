import { format } from 'date-fns';
import { COMPANY_NAME } from '../constants/brand';
import { escapeHtml, money, reportDate, simpleReportHtml } from './reportFormatters';

export interface ExpenseReportRow {
    expenseDate: Date | number;
    payee?: string;
    tin?: string;
    description?: string;
    invoiceNumber?: string;
    amount: number;
    vatAmount?: number;
    category?: string;
}

export class ExpenseReportService {
    static inferVatAmount(amount: number, tin?: string, explicitVat?: number): number {
        return 0;
    }

    static buildHtml(rows: ExpenseReportRow[], month: Date): string {
        const normalized = rows.map(row => ({
            ...row,
            vatAmount: 0,
        }));
        const totalValue = normalized.reduce((sum, row) => sum + (row.amount || 0), 0);
        const body = normalized.map(row => `
            <tr>
                <td>${reportDate(row.expenseDate)}</td>
                <td>${escapeHtml(row.payee || row.category || '')}</td>
                <td>${escapeHtml(row.tin || '')}</td>
                <td>${escapeHtml(row.description || '')}</td>
                <td>${escapeHtml(row.invoiceNumber || '')}</td>
                <td class="amount">${money(row.amount)}</td>
            </tr>
        `).join('');
        const table = `<table><thead><tr><th>Date</th><th>Expense</th><th>Reg TIN No.</th><th>Description</th><th>Invoice/Receipt No.</th><th class="amount">Value</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="5">TOTAL</td><td class="amount">${money(totalValue)}</td></tr></tfoot></table>`;
        return simpleReportHtml(`${COMPANY_NAME} EXPENSES`, format(month, 'MMMM yyyy').toUpperCase(), table);
    }
}
