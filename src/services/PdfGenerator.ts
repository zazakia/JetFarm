import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { format } from 'date-fns';
import { formatPHP } from '../utils/currency';
import { buildLoanComputationSlipHtml, buildLoanContractFormsHtml } from './institutionalPrintHtml';
import { COMPANY_NAME } from '../constants/brand';
import { logoBase64 } from '../utils/logoBase64';
import { CreditorsGroupLifeSummaryService } from './CreditorsGroupLifeSummaryService';

interface BorrowerInfo {
    fullName: string;
    address?: string;
    phone?: string;
    dateOfBirth?: number;
    gender?: string;
}

interface LoanInfo {
    loanNumber: string;
    loanType?: string;
    principalAmount: number;
    interestRate: number;
    interestType: string;
    term: number;
    termUnit: string;
    frequency: string;
    installmentAmount: number;
    depositAmount?: number;
    insuranceAmount?: number;
    releaseDate?: number;
    maturityDate?: number;
    totalAmount: number;
    status: string;
    deductedAmount?: number;
    processingFee?: number;
    collectionFee?: number;
    notarialFee?: number;
    rodFee?: number;
    ltoFee?: number;
    udiRebatableFee?: number;
    vatOnInterest?: number;
    vatOnCharges?: number;
    dstFee?: number;
    rebateAmount?: number;
    savingsPerPayment?: number;
}

interface PaymentRow {
    paymentDate: number;
    receiptNumber?: string;
    amount: number;
    pSavings?: number;
    runningBalance: number;
    notes?: string;
}

interface PenaltyRow {
    dueDate: number;
    amountDue: number;
    daysDelayed: number;
    penaltyAmount: number;
    reason?: string;
}

interface LoanStatement {
    loan: LoanInfo;
    payments: PaymentRow[];
    penalties?: PenaltyRow[];
}

interface ExcessCashReceiptInfo {
    borrowerName: string;
    loanNumber?: string;
    receiptNumber?: string;
    paymentDate: Date | number;
    amountReceived: number;
    amountDue: number;
    amountRemaining: number;
    deductions?: { label: string; amount: number }[];
    remarks?: string;
    recipientName?: string;
    preparedBy?: string;
}

export class PdfGenerator {
    private static async printHtmlOnWeb(html: string): Promise<void> {
        if (typeof document === 'undefined') {
            await Print.printAsync({ html });
            return;
        }

        await new Promise<void>((resolve, reject) => {
            const iframe = document.createElement('iframe');
            let resolved = false;
            const finish = () => {
                if (resolved) return;
                resolved = true;
                setTimeout(() => iframe.remove(), 500);
                resolve();
            };

            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            iframe.onload = () => {
                const printWindow = iframe.contentWindow;
                if (!printWindow) {
                    iframe.remove();
                    reject(new Error('Unable to open print frame.'));
                    return;
                }

                printWindow.onafterprint = finish;
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                    setTimeout(finish, 1000);
                }, 250);
            };

            iframe.srcdoc = html;
            document.body.appendChild(iframe);
        });
    }

    private static async printOrShare(html: string, dialogTitle: string): Promise<void> {
        if (Platform.OS === 'web') {
            await this.printHtmlOnWeb(html);
            return;
        }

        const { uri } = await Print.printToFileAsync({ html });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
            await Sharing.shareAsync(uri, {
                mimeType: 'application/pdf',
                dialogTitle,
            });
        }
    }

    static async generateStatementOfAccount(
        borrower: BorrowerInfo,
        loan: LoanInfo,
        payments: PaymentRow[],
        penalties: PenaltyRow[] = []
    ): Promise<void> {
        await this.generateBorrowerStatementOfAccount(borrower, [{ loan, payments, penalties }]);
    }

    static async generateBorrowerStatementOfAccount(
        borrower: BorrowerInfo,
        loanStatements: LoanStatement[]
    ): Promise<void> {
        const escapeHtml = (value: string | number | undefined | null) =>
            String(value ?? '').replace(/[&<>"']/g, char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            }[char] || char));
        const money = (value: number | undefined | null) => formatPHP(value || 0);
        const compactDate = (value: Date | number | undefined | null) => {
            if (!value) return 'N/A';
            return format(new Date(value), 'd-MMM-yyyy');
        };
        const normalizeStatus = (status: string) => {
            const value = (status || '').toLowerCase();
            if (value === 'paid' || value === 'completed' || value === 'closed') return 'PAID';
            if (value === 'defaulted') return 'DEFAULTED';
            return 'ACTIVE';
        };
        const paymentRowsFor = (payments: PaymentRow[]) => payments
            .sort((a, b) => a.paymentDate - b.paymentDate)
            .map((payment, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${compactDate(payment.paymentDate)}</td>
                    <td>${escapeHtml(payment.receiptNumber || '-')}</td>
                    <td class="amount">${money(payment.amount)}</td>
                    <td class="amount">${payment.pSavings ? money(payment.pSavings) : '-'}</td>
                    <td class="amount">${money(payment.runningBalance)}</td>
                    <td>${escapeHtml(payment.notes || '')}</td>
                </tr>
            `).join('');
        const penaltyRowsFor = (penalties: PenaltyRow[]) => penalties
            .sort((a, b) => a.dueDate - b.dueDate)
            .map((penalty, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${compactDate(penalty.dueDate)}</td>
                    <td class="amount">${money(penalty.amountDue)}</td>
                    <td class="amount">${penalty.daysDelayed}</td>
                    <td class="amount">${money(penalty.penaltyAmount)}</td>
                    <td>${escapeHtml(penalty.reason || 'Amount due × 5% ÷ 30 × days delayed')}</td>
                </tr>
            `).join('');

        const loanSummaries = loanStatements.map(({ loan, payments, penalties = [] }) => {
            const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
            const totalPenalty = penalties.reduce((sum, penalty) => sum + (penalty.penaltyAmount || 0), 0);
            const totalPayableWithPenalty = (loan.totalAmount || 0) + totalPenalty;
            const balance = Math.max(0, totalPayableWithPenalty - totalPaid);
            return { loan, payments, penalties, totalPaid, totalPenalty, totalPayableWithPenalty, balance, status: normalizeStatus(loan.status) };
        });

        const grandPrincipal = loanSummaries.reduce((sum, item) => sum + (item.loan.principalAmount || 0), 0);
        const grandLoanPayable = loanSummaries.reduce((sum, item) => sum + (item.loan.totalAmount || 0), 0);
        const grandPenalty = loanSummaries.reduce((sum, item) => sum + item.totalPenalty, 0);
        const grandPayable = loanSummaries.reduce((sum, item) => sum + item.totalPayableWithPenalty, 0);
        const grandPaid = loanSummaries.reduce((sum, item) => sum + item.totalPaid, 0);
        const grandBalance = loanSummaries.reduce((sum, item) => sum + item.balance, 0);
        const grandRebate = loanSummaries.reduce((sum, item) => sum + (item.loan.rebateAmount || 0), 0);
        const activeCount = loanSummaries.filter(item => item.status !== 'PAID').length;
        const paidCount = loanSummaries.filter(item => item.status === 'PAID').length;
        const reportDate = compactDate(new Date());

        const loanSections = loanSummaries.map(({ loan, payments, penalties, totalPaid, totalPenalty, totalPayableWithPenalty, balance, status }, index) => {
            const statusClass = status === 'PAID' ? 'paid' : status === 'DEFAULTED' ? 'danger' : 'active';
            const paymentProgress = totalPayableWithPenalty > 0 ? Math.min(100, (totalPaid / totalPayableWithPenalty) * 100) : 0;
            const totalInterest = Math.max(0, (loan.totalAmount || 0) - (loan.principalAmount || 0));
            const paymentTable = payments.length > 0
                ? paymentRowsFor(payments)
                : '<tr><td colspan="7" class="empty">No payments recorded for this loan.</td></tr>';
            const penaltyTable = penalties.length > 0
                ? penaltyRowsFor(penalties)
                : '<tr><td colspan="6" class="empty">No overdue unpaid schedules. No penalty computed.</td></tr>';

            return `
                <section class="loan-card ${index > 0 ? 'page-soft-break' : ''}">
                    <div class="loan-header">
                        <div>
                            <div class="eyebrow">Loan ${index + 1} of ${loanSummaries.length}</div>
                            <h2>${escapeHtml(loan.loanNumber)}</h2>
                            <p>${escapeHtml(loan.loanType || 'Loan')} &bull; Released ${compactDate(loan.releaseDate)} &bull; Matures ${compactDate(loan.maturityDate)}</p>
                        </div>
                        <div class="status-pill ${statusClass}">${status}</div>
                    </div>

                    <div class="metric-grid loan-metrics">
                        <div class="metric"><span>Principal</span><strong>${money(loan.principalAmount)}</strong></div>
                        <div class="metric"><span>Loan Payable</span><strong>${money(loan.totalAmount)}</strong></div>
                        <div class="metric penalty"><span>Penalty</span><strong>${money(totalPenalty)}</strong></div>
                        <div class="metric"><span>Total Paid</span><strong>${money(totalPaid)}</strong></div>
                        <div class="metric ${balance > 0 ? 'accent' : 'success'}"><span>Balance</span><strong>${money(balance)}</strong></div>
                    </div>

                    <div class="loan-details">
                        <div><span>Terms</span><strong>${escapeHtml(`${loan.term} ${loan.termUnit}`)}</strong></div>
                        <div><span>Frequency</span><strong>${escapeHtml(loan.frequency)}</strong></div>
                        <div><span>Installment</span><strong>${money(loan.installmentAmount)}</strong></div>
                        <div><span>Interest/Charges</span><strong>${money(totalInterest)}</strong></div>
                        <div><span>Savings/Deposit</span><strong>${money(loan.depositAmount)}</strong></div>
                        <div><span>Insurance</span><strong>${money(loan.insuranceAmount)}</strong></div>
                        <div class="rebate-box"><span>Rebate</span><strong>${money(loan.rebateAmount)}</strong></div>
                    </div>

                    <div class="progress">
                        <div class="progress-label"><span>Payment progress</span><strong>${paymentProgress.toFixed(2)}%</strong></div>
                        <div class="progress-track"><div style="width:${paymentProgress.toFixed(2)}%"></div></div>
                    </div>

                    <table class="payments penalties">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Due Date</th>
                                <th class="amount">Amount Due</th>
                                <th class="amount">Days Delayed</th>
                                <th class="amount">Penalty</th>
                                <th>Formula</th>
                            </tr>
                        </thead>
                        <tbody>${penaltyTable}</tbody>
                    </table>

                    <table class="payments">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Date Paid</th>
                                <th>Receipt No.</th>
                                <th class="amount">Amount</th>
                                <th class="amount">PDI/Savings</th>
                                <th class="amount">Running Balance</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>${paymentTable}</tbody>
                    </table>
                </section>
            `;
        }).join('');

        const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        * { box-sizing: border-box; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          margin: 0;
          color: #111827;
          background: #fff;
          font-size: 11px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .report { width: 100%; }
        .hero {
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 58%, #1E3A8A 100%);
          color: #fff;
          border-radius: 18px;
          padding: 22px 24px;
          margin-bottom: 16px;
        }
        .brand-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand img { width: 48px; height: 48px; border-radius: 12px; background: #fff; padding: 5px; object-fit: contain; }
        .brand-name { font-size: 12px; font-weight: 900; letter-spacing: 1.8px; text-transform: uppercase; opacity: .9; }
        .doc-title { margin-top: 18px; display: flex; justify-content: space-between; gap: 18px; align-items: flex-end; }
        h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: -0.6px; }
        .muted { color: #64748b; }
        .hero .muted { color: rgba(255,255,255,.76); }
        .generated { text-align: right; font-size: 10px; line-height: 1.5; }
        .client-panel {
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 14px 16px;
          margin-bottom: 14px;
        }
        .client-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 12px; }
        .field span, .metric span, .loan-details span { display: block; color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: .8px; font-weight: 800; margin-bottom: 4px; }
        .field strong { display: block; font-size: 12px; color: #111827; }
        .metric-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 14px; }
        .metric {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 12px;
        }
        .metric strong { font-size: 15px; }
        .metric.accent { border-color: #fecaca; background: #fff7f7; color: #b91c1c; }
        .metric.success { border-color: #bbf7d0; background: #f0fdf4; color: #1E3A8A; }
        .metric.penalty { border-color: #fed7aa; background: #fff7ed; color: #c2410c; }
        .loan-card {
          border: 1px solid #dbe3ef;
          border-radius: 18px;
          padding: 15px;
          margin-top: 14px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .loan-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 12px; }
        .eyebrow { color: #2563eb; font-size: 9px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
        h2 { margin: 2px 0 2px; font-size: 18px; letter-spacing: -0.3px; }
        .loan-header p { margin: 0; color: #64748b; font-size: 10px; }
        .status-pill { border-radius: 999px; padding: 7px 10px; font-size: 9px; font-weight: 900; letter-spacing: .8px; }
        .status-pill.active { background: #dbeafe; color: #1d4ed8; }
        .status-pill.paid { background: #dcfce7; color: #1E3A8A; }
        .status-pill.danger { background: #fee2e2; color: #b91c1c; }
        .loan-metrics { grid-template-columns: repeat(5, 1fr); }
        .loan-details {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
          padding: 10px 0 12px;
          border-top: 1px solid #eef2f7;
          border-bottom: 1px solid #eef2f7;
          margin-bottom: 12px;
        }
        .loan-details strong { font-size: 10px; }
        .rebate-box {
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          background: #f0fdf4;
          padding: 8px;
          color: #166534;
        }
        .progress { margin-bottom: 12px; }
        .progress-label { display: flex; justify-content: space-between; color: #475569; font-size: 10px; font-weight: 800; margin-bottom: 5px; }
        .progress-track { height: 8px; background: #e5e7eb; border-radius: 999px; overflow: hidden; }
        .progress-track div { height: 100%; background: linear-gradient(90deg, #47734B, #2563eb); }
        table { width: 100%; border-collapse: collapse; }
        .payments th {
          background: #f1f5f9;
          color: #334155;
          font-size: 9px;
          letter-spacing: .5px;
          text-transform: uppercase;
          text-align: left;
          padding: 8px;
          border-bottom: 1px solid #cbd5e1;
        }
        .payments td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
        .payments tr:nth-child(even) td { background: #fbfdff; }
        .penalties { margin-bottom: 12px; }
        .penalties th { background: #fff7ed; color: #9a3412; }
        .amount { text-align: right; white-space: nowrap; }
        .empty { text-align: center; color: #94a3b8; padding: 16px !important; font-style: italic; }
        .footer { margin-top: 18px; color: #64748b; font-size: 9px; text-align: center; }
        .signature-panel {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 24px;
          align-items: end;
          margin-top: 72px;
          break-inside: avoid;
        }
        .signature-line {
          border-top: 1px solid #111827;
          min-height: 54px;
          text-align: center;
          padding-top: 8px;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .page-soft-break { break-before: auto; }
      </style>
    </head>
    <body>
      <div class="report">
        <header class="hero">
          <div class="brand-row">
            <div class="brand">
              <img src="${logoBase64}" alt="${escapeHtml(COMPANY_NAME)} logo" />
              <div>
                <div class="brand-name">${escapeHtml(COMPANY_NAME)}</div>
                <div class="muted">Loan Management System</div>
              </div>
            </div>
            <div class="generated">
              Report Date<br />
              <strong>${reportDate}</strong>
            </div>
          </div>
          <div class="doc-title">
            <div>
              <h1>Statement of Account</h1>
              <div class="muted">Consolidated borrower loan report - active and paid accounts included</div>
            </div>
            <div class="generated">
              Total Loans: <strong>${loanSummaries.length}</strong><br />
              Active: <strong>${activeCount}</strong> &nbsp; Paid: <strong>${paidCount}</strong>
            </div>
          </div>
        </header>

        <section class="client-panel">
          <div class="client-grid">
            <div class="field"><span>Client's Name</span><strong>${escapeHtml(borrower.fullName)}</strong></div>
            <div class="field"><span>Phone</span><strong>${escapeHtml(borrower.phone || 'N/A')}</strong></div>
            <div class="field"><span>Date of Birth</span><strong>${compactDate(borrower.dateOfBirth)}</strong></div>
            <div class="field"><span>Address</span><strong>${escapeHtml(borrower.address || 'N/A')}</strong></div>
            <div class="field"><span>Gender</span><strong>${escapeHtml(borrower.gender || 'N/A')}</strong></div>
            <div class="field"><span>Account Status</span><strong>${activeCount > 0 ? 'OPEN' : 'CLOSED'}</strong></div>
          </div>
        </section>

        <section class="metric-grid">
          <div class="metric"><span>Total Principal</span><strong>${money(grandPrincipal)}</strong></div>
          <div class="metric"><span>Loan Payable</span><strong>${money(grandLoanPayable)}</strong></div>
          <div class="metric penalty"><span>Computed Penalty</span><strong>${money(grandPenalty)}</strong></div>
          <div class="metric"><span>Total Payable</span><strong>${money(grandPayable)}</strong></div>
          <div class="metric success"><span>Total Paid</span><strong>${money(grandPaid)}</strong></div>
          <div class="metric accent"><span>Total Balance</span><strong>${money(grandBalance)}</strong></div>
          <div class="metric success"><span>Total Rebate</span><strong>${money(grandRebate)}</strong></div>
        </section>

        ${loanSections}

        <section class="signature-panel">
          <div class="muted">I acknowledge that I received and reviewed this Statement of Account, including any rebate shown above.</div>
          <div class="signature-line">Signature over printed name of customer</div>
        </section>

        <div class="footer">
          Generated by ${escapeHtml(COMPANY_NAME)}. This statement is system-generated and intended for borrower account review.
        </div>
      </div>
    </body>
    </html>
    `;

        await this.printOrShare(html, `Statement of Account - ${borrower.fullName}`);
    }

    static async generateLoanComputationSlip(
        borrower: BorrowerInfo,
        loan: LoanInfo,
        preparedBy: string = ''
    ): Promise<void> {
        const html = buildLoanComputationSlipHtml(borrower, loan, preparedBy);
        await this.printOrShare(html, `Computation Slip - ${borrower.fullName}`);
    }

    static async generateLoanContractForms(
        borrower: BorrowerInfo,
        loan: LoanInfo
    ): Promise<void> {
        const html = buildLoanContractFormsHtml(borrower, loan);
        await this.printOrShare(html, `Loan Forms - ${borrower.fullName}`);
    }

    static async generateCreditorsGroupLifeSummary(
        borrower: BorrowerInfo,
        loan: LoanInfo
    ): Promise<void> {
        const rows = CreditorsGroupLifeSummaryService.buildRows([{ borrower, loan }]);
        const html = CreditorsGroupLifeSummaryService.buildHtml({ rows });
        await this.printOrShare(html, `Creditors Group Life - ${borrower.fullName}`);
    }

    static async generateExcessCashReceipt(receipt: ExcessCashReceiptInfo): Promise<void> {
        const escapeHtml = (value: string | number | undefined | null) =>
            String(value ?? '').replace(/[&<>"']/g, char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            }[char] || char));
        const money = (value: number | undefined | null) => formatPHP(value || 0);
        const receiptDate = format(new Date(receipt.paymentDate), 'd MMM yyyy');
        const deductions = receipt.deductions?.length
            ? receipt.deductions.map(item => `
                <div class="deduction-row">
                    <span>${money(item.amount)}</span>
                    <strong>${escapeHtml(item.label)}</strong>
                </div>
            `).join('')
            : '<div class="deduction-row muted"><span>—</span><strong>No deductions recorded</strong></div>';

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A5 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #1f2937; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .receipt { width: 100%; min-height: 126mm; border: 2px solid #315f55; padding: 18px 22px 16px; position: relative; }
    .receipt:before { content: ""; position: absolute; inset: 7px; border: 1px solid rgba(49,95,85,.35); pointer-events: none; }
    .header { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 14px; }
    .header img { width: 42px; height: 42px; object-fit: contain; }
    .title-block { text-align: center; }
    .company { font-size: 11px; font-weight: 900; letter-spacing: 1.4px; color: #315f55; text-transform: uppercase; }
    h1 { margin: 1px 0 0; font-size: 27px; letter-spacing: 1px; color: #222; }
    .top-grid { display: grid; grid-template-columns: 1fr 160px; gap: 20px; align-items: start; margin-bottom: 8px; }
    .line-field { display: grid; grid-template-columns: max-content 1fr; gap: 10px; align-items: end; margin-bottom: 8px; font-size: 16px; }
    .label { font-weight: 900; letter-spacing: .3px; color: #374151; text-transform: uppercase; }
    .line { border-bottom: 1.5px solid #374151; min-height: 22px; padding: 0 8px 2px; font-weight: 800; }
    .date-box .line { text-align: center; }
    .date-box .caption { text-align: center; font-size: 11px; font-weight: 900; color: #4b5563; margin-top: 2px; }
    .remarks { min-height: 30px; }
    .cash-breakdown { margin: 18px 0 10px; max-width: 510px; }
    .cash-row { display: grid; grid-template-columns: 110px 1fr; gap: 12px; align-items: end; margin-bottom: 8px; color: #315f55; font-size: 17px; font-weight: 900; }
    .cash-row .amount-line { border-bottom: 1.5px solid #315f55; padding: 0 6px 1px; color: #111827; }
    .cash-row small { color: #315f55; font-size: 17px; font-weight: 900; }
    .deductions-title { margin: 12px 0 6px; color: #315f55; font-size: 17px; font-weight: 900; text-transform: uppercase; }
    .deductions { min-height: 58px; padding-left: 28px; }
    .deduction-row { display: grid; grid-template-columns: 110px 1fr; gap: 14px; max-width: 440px; margin-bottom: 6px; font-size: 15px; }
    .deduction-row span { border-bottom: 1px solid #64748b; padding: 0 6px 1px; text-align: right; }
    .deduction-row strong { font-weight: 800; }
    .muted { color: #94a3b8; }
    .footer-grid { display: grid; grid-template-columns: 1fr 260px; gap: 24px; align-items: end; margin-top: 8px; }
    .meta { font-size: 10px; color: #64748b; line-height: 1.5; }
    .signature { text-align: center; }
    .signature .line { min-height: 28px; font-size: 15px; }
    .signature .caption { font-size: 11px; font-weight: 900; color: #4b5563; text-transform: uppercase; line-height: 1.15; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <img src="${logoBase64}" alt="${escapeHtml(COMPANY_NAME)} logo" />
      <div class="title-block">
        <div class="company">${escapeHtml(COMPANY_NAME)}</div>
        <h1>CASH RECEIPT</h1>
      </div>
    </div>
    <div class="top-grid">
      <div>
        <div class="line-field"><div class="label">Received From:</div><div class="line">${escapeHtml(receipt.borrowerName)}</div></div>
        <div class="line-field"><div class="label">Amount Received:</div><div class="line">${money(receipt.amountReceived)}</div></div>
        <div class="line-field remarks"><div class="label">Remarks:</div><div class="line">${escapeHtml(receipt.remarks || 'Excess cash from loan payment')}</div></div>
      </div>
      <div class="date-box">
        <div class="line">${escapeHtml(receiptDate)}</div>
        <div class="caption">DATE</div>
        <div class="meta" style="text-align:center;margin-top:12px;">Receipt No.<br/><strong>${escapeHtml(receipt.receiptNumber || 'N/A')}</strong></div>
      </div>
    </div>
    <div class="cash-breakdown">
      <div class="cash-row"><div class="amount-line">${money(receipt.amountReceived)}</div><small>amt. of salary / pension</small></div>
      <div class="cash-row"><div class="amount-line">${money(receipt.amountDue)}</div><small>amt. due on ${escapeHtml(format(new Date(receipt.paymentDate), 'd MMM'))}</small></div>
      <div class="cash-row"><div class="amount-line">${money(receipt.amountRemaining)}</div><small>amt. remaining</small></div>
    </div>
    <div class="deductions-title">Deductions:</div>
    <div class="deductions">${deductions}</div>
    <div class="footer-grid">
      <div class="meta">
        Loan: <strong>${escapeHtml(receipt.loanNumber || 'N/A')}</strong><br/>
        Prepared by: <strong>${escapeHtml(receipt.preparedBy || 'System')}</strong>
      </div>
      <div class="signature">
        <div class="line">${escapeHtml(receipt.recipientName || receipt.borrowerName)}</div>
        <div class="caption">Signature over printed name<br/>Recipient</div>
      </div>
    </div>
  </div>
</body>
</html>`;

        await this.printOrShare(html, `Excess Cash Receipt - ${receipt.borrowerName}`);
    }

}
