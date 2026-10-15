import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Platform, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MaterialIcons } from '@expo/vector-icons';
import { FundTransferService, FundTransferHistoryRecord } from '../../../src/services/FundTransferService';
import { ChartOfAccountsService } from '../../../src/services/ChartOfAccountsService';
import { formatPHP } from '../../../src/utils/currency';
import { formatDateTime, formatRelative } from '../../../src/utils/dates';
import { useAuth } from '../../../src/store/AuthContext';
import { safeBack } from '../../../src/utils/navigation';

const TRANSFER_ACCOUNTS = [
    { code: '1010', name: 'Cash on Hand (COH)', category: 'Cash' },
    { code: '1011', name: 'Cash on Hand — Petty Cash', category: 'Petty Cash' },
    { code: '1020', name: 'Cash in Bank — BDO', category: 'Bank' },
    { code: '1030', name: 'Cash in Bank — PNB', category: 'Bank' },
    { code: '1040', name: 'Cash in Bank — Other', category: 'Bank' },
];

const schema = z.object({
    sourceAccountCode: z.string().min(1, 'Source account is required'),
    targetAccountCode: z.string().min(1, 'Target account is required'),
    amount: z.string().refine(v => v.trim() !== '' && !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Amount must be greater than zero'),
    description: z.string().min(3, 'Description is required'),
}).refine(data => data.sourceAccountCode !== data.targetAccountCode, {
    message: 'Source and target accounts must be different',
    path: ['targetAccountCode'],
});

type FormData = z.infer<typeof schema>;

export default function FundTransfersScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'transfer' | 'history'>('transfer');
    const [saving, setSaving] = useState(false);
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [loadingBalances, setLoadingBalances] = useState(true);

    // History state
    const [history, setHistory] = useState<FundTransferHistoryRecord[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const { control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            sourceAccountCode: '1010',
            targetAccountCode: '1011',
            amount: '',
            description: 'Fund Transfer',
        },
    });

    const loadBalances = async () => {
        try {
            const balMap: Record<string, number> = {};
            for (const acc of TRANSFER_ACCOUNTS) {
                const account = await ChartOfAccountsService.getByCode(acc.code);
                balMap[acc.code] = account ? 0 : 0;
            }
            setBalances(balMap);
        } catch (e) {
            console.warn('Failed to fetch account balances', e);
        } finally {
            setLoadingBalances(false);
        }
    };

    const loadHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const data = await FundTransferService.getTransferHistory(50);
            setHistory(data);
        } catch (e) {
            console.warn('Failed to load transfer history', e);
        } finally {
            setLoadingHistory(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadBalances();
        loadHistory();
    }, [loadHistory]);

    const onRefresh = () => {
        setRefreshing(true);
        loadHistory();
    };

    const onSubmit = async (data: FormData) => {
        setSaving(true);
        try {
            const srcObj = TRANSFER_ACCOUNTS.find(a => a.code === data.sourceAccountCode);
            const tgtObj = TRANSFER_ACCOUNTS.find(a => a.code === data.targetAccountCode);

            await FundTransferService.executeTransfer({
                sourceAccountCode: data.sourceAccountCode,
                sourceAccountName: srcObj?.name,
                targetAccountCode: data.targetAccountCode,
                targetAccountName: tgtObj?.name,
                amount: parseFloat(data.amount),
                description: data.description.trim(),
                performedBy: user?.id,
            });

            if (Platform.OS === 'web') {
                window.alert('Fund transfer executed successfully.');
            } else {
                Alert.alert('Success', 'Fund transfer executed successfully.');
            }
            reset();
            await loadHistory();
            setActiveTab('history');
        } catch (error: any) {
            if (Platform.OS === 'web') {
                window.alert(error?.message || 'Transfer failed.');
            } else {
                Alert.alert('Error', error?.message || 'Transfer failed.');
            }
        } finally {
            setSaving(false);
        }
    };

    const filteredHistory = history.filter(item => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            item.description.toLowerCase().includes(q) ||
            item.referenceNumber.toLowerCase().includes(q) ||
            item.sourceAccountCode.includes(q) ||
            (item.sourceAccountName || '').toLowerCase().includes(q) ||
            item.targetAccountCode.includes(q) ||
            (item.targetAccountName || '').toLowerCase().includes(q) ||
            (item.operatorName || '').toLowerCase().includes(q)
        );
    });

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            contentContainerStyle={{ padding: 16 }}
            refreshControl={
                activeTab === 'history' ? (
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                ) : undefined
            }
        >
            {/* Header Navigation */}
            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                    <Pressable
                        onPress={() => safeBack(router, '/(admin)')}
                        className="mr-3 bg-white p-2 rounded-xl border border-gray-200"
                    >
                        <MaterialIcons name="arrow-back" size={20} color="#1E3A8A" />
                    </Pressable>
                    <View>
                        <Text className="text-2xl font-black text-gray-900">Fund Transfers</Text>
                        <Text className="text-gray-500 font-bold text-xs">COH, Petty Cash & Bank Account Routing</Text>
                    </View>
                </View>
            </View>

            {/* Segmented Tab Controls */}
            <View className="flex-row bg-gray-200 p-1 rounded-2xl mb-6">
                <Pressable
                    onPress={() => setActiveTab('transfer')}
                    className={`flex-1 py-3 rounded-xl flex-row justify-center items-center ${
                        activeTab === 'transfer' ? 'bg-white shadow-sm' : ''
                    }`}
                >
                    <MaterialIcons
                        name="swap-horiz"
                        size={18}
                        color={activeTab === 'transfer' ? '#1E3A8A' : '#64748B'}
                        style={{ marginRight: 6 }}
                    />
                    <Text
                        className={`text-xs font-bold uppercase tracking-wider ${
                            activeTab === 'transfer' ? 'text-blue-900' : 'text-gray-600'
                        }`}
                    >
                        New Transfer
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => {
                        setActiveTab('history');
                        loadHistory();
                    }}
                    className={`flex-1 py-3 rounded-xl flex-row justify-center items-center ${
                        activeTab === 'history' ? 'bg-white shadow-sm' : ''
                    }`}
                >
                    <MaterialIcons
                        name="history"
                        size={18}
                        color={activeTab === 'history' ? '#1E3A8A' : '#64748B'}
                        style={{ marginRight: 6 }}
                    />
                    <Text
                        className={`text-xs font-bold uppercase tracking-wider ${
                            activeTab === 'history' ? 'text-blue-900' : 'text-gray-600'
                        }`}
                    >
                        Transfer History ({history.length})
                    </Text>
                </Pressable>
            </View>

            {activeTab === 'transfer' ? (
                /* NEW TRANSFER FORM */
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <View className="flex-row items-center mb-6">
                        <View className="w-12 h-12 rounded-2xl bg-blue-100 items-center justify-center mr-4">
                            <MaterialIcons name="sync-alt" size={24} color="#1E3A8A" />
                        </View>
                        <View>
                            <Text className="text-xl font-black text-gray-900">Execute Transfer</Text>
                            <Text className="text-gray-500 font-bold text-xs">Generates balanced double-entry GL vouchers</Text>
                        </View>
                    </View>

                    {/* Source Account Selection */}
                    <View className="mb-6">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">From (Source Account)</Text>
                        <Controller
                            control={control}
                            name="sourceAccountCode"
                            render={({ field: { onChange, value } }) => (
                                <View className="gap-2">
                                    {TRANSFER_ACCOUNTS.map(acc => (
                                        <Pressable
                                            key={acc.code}
                                            onPress={() => onChange(acc.code)}
                                            className={`p-4 rounded-2xl border flex-row justify-between items-center ${
                                                value === acc.code ? 'bg-blue-50 border-blue-600' : 'bg-gray-50 border-gray-200'
                                            }`}
                                        >
                                            <View>
                                                <Text className={`font-bold text-sm ${value === acc.code ? 'text-blue-900' : 'text-gray-900'}`}>
                                                    {acc.code} — {acc.name}
                                                </Text>
                                            </View>
                                            {value === acc.code && <MaterialIcons name="check-circle" size={20} color="#1E3A8A" />}
                                        </Pressable>
                                    ))}
                                </View>
                            )}
                        />
                        {errors.sourceAccountCode && <Text className="text-red-500 text-xs mt-1">{errors.sourceAccountCode.message}</Text>}
                    </View>

                    {/* Target Account Selection */}
                    <View className="mb-6">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">To (Target Account)</Text>
                        <Controller
                            control={control}
                            name="targetAccountCode"
                            render={({ field: { onChange, value } }) => (
                                <View className="gap-2">
                                    {TRANSFER_ACCOUNTS.map(acc => (
                                        <Pressable
                                            key={acc.code}
                                            onPress={() => onChange(acc.code)}
                                            className={`p-4 rounded-2xl border flex-row justify-between items-center ${
                                                value === acc.code ? 'bg-green-50 border-green-600' : 'bg-gray-50 border-gray-200'
                                            }`}
                                        >
                                            <View>
                                                <Text className={`font-bold text-sm ${value === acc.code ? 'text-green-900' : 'text-gray-900'}`}>
                                                    {acc.code} — {acc.name}
                                                </Text>
                                            </View>
                                            {value === acc.code && <MaterialIcons name="check-circle" size={20} color="#16A34A" />}
                                        </Pressable>
                                    ))}
                                </View>
                            )}
                        />
                        {errors.targetAccountCode && <Text className="text-red-500 text-xs mt-1">{errors.targetAccountCode.message}</Text>}
                    </View>

                    {/* Amount */}
                    <View className="mb-6">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Transfer Amount (₱) *</Text>
                        <Controller
                            control={control}
                            name="amount"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className={`bg-gray-50 p-4 rounded-2xl border ${errors.amount ? 'border-red-500' : 'border-gray-200'} text-gray-900 font-black text-2xl`}
                                    value={value}
                                    onChangeText={onChange}
                                    keyboardType="numeric"
                                    placeholder="0.00"
                                    editable={!saving}
                                    placeholderTextColor="#9CA3AF"
                                />
                            )}
                        />
                        {errors.amount && <Text className="text-red-500 text-xs mt-1">{errors.amount.message}</Text>}
                    </View>

                    {/* Description */}
                    <View className="mb-8">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Description / Reference *</Text>
                        <Controller
                            control={control}
                            name="description"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className={`bg-gray-50 p-4 rounded-2xl border ${errors.description ? 'border-red-500' : 'border-gray-200'} text-gray-900`}
                                    value={value}
                                    onChangeText={onChange}
                                    placeholder="Reason for transfer (e.g. COH to Petty Cash replenishment, Bank withdrawal)"
                                    editable={!saving}
                                    placeholderTextColor="#9CA3AF"
                                />
                            )}
                        />
                        {errors.description && <Text className="text-red-500 text-xs mt-1">{errors.description.message}</Text>}
                    </View>

                    <Pressable
                        className={`w-full py-4 rounded-2xl items-center flex-row justify-center shadow-lg ${saving ? 'bg-blue-400' : 'bg-blue-900 active:bg-blue-950'}`}
                        onPress={handleSubmit(onSubmit)}
                        disabled={saving}
                    >
                        {saving ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <MaterialIcons name="swap-horiz" size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
                                <Text className="text-white font-black text-lg uppercase tracking-wider">Execute Transfer</Text>
                            </>
                        )}
                    </Pressable>
                </View>
            ) : (
                /* TRANSFER HISTORY & USER TRACING */
                <View>
                    {/* Search & Stats */}
                    <View className="bg-white rounded-2xl p-3 border border-gray-200 mb-4 flex-row items-center shadow-sm">
                        <MaterialIcons name="search" size={20} color="#9CA3AF" />
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search transfers by account, ref #, or operator..."
                            placeholderTextColor="#9CA3AF"
                            className="flex-1 ml-2 text-sm text-gray-900"
                        />
                    </View>

                    {loadingHistory ? (
                        <View className="py-16 items-center justify-center">
                            <ActivityIndicator size="large" color="#1E3A8A" />
                            <Text className="text-gray-500 text-sm mt-3 font-semibold">Loading transfer audit records...</Text>
                        </View>
                    ) : filteredHistory.length === 0 ? (
                        <View className="bg-white rounded-3xl p-8 items-center justify-center border border-gray-150">
                            <MaterialIcons name="history" size={48} color="#CBD5E1" />
                            <Text className="text-gray-700 font-bold text-base mt-3">No Fund Transfers Found</Text>
                            <Text className="text-gray-500 text-xs text-center mt-1">
                                {searchQuery ? 'Try adjusting your search criteria.' : 'Recorded transfers between cash drawers and banks will appear here.'}
                            </Text>
                        </View>
                    ) : (
                        <View className="gap-3 mb-8">
                            {filteredHistory.map((item) => (
                                <View
                                    key={item.id}
                                    className="bg-white p-5 rounded-3xl border border-gray-150 shadow-sm"
                                >
                                    {/* Top Row: Ref # and Date */}
                                    <View className="flex-row justify-between items-center mb-2">
                                        <View className="bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                                            <Text className="text-blue-900 font-black text-xs">
                                                {item.referenceNumber}
                                            </Text>
                                        </View>
                                        <Text className="text-gray-400 text-xs font-semibold">
                                            {formatDateTime(item.entryDate)}
                                        </Text>
                                    </View>

                                    {/* Amount & Routing */}
                                    <View className="my-2">
                                        <Text className="text-2xl font-black text-emerald-700">
                                            {formatPHP(item.amount)}
                                        </Text>
                                        <View className="flex-row items-center mt-2 flex-wrap">
                                            <View className="bg-gray-100 px-2.5 py-1 rounded-lg mr-2">
                                                <Text className="text-gray-800 font-bold text-xs">
                                                    {item.sourceAccountCode} {item.sourceAccountName ? `(${item.sourceAccountName})` : ''}
                                                </Text>
                                            </View>
                                            <MaterialIcons name="arrow-forward" size={16} color="#64748B" style={{ marginRight: 8 }} />
                                            <View className="bg-emerald-50 px-2.5 py-1 rounded-lg">
                                                <Text className="text-emerald-800 font-bold text-xs">
                                                    {item.targetAccountCode} {item.targetAccountName ? `(${item.targetAccountName})` : ''}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Description */}
                                    <Text className="text-gray-600 text-xs mt-2 italic">
                                        "{item.description}"
                                    </Text>

                                    {/* User Tracing Footer */}
                                    <View className="mt-4 pt-3 border-t border-gray-100 flex-row items-center justify-between">
                                        <View className="flex-row items-center">
                                            <View className="w-6 h-6 rounded-full bg-indigo-100 items-center justify-center mr-2">
                                                <MaterialIcons name="person" size={14} color="#4338CA" />
                                            </View>
                                            <Text className="text-xs text-gray-700 font-medium">
                                                Transferred by:{' '}
                                                <Text className="font-bold text-gray-900">
                                                    {item.operatorName || 'System'}
                                                </Text>
                                            </Text>
                                        </View>
                                        {item.operatorRole && (
                                            <View className="bg-purple-50 px-2 py-0.5 rounded-md">
                                                <Text className="text-[10px] font-bold text-purple-700 uppercase">
                                                    {item.operatorRole}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}
        </ScrollView>
    );
}
