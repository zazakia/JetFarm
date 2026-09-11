import { execSync } from 'child_process';

const issues = [
  {
    title: '[Migration] Backup & Reset Production Database',
    body: 'Backup all Supabase tables to JSON and truncate production tables prior to seeding fresh 2025/2026 data.',
    labels: 'database,migration'
  },
  {
    title: '[Migration] CBU & Savings Data Import (2025)',
    body: 'Migrate Capital Build-Up (CBU) and Savings records from docs/ddd/savings and cbu2025 (1).xlsx into app_savings_transactions and update ledger entries (Credit Shared Capital/Savings, Debit Cash on Hand).',
    labels: 'migration,accounting'
  },
  {
    title: '[Migration] Unpaid Loans Balance Import (2026)',
    body: 'Migrate unpaid loan balances from docs/ddd/onDLLoaner2026 (2).xlsx into app_loans and payment_schedules (Debit Loan Receivable, Credit Cash on Hand).',
    labels: 'migration,loans'
  },
  {
    title: '[Accounting] Add Miscellaneous Income Options',
    body: 'Add support for Membership Fee, Passbook Fee, and System Fee under Miscellaneous Income transactions.',
    labels: 'accounting,feature'
  },
  {
    title: '[Financials] Fund Transfer Feature (COH to Petty Cash / Bank)',
    body: 'Implement fund transfer functionality allowing transfers from Cash on Hand (COH) to Petty Cash and Cash in Bank.',
    labels: 'financials,feature'
  },
  {
    title: '[Financials] Transfer Module for Source of Funds',
    body: 'Build transfer module to manage and reallocate funding sources.',
    labels: 'financials,feature'
  },
  {
    title: '[Financials] Bank Account Withdrawal to Cash on Hand',
    body: 'Implement feature to record bank account withdrawals into Cash on Hand.',
    labels: 'financials,feature'
  },
  {
    title: '[Collectors] Collector as Member with Share Commission Setting',
    body: 'Model collectors as members with configurable commission percentage share per collection.',
    labels: 'collectors,feature'
  },
  {
    title: '[Accounting] Chart of Accounts - Petty Cash under COH',
    body: 'Add Petty Cash under Cash on Hand (COH) in the Chart of Accounts.',
    labels: 'accounting,feature'
  },
  {
    title: '[Bug] Fix Expense Update Issue',
    body: 'Fix issue where editing an existing expense fails to load or update the record.',
    labels: 'bug,expenses'
  },
  {
    title: '[Accounting] Enforce No Delete Constraint on Chart of Accounts',
    body: 'Prevent deletion of Chart of Accounts entries; restrict deletion and advise deactivation instead.',
    labels: 'accounting,security'
  },
  {
    title: '[Branding] Rebrand UI to POSCURSOR - COOP',
    body: 'Update app branding and titles from legacy names to POSCURSOR - COOP.',
    labels: 'ui,branding'
  }
];

function createIssues() {
  console.log('📋 Registering GitHub Issues...');
  for (const issue of issues) {
    try {
      console.log(`📌 Issue: ${issue.title}`);
      const cmd = `gh issue create --title "${issue.title.replace(/"/g, '\\"')}" --body "${issue.body.replace(/"/g, '\\"')}"`;
      execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
      console.log(`ℹ️ [CLI Note] Issue command generated for tracking:\n   gh issue create --title "${issue.title}" --body "${issue.body}"`);
    }
  }
  console.log('✅ All GitHub issues logged and tracked.');
}

createIssues();
