import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { database } from '../../src/database';
import CollectionLog from '../../src/database/models/CollectionLog';
import Payment from '../../src/database/models/Payment';
import uuid from 'react-native-uuid';
import { Ionicons } from '@expo/vector-icons';
import { safeBack } from '../../src/utils/navigation';
import { DatePicker } from '../../src/components/DatePicker';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { useAuth } from '../../src/store/AuthContext';
import { Q } from '@nozbe/watermelondb';
import { formatPHP } from '../../src/utils/currency';

export default function DailyLogScreen() {
    const router = useRouter();
    const { user, sunlightMode } = useAuth();
    const [saving, setSaving] = useState(false);
    
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [cashStart, setCashStart] = useState('');
    const [cashEnd, setCashEnd] = useState('');
    const [notes, setNotes] = useState('');

    const [totalCollected, setTotalCollected] = useState(0);
    const [loadingStats, setLoadingStats] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            if (!user) return;
            setLoadingStats(true);
            try {
                const targetDate = parseISO(date);
                const start = startOfDay(targetDate).getTime();
                const end = endOfDay(targetDate).getTime();

                const payments = await database.get<Payment>('payments').query(
                    Q.where('deleted_at', Q.eq(null)),
                    Q.where('encoded_by', user.id),
                    Q.where('payment_date', Q.between(start, end))
                ).fetch();

                const total = payments.reduce((acc, p) => acc + p.amount, 0);
                setTotalCollected(total);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingStats(false);
            }
        };
        fetchStats();
    }, [date, user]);

    const handleSave = async () => {
        if (!user) {
            Alert.alert("Error", "You must be logged in.");
            return;
        }
        
        const startVal = parseFloat(cashStart);
        const endVal = parseFloat(cashEnd);

        if (isNaN(startVal) || startVal < 0) {
            Alert.alert("Validation", "Enter a valid starting cash amount.");
            return;
        }
        if (isNaN(endVal) || endVal < 0) {
            Alert.alert("Validation", "Enter a valid ending cash amount.");
            return;
        }

        setSaving(true);
        try {
            await database.write(async () => {
                await database.get<CollectionLog>('collection_logs').create(record => {
                    record._raw.id = uuid.v4().toString();
                    record.collectorId = user.id;
                    record.logDate = parseISO(date).getTime();
                    record.totalCollected = totalCollected;
                    record.cashOnHandStart = startVal;
                    record.cashOnHandEnd = endVal;
                    record.notes = notes.trim() || null;
                });
            });
            Alert.alert("Success", "Daily log submitted.");
            safeBack(router, '/(collector)');
        } catch (error) {
            console.error("Failed to save log", error);
            Alert.alert("Error", "Failed to submit log.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView className={`flex-1 ${sunlightMode ? 'bg-white' : 'bg-slate-50'}`}>
            <StatusBar barStyle={sunlightMode ? 'dark-content' : 'light-content'} />
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
                <View className="flex-row items-center mb-6">
                    <AnimatedPressable 
                        onPress={() => safeBack(router, '/(collector)')} 
                        className={`p-2.5 rounded-2xl mr-4 ${sunlightMode ? 'bg-black border-2 border-black' : 'bg-white shadow-sm border border-gray-50'}`}
                    >
                        <Ionicons name="arrow-back" size={24} color={sunlightMode ? '#FFF' : '#000'} />
                    </AnimatedPressable>
                    <View>
                        <Text className={`text-xl font-black ${sunlightMode ? 'text-black' : 'text-gray-900'}`}>Daily Log</Text>
                        <Text className={`text-sm ${sunlightMode ? 'text-black font-black uppercase text-[10px] mt-0.5' : 'text-gray-500 font-bold'}`}>Submit End-of-Day Summary</Text>
                    </View>
                </View>

                <View className={`p-6 rounded-[32px] border ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-white shadow-sm border-gray-100'}`}>
                    <View className="mb-4">
                        <Text className={`text-xs font-black mb-2 uppercase ${sunlightMode ? 'text-black' : 'text-gray-700'}`}>Date *</Text>
                        <DatePicker value={date} onChange={setDate} />
                    </View>

                    <View className={`mb-6 p-4 rounded-2xl border items-center ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-green-50 border-green-100'}`}>
                        <Text className={`text-xs font-black mb-1 uppercase tracking-wider ${sunlightMode ? 'text-black' : 'text-green-800'}`}>Total Collected Today</Text>
                        {loadingStats ? (
                            <ActivityIndicator size="small" color={sunlightMode ? '#000' : '#15803D'} />
                        ) : (
                            <Text className={`text-3xl font-black ${sunlightMode ? 'text-black' : 'text-green-900'}`}>{formatPHP(totalCollected)}</Text>
                        )}
                    </View>

                    <View className="mb-4">
                        <Text className={`text-xs font-black mb-2 uppercase ${sunlightMode ? 'text-black' : 'text-gray-700'}`}>Starting Cash on Hand (₱) *</Text>
                        <TextInput
                            className={`p-4 rounded-xl border font-bold ${sunlightMode ? 'bg-white border-4 border-black text-black' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                            value={cashStart} 
                            onChangeText={setCashStart} 
                            keyboardType="numeric" 
                            editable={!saving} 
                            placeholder="0.00"
                            placeholderTextColor={sunlightMode ? "#000" : "#9CA3AF"}
                        />
                    </View>

                    <View className="mb-4">
                        <Text className={`text-xs font-black mb-2 uppercase ${sunlightMode ? 'text-black' : 'text-gray-700'}`}>Ending Cash on Hand (₱) *</Text>
                        <TextInput
                            className={`p-4 rounded-xl border font-bold ${sunlightMode ? 'bg-white border-4 border-black text-black' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                            value={cashEnd} 
                            onChangeText={setCashEnd} 
                            keyboardType="numeric" 
                            editable={!saving} 
                            placeholder="0.00"
                            placeholderTextColor={sunlightMode ? "#000" : "#9CA3AF"}
                        />
                    </View>

                    <View className="mb-8">
                        <Text className={`text-xs font-black mb-2 uppercase ${sunlightMode ? 'text-black' : 'text-gray-700'}`}>Notes / Irregularities</Text>
                        <TextInput
                            className={`p-4 rounded-xl border font-bold h-24 ${sunlightMode ? 'bg-white border-4 border-black text-black' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                            value={notes} 
                            onChangeText={setNotes} 
                            editable={!saving} 
                            placeholder="Optional notes"
                            placeholderTextColor={sunlightMode ? "#000" : "#9CA3AF"}
                            multiline 
                            textAlignVertical="top"
                        />
                    </View>

                    <AnimatedPressable
                        className={`w-full py-4 rounded-2xl items-center justify-center border-2 ${
                            sunlightMode 
                                ? (saving ? 'bg-gray-200 border-gray-200' : 'bg-black border-black')
                                : (saving ? 'bg-green-400 border-green-400' : 'bg-blue-900 border-blue-900 active:bg-blue-800')
                        }`}
                        onPress={handleSave} 
                        disabled={saving}
                    >
                        {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black text-lg uppercase tracking-wider">Submit Log</Text>}
                    </AnimatedPressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
