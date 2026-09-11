#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_SUMMARY_PATH,
  chooseCollectionPath,
  createPlan,
} = require('./agap-migration-lib');

function parseArgs(argv) {
  const args = {
    summaryPath: DEFAULT_SUMMARY_PATH,
    collectionPath: chooseCollectionPath(),
    outputDir: path.join('docs', 'reconciliation'),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--summary') args.summaryPath = argv[++i];
    else if (arg === '--collection') args.collectionPath = argv[++i];
    else if (arg === '--output-dir') args.outputDir = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/analyze-agap-excel-migration.js [--summary docs/SUMMARY.xlsx] [--collection "E:/.../COLLECTION SHEET.xlsx"] [--output-dir docs/reconciliation]');
      process.exit(0);
    }
  }
  return args;
}

function mdTable(rows) {
  if (!rows.length) return '_No rows._\n';
  const headers = Object.keys(rows[0]);
  const format = (value) => String(value ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${headers.map((header) => format(row[header])).join(' | ')} |`),
  ].join('\n') + '\n';
}

function topIssueRows(plan) {
  return plan.issues.slice(0, 50).map((issue) => ({
    level: issue.level,
    type: issue.type,
    borrower: issue.borrower || issue.borrower_id || '',
    loan: issue.loan_number || '',
    sheet: issue.sheetName || '',
    row: issue.sourceRow || '',
    expected: issue.expected ?? issue.computed_balance_from_payments ?? '',
    actual: issue.actual ?? issue.stated_latest_balance ?? '',
    difference: issue.difference ?? '',
  }));
}

function sheetRows(plan) {
  return plan.sheetSummaries.map((sheet) => ({
    sheet: sheet.sheetName,
    parsed: sheet.parsed,
    group: sheet.group || '',
    date: sheet.sheetDate || '',
    rows: sheet.parsedRows || 0,
    paymentColumns: sheet.paymentColumns || 0,
    reason: sheet.reason || '',
  }));
}

function writeReports(plan, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = plan.generatedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(outputDir, `agap-excel-migration-plan-${stamp}.json`);
  const mdPath = path.join(outputDir, `agap-excel-migration-report-${stamp}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(plan, null, 2));

  const report = [
    '# AGAP Excel Migration Analysis',
    '',
    `Generated: ${plan.generatedAt}`,
    '',
    'Mode: read-only workbook analysis. No database writes were performed.',
    '',
    '## Source Files',
    '',
    `- SUMMARY workbook: \`${plan.summary.sourceSummaryPath}\``,
    `- Collection workbook: \`${plan.summary.sourceCollectionPath}\``,
    '',
    '## Business Logic Inferred And Matched To App',
    '',
    `- Interest: ${plan.businessRules.standardInterest}.`,
    `- Weekly amortization: ${plan.businessRules.weeklyAmortization}.`,
    `- Total receivable: ${plan.businessRules.totalReceivable}.`,
    `- Deductions: ${plan.businessRules.deductions}.`,
    `- Net proceeds: ${plan.businessRules.netProceeds}.`,
    '',
    '## Summary',
    '',
    mdTable([plan.summary]),
    '',
    '## Sheet Coverage',
    '',
    mdTable(sheetRows(plan)),
    '',
    '## Review Items',
    '',
    mdTable(topIssueRows(plan)),
    '',
    '## Formula Evidence',
    '',
    '- Collection sheets use formulas such as `TOTAL DUE = WEEKLY PAYMENT x NO. OF WEEKS UNPAID` in column N.',
    '- Maturity dates often use release date plus 140 days, matching 20 weeks.',
    '- Weekly payments match GitHub issues #14/#15 for standard loans: for example PHP 30,000 gives 1,500 principal + 300 interest + 300 savings + 10 LPF = PHP 2,110 weekly.',
    '',
  ].join('\n');

  fs.writeFileSync(mdPath, report);
  return { jsonPath, mdPath };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const plan = createPlan(args);
  const outputs = writeReports(plan, args.outputDir);

  console.log(`Source collection workbook: ${plan.summary.sourceCollectionPath}`);
  console.log(`Borrowers: ${plan.summary.borrowers}`);
  console.log(`Borrowers with loans: ${plan.summary.borrowersWithLoans}`);
  console.log(`Loans: ${plan.summary.loans}`);
  console.log(`Payments extracted: ${plan.summary.payments}`);
  console.log(`Rollovers mapped: ${plan.summary.rollovers}`);
  console.log(`Review items: ${plan.summary.issueCount}`);
  console.log(`JSON plan: ${outputs.jsonPath}`);
  console.log(`Markdown report: ${outputs.mdPath}`);
}

main();
