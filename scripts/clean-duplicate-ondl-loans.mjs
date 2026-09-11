import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function cleanOndlDuplicates() {
  console.log('Fetching active loans from app_loans...');
  const { data: loans, error } = await supabase
    .from('app_loans')
    .select('id, loan_number, borrower_id, principal_amount, total_amount, status, created_at')
    .is('deleted_at', null);

  if (error) {
    console.error('Error fetching loans:', error);
    return;
  }

  // Filter ON-DL loans
  const ondlLoans = loans.filter(l => l.loan_number && l.loan_number.includes('ONDL'));

  // Group ON-DL loans by borrower_id + principal_amount + status
  const groups = new Map();
  for (const l of ondlLoans) {
    const key = `${l.borrower_id}_${l.principal_amount}_${l.status}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }

  let deletedCount = 0;

  for (const [key, list] of groups.entries()) {
    if (list.length > 1) {
      console.log(`\nDuplicate ON-DL group [${key}] with ${list.length} loans:`);

      // Check which loans have payments or payment schedules
      const listWithDetails = await Promise.all(list.map(async (loan) => {
        const [{ count: paymentCount }, { count: scheduleCount }] = await Promise.all([
          supabase.from('app_payments').select('id', { count: 'exact', head: true }).eq('loan_id', loan.id),
          supabase.from('app_payment_schedules').select('id', { count: 'exact', head: true }).eq('loan_id', loan.id)
        ]);
        return {
          ...loan,
          paymentCount: paymentCount || 0,
          scheduleCount: scheduleCount || 0
        };
      }));

      // Sort: keep the one with most payments/schedules first, then earlier created_at
      listWithDetails.sort((a, b) => {
        if (a.paymentCount !== b.paymentCount) return b.paymentCount - a.paymentCount;
        if (a.scheduleCount !== b.scheduleCount) return b.scheduleCount - a.scheduleCount;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const keep = listWithDetails[0];
      const remove = listWithDetails.slice(1);

      console.log(`  KEEPING: ID=${keep.id} | Loan#=${keep.loan_number} | Payments=${keep.paymentCount} | Schedules=${keep.scheduleCount}`);
      
      for (const dup of remove) {
        console.log(`  DELETING DUP: ID=${dup.id} | Loan#=${dup.loan_number} | Payments=${dup.paymentCount} | Schedules=${dup.scheduleCount}`);
        const { error: delErr } = await supabase
          .from('app_loans')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', dup.id);
        
        if (delErr) {
          console.error(`  FAILED to delete ${dup.id}:`, delErr.message);
        } else {
          deletedCount++;
          console.log(`  SOFT-DELETED loan ${dup.id}`);
        }
      }
    }
  }

  console.log(`\nCleaned ${deletedCount} duplicate ON-DL loans.`);
}

cleanOndlDuplicates().catch(console.error);
