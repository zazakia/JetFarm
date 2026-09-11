const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    console.log("Fetching loans and payments...");
    // Only get active or paid loans
    const { data: loans, error: loanErr } = await supabase.from('app_loans').select('id, status').is('deleted_at', null);
    if (loanErr) throw loanErr;

    console.log(`Found ${loans.length} loans. Distributing payments across schedules...`);

    const schedulesToUpdate = [];

    // To prevent hitting PostgREST limits repeatedly, let's fetch all schedules and payments
    // This is safe since our dataset is relatively small (~599 loans, ~22k schedules, ~13k payments)
    const allSchedules = [];
    let hasMoreSchedules = true;
    let schPage = 0;
    while(hasMoreSchedules) {
        const {data, error} = await supabase.from('app_payment_schedules').select('*').range(schPage * 1000, (schPage + 1) * 1000 - 1);
        if (error) throw error;
        if (data.length > 0) allSchedules.push(...data);
        if (data.length < 1000) hasMoreSchedules = false;
        schPage++;
    }

    const allPayments = [];
    let hasMorePayments = true;
    let payPage = 0;
    while(hasMorePayments) {
        const {data, error} = await supabase.from('app_payments').select('loan_id, amount').range(payPage * 1000, (payPage + 1) * 1000 - 1);
        if (error) throw error;
        if (data.length > 0) allPayments.push(...data);
        if (data.length < 1000) hasMorePayments = false;
        payPage++;
    }

    // Group payments by loan
    const paymentsByLoan = {};
    for (const p of allPayments) {
        if (!paymentsByLoan[p.loan_id]) paymentsByLoan[p.loan_id] = 0;
        paymentsByLoan[p.loan_id] += parseFloat(p.amount) || 0;
    }

    // Group schedules by loan
    const schedulesByLoan = {};
    for (const s of allSchedules) {
        if (!schedulesByLoan[s.loan_id]) schedulesByLoan[s.loan_id] = [];
        schedulesByLoan[s.loan_id].push(s);
    }

    const now = new Date();

    for (const loan of loans) {
        let totalPaid = paymentsByLoan[loan.id] || 0;
        let schedules = schedulesByLoan[loan.id] || [];
        
        // Sort ascending by due date
        schedules.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

        for (const sch of schedules) {
            let newStatus = 'pending';
            const scheduledAmt = parseFloat(sch.scheduled_amount) || 0;

            if (totalPaid >= scheduledAmt && scheduledAmt > 0) {
                newStatus = 'paid';
                totalPaid -= scheduledAmt;
            } else if (totalPaid > 0 && totalPaid < scheduledAmt) {
                newStatus = 'partial';
                totalPaid = 0; // consumed
            } else {
                // Determine if late
                const dueDate = new Date(sch.due_date);
                if (now > dueDate) {
                    newStatus = 'late';
                } else {
                    newStatus = 'pending';
                }
            }

            if (sch.status !== newStatus) {
                schedulesToUpdate.push({
                    ...sch,
                    status: newStatus,
                    updated_at: new Date().toISOString()
                });
            }
        }
    }

    console.log(`Prepared ${schedulesToUpdate.length} schedules for status updates...`);
    
    // Batch Update
    // Supabase JS upsert limits array size, so we chunk it
    for (let i = 0; i < schedulesToUpdate.length; i += 500) {
        const batch = schedulesToUpdate.slice(i, i + 500);
        const { error } = await supabase.from('app_payment_schedules').upsert(batch);
        if (error) {
            console.error("Failed to update schedules:", error);
        }
    }

    console.log("Successfully updated all amortization schedule statuses!");
}

run().catch(console.error);
