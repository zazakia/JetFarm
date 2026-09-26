import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, SafeAreaView, StatusBar, Alert, Modal, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { database } from '../../src/database';
import { Q } from '@nozbe/watermelondb';
import Loan from '../../src/database/models/Loan';
import Payment from '../../src/database/models/Payment';
import PaymentSchedule from '../../src/database/models/PaymentSchedule';
import Borrower from '../../src/database/models/Borrower';
import LoanPenalty from '../../src/database/models/LoanPenalty';
import BankAccount from '../../src/database/models/BankAccount';
import BankTransaction from '../../src/database/models/BankTransaction';
import { CashService } from '../../src/services/CashService';
import { KpiCalculator } from '../../src/services/KpiCalculator';
import { SyncService } from '../../src/services/SyncService';
import { useSyncStore } from '../../src/stores/syncStore';
import { SyncStatusIndicator } from '../../src/components/SyncStatusIndicator';
import { PhpCurrencyText } from '../../src/components/PhpCurrencyText';
import { MaterialIcons } from '@expo/vector-icons';
import { MetricBreakdownDialog, BreakdownItem } from '../../src/components/MetricBreakdownDialog';
import { LinearGradient } from 'expo-linear-gradient';
import { differenceInDays, format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { AuthService } from '../../src/services/AuthService';
import { formatPHP } from '../../src/utils/currency';
import { isLoanActive, isLoanPaid } from '../../src/utils/activeLoanPolicy';
import { useAuth } from '../../src/store/AuthContext';
import { LendingPerformanceChart } from '../../src/components/LendingPerformanceChart';
import { ReminderService, ReminderType } from '../../src/services/ReminderService';
import * as Linking from 'expo-linking';
import { SidebarContent } from '../../src/components/SidebarContent';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { MetricInfoDialog } from '../../src/components/MetricInfoDialog';
import { MemberFinancialSummaryService, LoanTypeSummary } from '../../src/services/MemberFinancialSummaryService';
import { useFeatureFlags } from '../../src/hooks/useSettingsConfig';

const METRIC_INFO: Record<string, { description: string; formula: string }> = {
    'Active Loans': {
        description: 'The number of loan accounts currently in repayment or defaulted status (excluding paid-off or cancelled loans).',
        formula: 'Count(Loans where status = "active" OR "defaulted")'
    },
    'Weekly Target': {
        description: 'The total amount scheduled for collection during the current week across all active loans.',
        formula: 'Sum(Active Loans.installmentAmount)'
    },
    'Outstanding': {
        description: 'The total remaining balance of all active and defaulted loans, including any unpaid penalties.',
        formula: 'Sum(Loan.totalAmount + Penalties - PaymentsReceived)'
    },
    'Total Disbursed': {
        description: 'The total principal amount released to borrowers since the system start (excluding cancelled loans).',
        formula: 'Sum(Principal where status IN ["active", "paid", "defaulted"])'
    },
    'Overdue (PAR>30)': {
        description: 'Portfolio at Risk (PAR) for accounts with at least one payment overdue by more than 30 days.',
        formula: 'Sum(Principal of Loans with >30 days overdue) / Total GLP'
    },
    'Collected Today': {
        description: 'Total cash received from loan repayments and fees during the current calendar day.',
        formula: 'Sum(Payment.amount where date = Today)'
    },
    'This Month': {
        description: 'Total cash received from payments during the current calendar month.',
        formula: 'Sum(Payment.amount where date in CurrentMonth)'
    },
    'Cash on Hand': {
        description: 'The total net cash currently available in the vault (Total Receipts minus Total Expenses/Disbursements).',
        formula: 'Current System Balance (CashBox)'
    },
    'Cash on Bank': {
        description: 'The combined current balances across all registered bank accounts.',
        formula: 'Sum(BankAccount.startingBalance + deposits - withdrawals)'
    },
    'Petty Cash': {
        description: 'The total cash available in the petty cash fund for minor operational expenses.',
        formula: 'Sum(Petty Cash transactions: starting_balance + in - out)'
    },
    'Members': {
        description: 'Total count of unique individuals registered as members in the database.',
        formula: 'Count(All Members)'
    },
    'Daily Portfolio': {
        description: 'Aggregated metrics for loans with a daily repayment frequency.',
        formula: 'Metrics where frequency = "daily"'
    },
    'Weekly Portfolio': {
        description: 'Aggregated metrics for loans with a weekly repayment frequency.',
        formula: 'Metrics where frequency = "weekly"'
    },
    'Savings Balance': {
        description: 'Total member savings balance after deposits, withdrawals, and credited interest.',
        formula: 'Sum(Savings deposits + interest - withdrawals)'
    },
    'CBU Total': {
        description: 'Total Capital Build-Up / share capital balance across members.',
        formula: 'Sum(Share capital contributions - reversals/withdrawals)'
    }
};


interface KpiCard {
    title: string;
    value: number;
    isCurrency: boolean;
    icon: keyof typeof MaterialIcons.glyphMap | (string & {});
    iconBg: string;
    iconColor: string;
    onPress?: () => void;
    onInfoPress?: () => void;
}

type OverdueWatchlistItem = {
    scheduleId: string;
    loanId: string;
    borrowerId?: string;
    borrowerName: string;
    dueDate: Date | number;
    amountDue: number;
    overdueDays: number;
    loanBalance: number;
    phoneNumber?: string;
};

type AgingBucket = {
    label: string;
    min: number;
    max: number;
    amount: number;
    count: number;
    color: string;
};

const UNPAID_SCHEDULE_STATUSES = ['pending', 'partial', 'late'];

function groupByLoanId<T extends { loanId: string }>(records: T[]) {
    const grouped = new Map<string, T[]>();
    records.forEach(record => {
        const group = grouped.get(record.loanId);
        if (group) {
            group.push(record);
        } else {
            grouped.set(record.loanId, [record]);
        }
    });
    return grouped;
}

function getScheduleBalances(
    schedules: PaymentSchedule[],
    payments: Payment[],
    penalties: LoanPenalty[],
    now: Date
) {
    const sortedSchedules = [...schedules].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const penaltyTotal = penalties.reduce((sum, penalty) => sum + penalty.amount, 0);
    let remainingPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

    const balances = sortedSchedules.map(schedule => {
        const amount = schedule.scheduledAmount || 0;
        const paid = Math.min(remainingPaid, amount);
        remainingPaid -= paid;

        return {
            schedule,
            balance: Math.max(0, amount - paid),
            daysOverdue: differenceInDays(now, new Date(schedule.dueDate)),
        };
    });

    const remainingPenalty = Math.max(0, penaltyTotal - remainingPaid);
    if (remainingPenalty > 0) {
        const overdueBalances = balances.filter(balance => balance.daysOverdue > 0);
        const maxOverdue = overdueBalances.length > 0
            ? Math.max(...overdueBalances.map(balance => balance.daysOverdue))
            : 0;

        balances.push({
            schedule: { id: 'penalty', dueDate: now } as PaymentSchedule,
            balance: remainingPenalty,
            daysOverdue: maxOverdue,
        });
    }

    return balances;
}

function buildOverdueWatchlist(
    schedules: PaymentSchedule[],
    loansById: Map<string, Loan>,
    borrowersById: Map<string, Borrower>,
    paymentsByLoanId: Map<string, Payment[]>,
    penaltiesByLoanId: Map<string, LoanPenalty[]>,
    now: Date
): OverdueWatchlistItem[] {
    return schedules
        .filter(schedule => (
            UNPAID_SCHEDULE_STATUSES.includes(schedule.status)
            && new Date(schedule.dueDate).getTime() < now.getTime()
        ))
        .map(schedule => {
            const loan = loansById.get(schedule.loanId);
            const borrower = loan ? borrowersById.get(loan.borrowerId) : undefined;
            const loanPayments = paymentsByLoanId.get(schedule.loanId) ?? [];
            const loanPenalties = penaltiesByLoanId.get(schedule.loanId) ?? [];
            const paid = loanPayments.reduce((sum, payment) => sum + payment.amount, 0);
            const penaltyTotal = loanPenalties.reduce((sum, penalty) => sum + penalty.amount, 0);

            return {
                scheduleId: schedule.id,
                loanId: schedule.loanId,
                borrowerId: borrower?.id,
                borrowerName: borrower?.fullName || 'Unknown',
                dueDate: schedule.dueDate,
                amountDue: schedule.scheduledAmount,
                overdueDays: differenceInDays(now, new Date(schedule.dueDate)),
                loanBalance: Math.max(0, (loan?.totalAmount || 0) + penaltyTotal - paid),
                phoneNumber: borrower?.decryptedPhone,
            };
        })
        .sort((a, b) => b.overdueDays - a.overdueDays)
        .slice(0, 10);
}

function buildAgingBuckets(
    activeLoans: Loan[],
    schedulesByLoanId: Map<string, PaymentSchedule[]>,
    paymentsByLoanId: Map<string, Payment[]>,
    penaltiesByLoanId: Map<string, LoanPenalty[]>,
    now: Date
): AgingBucket[] {
    const buckets: AgingBucket[] = [
        { label: '1-7 Days', min: 1, max: 7, amount: 0, count: 0, color: '#3B82F6' },
        { label: '8-30 Days', min: 8, max: 30, amount: 0, count: 0, color: '#F59E0B' },
        { label: '31-60 Days', min: 31, max: 60, amount: 0, count: 0, color: '#EF4444' },
        { label: '61+ Days', min: 61, max: 9999, amount: 0, count: 0, color: '#991B1B' },
    ];

    activeLoans.forEach(loan => {
        const balances = getScheduleBalances(
            schedulesByLoanId.get(loan.id) ?? [],
            paymentsByLoanId.get(loan.id) ?? [],
            penaltiesByLoanId.get(loan.id) ?? [],
            now
        );
        const loanBuckets = new Set<AgingBucket>();

        balances.forEach(balance => {
            if (balance.balance <= 0) return;
            const bucket = buckets.find(candidate => balance.daysOverdue >= candidate.min && balance.daysOverdue <= candidate.max);
            if (!bucket) return;

            bucket.amount += balance.balance;
            loanBuckets.add(bucket);
        });

        loanBuckets.forEach(bucket => bucket.count++);
    });

    return buckets;
}

function KpiTile({ title, value, isCurrency, icon, iconBg, iconColor, onPress, onInfoPress }: KpiCard) {
    const C = onPress ? AnimatedPressable : View;
    return (
        <C
            className={`w-[48%] sm:w-[31%] lg:w-[23.5%] bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100 mb-4 flex-col justify-between ${onPress ? 'active:bg-gray-50' : ''}`}
            onPress={onPress}
            style={{ minWidth: 140 }}
        >
            <View className="flex-row justify-between items-center mb-3">
                <View className={`w-10 h-10 rounded-2xl items-center justify-center ${iconBg}`}>
                    <MaterialIcons name={icon as any} size={20} color={iconColor} />
                </View>
                {onInfoPress && (
                    <Pressable 
                        onPress={onInfoPress}
                        className="p-1.5 rounded-full bg-slate-50 active:bg-slate-200"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <MaterialIcons name="info-outline" size={16} color="#9CA3AF" />
                    </Pressable>
                )}
            </View>
            <View className="flex-1 justify-end">
                <Text className="text-gray-500 text-[11px] font-bold uppercase tracking-wider mb-1" numberOfLines={1}>
                    {title}
                </Text>
                {isCurrency ? (
                    <PhpCurrencyText 
                        amount={value} 
                        className="text-lg sm:text-xl font-black text-gray-900 leading-tight" 
                        numberOfLines={1} 
                        adjustsFontSizeToFit 
                    />
                ) : (
                    <Text 
                        className="text-xl sm:text-2xl font-black text-gray-900 leading-tight" 
                        numberOfLines={1} 
                        adjustsFontSizeToFit
                    >
                        {value}
                    </Text>
                )}
            </View>
        </C>
    );
}

function QuickActionBtn({ icon, label, onPress, bg, fg }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; onPress: () => void; bg: string; fg: string }) {
    const isWhiteTile = bg === 'bg-white';
    const labelColor = isWhiteTile ? '#0F172A' : '#FFFFFF';

    return (
        <AnimatedPressable 
            onPress={onPress} 
            className="items-center mr-3 w-[78px] active:opacity-80"
        >
            <View 
                className={`w-[74px] h-[58px] items-center justify-center rounded-2xl px-1.5 py-1.5 shadow-lg ${isWhiteTile ? 'bg-white' : bg}`}
                style={{
                    ...Platform.select({
                        web: {
                            boxShadow: '0 4px 8px 0 rgba(0, 0, 0, 0.1)',
                        },
                        default: {
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.1,
                            shadowRadius: 8,
                            elevation: 5,
                        },
                    }),
                }}
            >
                <MaterialIcons name={icon} size={19} color={fg} />
                <Text 
                    className="font-black text-[8px] text-center uppercase leading-[9px] mt-1"
                    style={{ color: labelColor }}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                >
                    {label}
                </Text>
            </View>
        </AnimatedPressable>
    );
}

export default function AdminDashboardScreen() {
    const router = useRouter();
    const { user, role, signOut, branchId } = useAuth();
    const { status, progress } = useSyncStore();
    const { isEnabled } = useFeatureFlags();
    const isLendingEnabled = isEnabled('system.lending');

    const [refreshing, setRefreshing] = useState(false);
    const [kpis, setKpis] = useState({
        activeLoansCount: 0, totalDisbursed: 0, collectedToday: 0,
        collectedMonth: 0, outstandingBalance: 0, overdueValue: 0,
        cashOnHand: 0, cashOnBank: 0, pettyCash: 0, totalBorrowers: 0, weeklyTarget: 0,
        dailyActiveLoansCount: 0, weeklyActiveLoansCount: 0,
        dailyTotalDisbursed: 0, weeklyTotalDisbursed: 0,
        totalSavingsBalance: 0, totalCbuBalance: 0,
        yearSavingsDeposits: 0, yearCbuContributions: 0,
    });
    const [recentPayments, setRecentPayments] = useState<any[]>([]);
    const [overdueWatchlist, setOverdueWatchlist] = useState<any[]>([]);
    const [performanceData, setPerformanceData] = useState<{ label: string; value: number }[]>([]);
    const [agingBuckets, setAgingBuckets] = useState<any[]>([]);
    const [loanTypeSummaries, setLoanTypeSummaries] = useState<LoanTypeSummary[]>([]);

    const [dialogVisible, setDialogVisible] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [dialogData, setDialogData] = useState<{ title: string; total: number; isTotalCurrency: boolean; color: string; items: BreakdownItem[] }>({
        title: '', total: 0, isTotalCurrency: true, color: 'text-gray-900', items: []
    });

    const [infoVisible, setInfoVisible] = useState(false);
    const [infoData, setInfoData] = useState<{ title: string; value: number | string; isCurrency: boolean }>({
        title: '', value: 0, isCurrency: true
    });

    const overdueCount = overdueWatchlist.length;


    const loadData = async () => {
        try {
            const [loans, borrowers, cashOnHand, pettyCash, bankAccounts, bankTxns, portfolioSummary, loanTypeSummary] = await Promise.all([
                database.collections.get<Loan>('loans').query(Q.where('deleted_at', null)).fetch(),
                database.collections.get<Borrower>('borrowers').query(Q.where('deleted_at', null)).fetch(),
                CashService.getCurrentBalance(),
                CashService.getPettyCashBalance(),
                database.collections.get<BankAccount>('bank_accounts').query(Q.where('deleted_at', null)).fetch(),
                database.collections.get<BankTransaction>('bank_transactions').query(Q.where('deleted_at', null)).fetch(),
                MemberFinancialSummaryService.getPortfolioSummary(2025),
                MemberFinancialSummaryService.getLoanTypeSummary(),
            ]);

            const activeLoans = loans.filter(l => isLoanActive(l.status));
            const activeLoanIds = activeLoans.map(loan => loan.id);

            const [payments, schedules, penalties] = await Promise.all([
                database.collections.get<Payment>('payments').query(Q.where('deleted_at', null)).fetch(),
                activeLoanIds.length > 0
                    ? database.collections.get<PaymentSchedule>('payment_schedules').query(
                        Q.where('deleted_at', null),
                        Q.where('loan_id', Q.oneOf(activeLoanIds))
                    ).fetch()
                    : Promise.resolve([]),
                activeLoanIds.length > 0
                    ? database.collections.get<LoanPenalty>('loan_penalties').query(
                        Q.where('deleted_at', null),
                        Q.where('loan_id', Q.oneOf(activeLoanIds))
                    ).fetch()
                    : Promise.resolve([]),
            ]);

            const loansById = new Map(loans.map(loan => [loan.id, loan]));
            const borrowersById = new Map(borrowers.map(borrower => [borrower.id, borrower]));
            const paymentsByLoanId = groupByLoanId(payments);
            const schedulesByLoanId = groupByLoanId(schedules);
            const penaltiesByLoanId = groupByLoanId(penalties);

            const totalDisbursed = loans
                .filter(l => isLoanActive(l.status) || isLoanPaid(l.status))
                .reduce((sum, l) => sum + l.principalAmount, 0);

            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
            const endOfDay = startOfDay + 86400000;
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
            const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1).getTime();

            const collectedToday = payments
                .filter(payment => payment.paymentDate >= startOfDay && payment.paymentDate < endOfDay)
                .reduce((sum, payment) => sum + payment.amount, 0);

            const collectedMonth = payments
                .filter(payment => payment.paymentDate >= startOfMonth && payment.paymentDate < startOfNextMonth)
                .reduce((sum, payment) => sum + payment.amount, 0);

            const outstandingBalance = KpiCalculator.computeOutstandingBalance(activeLoans, payments, penalties);
            const { par, glp } = KpiCalculator.computePAR(loans, schedules, payments, 30);
            const overdueValue = (par / 100) * glp;

            const weeklyTarget = activeLoans.reduce((sum, l) => sum + l.installmentAmount, 0);

            const dailyActiveLoans = activeLoans.filter(l => l.frequency === 'daily');
            const weeklyActiveLoans = activeLoans.filter(l => l.frequency === 'weekly');

            const dailyClientsCount = new Set(dailyActiveLoans.map(l => l.borrowerId)).size;
            const weeklyClientsCount = new Set(weeklyActiveLoans.map(l => l.borrowerId)).size;

            const dailyTotalDisbursed = loans
                .filter(l => l.frequency === 'daily' && (isLoanActive(l.status) || isLoanPaid(l.status)))
                .reduce((sum, l) => sum + l.principalAmount, 0);

            const weeklyTotalDisbursed = loans
                .filter(l => l.frequency === 'weekly' && (isLoanActive(l.status) || isLoanPaid(l.status)))
                .reduce((sum, l) => sum + l.principalAmount, 0);

            let cashOnBank = 0;
            bankAccounts.forEach(acc => {
                const accTxns = bankTxns.filter(tx => tx.bankAccountId === acc.id);
                const currentBalance = acc.startingBalance + accTxns.reduce((sum, tx) => {
                    return tx.type === 'deposit' ? sum + tx.amount : sum - tx.amount;
                }, 0);
                cashOnBank += currentBalance;
            });

            setKpis({
                activeLoansCount: activeLoans.length,
                totalDisbursed, collectedToday, collectedMonth,
                outstandingBalance, overdueValue, cashOnHand,
                pettyCash, cashOnBank,
                totalBorrowers: borrowers.length,
                weeklyTarget,
                dailyActiveLoansCount: dailyClientsCount,
                weeklyActiveLoansCount: weeklyClientsCount,
                dailyTotalDisbursed,
                weeklyTotalDisbursed,
                totalSavingsBalance: portfolioSummary.totalSavingsBalance,
                totalCbuBalance: portfolioSummary.totalCbuBalance,
                yearSavingsDeposits: portfolioSummary.yearSavingsDeposits,
                yearCbuContributions: portfolioSummary.yearCbuContributions,
            });
            setLoanTypeSummaries(loanTypeSummary.slice(0, 5));

            // Calculate Performance Data (Collection vs Days of Week)
            const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
            const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
            const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

            const chartData = daysInWeek.map(day => {
                const dayPayments = payments.filter(p => isSameDay(new Date(p.paymentDate), day));
                return {
                    label: format(day, 'EEE'),
                    value: dayPayments.reduce((sum, p) => sum + p.amount, 0),
                };
            });
            setPerformanceData(chartData);

            setOverdueWatchlist(buildOverdueWatchlist(
                schedules,
                loansById,
                borrowersById,
                paymentsByLoanId,
                penaltiesByLoanId,
                today
            ));
            setAgingBuckets(buildAgingBuckets(
                activeLoans,
                schedulesByLoanId,
                paymentsByLoanId,
                penaltiesByLoanId,
                today
            ));

            const sorted = [...payments].sort((a, b) => b.paymentDate - a.paymentDate).slice(0, 8);
            setRecentPayments(sorted.map(p => {
                const loan = loansById.get(p.loanId);
                const borrower = loan ? borrowersById.get(loan.borrowerId) : undefined;
                return {
                    id: p.id, amount: p.amount,
                    date: new Date(p.paymentDate),
                    borrowerName: borrower?.fullName ?? 'Unknown',
                    loanNumber: loan?.loanNumber ?? '—',
                    borrowerId: borrower?.id,
                };
            }));
        } catch (e) {
            console.error('Failed to load admin data:', e);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, [status]));

    const onRefresh = async () => {
        setRefreshing(true);
        if (status !== 'syncing') await SyncService.sync(true); // Forced on manual refresh
        await loadData();
        setRefreshing(false);
    };

    const handleActiveLoansClick = async () => {
        const loans = await database.collections.get<Loan>('loans').query(Q.where('deleted_at', null)).fetch();
        const activeLoans = loans.filter(l => isLoanActive(l.status));
        const borrowers = await database.collections.get<Borrower>('borrowers').query(Q.where('deleted_at', null)).fetch();
        setDialogData({
            title: 'Active Loans', total: activeLoans.length, isTotalCurrency: false, color: 'text-blue-600',
            items: activeLoans.map(l => ({
                id: l.id,
                label: borrowers.find(b => b.id === l.borrowerId)?.fullName ?? 'Unknown',
                sublabel: `Loan #${l.loanNumber || l.id.slice(0, 8)}`,
                value: l.principalAmount,
                isCurrency: true,
                onPress: () => {
                    setDialogVisible(false);
                    if (l.borrowerId) router.push(`/(admin)/borrowers/${l.borrowerId}`);
                }
            })),
        });
        setDialogVisible(true);
    };

    const handleOutstandingClick = async () => {
        const loans = await database.collections.get<Loan>('loans').query(Q.where('deleted_at', null)).fetch();
        const activeLoans = loans.filter(l => isLoanActive(l.status));
        const borrowers = await database.collections.get<Borrower>('borrowers').query(Q.where('deleted_at', null)).fetch();
        const payments = await database.collections.get<Payment>('payments').query(Q.where('deleted_at', null)).fetch();

        const items = activeLoans.map(l => {
            const borrower = borrowers.find(b => b.id === l.borrowerId);
            const loanPayments = payments.filter(p => p.loanId === l.id).reduce((s, p) => s + (p.amount || 0), 0);
            const totalLoanCost = l.totalAmount || (l.principalAmount + (l.interestAmount || 0));
            const remaining = Math.max(0, totalLoanCost - loanPayments);
            return {
                id: l.id,
                label: borrower?.fullName ?? 'Unknown Borrower',
                sublabel: `Loan #${l.loanNumber || l.id.slice(0, 8)} • ${(l.status || '').toUpperCase()}`,
                value: remaining,
                isCurrency: true,
                onPress: () => {
                    setDialogVisible(false);
                    if (l.borrowerId) router.push(`/(admin)/borrowers/${l.borrowerId}`);
                }
            };
        }).filter(item => item.value > 0);

        setDialogData({
            title: 'Outstanding Loan Balances',
            total: kpis.outstandingBalance,
            isTotalCurrency: true,
            color: 'text-emerald-600',
            items,
        });
        setDialogVisible(true);
    };

    const handleTotalDisbursedClick = async () => {
        const loans = await database.collections.get<Loan>('loans').query(Q.where('deleted_at', null)).fetch();
        const disbursedLoans = loans.filter(l => isLoanActive(l.status) || isLoanPaid(l.status));
        const borrowers = await database.collections.get<Borrower>('borrowers').query(Q.where('deleted_at', null)).fetch();

        const items = disbursedLoans.map(l => ({
            id: l.id,
            label: borrowers.find(b => b.id === l.borrowerId)?.fullName ?? 'Unknown Borrower',
            sublabel: `Released: ${l.releaseDate ? format(new Date(l.releaseDate), 'MMM d, yyyy') : 'N/A'} • Loan #${l.loanNumber || l.id.slice(0, 8)}`,
            value: l.principalAmount,
            isCurrency: true,
            onPress: () => {
                setDialogVisible(false);
                if (l.borrowerId) router.push(`/(admin)/borrowers/${l.borrowerId}`);
            }
        }));

        setDialogData({
            title: 'Disbursed Principal Loans',
            total: kpis.totalDisbursed,
            isTotalCurrency: true,
            color: 'text-purple-600',
            items,
        });
        setDialogVisible(true);
    };

    const handleOverdueClick = async () => {
        const loans = await database.collections.get<Loan>('loans').query(Q.where('deleted_at', null)).fetch();
        const activeLoans = loans.filter(l => isLoanActive(l.status));
        const borrowers = await database.collections.get<Borrower>('borrowers').query(Q.where('deleted_at', null)).fetch();
        const schedules = await database.collections.get<PaymentSchedule>('payment_schedules').query(Q.where('deleted_at', null), Q.where('status', Q.notEq('paid'))).fetch();

        const now = Date.now();
        const overdueLoansMap = new Map<string, { loan: Loan; overdueAmount: number; maxOverdueDays: number }>();

        for (const s of schedules) {
            const dueMs = typeof s.dueDate === 'number' ? s.dueDate : new Date(s.dueDate).getTime();
            if (dueMs < now) {
                const days = differenceInDays(now, dueMs);
                if (days > 30) {
                    const l = activeLoans.find(item => item.id === s.loanId);
                    if (l) {
                        const existing = overdueLoansMap.get(l.id) || { loan: l, overdueAmount: 0, maxOverdueDays: 0 };
                        existing.overdueAmount += (s.scheduledAmount || 0);
                        existing.maxOverdueDays = Math.max(existing.maxOverdueDays, days);
                        overdueLoansMap.set(l.id, existing);
                    }
                }
            }
        }

        const items = Array.from(overdueLoansMap.values()).map(({ loan, overdueAmount, maxOverdueDays }) => {
            const borrower = borrowers.find(b => b.id === loan.borrowerId);
            return {
                id: loan.id,
                label: borrower?.fullName ?? 'Unknown Borrower',
                sublabel: `${maxOverdueDays} days overdue • Loan #${loan.loanNumber || loan.id.slice(0, 8)}`,
                value: overdueAmount,
                isCurrency: true,
                onPress: () => {
                    setDialogVisible(false);
                    if (loan.borrowerId) router.push(`/(admin)/borrowers/${loan.borrowerId}`);
                }
            };
        });

        setDialogData({
            title: 'Overdue Loans (PAR > 30 Days)',
            total: kpis.overdueValue,
            isTotalCurrency: true,
            color: 'text-rose-600',
            items,
        });
        setDialogVisible(true);
    };

    const handleCollectedTodayClick = async () => {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const endOfDay = startOfDay + 86400000;

        const payments = await database.collections.get<Payment>('payments')
            .query(Q.where('payment_date', Q.gte(startOfDay)), Q.where('payment_date', Q.lt(endOfDay)))
            .fetch();
        const borrowers = await database.collections.get<Borrower>('borrowers').query().fetch();
        const loans = await database.collections.get<Loan>('loans').query().fetch();

        const items = payments.map(p => {
            const loan = loans.find(l => l.id === p.loanId);
            const borrower = borrowers.find(b => b.id === (p.borrowerId || loan?.borrowerId));
            return {
                id: p.id,
                label: borrower?.fullName ?? 'Unknown Borrower',
                sublabel: `OR #${p.receiptNumber || 'N/A'} • ${format(p.paymentDate, 'hh:mm a')}`,
                value: p.amount,
                isCurrency: true,
                onPress: () => {
                    setDialogVisible(false);
                    if (borrower?.id) router.push(`/(admin)/borrowers/${borrower.id}`);
                }
            };
        });

        setDialogData({
            title: "Today's Collections",
            total: kpis.collectedToday,
            isTotalCurrency: true,
            color: 'text-amber-600',
            items,
        });
        setDialogVisible(true);
    };

    const handleCollectedMonthClick = async () => {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
        const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1).getTime();

        const payments = await database.collections.get<Payment>('payments')
            .query(Q.where('payment_date', Q.gte(startOfMonth)), Q.where('payment_date', Q.lt(startOfNextMonth)))
            .fetch();
        const borrowers = await database.collections.get<Borrower>('borrowers').query().fetch();

        const items = payments.map(p => {
            const borrower = borrowers.find(b => b.id === p.borrowerId);
            return {
                id: p.id,
                label: borrower?.fullName ?? 'Unknown Borrower',
                sublabel: `${format(p.paymentDate, 'MMM d, yyyy')} • OR #${p.receiptNumber || 'N/A'}`,
                value: p.amount,
                isCurrency: true,
                onPress: () => {
                    setDialogVisible(false);
                    if (borrower?.id) router.push(`/(admin)/borrowers/${borrower.id}`);
                }
            };
        });

        setDialogData({
            title: "This Month's Collections",
            total: kpis.collectedMonth,
            isTotalCurrency: true,
            color: 'text-orange-600',
            items,
        });
        setDialogVisible(true);
    };

    const handleMembersClick = async () => {
        const borrowers = await database.collections.get<Borrower>('borrowers').query().fetch();
        const items = borrowers.map(b => ({
            id: b.id,
            label: b.fullName || 'Unnamed Member',
            sublabel: `${b.membershipNumber || b.memberId || 'No Member #'} • ${b.address || 'No Address'}`,
            value: b.membershipStatus ? b.membershipStatus.toUpperCase() : 'ACTIVE',
            isCurrency: false,
            onPress: () => {
                setDialogVisible(false);
                router.push(`/(admin)/borrowers/${b.id}`);
            }
        }));

        setDialogData({
            title: 'Registered Members',
            total: borrowers.length,
            isTotalCurrency: false,
            color: 'text-teal-600',
            items,
        });
        setDialogVisible(true);
    };

    const kpiCards: KpiCard[] = [
        { title: 'Active Loans', value: kpis.activeLoansCount, isCurrency: false, icon: 'receipt-long', iconBg: 'bg-blue-100', iconColor: '#2563EB', onPress: handleActiveLoansClick },
        { title: 'Weekly Target', value: kpis.weeklyTarget, isCurrency: true, icon: 'calendar-today', iconBg: 'bg-orange-100', iconColor: '#EA580C', onPress: () => router.push('/(admin)/reports/collection') },
        { title: 'Outstanding', value: kpis.outstandingBalance, isCurrency: true, icon: 'monetization-on', iconBg: 'bg-emerald-100', iconColor: '#355E3B', onPress: handleOutstandingClick },
        { title: 'Total Disbursed', value: kpis.totalDisbursed, isCurrency: true, icon: 'account-balance-wallet', iconBg: 'bg-purple-100', iconColor: '#9333EA', onPress: handleTotalDisbursedClick },
        { title: 'Overdue (PAR>30)', value: kpis.overdueValue, isCurrency: true, icon: 'warning', iconBg: 'bg-red-100', iconColor: '#DC2626', onPress: handleOverdueClick },
        { title: 'Collected Today', value: kpis.collectedToday, isCurrency: true, icon: 'today', iconBg: 'bg-amber-100', iconColor: '#D97706', onPress: handleCollectedTodayClick },
        { title: 'This Month', value: kpis.collectedMonth, isCurrency: true, icon: 'date-range', iconBg: 'bg-orange-100', iconColor: '#EA580C', onPress: handleCollectedMonthClick },
        { title: 'Cash on Hand', value: kpis.cashOnHand, isCurrency: true, icon: 'account-balance', iconBg: 'bg-sky-100', iconColor: '#0284C7', onPress: () => router.push('/(admin)/cash-on-hand') },
        { title: 'Cash on Bank', value: kpis.cashOnBank, isCurrency: true, icon: 'credit-card', iconBg: 'bg-indigo-100', iconColor: '#4F46E5', onPress: () => router.push('/(admin)/bank-accounts') },
        { title: 'Petty Cash', value: kpis.pettyCash, isCurrency: true, icon: 'local-atm', iconBg: 'bg-violet-100', iconColor: '#7C3AED', onPress: () => router.push('/(admin)/cash-on-hand') },
        { title: 'Members', value: kpis.totalBorrowers, isCurrency: false, icon: 'people', iconBg: 'bg-teal-100', iconColor: '#0D9488', onPress: handleMembersClick },
        { title: 'Savings Balance', value: kpis.totalSavingsBalance, isCurrency: true, icon: 'savings', iconBg: 'bg-green-100', iconColor: '#15803D', onPress: () => router.push('/(admin)/reports/savings') },
        { title: 'CBU Total', value: kpis.totalCbuBalance, isCurrency: true, icon: 'pie-chart', iconBg: 'bg-blue-100', iconColor: '#1E3A8A', onPress: () => router.push('/(admin)/reports/share-capital') },
    ].filter(card => {
        if (!isLendingEnabled) {
            return !['Active Loans', 'Weekly Target', 'Outstanding', 'Total Disbursed', 'Overdue (PAR>30)', 'Collected Today', 'This Month', 'Members', 'Savings Balance', 'CBU Total'].includes(card.title);
        }
        return true;
    });

    const showMetricInfo = (title: string, value: number | string, isCurrency: boolean) => {
        setInfoData({ title, value, isCurrency });
        setInfoVisible(true);
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <StatusBar barStyle="light-content" />
            <ScrollView
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
                showsVerticalScrollIndicator={false}
            >
                {/* Gradient Header */}
                <LinearGradient
                    colors={['#1E3A5F', '#0F2540']}
                    className="pt-14 pb-28 px-6 rounded-b-[40px]"
                >
                    <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-1 pr-3">
                                <Text testID="admin-portal-title" data-testid="admin-portal-title" className="text-blue-200/70 text-xs font-bold uppercase tracking-[3px]">Admin Portal</Text>
                                <Text className="text-white text-3xl font-black mt-1" numberOfLines={1}>{user?.email?.split('@')[0] ?? 'Admin'}</Text>
                                <View className="flex-row items-center gap-2 mt-1">
                                    <Text className="text-white/80 text-xs">{format(new Date(), 'EEEE, MMMM d')}</Text>
                                    <View className="bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-500/30">
                                        <Text className="text-blue-300 text-[8px] font-bold uppercase">{role}</Text>
                                    </View>
                                    <Pressable
                                        onPress={() => router.push('/select-branch' as any)}
                                        className="bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40 flex-row items-center gap-1 active:bg-emerald-500/30"
                                    >
                                        <MaterialIcons name="store" size={10} color="#34D399" />
                                        <Text className="text-emerald-300 text-[8px] font-bold uppercase">
                                            {branchId ? `Branch: ${branchId.slice(0, 8)}` : 'Switch Branch'}
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        <View className="items-end gap-2">
                            <SyncStatusIndicator />
                            <View className="flex-row items-center gap-2">
                                <Pressable
                                    onPress={() => router.push('/(admin)/reports/mfi-kpis')}
                                    className="p-2.5 bg-white/10 rounded-2xl active:bg-white/20 border border-white/10 relative"
                                >
                                    <MaterialIcons name="notifications-none" size={18} color="#FFF" />
                                    {overdueCount > 0 && (
                                        <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 items-center justify-center">
                                            <Text className="text-white text-[9px] font-black">{overdueCount > 9 ? '9+' : overdueCount}</Text>
                                        </View>
                                    )}
                                </Pressable>
                                <Pressable
                                    onPress={() => setDrawerOpen(true)}
                                    className="p-2.5 bg-white/10 rounded-2xl active:bg-white/20 border border-white/10 lg:hidden"
                                >
                                    <MaterialIcons name="menu" size={18} color="#FFF" />
                                </Pressable>
                                <Pressable
                                    testID="logout-button"
                                    onPress={signOut}
                                    className="p-2.5 bg-white/10 rounded-2xl active:bg-white/20 border border-white/10"
                                >
                                    <MaterialIcons name="logout" size={18} color="#FFF" />
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                {/* Quick Actions */}
                <View className="px-6 -mt-16 mb-7">
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingRight: 24, paddingBottom: 20 }}
                    >
                        {/* Agribusiness Quick Actions */}
                        <QuickActionBtn onPress={() => router.push('/(admin)/agribusiness' as any)} icon="eco" label="Command Center" bg="bg-green-700" fg="#FFF" />
                        <QuickActionBtn onPress={() => router.push('/(admin)/agribusiness/harvest' as any)} icon="scale" label="Harvest" bg="bg-lime-700" fg="#FFF" />
                        <QuickActionBtn onPress={() => router.push('/(admin)/agribusiness/cycles' as any)} icon="grass" label="Crop Cycles" bg="bg-emerald-700" fg="#FFF" />
                        <QuickActionBtn onPress={() => router.push('/(admin)/agribusiness/parcels' as any)} icon="landscape" label="Parcels" bg="bg-teal-700" fg="#FFF" />
                        <QuickActionBtn onPress={() => router.push('/(admin)/agribusiness/settlements' as any)} icon="receipt-long" label="Settlements" bg="bg-green-800" fg="#FFF" />
                        <QuickActionBtn onPress={() => router.push('/(admin)/agribusiness/investors' as any)} icon="attach-money" label="Investors" bg="bg-emerald-800" fg="#FFF" />
                        <QuickActionBtn onPress={() => router.push('/(admin)/agribusiness/labor' as any)} icon="engineering" label="Labor" bg="bg-lime-800" fg="#FFF" />
                        <QuickActionBtn onPress={() => router.push('/(admin)/agribusiness/analytics' as any)} icon="insights" label="Analytics" bg="bg-teal-800" fg="#FFF" />

                        {/* General Management */}
                        <QuickActionBtn onPress={() => router.push('/(admin)/accounting')} icon="menu-book" label="Accounting" bg="bg-blue-900" fg="#FFF" />
                        <QuickActionBtn onPress={() => router.push('/(admin)/cash-on-hand')} icon="account-balance-wallet" label="Cash Vault" bg="bg-amber-700" fg="#FFF" />
                        <QuickActionBtn onPress={() => router.push('/(admin)/cash-on-hand/petty-cash' as any)} icon="money" label="Petty Cash" bg="bg-teal-800" fg="#FFF" />
                        <QuickActionBtn onPress={() => router.push('/(admin)/reports/financial-summary')} icon="assessment" label="Financial Summary" bg="bg-emerald-600" fg="#FFF" />
                        <QuickActionBtn onPress={() => router.push('/(admin)/expenses')} icon="receipt-long" label="Add Expense" bg="bg-white" fg="#9333EA" />
                        <QuickActionBtn onPress={() => router.push('/(admin)/payroll')} icon="monetization-on" label="Run Payroll" bg="bg-white" fg="#1E3A8A" />
                    </ScrollView>
                </View>

                {/* KPI Grid */}
                <View className="px-6">
                    <View className="flex-row flex-wrap justify-between">
                        {kpiCards.map(card => (
                            <KpiTile 
                                key={card.title} 
                                {...card} 
                                onInfoPress={() => showMetricInfo(card.title, card.value, card.isCurrency)}
                            />
                        ))}
                    </View>
                </View>

                {/* Portfolio Breakdown */}
                {isLendingEnabled && (
                    <View className="px-6 mt-4">
                        <View className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-6">
                            <View className="mb-4">
                                <Text className="text-gray-900 font-black text-xl">Portfolio Breakdown</Text>
                                <Text className="text-gray-700 text-xs font-bold mt-1 uppercase tracking-wider">Daily vs Weekly Metrics</Text>
                            </View>

                            <View className="flex-row justify-between">
                                {/* Daily Column */}
                                <View className="w-[49%] bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                    <View className="flex-row items-center mb-2">
                                        <View className="w-8 h-8 rounded-xl bg-blue-100 items-center justify-center mr-2">
                                            <MaterialIcons name="wb-sunny" size={16} color="#2563EB" />
                                        </View>
                                        <Text className="text-blue-900 font-black text-sm">Daily</Text>
                                        <Pressable 
                                            onPress={() => showMetricInfo('Daily Portfolio', kpis.dailyTotalDisbursed + kpis.dailyActiveLoansCount, false)}
                                            className="ml-auto p-1"
                                        >
                                            <MaterialIcons name="info-outline" size={14} color="#3B82F6" />
                                        </Pressable>
                                    </View>
                                    <View className="mt-1">
                                        <Text className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Total Disbursed</Text>
                                        <PhpCurrencyText amount={kpis.dailyTotalDisbursed} className="text-lg font-black text-blue-900" />
                                    </View>
                                    <View className="mt-3">
                                        <Text className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Active Clients</Text>
                                        <Text className="text-xl font-black text-blue-900">{kpis.dailyActiveLoansCount}</Text>
                                    </View>
                                </View>

                                {/* Weekly Column */}
                                <View className="w-[49%] bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                                    <View className="flex-row items-center mb-2">
                                        <View className="w-8 h-8 rounded-xl bg-purple-100 items-center justify-center mr-2">
                                            <MaterialIcons name="calendar-view-week" size={16} color="#9333EA" />
                                        </View>
                                        <Text className="text-purple-900 font-black text-sm">Weekly</Text>
                                        <Pressable 
                                            onPress={() => showMetricInfo('Weekly Portfolio', kpis.weeklyTotalDisbursed + kpis.weeklyActiveLoansCount, false)}
                                            className="ml-auto p-1"
                                        >
                                            <MaterialIcons name="info-outline" size={14} color="#A855F7" />
                                        </Pressable>
                                    </View>
                                    <View className="mt-1">
                                        <Text className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Total Disbursed</Text>
                                        <PhpCurrencyText amount={kpis.weeklyTotalDisbursed} className="text-lg font-black text-purple-900" />
                                    </View>
                                    <View className="mt-3">
                                        <Text className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Active Clients</Text>
                                        <Text className="text-xl font-black text-purple-900">{kpis.weeklyActiveLoansCount}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {isLendingEnabled && loanTypeSummaries.length > 0 && (
                    <View className="px-6 mt-4">
                        <View className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-6">
                            <View className="mb-4">
                                <Text className="text-gray-900 font-black text-xl">Loans by Type</Text>
                                <Text className="text-gray-700 text-xs font-bold mt-1 uppercase tracking-wider">Released, outstanding, active, paid, delinquent</Text>
                            </View>
                            {loanTypeSummaries.map(row => (
                                <View key={row.loanType} className="py-3 border-b border-gray-50">
                                    <View className="flex-row items-center justify-between mb-2">
                                        <Text className="text-gray-900 font-black text-sm uppercase">{row.loanType.replace('_', ' ')}</Text>
                                        <Text className="text-gray-500 text-[10px] font-bold">{row.collectionEfficiency}% collected</Text>
                                    </View>
                                    <View className="flex-row justify-between">
                                        <View>
                                            <Text className="text-gray-500 text-[9px] font-bold uppercase">Released</Text>
                                            <Text className="text-gray-900 text-xs font-black">{formatPHP(row.amountReleased)}</Text>
                                        </View>
                                        <View>
                                            <Text className="text-gray-500 text-[9px] font-bold uppercase">Outstanding</Text>
                                            <Text className="text-red-700 text-xs font-black">{formatPHP(row.outstandingBalance)}</Text>
                                        </View>
                                        <View>
                                            <Text className="text-gray-500 text-[9px] font-bold uppercase">Status</Text>
                                            <Text className="text-gray-900 text-xs font-black">{row.activeLoans} A / {row.paidLoans} P / {row.delinquentLoans} D</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Lending Performance Chart */}
                {isLendingEnabled && (
                    <View className="px-6 mt-4">
                        <LendingPerformanceChart 
                            data={performanceData} 
                            title="Collection Trend" 
                            subtitle="This Week's Daily Collections" 
                        />
                    </View>
                )}

                {/* Portfolio Aging Breakdown */}
                {isLendingEnabled && (
                    <View className="px-6 mt-4">
                        <View className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-6">
                            <View className="mb-4">
                                <Text className="text-gray-900 font-black text-xl">Portfolio Aging</Text>
                                <Text className="text-gray-700 text-xs font-bold mt-1 uppercase tracking-wider">PAR Buckets Breakdown</Text>
                            </View>
                            
                            <View className="flex-row h-3 rounded-full overflow-hidden mb-6 bg-gray-50">
                                {agingBuckets.map((bucket, bIdx) => {
                                    const totalOverdue = agingBuckets.reduce((s, b) => s + b.amount, 0);
                                    const percentage = totalOverdue > 0 ? (bucket.amount / totalOverdue) * 100 : 0;
                                    if (percentage === 0) return null;
                                    return (
                                        <View key={bucket.label} style={{ width: `${percentage}%`, backgroundColor: bucket.color }} />
                                    );
                                })}
                            </View>

                            <View className="flex-row flex-wrap justify-between">
                                {agingBuckets.map(bucket => (
                                    <View key={bucket.label} className="w-[48%] flex-row items-center mb-4">
                                        <View style={{ backgroundColor: bucket.color }} className="w-2.5 h-2.5 rounded-full mr-2" />
                                        <View>
                                            <Text className="text-gray-700 font-bold text-[10px] uppercase">{bucket.label}</Text>
                                            <Text className="text-gray-900 font-black text-sm">{formatPHP(bucket.amount)}</Text>
                                            <Text className="text-[9px] text-gray-700 font-medium">{bucket.count} loans</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>
                )}

                {/* Overdue Watchlist */}
                {isLendingEnabled && overdueWatchlist.length > 0 && (
                    <View className="px-6 mb-4">
                        <View className="mb-4">
                            <Text className="text-gray-900 font-black text-2xl">Overdue Watchlist</Text>
                            <View className="h-1.5 w-12 bg-red-600 rounded-full mt-1" />
                        </View>
                        <View className="bg-white rounded-[32px] border border-red-100 overflow-hidden">
                            {overdueWatchlist.map((item, idx) => (
                                <View key={item.scheduleId} className={`flex-row items-center px-5 py-4 ${idx < overdueWatchlist.length - 1 ? 'border-b border-red-50' : ''}`}>
                                    <View className="bg-red-50 w-10 h-10 rounded-2xl items-center justify-center mr-4">
                                        <MaterialIcons name="warning" size={18} color="#DC2626" />
                                    </View>
                                    <View className="flex-1">
                                        <AnimatedPressable onPress={() => item.borrowerId && router.push(`/(admin)/borrowers/${item.borrowerId}`)}>
                                            <Text className="font-bold text-blue-700 underline">{item.borrowerName}</Text>
                                        </AnimatedPressable>
                                        <Text className="text-xs text-red-500 font-bold">{item.overdueDays} days overdue</Text>
                                        <Text className="text-[10px] text-gray-700 mt-0.5">Balance: {formatPHP(item.loanBalance)}</Text>
                                    </View>
                                    <View className="items-end">
                                        <Text className="font-black text-gray-900">{formatPHP(item.amountDue)}</Text>
                                        <View className="flex-row mt-2 gap-2">
                                            <AnimatedPressable 
                                                className="bg-gray-100 px-3 py-1.5 rounded-full active:bg-gray-200"
                                                onPress={() => {
                                                    if (item.phoneNumber) {
                                                        import('react-native').then(({ Linking }) => {
                                                            Linking.openURL(`tel:${item.phoneNumber}`);
                                                        });
                                                    } else {
                                                        Alert.alert("Error", "No phone number available for this borrower.");
                                                    }
                                                }}
                                            >
                                                <MaterialIcons name="call" size={14} color="#4B5563" />
                                            </AnimatedPressable>
                                            <AnimatedPressable 
                                                className="bg-blue-600 px-3 py-1.5 rounded-full active:bg-blue-700"
                                                onPress={() => {
                                                    if (item.phoneNumber) {
                                                        const type: ReminderType = item.overdueDays > 7 ? 'overdue' : 'friendly';
                                                        const url = ReminderService.generateSmsLink(type, {
                                                            borrowerName: item.borrowerName,
                                                            amountDue: item.amountDue,
                                                            dueDate: item.dueDate,
                                                            phoneNumber: item.phoneNumber
                                                        });
                                                        if (url) import('react-native').then(({ Linking }) => Linking.openURL(url));
                                                    } else {
                                                        Alert.alert("Error", "No phone number available.");
                                                    }
                                                }}
                                            >
                                                <MaterialIcons name="sms" size={14} color="#fff" />
                                            </AnimatedPressable>
                                            <AnimatedPressable 
                                                className="bg-green-600 px-3 py-1.5 rounded-full active:bg-green-700"
                                                onPress={() => {
                                                    if (item.phoneNumber) {
                                                        const type: ReminderType = item.overdueDays > 7 ? 'overdue' : 'friendly';
                                                        const url = ReminderService.generateWhatsAppLink(type, {
                                                            borrowerName: item.borrowerName,
                                                            amountDue: item.amountDue,
                                                            dueDate: item.dueDate,
                                                            phoneNumber: item.phoneNumber
                                                        });
                                                        if (url) import('react-native').then(({ Linking }) => Linking.openURL(url));
                                                    } else {
                                                        Alert.alert("Error", "No phone number available.");
                                                    }
                                                }}
                                            >
                                                <MaterialIcons name="chat" size={14} color="#fff" />
                                            </AnimatedPressable>
                                            <AnimatedPressable 
                                                className="bg-red-600 px-4 py-1.5 rounded-full active:bg-red-700 flex-row items-center"
                                                onPress={() => router.push(`/(admin)/payments/new?loanId=${item.loanId}`)}
                                            >
                                                <MaterialIcons name="payments" size={14} color="#fff" className="mr-1" />
                                                <Text className="text-white text-[10px] font-black uppercase">Collect</Text>
                                            </AnimatedPressable>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Recent Payments */}
                {isLendingEnabled && (
                    <>
                        <View className="px-6 mt-4 mb-4 flex-row justify-between items-center">
                            <View>
                                <Text className="text-gray-900 font-black text-2xl">Recent Payments</Text>
                                <View className="h-1.5 w-12 bg-blue-600 rounded-full mt-1" />
                            </View>
                            <Pressable onPress={() => router.push('/(admin)/payments')} className="px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100">
                                <Text className="text-blue-600 text-xs font-bold uppercase">View All</Text>
                            </Pressable>
                        </View>

                        <View className="px-6 pb-12">
                            <View className="bg-white rounded-3xl border border-gray-100">
                                {recentPayments.length === 0 ? (
                                    <View className="p-10 items-center">
                                        <MaterialIcons name="receipt" size={40} color="#D1D5DB" />
                                        <Text className="text-gray-700 font-semibold mt-3">No recent payments</Text>
                                    </View>
                                ) : (
                                    recentPayments.map((p, idx) => (
                                        <View key={p.id} className={`flex-row items-center px-5 py-4 ${idx < recentPayments.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                            <View className="bg-emerald-50 w-10 h-10 rounded-2xl items-center justify-center mr-4">
                                                <MaterialIcons name="check" size={18} color="#355E3B" />
                                            </View>
                                            <View className="flex-1">
                                                <AnimatedPressable onPress={() => p.borrowerId && router.push(`/(admin)/borrowers/${p.borrowerId}`)}>
                                                    <Text className="font-bold text-blue-700 leading-tight underline">{p.borrowerName}</Text>
                                                </AnimatedPressable>
                                                <Text className="text-xs text-gray-700 mt-0.5">{p.loanNumber} - {format(p.date, 'MMM d, yyyy')}</Text>
                                            </View>
                                            <Text className="font-black text-gray-900">{formatPHP(p.amount)}</Text>
                                        </View>
                                    ))
                                )}
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>

            <MetricBreakdownDialog
                visible={dialogVisible}
                onClose={() => setDialogVisible(false)}
                {...dialogData}
            />

            <MetricInfoDialog
                visible={infoVisible}
                onClose={() => setInfoVisible(false)}
                title={infoData.title}
                value={infoData.value}
                isCurrency={infoData.isCurrency}
                description={METRIC_INFO[infoData.title]?.description ?? 'No description available.'}
                formula={METRIC_INFO[infoData.title]?.formula ?? 'Formula not specified.'}
            />

            {/* Mobile Drawer Overflow Modal */}
            <Modal
                visible={drawerOpen}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setDrawerOpen(false)}
            >
                <View className="flex-1 flex-row">
                    {/* Dark overlay backdrop */}
                    <Pressable
                        className="absolute inset-0 bg-black/50"
                        onPress={() => setDrawerOpen(false)}
                    />

                    {/* Drawer Content */}
                    <View className="w-72 bg-blue-900 h-full shadow-2xl">
                        {/* SidebarContent needs to be accessible here, or redundant content */}
                        <SidebarContent onClose={() => setDrawerOpen(false)} />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
