import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, Alert, TextInput, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { safeBack } from '../../../../src/utils/navigation';
import { database } from '../../../../src/database';
import Borrower from '../../../../src/database/models/Borrower';
import SavingsTransaction from '../../../../src/database/models/SavingsTransaction';
import Loan from '../../../../src/database/models/Loan';
import Payment from '../../../../src/database/models/Payment';
import PaymentSchedule from '../../../../src/database/models/PaymentSchedule';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { formatPHP } from '../../../../src/utils/currency';
import uuid from 'react-native-uuid';
import { BorrowerSearchBar } from '../../../../src/components/BorrowerSearchBar';
import { useAuth } from '../../../../src/store/AuthContext';
import { DatePicker } from '../../../../src/components/DatePicker';
import { format, parseISO } from 'date-fns';
import ActionLogService from '../../../../src/services/ActionLogService';
import { PaymentService } from '../../../../src/services/PaymentService';
import { AutoPostingService } from '../../../../src/services/AutoPostingService';
import { CooperativeSavingsService } from '../../../../src/services/CooperativeSavingsService';
import { useRolePermissions } from '../../../../src/hooks/useSettingsConfig';


export default function SavingsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { user, role } = useAuth();
    const { isAllowed } = useRolePermissions(role);
    const canEdit = isAllowed('action.edit');
    const canDelete = isAllowed('action.delete');

    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [transactions, setTransactions] = useState<SavingsTransaction[]>([]);
    const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState(0);

    // Modals state
    const [withdrawCashModalOpen, setWithdrawCashModalOpen] = useState(false);
    const [withdrawLoanModalOpen, setWithdrawLoanModalOpen] = useState(false);
    const [amountInput, setAmountInput] = useState('');
    const [dateInput, setDateInput] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [notesInput, setNotesInput] = useState('');
    const [selectedLoanId, setSelectedLoanId] = useState('');
    const [saving, setSaving] = useState(false);

    // Edit transaction state
    const [editingTx, setEditingTx] = useState<SavingsTransaction | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editType, setEditType] = useState<'deposit' | 'withdrawal'>('deposit');
    const [editDate, setEditDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [editNotes, setEditNotes] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    const loadData = async () => {
        try {
            const b = await database.collections.get<Borrower>('borrowers').find(id);
            const txs = await database.collections.get<SavingsTransaction>('savings_transactions')
                .query(
                    Q.where('borrower_id', id),
                    Q.where('deleted_at', Q.eq(null)),
                    Q.sortBy('date', Q.desc)
                ).fetch();
            
            const loans = await database.collections.get<Loan>('loans')
                .query(
                    Q.where('borrower_id', id),
                    Q.where('status', Q.oneOf(['active', 'defaulted'])),
                    Q.where('deleted_at', Q.eq(null))
                ).fetch();

            setBorrower(b);
            setTransactions(txs);
            setActiveLoans(loans);

            // Compute Balance
            let bal = 0;
            for (const tx of txs) {
                if (tx.type === 'deposit' || tx.type === 'interest') bal += tx.amount;
                else bal -= tx.amount;
            }
            setBalance(bal);

        } catch (error) {
            console.error("Failed to load savings data", error);
            safeBack(router, '/(admin)');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleWithdrawCash = async () => {
        const amt = parseFloat(amountInput);
        if (isNaN(amt) || amt <= 0) return Alert.alert("Error", "Enter a valid positive amount.");
        if (amt > balance) return Alert.alert("Error", "Insufficient savings balance.");

        setSaving(true);
        try {
            const txId = uuid.v4().toString();
            await database.write(async () => {
                const newTransaction = await database.collections.get<SavingsTransaction>('savings_transactions').create(st => {
                    st._raw.id = txId;
                    st.borrowerId = id;
                    st.type = 'withdraw_cash';
                    st.amount = amt;
                    st.date = parseISO(dateInput).getTime();
                    st.notes = notesInput;
                });

                // Audit Log
                const logActions = await ActionLogService.prepareLogActions([{
                    entityType: 'savings_transactions',
                    entityId: txId,
                    action: 'CREATE',
                    newData: {
                        borrowerId: id,
                        type: 'withdraw_cash',
                        amount: amt,
                        date: dateInput,
                        notes: notesInput
                    }
                }]);
                await database.batch(...logActions);
            });

            setWithdrawCashModalOpen(false);
            setAmountInput('');
            setDateInput(format(new Date(), 'yyyy-MM-dd'));
            setNotesInput('');
            Alert.alert("Success", "Cash withdrawn successfully.");
            loadData();

            // Auto-post to accounting: DR Savings Deposits Payable / CR Cash on Hand
            AutoPostingService.postSavingsTransaction({
                transactionId: txId,
                type: 'withdrawal',
                amount: amt,
                entryDate: parseISO(dateInput),
                borrowerName: borrower?.fullName,
                postedBy: user?.id,
            }).catch(e => console.warn('[SavingsScreen] Auto-posting failed (withdraw_cash):', e));
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to withdraw cash.");
        } finally {
            setSaving(false);
        }
    };

    const handleWithdrawToLoan = async () => {
        const amt = parseFloat(amountInput);
        if (isNaN(amt) || amt <= 0) return Alert.alert("Error", "Enter a valid positive amount.");
        if (amt > balance) return Alert.alert("Error", "Insufficient savings balance.");
        if (!selectedLoanId) return Alert.alert("Error", "Please select a loan.");

        setSaving(true);
        try {
            await PaymentService.applySavingsToLoan({
                loanId: selectedLoanId,
                amount: amt,
                paymentDate: parseISO(dateInput),
                borrowerId: id,
                notes: notesInput ? `Payment from Savings. ${notesInput}` : 'Payment from Savings.',
                encodedBy: user?.id || '',
                collectorId: user?.id || '',
                database,
            });


            setWithdrawLoanModalOpen(false);
            setAmountInput('');
            setDateInput(format(new Date(), 'yyyy-MM-dd'));
            setNotesInput('');
            setSelectedLoanId('');
            Alert.alert("Success", "Savings applied to loan successfully.");
            loadData();
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to apply savings to loan.");
        } finally {
            setSaving(false);
        }
    };

    // ─── Edit / Delete Savings Transaction ──────────────────────────────────────

    const handleOpenEdit = (tx: SavingsTransaction) => {
        setEditingTx(tx);
        setEditAmount(String(tx.amount ?? ''));
        setEditType((tx.type === 'deposit' || tx.type === 'interest') ? 'deposit' : 'withdrawal');
        setEditDate(format(new Date(tx.date as number), 'yyyy-MM-dd'));
        setEditNotes(tx.notes ?? '');
    };

    const handleSaveEdit = async () => {
        if (!editingTx) return;
        const amt = parseFloat(editAmount);
        if (isNaN(amt) || amt <= 0) {
            Alert.alert('Error', 'Enter a valid positive amount.');
            return;
        }
        setSavingEdit(true);
        try {
            await CooperativeSavingsService.updateTransaction(
                editingTx.id,
                {
                    amount: amt,
                    type: editType === 'deposit' ? editingTx.type : 'withdraw_cash',
                    date: parseISO(editDate).getTime(),
                    notes: editNotes || null,
                },
                user?.id
            );
            setEditingTx(null);
            loadData();
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to update transaction.');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDeleteTx = (tx: SavingsTransaction) => {
        Alert.alert(
            'Delete Transaction',
            `Delete this ${tx.type.replace('_', ' ')} of ${formatPHP(tx.amount)}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await CooperativeSavingsService.deleteTransaction(tx.id, user?.id);
                            loadData();
                        } catch (e) {
                            console.error(e);
                            Alert.alert('Error', 'Failed to delete transaction.');
                        }
                    }
                }
            ]
        );
    };

    const handleComputeInterest = async () => {
        setSaving(true);
        try {
            // 6% interest per annum computed every 6 months (June 30 and Dec 31)
            const annualRate = 0.06;
            const semiAnnualRate = annualRate / 2;
            
            // 1. Get all transactions sorted by date
            const txs = await database.collections.get<SavingsTransaction>('savings_transactions')
                .query(
                    Q.where('borrower_id', id),
                    Q.sortBy('date', Q.asc)
                ).fetch();
            
            if (txs.length === 0) return Alert.alert("No Transactions", "There are no savings transactions to compute interest from.");
            
            const now = new Date();
            const currentYear = now.getFullYear();
            
            // 2. Identify periods to check
            // We'll check from the year of the first transaction up to the current year
            const firstTxDate = new Date(txs[0].date);
            const firstYear = firstTxDate.getFullYear();
            
            let interestEntriesToCreate: { amount: number, date: number, notes: string }[] = [];
            
            for (let year = firstYear; year <= currentYear; year++) {
                const periods = [
                    { end: new Date(year, 5, 30, 23, 59, 59), label: `Jun 30, ${year}`, startMonth: 0, endMonth: 5 }, // Jan-Jun
                    { end: new Date(year, 11, 31, 23, 59, 59), label: `Dec 31, ${year}`, startMonth: 6, endMonth: 11 } // Jul-Dec
                ];
                
                for (const period of periods) {
                    // Skip if period end is in the future
                    if (period.end > now) continue;
                    
                    // Check if interest for this period already exists
                    const exists = txs.some(tx => tx.type === 'interest' && tx.notes.includes(period.label));
                    if (exists) continue;
                    
                    // Skip if period ends before the first transaction
                    if (period.end < firstTxDate) continue;
                    
                    // Calculate Average Daily Balance for the period
                    const periodStart = period.startMonth === 0 ? new Date(year, 0, 1) : new Date(year, 6, 1);
                    const periodEnd = period.end;
                    
                    const actualStart = firstTxDate > periodStart ? firstTxDate : periodStart;
                    const totalDays = Math.ceil((periodEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (totalDays <= 0) continue;
                    
                    let weightedBalanceSum = 0;
                    let currentBal = 0;
                    
                    // Calculate balance at start of period
                    const txsBeforePeriod = txs.filter(tx => tx.date < actualStart.getTime());
                    for (const tx of txsBeforePeriod) {
                        if (tx.type === 'deposit' || tx.type === 'interest') currentBal += tx.amount;
                        else currentBal -= tx.amount;
                    }
                    
                    // Transactions within the period
                    const periodTxs = txs.filter(tx => tx.date >= actualStart.getTime() && tx.date <= periodEnd.getTime())
                        .sort((a, b) => a.date - b.date);
                    
                    let lastDate = actualStart.getTime();
                    
                    for (const tx of periodTxs) {
                        const days = (tx.date - lastDate) / (1000 * 60 * 60 * 24);
                        weightedBalanceSum += currentBal * days;
                        
                        if (tx.type === 'deposit' || tx.type === 'interest') currentBal += tx.amount;
                        else currentBal -= tx.amount;
                        
                        lastDate = tx.date;
                    }
                    
                    // Add remaining days until end of period
                    const remainingDays = (periodEnd.getTime() - lastDate) / (1000 * 60 * 60 * 24);
                    weightedBalanceSum += currentBal * remainingDays;
                    
                    const avgBalance = weightedBalanceSum / totalDays;
                    const interestAmount = Math.max(0, avgBalance * semiAnnualRate);
                    
                    if (interestAmount >= 0.01) {
                        interestEntriesToCreate.push({
                            amount: interestAmount,
                            date: periodEnd.getTime(),
                            notes: `Computed interest for period ending ${period.label}: Average Daily Balance ${formatPHP(avgBalance)} @ 3%`
                        });
                    }
                }
            }
            
            if (interestEntriesToCreate.length === 0) {
                return Alert.alert("Information", "No new interest to apply at this time.");
            }
            
            await database.write(async () => {
                const batchOps: any[] = [];
                const logs: any[] = [];

                for (const entry of interestEntriesToCreate) {
                    const txId = uuid.v4().toString();
                    batchOps.push(database.collections.get<SavingsTransaction>('savings_transactions').prepareCreate(st => {
                        st._raw.id = txId;
                        st.borrowerId = id;
                        st.type = 'interest';
                        st.amount = entry.amount;
                        st.date = entry.date;
                        st.notes = entry.notes;
                    }));

                    logs.push({
                        entityType: 'savings_transactions',
                        entityId: txId,
                        action: 'CREATE',
                        newData: {
                            borrowerId: id,
                            type: 'interest',
                            amount: entry.amount,
                            date: entry.date,
                            notes: entry.notes
                        }
                    });
                }

                const auditLogs = await ActionLogService.prepareLogActions(logs);
                await database.batch(...batchOps, ...auditLogs);
            });

            
            Alert.alert("Success", `${interestEntriesToCreate.length} interest record(s) applied.`);
            loadData();
            
        } catch (error) {
            console.error("Failed to compute interest", error);
            Alert.alert("Error", "Failed to compute interest.");
        } finally {
            setSaving(false);
        }
    };

    if (loading || !borrower) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <BorrowerSearchBar currentBorrowerId={id} placeholder="Jump to another borrower..." />

                {/* Header Card */}
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <Text className="text-2xl font-extrabold text-gray-900 mb-1">{borrower.fullName}</Text>
                    <Text className="text-gray-700 font-bold uppercase tracking-widest text-xs">Savings Account</Text>
                </View>

                {/* Balance Card */}
                <View className="bg-blue-900 p-6 rounded-3xl shadow-md mb-6 relative overflow-hidden">
                    <View className="absolute -right-10 -top-10 bg-white/10 w-40 h-40 rounded-full" />
                    <Text className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Available Savings</Text>
                    <Text className="text-4xl font-extrabold text-white mb-6">{formatPHP(balance)}</Text>
                    
                    <View className="flex-row">
                        <Pressable 
                            className="bg-white/20 px-4 py-3 rounded-xl flex-row items-center mr-2 active:bg-white/30"
                            onPress={() => { setAmountInput(''); setDateInput(format(new Date(), 'yyyy-MM-dd')); setNotesInput(''); setWithdrawCashModalOpen(true); }}
                        >
                            <MaterialIcons name="money-off" size={18} color="#fff" className="mr-2" />
                            <Text className="text-white font-bold text-sm uppercase">Withdraw Cash</Text>
                        </Pressable>
                        
                        <Pressable 
                            className="bg-green-500 px-4 py-3 rounded-xl flex-row items-center ml-2 active:bg-green-600"
                            onPress={() => { setAmountInput(''); setDateInput(format(new Date(), 'yyyy-MM-dd')); setNotesInput(''); setSelectedLoanId(''); setWithdrawLoanModalOpen(true); }}
                        >
                            <MaterialIcons name="payment" size={18} color="#fff" className="mr-2" />
                            <Text className="text-white font-bold text-sm uppercase">Pay to Loan</Text>
                        </Pressable>
                    </View>

                    <Pressable 
                        className="mt-4 bg-indigo-400/20 py-3 rounded-xl flex-row items-center justify-center active:bg-indigo-400/30 border border-white/20"
                        onPress={handleComputeInterest}
                        disabled={saving}
                    >
                        <MaterialIcons name="trending-up" size={18} color="#fff" className="mr-2" />
                        <Text className="text-white font-bold text-sm uppercase">Compute & Apply Interest</Text>
                    </Pressable>
                </View>

                {/* Transactions List */}
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8">
                    <Text className="text-lg font-bold text-gray-900 mb-6">Transaction History</Text>

                    {transactions.length === 0 ? (
                        <Text className="text-gray-700 font-medium italic text-center py-4">No savings transactions yet.</Text>
                    ) : (
                        transactions.map((tx, idx) => (
                            <View key={tx.id} className={`py-4 ${idx < transactions.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                <View className="flex-row justify-between items-start">
                                    <View className="flex-1 pr-4">
                                        <View className="flex-row items-center mb-1">
                                            <MaterialIcons 
                                                name={tx.type === 'deposit' || tx.type === 'interest' ? 'arrow-downward' : 'arrow-upward'} 
                                                size={16} 
                                                color={tx.type === 'deposit' || tx.type === 'interest' ? '#EAB308' : '#D32F2F'} 
                                                className="mr-1"
                                            />
                                            <Text className={`font-black uppercase tracking-wider text-xs ${tx.type === 'deposit' || tx.type === 'interest' ? 'text-green-700' : 'text-red-700'}`}>
                                                {tx.type.replace('_', ' ')}
                                            </Text>
                                        </View>
                                        <Text className="text-xs text-gray-700 mb-1">{new Date(tx.date as number).toLocaleDateString()}</Text>
                                        {tx.notes && <Text className="text-sm text-gray-600 italic">{tx.notes}</Text>}
                                    </View>
                                    <View className="items-end gap-1">
                                        <Text className={`font-extrabold text-lg ${tx.type === 'deposit' || tx.type === 'interest' ? 'text-green-600' : 'text-gray-900'}`}>
                                            {tx.type === 'deposit' || tx.type === 'interest' ? '+' : '-'}{formatPHP(tx.amount)}
                                        </Text>
                                        {/* Edit/delete only for non-system-generated entries */}
                                        {tx.type !== 'interest' && (
                                            <View className="flex-row gap-1">
                                                {canEdit && (
                                                    <Pressable
                                                        onPress={() => handleOpenEdit(tx)}
                                                        className="bg-blue-50 p-1.5 rounded-lg"
                                                    >
                                                        <Ionicons name="pencil" size={14} color="#1E3A8A" />
                                                    </Pressable>
                                                )}
                                                {canDelete && (
                                                    <Pressable
                                                        onPress={() => handleDeleteTx(tx)}
                                                        className="bg-red-50 p-1.5 rounded-lg"
                                                    >
                                                        <Ionicons name="trash" size={14} color="#DC2626" />
                                                    </Pressable>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Withdraw Cash Modal */}
            <Modal visible={withdrawCashModalOpen} animationType="slide" transparent>
                <View className="flex-1 bg-black/50 justify-center p-4">
                    <View className="bg-white rounded-3xl p-6 shadow-xl">
                        <Text className="text-xl font-extrabold text-gray-900 mb-6">Withdraw Cash</Text>
                        
                        <View className="mb-4">
                            <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Date *</Text>
                            <DatePicker value={dateInput} onChange={setDateInput} />
                        </View>

                        <View className="mb-4">
                            <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Amount (₱)</Text>
                            <TextInput 
                                className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 text-xl font-bold"
                                keyboardType="numeric"
                                value={amountInput}
                                onChangeText={setAmountInput}
                                placeholder="0.00"
                             placeholderTextColor="#9CA3AF"/>
                        </View>

                        <View className="mb-6">
                            <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Notes</Text>
                            <TextInput 
                                className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900"
                                value={notesInput}
                                onChangeText={setNotesInput}
                                placeholder="E.g. Approved by Manager"
                             placeholderTextColor="#9CA3AF"/>
                        </View>

                        <View className="flex-row justify-end space-x-4">
                            <Pressable className="px-6 py-3" onPress={() => setWithdrawCashModalOpen(false)}>
                                <Text className="font-bold text-gray-700">Cancel</Text>
                            </Pressable>
                            <Pressable 
                                className={`px-6 py-3 rounded-xl bg-blue-900 flex-row items-center ${saving ? 'opacity-50' : ''}`}
                                onPress={handleWithdrawCash}
                                disabled={saving}
                            >
                                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text className="font-bold text-white">Withdraw</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Withdraw To Loan Modal */}
            <Modal visible={withdrawLoanModalOpen} animationType="slide" transparent>
                <View className="flex-1 bg-black/50 justify-center p-4">
                    <View className="bg-white rounded-3xl p-6 shadow-xl">
                        <Text className="text-xl font-extrabold text-gray-900 mb-6">Pay Loan via Savings</Text>
                        
                        <View className="mb-4">
                            <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Date *</Text>
                            <DatePicker value={dateInput} onChange={setDateInput} />
                        </View>

                        <View className="mb-4">
                            <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Select Loan</Text>
                            {activeLoans.length === 0 ? (
                                <Text className="text-gray-700 italic p-4 bg-gray-50 rounded-xl">No active loans to pay.</Text>
                            ) : (
                                activeLoans.map(l => (
                                    <Pressable 
                                        key={l.id} 
                                        className={`p-4 rounded-xl border mb-2 ${selectedLoanId === l.id ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-200'}`}
                                        onPress={() => setSelectedLoanId(l.id)}
                                    >
                                        <Text className={`font-bold ${selectedLoanId === l.id ? 'text-blue-700' : 'text-gray-900'}`}>{l.loanNumber}</Text>
                                    </Pressable>
                                ))
                            )}
                        </View>

                        <View className="mb-4">
                            <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Amount (₱)</Text>
                            <TextInput 
                                className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 text-xl font-bold"
                                keyboardType="numeric"
                                value={amountInput}
                                onChangeText={setAmountInput}
                                placeholder="0.00"
                             placeholderTextColor="#9CA3AF"/>
                        </View>

                        <View className="mb-6">
                            <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Notes</Text>
                            <TextInput 
                                className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900"
                                value={notesInput}
                                onChangeText={setNotesInput}
                                placeholder="Optional notes"
                             placeholderTextColor="#9CA3AF"/>
                        </View>

                        <View className="flex-row justify-end space-x-4">
                            <Pressable className="px-6 py-3" onPress={() => setWithdrawLoanModalOpen(false)}>
                                <Text className="font-bold text-gray-700">Cancel</Text>
                            </Pressable>
                            <Pressable 
                                className={`px-6 py-3 rounded-xl bg-green-600 flex-row items-center ${saving || activeLoans.length === 0 ? 'opacity-50' : ''}`}
                                onPress={handleWithdrawToLoan}
                                disabled={saving || activeLoans.length === 0}
                            >
                                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text className="font-bold text-white">Pay to Loan</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Transaction Modal */}
            <Modal animationType="fade" transparent visible={!!editingTx} onRequestClose={() => setEditingTx(null)}>
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white w-full max-w-md p-6 rounded-3xl shadow-xl">
                        <Text className="text-lg font-black text-gray-900 mb-4">Edit Transaction</Text>

                        {/* Type toggle */}
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Type</Text>
                        <View className="flex-row gap-2 mb-4">
                            {(['deposit', 'withdrawal'] as const).map(t => (
                                <Pressable
                                    key={t}
                                    onPress={() => setEditType(t)}
                                    className={`flex-1 py-2.5 rounded-xl items-center border ${
                                        editType === t ? 'bg-blue-900 border-blue-900' : 'bg-gray-50 border-gray-200'
                                    }`}
                                >
                                    <Text className={`text-xs font-black uppercase ${
                                        editType === t ? 'text-white' : 'text-gray-700'
                                    }`}>{t}</Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* Date */}
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Date</Text>
                        <View className="mb-4">
                            <DatePicker value={editDate} onChange={setEditDate} />
                        </View>

                        {/* Amount */}
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Amount (₱)</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 font-extrabold text-xl mb-4"
                            keyboardType="numeric"
                            value={editAmount}
                            onChangeText={setEditAmount}
                            placeholder="0.00"
                         placeholderTextColor="#9CA3AF"/>

                        {/* Notes */}
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Notes</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 mb-6"
                            value={editNotes}
                            onChangeText={setEditNotes}
                            placeholder="Optional notes..."
                         placeholderTextColor="#9CA3AF"/>

                        <View className="flex-row gap-3">
                            <Pressable onPress={() => setEditingTx(null)} className="flex-1 bg-gray-100 py-3.5 rounded-2xl items-center">
                                <Text className="text-gray-700 font-bold text-sm uppercase">Cancel</Text>
                            </Pressable>
                            <Pressable onPress={handleSaveEdit} disabled={savingEdit} className="flex-1 bg-blue-900 py-3.5 rounded-2xl items-center">
                                {savingEdit ? <ActivityIndicator size="small" color="#FFF" /> : <Text className="text-white font-black text-sm uppercase">Save</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
