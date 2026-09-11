import { formatDate } from '../utils/dates';
import { formatPHP } from '../utils/currency';
import { LoanCalculatorService } from './LoanCalculatorService';
import { isInstitutionalLoanType, loanProductLabel } from '../utils/loanProducts';
import { COMPANY_NAME } from '../constants/brand';
import { logoBase64 } from '../utils/logoBase64';

export interface BorrowerInfo {
    fullName: string;
    address?: string;
    phone?: string;
    dateOfBirth?: number;
    gender?: string;
}

export interface LoanInfo {
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

function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function institutionalResult(loan: LoanInfo) {
    const loanType = isInstitutionalLoanType(loan.loanType) ? loan.loanType : 'petty_cash';
    return LoanCalculatorService.calculateInstitutionalLoan({
        loanType,
        principal: loan.principalAmount || 0,
        monthlyRatePercent: loan.interestRate || 0,
        term: loan.term || 1,
        termUnit: loan.termUnit || 'months',
        frequency: loan.frequency || 'monthly',
        releaseDate: loan.releaseDate ? new Date(loan.releaseDate) : new Date(),
        processingFee: loan.processingFee || 0,
        collectionFee: loan.collectionFee || 0,
        notarialFee: loan.notarialFee || 0,
        insuranceFee: loan.insuranceAmount || 0,
        rodFee: loan.rodFee || 0,
        ltoFee: loan.ltoFee || 0,
        udiRebatableFee: loan.udiRebatableFee || 0,
        outstandingBalance: loan.deductedAmount || 0,
        savingsPerPayment: loan.savingsPerPayment || 0,
        rebatePerPayment: loan.rebateAmount || 0,
    });
}

export function buildLoanComputationSlipHtml(
    borrower: BorrowerInfo,
    loan: LoanInfo,
    preparedBy: string = ''
): string {
        const result = institutionalResult(loan);
        const b = result.institutionalBreakdown!;
        const escapedName = escapeHtml(borrower.fullName);
        const productLabel = loanProductLabel(loan.loanType).toUpperCase();
        const monthlyLabel = loan.frequency === 'bi_monthly' ? 'BI-MONTHLY' : 'MONTHLY';

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; font-size: 11px; }
    .brand { display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:4px; }
    .brand-logo { width:42px; height:42px; object-fit:contain; }
    .company { text-align:center; font-weight:700; font-size:14px; }
    .address { text-align:center; font-size:9px; margin-bottom:18px; }
    .row { display:flex; justify-content:space-between; gap:12px; margin:2px 0; }
    .label { font-weight:700; }
    .value { min-width:130px; text-align:right; border-bottom:1px solid #777; }
    .section { font-weight:900; border-top:2px solid #111; margin-top:8px; padding-top:4px; }
    .sub { margin-left:18px; }
    .total { font-weight:900; border-top:1px solid #111; border-bottom:2px solid #111; padding:3px 0; }
    .highlight { background:#fff176; padding:2px 4px; font-weight:900; }
    .signature { margin-top:76px; display:flex; justify-content:space-between; align-items:flex-end; }
    .sigline { width:240px; border-top:1px solid #111; text-align:center; padding-top:8px; font-size:9px; min-height:42px; }
  </style>
</head>
<body>
  <div class="brand"><img class="brand-logo" src="${logoBase64}" alt="${escapeHtml(COMPANY_NAME)} logo"/><div class="company">${COMPANY_NAME}</div></div>
  <div class="address">LOT 4-BLOCK 3, RED STREET, CANSON SUBD., BRGY 2 POBLACION,<br/>LA CARLOTA CITY, NEGROS OCCIDENTAL, 6130</div>

  <div class="row"><span class="label">APPLICANT:</span><span style="flex:1;border-bottom:1px solid #777">${escapedName}</span></div>
  <div class="row"><span class="label">ADDRESS:</span><span style="flex:1;border-bottom:1px solid #777">${escapeHtml(borrower.address || '')}</span></div>
  <div class="row"><span class="label">TYPE OF LOAN</span><span class="value">${productLabel}</span></div>
  <h2 style="text-align:center;font-size:12px;margin:10px 0 6px">COMPUTATION SLIP</h2>

  <div class="section">BASIC INFORMATION</div>
  <div class="row"><span>LOAN AMOUNT</span><span class="value">${formatPHP(b.principal)}</span></div>
  <div class="row"><span>INTEREST RATE (per month)</span><span class="value">${b.monthlyRatePercent}%</span></div>
  <div class="row"><span>Term (no. of months)</span><span class="value">${b.termMonths}</span></div>
  <div class="row"><span>Interest Charges</span><span class="value">${formatPHP(b.interestCharges)}</span></div>

  <div class="section">OTHER CHARGES</div>
  <div class="row"><span>Processing fee</span><span class="value">${formatPHP(b.processingFee)}</span></div>
  <div class="row"><span>Collection fee</span><span class="value">${formatPHP(b.collectionFee)}</span></div>
  <div class="row"><span>Notarial fee</span><span class="value">${formatPHP(b.notarialFee)}</span></div>
  <div class="row"><span>Insurance fee</span><span class="value">${formatPHP(b.insuranceFee)}</span></div>
  ${b.rodFee > 0 ? `<div class="row sub"><span>Total ROD Charges</span><span class="value">${formatPHP(b.rodFee)}</span></div>` : ''}
  ${b.ltoFee > 0 ? `<div class="row sub"><span>Total LTO Charges</span><span class="value">${formatPHP(b.ltoFee)}</span></div>` : ''}
  ${b.udiRebatableFee > 0 ? `<div class="row"><span>UDI Rebatable Fees</span><span class="value">${formatPHP(b.udiRebatableFee)}</span></div>` : ''}
  <div class="row total"><span>TOTAL OTHER CHARGES</span><span>${formatPHP(b.totalOtherCharges)}</span></div>

  ${b.dstFee > 0 ? `
  <div class="section">TAXES</div>
  <div class="row"><span>DST (₱1.50/₱200) or 0.75% of Principal</span><span class="value">${formatPHP(b.dstFee)}</span></div>
  <div class="row total"><span>TOTAL TAXES</span><span>${formatPHP(b.totalTaxes)}</span></div>
  ` : ''}

  <div class="section">NET PROCEEDS</div>
  <div class="row"><span>Loan Amount</span><span class="value">${formatPHP(b.principal)}</span></div>
  ${b.dstFee > 0 ? `<div class="row sub"><span>DST</span><span class="value">${formatPHP(b.dstFee)}</span></div>` : ''}
  <div class="row sub"><span>Processing Fee</span><span class="value">${formatPHP(b.processingFee)}</span></div>
  <div class="row sub"><span>Collection Fee</span><span class="value">${formatPHP(b.collectionFee)}</span></div>
  <div class="row sub"><span>Notarial Fee</span><span class="value">${formatPHP(b.notarialFee)}</span></div>
  <div class="row sub"><span>Insurance Fee</span><span class="value">${formatPHP(b.insuranceFee)}</span></div>
  ${b.rodFee > 0 ? `<div class="row sub"><span>ROD Charges</span><span class="value">${formatPHP(b.rodFee)}</span></div>` : ''}
  ${b.ltoFee > 0 ? `<div class="row sub"><span>LTO Charges</span><span class="value">${formatPHP(b.ltoFee)}</span></div>` : ''}
  <div class="row sub"><span>Outstanding Balance</span><span class="value">${formatPHP(b.outstandingBalance)}</span></div>
  <div class="row total"><span>TOTAL DEDUCTIONS</span><span>${formatPHP(b.totalDeductions)}</span></div>
  <div class="row total"><span>NET PROCEEDS</span><span class="highlight">${formatPHP(b.netProceeds)}</span></div>

  <div class="section">${monthlyLabel} AMORTIZATION</div>
  <div class="row"><span>Principal</span><span class="value">${formatPHP(b.principalPerPayment)}</span></div>
  <div class="row"><span>Interest</span><span class="value">${formatPHP(b.interestPerPayment)}</span></div>
  ${b.savingsPerPayment ? `<div class="row"><span>Savings</span><span class="value">${formatPHP(b.savingsPerPayment)}</span></div>` : ''}
  ${b.rebatePerPayment ? `<div class="row"><span>REBATE</span><span class="value">-${formatPHP(b.rebatePerPayment)}</span></div>` : ''}
  <div class="row total"><span>TOTAL ${monthlyLabel} AMORTIZATION</span><span>${formatPHP(result.installmentAmount)}</span></div>

  <div class="signature">
    <div>${escapeHtml(preparedBy)}</div>
    <div class="sigline">Signature over printed name of Borrower</div>
  </div>
  <p style="margin-top:18px">In compliance with Republic Act No. 3765, I/we hereby certify that I/we were informed in writing of all of the above.</p>
</body>
</html>`;

        return html;
}



export function buildLoanContractFormsHtml(
    borrower: BorrowerInfo,
    loan: LoanInfo
): string {
        const result = institutionalResult(loan);
        const b = result.institutionalBreakdown!;
        const releaseDate = loan.releaseDate ? new Date(loan.releaseDate) : new Date();
        const maturityDate = loan.maturityDate ? new Date(loan.maturityDate) : result.maturityDate;
        const escapedName = escapeHtml(borrower.fullName);
        const escapedAddress = escapeHtml(borrower.address || '');
        const productLabel = loanProductLabel(loan.loanType);
        const paymentWord = loan.frequency === 'bi_monthly' ? 'bi-monthly' : loan.frequency;

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: "Times New Roman", serif; margin: 28px; color:#111; font-size:12px; line-height:1.35; }
    .brand { display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:4px; }
    .brand-logo { width:44px; height:44px; object-fit:contain; }
    .company { text-align:center; font-weight:700; font-size:14px; }
    .address { text-align:center; font-size:9px; margin-bottom:22px; }
    h2 { text-align:center; font-size:15px; margin:18px 0; letter-spacing:1.5px; }
    .line { border-bottom:1px solid #111; display:inline-block; min-width:160px; text-align:center; padding:0 8px; }
    .sigrow { display:flex; justify-content:space-between; gap:24px; margin-top:88px; }
    .sig { flex:1; border-top:1px solid #111; text-align:center; padding-top:8px; font-weight:700; min-height:54px; }
    .page-break { page-break-before: always; margin-top:36px; }
  </style>
</head>
<body>
  <div class="brand"><img class="brand-logo" src="${logoBase64}" alt="${escapeHtml(COMPANY_NAME)} logo"/><div class="company">${COMPANY_NAME}</div></div>
  <div class="address">LOT 4-BLOCK 3, RED STREET, CANSON SUBD., BRGY 2 POBLACION, LA CARLOTA CITY, NEGROS OCCIDENTAL, 6130</div>
  <h2>PROMISSORY NOTE</h2>
  <p style="text-align:center;font-size:10px;margin-top:-10px">Loan No. <b>${escapeHtml(loan.loanNumber)}</b> &bull; ${escapeHtml(productLabel)}</p>
  <p>For value received, I/WE jointly and severally promise to pay to the order of <b>${COMPANY_NAME}</b> the sum of <span class="line">${formatPHP(result.totalAmount)}</span> Philippine Currency, payable as a <b>${escapeHtml(productLabel)}</b>.</p>
  <p>Payment shall be made in ${result.numPayments} ${paymentWord} installment(s) of <span class="line">${formatPHP(result.installmentAmount)}</span>, starting on <span class="line">${formatDate(result.firstPaymentDate)}</span> and every succeeding ${paymentWord} thereafter until fully paid, with final maturity on <span class="line">${formatDate(maturityDate)}</span>.</p>
  <p>Default in any installment makes the full unpaid balance immediately due and demandable, together with applicable penalties, costs of collection, attorney's fees, and lawful charges.</p>
  <p>Signed at La Carlota City, Negros Occidental, Philippines this <span class="line">${formatDate(releaseDate)}</span>.</p>
  <div class="sigrow">
    <div class="sig">${escapedName}<br/><span style="font-weight:400">Borrower<br/>${escapedAddress}</span></div>
    <div class="sig">&nbsp;<br/><span style="font-weight:400">Co-maker / Witness</span></div>
  </div>

  <div class="page-break"></div>
  <h2>SWORN CERTIFICATION</h2>
  <p>I, <span class="line">${escapedName}</span>, Filipino, of legal age, with residence address at <span class="line">${escapedAddress}</span>, after having been subscribed to an oath, depose and say:</p>
  <p>That I am a debtor of <b>${COMPANY_NAME}</b> with the total amount of <span class="line">${formatPHP(result.totalAmount)}</span>, payable in <span class="line">${loan.term} ${loan.termUnit}</span>.</p>
  <p>That I voluntarily deposit my payroll/pension ATM card or agreed collateral for the entire credit term as security for the loan borrowed, and authorize deductions/collections on the due dates specified in the loan contract.</p>
  <p>That I undertake not to take steps that would impair my obligations, including declaring the ATM lost, mobile banking changes, or other loan applications that may affect repayment.</p>
  <p>IN WITNESS WHEREOF, I have hereunto set my hand this <span class="line">${formatDate(releaseDate)}</span> in La Carlota City, Philippines.</p>
  <div class="sigrow">
    <div></div>
    <div class="sig">${escapedName}<br/><span style="font-weight:400">Affiant</span></div>
  </div>
  <p style="margin-top:54px">SUBSCRIBED AND SWORN TO BEFORE ME this ______ day of ______________, in the City of La Carlota, Philippines.</p>
</body>
</html>`;

        return html;
}
