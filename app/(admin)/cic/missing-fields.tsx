import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { CicSchedulerService } from '../../../src/services/cic/CicSchedulerService';

export default function MissingCicFieldsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [notifying, setNotifying] = useState(false);
    const [report, setReport] = useState<any[]>([]);

    useEffect(() => {
        loadReport();
    }, []);

    const loadReport = async () => {
        setLoading(true);
        try {
            const data = await CicSchedulerService.getMissingFieldsReport();
            setReport(data);
        } catch (error) {
            console.error('Failed to load missing fields report', error);
            Alert.alert('Error', 'Failed to load report.');
        } finally {
            setLoading(false);
        }
    };

    const handleNotify = async () => {
        if (report.length === 0) {
            Alert.alert('No Missing Fields', 'All borrowers have complete CIC data.');
            return;
        }

        setNotifying(true);
        try {
            const result = await CicSchedulerService.notifyEncodersAboutMissingFields(report);
            if (Platform.OS === 'web') {
                window.alert(result.message);
            } else {
                Alert.alert(result.success ? 'Success' : 'Error', result.message);
            }
        } catch (error) {
            console.error('Notification failed', error);
            Alert.alert('Error', 'Failed to send notifications.');
        } finally {
            setNotifying(false);
        }
    };

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: "Missing CIC Fields",
                    headerLeft: () => (
                        <Pressable onPress={() => safeBack(router, '/(admin)/cic')} className="mr-4 p-2 rounded-full active:bg-gray-100">
                            <MaterialIcons name="arrow-back" size={24} color="#111827" />
                        </Pressable>
                    ),
                }}
            />

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
                <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm mb-6">
                    <Text className="text-xl font-black text-gray-900 mb-2">Data Quality Report</Text>
                    <Text className="text-sm text-gray-600 mb-6">
                        This report identifies borrowers with incomplete demographic or identification data required for Credit Information Corporation (CIC) reporting.
                    </Text>

                    <View className="flex-row items-center justify-between bg-orange-50 p-4 rounded-2xl border border-orange-100 mb-6">
                        <View className="flex-row items-center flex-1">
                            <MaterialIcons name="warning-amber" size={32} color="#C2410C" />
                            <View className="ml-3">
                                <Text className="text-orange-900 font-bold text-lg">{report.length} Borrowers</Text>
                                <Text className="text-orange-800 text-xs font-medium uppercase tracking-wider">With Incomplete Profiles</Text>
                            </View>
                        </View>
                        <Pressable
                            onPress={handleNotify}
                            disabled={notifying || loading || report.length === 0}
                            className={`px-5 py-3 rounded-xl flex-row items-center justify-center ${notifying || report.length === 0 ? 'bg-orange-300' : 'bg-orange-600 active:bg-orange-700'}`}
                        >
                            {notifying ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <MaterialIcons name="notifications-active" size={18} color="#fff" className="mr-2" />
                                    <Text className="text-white font-bold">Notify Encoders</Text>
                                </>
                            )}
                        </Pressable>
                    </View>

                    <View className="bg-blue-50 p-4 rounded-xl mb-4 border border-blue-100 flex-row">
                        <MaterialIcons name="info-outline" size={20} color="#1D4ED8" />
                        <Text className="text-blue-800 text-xs ml-2 flex-1">
                            Notifying encoders will send an automated push notification and email summary to the responsible staff to complete these records.
                        </Text>
                    </View>

                </View>

                {loading ? (
                    <View className="py-10 items-center justify-center">
                        <ActivityIndicator size="large" color="#4F46E5" />
                        <Text className="text-gray-500 mt-4 font-medium uppercase text-xs tracking-widest">Scanning Database...</Text>
                    </View>
                ) : report.length === 0 ? (
                    <View className="items-center justify-center py-10 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <MaterialIcons name="check-circle-outline" size={64} color="#10B981" />
                        <Text className="text-lg font-bold text-gray-900 mt-4">All Profiles Complete</Text>
                        <Text className="text-gray-500 text-center mt-2 mx-8">
                            Great job! No borrowers are missing required CIC fields at this time.
                        </Text>
                    </View>
                ) : (
                    <View className="space-y-4">
                        {report.map((b, index) => (
                            <Pressable 
                                key={b.borrower_id}
                                onPress={() => router.push(`/(admin)/borrowers/${b.borrower_id}`)}
                                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50 flex-row items-center"
                            >
                                <View className="bg-red-50 p-3 rounded-full mr-4">
                                    <MaterialIcons name="person-outline" size={24} color="#DC2626" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-bold text-gray-900 text-base">{b.name || 'Unnamed Borrower'}</Text>
                                    <Text className="text-xs text-gray-500 mb-2 uppercase font-medium tracking-wider">ID: {b.membership_number}</Text>
                                    <View className="flex-row flex-wrap">
                                        {b.missing_fields.map((field: string, i: number) => (
                                            <View key={i} className="bg-red-50 px-2 py-1 rounded border border-red-100 mr-2 mb-2">
                                                <Text className="text-red-700 text-[10px] font-bold uppercase">{field}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                                <MaterialIcons name="chevron-right" size={24} color="#D1D5DB" />
                            </Pressable>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
