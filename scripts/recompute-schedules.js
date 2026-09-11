const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Date Utilities ────────────────────────────────────────

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function addWeeks(date, weeks) {
    return addDays(date, weeks * 7);
}

function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}

/** Checks if a date is Sunday in Philippine Time (UTC+8) */
function isSundayPHP(date) {
    const phpDate = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    return phpDate.getUTCDay() === 0;
}

/** If date is Sunday (PHP), advance to Monday */
function skipSunday(date) {
    if (isSundayPHP(date)) return addDays(date, 1);
    return date;
}

/** First payment = release date + 1 day, skip Sunday (PHP) */
function firstPaymentDate(releaseDate) {
    const next = addDays(new Date(releaseDate), 1);
    return skipSunday(next);
}

/** Apply frequency increment, then skip Sunday (PHP) */
function addFrequencySkipSunday(date, frequency) {
    let next;
    switch (frequency) {
        case 'daily':
            next = addDays(date, 1);
            if (isSundayPHP(next)) next = addDays(next, 1);
            return next;
        case 'weekly': return skipSunday(addWeeks(date, 1));
        case 'bi_monthly': return skipSunday(addDays(date, 15));
        case 'monthly': return skipSunday(addMonths(date, 1));
        default: return skipSunday(addMonths(date, 1));
    }
}

// ─── Loan Calculation ──────────────────────────────────────

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
            case 'weekly': return Math.round(term * 4);
            case 'bi_monthly': return term * 2;
            case 'monthly': return term;
            default: return term;
        }
    }
}

function generateSchedule(loan) {
    const numPayments = paymentsForFrequency(loan.term, loan.term_unit, loan.frequency);
    const totalAmount = loan.total_amount || 0;
    const installmentAmount = loan.installment_amount || (totalAmount / numPayments);

    const releaseDate = new Date(loan.release_date);
    const fpDate = firstPaymentDate(releaseDate);

    const schedule = [];
    let currentDate = new Date(fpDate);

    for (let i = 1; i <= numPayments; i++) {
        schedule.push({
            number: i,
            dueDate: new Date(currentDate),
            scheduledAmount: installmentAmount,
        });
        currentDate = addFrequencySkipSunday(currentDate, loan.frequency);
    }

    return {
        numPayments,
        totalAmount,
        installmentAmount,
        firstPaymentDate: fpDate,
        maturityDate: schedule.length > 0 ? schedule[schedule.length - 1].dueDate : fpDate,
        schedule,
    };
}

// ─── Payment Distribution (FIFO) ──────────────────────────

function distributePayments(scheduleRows, payments, totalAmount) {
    const now = new Date();
    const scheduleStatus = scheduleRows.map(s => ({
        ...s,
        amountPaid: 0,
        status: 'pending',
    }));

    const sortedPayments = [...payments].sort((a, b) =>
        new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
    );

    let creditTotal = sortedPayments.reduce((sum, p) => sum + p.amount, 0);
    let creditLeft = creditTotal;

    for (const sched of scheduleStatus) {
        if (creditLeft <= 0) break;

        const needed = sched.scheduledAmount;
        if (creditLeft >= needed) {
            sched.amountPaid = needed;
            sched.status = 'paid';
            creditLeft -= needed;
        } else {
            sched.amountPaid = creditLeft;
            sched.status = 'partial';
            creditLeft = 0;
        }
    }

    for (const sched of scheduleStatus) {
        if (sched.status === 'pending' || sched.status === 'partial') {
            if (new Date(sched.dueDate) < now) {
                sched.status = 'late';
            }
        }
    }

    const totalLoanBalance = Math.max(0, totalAmount - creditTotal);

    return {
        scheduleStatus,
        totalPaid: creditTotal,
        totalLoanBalance,
        overflow: creditLeft,
    };
}

// ─── Main Recompute ────────────────────────────────────────

async function recompute() {
    console.log("═══════════════════════════════════════════════");
    console.log("  RECOMPUTE AMORTIZATION SCHEDULES (v3-TimezoneSafe)");
    console.log("═══════════════════════════════════════════════\n");

    const { data: loans, error: loanError } = await supabase
        .from('app_loans')
        .select('*')
        .in('status', ['active', 'defaulted', 'paid']);

    if (loanError) {
        console.error("FATAL: Error fetching loans:", loanError);
        return;
    }

    console.log(`Found ${loans.length} loans to recompute.\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const loan of loans) {
        const loanLabel = `${loan.loan_number || loan.id} (${loan.id.substring(0, 8)}...)`;

        try {
            if (!loan.release_date) {
                console.warn(`  ⚠ Skipping ${loanLabel}: No release_date`);
                continue;
            }

            const calc = generateSchedule(loan);
            const { data: payments, error: payError } = await supabase
                .from('app_payments')
                .select('*')
                .eq('loan_id', loan.id)
                .order('payment_date', { ascending: true });

            if (payError) {
                console.error(`  ✗ Error fetching payments for ${loanLabel}:`, payError.message);
                errorCount++;
                continue;
            }

            const result = distributePayments(calc.schedule, payments || [], calc.totalAmount);

            // Delete old schedules
            await supabase.from('app_payment_schedules').delete().eq('loan_id', loan.id);

            // Create new schedules
            const newSchedules = result.scheduleStatus.map(s => ({
                id: crypto.randomUUID(),
                loan_id: loan.id,
                due_date: s.dueDate.toISOString(),
                scheduled_amount: s.scheduledAmount,
                status: s.status,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }));

            if (newSchedules.length > 0) {
                await supabase.from('app_payment_schedules').insert(newSchedules);
            }

            // Parallel updates for payments
            if (payments && payments.length > 0) {
                let creditUsed = 0;
                let schedIdx = 0;
                const paymentUpdates = payments.map(payment => {
                    const targetSched = newSchedules[Math.min(schedIdx, newSchedules.length - 1)];
                    
                    let notes = payment.notes || '';
                    if (new Date(payment.payment_date) > new Date(targetSched.due_date)) {
                        if (!notes.includes('[LATE]')) notes = `[LATE] ${notes}`.trim();
                    }

                    const updatePromise = supabase.from('app_payments')
                        .update({ 
                            schedule_id: targetSched.id, 
                            notes: notes,
                            updated_at: new Date().toISOString() 
                        })
                        .eq('id', payment.id);

                    creditUsed += payment.amount;
                    while (schedIdx < newSchedules.length - 1 && creditUsed >= newSchedules[schedIdx].scheduled_amount) {
                        creditUsed -= newSchedules[schedIdx].scheduled_amount;
                        schedIdx++;
                    }
                    return updatePromise;
                });

                await Promise.all(paymentUpdates);
            }

            // Update loan record
            await supabase.from('app_loans').update({
                first_payment_date: calc.firstPaymentDate.toISOString(),
                maturity_date: calc.maturityDate.toISOString(),
                updated_at: new Date().toISOString(),
            }).eq('id', loan.id);

            process.stdout.write('.');
            successCount++;
        } catch (err) {
            console.error(`\n  ✗ Error for ${loanLabel}:`, err.message);
            errorCount++;
        }
    }

    console.log(`\n\nDONE: ${successCount} success, ${errorCount} errors`);
}

recompute();
