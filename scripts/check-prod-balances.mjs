import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function inspectProductionDb() {
  console.log('====================================================');
  console.log('   PRODUCTION DATABASE BALANCE & DATA AUDIT');
  console.log('====================================================\n');

  // 1. Borrowers & membership_status
  const { data: borrowers } = await supabase
    .from('app_borrowers')
    .select('*')
    .is('deleted_at', null);

  const statusCounts = {};
  for (const b of (borrowers || [])) {
    const status = b.membership_status || 'NULL_OR_EMPTY';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  console.log('1. BORROWERS (Active / Not Deleted):', (borrowers || []).length, 'total');
  console.log('   Membership Status breakdown:', statusCounts);
  console.log('');

  // 2. Savings & CBU Transactions (app_savings_transactions)
  const { data: savTx } = await supabase
    .from('app_savings_transactions')
    .select('*')
    .is('deleted_at', null);

  const txByType = {};
  let totalSavingsAmt = 0;
  let totalCbuAmt = 0;

  for (const tx of (savTx || [])) {
    const type = (tx.type || '').toLowerCase();
    txByType[type] = (txByType[type] || 0) + 1;
    const amt = Number(tx.amount || 0);
    if (type === 'savings' || type === 'opening_balance' || type === 'deposit') {
      totalSavingsAmt += amt;
    } else if (type === 'cbu' || type === 'cbu_opening_balance' || type === 'cbu_deposit') {
      totalCbuAmt += amt;
    }
  }

  console.log('2. SAVINGS TRANSACTIONS (app_savings_transactions):');
  console.log('   Counts by type:', txByType);
  console.log('   Total Savings Amount (type=savings): PHP', totalSavingsAmt.toLocaleString('en-US', { minimumFractionDigits: 2 }));
  console.log('   Total CBU Amount (type=cbu):         PHP', totalCbuAmt.toLocaleString('en-US', { minimumFractionDigits: 2 }));
  console.log('   TOTAL COMBINED SAVINGS + CBU:        PHP', (totalSavingsAmt + totalCbuAmt).toLocaleString('en-US', { minimumFractionDigits: 2 }));
  console.log('');

  // 3. Share Capital (app_share_capital_transactions)
  const { data: cbuTx } = await supabase
    .from('app_share_capital_transactions')
    .select('*')
    .is('deleted_at', null);
  console.log('3. SHARE CAPITAL (app_share_capital_transactions table):');
  console.log('   Total Rows:', (cbuTx || []).length);
  console.log('');

  // 4. Loans breakdown
  const { data: loans } = await supabase
    .from('app_loans')
    .select('*')
    .is('deleted_at', null);

  let totalPrincipal = 0;
  let totalAmount = 0;
  let totalPaid = 0;
  let totalBalance = 0;
  for (const l of (loans || [])) {
    totalPrincipal += Number(l.principal_amount || 0);
    totalAmount += Number(l.total_amount || 0);
    totalPaid += Number(l.paid_amount || 0);
    totalBalance += Number(l.balance || (Number(l.total_amount || 0) - Number(l.paid_amount || 0)) || 0);
  }

  console.log('4. LOANS (app_loans):');
  console.log('   Total Active Loans:', (loans || []).length);
  console.log('   Total Principal Amount:            PHP', totalPrincipal.toLocaleString('en-US', { minimumFractionDigits: 2 }));
  console.log('   Total Loan Amount (w/ int/fees):   PHP', totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }));
  console.log('   Total Paid Amount:                 PHP', totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 }));
  console.log('   Total Remaining Loan Balance:      PHP', totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }));
}

inspectProductionDb().catch(console.error);
