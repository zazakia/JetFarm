import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import Borrower from '../../../src/database/models/Borrower';
import Loan from '../../../src/database/models/Loan';
import PaymentSchedule from '../../../src/database/models/PaymentSchedule';
import Payment from '../../../src/database/models/Payment';
import Collector from '../../../src/database/models/Collector';
import { formatPHP } from '../../../src/utils/currency';
import { formatDate } from '../../../src/utils/dates';
import { logoBase64 } from '../../../src/utils/logoBase64';
import { COMPANY_NAME } from '../../../src/constants/brand';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

interface CollectionRow {
    borrowerName: string;
    address: string;
    collectorName: string;
    loanAmount: number;
    target: number;
    balance: number;
    actual: number;
    borrowerId: string;
}

function getWeekRange(offset: number = 0) {
    const now = new Date();
    now.setDate(now.getDate() + (offset * 7));
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
}

// Column widths for the table
const COL_CLIENT = 160;
const COL_ADDRESS = 160;
const COL_COLLECTOR = 110;
const COL_LOAN = 90;
const COL_TARGET = 80;
const COL_BALANCE = 90;
const COL_ACTUAL = 90;
const TABLE_WIDTH = COL_CLIENT + COL_ADDRESS + COL_COLLECTOR + COL_LOAN + COL_TARGET + COL_BALANCE + COL_ACTUAL;

export default function WeeklyCollectionReport() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [collectors, setCollectors] = useState<Collector[]>([]);
    const [selectedCollectorId, setSelectedCollectorId] = useState<string>('all');
    const [weekOffset, setWeekOffset] = useState(0);
    const [reportRows, setReportRows] = useState<CollectionRow[]>([]);
    const [weekRange, setWeekRange] = useState<{ start: Date; end: Date }>(getWeekRange(0));

    const loadCollectors = async () => {
        const allCollectors = await database.collections.get<Collector>('collectors').query(
            Q.where('is_active', true)
        ).fetch();
        setCollectors(allCollectors);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const range = getWeekRange(weekOffset);
            setWeekRange(range);

            // 1. Get schedules due this week
            let schedulesQuery = database.collections.get<PaymentSchedule>('payment_schedules').query(
                Q.where('due_date', Q.between(range.start.getTime(), range.end.getTime()))
            );
            const schedules = await schedulesQuery.fetch();
            
            // 2. Get loans for these schedules
            const loanIds = [...new Set(schedules.map(s => s.loanId))];
            if (loanIds.length === 0) {
                setReportRows([]);
                return;
            }

            let loansQuery = selectedCollectorId !== 'all'
                ? database.collections.get<Loan>('loans').query(
                    Q.where('id', Q.oneOf(loanIds)),
                    Q.where('status', 'active'),
                    Q.where('frequency', 'weekly'),
                    Q.where('collector_id', selectedCollectorId)
                )
                : database.collections.get<Loan>('loans').query(
                    Q.where('id', Q.oneOf(loanIds)),
                    Q.where('status', 'active'),
                    Q.where('frequency', 'weekly')
                );
            const loans = await loansQuery.fetch();
            const loanMap = new Map(loans.map(l => [l.id, l]));

            // 3. Get borrowers
            const borrowerIds = [...new Set(loans.map(l => l.borrowerId))];
            const borrowers = await database.collections.get<Borrower>('borrowers').query(
                Q.where('id', Q.oneOf(borrowerIds))
            ).fetch();
            const borrowerMap = new Map(borrowers.map(b => [b.id, b]));

            // 3.5 Fetch all collectors for name resolution
            const allCollectorsRaw = await database.collections.get<Collector>('collectors').query().fetch();
            const collectorMap = new Map(allCollectorsRaw.map(c => [c.id, c]));

            // 4. Get payments for this week specifically
            const weekPayments = await database.collections.get<Payment>('payments').query(
                Q.where('payment_date', Q.between(range.start.getTime(), range.end.getTime())),
                Q.where('loan_id', Q.oneOf(loanIds))
            ).fetch();

            const rows: CollectionRow[] = [];
            // Group schedules by loan to avoid multiple rows for same client in same week
            const loanSchedulesMap = new Map<string, number>();
            for (const schedule of schedules) {
                const current = loanSchedulesMap.get(schedule.loanId) || 0;
                loanSchedulesMap.set(schedule.loanId, current + schedule.scheduledAmount);
            }

            for (const [loanId, targetSum] of loanSchedulesMap.entries()) {
                const loan = loanMap.get(loanId);
                if (!loan) continue;

                const borrower = borrowerMap.get(loan.borrowerId);
                if (!borrower) continue;

                const collector = collectorMap.get(loan.collectorId);

                // Calculate total paid for this loan to get balance
                const allPaymentsForLoan = await database.collections.get<Payment>('payments').query(
                    Q.where('loan_id', loan.id)
                ).fetch();
                const totalPaid = allPaymentsForLoan.reduce((sum, p) => sum + p.amount, 0);
                const balance = loan.totalAmount - totalPaid;

                // Actual collection this week
                const actualWeek = weekPayments
                    .filter(p => p.loanId === loan.id)
                    .reduce((sum, p) => sum + p.amount, 0);

                rows.push({
                    borrowerName: borrower.fullName,
                    address: borrower.address || '',
                    collectorName: collector?.fullName || 'Unassigned',
                    loanAmount: loan.principalAmount,
                    target: targetSum,
                    balance: balance,
                    actual: actualWeek,
                    borrowerId: borrower.id,
                });
            }

            setReportRows(rows);
        } catch (error) {
            console.error('Failed to load weekly collection report:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => {
        loadCollectors().then(() => loadData());
    }, [selectedCollectorId, weekOffset]));

    // ─── Excel Export ───────────────────────────────────────────────────────────
    const exportToExcel = async () => {
        try {
            const BOM = '\uFEFF';
            const headers = ['Name Of Client', 'Address', 'Collector', 'Loan Amount', 'Target Collection', 'Total Loan Balance', 'Actual Collection'];
            const totalTarget = reportRows.reduce((sum, r) => sum + r.target, 0);
            const totalBalance = reportRows.reduce((sum, r) => sum + r.balance, 0);
            const totalActual = reportRows.reduce((sum, r) => sum + r.actual, 0);

            const csvRows = [
                headers.join(','),
                ...reportRows.map(row => [
                    `"${row.borrowerName.replace(/"/g, '""')}"`,
                    `"${row.address.replace(/"/g, '""')}"`,
                    `"${row.collectorName.replace(/"/g, '""')}"`,
                    row.loanAmount.toFixed(2),
                    row.target.toFixed(2),
                    row.balance.toFixed(2),
                    row.actual > 0 ? row.actual.toFixed(2) : '',
                ].join(',')),
                ['"TOTAL"', '""', '""', '""', totalTarget.toFixed(2), totalBalance.toFixed(2), totalActual.toFixed(2)].join(',')
            ];
            const csvContent = BOM + csvRows.join('\n');
            const fileName = `Weekly_Collection_${formatDate(weekRange.start).replace(/ /g, '_')}_to_${formatDate(weekRange.end).replace(/ /g, '_')}.csv`;

            if (Platform.OS === 'web') {
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                const fileUri = FileSystem.documentDirectory + fileName;
                await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'text/csv',
                    dialogTitle: 'Export Weekly Collection',
                    UTI: 'public.comma-separated-values-text',
                });
            }
        } catch (error) {
            console.error('Export to Excel failed:', error);
        }
    };

    // ─── Print / PDF ─────────────────────────────────────────────────────────────
    const printReport = async () => {
        const dateRangeStr = `${formatDate(weekRange.start)} — ${formatDate(weekRange.end)}`;
        const collectorLabel = selectedCollectorId === 'all'
            ? 'All Collectors'
            : collectors.find(c => c.id === selectedCollectorId)?.fullName ?? '';

        const rowsHtml = reportRows.map((row, i) => `
            <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9f9f9'}">
                <td>${row.borrowerName}</td>
                <td>${row.address}</td>
                <td>${row.collectorName}</td>
                <td class="num">${row.loanAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                <td class="num">${row.target.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                <td class="num">${row.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                <td class="num">${row.actual > 0 ? row.actual.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : ''}</td>
            </tr>
        `).join('');

        const totalTarget = reportRows.reduce((s, r) => s + r.target, 0);
        const totalBalance = reportRows.reduce((s, r) => s + r.balance, 0);
        const totalActual = reportRows.reduce((s, r) => s + r.actual, 0);

        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; padding: 25mm; }
  .header-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
  .brand-wrap { display: flex; align-items: center; gap: 10px; }
  .brand-logo { width: 48px; height: 48px; object-fit: contain; }
  .brand { font-size: 18pt; font-weight: 900; color: #1E3A8A; letter-spacing: 0.5px; }
  .sub { font-size: 10pt; color: #888; }
  .report-title { font-size: 16pt; font-weight: 800; color: #111; }
  .report-meta { font-size: 10pt; color: #555; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; table-layout: fixed; }
  thead tr { background-color: #FFC000; }
  th {
    border: 1px solid #d0a000;
    font-size: 9pt; font-weight: 800;
    padding: 8px 6px;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
  }
  td {
    border: 1px solid #ccc;
    font-size: 9.5pt;
    padding: 6px 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  th.num, td.num { text-align: right; }
  col.client  { width: 16%; }
  col.address { width: 22%; }
  col.coll    { width: 12%; }
  col.loan    { width: 10%; }
  col.target  { width: 10%; }
  col.bal     { width: 10%; }
  col.actual  { width: 10%; }
  .totals-row td { font-weight: 800; background: #fff3cd; border-top: 2px solid #FFC000; padding: 8px 6px; }
  @page { margin: 25mm; size: A4 landscape; }
  @media print { body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="header-row">
    <div class="brand-wrap">
      <img class="brand-logo" src="${logoBase64}" alt="${COMPANY_NAME} logo" />
      <div>
        <div class="brand">${COMPANY_NAME}</div>
        <div class="sub">Weekly Collection Sheet</div>
      </div>
    </div>
    <div style="text-align:right">
      <div class="report-title">Weekly Collection</div>
      <div class="report-meta">${dateRangeStr}${collectorLabel ? ' &nbsp;|&nbsp; Collector: ' + collectorLabel : ''}</div>
    </div>
  </div>
  <table>
    <colgroup>
      <col class="client"/><col class="address"/><col class="coll"/>
      <col class="loan"/><col class="target"/><col class="bal"/><col class="actual"/>
    </colgroup>
    <thead>
      <tr>
        <th>Name Of Client</th>
        <th>Address</th>
        <th>Collector</th>
        <th class="num">Loan Amount</th>
        <th class="num">Target Collection</th>
        <th class="num">Total Loan Balance</th>
        <th class="num">Actual Collection</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="totals-row">
        <td colspan="3">TOTAL (${reportRows.length} clients)</td>
        <td class="num"></td>
        <td class="num">${totalTarget.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
        <td class="num">${totalBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
        <td class="num">${totalActual.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;

        try {
            if (Platform.OS === 'web') {
                const win = window.open('', '_blank');
                if (win) {
                    win.document.write(html);
                    win.document.close();
                    win.focus();
                    setTimeout(() => win.print(), 500);
                }
            } else {
                const { uri } = await Print.printToFileAsync({ html });
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            }
        } catch (error) {
            console.error('Printing failed:', error);
        }
    };

    // ─── UI ───────────────────────────────────────────────────────────────────────
    const HEADER_BG = '#FFC000';
    const HEADER_TEXT = '#333';

    const thStyle = (w: number, right = false) => ({
        width: w,
        minWidth: w,
        backgroundColor: HEADER_BG,
        borderWidth: 1,
        borderColor: '#d0a000',
        padding: 5,
        textAlign: right ? ('right' as const) : ('left' as const),
        fontSize: 10,
        fontWeight: '800' as const,
        color: HEADER_TEXT,
    });

    const tdStyle = (w: number, right = false, bg = '#fff') => ({
        width: w,
        minWidth: w,
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 4,
        textAlign: right ? ('right' as const) : ('left' as const),
        fontSize: 10,
        color: '#111',
        backgroundColor: bg,
    });

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            {/* ── Top controls ── */}
            <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <View>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: '#111' }}>Weekly Collection Sheet</Text>
                        <Text style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
                            {formatDate(weekRange.start)} — {formatDate(weekRange.end)}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                            onPress={exportToExcel}
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#16a34a', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                        >
                            <MaterialIcons name="file-download" size={16} color="white" />
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>Export</Text>
                        </Pressable>
                        <Pressable
                            onPress={printReport}
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E3A8A', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                        >
                            <MaterialIcons name="print" size={16} color="white" />
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>Print PDF</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Week selector */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                    <Pressable
                        testID="prev-week"
                        onPress={() => setWeekOffset(prev => prev - 1)}
                        style={{ backgroundColor: '#f3f4f6', padding: 8, borderRadius: 10 }}
                    >
                        <MaterialIcons name="chevron-left" size={20} color="#1E3A8A" />
                    </Pressable>
                    <Pressable
                        onPress={() => setWeekOffset(0)}
                        style={{ backgroundColor: '#f3f4f6', flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}
                    >
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#666', textTransform: 'uppercase' }}>Current Week</Text>
                    </Pressable>
                    <Pressable
                        testID="next-week"
                        onPress={() => setWeekOffset(prev => prev + 1)}
                        style={{ backgroundColor: '#f3f4f6', padding: 8, borderRadius: 10 }}
                    >
                        <MaterialIcons name="chevron-right" size={20} color="#1E3A8A" />
                    </Pressable>
                </View>

                {/* Collector filter pills */}
                <Text style={{ fontSize: 10, color: '#999', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Filter Collector</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {[{ id: 'all', fullName: 'All' }, ...collectors].map(c => (
                        <Pressable
                            key={c.id}
                            onPress={() => setSelectedCollectorId(c.id)}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 5,
                                borderRadius: 20,
                                marginRight: 6,
                                backgroundColor: selectedCollectorId === c.id ? '#1E3A8A' : '#e5e7eb',
                            }}
                        >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: selectedCollectorId === c.id ? '#fff' : '#555' }}>
                                {c.fullName}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            {loading && reportRows.length === 0
                ? <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 40 }} />
                : (
                    <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
                        <View style={{ minWidth: TABLE_WIDTH }}>
                            {/* Frozen Header row */}
                            <View style={{ flexDirection: 'row' }}>
                                <Text style={thStyle(COL_CLIENT)}>Name Of Client</Text>
                                <Text style={thStyle(COL_ADDRESS)}>Address</Text>
                                <Text style={thStyle(COL_COLLECTOR)}>Collector</Text>
                                <Text style={thStyle(COL_LOAN, true)}>Loan Amount</Text>
                                <Text style={thStyle(COL_TARGET, true)}>Target Collection</Text>
                                <Text style={thStyle(COL_BALANCE, true)}>Total Loan Balance</Text>
                                <Text style={thStyle(COL_ACTUAL, true)}>Actual Collection</Text>
                            </View>

                            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 80 }}>
                                {/* Data rows */}
                                {reportRows.length === 0 ? (
                                    <View style={{ padding: 40, alignItems: 'center' }}>
                                        <MaterialIcons name="event-busy" size={48} color="#ccc" />
                                        <Text style={{ color: '#aaa', marginTop: 10 }}>No collections found for this week.</Text>
                                    </View>
                                ) : (
                                    reportRows.map((row, i) => {
                                        const bg = i % 2 === 0 ? '#ffffff' : '#f9f9f9';
                                        return (
                                            <View key={i} style={{ flexDirection: 'row' }}>
                                                <Pressable 
                                                    onPress={() => row.borrowerId && router.push(`/(admin)/borrowers/${row.borrowerId}`)}
                                                    style={tdStyle(COL_CLIENT, false, bg)}
                                                >
                                                    <Text style={{ fontSize: 10, color: '#1E3A8A', textDecorationLine: 'underline', fontWeight: 'bold' }} numberOfLines={1}>
                                                        {row.borrowerName}
                                                    </Text>
                                                </Pressable>
                                                <Text style={tdStyle(COL_ADDRESS, false, bg)} numberOfLines={1}>{row.address}</Text>
                                                <Text style={tdStyle(COL_COLLECTOR, false, bg)} numberOfLines={1}>{row.collectorName}</Text>
                                                <Text style={tdStyle(COL_LOAN, true, bg)}>{row.loanAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
                                                <Text style={tdStyle(COL_TARGET, true, bg)}>{row.target.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
                                                <Text style={tdStyle(COL_BALANCE, true, bg)}>{row.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
                                                <Text style={tdStyle(COL_ACTUAL, true, bg)}>
                                                    {row.actual > 0 ? row.actual.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : ''}
                                                </Text>
                                            </View>
                                        );
                                    })
                                )}

                                {/* Totals row */}
                                {reportRows.length > 0 && (
                                    <View style={{ flexDirection: 'row', backgroundColor: '#fff3cd', borderTopWidth: 2, borderTopColor: '#FFC000' }}>
                                        <Text style={{ ...tdStyle(COL_CLIENT + COL_ADDRESS + COL_COLLECTOR, false, '#fff3cd'), fontWeight: '800' }}>
                                            TOTAL ({reportRows.length} clients)
                                        </Text>
                                        <Text style={{ ...tdStyle(COL_LOAN, true, '#fff3cd'), fontWeight: '800' }}></Text>
                                        <Text style={{ ...tdStyle(COL_TARGET, true, '#fff3cd'), fontWeight: '800' }}>
                                            {reportRows.reduce((s, r) => s + r.target, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                        </Text>
                                        <Text style={{ ...tdStyle(COL_BALANCE, true, '#fff3cd'), fontWeight: '800' }}>
                                            {reportRows.reduce((s, r) => s + r.balance, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                        </Text>
                                        <Text style={{ ...tdStyle(COL_ACTUAL, true, '#fff3cd'), fontWeight: '800' }}>
                                            {reportRows.reduce((s, r) => s + r.actual, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>

                )}
        </View>
    );
}
