import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import Loan from '../../../src/database/models/Loan';
import Borrower from '../../../src/database/models/Borrower';
import { formatPHP } from '../../../src/utils/currency';
import { MetricBreakdownDialog, BreakdownItem } from '../../../src/components/MetricBreakdownDialog';

type DelinquentRow = {
    loan: Loan;
    borrowerName: string;
    borrowerId: string;
    overdueDays: number;
};

export default function DelinquentAccountsScreen() {
    const router = useRouter();
    const [rows, setRows] = useState<DelinquentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [breakdownVisible, setBreakdownVisible] = useState(false);
    const [breakdownData, setBreakdownData] = useState<{ title: string; total: number; items: BreakdownItem[]; color: string }>({
        title: '', total: 0, items: [], color: 'text-red-700'
    });

    const handleHeaderTotalClick = () => {
        const items: BreakdownItem[] = rows.map(r => ({
            id: r.loan.id,
            label: r.borrowerName,
            sublabel: `${r.overdueDays} days overdue • Loan #${r.loan.loanNumber || r.loan.id.slice(0, 8)}`,
            value: r.loan.totalAmount,
            isCurrency: true,
            onPress: () => {
                setBreakdownVisible(false);
                if (r.borrowerId) router.push(`/(admin)/borrowers/${r.borrowerId}`);
            }
        }));

        const totalVal = rows.reduce((s, r) => s + r.loan.totalAmount, 0);

        setBreakdownData({
            title: 'Delinquent & Severely Overdue Accounts',
            total: totalVal,
            items,
            color: 'text-red-700',
        });
        setBreakdownVisible(true);
    };

    const load = async () => {
        try {
            const today = Date.now();
            const loans = await database.collections.get<Loan>('loans').query(
                Q.where('deleted_at', Q.eq(null)),
                Q.where('status', Q.oneOf(['active', 'defaulted'])),
            ).fetch();

            // Delinquent = is_delinquent flag OR overdue > 60 days
            const delinquent = loans.filter(l => {
                if (l.isDelinquent) return true;
                const maturity = l.maturityDate ? Number(l.maturityDate) : null;
                if (!maturity) return false;
                const daysPast = (today - maturity) / 86400000;
                return daysPast > 60;
            });

            const borrowerIds = Array.from(new Set(delinquent.map(l => l.borrowerId)));
            const borrowers = borrowerIds.length
                ? await database.collections.get<Borrower>('borrowers').query(Q.where('id', Q.oneOf(borrowerIds))).fetch()
                : [];
            const bMap = new Map(borrowers.map(b => [b.id, b]));

            const result: DelinquentRow[] = delinquent.map(loan => {
                const maturity = loan.maturityDate ? Number(loan.maturityDate) : today;
                const overdueDays = Math.max(0, Math.floor((today - maturity) / 86400000));
                return {
                    loan,
                    borrowerName: bMap.get(loan.borrowerId)?.fullName ?? 'Unknown',
                    borrowerId: loan.borrowerId,
                    overdueDays,
                };
            }).sort((a, b) => b.overdueDays - a.overdueDays);

            setRows(result);
        } catch (e) {
            console.error('[DelinquentAccounts] load error:', e);
            Alert.alert('Error', 'Failed to load delinquent accounts.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { load(); }, []));

    const markDelinquent = async (loan: Loan) => {
        try {
            await database.write(async () => {
                await loan.update(l => {
                    (l as any).isDelinquent = true;
                    (l as any).delinquentSince = Date.now();
                    l.status = 'defaulted';
                });
            });
            load();
        } catch (e) {
            Alert.alert('Error', 'Failed to mark as delinquent.');
        }
    };

    const clearDelinquent = async (loan: Loan) => {
        try {
            await database.write(async () => {
                await loan.update(l => {
                    (l as any).isDelinquent = false;
                    (l as any).delinquentSince = null;
                    l.status = 'active';
                });
            });
            load();
        } catch (e) {
            Alert.alert('Error', 'Failed to clear delinquent flag.');
        }
    };

    if (loading) return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;

    return (
        <View className="flex-1 bg-gray-50 p-4">
            <Pressable onPress={handleHeaderTotalClick} className="bg-white p-5 rounded-3xl border border-gray-100 mb-4 active:bg-gray-50">
                <Text className="text-2xl font-black text-gray-900">Delinquent Accounts</Text>
                <Text className="text-gray-700 mt-1">Accounts overdue more than 60 days or flagged as delinquent.</Text>
                <Text className="font-black text-red-700 mt-2">{rows.length} account{rows.length !== 1 ? 's' : ''} • Tap for breakdown</Text>
            </Pressable>

            <FlatList
                data={rows}
                keyExtractor={item => item.loan.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListEmptyComponent={
                    <View className="items-center justify-center py-20">
                        <MaterialIcons name="check-circle" size={64} color="#E5E7EB" />
                        <Text className="text-gray-500 mt-4">No delinquent accounts</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View className="bg-white rounded-2xl p-4 mb-3 border border-red-100">
                        <View className="flex-row justify-between items-start">
                            <Pressable onPress={() => router.push(`/(admin)/borrowers/${item.borrowerId}`)}>
                                <Text className="font-black text-blue-700 text-base underline">{item.borrowerName}</Text>
                            </Pressable>
                            <View className="bg-red-100 px-2 py-1 rounded">
                                <Text className="text-[10px] font-black text-red-800 uppercase">
                                    {item.loan.isDelinquent ? 'Delinquent' : 'Overdue'}
                                </Text>
                            </View>
                        </View>
                        <Text className="text-xs text-gray-700 mt-1">{item.loan.loanNumber}</Text>
                        <View className="flex-row justify-between mt-2">
                            <View>
                                <Text className="text-[10px] text-gray-500 uppercase font-bold">Balance</Text>
                                <Text className="font-extrabold text-red-700">{formatPHP(item.loan.totalAmount)}</Text>
                            </View>
                            <View>
                                <Text className="text-[10px] text-gray-500 uppercase font-bold">Days Overdue</Text>
                                <Text className="font-extrabold text-red-700">{item.overdueDays}d</Text>
                            </View>
                        </View>
                        <View className="flex-row mt-3 gap-2">
                            {!item.loan.isDelinquent ? (
                                <Pressable
                                    className="flex-1 bg-red-600 rounded-xl py-2 items-center"
                                    onPress={() => {
                                        if (Platform.OS === 'web') {
                                            if (window.confirm('Mark this account as delinquent?')) markDelinquent(item.loan);
                                        } else {
                                            Alert.alert('Mark Delinquent', 'Flag this account as delinquent?', [
                                                { text: 'Cancel', style: 'cancel' },
                                                { text: 'Confirm', onPress: () => markDelinquent(item.loan) },
                                            ]);
                                        }
                                    }}
                                >
                                    <Text className="text-white font-bold text-xs">Mark Delinquent</Text>
                                </Pressable>
                            ) : (
                                <Pressable
                                    className="flex-1 bg-green-600 rounded-xl py-2 items-center"
                                    onPress={() => clearDelinquent(item.loan)}
                                >
                                    <Text className="text-white font-bold text-xs">Clear Flag</Text>
                                </Pressable>
                            )}
                            <Pressable
                                className="flex-1 bg-gray-800 rounded-xl py-2 items-center"
                                onPress={() => router.push(`/(admin)/loans/${item.loan.id}`)}
                            >
                                <Text className="text-white font-bold text-xs">View Loan</Text>
                            </Pressable>
                        </View>
                    </View>
                )}
            />
            <MetricBreakdownDialog
                visible={breakdownVisible}
                onClose={() => setBreakdownVisible(false)}
                {...breakdownData}
            />
        </View>
    );
}
