const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function addFrequency(dateStr, frequency) {
    const d = new Date(dateStr);
    if (frequency === 'daily') d.setDate(d.getDate() + 1);
    else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
    else if (frequency === 'bi_monthly') d.setDate(d.getDate() + 15);
    else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
    return d.toISOString();
}

async function run() {
    console.log("Fetching loans...");
    const { data: loans, error } = await supabase.from('app_loans').select('*').is('deleted_at', null);
    if (error) throw error;

    console.log(`Found ${loans.length} loans. Generating computations and schedules...`);

    const schedulesToInsert = [];
    const loansToUpdate = [];

    for (const loan of loans) {
        let term = loan.term || 40;
        let originalInstallment = loan.installment_amount || 0;
        let originalPrincipal = loan.principal_amount || 0;
        let rate = loan.interest_rate || 24;

        let totalAmt = 0;
        let installmentAmt = originalInstallment;

        // If installment is 0, recalculate based on principal and fixed 24% typical interest
        if (installmentAmt <= 0 && originalPrincipal > 0) {
            const interestAmount = originalPrincipal * (rate / 100);
            totalAmt = originalPrincipal + interestAmount;
            installmentAmt = totalAmt / term;
        } else {
            // Excel mostly relied on installment_amount * term = total_payment
            totalAmt = installmentAmt * term;
        }

        // Safe Update
        loansToUpdate.push(
            supabase.from('app_loans').update({
                total_amount: totalAmt,
                installment_amount: installmentAmt,
                updated_at: new Date().toISOString()
            }).eq('id', loan.id)
        );

        // Calculate breakdown
        const totalFees = (loan.deposit_amount || 0) + (loan.insurance_amount || 0);
        const feesPerInstallment = totalFees / term;
        const interestPerInstallment = (totalAmt - originalPrincipal - totalFees) / term;
        const principalPerInstallment = originalPrincipal / term;

        // Generate schedule only if we have a valid release_date
        if (loan.release_date && totalAmt > 0) {
            let currentDateStr = loan.first_payment_date || loan.release_date;
            
            // Generate exact number of installments matching the term
            for (let i = 1; i <= term; i++) {
                currentDateStr = addFrequency(currentDateStr, loan.frequency || 'daily');
                
                schedulesToInsert.push({
                    id: crypto.randomUUID(),
                    loan_id: loan.id,
                    due_date: currentDateStr,
                    scheduled_amount: installmentAmt,
                    principal_amount: principalPerInstallment,
                    interest_amount: interestPerInstallment,
                    fees_amount: feesPerInstallment,
                    status: 'pending',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            }
        }
    }

    console.log(`Updating ${loansToUpdate.length} loans with total_amount...`);
    // Run updates in batches of 50 to avoid connection pooling limits
    for (let i = 0; i < loansToUpdate.length; i += 50) {
        const batch = loansToUpdate.slice(i, i + 50);
        await Promise.all(batch);
    }

    console.log(`Checking existing schedules to avoid duplicates...`);
    const { count } = await supabase.from('app_payment_schedules').select('*', { count: 'exact', head: true });
    
    if (count > 0) {
        console.log(`Found ${count} existing schedules. Deleting old schedules before bulk insert...`);
        // We delete in batches to avoid timeout if there are many
        await supabase.from('app_payment_schedules').delete().neq('status', 'ignore_me_dummy');
    }

    console.log(`Inserting ${schedulesToInsert.length} newly generated payment schedules...`);
    for (let i = 0; i < schedulesToInsert.length; i += 500) {
        const batch = schedulesToInsert.slice(i, i + 500);
        const { error: insErr } = await supabase.from('app_payment_schedules').insert(batch);
        if (insErr) console.error("Error inserting schedules:", insErr);
    }

    console.log("Done computing totals and schedules!");
}

run().catch(console.error);
