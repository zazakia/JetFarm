import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function cleanDuplicates() {
  console.log('========================================================================');
  console.log('   DEEP DUPLICATE CHECK & CLEANUP IN PRODUCTION DATABASE');
  console.log('========================================================================\n');

  // 1. Fetch all borrowers
  const { data: borrowers } = await supabase
    .from('app_borrowers')
    .select('*')
    .is('deleted_at', null);

  // Group by clean name
  const borrowerGroupMap = new Map();
  for (const b of borrowers) {
    const key = (b.full_name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!borrowerGroupMap.has(key)) {
      borrowerGroupMap.set(key, []);
    }
    borrowerGroupMap.get(key).push(b);
  }

  let cleanedDuplicatesCount = 0;

  for (const [key, group] of borrowerGroupMap.entries()) {
    if (group.length > 1) {
      console.log(`🔍 Found duplicate group for "${group[0].full_name}":`);

      // Determine primary record (one with membership_number, or with non-zero transactions)
      const details = [];
      for (const b of group) {
        const [{ data: loans }, { data: cbu }, { data: savings }] = await Promise.all([
          supabase.from('app_loans').select('id').eq('borrower_id', b.id).is('deleted_at', null),
          supabase.from('app_share_capital_transactions').select('id, amount').eq('member_id', b.id),
          supabase.from('app_savings_transactions').select('id, amount').eq('member_id', b.id),
        ]);
        const cbuSum = (cbu || []).reduce((s, x) => s + Number(x.amount || 0), 0);
        const savSum = (savings || []).reduce((s, x) => s + Number(x.amount || 0), 0);
        details.push({
          borrower: b,
          loanCount: (loans || []).length,
          cbuSum,
          savSum,
          hasMemNo: !!(b.membership_number && b.membership_number !== 'No ID')
        });
      }

      // Sort details: primary first (has membership number, highest transactions)
      details.sort((a, b) => {
        if (a.hasMemNo !== b.hasMemNo) return a.hasMemNo ? -1 : 1;
        const sumA = a.loanCount + a.cbuSum + a.savSum;
        const sumB = b.loanCount + b.cbuSum + b.savSum;
        return sumB - sumA;
      });

      const primary = details[0].borrower;
      const duplicates = details.slice(1).map(d => d.borrower);

      console.log(`   ✅ KEEPING PRIMARY: ID=${primary.id} | Name="${primary.full_name}" | MemNo=${primary.membership_number}`);

      for (const dup of duplicates) {
        console.log(`   🗑️ REMOVING DUPLICATE: ID=${dup.id} | Name="${dup.full_name}" | MemNo=${dup.membership_number || 'No ID'}`);

        // Reassign any foreign keys from dup.id to primary.id if needed
        await supabase.from('app_loans').update({ borrower_id: primary.id }).eq('borrower_id', dup.id);
        await supabase.from('app_share_capital_transactions').update({ member_id: primary.id }).eq('member_id', dup.id);
        await supabase.from('app_savings_transactions').update({ member_id: primary.id }).eq('member_id', dup.id);

        // Soft delete duplicate borrower record
        const { error: delErr } = await supabase
          .from('app_borrowers')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', dup.id);

        if (delErr) {
          console.error(`   ❌ Failed to delete duplicate ${dup.id}:`, delErr.message);
        } else {
          cleanedDuplicatesCount++;
          console.log(`   ✨ Successfully soft-deleted duplicate borrower ID ${dup.id}`);
        }
      }
    }
  }

  // 2. Check for duplicate loans in app_loans
  console.log('\n--- Checking for Duplicate Loans in Production DB ---');
  const { data: allLoans } = await supabase.from('app_loans').select('*').is('deleted_at', null);

  const loanGroupMap = new Map();
  for (const l of allLoans) {
    const key = `${l.borrower_id}_${l.loan_number}`;
    if (!loanGroupMap.has(key)) {
      loanGroupMap.set(key, []);
    }
    loanGroupMap.get(key).push(l);
  }

  let cleanedDuplicateLoans = 0;
  for (const [key, lGroup] of loanGroupMap.entries()) {
    if (lGroup.length > 1) {
      console.log(`🔍 Found duplicate loan group for key "${key}" (${lGroup.length} records)`);
      // Keep the one with created_at or updated_at, soft delete the others
      const keep = lGroup[0];
      const dups = lGroup.slice(1);
      for (const d of dups) {
        await supabase.from('app_loans').update({ deleted_at: new Date().toISOString() }).eq('id', d.id);
        cleanedDuplicateLoans++;
        console.log(`   ✨ Soft-deleted duplicate loan ID ${d.id}`);
      }
    }
  }

  console.log('\n========================================================================');
  console.log('                  DUPLICATE CLEANUP SUMMARY');
  console.log('========================================================================');
  console.log(`Duplicate Borrowers Soft-Deleted:      ${cleanedDuplicatesCount}`);
  console.log(`Duplicate Loans Soft-Deleted:          ${cleanedDuplicateLoans}`);
  console.log('========================================================================\n');
}

cleanDuplicates().catch(console.error);
