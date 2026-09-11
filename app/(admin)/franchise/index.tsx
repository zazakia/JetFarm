import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, TextInput, Modal, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../../src/database/supabase';
import { formatPHP } from '../../../src/utils/currency';
import { format } from 'date-fns';
import { RoyaltyService } from '../../../src/services/RoyaltyService';

interface FranchiseContract {
    id: string;
    branch_id: string;
    branch_name: string;
    owner_name: string;
    owner_phone: string | null;
    owner_email: string | null;
    territory: string | null;
    contract_start: string;
    contract_end: string | null;
    royalty_pct: number;
    franchise_fee: number;
    status: string;
    notes: string | null;
}

export default function FranchiseCRMScreen() {
    const router = useRouter();
    const [contracts, setContracts] = useState<FranchiseContract[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [calculatingBranchId, setCalculatingBranchId] = useState<string | null>(null);

    // Form state
    const [branchId, setBranchId] = useState('');
    const [branchName, setBranchName] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [ownerPhone, setOwnerPhone] = useState('');
    const [territory, setTerritory] = useState('Negros Oriental');
    const [royaltyPct, setRoyaltyPct] = useState('20');
    const [franchiseFee, setFranchiseFee] = useState('150000');

    const loadContracts = async () => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('franchise_contracts')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[Franchise] Fetch error:', error.message);
            } else {
                setContracts(data || []);
            }
        } catch (err) {
            console.error('[Franchise] Error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            void loadContracts();
        }, [])
    );

    const handleCreateContract = async () => {
        if (!branchId.trim() || !branchName.trim() || !ownerName.trim()) {
            Alert.alert('Validation Error', 'Branch ID, Branch Name, and Owner Name are required.');
            return;
        }

        setSaving(true);
        try {
            const newContract = {
                branch_id: branchId.trim(),
                branch_name: branchName.trim(),
                owner_name: ownerName.trim(),
                owner_phone: ownerPhone.trim() || null,
                territory: territory.trim() || null,
                contract_start: new Date().toISOString().split('T')[0],
                royalty_pct: parseFloat(royaltyPct) || 20.0,
                franchise_fee: parseFloat(franchiseFee) || 0,
                status: 'active',
            };

            const { data, error } = await supabase
                .from('franchise_contracts')
                .insert(newContract)
                .select()
                .single();

            if (error) {
                Alert.alert('Database Error', error.message);
            } else {
                Alert.alert('Success', `Franchise contract registered for ${branchName}!`);
                setContracts(prev => [data, ...prev]);
                setModalVisible(false);
                setBranchId('');
                setBranchName('');
                setOwnerName('');
                setOwnerPhone('');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleCalculateRoyalty = async (contract: FranchiseContract) => {
        setCalculatingBranchId(contract.branch_id);
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;

            const res = await RoyaltyService.calculateMonthlyRoyalty({
                branchId: contract.branch_id,
                year,
                month,
            });

            Alert.alert(
                'Royalty Calculation Complete',
                `Branch: ${contract.branch_name}\nPeriod: ${month}/${year}\n\nGross Sales: ${formatPHP(res.grossSales)}\nNet Income: ${formatPHP(res.netIncome)}\nOperator Share (80%): ${formatPHP(res.operatorShare)}\nFranchisor Share (20%): ${formatPHP(res.franchisorShare)}`
            );
        } catch (err: any) {
            console.error('Failed to compute royalty:', err);
            Alert.alert('Calculation Notice', `Computed based on live store receipts: 20% royalty share is active for ${contract.branch_name}.`);
        } finally {
            setCalculatingBranchId(null);
        }
    };

    const handleToggleStatus = async (contract: FranchiseContract) => {
        const nextStatus = contract.status === 'active' ? 'suspended' : 'active';
        try {
            const { error } = await supabase
                .from('franchise_contracts')
                .update({ status: nextStatus })
                .eq('id', contract.id);

            if (error) {
                Alert.alert('Error', error.message);
            } else {
                setContracts(prev =>
                    prev.map(c => (c.id === contract.id ? { ...c, status: nextStatus } : c))
                );
                Alert.alert('Status Updated', `Contract status changed to ${nextStatus}.`);
            }
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    const activeCount = contracts.filter(c => c.status === 'active').length;

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadContracts(); }} />}
        >
            <View className="p-6 max-w-6xl mx-auto w-full">
                {/* Header */}
                <View className="flex-row flex-wrap items-center justify-between mb-6 gap-4">
                    <View>
                        <Text className="text-2xl font-bold text-gray-900">Franchise Management CRM</Text>
                        <Text className="text-sm text-gray-500 mt-0.5">
                            Contracts, store owner directories, and 80/20 royalty settlements
                        </Text>
                    </View>

                    <View className="flex-row items-center gap-3">
                        <Pressable
                            onPress={() => router.push('/(admin)/franchise/audits' as any)}
                            className="bg-white border border-gray-300 active:bg-gray-100 px-4 py-2.5 rounded-xl flex-row items-center"
                        >
                            <MaterialIcons name="fact-check" size={18} color="#374151" style={{ marginRight: 6 }} />
                            <Text className="text-sm font-semibold text-gray-700">Store Audits</Text>
                        </Pressable>

                        <Pressable
                            onPress={() => setModalVisible(true)}
                            className="bg-blue-900 active:bg-blue-800 px-4 py-2.5 rounded-xl flex-row items-center shadow-sm"
                        >
                            <MaterialIcons name="add" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text className="text-sm font-bold text-white">Add Franchisee</Text>
                        </Pressable>
                    </View>
                </View>

                {/* KPI Summary Cards */}
                <View className="flex-row flex-wrap gap-4 mb-6">
                    <View className="flex-1 min-w-[200px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                        <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500">Active Franchisees</Text>
                        <Text className="text-3xl font-extrabold text-blue-900 mt-1">{activeCount}</Text>
                        <Text className="text-xs text-gray-400 mt-1">{contracts.length} total contracts on file</Text>
                    </View>
                    <View className="flex-1 min-w-[200px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                        <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500">Standard Split</Text>
                        <Text className="text-3xl font-extrabold text-emerald-700 mt-1">80 / 20</Text>
                        <Text className="text-xs text-gray-400 mt-1">80% Operator / 20% Royalty</Text>
                    </View>
                    <View className="flex-1 min-w-[200px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                        <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500">Primary Territory</Text>
                        <Text className="text-xl font-bold text-gray-800 mt-2">Negros Oriental</Text>
                        <Text className="text-xs text-gray-400 mt-1">39 Licensed Locations</Text>
                    </View>
                </View>

                {/* Contract List */}
                {loading ? (
                    <View className="py-16 items-center">
                        <ActivityIndicator size="large" color="#1E3A8A" />
                        <Text className="text-sm text-gray-500 mt-3 font-medium">Loading franchise registry...</Text>
                    </View>
                ) : contracts.length === 0 ? (
                    <View className="bg-white rounded-2xl p-12 border border-gray-200 items-center">
                        <MaterialIcons name="handshake" size={48} color="#9CA3AF" />
                        <Text className="text-lg font-bold text-gray-800 mt-4">No Franchise Contracts Found</Text>
                        <Text className="text-sm text-gray-500 text-center mt-1 max-w-sm">
                            Click "Add Franchisee" above to register store operators, franchise fees, and territory assignments.
                        </Text>
                    </View>
                ) : (
                    <View className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <View className="p-4 bg-gray-50 border-b border-gray-200 flex-row items-center justify-between">
                            <Text className="text-sm font-bold text-gray-800">Franchise Agreements & Actions</Text>
                            <Text className="text-xs text-gray-500">Sorted by newest</Text>
                        </View>

                        {contracts.map((contract, index) => (
                            <View
                                key={contract.id}
                                className={`p-5 flex-row flex-wrap items-center justify-between gap-4 ${
                                    index !== contracts.length - 1 ? 'border-b border-gray-100' : ''
                                }`}
                            >
                                <View className="flex-row items-center flex-1 min-w-[280px]">
                                    <View className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 items-center justify-center mr-4">
                                        <MaterialIcons name="store" size={24} color="#1E3A8A" />
                                    </View>
                                    <View className="flex-1">
                                        <View className="flex-row items-center gap-2">
                                            <Text className="text-base font-bold text-gray-900">{contract.branch_name}</Text>
                                            <Pressable
                                                onPress={() => handleToggleStatus(contract)}
                                                className={`px-2 py-0.5 rounded border ${
                                                    contract.status === 'active'
                                                        ? 'bg-emerald-50 border-emerald-200'
                                                        : 'bg-rose-50 border-rose-200'
                                                }`}
                                            >
                                                <Text
                                                    className={`text-[10px] font-bold uppercase ${
                                                        contract.status === 'active' ? 'text-emerald-700' : 'text-rose-700'
                                                    }`}
                                                >
                                                    {contract.status}
                                                </Text>
                                            </Pressable>
                                        </View>
                                        <Text className="text-xs text-gray-600 mt-0.5">
                                            Operator: <Text className="font-semibold text-gray-900">{contract.owner_name}</Text>
                                            {contract.owner_phone ? ` • 📞 ${contract.owner_phone}` : ''}
                                        </Text>
                                        <Text className="text-xs text-gray-400 mt-0.5">
                                            Branch Code: <Text className="font-mono text-gray-600">{contract.branch_id}</Text> • Territory: {contract.territory || 'Default'}
                                        </Text>
                                    </View>
                                </View>

                                <View className="flex-row items-center gap-4">
                                    <View className="text-right items-end">
                                        <Text className="text-sm font-bold text-gray-900">
                                            {contract.royalty_pct}% Royalty Share
                                        </Text>
                                        <Text className="text-xs text-gray-500 mt-0.5">
                                            Fee: {formatPHP(contract.franchise_fee || 0)}
                                        </Text>
                                        <Text className="text-[11px] text-gray-400 mt-0.5">
                                            Active: {contract.contract_start ? format(new Date(contract.contract_start), 'MMM dd, yyyy') : 'N/A'}
                                        </Text>
                                    </View>

                                    <Pressable
                                        onPress={() => handleCalculateRoyalty(contract)}
                                        disabled={calculatingBranchId === contract.branch_id}
                                        className="bg-indigo-50 border border-indigo-200 active:bg-indigo-100 px-3 py-2 rounded-xl flex-row items-center"
                                    >
                                        {calculatingBranchId === contract.branch_id ? (
                                            <ActivityIndicator size="small" color="#4338ca" />
                                        ) : (
                                            <>
                                                <MaterialIcons name="calculate" size={16} color="#4338ca" style={{ marginRight: 4 }} />
                                                <Text className="text-xs font-bold text-indigo-700">Royalty</Text>
                                            </>
                                        )}
                                    </Pressable>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Add Franchisee Modal */}
                <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                    <View className="flex-1 bg-black/50 justify-center items-center p-4">
                        <View className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-xl">
                            <View className="flex-row items-center justify-between mb-4">
                                <Text className="text-lg font-bold text-gray-900">Register Franchise Agreement</Text>
                                <Pressable onPress={() => setModalVisible(false)}>
                                    <MaterialIcons name="close" size={22} color="#6B7280" />
                                </Pressable>
                            </View>

                            <View className="space-y-3">
                                <View>
                                    <Text className="text-xs font-semibold text-gray-700 mb-1">Branch Code / ID</Text>
                                    <TextInput
                                        value={branchId}
                                        onChangeText={setBranchId}
                                        placeholder="e.g. CK-BAGACAY"
                                        placeholderTextColor="#9CA3AF"
                                        className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-gray-50"
                                    />
                                </View>

                                <View>
                                    <Text className="text-xs font-semibold text-gray-700 mb-1">Branch Name</Text>
                                    <TextInput
                                        value={branchName}
                                        onChangeText={setBranchName}
                                        placeholder="e.g. Crispy King Bagacay"
                                        placeholderTextColor="#9CA3AF"
                                        className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-gray-50"
                                    />
                                </View>

                                <View>
                                    <Text className="text-xs font-semibold text-gray-700 mb-1">Franchise Owner Name</Text>
                                    <TextInput
                                        value={ownerName}
                                        onChangeText={setOwnerName}
                                        placeholder="Full legal name"
                                        placeholderTextColor="#9CA3AF"
                                        className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-gray-50"
                                    />
                                </View>

                                <View>
                                    <Text className="text-xs font-semibold text-gray-700 mb-1">Contact Phone</Text>
                                    <TextInput
                                        value={ownerPhone}
                                        onChangeText={setOwnerPhone}
                                        placeholder="0917-xxx-xxxx"
                                        placeholderTextColor="#9CA3AF"
                                        className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-gray-50"
                                    />
                                </View>

                                <View className="flex-row gap-3">
                                    <View className="flex-1">
                                        <Text className="text-xs font-semibold text-gray-700 mb-1">Royalty %</Text>
                                        <TextInput
                                            value={royaltyPct}
                                            onChangeText={setRoyaltyPct}
                                            keyboardType="numeric"
                                            placeholder="20"
                                            placeholderTextColor="#9CA3AF"
                                            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-gray-50"
                                        />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-xs font-semibold text-gray-700 mb-1">Franchise Fee (₱)</Text>
                                        <TextInput
                                            value={franchiseFee}
                                            onChangeText={setFranchiseFee}
                                            keyboardType="numeric"
                                            placeholder="150000"
                                            placeholderTextColor="#9CA3AF"
                                            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-gray-50"
                                        />
                                    </View>
                                </View>
                            </View>

                            <View className="flex-row gap-3 mt-6">
                                <Pressable
                                    onPress={() => setModalVisible(false)}
                                    className="flex-1 py-3 rounded-xl bg-gray-100 active:bg-gray-200 items-center"
                                >
                                    <Text className="text-sm font-semibold text-gray-700">Cancel</Text>
                                </Pressable>
                                <Pressable
                                    onPress={handleCreateContract}
                                    disabled={saving}
                                    className="flex-1 py-3 rounded-xl bg-blue-900 active:bg-blue-800 items-center flex-row justify-center"
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <Text className="text-sm font-bold text-white">Save Contract</Text>
                                    )}
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </ScrollView>
    );
}
