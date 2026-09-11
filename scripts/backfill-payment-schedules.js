const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Simplified Date Utilities
function addFrequency(date, frequency) {
    const d = new Date(date);
    switch (frequency) {
        case 'daily': 
            d.setDate(d.getDate() + 1);
            break;
        case 'weekly': 
            d.setDate(d.getDate() + 7);
            break;
        case 'bi_monthly': 
            d.setDate(d.getDate() + 15);
            break;
        case 'monthly': 
            d.setMonth(d.getMonth() + 1);
            break;
        default: 
            d.setMonth(d.getMonth() + 1);
    }
    return d;
}

function paymentsForFrequency(term, termUnit, frequency) {
    if (termUnit === 'days') {
        switch (frequency) {
            case 'daily': return term;
            case 'weekly': return Math.ceil(term / 7);
            case 'bi_monthly': return Math.ceil(term / 15);
            case 'monthly': return Math.ceil(term / 30);
            default: return Math.ceil(term / 30);
        }
    } else {
        switch (frequency) {
            case 'daily': return Math.round(term * 30);
            case 'weekly': return Math.round(term * 4); // 24 payments for 6 months
            case 'bi_monthly': return term * 2;
            case 'monthly': return term;
            default: return term;
        }
    }
}

async function backfill() {
    console.log("--- Starting Payment Schedule Backfill ---");
    
    // 1. Fetch active loans that have 0 schedules
    const { data: loans, error: loanError } = await supabase
        .from('app_loans')
        .select('*')
        .eq('status', 'active');
        
    if (loanError) {
        console.error("Error fetching loans:", loanError);
        return;
    }

    console.log(`Found ${loans.length} active loans.`);

    for (const loan of loans) {
        // Check if schedules already exist for this loan
        const { count, error: countError } = await supabase
            .from('app_payment_schedules')
            .select('*', { count: 'exact', head: true })
            .eq('loan_id', loan.id);
            
        if (countError) {
            console.error(`Error checking schedules for loan ${loan.id}:`, countError);
            continue;
        }

        if (count > 0) {
            console.log(`Loan ${loan.loan_number} (${loan.id}) already has ${count} schedules. Skipping.`);
            continue;
        }

        console.log(`Processing Loan ${loan.loan_number} (${loan.id})...`);

        // Generate schedules
        const numPayments = paymentsForFrequency(loan.term, loan.term_unit, loan.frequency);
        const totalAmount = loan.total_amount || 0;
        const installmentAmount = loan.installment_amount || (totalAmount / numPayments);
        
        let currentDate = new Date(loan.first_payment_date || loan.release_date);
        const schedules = [];

        for (let i = 1; i <= numPayments; i++) {
            schedules.push({
                id: crypto.randomUUID(),
                loan_id: loan.id,
                due_date: currentDate.toISOString(),
                scheduled_amount: installmentAmount,
                status: 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            currentDate = addFrequency(currentDate, loan.frequency);
        }

        if (schedules.length > 0) {
            const { error: insertError } = await supabase
                .from('app_payment_schedules')
                .insert(schedules);
                
            if (insertError) {
                console.error(`Error inserting schedules for loan ${loan.id}:`, insertError);
            } else {
                console.log(`Inserted ${schedules.length} schedules for loan ${loan.id}.`);
            }
        }
    }

    console.log("--- Backfill Complete ---");
}

backfill();
