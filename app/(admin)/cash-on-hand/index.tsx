import React, { useState, useCallback } from 'react';
import {
    View, Text, FlatList, Pressable, ActivityIndicator,
    Modal, ScrollView, TouchableOpacity, TouchableWithoutFeedback,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import CashTransaction from '../../../src/database/models/CashTransaction';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../../../src/utils/currency';
import { formatDate } from '../../../src/utils/dates';
import { CashService, BalanceBreakdown, BreakdownCategory } from '../../../src/services/CashService';

// ─── Category Row ────────────────────────────────────────────────────────────

function CategoryRow({ cat }: { cat: BreakdownCategory }) {
    const [expanded, setExpanded] = useState(false);
    const isPositive = cat.sign === '+';
    const accent = isPositive ? '#16A34A' : '#DC2626';
    const bgAccent = isPositive ? '#F0FDF4' : '#FFF1F2';
    const borderAccent = isPositive ? '#BBF7D0' : '#FECDD3';

    return (
        <View className="mb-2">
            <Pressable
                onPress={() => setExpanded(v => !v)}
                style={{ backgroundColor: bgAccent, borderColor: borderAccent }}
                className="flex-row items-center px-4 py-3 rounded-2xl border"
            >
                {/* Sign badge */}
                <View
                    style={{ backgroundColor: isPositive ? '#DCFCE7' : '#FFE4E6' }}
                    className="w-8 h-8 rounded-full items-center justify-center mr-3"
                >
                    <Text style={{ color: accent }} className="text-base font-black leading-none">
                        {cat.sign}
                    </Text>
                </View>

                {/* Label + count */}
                <View className="flex-1">
                    <Text className="text-sm font-extrabold text-gray-900">{cat.label}</Text>
                    <Text className="text-[10px] text-gray-500 mt-0.5">
                        {cat.items.length} transaction{cat.items.length !== 1 ? 's' : ''}
                    </Text>
                </View>

                {/* Total + chevron */}
                <View className="items-end ml-2">
                    <Text style={{ color: accent }} className="text-sm font-black">
                        {cat.sign}{formatPHP(cat.total)}
                    </Text>
                    <MaterialIcons
                        name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                        size={16}
                        color="#9CA3AF"
                        style={{ marginTop: 2 }}
                    />
                </View>
            </Pressable>

            {/* Expanded items */}
            {expanded && (
                <View className="mx-2 mt-1 mb-2 bg-white border border-gray-100 rounded-2xl overflow-hidden">
                    {cat.items.length === 0 ? (
                        <View className="py-4 items-center">
                            <Text className="text-xs text-gray-400 italic">No transactions</Text>
                        </View>
                    ) : (
                        cat.items.map((item, idx) => (
                            <View
                                key={item.id}
                                className={`flex-row items-center px-4 py-3 ${idx < cat.items.length - 1 ? 'border-b border-gray-50' : ''}`}
                            >
                                <View className="flex-1 pr-2">
                                    <Text className="text-xs font-bold text-gray-800" numberOfLines={1}>{item.label}</Text>
                                    <Text className="text-[10px] text-gray-400 mt-0.5">
                                        {item.date ? formatDate(new Date(item.date)) : '—'}
                                    </Text>
                                </View>
                                <Text style={{ color: accent }} className="text-xs font-extrabold">
                                    {formatPHP(item.amount)}
                                </Text>
                            </View>
                        ))
                    )}
                </View>
            )}
        </View>
    );
}

// ─── Breakdown Modal ──────────────────────────────────────────────────────────

function BreakdownModal({
    visible,
    breakdown,
    loading,
    onClose,
}: {
    visible: boolean;
    breakdown: BalanceBreakdown | null;
    loading: boolean;
    onClose: () => void;
}) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View className="flex-1 bg-black/40 justify-end" />
            </TouchableWithoutFeedback>

            {/* Sheet */}
            <View className="bg-gray-50 rounded-t-[32px] max-h-[85%]" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                {/* Handle */}
                <View className="items-center pt-3 pb-1">
                    <View className="w-10 h-1 bg-gray-300 rounded-full" />
                </View>

                {/* Header */}
                <View className="flex-row items-center justify-between px-5 py-3 border-b border-gray-100">
                    <View>
                        <Text className="text-lg font-black text-gray-900">Balance Breakdown</Text>
                        <Text className="text-[10px] text-gray-500 uppercase tracking-widest">Tap a category to see transactions</Text>
                    </View>
                    <Pressable onPress={onClose} className="w-9 h-9 bg-gray-100 rounded-full items-center justify-center active:bg-gray-200">
                        <MaterialIcons name="close" size={18} color="#374151" />
                    </Pressable>
                </View>

                {/* Balance total pill */}
                {breakdown && (
                    <View className="mx-5 mt-4 mb-2 bg-sky-700 rounded-2xl px-5 py-4 flex-row justify-between items-center">
                        <Text className="text-sky-100 text-xs font-bold uppercase tracking-widest">Total Balance</Text>
                        <Text className="text-white text-xl font-black">{formatPHP(breakdown.balance)}</Text>
                    </View>
                )}

                {loading ? (
                    <View className="py-16 items-center">
                        <ActivityIndicator size="large" color="#0288D1" />
                        <Text className="text-gray-400 text-xs mt-3">Loading breakdown…</Text>
                    </View>
                ) : (
                    <ScrollView
                        className="px-4 pt-2 pb-6"
                        contentContainerStyle={{ paddingBottom: 32 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {breakdown?.categories
                            .filter(cat => cat.total > 0 || cat.items.length > 0)
                            .map(cat => (
                                <CategoryRow key={cat.key} cat={cat} />
                            ))}
                    </ScrollView>
                )}
            </View>
        </Modal>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CashOnHandScreen() {
    const router = useRouter();
    const [txns, setTxns] = useState<CashTransaction[]>([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);

    // Breakdown modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [breakdown, setBreakdown] = useState<BalanceBreakdown | null>(null);
    const [breakdownLoading, setBreakdownLoading] = useState(false);

    const loadData = async () => {
        try {
            const fetched = await database.collections.get<CashTransaction>('cash_transactions').query(Q.sortBy('transaction_date', Q.desc)).fetch();
            const currentBal = await CashService.getCurrentBalance();
            setTxns(fetched);
            setBalance(currentBal);
        } catch (error) {
            console.error('Failed to load cash data:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const handleBalancePress = async () => {
        setModalVisible(true);
        if (!breakdown) {
            setBreakdownLoading(true);
            try {
                const bd = await CashService.getBalanceBreakdown();
                setBreakdown(bd);
            } catch (e) {
                console.error('Failed to load breakdown:', e);
            } finally {
                setBreakdownLoading(false);
            }
        }
    };

    const renderItem = ({ item }: { item: CashTransaction }) => (
        <View className="bg-white p-4 rounded-2xl mb-3 border border-gray-100 shadow-sm flex-row items-center">
            <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${item.type === 'in' || item.type === 'starting_balance' ? 'bg-green-50' : 'bg-red-50'
                }`}>
                <MaterialIcons
                    name={item.type === 'in' || item.type === 'starting_balance' ? 'add' : 'remove'}
                    size={24}
                    color={item.type === 'in' || item.type === 'starting_balance' ? '#EAB308' : '#D32F2F'}
                />
            </View>
            <View className="flex-1">
                <Text className="text-base font-bold text-gray-900">{item.particulars}</Text>
                <Text className="text-xs text-gray-700 mt-1">
                    {item.type === 'in' ? 'TRANSFER IN' : item.type === 'out' ? 'TRANSFER OUT' : item.type.replace('_', ' ').toUpperCase()} • {formatDate(new Date(item.transactionDate))}
                </Text>
            </View>
            <View className="items-end pl-2">
                <Text className={`text-sm font-extrabold ${item.type === 'in' || item.type === 'starting_balance' ? 'text-green-700' : 'text-red-700'
                    }`}>
                    {item.type === 'in' || item.type === 'starting_balance' ? '+' : '-'}{formatPHP(item.amount)}
                </Text>
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-gray-50">
            {/* Balance header — tappable */}
            <Pressable
                onPress={handleBalancePress}
                className="bg-sky-700 p-8 pb-12 rounded-b-[40px] shadow-lg mb-6 items-center active:bg-sky-800"
            >
                <Text className="text-sky-100 text-sm font-bold uppercase tracking-widest mb-2">Current Cash Box Balance</Text>
                <Text className="text-4xl font-black text-white tracking-tighter">{formatPHP(balance)}</Text>
                <View className="flex-row items-center mt-3 bg-white/20 px-4 py-1.5 rounded-full">
                    <MaterialIcons name="bar-chart" size={14} color="#BAE6FD" />
                    <Text className="text-sky-100 text-[11px] font-bold ml-1.5">Tap to see breakdown</Text>
                </View>
            </Pressable>

            {/* Actions */}
            <View className="px-6 -mt-10 mb-6 flex-row gap-4">
                <Pressable
                    onPress={() => router.push('/(admin)/cash-on-hand/reconcile')}
                    className="flex-1 bg-white rounded-3xl p-5 border border-sky-50 shadow-sm items-center active:bg-sky-50"
                >
                    <View className="w-12 h-12 bg-sky-100 rounded-full items-center justify-center mb-2">
                        <MaterialIcons name="fact-check" size={24} color="#0288D1" />
                    </View>
                    <Text className="text-gray-900 font-bold text-sm">Reconcile Vault</Text>
                    <Text className="text-gray-500 text-[10px] text-center mt-1">Recount vault cash</Text>
                </Pressable>
            </View>

            <View className="flex-1 px-4">
                <View className="flex-row justify-between items-center mb-4 px-2">
                    <Text className="text-lg font-extrabold text-gray-900">Manual Adjustments</Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#0288D1" className="mt-10" />
                ) : (
                    <FlatList
                        data={txns}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        ListEmptyComponent={
                            <View className="items-center justify-center py-20">
                                <MaterialIcons name="account-balance-wallet" size={64} color="#E5E7EB" />
                                <Text className="text-gray-700 font-medium mt-4 text-base">No manual transactions</Text>
                            </View>
                        }
                    />
                )}
            </View>

            {/* FAB */}
            <Pressable
                className="absolute bottom-6 right-6 flex-row items-center bg-sky-700 px-6 py-4 rounded-full shadow-xl active:bg-sky-800"
                onPress={() => router.push('/(admin)/cash-on-hand/new')}
            >
                <MaterialIcons name="add" size={24} color="#FFFFFF" className="mr-2" />
                <Text className="text-white font-black uppercase tracking-wider">Add Cash Entry</Text>
            </Pressable>

            {/* Breakdown Modal */}
            <BreakdownModal
                visible={modalVisible}
                breakdown={breakdown}
                loading={breakdownLoading}
                onClose={() => setModalVisible(false)}
            />
        </View>
    );
}
