import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, Alert, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import AgriInvestor from '../../../src/database/models/AgriInvestor';
import AgriInvestorLedger from '../../../src/database/models/AgriInvestorLedger';
import AgriCropCycle from '../../../src/database/models/AgriCropCycle';
import { formatPHP } from '../../../src/utils/currency';
import { Q } from '@nozbe/watermelondb';
import { AutoPostingService } from '../../../src/services/AutoPostingService';

export default function InvestorsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [investors, setInvestors] = useState<AgriInvestor[]>([]);
    const [selectedInvestorId, setSelectedInvestorId] = useState<string>('');
    const [ledgerEntries, setLedgerEntries] = useState<AgriInvestorLedger[]>([]);
    const [cycles, setCycles] = useState<AgriCropCycle[]>([]);

    // Modals
    const [createInvestorModal, setCreateInvestorModal] = useState(false);
    const [companyName, setCompanyName] = useState('BioGreen Agri Solutions');
    const [contactPerson, setContactPerson] = useState('Engr. Robert Lee');
    const [contactNumber, setContactNumber] = useState('0918-555-1234');
    const [offtakeRate, setOfftakeRate] = useState('4.00');
    const [savingInvestor, setSavingInvestor] = useState(false);

    const [capitalModal, setCapitalModal] = useState(false);
    const [capitalAmount, setCapitalAmount] = useState('');
    const [capitalNotes, setCapitalNotes] = useState('Initial cycle operating capital & tractor fuel provision');
    const [selectedCycleId, setSelectedCycleId] = useState('');
    const [savingCapital, setSavingCapital] = useState(false);

    const loadData = async () => {
        try {
            const list = await database
                .get<AgriInvestor>('agri_investors')
                .query(Q.where('deleted_at', null))
                .fetch();
            setInvestors(list);

            let currentId = selectedInvestorId;
            if (!currentId && list.length > 0) {
                currentId = list[0].id;
                setSelectedInvestorId(currentId);
            }

            if (currentId) {
                const entries = await database
                    .get<AgriInvestorLedger>('agri_investor_ledgers')
                    .query(
                        Q.where('investor_id', currentId),
                        Q.where('deleted_at', null),
                        Q.sortBy('transaction_date', Q.desc)
                    )
                    .fetch();
                setLedgerEntries(entries);
            }

            const cycList = await database
                .get<AgriCropCycle>('agri_crop_cycles')
                .query(Q.where('deleted_at', null))
                .fetch();
            setCycles(cycList);
            if (cycList.length > 0 && !selectedCycleId) {
                setSelectedCycleId(cycList[0].id);
            }
        } catch (err) {
            console.error('[Investors] Error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [selectedInvestorId])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleCreateInvestor = async () => {
        if (!companyName.trim()) {
            Alert.alert('Validation Error', 'Please enter company name.');
            return;
        }

        setSavingInvestor(true);
        try {
            await database.write(async () => {
                await database.get<AgriInvestor>('agri_investors').create(record => {
                    record.companyName = companyName.trim();
                    record.contactPerson = contactPerson.trim() || null;
                    record.contactNumber = contactNumber.trim() || null;
                    record.defaultOfftakePricePerKg = parseFloat(offtakeRate) || 4.0;
                });
            });

            setCreateInvestorModal(false);
            loadData();
            Alert.alert('Success', 'Investor registered successfully!');
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to save investor');
        } finally {
            setSavingInvestor(false);
        }
    };

    const handleRecordCapital = async () => {
        const amt = parseFloat(capitalAmount);
        if (isNaN(amt) || amt <= 0 || !selectedInvestorId) {
            Alert.alert('Validation Error', 'Please enter valid capital amount.');
            return;
        }

        setSavingCapital(true);
        try {
            const prevBalance = ledgerEntries.length > 0 ? (ledgerEntries[0].balanceRunning || 0) : 0;
            // Capital injected by investor is a credit against off-takes
            const newBalance = Number((prevBalance - amt).toFixed(2));

            let createdLedger: AgriInvestorLedger | null = null;
            await database.write(async () => {
                createdLedger = await database.get<AgriInvestorLedger>('agri_investor_ledgers').create(record => {
                    record.investorId = selectedInvestorId;
                    record.cropCycleId = selectedCycleId || null;
                    record.transactionDate = new Date();
                    record.type = 'capital_injection';
                    record.amount = amt;
                    record.balanceRunning = newBalance;
                    record.notes = capitalNotes.trim() || 'Capital injection';
                });
            });

            if (createdLedger) {
                try {
                    await AutoPostingService.postAgriInvestorTransaction({
                        ledgerId: (createdLedger as AgriInvestorLedger).id,
                        investorName: selectedInvestor?.companyName,
                        type: 'capital_injection',
                        amount: amt,
                        transactionDate: new Date(),
                        cropCycleId: selectedCycleId || null,
                        notes: capitalNotes.trim() || 'Capital injection',
                        postedBy: 'Operator',
                    });
                } catch (postErr) {
                    console.warn('[AgriInvestors] Auto-post investor transaction warning:', postErr);
                }
            }

            setCapitalModal(false);
            setCapitalAmount('');
            loadData();
            Alert.alert('Success', `Recorded ${formatPHP(amt)} capital funded by Investor and posted to General Ledger!`);
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to record capital');
        } finally {
            setSavingCapital(false);
        }
    };

    const selectedInvestor = investors.find(i => i.id === selectedInvestorId);
    const totalOfftakeDeliveries = ledgerEntries
        .filter(e => e.type === 'harvest_offtake')
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalCapitalFunded = ledgerEntries
        .filter(e => e.type === 'capital_injection')
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalKilosReceived = ledgerEntries
        .filter(e => e.type === 'harvest_offtake')
        .reduce((sum, e) => sum + (e.kilosReceived || 0), 0);

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            contentContainerStyle={{ padding: 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Header */}
            <View className="flex-row justify-between items-center mb-6">
                <View>
                    <Text className="text-2xl font-black text-gray-900">Investor Capital & Off-Take</Text>
                    <Text className="text-sm text-gray-500 mt-0.5">
                        Track partner funding (BioGreen), harvested off-take deliveries & running balance
                    </Text>
                </View>
                <Pressable
                    onPress={() => setCreateInvestorModal(true)}
                    className="bg-indigo-700 px-4 py-2.5 rounded-xl flex-row items-center gap-1.5 shadow-sm active:bg-indigo-800"
                >
                    <MaterialIcons name="add" size={20} color="#FFFFFF" />
                    <Text className="text-white font-bold text-sm">Add Investor</Text>
                </Pressable>
            </View>

            {/* Investor Selector */}
            <View className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6">
                <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Active Investor Partner
                </Text>
                {investors.length === 0 ? (
                    <Text className="text-xs text-gray-400">No investors registered yet.</Text>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                        {investors.map(inv => (
                            <Pressable
                                key={inv.id}
                                onPress={() => setSelectedInvestorId(inv.id)}
                                className={`px-4 py-2 rounded-xl border ${
                                    selectedInvestorId === inv.id
                                        ? 'bg-indigo-800 border-indigo-800'
                                        : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                                }`}
                            >
                                <Text
                                    className={`text-xs font-bold ${
                                        selectedInvestorId === inv.id ? 'text-white' : 'text-gray-800'
                                    }`}
                                >
                                    {inv.companyName}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* Investor Summary Card */}
            {selectedInvestor && (
                <View className="bg-indigo-900 rounded-3xl p-6 mb-6 shadow-md text-white">
                    <View className="flex-row justify-between items-start">
                        <View>
                            <Text className="text-indigo-200 text-xs font-bold uppercase tracking-wider">
                                Off-Take Buying Partner
                            </Text>
                            <Text className="text-white text-2xl font-black mt-1">
                                {selectedInvestor.companyName}
                            </Text>
                            <Text className="text-indigo-200 text-xs mt-0.5">
                                Contact: {selectedInvestor.contactPerson || 'N/A'} ({selectedInvestor.contactNumber || 'No phone'})
                            </Text>
                        </View>
                        <View className="bg-indigo-800/80 px-3 py-1.5 rounded-full border border-indigo-600">
                            <Text className="text-indigo-100 text-xs font-bold">
                                Rate: {formatPHP(selectedInvestor.defaultOfftakePricePerKg)} / kg
                            </Text>
                        </View>
                    </View>

                    <View className="flex-row gap-4 mt-5 pt-4 border-t border-indigo-800/60">
                        <View className="flex-1">
                            <Text className="text-indigo-300 text-xs font-bold uppercase">Off-Take Purchases</Text>
                            <Text className="text-white text-xl font-black mt-0.5">
                                {formatPHP(totalOfftakeDeliveries)}
                            </Text>
                            <Text className="text-indigo-300 text-[10px]">{totalKilosReceived.toLocaleString()} kg delivered</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-indigo-300 text-xs font-bold uppercase">Capital Funded</Text>
                            <Text className="text-white text-xl font-black mt-0.5">
                                {formatPHP(totalCapitalFunded)}
                            </Text>
                            <Text className="text-indigo-300 text-[10px]">Operations & inputs</Text>
                        </View>
                    </View>

                    <Pressable
                        onPress={() => setCapitalModal(true)}
                        className="mt-4 bg-indigo-700 p-3 rounded-xl items-center active:bg-indigo-800"
                    >
                        <Text className="text-white font-bold text-xs">+ Record Capital Injection</Text>
                    </Pressable>
                </View>
            )}

            {/* Ledger Transactions */}
            <Text className="text-lg font-black text-gray-900 mb-3">Ledger Transaction History</Text>
            {ledgerEntries.length === 0 ? (
                <View className="bg-white p-8 rounded-2xl border border-gray-200 items-center justify-center">
                    <MaterialIcons name="menu-book" size={48} color="#9CA3AF" />
                    <Text className="text-gray-900 font-bold text-base mt-2">No Transactions Logged</Text>
                    <Text className="text-gray-500 text-xs text-center mt-1">
                        Transactions are automatically recorded when truck weigh-ins are logged at scale terminal.
                    </Text>
                </View>
            ) : (
                <View className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    {ledgerEntries.map((tx, idx) => (
                        <View
                            key={tx.id}
                            className={`p-4 flex-row justify-between items-center ${
                                idx !== ledgerEntries.length - 1 ? 'border-b border-gray-100' : ''
                            }`}
                        >
                            <View>
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-sm font-bold text-gray-900 capitalize">
                                        {tx.type.replace(/_/g, ' ')}
                                    </Text>
                                    <View
                                        className={`px-2 py-0.5 rounded-full ${
                                            tx.type === 'harvest_offtake' ? 'bg-emerald-100' : 'bg-blue-100'
                                        }`}
                                    >
                                        <Text
                                            className={`text-[10px] font-bold ${
                                                tx.type === 'harvest_offtake' ? 'text-emerald-800' : 'text-blue-800'
                                            }`}
                                        >
                                            {tx.type === 'harvest_offtake' ? 'Delivery' : 'Capital'}
                                        </Text>
                                    </View>
                                </View>
                                <Text className="text-xs text-gray-500 mt-0.5">{tx.notes || 'No description'}</Text>
                                {tx.kilosReceived ? (
                                    <Text className="text-[10px] text-gray-400">
                                        {tx.kilosReceived.toLocaleString()} kg @ {formatPHP(tx.pricePerKilo)}/kg
                                    </Text>
                                ) : null}
                            </View>

                            <View className="items-end">
                                <Text
                                    className={`text-base font-black ${
                                        tx.type === 'harvest_offtake' ? 'text-emerald-700' : 'text-blue-800'
                                    }`}
                                >
                                    {formatPHP(tx.amount)}
                                </Text>
                                <Text className="text-[10px] text-gray-400">
                                    {new Date(tx.transactionDate).toISOString().split('T')[0]}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Create Investor Modal */}
            <Modal visible={createInvestorModal} transparent animationType="fade">
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl">
                        <Text className="text-lg font-black text-gray-900 mb-3">Register Off-Take Investor</Text>

                        <Text className="text-xs font-bold text-gray-700 mb-1">Company Name *</Text>
                        <TextInput
                            value={companyName}
                            onChangeText={setCompanyName}
                            placeholder="e.g. BioGreen Agri Solutions"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                        />

                        <Text className="text-xs font-bold text-gray-700 mb-1">Contact Person</Text>
                        <TextInput
                            value={contactPerson}
                            onChangeText={setContactPerson}
                            placeholder="Representative Name"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                        />

                        <Text className="text-xs font-bold text-gray-700 mb-1">Contact Phone</Text>
                        <TextInput
                            value={contactNumber}
                            onChangeText={setContactNumber}
                            placeholder="0917-XXX-XXXX"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                        />

                        <Text className="text-xs font-bold text-gray-700 mb-1">Default Off-Take Price (₱/kg) *</Text>
                        <TextInput
                            value={offtakeRate}
                            onChangeText={setOfftakeRate}
                            placeholder="4.00"
                            keyboardType="numeric"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-4"
                        />

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => setCreateInvestorModal(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleCreateInvestor}
                                disabled={savingInvestor}
                                className="flex-1 py-3 bg-indigo-700 rounded-xl items-center active:bg-indigo-800"
                            >
                                {savingInvestor ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text className="font-bold text-white text-sm">Save Investor</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Record Capital Injection Modal */}
            <Modal visible={capitalModal} transparent animationType="fade">
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl">
                        <Text className="text-lg font-black text-gray-900 mb-3">Record Capital Funded</Text>

                        <Text className="text-xs font-bold text-gray-700 mb-1">Amount Funded (₱) *</Text>
                        <TextInput
                            value={capitalAmount}
                            onChangeText={setCapitalAmount}
                            placeholder="e.g. 150000"
                            keyboardType="numeric"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                        />

                        <Text className="text-xs font-bold text-gray-700 mb-1">Target Crop Cycle</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mb-3">
                            {cycles.map(c => (
                                <Pressable
                                    key={c.id}
                                    onPress={() => setSelectedCycleId(c.id)}
                                    className={`px-3 py-1.5 rounded-xl border ${
                                        selectedCycleId === c.id
                                            ? 'bg-indigo-800 border-indigo-800'
                                            : 'bg-gray-50 border-gray-200'
                                    }`}
                                >
                                    <Text
                                        className={`text-xs font-bold ${
                                            selectedCycleId === c.id ? 'text-white' : 'text-gray-800'
                                        }`}
                                    >
                                        {c.cycleCode}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        <Text className="text-xs font-bold text-gray-700 mb-1">Notes / Equipment Provided</Text>
                        <TextInput
                            value={capitalNotes}
                            onChangeText={setCapitalNotes}
                            placeholder="Tractor rental, seedling provision..."
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-4"
                        />

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => setCapitalModal(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleRecordCapital}
                                disabled={savingCapital}
                                className="flex-1 py-3 bg-indigo-700 rounded-xl items-center active:bg-indigo-800"
                            >
                                {savingCapital ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text className="font-bold text-white text-sm">Save Capital</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}
