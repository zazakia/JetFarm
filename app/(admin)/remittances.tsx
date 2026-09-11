import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, SafeAreaView, StatusBar, RefreshControl, Platform } from 'react-native';
import { database } from '../../src/database';
import Remittance from '../../src/database/models/Remittance';
import UserProfile from '../../src/database/models/UserProfile';
import { useAuth } from '../../src/store/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../../src/utils/currency';
import { Q } from '@nozbe/watermelondb';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { safeBack } from '../../src/utils/navigation';

import { CashService } from '../../src/services/CashService';

export default function AdminRemittanceReviewScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pendingRemittances, setPendingRemittances] = useState<any[]>([]);
    const [currentBalance, setCurrentBalance] = useState(0);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const loadRemittances = async () => {
        try {
            const pending = await database.collections.get<Remittance>('remittances')
                .query(
                    Q.where('status', 'pending'),
                    Q.where('deleted_at', Q.eq(null)),
                    Q.sortBy('remittance_date', Q.desc)
                ).fetch();

            const collectorIds = Array.from(new Set(pending.map(r => r.collectorId)));
            const collectors = await database.collections.get<UserProfile>('user_profiles')
                .query(Q.where('id', Q.oneOf(collectorIds)))
                .fetch();

            const mapped = pending.map(remit => ({
                ...remit,
                collector: collectors.find(c => c.id === remit.collectorId),
                _model: remit // keep reference to original model for updates
            }));

            setPendingRemittances(mapped);
            
            // Also load current admin balance
            const bal = await CashService.getCurrentBalance();
            setCurrentBalance(bal);
        } catch (error) {
            console.error('Failed to load pending remittances', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadRemittances();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadRemittances();
    };

    const handleAction = async (item: any, status: 'approved' | 'rejected') => {
        setProcessingId(item.id);
        try {
            await database.write(async () => {
                await item._model.update((r: Remittance) => {
                    r.status = status;
                    r.approvedBy = user?.id || '';
                });
            });
            if (Platform.OS === 'web') {
                window.alert(`Remittance ${status}.`);
            } else {
                Alert.alert("Success", `Remittance ${status}.`);
            }
            setPendingRemittances(prev => prev.filter(p => p.id !== item.id));
        } catch (error) {
            console.error(`Failed to ${status} remittance`, error);
            if (Platform.OS === 'web') {
                window.alert(`Action failed.`);
            } else {
                Alert.alert("Error", `Action failed.`);
            }
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return <View className="flex-1 justify-center items-center bg-slate-50"><ActivityIndicator size="large" color="#0D9488" /></View>;

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <StatusBar barStyle="light-content" />
            <ScrollView className="flex-1"  
                 
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF"  />}
            >
                <LinearGradient
                    colors={['#1E293B', '#0F172A']}
                    className="pt-12 pb-20 px-6 rounded-b-[40px] shadow-lg"
                >
                    <Pressable 
                        onPress={() => safeBack(router, '/(admin)')} 
                        className="bg-white/10 w-10 h-10 rounded-2xl items-center justify-center mb-6"
                    >
                        <MaterialIcons name="arrow-back" size={24} color="#FFF" />
                    </Pressable>
                    <Text className="text-slate-700 text-xs font-bold uppercase tracking-[3px]">Financial Audit</Text>
                    <Text className="text-white text-3xl font-black mt-1">Pending Remittances</Text>
                </LinearGradient>

                <View className="px-6 -mt-10 pb-20">
                    {/* Summary Cards */}
                    <View className="flex-row gap-4 mb-6">
                        <View className="flex-1 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                            <Text className="text-gray-700 text-[10px] font-bold uppercase tracking-wider mb-1">Cash In Box</Text>
                            <Text className="text-lg font-black text-gray-900">{formatPHP(currentBalance)}</Text>
                        </View>
                        <View className="flex-1 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                            <Text className="text-gray-700 text-[10px] font-bold uppercase tracking-wider mb-1">Pending Total</Text>
                            <Text className="text-lg font-black text-orange-600">
                                {formatPHP(pendingRemittances.reduce((s, r) => s + (r.amount || 0), 0))}
                            </Text>
                        </View>
                    </View>

                    {pendingRemittances.length === 0 ? (
                        <View className="bg-white p-12 rounded-[32px] items-center border border-gray-100 shadow-sm mt-4">
                            <MaterialIcons name="check-circle-outline" size={64} color="#0D9488" />
                            <Text className="text-gray-900 font-black text-xl mt-6">No Pending Reviews</Text>
                            <Text className="text-gray-700 text-sm text-center mt-2 px-6">
                                All cash handovers have been processed.
                            </Text>
                        </View>
                    ) : (
                        pendingRemittances.map((item) => (
                            <View key={item.id} className="bg-white p-6 rounded-3xl shadow-sm mb-4 border border-gray-50">
                                <View className="flex-row items-center mb-4">
                                    <View className="w-12 h-12 bg-slate-100 rounded-2xl items-center justify-center mr-4">
                                        <MaterialIcons name="person" size={24} color="#475569" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-black text-lg">{item.collector?.fullName || 'Unknown Collector'}</Text>
                                        <Text className="text-gray-700 text-[10px] font-bold uppercase tracking-wider">
                                            {new Date(item.remittanceDate).toLocaleString()}
                                        </Text>
                                    </View>
                                    <Text className="text-gray-900 font-black text-xl text-right">{formatPHP(item.amount)}</Text>
                                </View>

                                {item.notes && (
                                    <View className="bg-slate-50 p-3 rounded-xl mb-6 border border-slate-100">
                                        <Text className="text-slate-700 text-xs italic">“{item.notes}”</Text>
                                    </View>
                                )}

                                <View className="flex-row gap-3">
                                    <Pressable
                                        onPress={() => handleAction(item, 'rejected')}
                                        disabled={processingId === item.id}
                                        className="flex-1 p-4 rounded-2xl bg-red-50 border border-red-100 items-center justify-center"
                                    >
                                        <Text className="text-red-700 font-black uppercase text-xs">Reject</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => handleAction(item, 'approved')}
                                        disabled={processingId === item.id}
                                        className="flex-[2] p-4 rounded-2xl bg-teal-600 items-center justify-center shadow-lg shadow-teal-600/20"
                                    >
                                        {processingId === item.id ? (
                                            <ActivityIndicator size="small" color="#FFF" />
                                        ) : (
                                            <Text className="text-white font-black uppercase text-xs tracking-widest">Approve Cash</Text>
                                        )}
                                    </Pressable>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
