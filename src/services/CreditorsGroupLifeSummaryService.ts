import { format } from 'date-fns';
import { loanProductLabel } from '../utils/loanProducts';
import { escapeHtml } from './reportFormatters';

export const CREDITORS_GROUP_LIFE_ELIGIBLE_LOAN_TYPES = [
    'petty_cash',
    'livelihood',
    'salary',
    'emergency',
] as const;

export type CreditorsGroupLifeEligibleLoanType = typeof CREDITORS_GROUP_LIFE_ELIGIBLE_LOAN_TYPES[number];

export interface CreditorsGroupLifeBorrowerInput {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date | number | null;
    gender?: string;
}

export interface CreditorsGroupLifeLoanInput {
    loanNumber: string;
    loanType?: string;
    principalAmount: number;
    term: number;
    termUnit: string;
    releaseDate?: Date | number | null;
    firstPaymentDate?: Date | number | null;
    insuranceAmount?: number | null;
}

export interface CreditorsGroupLifeSummaryRow {
    voucherNumber: number;
    lastName: string;
    firstName: string;
    middleInitial: string;
    sex: string;
    dateOfBirth: string;
    effectiveDate: string;
    civilStatus: string;
    amountOfLoan: number;
    typeOfLoan: string;
    termMonths: number;
    approvedTermMonths: string;
    annualNetPremiumPaid: number;
    serviceFee: number;
    annualGrossPremiumPaid: number;
}

export interface CreditorsGroupLifeSummaryInput {
    rows: CreditorsGroupLifeSummaryRow[];
    serviceFeePercent?: number;
    title?: string;
}

const DEFAULT_SERVICE_FEE_PERCENT = 10;

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const money = (value: number) => value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeMoney = (value: number) => value.toLocaleString('en-PH', { maximumFractionDigits: 0 });

const reportDate = (value?: Date | number | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return format(date, 'd-MMM-yyyy');
};

const termMonthsFor = (term: number, termUnit: string) => {
    if (!Number.isFinite(term) || term <= 0) return 0;
    if (termUnit === 'days') return Math.max(1, Math.ceil(term / 30));
    return Math.ceil(term);
};

const sexFor = (gender?: string) => {
    const normalized = (gender || '').trim().toLowerCase();
    if (normalized.startsWith('m')) return 'M';
    if (normalized.startsWith('f')) return 'F';
    return '';
};

const splitName = (borrower: CreditorsGroupLifeBorrowerInput) => {
    if (borrower.firstName || borrower.lastName) {
        return {
            firstName: borrower.firstName || '',
            lastName: borrower.lastName || '',
            middleInitial: '',
        };
    }

    const parts = (borrower.fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '', middleInitial: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '', middleInitial: '' };

    const compoundSurnamePrefixes = new Set(['DE', 'DEL', 'DELA', 'DE', 'VAN', 'VON']);
    const maybePrefix = parts.length > 2 ? parts[parts.length - 2].toUpperCase().replace(/\./g, '') : '';
    const lastNameStart = compoundSurnamePrefixes.has(maybePrefix) ? parts.length - 2 : parts.length - 1;
    const lastName = parts.slice(lastNameStart).join(' ');
    const firstParts = parts.slice(0, lastNameStart);
    const maybeMiddle = firstParts.length > 1 ? firstParts[firstParts.length - 1] : '';
    const middleInitial = /^[A-Za-z]\.?$/.test(maybeMiddle) ? maybeMiddle.charAt(0).toUpperCase() : '';
    const firstName = middleInitial ? firstParts.slice(0, -1).join(' ') : firstParts.join(' ');

    return { firstName, lastName, middleInitial };
};

export class CreditorsGroupLifeSummaryService {
    static isEligibleLoanType(loanType?: string): loanType is CreditorsGroupLifeEligibleLoanType {
        return CREDITORS_GROUP_LIFE_ELIGIBLE_LOAN_TYPES.includes(loanType as CreditorsGroupLifeEligibleLoanType);
    }

    static buildRow(
        loan: CreditorsGroupLifeLoanInput,
        borrower: CreditorsGroupLifeBorrowerInput,
        voucherNumber: number,
        serviceFeePercent = DEFAULT_SERVICE_FEE_PERCENT
    ): CreditorsGroupLifeSummaryRow {
        const names = splitName(borrower);
        const annualNetPremiumPaid = roundCurrency(loan.insuranceAmount || 0);
        const serviceFee = roundCurrency(annualNetPremiumPaid * (serviceFeePercent / 100));

        return {
            voucherNumber,
            lastName: names.lastName.toUpperCase(),
            firstName: names.firstName.toUpperCase(),
            middleInitial: names.middleInitial,
            sex: sexFor(borrower.gender),
            dateOfBirth: reportDate(borrower.dateOfBirth),
            effectiveDate: reportDate(loan.firstPaymentDate || loan.releaseDate),
            civilStatus: '',
            amountOfLoan: roundCurrency(loan.principalAmount || 0),
            typeOfLoan: loanProductLabel(loan.loanType).toUpperCase(),
            termMonths: termMonthsFor(loan.term || 0, loan.termUnit || 'months'),
            approvedTermMonths: '',
            annualNetPremiumPaid,
            serviceFee,
            annualGrossPremiumPaid: roundCurrency(annualNetPremiumPaid + serviceFee),
        };
    }

    static buildRows(
        records: { loan: CreditorsGroupLifeLoanInput; borrower: CreditorsGroupLifeBorrowerInput }[],
        serviceFeePercent = DEFAULT_SERVICE_FEE_PERCENT
    ): CreditorsGroupLifeSummaryRow[] {
        return records
            .filter(record => this.isEligibleLoanType(record.loan.loanType))
            .map((record, index) => this.buildRow(record.loan, record.borrower, index + 1, serviceFeePercent));
    }

    static totals(rows: CreditorsGroupLifeSummaryRow[]) {
        return rows.reduce(
            (total, row) => ({
                amountOfLoan: roundCurrency(total.amountOfLoan + row.amountOfLoan),
                annualNetPremiumPaid: roundCurrency(total.annualNetPremiumPaid + row.annualNetPremiumPaid),
                serviceFee: roundCurrency(total.serviceFee + row.serviceFee),
                annualGrossPremiumPaid: roundCurrency(total.annualGrossPremiumPaid + row.annualGrossPremiumPaid),
            }),
            { amountOfLoan: 0, annualNetPremiumPaid: 0, serviceFee: 0, annualGrossPremiumPaid: 0 }
        );
    }

    static buildHtml(input: CreditorsGroupLifeSummaryInput): string {
        const serviceFeePercent = input.serviceFeePercent ?? DEFAULT_SERVICE_FEE_PERCENT;
        const totals = this.totals(input.rows);
        const rows = input.rows.map(row => `
            <tr>
                <td class="center">${row.voucherNumber}</td>
                <td>${escapeHtml(row.lastName)}</td>
                <td>${escapeHtml(row.firstName)}</td>
                <td class="center">${escapeHtml(row.middleInitial)}</td>
                <td class="center">${escapeHtml(row.sex)}</td>
                <td class="center">${escapeHtml(row.dateOfBirth)}</td>
                <td class="center">${escapeHtml(row.effectiveDate)}</td>
                <td class="center">${escapeHtml(row.civilStatus)}</td>
                <td class="amount">${wholeMoney(row.amountOfLoan)}</td>
                <td>${escapeHtml(row.typeOfLoan)}</td>
                <td class="center">${row.termMonths || ''}</td>
                <td class="center">${escapeHtml(row.approvedTermMonths)}</td>
                <td class="amount shaded">${money(row.annualNetPremiumPaid)}</td>
                <td class="amount shaded">${money(row.serviceFee)}</td>
                <td class="amount shaded">${money(row.annualGrossPremiumPaid)}</td>
            </tr>
        `).join('');

        const emptyRows = Array.from({ length: Math.max(0, 12 - input.rows.length) }, (_, index) => `
            <tr>
                <td class="center">${input.rows.length + index + 1}</td>
                <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                <td></td><td></td><td></td><td></td><td class="shaded"></td><td class="shaded"></td><td class="shaded"></td>
            </tr>
        `).join('');

        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: legal landscape; margin: 7mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #000; font-size: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h1 { margin: 0 0 18px; text-align: center; color: #008a3d; text-decoration: underline; font-size: 12px; font-weight: 900; }
    .header { display: grid; grid-template-columns: 1fr 290px; gap: 28px; align-items: end; margin-bottom: 8px; }
    .note { font-weight: 800; line-height: 1.45; }
    .required { color: #d00000; font-style: italic; font-size: 7px; }
    .fee { display: grid; grid-template-columns: 92px 86px 86px; align-items: center; justify-content: end; font-weight: 800; }
    .fee span { padding-right: 6px; text-align: right; }
    .fee .label, .fee .value { border: 1px solid #000; padding: 4px 8px; background: #008a3d; color: #fff; text-align: center; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #000; padding: 2px 3px; height: 14px; vertical-align: middle; overflow: hidden; }
    th { font-size: 7px; text-align: center; font-weight: 900; line-height: 1.08; }
    td { font-size: 8px; }
    .center { text-align: center; }
    .amount { text-align: right; white-space: nowrap; }
    .shaded { background: #d9d9d9; }
    tfoot td { font-weight: 900; background: #f3f4f6; }
    .w-voucher { width: 7.4%; }
    .w-last { width: 10.5%; }
    .w-first { width: 12.8%; }
    .w-mi { width: 3.2%; }
    .w-sex { width: 3.2%; }
    .w-date { width: 7.2%; }
    .w-status { width: 4.8%; }
    .w-loan { width: 6.5%; }
    .w-type { width: 6.5%; }
    .w-term { width: 5.7%; }
    .w-premium { width: 6.6%; }
  </style>
</head>
<body>
  <h1>${escapeHtml(input.title || 'SUMMARY SHEET')}</h1>
  <div class="header">
    <div class="note">
      Attached are the individual application for Creditors Group Life Insurance of the following debtors:<br />
      <span class="required">* All fields are required.</span>
    </div>
    <div class="fee">
      <span>Service Fee:</span>
      <div class="label">Percent (%)</div>
      <div class="value">${serviceFeePercent.toFixed(2)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="w-voucher">Voucher Number</th>
        <th class="w-last">Last Name</th>
        <th class="w-first">First Name</th>
        <th class="w-mi">M.I.</th>
        <th class="w-sex">Sex</th>
        <th class="w-date">Date of Birth</th>
        <th class="w-date">Effective Date</th>
        <th class="w-status">Civil Status</th>
        <th class="w-loan">Amount of Loan</th>
        <th class="w-type">Type of Loan</th>
        <th class="w-term">Term of Loan (No. of Months)</th>
        <th class="w-term">Approved Term of Loan (No. of Months)</th>
        <th class="w-premium shaded">Annual Net Premium Paid</th>
        <th class="w-premium shaded">Service Fee</th>
        <th class="w-premium shaded">Annual Gross Premium Paid</th>
      </tr>
    </thead>
    <tbody>${rows}${emptyRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="8">TOTAL</td>
        <td class="amount">${wholeMoney(totals.amountOfLoan)}</td>
        <td colspan="3"></td>
        <td class="amount">${money(totals.annualNetPremiumPaid)}</td>
        <td class="amount">${money(totals.serviceFee)}</td>
        <td class="amount">${money(totals.annualGrossPremiumPaid)}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
    }
}
