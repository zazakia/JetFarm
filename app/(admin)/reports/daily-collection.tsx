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
import { MetricBreakdownDialog, BreakdownItem } from '../../../src/components/MetricBreakdownDialog';

interface CollectionRow {
    borrowerName: string;
    address: string;
    collectorName: string;
    loanAmount: number;
    totalLoan: number;
    target: number;
    totalPayments: number;
    balance: number;
    actual: number;
    borrowerId: string;
}

// Column widths for the table
const COL_CLIENT = 150;
const COL_ADDRESS = 150;
const COL_COLLECTOR = 100;
const COL_LOAN = 85;
const COL_TOTAL_LOAN = 85;
const COL_TARGET = 80;
const COL_TOTAL_PAYMENTS = 90;
const COL_BALANCE = 85;
const COL_ACTUAL = 80;
const TABLE_WIDTH = COL_CLIENT + COL_ADDRESS + COL_COLLECTOR + COL_LOAN + COL_TOTAL_LOAN + COL_TARGET + COL_TOTAL_PAYMENTS + COL_BALANCE + COL_ACTUAL;

export default function DailyCollectionReport() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [collectors, setCollectors] = useState<Collector[]>([]);
    const [selectedCollectorId, setSelectedCollectorId] = useState<string>('all');
    const [selectedDate] = useState(new Date());
    const [reportRows, setReportRows] = useState<CollectionRow[]>([]);
    const [breakdownVisible, setBreakdownVisible] = useState(false);
    const [breakdownData, setBreakdownData] = useState<{ title: string; total: number; items: BreakdownItem[]; color: string }>({
        title: '', total: 0, items: [], color: 'text-amber-600'
    });

    const handleTotalCellClick = (type: 'loanAmount' | 'totalLoan' | 'target' | 'totalPayments' | 'balance' | 'actual', title: string) => {
        const items: BreakdownItem[] = reportRows
            .filter(r => (r[type] || 0) > 0)
            .map((r, i) => ({
                id: `${r.borrowerId}-${i}`,
                label: r.borrowerName,
                sublabel: `${r.collectorName} • ${r.address || 'No Address'}`,
                value: r[type],
                isCurrency: true,
                onPress: () => {
                    setBreakdownVisible(false);
                    if (r.borrowerId) router.push(`/(admin)/borrowers/${r.borrowerId}`);
                }
            }));

        const totalVal = reportRows.reduce((sum, r) => sum + (r[type] || 0), 0);

        setBreakdownData({
            title: `Daily Collection Breakdown: ${title}`,
            total: totalVal,
            items,
            color: 'text-amber-600',
        });
        setBreakdownVisible(true);
    };

    const loadCollectors = async () => {
        const allCollectors = await database.collections.get<Collector>('collectors').query(
            Q.where('is_active', Q.notEq(false))
        ).fetch();

        // Deduplicate by normalized name and filter junk
        const seen = new Map<string, Collector>();
        for (const c of allCollectors) {
            const name = (c.fullName || '').trim();
            const normalized = name.toLowerCase().replace(/\s+/g, ' ');
            if (!normalized ||
                normalized.includes('test') ||
                normalized.includes('fix') ||
                normalized.includes('diagnostic') ||
                normalized.includes('mock') ||
                /^collector\s*\d*$/.test(normalized) ||
                /^gera\s+gerald$/i.test(name)) {
                continue;
            }
            if (!seen.has(normalized) || (c.isActive && !seen.get(normalized)!.isActive)) {
                seen.set(normalized, c);
            }
        }
        setCollectors(Array.from(seen.values()));
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);

            // 1. Fetch ALL active loans
            let baseQuery = database.collections.get<Loan>('loans').query(
                Q.where('status', 'active')
            );
            if (selectedCollectorId !== 'all') {
                // Find borrowers for selected collector
                const borrowerIdsForCollector = await database.collections.get<Borrower>('borrowers')
                    .query(Q.where('collector_id', selectedCollectorId))
                    .fetchIds();

                if (borrowerIdsForCollector.length === 0) {
                    setReportRows([]);
                    return;
                }

                baseQuery = database.collections.get<Loan>('loans').query(
                    Q.where('status', 'active'),
                    Q.where('borrower_id', Q.oneOf(borrowerIdsForCollector))
                );
            }
            const activeLoans = await baseQuery.fetch();

            if (activeLoans.length === 0) {
                setReportRows([]);
                return;
            }

            const loanIds = activeLoans.map(l => l.id);

            // 2. Fetch borrowers for these loans
            const borrowerIds = [...new Set(activeLoans.map(l => l.borrowerId))];
            const borrowers = await database.collections.get<Borrower>('borrowers').query(
                Q.where('id', Q.oneOf(borrowerIds))
            ).fetch();
            const borrowerMap = new Map(borrowers.map(b => [b.id, b]));

            // 2.5 Fetch all collectors for name resolution
            const allCollectorsRaw = await database.collections.get<Collector>('collectors').query().fetch();
            const collectorMap = new Map(allCollectorsRaw.map(c => [c.id, c]));

            // 3. Fetch payments made TODAY (for Actual Collection column)
            const todayPayments = await database.collections.get<Payment>('payments').query(
                Q.where('payment_date', Q.between(startOfDay.getTime(), endOfDay.getTime())),
                Q.where('loan_id', Q.oneOf(loanIds))
            ).fetch();

            // 4. Fetch ALL payments for these loans (to calculate Balance)
            const allActivePayments = await database.collections.get<Payment>('payments').query(
                Q.where('loan_id', Q.oneOf(loanIds))
            ).fetch();

            // Group payments by loanId for fast lookup
            const paymentsByLoan = new Map<string, number>();
            allActivePayments.forEach(p => {
                const current = paymentsByLoan.get(p.loanId) || 0;
                paymentsByLoan.set(p.loanId, current + p.amount);
            });

            const rows: CollectionRow[] = [];
            for (const loan of activeLoans) {
                const borrower = borrowerMap.get(loan.borrowerId);
                if (!borrower) continue;

                const collector = collectorMap.get(borrower.collectorId);

                // Calculate cumulative balance using the grouped map
                const totalPaid = paymentsByLoan.get(loan.id) || 0;
                const balance = loan.totalAmount - totalPaid;

                // Actual collected today
                const actualToday = todayPayments
                    .filter(p => p.loanId === loan.id)
                    .reduce((sum, p) => sum + p.amount, 0);

                rows.push({
                    borrowerName: borrower.fullName,
                    address: borrower.address || '',
                    collectorName: collector?.fullName || 'Unassigned',
                    loanAmount: loan.principalAmount,
                    totalLoan: loan.totalAmount,
                    target: loan.installmentAmount || 0,
                    totalPayments: totalPaid,
                    balance: balance,
                    actual: actualToday,
                    borrowerId: borrower.id,
                });
            }

            // Sort by borrower name for easier reading
            rows.sort((a, b) => a.borrowerName.localeCompare(b.borrowerName));

            setReportRows(rows);
        } catch (error) {
            console.error('Failed to load daily collection report:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => {
        loadCollectors().then(() => loadData());
    }, [selectedCollectorId, selectedDate]));

    // ─── Excel Export ───────────────────────────────────────────────────────────
    const exportToExcel = async () => {
        try {
            const BOM = '\uFEFF';
            const headers = ['Client Name', 'Address', 'Collector', 'Loan Amount', 'Total Loan (P+I)', 'Target', 'Total Payments', 'Total Balance', 'Actual'];
            const totalLoanAmount = reportRows.reduce((sum, r) => sum + r.loanAmount, 0);
            const totalPPlusI = reportRows.reduce((sum, r) => sum + r.totalLoan, 0);
            const totalTarget = reportRows.reduce((sum, r) => sum + r.target, 0);
            const totalPayments = reportRows.reduce((sum, r) => sum + r.totalPayments, 0);
            const totalBalance = reportRows.reduce((sum, r) => sum + r.balance, 0);
            const totalActual = reportRows.reduce((sum, r) => sum + r.actual, 0);

            const csvRows = [
                headers.join(','),
                ...reportRows.map(row => [
                    `"${row.borrowerName.replace(/"/g, '""')}"`,
                    `"${row.address.replace(/"/g, '""')}"`,
                    `"${row.collectorName.replace(/"/g, '""')}"`,
                    row.loanAmount.toFixed(2),
                    row.totalLoan.toFixed(2),
                    row.target.toFixed(2),
                    row.totalPayments.toFixed(2),
                    row.balance.toFixed(2),
                    row.actual > 0 ? row.actual.toFixed(2) : '',
                ].join(',')),
                ['"TOTAL"', '""', '""', totalLoanAmount.toFixed(2), totalPPlusI.toFixed(2), totalTarget.toFixed(2), totalPayments.toFixed(2), totalBalance.toFixed(2), totalActual.toFixed(2)].join(',')
            ];
            const csvContent = BOM + csvRows.join('\n');
            const fileName = `Daily_Collection_${formatDate(selectedDate).replace(/ /g, '_')}.csv`;

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
                    dialogTitle: 'Export Daily Collection',
                    UTI: 'public.comma-separated-values-text',
                });
            }
        } catch (error) {
            console.error('Export to Excel failed:', error);
        }
    };

    // ─── Print / PDF ─────────────────────────────────────────────────────────────
    const printReport = async () => {
        const dateStr = formatDate(selectedDate);
        const collectorLabel = selectedCollectorId === 'all'
            ? 'All Collectors'
            : collectors.find(c => c.id === selectedCollectorId)?.fullName ?? '';

        const rowsHtml = reportRows.map((row, i) => `
            <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9f9f9'}">
                <td>${row.borrowerName}</td>
                <td>${row.address}</td>
                <td>${row.collectorName}</td>
                <td class="num">${row.loanAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                <td class="num">${row.totalLoan.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                <td class="num">${row.target.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                <td class="num">${row.totalPayments.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                <td class="num">${row.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                <td class="num">${row.actual > 0 ? row.actual.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : ''}</td>
            </tr>
        `).join('');

        const totalLoanAmount = reportRows.reduce((s, r) => s + r.loanAmount, 0);
        const totalPPlusI = reportRows.reduce((s, r) => s + r.totalLoan, 0);
        const totalTarget = reportRows.reduce((s, r) => s + r.target, 0);
        const totalPayments = reportRows.reduce((s, r) => s + r.totalPayments, 0);
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
    font-size: 8pt; font-weight: 800;
    padding: 8px 4px;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
  }
  td {
    border: 1px solid #ccc;
    font-size: 8.5pt;
    padding: 6px 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  th.num, td.num { text-align: right; }
  col.client  { width: 16%; }
  col.address { width: 22%; }
  col.coll    { width: 12%; }
  col.loan    { width: 10%; }
  col.total   { width: 10%; }
  col.target  { width: 9%; }
  col.pay     { width: 10%; }
  col.bal     { width: 11%; }
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
        <div class="sub">Daily Collection Sheet</div>
      </div>
    </div>
    <div style="text-align:right">
      <div class="report-title">Daily Collection</div>
      <div class="report-meta">${dateStr}${collectorLabel ? ' &nbsp;|&nbsp; Collector: ' + collectorLabel : ''}</div>
    </div>
  </div>
  <table>
    <colgroup>
      <col class="client"/><col class="address"/><col class="coll"/>
      <col class="loan"/><col class="total"/><col class="target"/><col class="pay"/><col class="bal"/><col class="actual"/>
    </colgroup>
    <thead>
      <tr>
        <th>Name Of Client</th>
        <th>Address</th>
        <th>Collector</th>
        <th class="num">Loan Amount</th>
        <th class="num">Total Loan (P+I)</th>
        <th class="num">Target Collection</th>
        <th class="num">Total Payments</th>
        <th class="num">Total Loan Balance</th>
        <th class="num">Actual Collection</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="totals-row">
        <td colspan="3">TOTAL (${reportRows.length} clients)</td>
        <td class="num">${totalLoanAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
        <td class="num">${totalPPlusI.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
        <td class="num">${totalTarget.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
        <td class="num">${totalPayments.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
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
                        <Text style={{ fontSize: 20, fontWeight: '900', color: '#111' }}>Daily Collection Sheet</Text>
                        <Text style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>{formatDate(selectedDate)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                            onPress={exportToExcel}
                            testID="export-csv"
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#16a34a', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                        >
                            <MaterialIcons name="file-download" size={16} color="white" />
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>Export</Text>
                        </Pressable>
                        <Pressable
                            onPress={printReport}
                            testID="print-pdf"
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E3A8A', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                        >
                            <MaterialIcons name="print" size={16} color="white" />
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>Print PDF</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Collector filter pills */}
                <Text style={{ fontSize: 10, color: '#999', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Filter Collector</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {[{ id: 'all', fullName: 'All' }, ...collectors].map(c => (
                        <Pressable
                            key={c.id}
                            onPress={() => setSelectedCollectorId(c.id)}
                            testID={`collector-pill-${c.id}`}
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
                ? <ActivityIndicator testID="loading-indicator" size="large" color="#1E3A8A" style={{ marginTop: 40 }} />
                : (
                    <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
                        <View style={{ minWidth: TABLE_WIDTH }}>
                            {/* Frozen Header row */}
                            <View style={{ flexDirection: 'row' }}>
                                <Text style={thStyle(COL_CLIENT)}>Name Of Client</Text>
                                <Text style={thStyle(COL_ADDRESS)}>Address</Text>
                                <Text style={thStyle(COL_COLLECTOR)}>Collector</Text>
                                <Text style={thStyle(COL_LOAN, true)}>Loan Amount</Text>
                                <Text style={thStyle(COL_TOTAL_LOAN, true)}>Total Loan (P+I)</Text>
                                <Text style={thStyle(COL_TARGET, true)}>Target Collection</Text>
                                <Text style={thStyle(COL_TOTAL_PAYMENTS, true)}>Total Payments</Text>
                                <Text style={thStyle(COL_BALANCE, true)}>Total Loan Balance</Text>
                                <Text style={thStyle(COL_ACTUAL, true)}>Actual Collection</Text>
                            </View>

                            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 80 }}>
                                {/* Data rows */}
                                {reportRows.length === 0 ? (
                                    <View style={{ padding: 40, alignItems: 'center' }}>
                                        <MaterialIcons name="event-busy" size={48} color="#ccc" />
                                        <Text style={{ color: '#aaa', marginTop: 10 }}>No active loans found.</Text>
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
                                                <Text style={tdStyle(COL_TOTAL_LOAN, true, bg)}>{row.totalLoan.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
                                                <Text style={tdStyle(COL_TARGET, true, bg)}>{row.target.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
                                                <Text style={tdStyle(COL_TOTAL_PAYMENTS, true, bg)}>{row.totalPayments.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
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
                                        <Pressable onPress={() => handleTotalCellClick('loanAmount', 'Loan Amounts')} style={{ width: COL_LOAN }}>
                                            <Text style={{ ...tdStyle(COL_LOAN, true, '#fff3cd'), fontWeight: '800' }}>
                                                {reportRows.reduce((s, r) => s + r.loanAmount, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                            </Text>
                                        </Pressable>
                                        <Pressable onPress={() => handleTotalCellClick('totalLoan', 'Total Loan (P+I)')} style={{ width: COL_TOTAL_LOAN }}>
                                            <Text style={{ ...tdStyle(COL_TOTAL_LOAN, true, '#fff3cd'), fontWeight: '800' }}>
                                                {reportRows.reduce((s, r) => s + r.totalLoan, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                            </Text>
                                        </Pressable>
                                        <Pressable onPress={() => handleTotalCellClick('target', 'Target Collections')} style={{ width: COL_TARGET }}>
                                            <Text style={{ ...tdStyle(COL_TARGET, true, '#fff3cd'), fontWeight: '800' }}>
                                                {reportRows.reduce((s, r) => s + r.target, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                            </Text>
                                        </Pressable>
                                        <Pressable onPress={() => handleTotalCellClick('totalPayments', 'Total Payments')} style={{ width: COL_TOTAL_PAYMENTS }}>
                                            <Text style={{ ...tdStyle(COL_TOTAL_PAYMENTS, true, '#fff3cd'), fontWeight: '800' }}>
                                                {reportRows.reduce((s, r) => s + r.totalPayments, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                            </Text>
                                        </Pressable>
                                        <Pressable onPress={() => handleTotalCellClick('balance', 'Total Balances')} style={{ width: COL_BALANCE }}>
                                            <Text style={{ ...tdStyle(COL_BALANCE, true, '#fff3cd'), fontWeight: '800' }}>
                                                {reportRows.reduce((s, r) => s + r.balance, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                            </Text>
                                        </Pressable>
                                        <Pressable onPress={() => handleTotalCellClick('actual', 'Actual Collections')} style={{ width: COL_ACTUAL }}>
                                            <Text style={{ ...tdStyle(COL_ACTUAL, true, '#fff3cd'), fontWeight: '800' }}>
                                                {reportRows.reduce((s, r) => s + r.actual, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                            </Text>
                                        </Pressable>
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                )}

            <MetricBreakdownDialog
                visible={breakdownVisible}
                onClose={() => setBreakdownVisible(false)}
                {...breakdownData}
            />
        </View>
    );
}
