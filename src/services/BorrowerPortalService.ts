/**
 * BorrowerPortalService — Direct Supabase queries for the Borrower Portal.
 *
 * This service queries Supabase directly (no WatermelonDB sync) to ensure:
 *  - Borrowers can only see their own data (enforced by RLS + auth_id filtering)
 *  - No sensitive data is synced to borrower devices
 *  - Simple read-only access pattern
 */

import { supabase } from '../database/supabase';
import { EncryptionService } from './EncryptionService';
import { ErrorService } from "./ErrorService";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BorrowerProfile {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    phone: string;
    address: string;
    area: string;
    gender: string;
    business: string;
    coMakerName: string;
    dateOfBirth: string | null;
    group: string;
    collectorId: string;
    authId: string;
    createdAt: string;
}

export interface BorrowerLoan {
    id: string;
    loanNumber: string;
    principalAmount: number;
    interestRate: number;
    interestType: string;
    term: number;
    termUnit: string;
    frequency: string;
    totalAmount: number;
    installmentAmount: number;
    depositAmount: number;
    insuranceAmount: number;
    releaseDate: string;
    firstPaymentDate: string;
    maturityDate: string;
    status: string;
    isReloan: boolean;
    interestAmount: number;
    notes: string;
    createdAt: string;
}

export interface BorrowerPayment {
    id: string;
    loanId: string;
    amount: number;
    paymentDate: string;
    receiptNumber: string;
    notes: string;
    loanNumber?: string;
    createdAt: string;
}

export interface BorrowerPaymentSchedule {
    id: string;
    loanId: string;
    dueDate: string;
    scheduledAmount: number;
    principalAmount: number;
    interestAmount: number;
    feesAmount: number;
    status: string; // 'pending' | 'paid' | 'partial' | 'late'
}

export interface DashboardStats {
    totalOutstanding: number;
    totalPaidAllTime: number;
    activeLoansCount: number;
    nextPaymentAmount: number;
    nextPaymentDate: string | null;
    daysUntilNextPayment: number | null;
}

export interface LoanDetail extends BorrowerLoan {
    totalPaid: number;
    balance: number;
    progress: number; // 0-100
    payments: BorrowerPayment[];
    schedules: BorrowerPaymentSchedule[];
}

type RegisterBorrowerPayload = {
    email: string;
    password: string;
    fullName: string;
    phone: string;
};

type RegisterBorrowerResult = { success: boolean; message: string };

// ─── Supabase remote table names ────────────────────────────────────────────

const TABLES = {
    borrowers: 'app_borrowers',
    loans: 'app_loans',
    payments: 'app_payments',
    paymentSchedules: 'app_payment_schedules',
    userProfiles: 'user_profiles',
} as const;

const isHostedRegistrationFunctionEnabled = () => {
    const flag = process.env.EXPO_PUBLIC_REGISTER_BORROWER_FUNCTION_ENABLED?.trim().toLowerCase();
    if (flag === 'false' || flag === '0' || flag === 'off') return false;
    if (flag === 'true' || flag === '1' || flag === 'on') return true;

    const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    return /^https:\/\/[^/]+\.supabase\.co/i.test(url);
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapBorrower(row: any): BorrowerProfile {
    return {
        id: row.id,
        fullName: row.full_name || '',
        firstName: row.first_name || '',
        lastName: row.last_name || '',
        phone: EncryptionService.decrypt(row.phone) || row.phone || '',
        address: EncryptionService.decrypt(row.address) || row.address || '',
        area: row.area || '',
        gender: row.gender || '',
        business: row.business || '',
        coMakerName: row.co_maker_name || '',
        dateOfBirth: row.date_of_birth || null,
        group: row.group || '',
        collectorId: row.collector_id || '',
        authId: row.auth_id || '',
        createdAt: row.created_at || '',
    };
}

function mapLoan(row: any): BorrowerLoan {
    return {
        id: row.id,
        loanNumber: row.loan_number || '',
        principalAmount: row.principal_amount || 0,
        interestRate: row.interest_rate || 0,
        interestType: row.interest_type || '',
        term: row.term || 0,
        termUnit: row.term_unit || '',
        frequency: row.frequency || '',
        totalAmount: row.total_amount || 0,
        installmentAmount: row.installment_amount || 0,
        depositAmount: row.deposit_amount || 0,
        insuranceAmount: row.insurance_amount || 0,
        releaseDate: row.release_date || '',
        firstPaymentDate: row.first_payment_date || '',
        maturityDate: row.maturity_date || '',
        status: row.status || '',
        isReloan: row.is_reloan || false,
        interestAmount: row.interest_amount || 0,
        notes: row.notes || '',
        createdAt: row.created_at || '',
    };
}

function mapPayment(row: any): BorrowerPayment {
    return {
        id: row.id,
        loanId: row.loan_id || '',
        amount: row.amount || 0,
        paymentDate: row.payment_date || '',
        receiptNumber: row.receipt_number || '',
        notes: row.notes || '',
        loanNumber: row.loan_number,
        createdAt: row.created_at || '',
    };
}

function mapSchedule(row: any): BorrowerPaymentSchedule {
    return {
        id: row.id,
        loanId: row.loan_id || '',
        dueDate: row.due_date || '',
        scheduledAmount: row.scheduled_amount || 0,
        principalAmount: row.principal_amount || 0,
        interestAmount: row.interest_amount || 0,
        feesAmount: row.fees_amount || 0,
        status: row.status || 'pending',
    };
}

// ─── Service ────────────────────────────────────────────────────────────────

export class BorrowerPortalService {

    /**
     * Get the borrower profile linked to the currently authenticated user.
     */
    static async getBorrowerProfile(authId: string): Promise<BorrowerProfile | null> {
        // 1. Direct auth_id lookup
        const { data, error } = await supabase
            .from(TABLES.borrowers)
            .select('*')
            .eq('auth_id', authId)
            .is('deleted_at', null)
            .maybeSingle();

        if (error) {
            throw ErrorService.handleError(error, '[BorrowerPortalService] getBorrowerProfile error:');
        }

        if (data) {
            return mapBorrower(data);
        }

        // 2. Self-healing fallback: Resolve via user profile's full name if auth_id mismatch
        console.log(`[BorrowerPortalService] Borrower not found directly with authId ${authId}. Attempting name resolution fallback...`);
        try {
            const { data: profile, error: profileErr } = await supabase
                .from(TABLES.userProfiles)
                .select('full_name')
                .eq('id', authId)
                .is('deleted_at', null)
                .maybeSingle();

            if (profileErr || !profile || !profile.full_name) {
                console.warn('[BorrowerPortalService] Mismatch lookup: User profile not found or empty:', profileErr?.message);
                return null;
            }

            // Find borrower with exact matching name
            const { data: matchedBorrower, error: matchErr } = await supabase
                .from(TABLES.borrowers)
                .select('*')
                .eq('full_name', profile.full_name)
                .is('deleted_at', null)
                .maybeSingle();

            if (matchErr) {
                console.warn('[BorrowerPortalService] Mismatch lookup: Failed to query name match:', matchErr.message);
                return null;
            }

            if (matchedBorrower) {
                console.log(`[BorrowerPortalService] Found name match borrower: ${profile.full_name}. Linking authId ${authId}...`);
                
                // Heal the link on Supabase
                const { error: updateErr } = await supabase
                    .from(TABLES.borrowers)
                    .update({ auth_id: authId })
                    .eq('id', matchedBorrower.id);

                if (updateErr) {
                    console.warn('[BorrowerPortalService] Failed to auto-heal borrower authId link:', updateErr.message);
                } else {
                    console.log('[BorrowerPortalService] Auto-healed borrower authId link successfully.');
                    matchedBorrower.auth_id = authId;
                }

                return mapBorrower(matchedBorrower);
            }
        } catch (fallbackErr) {
            ErrorService.handleError(fallbackErr, '[BorrowerPortalService] Error in name fallback resolution:');
        }

        return null;
    }

    /**
     * Get all loans for a borrower, optionally filtered by status.
     */
    static async getLoans(borrowerId: string, statusFilter?: string): Promise<BorrowerLoan[]> {
        let query = supabase
            .from(TABLES.loans)
            .select('*')
            .eq('borrower_id', borrowerId)
            .is('deleted_at', null)
            .order('release_date', { ascending: false });

        if (statusFilter && statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;

        if (error) {
            throw ErrorService.handleError(error, '[BorrowerPortalService] getLoans error:');
        }

        return (data || []).map(mapLoan);
    }

    /**
     * Get full loan detail with payments and schedules.
     */
    static async getLoanDetail(loanId: string, borrowerId: string): Promise<LoanDetail | null> {
        // Fetch loan (verify it belongs to this borrower)
        const { data: loanData, error: loanError } = await supabase
            .from(TABLES.loans)
            .select('*')
            .eq('id', loanId)
            .eq('borrower_id', borrowerId)
            .is('deleted_at', null)
            .maybeSingle();

        if (loanError) {
            throw ErrorService.handleError(loanError, '[BorrowerPortalService] getLoanDetail loan error:');
        }

        if (!loanData) return null;

        // Fetch payments
        const { data: paymentsData, error: paymentsError } = await supabase
            .from(TABLES.payments)
            .select('*')
            .eq('loan_id', loanId)
            .is('deleted_at', null)
            .order('payment_date', { ascending: false });

        if (paymentsError) {
            throw ErrorService.handleError(paymentsError, '[BorrowerPortalService] getLoanDetail payments error:');
        }

        // Fetch schedules
        const { data: schedulesData, error: schedulesError } = await supabase
            .from(TABLES.paymentSchedules)
            .select('*')
            .eq('loan_id', loanId)
            .is('deleted_at', null)
            .order('due_date', { ascending: true });

        if (schedulesError) {
            throw ErrorService.handleError(schedulesError, '[BorrowerPortalService] getLoanDetail schedules error:');
        }

        const loan = mapLoan(loanData);
        const payments = (paymentsData || []).map(mapPayment);
        const schedules = (schedulesData || []).map(mapSchedule);

        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        const balance = Math.max(0, loan.totalAmount - totalPaid);
        const progress = loan.totalAmount > 0 ? Math.min(100, (totalPaid / loan.totalAmount) * 100) : 0;

        return {
            ...loan,
            totalPaid,
            balance,
            progress,
            payments,
            schedules,
        };
    }

    /**
     * Get all payments for a borrower across all their loans.
     */
    static async getPayments(borrowerId: string, loanIdFilter?: string): Promise<BorrowerPayment[]> {
        // First get all loan IDs for this borrower
        const { data: loans, error: loansError } = await supabase
            .from(TABLES.loans)
            .select('id, loan_number')
            .eq('borrower_id', borrowerId)
            .is('deleted_at', null);

        if (loansError) {
            throw ErrorService.handleError(loansError, '[BorrowerPortalService] getPayments loans error:');
        }

        if (!loans || loans.length === 0) return [];

        const loanMap = new Map(loans.map((l: any) => [l.id, l.loan_number]));
        const loanIds = loanIdFilter ? [loanIdFilter] : Array.from(loanMap.keys());

        const { data: paymentsData, error: paymentsError } = await supabase
            .from(TABLES.payments)
            .select('*')
            .in('loan_id', loanIds)
            .is('deleted_at', null)
            .order('payment_date', { ascending: false });

        if (paymentsError) {
            throw ErrorService.handleError(paymentsError, '[BorrowerPortalService] getPayments error:');
        }

        return (paymentsData || []).map((row: any) => ({
            ...mapPayment(row),
            loanNumber: loanMap.get(row.loan_id) || '',
        }));
    }

    /**
     * Get payment schedules for a specific loan.
     */
    static async getPaymentSchedules(loanId: string): Promise<BorrowerPaymentSchedule[]> {
        const { data, error } = await supabase
            .from(TABLES.paymentSchedules)
            .select('*')
            .eq('loan_id', loanId)
            .is('deleted_at', null)
            .order('due_date', { ascending: true });

        if (error) {
            throw ErrorService.handleError(error, '[BorrowerPortalService] getPaymentSchedules error:');
        }

        return (data || []).map(mapSchedule);
    }

    /**
     * Dashboard stats for a borrower.
     */
    static async getDashboardStats(borrowerId: string): Promise<DashboardStats> {
        // Fetch active loans
        const { data: activeLoans, error: loansError } = await supabase
            .from(TABLES.loans)
            .select('id, total_amount, installment_amount, status')
            .eq('borrower_id', borrowerId)
            .in('status', ['active', 'defaulted'])
            .is('deleted_at', null);

        if (loansError) {
            throw ErrorService.handleError(loansError, '[BorrowerPortalService] getDashboardStats loans error:');
        }

        if (!activeLoans || activeLoans.length === 0) {
            return {
                totalOutstanding: 0,
                totalPaidAllTime: 0,
                activeLoansCount: 0,
                nextPaymentAmount: 0,
                nextPaymentDate: null,
                daysUntilNextPayment: null,
            };
        }

        const loanIds = activeLoans.map((l: any) => l.id);

        // Fetch payments for active loans
        const { data: payments, error: pError } = await supabase
            .from(TABLES.payments)
            .select('loan_id, amount')
            .in('loan_id', loanIds)
            .is('deleted_at', null);

        if (pError) {
            throw ErrorService.handleError(pError, '[BorrowerPortalService] getDashboardStats payments error:');
        }

        // Calculate total paid per loan
        const paidByLoan = new Map<string, number>();
        (payments || []).forEach((p: any) => {
            paidByLoan.set(p.loan_id, (paidByLoan.get(p.loan_id) || 0) + p.amount);
        });

        let totalOutstanding = 0;
        for (const loan of activeLoans) {
            const paid = paidByLoan.get(loan.id) || 0;
            totalOutstanding += Math.max(0, loan.total_amount - paid);
        }

        // Fetch all-time payments for total summary
        const { data: allLoans } = await supabase
            .from(TABLES.loans)
            .select('id')
            .eq('borrower_id', borrowerId)
            .is('deleted_at', null);

        let totalPaidAllTime = 0;
        if (allLoans && allLoans.length > 0) {
            const allLoanIds = allLoans.map((l: any) => l.id);
            const { data: allPayments } = await supabase
                .from(TABLES.payments)
                .select('amount')
                .in('loan_id', allLoanIds)
                .is('deleted_at', null);

            totalPaidAllTime = (allPayments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
        }

        // Find next upcoming payment schedule
        const now = new Date().toISOString();
        const { data: nextSchedule } = await supabase
            .from(TABLES.paymentSchedules)
            .select('due_date, scheduled_amount')
            .in('loan_id', loanIds)
            .in('status', ['pending', 'partial'])
            .is('deleted_at', null)
            .gte('due_date', now)
            .order('due_date', { ascending: true })
            .limit(1);

        let nextPaymentAmount = activeLoans[0]?.installment_amount || 0;
        let nextPaymentDate: string | null = null;
        let daysUntilNextPayment: number | null = null;

        if (nextSchedule && nextSchedule.length > 0) {
            nextPaymentAmount = nextSchedule[0].scheduled_amount;
            nextPaymentDate = nextSchedule[0].due_date;
            const dueDate = new Date(nextPaymentDate!);
            const today = new Date();
            daysUntilNextPayment = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
            totalOutstanding,
            totalPaidAllTime,
            activeLoansCount: activeLoans.length,
            nextPaymentAmount,
            nextPaymentDate,
            daysUntilNextPayment,
        };
    }

    /**
     * Register a new borrower account (self-registration).
     * Creates a Supabase auth user and a disabled user_profiles record with role
     * 'borrower'. Admins activate the profile after verifying/linking it.
     */
    static async registerBorrower(
        email: string,
        password: string,
        fullName: string,
        phone: string
    ): Promise<RegisterBorrowerResult> {
        try {
            const payload: RegisterBorrowerPayload = {
                email: email.trim().toLowerCase(),
                password: password.trim(),
                fullName: fullName.trim(),
                phone: phone.trim(),
            };

            const serverRegistration = isHostedRegistrationFunctionEnabled()
                ? await this.tryServerSideBorrowerRegistration(payload)
                : null;
            if (serverRegistration) {
                return serverRegistration;
            }

            // 1. Create Supabase auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: payload.email,
                password: payload.password,
                options: {
                    data: {
                        full_name: payload.fullName,
                        role: 'borrower',
                    },
                },
            });

            if (authError) {
                ErrorService.handleError(authError, '[BorrowerPortalService] Registration auth error:');
                const message = authError.message?.toLowerCase().includes('rate limit')
                    ? 'Registration is temporarily rate-limited by Supabase. Ask an administrator to turn off email confirmations for this project, then try again later.'
                    : authError.message;
                return { success: false, message };
            }

            if (!authData.user) {
                return { success: false, message: 'Failed to create user account.' };
            }

            // 2. Create user_profiles record
            const { error: profileError } = await supabase
                .from(TABLES.userProfiles)
                .upsert({
                    id: authData.user.id,
                    full_name: payload.fullName,
                    email: payload.email,
                    role: 'borrower',
                    is_active: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });

            if (profileError) {
                ErrorService.handleError(profileError, '[BorrowerPortalService] Profile creation error:');
                // Auth user was created but profile failed — return partial success
                return {
                    success: true,
                    message: 'Account created but profile setup had an issue. Please contact support.',
                };
            }

            return {
                success: true,
                message: 'Registration submitted successfully. Please wait for an administrator to verify and approve your account.',
            };
        } catch (error: any) {
            ErrorService.handleError(error, '[BorrowerPortalService] registerBorrower error:');
            return { success: false, message: ErrorService.getUserMessage(error) || 'Registration failed.' };
        }
    }

    /**
     * Prefer the Edge Function registration path when deployed.
     *
     * Hosted Supabase projects using the built-in Auth email sender can hit a
     * low email quota during signup confirmation. The Edge Function creates the
     * Auth user with the service role and auto-confirms the email, so borrower
     * self-registration does not send a signup email or consume that quota.
     *
     * Optional Edge Function path. The default registration path is simple
     * client-side auth.signUp; only enable this when the function is deployed.
     */
    private static async tryServerSideBorrowerRegistration(
        payload: RegisterBorrowerPayload
    ): Promise<RegisterBorrowerResult | null> {
        const functions = (supabase as any).functions;
        if (!functions?.invoke) return null;

        try {
            const { data, error } = await functions.invoke('register-borrower', {
                body: payload,
            });

            if (error) {
                console.warn('[BorrowerPortalService] Server-side registration unavailable; falling back to auth.signUp:', error.message || error);
                return null;
            }

            if (data && typeof data.success === 'boolean' && typeof data.message === 'string') {
                return data;
            }
        } catch (error: any) {
            console.warn('[BorrowerPortalService] Server-side registration failed before response; falling back to auth.signUp:', error?.message || error);
        }

        return null;
    }
}
