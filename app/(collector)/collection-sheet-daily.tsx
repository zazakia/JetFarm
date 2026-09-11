import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, Pressable, ActivityIndicator,
    SafeAreaView, RefreshControl, Alert, Modal, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { database } from '../../src/database';
import Borrower from '../../src/database/models/Borrower';
import Loan from '../../src/database/models/Loan';
import PaymentSchedule from '../../src/database/models/PaymentSchedule';
import Collector from '../../src/database/models/Collector';
import { useAuth } from '../../src/store/AuthContext';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { formatPHP } from '../../src/utils/currency';
import { Q } from '@nozbe/watermelondb';
import { startOfDay, endOfDay, format } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInRight, FadeInUp, Layout } from 'react-native-reanimated';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { safeBack } from '../../src/utils/navigation';

interface ScheduleEntry {
    schedule: PaymentSchedule;
    borrower: Borrower;
    loan: Loan;
}

interface GroupedEntries {
    [group: string]: ScheduleEntry[];
}

export default function DailyCollectionSheet() {
    const router = useRouter();
    const { user, collectorId, sunlightMode } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [groupedEntries, setGroupedEntries] = useState<GroupedEntries>({});
    const [collectorName, setCollectorName] = useState('');
    const [totalDue, setTotalDue] = useState(0);
    const [printLoading, setPrintLoading] = useState(false);

    const today = new Date();
    const dateStr = format(today, 'EEEE, MMMM dd, yyyy');

    const fetchData = useCallback(async () => {
        if (!user) {
            console.log('[DailyCollectionSheet] No user yet, skipping fetch');
            setLoading(false);
            setRefreshing(false);
            return;
        }
        try {
            const currentCollectorId = collectorId || user.id;

            const collectorRecords = await database.collections.get<Collector>('collectors')
                .query(Q.where('auth_id', user.id))
                .fetch();
            
            const cName = collectorRecords.length > 0 ? collectorRecords[0].fullName : (user.email?.split('@')[0] || 'Collector');
            setCollectorName(cName);

            const start = startOfDay(today).getTime();
            const end = endOfDay(today).getTime();

            const assignedBorrowers = await database.collections.get<Borrower>('borrowers')
                .query(Q.where('collector_id', currentCollectorId))
                .fetch();

            if (assignedBorrowers.length === 0) {
                setGroupedEntries({});
                setTotalDue(0);
                return;
            }

            const borrowerIds = assignedBorrowers.map(b => b.id);
            const activeLoans = await database.collections.get<Loan>('loans')
                .query(Q.where('borrower_id', Q.oneOf(borrowerIds)), Q.where('status', 'active'))
                .fetch();

            const loanIds = activeLoans.map(l => l.id);
            if (loanIds.length === 0) {
                setGroupedEntries({});
                setTotalDue(0);
                return;
            }

            const todaySchedules = await database.collections.get<PaymentSchedule>('payment_schedules')
                .query(
                    Q.where('loan_id', Q.oneOf(loanIds)),
                    Q.where('due_date', Q.between(start, end)),
                    Q.where('status', Q.notEq('paid'))
                )
                .fetch();

            const borrowerMap = new Map(assignedBorrowers.map(b => [b.id, b]));
            const loanMap = new Map(activeLoans.map(l => [l.id, l]));

            const grouped: GroupedEntries = {};
            let total = 0;

            for (const schedule of todaySchedules) {
                const loan = loanMap.get(schedule.loanId);
                if (!loan) continue;
                const borrower = borrowerMap.get(loan.borrowerId);
                if (!borrower) continue;

                const group = borrower.group || 'Ungrouped';
                if (!grouped[group]) grouped[group] = [];
                grouped[group].push({ schedule, borrower, loan });
                total += schedule.scheduledAmount;
            }

            for (const g in grouped) {
                grouped[g].sort((a, b) => a.borrower.fullName.localeCompare(b.borrower.fullName));
            }

            setGroupedEntries(grouped);
            setTotalDue(total);
        } catch (err) {
            console.error('Daily sheet error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user, collectorId]);

    useEffect(() => { fetchData(); }, [fetchData, collectorId]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const generatePrintHtml = () => {
        const groups = Object.keys(groupedEntries).sort();
        let tableRows = '';
        let rowNum = 1;

        for (const group of groups) {
            const entries = groupedEntries[group];
            const groupTotal = entries.reduce((s, e) => s + e.schedule.scheduledAmount, 0);
            tableRows += `
                <tr class="group-header">
                    <td colspan="5">📍 ${group}</td>
                </tr>`;
            for (const entry of entries) {
                tableRows += `
                <tr>
                    <td class="center">${rowNum++}</td>
                    <td>${entry.borrower.fullName}</td>
                    <td>${entry.borrower.phone || '—'}</td>
                    <td class="right">₱${entry.schedule.scheduledAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td class="signature"></td>
                </tr>`;
            }
            tableRows += `
                <tr class="subtotal-row">
                    <td colspan="3" class="right"><strong>Group Total:</strong></td>
                    <td class="right"><strong>₱${groupTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td>
                    <td></td>
                </tr>`;
        }

        return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; padding: 15px; }
  .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 8px; }
  .header h1 { font-size: 16px; font-weight: bold; }
  .header h2 { font-size: 13px; margin-top: 4px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #222; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
  td { padding: 5px 8px; border-bottom: 1px solid #ddd; }
  .group-header { background: #e8f5e9; font-weight: bold; }
  .group-header td { padding: 6px 8px; }
  .subtotal-row td { background: #f5f5f5; border-top: 1px solid #bbb; }
  .center { text-align: center; }
  .right { text-align: right; }
  .signature { min-width: 80px; }
  .total-row { background: #1b5e20; color: white; font-weight: bold; font-size: 12px; }
  .total-row td { padding: 8px; }
  .footer { margin-top: 16px; font-size: 10px; text-align: center; color: #666; }
  .sig-block { margin-top: 40px; display: flex; justify-content: space-between; }
  .sig-line { border-top: 1px solid #000; width: 180px; text-align: center; padding-top: 4px; font-size: 10px; }
</style>
</head>
<body>
  <div class="header">
    <h1>DAILY COLLECTION SHEET</h1>
    <h2>${dateStr}</h2>
  </div>
  <div class="meta">
    <span><strong>Collector:</strong> ${collectorName}</span>
    <span><strong>Total Due:</strong> ₱${totalDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:5%">#</th>
        <th style="width:30%">Borrower Name</th>
        <th style="width:20%">Contact</th>
        <th style="width:20%" class="right">Amount Due</th>
        <th style="width:25%" class="center">Signature / Receipt</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr class="total-row">
        <td colspan="3" class="right">GRAND TOTAL</td>
        <td class="right">₱${totalDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  <div class="sig-block">
    <div class="sig-line">Collector's Signature</div>
    <div class="sig-line">Supervisor / Branch Head</div>
  </div>
  <div class="footer">Printed on ${format(new Date(), 'MM/dd/yyyy hh:mm a')} · LoanTrack System</div>
</body>
</html>`;
    };

    const handlePrint = async () => {
        setPrintLoading(true);
        try {
            const html = generatePrintHtml();
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Daily Collection Sheet' });
        } catch (err) {
            Alert.alert('Print Error', 'Unable to generate PDF. Please try again.');
        } finally {
            setPrintLoading(false);
        }
    };

    const totalCount = Object.values(groupedEntries).reduce((s, g) => s + g.length, 0);
    const groupCount = Object.keys(groupedEntries).length;

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                <ActivityIndicator size="large" color="#0D9488" />
                <Text className="text-gray-700 font-bold mt-4 italic uppercase tracking-widest text-[10px]">Compiling Ledger...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView className={`flex-1 ${sunlightMode ? 'bg-white' : 'bg-slate-50'}`}>
            <StatusBar barStyle={sunlightMode ? 'dark-content' : 'light-content'} />
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={sunlightMode ? "#000" : "#0D9488"} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {sunlightMode ? (
                    <View className="pt-12 pb-24 px-6 rounded-b-[48px] bg-white border-b-4 border-black">
                        <View className="flex-row items-center mb-6">
                            <AnimatedPressable 
                                onPress={() => safeBack(router, '/(collector)')} 
                                className="bg-black w-11 h-11 rounded-2xl items-center justify-center mr-4 border-2 border-black"
                            >
                                <MaterialIcons name="arrow-back" size={24} color="#FFF" />
                            </AnimatedPressable>
                            <Text className="text-black text-xl font-black">Daily Collection</Text>
                        </View>
                        <Animated.View entering={FadeInUp}>
                            <Text className="text-black text-[10px] font-black uppercase tracking-[3px]">Financial Report</Text>
                            <Text className="text-black text-3xl font-black mt-1 leading-tight">{dateStr}</Text>
                            <View className="flex-row items-center mt-2">
                                <Ionicons name="person-circle-outline" size={16} color="#000" />
                                <Text className="text-black ml-1.5 font-black text-sm tracking-wide">{collectorName}</Text>
                            </View>
                        </Animated.View>

                        <View className="flex-row mt-8 gap-4">
                            <Animated.View entering={FadeInRight.delay(200)} className="flex-1 bg-white border-4 border-black p-4 rounded-[28px]">
                                <Text className="text-black text-[9px] font-black uppercase tracking-wider">Total Due</Text>
                                <Text className="text-black text-xl font-black mt-1">{formatPHP(totalDue)}</Text>
                            </Animated.View>
                            <Animated.View entering={FadeInRight.delay(300)} className="bg-white border-4 border-black p-4 rounded-[28px] items-center justify-center px-6">
                                <Text className="text-black text-[9px] font-black uppercase tracking-wider">Clients</Text>
                                <Text className="text-black text-xl font-black mt-1">{totalCount}</Text>
                            </Animated.View>
                        </View>
                    </View>
                ) : (
                    <LinearGradient
                        colors={['#0D9488', '#115E59']}
                        className="pt-12 pb-24 px-6 rounded-b-[48px] shadow-2xl"
                    >
                        <View className="flex-row items-center mb-6">
                            <AnimatedPressable 
                                onPress={() => safeBack(router, '/(collector)')} 
                                className="bg-white/10 w-11 h-11 rounded-2xl items-center justify-center mr-4"
                            >
                                <MaterialIcons name="arrow-back" size={24} color="#FFF" />
                            </AnimatedPressable>
                            <Text className="text-white text-xl font-black">Daily Collection</Text>
                        </View>
                        <Animated.View entering={FadeInUp}>
                            <Text className="text-teal-100 text-[10px] font-black uppercase tracking-[3px]">Financial Report</Text>
                            <Text className="text-white text-3xl font-black mt-1 leading-tight">{dateStr}</Text>
                            <View className="flex-row items-center mt-2">
                                <Ionicons name="person-circle-outline" size={16} color="#99f6e4" />
                                <Text className="text-teal-50 ml-1.5 font-bold text-sm tracking-wide">{collectorName}</Text>
                            </View>
                        </Animated.View>

                        <View className="flex-row mt-8 gap-4">
                            <Animated.View entering={FadeInRight.delay(200)} className="flex-1 bg-white/10 p-4 rounded-[28px]">
                                <Text className="text-teal-100 text-[9px] font-black uppercase tracking-wider">Total Due</Text>
                                <Text className="text-white text-xl font-black mt-1">{formatPHP(totalDue)}</Text>
                            </Animated.View>
                            <Animated.View entering={FadeInRight.delay(300)} className="bg-white/10 p-4 rounded-[28px] items-center justify-center px-6">
                                <Text className="text-teal-100 text-[9px] font-black uppercase tracking-wider">Clients</Text>
                                <Text className="text-white text-xl font-black mt-1">{totalCount}</Text>
                            </Animated.View>
                        </View>
                    </LinearGradient>
                )}

                <View className="px-6 -mt-10">
                    {/* Action Card */}
                    <Animated.View entering={FadeInDown.delay(400)} className={`p-6 rounded-[40px] mb-8 flex-row items-center justify-between border ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-white shadow-sm border-gray-100'}`}>
                        <View className="flex-1">
                            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-lg`}>Export Report</Text>
                            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} text-xs font-black uppercase tracking-tighter mt-0.5`}>Generate PDF for signature</Text>
                        </View>
                        <AnimatedPressable
                            onPress={handlePrint}
                            disabled={printLoading || totalCount === 0}
                            className={`w-14 h-14 rounded-2xl items-center justify-center border-2 ${sunlightMode ? (totalCount === 0 ? 'bg-gray-200 border-gray-200' : 'bg-black border-black') : (totalCount === 0 ? 'bg-gray-100 border-gray-100' : 'bg-teal-600 border-teal-600 shadow-lg shadow-teal-600/30')}`}
                        >
                            {printLoading ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <FontAwesome5 name="file-pdf" size={20} color={totalCount === 0 ? (sunlightMode ? '#000' : '#94A3B8') : '#FFF'} />
                            )}
                        </AnimatedPressable>
                    </Animated.View>

                    {/* Content */}
                    {totalCount === 0 ? (
                        <Animated.View entering={FadeInUp.delay(500)} className={`p-12 rounded-[48px] items-center border-dashed border-2 ${sunlightMode ? 'bg-white border-black' : 'bg-white border-gray-200'}`}>
                            <View className={`w-20 h-20 rounded-full items-center justify-center mb-6 ${sunlightMode ? 'bg-black' : 'bg-gray-50'}`}>
                                <MaterialIcons name="event-available" size={40} color={sunlightMode ? "#FFF" : "#D1D5DB"} />
                            </View>
                            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-xl`}>No Collections Today</Text>
                            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} text-center mt-3 font-black uppercase tracking-tighter leading-relaxed`}>
                                Great job! No pending payment schedules are due today for your assigned borrowers.
                            </Text>
                        </Animated.View>
                    ) : (
                        Object.keys(groupedEntries).sort().map((group, groupIdx) => {
                            const entries = groupedEntries[group];
                            const groupTotal = entries.reduce((s, e) => s + e.schedule.scheduledAmount, 0);
                            return (
                                <Animated.View 
                                    key={group} 
                                    entering={FadeInDown.delay(500 + (groupIdx * 100))}
                                    className={`rounded-[40px] mb-8 overflow-hidden border ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-white border-gray-50 shadow-sm'}`}
                                >
                                    {/* Group Header */}
                                    <View
                                        className={`px-6 py-5 flex-row justify-between items-center border-b ${sunlightMode ? 'bg-white border-black' : 'bg-slate-50 border-gray-100'}`}
                                    >
                                        <View className="flex-row items-center">
                                            <View className={`w-8 h-8 rounded-xl items-center justify-center mr-3 ${sunlightMode ? 'bg-black border border-black' : 'bg-teal-100'}`}>
                                                <MaterialIcons name="place" size={16} color={sunlightMode ? "#FFF" : "#0D9488"} />
                                            </View>
                                            <View>
                                                <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-base`}>{group}</Text>
                                                <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} text-[10px] font-black uppercase tracking-wider`}>{entries.length} Borrowers</Text>
                                            </View>
                                        </View>
                                        <View className={`${sunlightMode ? 'bg-black' : 'bg-teal-50'} px-4 py-2 rounded-2xl`}>
                                            <Text className={`${sunlightMode ? 'text-white' : 'text-teal-700'} font-black text-sm`}>{formatPHP(groupTotal)}</Text>
                                        </View>
                                    </View>

                                    {/* Entries */}
                                    <View>
                                        {entries.map((entry, idx) => (
                                            <AnimatedPressable 
                                                key={entry.schedule.id}
                                                onPress={() => router.push(`/(collector)/borrowers/${entry.borrower.id}`)}
                                                className={`px-6 py-5 flex-row items-center ${idx < entries.length - 1 ? (sunlightMode ? 'border-b-4 border-black' : 'border-b border-gray-50') : ''}`}
                                            >
                                                <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-4 border ${sunlightMode ? 'bg-white border-black' : 'bg-gray-50 border-transparent'}`}>
                                                    <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} font-black text-sm`}>{idx + 1}</Text>
                                                </View>
                                                <View className="flex-1 mr-4">
                                                    <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-base`} numberOfLines={1}>{entry.borrower.fullName}</Text>
                                                    <View className="flex-row items-center mt-1">
                                                        <Ionicons name="call-outline" size={12} color={sunlightMode ? "#000" : "#94A3B8"} />
                                                        <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} text-[11px] font-bold ml-1`}>{entry.borrower.phone || 'No Phone'}</Text>
                                                    </View>
                                                </View>
                                                <View className="items-end">
                                                    <Text className={`${sunlightMode ? 'text-black' : 'text-teal-600'} font-black text-base`}>{formatPHP(entry.schedule.scheduledAmount)}</Text>
                                                    <View className={`mt-1.5 px-2.5 py-0.5 rounded-full border ${sunlightMode ? 'bg-black border-black text-white' : entry.schedule.status === 'overdue' ? 'bg-red-50 border-red-100' : 'bg-teal-50 border-teal-100'}`}>
                                                        <Text className={`text-[8px] font-black uppercase tracking-widest ${sunlightMode ? 'text-white' : entry.schedule.status === 'overdue' ? 'text-red-600' : 'text-teal-600'}`}>
                                                            {entry.schedule.status}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </AnimatedPressable>
                                        ))}
                                    </View>
                                </Animated.View>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

