import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, Pressable, ActivityIndicator,
    SafeAreaView, RefreshControl, Alert, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { database } from '../../src/database';
import Borrower from '../../src/database/models/Borrower';
import Loan from '../../src/database/models/Loan';
import PaymentSchedule from '../../src/database/models/PaymentSchedule';
import Collector from '../../src/database/models/Collector';
import CollectionGroup from '../../src/database/models/CollectionGroup';
import { useAuth } from '../../src/store/AuthContext';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { formatPHP } from '../../src/utils/currency';
import { Q } from '@nozbe/watermelondb';
import { startOfWeek, endOfWeek, format, addDays } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInRight, FadeInUp, Layout } from 'react-native-reanimated';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { safeBack } from '../../src/utils/navigation';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_COLORS: Record<number, { bg: string; text: string; badge: string; accent: string }> = {
    0: { bg: '#FFFBEB', text: '#92400E', badge: '#F59E0B', accent: '#FDE68A' },
    1: { bg: '#EFF6FF', text: '#1E40AF', badge: '#2563EB', accent: '#BFDBFE' },
    2: { bg: '#F0FDF4', text: '#065F46', badge: '#4F7F52', accent: '#BBF7D0' },
    3: { bg: '#F5F3FF', text: '#4C1D95', badge: '#7C3AED', accent: '#DDD6FE' },
    4: { bg: '#FDF2F8', text: '#831843', badge: '#EC4899', accent: '#FBCFE8' },
    5: { bg: '#FFF7ED', text: '#7C2D12', badge: '#EA580C', accent: '#FED7AA' },
    6: { bg: '#F8FAFC', text: '#334155', badge: '#64748B', accent: '#E2E8F0' },
};

interface ScheduleEntry {
    schedule: PaymentSchedule;
    borrower: Borrower;
    loan: Loan;
}

interface DayGroup {
    day: number;
    groupName: string;
    entries: ScheduleEntry[];
    total: number;
}

export default function WeeklyCollectionSheet() {
    const router = useRouter();
    const { user, collectorId, sunlightMode } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
    const [collectorName, setCollectorName] = useState('');
    const [totalDue, setTotalDue] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [printLoading, setPrintLoading] = useState(false);

    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });   // Sunday
    const weekLabel = `${format(weekStart, 'MMM dd')} – ${format(weekEnd, 'MMM dd, yyyy')}`;

    const fetchData = useCallback(async () => {
        if (!user) {
            console.log('[WeeklyCollectionSheet] No user yet, skipping fetch');
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

            const collectionGroups = await database.collections.get<CollectionGroup>('collection_groups')
                .query(Q.where('collector_id', currentCollectorId), Q.where('is_active', true))
                .fetch();

            const groupDayMap = new Map<string, number>();
            for (const cg of collectionGroups) {
                groupDayMap.set(cg.name, cg.collectionDay);
            }

            const assignedBorrowers = await database.collections.get<Borrower>('borrowers')
                .query(Q.where('collector_id', currentCollectorId))
                .fetch();

            if (assignedBorrowers.length === 0) {
                setDayGroups([]);
                setTotalDue(0);
                setTotalCount(0);
                return;
            }

            const borrowerIds = assignedBorrowers.map(b => b.id);

            const activeLoans = await database.collections.get<Loan>('loans')
                .query(
                    Q.where('borrower_id', Q.oneOf(borrowerIds)),
                    Q.where('status', 'active'),
                    Q.where('frequency', 'weekly')
                )
                .fetch();

            const loanIds = activeLoans.map(l => l.id);

            let weeklySchedules: PaymentSchedule[] = [];
            if (loanIds.length > 0) {
                weeklySchedules = await database.collections.get<PaymentSchedule>('payment_schedules')
                    .query(
                        Q.where('loan_id', Q.oneOf(loanIds)),
                        Q.where('due_date', Q.between(weekStart.getTime(), weekEnd.getTime())),
                        Q.where('status', Q.notEq('paid'))
                    )
                    .fetch();
            }

            const borrowerMap = new Map(assignedBorrowers.map(b => [b.id, b]));
            const loanMap = new Map(activeLoans.map(l => [l.id, l]));

            const dayMap = new Map<string, DayGroup>();

            for (const schedule of weeklySchedules) {
                const loan = loanMap.get(schedule.loanId);
                if (!loan) continue;
                const borrower = borrowerMap.get(loan.borrowerId);
                if (!borrower) continue;

                const groupName = borrower.group || 'Ungrouped';
                let dayNum: number;
                if (groupDayMap.has(groupName)) {
                    dayNum = groupDayMap.get(groupName)!;
                } else {
                    const dueDateMs = typeof schedule.dueDate === 'number' ? schedule.dueDate : (schedule.dueDate as Date).getTime();
                    dayNum = new Date(dueDateMs).getDay();
                }

                const key = `${dayNum}-${groupName}`;
                if (!dayMap.has(key)) {
                    dayMap.set(key, { day: dayNum, groupName, entries: [], total: 0 });
                }
                const dg = dayMap.get(key)!;
                dg.entries.push({ schedule, borrower, loan });
                dg.total += schedule.scheduledAmount;
            }

            const result = Array.from(dayMap.values())
                .sort((a, b) => a.day - b.day || a.groupName.localeCompare(b.groupName));
            for (const dg of result) {
                dg.entries.sort((a, b) => a.borrower.fullName.localeCompare(b.borrower.fullName));
            }

            const grand = result.reduce((s, dg) => s + dg.total, 0);
            const count = result.reduce((s, dg) => s + dg.entries.length, 0);

            setDayGroups(result);
            setTotalDue(grand);
            setTotalCount(count);
        } catch (err) {
            console.error('Weekly sheet error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user, collectorId]);

    useEffect(() => { fetchData(); }, [fetchData, collectorId]);
    const onRefresh = () => { setRefreshing(true); fetchData(); };

    const generatePrintHtml = () => {
        let tableRows = '';
        let overallRowNum = 1;

        const days = [...new Set(dayGroups.map(dg => dg.day))].sort();
        for (const day of days) {
            const dayGroupsForDay = dayGroups.filter(dg => dg.day === day);
            const dayTotal = dayGroupsForDay.reduce((s, dg) => s + dg.total, 0);
            const dayDate = addDays(weekStart, (day + 6) % 7);

            tableRows += `
                <tr class="day-header">
                    <td colspan="5">${DAY_NAMES[day]} — ${format(dayDate, 'MMMM dd, yyyy')}</td>
                </tr>`;

            for (const dg of dayGroupsForDay) {
                tableRows += `
                <tr class="group-header">
                    <td colspan="5">📍 ${dg.groupName} &nbsp;(${dg.entries.length} borrowers)</td>
                </tr>`;
                for (const entry of dg.entries) {
                    tableRows += `
                <tr>
                    <td class="center">${overallRowNum++}</td>
                    <td>${entry.borrower.fullName}</td>
                    <td>${entry.borrower.phone || '—'}</td>
                    <td class="right">₱${entry.schedule.scheduledAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td class="signature"></td>
                </tr>`;
                }
                tableRows += `
                <tr class="subtotal-row">
                    <td colspan="3" class="right"><em>Group ${dg.groupName} Total:</em></td>
                    <td class="right"><em>₱${dg.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</em></td>
                    <td></td>
                </tr>`;
            }

            tableRows += `
                <tr class="day-total-row">
                    <td colspan="3" class="right"><strong>${DAY_NAMES[day]} Total:</strong></td>
                    <td class="right"><strong>₱${dayTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td>
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
  .header h2 { font-size: 12px; margin-top: 4px; color: #555; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1E3A8A; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e0e0e0; }
  .day-header { background: #355E3B; color: white; font-size: 12px; font-weight: bold; }
  .day-header td { padding: 7px 8px; color: white; }
  .group-header { background: #e8eaf6; }
  .group-header td { padding: 5px 8px; font-weight: bold; }
  .subtotal-row td { background: #f5f5f5; font-style: italic; }
  .day-total-row td { background: #c5cae9; font-weight: bold; font-size: 12px; }
  .center { text-align: center; }
  .right { text-align: right; }
  .signature { min-width: 80px; }
  .total-row { background: #1E3A8A; color: white; font-weight: bold; font-size: 13px; }
  .total-row td { padding: 8px; color: white; }
  .sig-block { margin-top: 40px; display: flex; justify-content: space-between; }
  .sig-line { border-top: 1px solid #000; width: 180px; text-align: center; padding-top: 4px; font-size: 10px; }
  .footer { margin-top: 16px; font-size: 10px; text-align: center; color: #888; }
</style>
</head>
<body>
  <div class="header">
    <h1>WEEKLY COLLECTION SHEET</h1>
    <h2>Week of ${weekLabel}</h2>
  </div>
  <div class="meta">
    <span><strong>Collector:</strong> ${collectorName}</span>
    <span><strong>Total Collections Due:</strong> ₱${totalDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
    <span><strong>Total Borrowers:</strong> ${totalCount}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:5%">#</th>
        <th style="width:30%">Borrower Name</th>
        <th style="width:20%">Contact</th>
        <th style="width:20%" class="right">Weekly Due</th>
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
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Weekly Collection Sheet' });
        } catch (err) {
            Alert.alert('Print Error', 'Unable to generate PDF. Please try again.');
        } finally {
            setPrintLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text className="text-gray-700 font-bold mt-4 italic uppercase tracking-widest text-[10px]">Compiling Weekly Ledger...</Text>
            </View>
        );
    }

    const days = [...new Set(dayGroups.map(dg => dg.day))].sort();

    return (
        <SafeAreaView className={`flex-1 ${sunlightMode ? 'bg-white' : 'bg-slate-50'}`}>
            <StatusBar barStyle={sunlightMode ? 'dark-content' : 'light-content'} />
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={sunlightMode ? "#000" : "#4F46E5"} />}
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
                            <Text className="text-black text-xl font-black">Weekly Collection</Text>
                        </View>
                        <Animated.View entering={FadeInUp}>
                            <Text className="text-black text-[10px] font-black uppercase tracking-[3px]">Financial Report</Text>
                            <Text className="text-black text-3xl font-black mt-1 leading-tight">{weekLabel}</Text>
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
                                <Text className="text-black text-[9px] font-black uppercase tracking-wider">Borrowers</Text>
                                <Text className="text-black text-xl font-black mt-1">{totalCount}</Text>
                            </Animated.View>
                        </View>
                    </View>
                ) : (
                    <LinearGradient
                        colors={['#4F46E5', '#3730A3']}
                        className="pt-12 pb-24 px-6 rounded-b-[48px] shadow-2xl"
                    >
                        <View className="flex-row items-center mb-6">
                            <AnimatedPressable 
                                onPress={() => safeBack(router, '/(collector)')} 
                                className="bg-white/10 w-11 h-11 rounded-2xl items-center justify-center mr-4"
                            >
                                <MaterialIcons name="arrow-back" size={24} color="#FFF" />
                            </AnimatedPressable>
                            <Text className="text-white text-xl font-black">Weekly Collection</Text>
                        </View>
                        <Animated.View entering={FadeInUp}>
                            <Text className="text-indigo-100 text-[10px] font-black uppercase tracking-[3px]">Financial Report</Text>
                            <Text className="text-white text-3xl font-black mt-1 leading-tight">{weekLabel}</Text>
                            <View className="flex-row items-center mt-2">
                                <Ionicons name="person-circle-outline" size={16} color="#C7D2FE" />
                                <Text className="text-indigo-50 ml-1.5 font-bold text-sm tracking-wide">{collectorName}</Text>
                            </View>
                        </Animated.View>

                        <View className="flex-row mt-8 gap-4">
                            <Animated.View entering={FadeInRight.delay(200)} className="flex-1 bg-white/10 p-4 rounded-[28px]">
                                <Text className="text-indigo-100 text-[9px] font-black uppercase tracking-wider">Total Due</Text>
                                <Text className="text-white text-xl font-black mt-1">{formatPHP(totalDue)}</Text>
                            </Animated.View>
                            <Animated.View entering={FadeInRight.delay(300)} className="bg-white/10 p-4 rounded-[28px] items-center justify-center px-6">
                                <Text className="text-indigo-100 text-[9px] font-black uppercase tracking-wider">Borrowers</Text>
                                <Text className="text-white text-xl font-black mt-1">{totalCount}</Text>
                            </Animated.View>
                        </View>
                    </LinearGradient>
                )}

                <View className="px-6 -mt-10">
                    <Animated.View entering={FadeInDown.delay(400)} className={`p-6 rounded-[40px] mb-8 flex-row items-center justify-between border ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-white shadow-sm border-gray-100'}`}>
                        <View className="flex-1">
                            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-lg`}>Export Report</Text>
                            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} text-xs font-black uppercase tracking-tighter mt-0.5`}>Generate weekly PDF summary</Text>
                        </View>
                        <AnimatedPressable
                            onPress={handlePrint}
                            disabled={printLoading || totalCount === 0}
                            className={`w-14 h-14 rounded-2xl items-center justify-center border-2 ${sunlightMode ? (totalCount === 0 ? 'bg-gray-200 border-gray-200' : 'bg-black border-black') : (totalCount === 0 ? 'bg-gray-100 border-gray-100' : 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/30')}`}
                        >
                            {printLoading ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <FontAwesome5 name="file-pdf" size={20} color={totalCount === 0 ? (sunlightMode ? '#000' : '#94A3B8') : '#FFF'} />
                            )}
                        </AnimatedPressable>
                    </Animated.View>

                    {totalCount === 0 ? (
                        <Animated.View entering={FadeInUp.delay(500)} className={`p-12 rounded-[48px] items-center border-dashed border-2 ${sunlightMode ? 'bg-white border-black' : 'bg-white border-gray-200'}`}>
                            <View className={`w-20 h-20 rounded-full items-center justify-center mb-6 ${sunlightMode ? 'bg-black' : 'bg-gray-50'}`}>
                                <MaterialIcons name="date-range" size={40} color={sunlightMode ? "#FFF" : "#D1D5DB"} />
                            </View>
                            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-xl`}>No Weekly Schedules</Text>
                            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} text-center mt-3 font-medium leading-relaxed`}>
                                No pending weekly payment schedules found for this week.
                            </Text>
                        </Animated.View>
                    ) : (
                        days.map((day, dayIdx) => {
                            const groupsForDay = dayGroups.filter(dg => dg.day === day);
                            const dayTotal = groupsForDay.reduce((s, dg) => s + dg.total, 0);
                            const colors = DAY_COLORS[day] || DAY_COLORS[1];
                            const dayDate = addDays(weekStart, (day + 6) % 7);

                            return (
                                <Animated.View 
                                    key={day} 
                                    entering={FadeInDown.delay(500 + (dayIdx * 100))}
                                    className="mb-10"
                                >
                                    <View className="flex-row items-center mb-4 px-1">
                                        <View style={{ backgroundColor: sunlightMode ? '#000' : colors.badge }} className="px-4 py-1.5 rounded-2xl mr-3 border border-black/5">
                                            <Text className="text-white font-black text-xs uppercase tracking-wider">{DAY_NAMES[day]}</Text>
                                        </View>
                                        <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} font-black text-sm tracking-wide`}>{format(dayDate, 'MMM dd')}</Text>
                                        <View className="flex-1" />
                                        <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-sm`}>{formatPHP(dayTotal)}</Text>
                                    </View>

                                    {groupsForDay.map((dg, gIdx) => (
                                        <Animated.View 
                                            key={`${dg.day}-${dg.groupName}`} 
                                            className={`rounded-[40px] mb-4 overflow-hidden border ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-white border-gray-50 shadow-sm'}`}
                                            layout={Layout.springify()}
                                        >
                                            <View
                                                className={`px-6 py-4 flex-row justify-between items-center border-b ${sunlightMode ? 'bg-white border-black' : 'border-gray-100'}`}
                                            >
                                                <View className="flex-row items-center">
                                                    <View 
                                                        style={{ backgroundColor: sunlightMode ? '#000' : colors.badge + '20' }} 
                                                        className={`w-8 h-8 rounded-xl items-center justify-center mr-3 border ${sunlightMode ? 'border-black' : 'border-transparent'}`}
                                                    >
                                                        <MaterialIcons name="people" size={16} color={sunlightMode ? "#FFF" : colors.badge} />
                                                    </View>
                                                    <View>
                                                        <Text style={{ color: sunlightMode ? '#000' : colors.text }} className="font-black text-sm">{dg.groupName}</Text>
                                                        <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} text-[10px] font-black uppercase tracking-wider`}>{dg.entries.length} Clients</Text>
                                                    </View>
                                                </View>
                                                <View 
                                                    style={{ backgroundColor: sunlightMode ? '#000' : colors.badge + '15' }} 
                                                    className={`px-3 py-1.5 rounded-xl border ${sunlightMode ? 'border-black' : 'border-transparent'}`}
                                                >
                                                    <Text style={{ color: sunlightMode ? '#FFF' : colors.text }} className="font-black text-xs">{formatPHP(dg.total)}</Text>
                                                </View>
                                            </View>

                                            <View>
                                                {dg.entries.map((entry, idx) => (
                                                    <AnimatedPressable 
                                                        key={entry.schedule.id}
                                                        onPress={() => router.push(`/(collector)/borrowers/${entry.borrower.id}`)}
                                                        className={`px-6 py-4 flex-row items-center ${idx < dg.entries.length - 1 ? (sunlightMode ? 'border-b-4 border-black' : 'border-b border-gray-50') : ''}`}
                                                    >
                                                        <View 
                                                            style={{ backgroundColor: sunlightMode ? '#FFF' : colors.bg }} 
                                                            className={`w-9 h-9 rounded-xl items-center justify-center mr-4 border ${sunlightMode ? 'border-4 border-black' : 'border-transparent'}`}
                                                        >
                                                            <Text style={{ color: sunlightMode ? '#000' : colors.badge }} className="font-black text-xs">{idx + 1}</Text>
                                                        </View>
                                                        <View className="flex-1 mr-4">
                                                            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-base`} numberOfLines={1}>{entry.borrower.fullName}</Text>
                                                            <View className="flex-row items-center mt-0.5">
                                                                <Ionicons name="call-outline" size={12} color={sunlightMode ? "#000" : "#94A3B8"} />
                                                                <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} text-[11px] font-bold ml-1`}>{entry.borrower.phone || 'No Phone'}</Text>
                                                            </View>
                                                        </View>
                                                        <Text style={{ color: sunlightMode ? '#000' : colors.badge }} className="font-black text-base">{formatPHP(entry.schedule.scheduledAmount)}</Text>
                                                    </AnimatedPressable>
                                                ))}
                                            </View>
                                        </Animated.View>
                                    ))}
                                </Animated.View>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}


