import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { endOfDay, format, parseISO, startOfDay, startOfMonth, startOfWeek, startOfYear } from 'date-fns';
import { database } from '../../../src/database';
import Payment from '../../../src/database/models/Payment';
import Loan from '../../../src/database/models/Loan';
import Borrower from '../../../src/database/models/Borrower';
import Collector from '../../../src/database/models/Collector';
import { DatePicker } from '../../../src/components/DatePicker';
import { formatPHP } from '../../../src/utils/currency';
import { formatDate } from '../../../src/utils/dates';

type PresetKey = 'today' | 'wtd' | 'mtd' | 'ytd' | 'custom';

interface PaymentRow {
    id: string;
    borrowerId: string;
    borrowerName: string;
    collectorName: string;
    loanNumber: string;
    receiptNumber: string;
    paymentDate: Date;
    amount: number;
}

const PRESET_LABELS: Record<PresetKey, string> = {
    today: 'Today',
    wtd: 'WTD',
    mtd: 'MTD',
    ytd: 'YTD',
    custom: 'Custom',
};

function toInputDate(value: Date) {
    return format(value, 'yyyy-MM-dd');
}

function getPresetRange(preset: Exclude<PresetKey, 'custom'>) {
    const now = new Date();

    switch (preset) {
        case 'today':
            return {
                start: startOfDay(now),
                end: endOfDay(now),
            };
        case 'wtd':
            return {
                start: startOfWeek(now, { weekStartsOn: 1 }),
                end: endOfDay(now),
            };
        case 'ytd':
            return {
                start: startOfYear(now),
                end: endOfDay(now),
            };
        case 'mtd':
        default:
            return {
                start: startOfMonth(now),
                end: endOfDay(now),
            };
    }
}

function normalizeCollectorName(name: string) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildCollectorOptions(rawCollectors: Collector[]) {
    const seen = new Map<string, Collector>();

    for (const collector of rawCollectors) {
        const name = (collector.fullName || '').trim();
        if (!name) {
            continue;
        }

        const normalized = name.toLowerCase().replace(/\s+/g, ' ');
        if (!seen.has(normalized) || (collector.isActive && !seen.get(normalized)?.isActive)) {
            seen.set(normalized, collector);
        }
    }

    return Array.from(seen.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export default function CollectionReportScreen() {
    const router = useRouter();
    const defaultRange = getPresetRange('mtd');

    const [loading, setLoading] = useState(true);
    const [selectedCollectorId, setSelectedCollectorId] = useState('all');
    const [selectedPreset, setSelectedPreset] = useState<PresetKey>('mtd');
    const [startDate, setStartDate] = useState(toInputDate(defaultRange.start));
    const [endDate, setEndDate] = useState(toInputDate(defaultRange.end));
    const [collectors, setCollectors] = useState<Collector[]>([]);
    const [reportRows, setReportRows] = useState<PaymentRow[]>([]);
    const [totalCollected, setTotalCollected] = useState(0);
    const [uniqueBorrowers, setUniqueBorrowers] = useState(0);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const parsedStart = parseISO(startDate);
            const parsedEnd = parseISO(endDate);
            const rangeStart = startOfDay(parsedStart).getTime();
            const rangeEnd = endOfDay(parsedEnd).getTime();

            const rawCollectors = await database.collections.get<Collector>('collectors').query(
                Q.where('is_active', Q.notEq(false))
            ).fetch();
            const collectorOptions = buildCollectorOptions(rawCollectors);
            setCollectors(collectorOptions);

            const payments = await database.collections.get<Payment>('payments').query(
                Q.where('payment_date', Q.between(rangeStart, rangeEnd)),
                Q.sortBy('payment_date', Q.desc)
            ).fetch();

            if (payments.length === 0) {
                setReportRows([]);
                setTotalCollected(0);
                setUniqueBorrowers(0);
                return;
            }

            const loanIds = Array.from(new Set(payments.map(payment => payment.loanId).filter(Boolean)));
            const loans = loanIds.length > 0
                ? await database.collections.get<Loan>('loans').query(Q.where('id', Q.oneOf(loanIds))).fetch()
                : [];
            const loanMap = new Map(loans.map(loan => [loan.id, loan]));

            const borrowerIds = Array.from(new Set(loans.map(loan => loan.borrowerId).filter(Boolean)));
            const borrowers = borrowerIds.length > 0
                ? await database.collections.get<Borrower>('borrowers').query(Q.where('id', Q.oneOf(borrowerIds))).fetch()
                : [];
            const borrowerMap = new Map(borrowers.map(borrower => [borrower.id, borrower]));

            const collectorMap = new Map(rawCollectors.map(collector => [collector.id, collector]));

            const rows = payments
                .map<PaymentRow | null>((payment) => {
                    const loan = loanMap.get(payment.loanId);
                    if (!loan) {
                        return null;
                    }

                    const borrower = borrowerMap.get(loan.borrowerId);
                    if (!borrower) {
                        return null;
                    }

                    const resolvedCollectorId = payment.collectorId || loan.collectorId || borrower.collectorId;
                    if (selectedCollectorId !== 'all' && resolvedCollectorId !== selectedCollectorId) {
                        return null;
                    }

                    return {
                        id: payment.id,
                        borrowerId: borrower.id,
                        borrowerName: borrower.fullName || 'Unknown Borrower',
                        collectorName: collectorMap.get(resolvedCollectorId)?.fullName || 'Unassigned',
                        loanNumber: loan.loanNumber || '—',
                        receiptNumber: payment.receiptNumber || '—',
                        paymentDate: new Date(payment.paymentDate),
                        amount: payment.amount || 0,
                    };
                })
                .filter((row): row is PaymentRow => !!row);

            setReportRows(rows);
            setTotalCollected(rows.reduce((sum, row) => sum + row.amount, 0));
            setUniqueBorrowers(new Set(rows.map(row => row.borrowerId)).size);
        } catch (error) {
            console.error('Failed to load collection report:', error);
            setReportRows([]);
            setTotalCollected(0);
            setUniqueBorrowers(0);
        } finally {
            setLoading(false);
        }
    }, [endDate, selectedCollectorId, startDate]);

    useFocusEffect(useCallback(() => {
        loadData();
    }, [loadData]));

    useEffect(() => {
        loadData();
    }, [loadData]);

    const applyPreset = (preset: PresetKey) => {
        setSelectedPreset(preset);
        if (preset === 'custom') {
            return;
        }

        const range = getPresetRange(preset);
        setStartDate(toInputDate(range.start));
        setEndDate(toInputDate(range.end));
    };

    const handleStartDateChange = (value: string) => {
        setSelectedPreset('custom');
        setStartDate(value);
    };

    const handleEndDateChange = (value: string) => {
        setSelectedPreset('custom');
        setEndDate(value);
    };

    const collectorLabel = selectedCollectorId === 'all'
        ? 'All Collectors'
        : collectors.find(collector => collector.id === selectedCollectorId)?.fullName || 'Collector';

    return (
        <View className="flex-1 bg-white">
            <View className="px-4 pt-4 pb-3 bg-white border-b border-gray-100">
                <View className="flex-row justify-between items-start mb-4">
                    <View className="flex-1 pr-3">
                        <Text className="text-2xl font-black text-gray-900">Collection Report</Text>
                        <Text className="text-gray-700 font-bold uppercase tracking-widest text-[10px] mt-1">
                            Actual payments received from {formatDate(parseISO(startDate))} — {formatDate(parseISO(endDate))}
                        </Text>
                        <Text className="text-xs text-gray-700 mt-2">{collectorLabel}</Text>
                    </View>
                </View>

                <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-2">Quick Range</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                    {(['today', 'wtd', 'mtd', 'ytd', 'custom'] as PresetKey[]).map((preset) => (
                        <Pressable
                            key={preset}
                            testID={`preset-pill-${preset}`}
                            onPress={() => applyPreset(preset)}
                            className={`px-4 py-2 rounded-full mr-2 ${selectedPreset === preset ? 'bg-blue-900' : 'bg-gray-100'}`}
                        >
                            <Text className={`text-xs font-black uppercase tracking-wider ${selectedPreset === preset ? 'text-white' : 'text-gray-600'}`}>
                                {PRESET_LABELS[preset]}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>

                <View className="flex-row gap-3 mb-4">
                    <View className="flex-1">
                        <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-2">Start Date</Text>
                        <DatePicker value={startDate} onChange={handleStartDateChange} />
                    </View>
                    <View className="flex-1">
                        <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-2">End Date</Text>
                        <DatePicker value={endDate} onChange={handleEndDateChange} />
                    </View>
                </View>

                <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-2">Collector</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                    <Pressable
                        testID="collector-pill-filter-all"
                        onPress={() => setSelectedCollectorId('all')}
                        className={`px-4 py-2 rounded-full mr-2 ${selectedCollectorId === 'all' ? 'bg-blue-900' : 'bg-gray-100'}`}
                    >
                        <Text className={`text-xs font-black uppercase tracking-wider ${selectedCollectorId === 'all' ? 'text-white' : 'text-gray-600'}`}>
                            All
                        </Text>
                    </Pressable>
                    {collectors.map((collector) => (
                        <Pressable
                            key={collector.id}
                            testID={`collector-pill-filter-${normalizeCollectorName(collector.fullName)}`}
                            onPress={() => setSelectedCollectorId(collector.id)}
                            className={`px-4 py-2 rounded-full mr-2 ${selectedCollectorId === collector.id ? 'bg-blue-900' : 'bg-gray-100'}`}
                        >
                            <Text className={`text-xs font-black uppercase tracking-wider ${selectedCollectorId === collector.id ? 'text-white' : 'text-gray-600'}`}>
                                {collector.fullName}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>

                <View className="flex-row mb-4">
                    <View className="flex-1 bg-blue-900 p-4 rounded-2xl mr-2">
                        <Text className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1">Collected</Text>
                        <Text className="text-xl font-black text-white">{formatPHP(totalCollected)}</Text>
                    </View>
                    <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm ml-2">
                        <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-1">Transactions</Text>
                        <Text className="text-xl font-black text-gray-900">{reportRows.length}</Text>
                        <Text className="text-xs text-gray-700 mt-1">{uniqueBorrowers} borrower{uniqueBorrowers === 1 ? '' : 's'}</Text>
                    </View>
                </View>

                <View className="flex-row border-b-2 border-gray-100 pb-2">
                    <Text className="flex-1 text-[10px] font-bold text-gray-700 uppercase tracking-widest">Client / Receipt</Text>
                    <Text className="w-24 text-[10px] font-bold text-gray-700 uppercase tracking-widest text-center">Collector</Text>
                    <Text className="w-20 text-[10px] font-bold text-gray-700 uppercase tracking-widest text-center">Date</Text>
                    <Text className="w-24 text-[10px] font-bold text-gray-700 uppercase tracking-widest text-right">Amount</Text>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator testID="loading-indicator" size="large" className="mt-20" color="#1E3A8A" />
            ) : (
                <FlatList
                    className="flex-1 bg-white px-4"
                    data={reportRows}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <View className="flex-row items-center py-3 border-b border-gray-50">
                            <View className="flex-1 pr-2">
                                <Pressable onPress={() => router.push(`/(admin)/borrowers/${item.borrowerId}`)}>
                                    <Text className="text-sm font-bold text-blue-700 underline" numberOfLines={1}>
                                        {item.borrowerName}
                                    </Text>
                                </Pressable>
                                <Text className="text-[10px] text-gray-700 font-medium">
                                    {item.loanNumber} • {item.receiptNumber}
                                </Text>
                            </View>
                            <Text className="w-24 text-[11px] font-bold text-center text-gray-700" numberOfLines={2}>
                                {item.collectorName}
                            </Text>
                            <Text className="w-20 text-[10px] font-medium text-center text-gray-700">
                                {formatDate(item.paymentDate)}
                            </Text>
                            <Text className="w-24 text-sm font-black text-right text-green-700">
                                {item.amount.toFixed(2)}
                            </Text>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View className="items-center py-20">
                            <MaterialIcons name="payments" size={64} color="#E5E7EB" />
                            <Text className="text-gray-700 font-medium mt-4 text-center">
                                No payments found for the selected range.
                            </Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 120 }}
                />
            )}
        </View>
    );
}
