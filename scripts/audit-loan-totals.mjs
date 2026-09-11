import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const supabaseKey = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
    console.log(`Starting Loan Totals Audit (${new Date().toLocaleString()})`);
    console.log(`URL: ${supabaseUrl}`);
    console.log(`Key (first 10): ${supabaseKey.substring(0, 10)}...`);
    
    // 1. Fetch all active loans
    const { data: loans, error: loansError } = await supabase
        .from('app_loans')
        .select('*')
        .eq('status', 'active')
        .is('deleted_at', null);

    if (loansError) {
        console.error('Error fetching loans:', loansError);
        return;
    }

    const loanIds = loans.map(l => l.id);

    // 2. Fetch payment schedules for these loans (PAGINATED)
    let allSchedules = [];
    let hasMore = true;
    let offset = 0;
    const pageSize = 1000;

    console.log('Fetching payment schedules in batches...');
    while (hasMore) {
        const { data: batch, error: sError } = await supabase
            .from('app_payment_schedules')
            .select('loan_id, principal_amount, interest_amount, fees_amount')
            .in('loan_id', loanIds)
            .range(offset, offset + pageSize - 1);

        if (sError) {
            console.error('Error fetching schedules batch:', sError);
            return;
        }

        allSchedules = allSchedules.concat(batch);
        console.log(`  Fetched ${allSchedules.length} schedules...`);
        
        if (batch.length < pageSize) {
            hasMore = false;
        } else {
            offset += pageSize;
        }
    }

    const schedulesByLoanId = allSchedules.reduce((map, s) => {
        if (!map[s.loan_id]) map[s.loan_id] = [];
        map[s.loan_id].push(s);
        return map;
    }, {});

    // 3. Fetch borrowers to map names
    const { data: borrowers, error: bError } = await supabase
        .from('app_borrowers')
        .select('id, first_name, last_name, full_name');

    if (bError) {
        console.warn('Error fetching borrowers, proceeding without names:', bError);
    }

    const borrowerMap = new Map((borrowers || []).map(b => [b.id, b]));

    console.log(`Found ${loans.length} active loans to audit.`);

    const results = {
        summary: {
            totalAudited: loans.length,
            perfectMatches: 0,
            mismatches: 0,
            minorDiscrepancies: 0, // < 1.00
            totalDiff: 0
        },
        mismatches: [],
        timestamp: new Date().toISOString()
    };

    for (const loan of loans) {
        const borrower = borrowerMap.get(loan.borrower_id);
        const borrowerName = borrower ? (borrower.full_name || `${borrower.first_name} ${borrower.last_name}`) : 'Unknown';
        const principal = Number(loan.principal_amount || 0);
        const interest = Number(loan.interest_amount || 0);
        const deposit = Number(loan.deposit_amount || 0);
        const insurance = Number(loan.insurance_amount || 0);
        const storedTotal = Number(loan.total_amount || 0);
        const deducted = Number(loan.deducted_amount || 0);
        
        // Calculation 1: Total Loan Amount
        const calculatedTotal = principal + interest + deposit + insurance;
        const totalAmountDiff = Math.abs(storedTotal - calculatedTotal);

        // Calculation 2: Net Release (Principal - Deducted)
        // Note: The UI displays this as Net Release.
        const expectedNetRelease = principal - deducted;
        
        // Calculation 3: Schedule Sum
        const schedules = schedulesByLoanId[loan.id] || [];
        const scheduleSum = schedules.reduce((sum, s) => {
            return sum + Number(s.principal_amount || 0) + Number(s.interest_amount || 0) + Number(s.fees_amount || 0);
        }, 0);
        const scheduleDiff = Math.abs(storedTotal - scheduleSum);

        const hasTotalMismatch = totalAmountDiff > 0.01;
        const hasScheduleMismatch = scheduleDiff > 0.01;

        if (hasTotalMismatch || hasScheduleMismatch) {
            const isMinor = totalAmountDiff < 1.0 && scheduleDiff < 1.0;
            
            if (isMinor) {
                results.summary.minorDiscrepancies++;
            } else {
                results.summary.mismatches++;
            }

            results.mismatches.push({
                borrower: borrowerName,
                loanId: loan.id,
                loanNumber: loan.loan_number || 'N/A',
                principal,
                storedTotal,
                calculatedTotal,
                totalDiff: storedTotal - calculatedTotal,
                scheduleSum,
                scheduleDiff: storedTotal - scheduleSum,
                deductedAmount: deducted,
                netRelease: expectedNetRelease,
                isMinor
            });
            
            results.summary.totalDiff += Math.max(totalAmountDiff, scheduleDiff);
        } else {
            results.summary.perfectMatches++;
        }
    }

    const reportPath = path.join(process.cwd(), 'data', 'audit_loan_totals_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

    console.log('\nAudit Summary:');
    console.log(`- Total Audited: ${results.summary.totalAudited}`);
    console.log(`- Perfect Matches: ${results.summary.perfectMatches}`);
    console.log(`- Mismatches (> 1.00): ${results.summary.mismatches}`);
    console.log(`- Minor Discrepancies (< 1.00): ${results.summary.minorDiscrepancies}`);
    console.log(`- Report saved to: ${reportPath}`);
}

runAudit().catch(console.error);
