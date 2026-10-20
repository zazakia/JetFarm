/**
 * annualReportHtml.ts
 *
 * Builds a multi-page HTML string for expo-print to render as PDF.
 * Matches the layout of the official Auditor's Report and Financial Statements
 * for POS Cursor Cooperative (SCSCC).
 *
 * Usage:
 *   const html = buildAnnualReportHtml(data);
 *   const { uri } = await Print.printToFileAsync({ html });
 *   await Sharing.shareAsync(uri);
 */

import { format } from 'date-fns';
import { COMPANY_NAME, COMPANY_NAME_FULL } from '../constants/brand';
import {
    AnnualReportData,
    FinancialConditionData,
    ActivitiesData,
    ChangesInFundBalanceData,
    CashFlowsData,
    NotesData,
    ComparativeAmount,
} from './FinancialStatementService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function php(amount: number): string {
    if (!isFinite(amount)) return 'PHP 0.00';
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        currencyDisplay: 'code',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount).replace(/\xA0/g, ' ');
}

function phpRow(label: string, curr: number, prior: number, bold = false, indent = false): string {
    const style = bold ? 'font-weight:700;' : '';
    const pl = indent ? 'padding-left:20px;' : '';
    const currStr = curr === 0 ? '–' : php(curr);
    const priorStr = prior === 0 ? '–' : php(prior);
    return `
    <tr>
      <td style="${pl}${style}">${label}</td>
      <td style="text-align:right;${style}">${currStr}</td>
      <td style="text-align:right;${style}">${priorStr}</td>
    </tr>`;
}

function sectionHeader(label: string): string {
    return `
    <tr>
      <td colspan="3" style="font-weight:700;color:#1E3A8A;padding-top:10px;padding-bottom:4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;">${label}</td>
    </tr>`;
}

function subtotalRow(label: string, curr: number, prior: number): string {
    return `
    <tr style="border-top:1px solid #ccc;">
      <td style="font-weight:700;padding-top:4px;">${label}</td>
      <td style="text-align:right;font-weight:700;padding-top:4px;">${php(curr)}</td>
      <td style="text-align:right;font-weight:700;padding-top:4px;">${php(prior)}</td>
    </tr>`;
}

function totalRow(label: string, curr: number, prior: number): string {
    return `
    <tr style="border-top:2px solid #1E3A8A;border-bottom:2px solid #1E3A8A;background:#EFF6FF;">
      <td style="font-weight:800;padding:5px 4px;">${label}</td>
      <td style="text-align:right;font-weight:800;padding:5px 4px;color:#1E3A8A;">${php(curr)}</td>
      <td style="text-align:right;font-weight:800;padding:5px 4px;color:#1E3A8A;">${php(prior)}</td>
    </tr>`;
}

function blankRow(): string {
    return '<tr><td colspan="3" style="padding:4px 0;">&nbsp;</td></tr>';
}

function tableWrapper(content: string, year: number, priorYear: number): string {
    return `
    <table style="width:100%;border-collapse:collapse;font-size:11px;font-family:Arial,sans-serif;">
      <thead>
        <tr style="border-bottom:2px solid #1E3A8A;">
          <th style="text-align:left;padding:6px 4px;font-weight:700;color:#1E3A8A;width:55%;">Particulars</th>
          <th style="text-align:right;padding:6px 4px;font-weight:700;color:#1E3A8A;width:22.5%;">${year}</th>
          <th style="text-align:right;padding:6px 4px;font-weight:700;color:#7c3aed;width:22.5%;">${priorYear}</th>
        </tr>
        <tr>
          <th></th>
          <th style="text-align:right;font-size:9px;color:#9ca3af;font-weight:400;padding-bottom:4px;">PHP</th>
          <th style="text-align:right;font-size:9px;color:#9ca3af;font-weight:400;padding-bottom:4px;">PHP</th>
        </tr>
      </thead>
      <tbody>${content}</tbody>
    </table>`;
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

function buildCoverPage(data: AnnualReportData): string {
    return `
  <div class="page cover-page">
    <div style="margin-bottom:24px;font-size:11px;color:#555;">
      THE AUDITOR'S REPORT AND FINANCIAL STATEMENTS OF
    </div>

    <div style="border-left:6px solid #C0392B;padding-left:20px;margin-bottom:32px;">
      <h1 style="font-size:36px;font-weight:900;color:#C0392B;line-height:1.1;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:-0.5px;">
        ${COMPANY_NAME_FULL}
      </h1>
      <p style="font-size:11px;color:#555;margin:0;font-weight:600;letter-spacing:1px;text-transform:uppercase;">
        P-2, Barangay Linao, Ormoc City, Leyte
      </p>
    </div>

    <div style="margin-bottom:40px;">
      <p style="font-size:16px;font-weight:800;color:#111;margin:0 0 4px;">
        As of and for the year ended December 31, ${data.year}
      </p>
      <p style="font-size:11px;color:#555;margin:0;">
        (With comparative figures as of and for the year ended December 31, ${data.priorYear})
      </p>
    </div>

    <div style="margin-top:auto;padding-top:80px;font-size:11px;color:#555;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #eee;"><strong>2–3</strong></td>
          <td style="padding:6px 0 6px 20px;border-bottom:1px solid #eee;font-style:italic;">Auditor's Opinion</td>
        </tr>
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #eee;"><strong>4</strong></td>
          <td style="padding:6px 0 6px 20px;border-bottom:1px solid #eee;font-style:italic;">Supplemental Written Statement</td>
        </tr>
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #eee;"><strong>5</strong></td>
          <td style="padding:6px 0 6px 20px;border-bottom:1px solid #eee;font-style:italic;">Report of Independent CPA</td>
        </tr>
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #eee;"><strong>6</strong></td>
          <td style="padding:6px 0 6px 20px;border-bottom:1px solid #eee;font-style:italic;">Statement of Financial Condition</td>
        </tr>
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #eee;"><strong>7</strong></td>
          <td style="padding:6px 0 6px 20px;border-bottom:1px solid #eee;font-style:italic;">Statement of Activities</td>
        </tr>
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #eee;"><strong>8</strong></td>
          <td style="padding:6px 0 6px 20px;border-bottom:1px solid #eee;font-style:italic;">Statement of Changes in Fund Balance</td>
        </tr>
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #eee;"><strong>9</strong></td>
          <td style="padding:6px 0 6px 20px;border-bottom:1px solid #eee;font-style:italic;">Statement of Cash Flows</td>
        </tr>
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #eee;"><strong>10–21</strong></td>
          <td style="padding:6px 0 6px 20px;border-bottom:1px solid #eee;font-style:italic;">Notes to Financial Statements</td>
        </tr>
        <tr>
          <td style="padding:6px 0;"><strong>&nbsp;</strong></td>
          <td style="padding:6px 0 6px 20px;font-style:italic;">Statement of Management Responsibility</td>
        </tr>
      </table>
    </div>

    <div style="margin-top:48px;font-size:10px;color:#aaa;text-align:center;">
      Generated ${format(data.generatedAt, 'MMMM d, yyyy')} · POS Cursor
    </div>
  </div>`;
}

// ─── Auditor's Opinion (pp. 2–3) ─────────────────────────────────────────────

function buildAuditorsOpinion(year: number): string {
    return `
  <div class="page">
    <div class="page-header">
      <span class="page-label">Auditor's Opinion</span>
      <span class="page-number">Pages 2–3</span>
    </div>

    <div class="org-header">
      <div class="org-name">Independent Auditor's Report</div>
      <div class="org-sub">To the Members of the Board of Directors<br/>${COMPANY_NAME_FULL}<br/>P-2, Barangay Linao, Ormoc City, Leyte</div>
    </div>

    <h3 style="color:#C0392B;font-size:13px;margin:16px 0 8px;">Opinion</h3>
    <p class="body-text">
      We have audited the financial statements of <strong>${COMPANY_NAME_FULL}</strong>
      which comprise the Statement of Financial Condition as of December 31, ${year},
      and the Statements of Activities, Changes in Fund Balance, and Cash Flows for the year then ended,
      and notes to the financial statements, including a summary of significant accounting policies.
    </p>
    <p class="body-text">
      In our opinion, the accompanying financial statements present fairly, in all material respects,
      the financial position of the Cooperative as of December 31, ${year},
      and its financial performance and its cash flows for the year then ended in accordance with
      Philippine Financial Reporting Standards (PFRS) for Small and Medium-sized Entities (SMEs)
      and the Cooperative Code of the Philippines (R.A. 9520).
    </p>

    <h3 style="color:#C0392B;font-size:13px;margin:16px 0 8px;">Basis for Opinion</h3>
    <p class="body-text">
      We conducted our audit in accordance with Philippine Standards on Auditing (PSAs).
      Our responsibilities under those standards are further described in the Auditor's Responsibilities section of our report.
      We are independent of the Cooperative in accordance with the Code of Ethics for Professional Accountants in the Philippines,
      and we have fulfilled our other ethical responsibilities in accordance with the Code.
      We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.
    </p>

    <h3 style="color:#C0392B;font-size:13px;margin:16px 0 8px;">Key Audit Matters</h3>
    <p class="body-text">
      The following matter was addressed in the context of our audit of the financial statements as a whole:
    </p>
    <p class="body-text" style="padding-left:16px;">
      <strong>Valuation of Loan Receivables</strong> — The cooperative's loan portfolio represents a significant portion of total assets.
      We assessed the adequacy of the allowance for impairment by reviewing individual loan files, repayment histories,
      and applying the cooperative's credit risk policies.
    </p>

    <h3 style="color:#C0392B;font-size:13px;margin:16px 0 8px;">Responsibilities of Management</h3>
    <p class="body-text">
      Management is responsible for the preparation and fair presentation of the financial statements in accordance with applicable financial reporting standards,
      and for such internal controls as management determines necessary to enable the preparation of financial statements that are free from material misstatement.
    </p>

    <h3 style="color:#C0392B;font-size:13px;margin:16px 0 8px;">Auditor's Responsibilities</h3>
    <p class="body-text">
      Our objectives are to obtain reasonable assurance about whether the financial statements are free from material misstatement,
      whether due to fraud or error, and to issue an auditor's report that includes our opinion.
      Reasonable assurance is a high level of assurance but is not a guarantee that an audit conducted in accordance with PSAs will always detect a material misstatement.
    </p>

    <div style="margin-top:48px;">
      <div style="display:flex;gap:40px;font-size:11px;">
        <div style="flex:1;">
          <div style="border-top:1px solid #333;padding-top:4px;margin-top:32px;font-weight:700;">[CPA Name]</div>
          <div>CPA License No. [Number]</div>
          <div>TIN: [TIN Number]</div>
          <div>BOA Accreditation No. [Number]</div>
        </div>
        <div style="flex:1;">
          <div style="margin-bottom:4px;"><strong>Date:</strong> ______________________</div>
          <div style="margin-bottom:4px;"><strong>Address:</strong> _________________________</div>
        </div>
      </div>
    </div>
  </div>`;
}

// ─── Supplemental Written Statement (p. 4) ────────────────────────────────────

function buildSupplementalStatement(year: number): string {
    return `
  <div class="page">
    <div class="page-header">
      <span class="page-label">Supplemental Written Statement</span>
      <span class="page-number">Page 4</span>
    </div>

    <div class="org-header">
      <div class="org-name">Supplemental Written Statement</div>
      <div class="org-sub">For the Year Ended December 31, ${year}</div>
    </div>

    <p class="body-text">
      The Board of Directors of <strong>${COMPANY_NAME_FULL}</strong>
      hereby submits its Supplemental Written Statement as required under the Cooperative Code of the Philippines (R.A. 9520)
      and the Cooperative Development Authority (CDA) reporting requirements.
    </p>

    <h3 style="font-size:12px;font-weight:700;margin:16px 0 6px;color:#1E3A8A;">1. Compliance with CDA Requirements</h3>
    <p class="body-text">
      The cooperative has complied with all reportorial requirements of the Cooperative Development Authority
      including the submission of Annual Progress Report, audited financial statements, and other required reports.
    </p>

    <h3 style="font-size:12px;font-weight:700;margin:16px 0 6px;color:#1E3A8A;">2. General Assembly</h3>
    <p class="body-text">
      The Annual General Assembly was held in accordance with the cooperative's by-laws.
      All agenda items, including the approval of annual reports and election of officers, were duly undertaken.
    </p>

    <h3 style="font-size:12px;font-weight:700;margin:16px 0 6px;color:#1E3A8A;">3. Capital Build-Up</h3>
    <p class="body-text">
      Members continued to increase their share capital contributions during the year,
      strengthening the cooperative's financial base and enabling greater lending capacity for the membership.
    </p>

    <h3 style="font-size:12px;font-weight:700;margin:16px 0 6px;color:#1E3A8A;">4. Loan Operations</h3>
    <p class="body-text">
      The cooperative continued its primary function of extending credit to members for productive and provident purposes.
      Loan products are designed to address the financial needs of members while maintaining portfolio quality.
    </p>

    <div style="margin-top:48px;font-size:11px;">
      <p style="margin:0 0 8px;"><strong>Certified by:</strong></p>
      <div style="display:flex;gap:60px;">
        <div>
          <div style="border-top:1px solid #333;padding-top:4px;margin-top:32px;font-weight:700;">Chairperson, Board of Directors</div>
        </div>
        <div>
          <div style="border-top:1px solid #333;padding-top:4px;margin-top:32px;font-weight:700;">General Manager / CEO</div>
        </div>
      </div>
    </div>
  </div>`;
}

// ─── Statement of Financial Condition (p. 6) ─────────────────────────────────

function buildFinancialCondition(fc: FinancialConditionData): string {
    const rows = `
    ${sectionHeader('ASSETS')}
    ${sectionHeader('Current Assets')}
    ${phpRow('Cash on Hand', fc.assets.cashOnHand.current, fc.assets.cashOnHand.prior, false, true)}
    ${phpRow('Cash in Bank', fc.assets.cashInBank.current, fc.assets.cashInBank.prior, false, true)}
    ${phpRow('Loan Receivables, Net', fc.assets.loanReceivable.current, fc.assets.loanReceivable.prior, false, true)}
    ${phpRow('Other Receivables', fc.assets.otherReceivables.current, fc.assets.otherReceivables.prior, false, true)}
    ${subtotalRow('Total Current Assets', fc.assets.totalCurrentAssets.current, fc.assets.totalCurrentAssets.prior)}
    ${blankRow()}
    ${totalRow('TOTAL ASSETS', fc.assets.totalAssets.current, fc.assets.totalAssets.prior)}
    ${blankRow()}
    ${sectionHeader('LIABILITIES')}
    ${phpRow('Member Savings Deposits', fc.liabilities.savingsDeposits.current, fc.liabilities.savingsDeposits.prior, false, true)}
    ${phpRow('Share Capital Payable', fc.liabilities.shareCapitalPayable.current, fc.liabilities.shareCapitalPayable.prior, false, true)}
    ${phpRow('Other Payables', fc.liabilities.otherPayables.current, fc.liabilities.otherPayables.prior, false, true)}
    ${subtotalRow('Total Liabilities', fc.liabilities.totalLiabilities.current, fc.liabilities.totalLiabilities.prior)}
    ${blankRow()}
    ${sectionHeader('FUND BALANCE (EQUITY)')}
    ${phpRow('Share Capital', fc.fundBalance.shareCapital.current, fc.fundBalance.shareCapital.prior, false, true)}
    ${phpRow('General Reserve Fund', fc.fundBalance.reserveFund.current, fc.fundBalance.reserveFund.prior, false, true)}
    ${phpRow('Education & Training Fund (CETF)', fc.fundBalance.educationFund.current, fc.fundBalance.educationFund.prior, false, true)}
    ${phpRow('Community Development Fund', fc.fundBalance.communityDevFund.current, fc.fundBalance.communityDevFund.prior, false, true)}
    ${phpRow('Optional Fund', fc.fundBalance.optionalFund.current, fc.fundBalance.optionalFund.prior, false, true)}
    ${phpRow('Retained Surplus / (Deficit)', fc.fundBalance.retainedSurplus.current, fc.fundBalance.retainedSurplus.prior, false, true)}
    ${subtotalRow('Total Fund Balance', fc.fundBalance.totalFundBalance.current, fc.fundBalance.totalFundBalance.prior)}
    ${blankRow()}
    ${totalRow('TOTAL LIABILITIES AND FUND BALANCE', fc.totalLiabilitiesAndFundBalance.current, fc.totalLiabilitiesAndFundBalance.prior)}`;

    return `
  <div class="page">
    <div class="page-header">
      <span class="page-label">Statement of Financial Condition</span>
      <span class="page-number">Page 6</span>
    </div>
    <div class="org-header">
      <div class="org-name">Statement of Financial Condition</div>
      <div class="org-sub">As of December 31, ${fc.year} (with comparative figures for ${fc.priorYear})</div>
    </div>
    ${tableWrapper(rows, fc.year, fc.priorYear)}
    <p style="font-size:9px;color:#9ca3af;margin-top:12px;">See accompanying Notes to Financial Statements.</p>
  </div>`;
}

// ─── Statement of Activities (p. 7) ──────────────────────────────────────────

function buildActivities(act: ActivitiesData): string {
    const rows = `
    ${sectionHeader('REVENUES')}
    ${phpRow('Interest Income on Loans', act.revenues.interestOnLoans.current, act.revenues.interestOnLoans.prior, false, true)}
    ${phpRow('Service Charges and Fees', act.revenues.serviceCharges.current, act.revenues.serviceCharges.prior, false, true)}
    ${phpRow('Membership Fees', act.revenues.membershipFees.current, act.revenues.membershipFees.prior, false, true)}
    ${phpRow('Other Income', act.revenues.otherIncome.current, act.revenues.otherIncome.prior, false, true)}
    ${subtotalRow('Total Revenues', act.revenues.totalRevenues.current, act.revenues.totalRevenues.prior)}
    ${blankRow()}
    ${sectionHeader('EXPENSES')}
    ${phpRow('Salaries and Wages', act.expenses.salariesAndWages.current, act.expenses.salariesAndWages.prior, false, true)}
    ${phpRow('Office and Administrative Expenses', act.expenses.officeExpenses.current, act.expenses.officeExpenses.prior, false, true)}
    ${phpRow('Depreciation and Amortization', act.expenses.depreciationAndAmortization.current, act.expenses.depreciationAndAmortization.prior, false, true)}
    ${phpRow('Other Expenses', act.expenses.otherExpenses.current, act.expenses.otherExpenses.prior, false, true)}
    ${subtotalRow('Total Expenses', act.expenses.totalExpenses.current, act.expenses.totalExpenses.prior)}
    ${blankRow()}
    ${totalRow('NET SURPLUS / (DEFICIT)', act.netSurplus.current, act.netSurplus.prior)}`;

    return `
  <div class="page">
    <div class="page-header">
      <span class="page-label">Statement of Activities</span>
      <span class="page-number">Page 7</span>
    </div>
    <div class="org-header">
      <div class="org-name">Statement of Activities</div>
      <div class="org-sub">For the Year Ended December 31, ${act.year} (with comparative figures for ${act.priorYear})</div>
    </div>
    ${tableWrapper(rows, act.year, act.priorYear)}
    <p style="font-size:9px;color:#9ca3af;margin-top:12px;">See accompanying Notes to Financial Statements.</p>
  </div>`;
}

// ─── Statement of Changes in Fund Balance (p. 8) ─────────────────────────────

function buildChangesInFundBalance(chg: ChangesInFundBalanceData): string {
    const rows = `
    ${phpRow('Fund Balance, Beginning of Year', chg.opening.current, chg.opening.prior, true)}
    ${blankRow()}
    ${sectionHeader('Additions')}
    ${phpRow('Net Surplus for the Year', chg.netSurplusForYear.current, chg.netSurplusForYear.prior, false, true)}
    ${blankRow()}
    ${sectionHeader('Statutory Allocations')}
    ${phpRow('General Reserve Fund (10%)', chg.statutoryAllocations.reserveFund.current, chg.statutoryAllocations.reserveFund.prior, false, true)}
    ${phpRow('Education & Training Fund (10%)', chg.statutoryAllocations.educationFund.current, chg.statutoryAllocations.educationFund.prior, false, true)}
    ${phpRow('Community Development Fund (3%)', chg.statutoryAllocations.communityDevFund.current, chg.statutoryAllocations.communityDevFund.prior, false, true)}
    ${phpRow('Optional Fund (7%)', chg.statutoryAllocations.optionalFund.current, chg.statutoryAllocations.optionalFund.prior, false, true)}
    ${subtotalRow('Total Statutory Allocations', chg.statutoryAllocations.totalAllocations.current, chg.statutoryAllocations.totalAllocations.prior)}
    ${blankRow()}
    ${phpRow('Dividends Declared to Members', chg.dividendsDeclared.current, chg.dividendsDeclared.prior, false, true)}
    ${blankRow()}
    ${totalRow('Fund Balance, End of Year', chg.closing.current, chg.closing.prior)}`;

    return `
  <div class="page">
    <div class="page-header">
      <span class="page-label">Statement of Changes in Fund Balance</span>
      <span class="page-number">Page 8</span>
    </div>
    <div class="org-header">
      <div class="org-name">Statement of Changes in Fund Balance</div>
      <div class="org-sub">For the Year Ended December 31, ${chg.year} (with comparative figures for ${chg.priorYear})</div>
    </div>
    ${tableWrapper(rows, chg.year, chg.priorYear)}
    <p style="font-size:9px;color:#9ca3af;margin-top:12px;">See accompanying Notes to Financial Statements.</p>
  </div>`;
}

// ─── Statement of Cash Flows (p. 9) ──────────────────────────────────────────

function buildCashFlows(cf: CashFlowsData): string {
    const cfRows = (items: { label: string; current: number; prior: number; inflow: boolean }[]) =>
        items.map(it => phpRow(it.label, it.inflow ? it.current : -it.current, it.inflow ? it.prior : -it.prior, false, true)).join('');

    const rows = `
    ${sectionHeader('OPERATING ACTIVITIES')}
    ${cfRows(cf.operating.items)}
    ${subtotalRow('Net Cash from Operating Activities', cf.operating.netOperating.current, cf.operating.netOperating.prior)}
    ${blankRow()}
    ${sectionHeader('INVESTING ACTIVITIES')}
    ${cfRows(cf.investing.items)}
    ${subtotalRow('Net Cash from Investing Activities', cf.investing.netInvesting.current, cf.investing.netInvesting.prior)}
    ${blankRow()}
    ${sectionHeader('FINANCING ACTIVITIES')}
    ${cfRows(cf.financing.items)}
    ${subtotalRow('Net Cash from Financing Activities', cf.financing.netFinancing.current, cf.financing.netFinancing.prior)}
    ${blankRow()}
    ${totalRow('NET INCREASE / (DECREASE) IN CASH', cf.netChange.current, cf.netChange.prior)}
    ${phpRow('Cash, Beginning of Year', cf.beginningCash.current, cf.beginningCash.prior, true)}
    ${totalRow('CASH, END OF YEAR', cf.endingCash.current, cf.endingCash.prior)}`;

    return `
  <div class="page">
    <div class="page-header">
      <span class="page-label">Statement of Cash Flows</span>
      <span class="page-number">Page 9</span>
    </div>
    <div class="org-header">
      <div class="org-name">Statement of Cash Flows</div>
      <div class="org-sub">For the Year Ended December 31, ${cf.year} (with comparative figures for ${cf.priorYear})</div>
    </div>
    ${tableWrapper(rows, cf.year, cf.priorYear)}
    <p style="font-size:9px;color:#9ca3af;margin-top:12px;">See accompanying Notes to Financial Statements.</p>
  </div>`;
}

// ─── Notes to Financial Statements (pp. 10–21) ───────────────────────────────

function buildNotes(notes: NotesData): string {
    const noteSection = (num: number, title: string, content: string) => `
    <div style="margin-bottom:24px;">
      <h3 style="font-size:12px;font-weight:800;color:#1E3A8A;margin:0 0 8px;border-bottom:1px solid #dbeafe;padding-bottom:4px;">
        Note ${num} — ${title}
      </h3>
      ${content}
    </div>`;

    const php2 = (n: number) => php(n);
    const n = notes;

    return `
  <div class="page">
    <div class="page-header">
      <span class="page-label">Notes to Financial Statements</span>
      <span class="page-number">Pages 10–21</span>
    </div>
    <div class="org-header">
      <div class="org-name">Notes to Financial Statements</div>
      <div class="org-sub">For the Year Ended December 31, ${n.year}</div>
    </div>

    ${noteSection(1, 'General Information',
        `<p class="body-text"><strong>${n.organization.name}</strong> (the "Cooperative") is a savings and credit cooperative
        organized and registered under the Cooperative Code of the Philippines (R.A. 9520).
        The Cooperative's principal address is ${n.organization.address}.</p>
        <p class="body-text">The primary purpose of the Cooperative is: ${n.organization.primaryPurpose}</p>`
    )}

    ${noteSection(2, 'Summary of Significant Accounting Policies',
        n.accountingPolicies.map((p, i) => `
        <p class="body-text"><strong>${p.split('—')[0]}</strong>${p.includes('—') ? ' —' + p.split('—').slice(1).join('—') : ''}</p>
        `).join('')
    )}

    ${noteSection(3, 'Farm Operations',
        `<p class="body-text">The agricultural operation as of December 31, ${n.year} is as follows:</p>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin:8px 0;">
          <tr style="background:#EFF6FF;font-weight:700;">
            <td style="padding:6px;">Particulars</td>
            <td style="text-align:right;padding:6px;">Amount</td>
          </tr>
          <tr><td style="padding:4px;">Parcels Under Management</td><td style="text-align:right;padding:4px;">${n.farmOperations.numberOfParcels.toLocaleString()}</td></tr>
          <tr><td style="padding:4px;">Total Parcel Area (ha)</td><td style="text-align:right;padding:4px;">${n.farmOperations.totalHectares.toLocaleString()}</td></tr>
          <tr><td style="padding:4px;">Active Crop Cycles</td><td style="text-align:right;padding:4px;">${n.farmOperations.activeCropCycles.toLocaleString()}</td></tr>
          <tr><td style="padding:4px;">Planted Area (ha)</td><td style="text-align:right;padding:4px;">${n.farmOperations.totalPlantedHectares.toLocaleString()}</td></tr>
          <tr><td style="padding:4px;">Expected Yield (kg)</td><td style="text-align:right;padding:4px;">${n.farmOperations.expectedYieldKg.toLocaleString()}</td></tr>
          <tr style="font-weight:700;border-top:1px solid #ccc;"><td style="padding:4px;">Actual Harvest (kg)</td><td style="text-align:right;padding:4px;">${n.farmOperations.actualYieldKg.toLocaleString()}</td></tr>
        </table>`
    )}

    ${noteSection(4, 'Production Costs',
        `<p class="body-text">Production costs recognized for the year comprise farm inputs, field labour paid, and land-owner settlements disbursed.</p>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin:8px 0;">
          <tr style="background:#EFF6FF;font-weight:700;">
            <td style="padding:6px;">Particulars</td>
            <td style="text-align:right;padding:6px;">Amount</td>
          </tr>
          <tr><td style="padding:4px;">Farm Inputs</td><td style="text-align:right;padding:4px;">${php2(n.productionCosts.farmExpenses)}</td></tr>
          <tr><td style="padding:4px;">Field Labour Paid</td><td style="text-align:right;padding:4px;">${php2(n.productionCosts.laborPaid)}</td></tr>
          <tr><td style="padding:4px;">Land-Owner Settlements</td><td style="text-align:right;padding:4px;">${php2(n.productionCosts.landOwnerSettlements)}</td></tr>
          <tr style="font-weight:700;border-top:1px solid #ccc;"><td style="padding:4px;">Total Production Cost</td><td style="text-align:right;padding:4px;">${php2(n.productionCosts.totalProductionCost)}</td></tr>
        </table>`
    )}

    ${noteSection(5, 'Investor Participation',
        `<p class="body-text">Crop investors fund capital in exchange for harvest off-take. The balance owed to investors is reduced by off-take deductions and any refunds paid.</p>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin:8px 0;">
          <tr style="background:#EFF6FF;font-weight:700;">
            <td style="padding:6px;">Particulars</td>
            <td style="text-align:right;padding:6px;">Amount</td>
          </tr>
          <tr><td style="padding:4px;">Number of Investors</td><td style="text-align:right;padding:4px;">${n.investorParticipation.numberOfInvestors.toLocaleString()}</td></tr>
          <tr><td style="padding:4px;">Capital Injected</td><td style="text-align:right;padding:4px;">${php2(n.investorParticipation.capitalInjected)}</td></tr>
          <tr><td style="padding:4px;">Off-take Deductions</td><td style="text-align:right;padding:4px;">${php2(n.investorParticipation.offtakeDeductions)}</td></tr>
          <tr><td style="padding:4px;">Payouts Refunded</td><td style="text-align:right;padding:4px;">${php2(n.investorParticipation.payoutsRefunded)}</td></tr>
          <tr style="font-weight:700;border-top:1px solid #ccc;"><td style="padding:4px;">Net Investor Balance</td><td style="text-align:right;padding:4px;">${php2(n.investorParticipation.netInvestorBalance)}</td></tr>
        </table>`
    )}

    ${noteSection(6, 'Statutory Funds',
        `<p class="body-text">Pursuant to R.A. 9520, the cooperative allocates a portion of its net surplus to statutory funds before any distribution to members:</p>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin:8px 0;">
          <tr style="background:#EFF6FF;font-weight:700;">
            <td style="padding:6px;">Fund</td>
            <td style="text-align:center;padding:6px;">Rate</td>
            <td style="text-align:right;padding:6px;">Balance</td>
          </tr>
          <tr><td style="padding:4px;">General Reserve Fund</td><td style="text-align:center;padding:4px;">10%</td><td style="text-align:right;padding:4px;">${php2(n.statutoryFunds.reserveFund)}</td></tr>
          <tr><td style="padding:4px;">Cooperative Education &amp; Training Fund (CETF)</td><td style="text-align:center;padding:4px;">10%</td><td style="text-align:right;padding:4px;">${php2(n.statutoryFunds.educationFund)}</td></tr>
          <tr><td style="padding:4px;">Community Development Fund</td><td style="text-align:center;padding:4px;">3%</td><td style="text-align:right;padding:4px;">${php2(n.statutoryFunds.communityDevFund)}</td></tr>
          <tr><td style="padding:4px;">Optional Fund</td><td style="text-align:center;padding:4px;">7%</td><td style="text-align:right;padding:4px;">${php2(n.statutoryFunds.optionalFund)}</td></tr>
        </table>`
    )}

    ${noteSection(7, 'Related Party Transactions',
        `<p class="body-text">${n.relatedPartyNote}</p>`
    )}

    ${noteSection(8, 'Events After the Reporting Period',
        `<p class="body-text">${n.eventsAfterReportingPeriod}</p>`
    )}
  </div>`;
}

// ─── Statement of Management Responsibility ───────────────────────────────────

function buildManagementResponsibility(year: number): string {
    return `
  <div class="page">
    <div class="page-header">
      <span class="page-label">Statement of Management Responsibility</span>
      <span class="page-number">Last Page</span>
    </div>

    <div class="org-header">
      <div class="org-name">Statement of Management Responsibility</div>
      <div class="org-sub">For the Financial Statements of<br/>${COMPANY_NAME_FULL}<br/>For the Year Ended December 31, ${year}</div>
    </div>

    <p class="body-text">
      The management of <strong>${COMPANY_NAME_FULL}</strong> is responsible for all information and representations contained in the
      Statement of Financial Condition as of December 31, ${year} and the Statements of Activities,
      Changes in Fund Balance, and Cash Flows for the year ended December 31, ${year},
      and the Notes to the Financial Statements.
    </p>

    <p class="body-text">
      The financial statements have been prepared in accordance with Philippine Financial Reporting Standards
      (PFRS) for Small and Medium-sized Entities (SMEs) and the Cooperative Code of the Philippines (R.A. 9520),
      and reflect amounts that are based on the best estimates and informed judgment of management with
      an appropriate consideration to materiality.
    </p>

    <p class="body-text">
      Management maintains a system of accounting and reporting which provides for the necessary internal controls
      to ensure that transactions are properly authorized and recorded, assets are safeguarded against unauthorized
      use or disposition, and liabilities are recognized.
    </p>

    <div style="margin-top:60px;font-size:11px;">
      <div style="display:flex;gap:40px;">
        <div style="flex:1;">
          <div style="border-top:1px solid #333;padding-top:4px;margin-top:48px;font-weight:700;text-align:center;">[Name of Chairperson]</div>
          <div style="text-align:center;color:#555;">Chairperson, Board of Directors</div>
        </div>
        <div style="flex:1;">
          <div style="border-top:1px solid #333;padding-top:4px;margin-top:48px;font-weight:700;text-align:center;">[Name of General Manager]</div>
          <div style="text-align:center;color:#555;">General Manager / CEO</div>
        </div>
        <div style="flex:1;">
          <div style="border-top:1px solid #333;padding-top:4px;margin-top:48px;font-weight:700;text-align:center;">[Name of Treasurer]</div>
          <div style="text-align:center;color:#555;">Treasurer</div>
        </div>
      </div>

      <div style="margin-top:32px;border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#f9fafb;">
        <p style="margin:0 0 4px;font-weight:700;font-size:10px;text-transform:uppercase;color:#6b7280;letter-spacing:1px;">Subscribed and Sworn</p>
        <p style="margin:0;font-size:10px;color:#555;">
          SUBSCRIBED AND SWORN to before me this ______ day of ________________, ${year + 1},
          affiants exhibiting to me their Government-issued IDs as stated above.
        </p>
      </div>
    </div>
  </div>`;
}

// ─── Master HTML Builder ──────────────────────────────────────────────────────

export function buildAnnualReportHtml(data: AnnualReportData): string {
    const pages = [
        buildCoverPage(data),
        buildAuditorsOpinion(data.year),
        buildSupplementalStatement(data.year),
        // Report of Independent CPA page is the same as Auditor's Opinion for template purposes
        buildFinancialCondition(data.financialCondition),
        buildActivities(data.activities),
        buildChangesInFundBalance(data.changesInFundBalance),
        buildCashFlows(data.cashFlows),
        buildNotes(data.notes),
        buildManagementResponsibility(data.year),
    ].join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Annual Financial Report ${data.year} — ${COMPANY_NAME}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #111;
      background: #fff;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 18mm 18mm 14mm 18mm;
      page-break-after: always;
      position: relative;
      background: #fff;
      display: flex;
      flex-direction: column;
    }

    .cover-page {
      justify-content: flex-start;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #C0392B;
      padding-bottom: 6px;
      margin-bottom: 16px;
    }

    .page-label {
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #C0392B;
    }

    .page-number {
      font-size: 9px;
      color: #9ca3af;
    }

    .org-header {
      margin-bottom: 20px;
      text-align: center;
    }

    .org-name {
      font-size: 16px;
      font-weight: 800;
      color: #1E3A8A;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .org-sub {
      font-size: 11px;
      color: #555;
      margin-top: 4px;
    }

    .body-text {
      font-size: 11px;
      line-height: 1.65;
      color: #333;
      margin-bottom: 10px;
      text-align: justify;
    }

    table td, table th {
      padding: 3px 4px;
      vertical-align: top;
    }

    @media print {
      .page { page-break-after: always; }
    }
  </style>
</head>
<body>
  ${pages}
</body>
</html>`;
}
