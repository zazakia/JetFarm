import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CoopFinancialReportService, CdaNotes, CdaBalanceSheet, CdaOperationsStatement } from '../../../src/services/CoopFinancialReportService';
import { formatPHP } from '../../../src/utils/currency';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function NotesToFSScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const year = params.year ? parseInt(params.year as string) : 2025;

    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState<CdaNotes | null>(null);
    const [bs, setBs] = useState<CdaBalanceSheet | null>(null);
    const [ops, setOps] = useState<CdaOperationsStatement | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [notesData, bsData, opsData] = await Promise.all([
                CoopFinancialReportService.getNotesToFinancialStatements(year),
                CoopFinancialReportService.getStatementOfFinancialCondition(year),
                CoopFinancialReportService.getStatementOfOperations(year)
            ]);
            setNotes(notesData);
            setBs(bsData);
            setOps(opsData);
        } catch (error) {
            console.error('Failed to load Notes to FS:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [year])
    );

    const renderNoteHeader = (num: number, title: string) => (
        <View className="bg-slate-800 px-4 py-2 mt-6 rounded-lg mb-3">
            <Text className="font-black text-white text-xs uppercase">Note {num} — {title}</Text>
        </View>
    );

    const renderItem = (label: string, value: number | string) => (
        <View className="flex-row justify-between py-2 border-b border-gray-100 px-1">
            <Text className="text-gray-600 text-xs flex-[2]">{label}</Text>
            <Text className="text-slate-900 font-bold text-xs flex-[1] text-right">
                {typeof value === 'number' ? formatPHP(value).replace('PHP ', '') : value}
            </Text>
        </View>
    );

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#0F172A" />
                <Text className="text-gray-500 font-medium text-xs mt-3">Compiling Notes to Financial Statements...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            {/* Toolbar */}
            <View className="flex-row justify-between items-center px-4 py-3 bg-white border-b border-gray-200">
                <View className="flex-row items-center">
                    <Pressable onPress={() => router.back()} className="p-2 mr-2 rounded-full active:bg-gray-150">
                        <MaterialIcons name="arrow-back" size={20} color="#334155" />
                    </Pressable>
                    <Text className="text-lg font-black text-gray-900">Notes to FS</Text>
                </View>
                <Text className="font-black text-slate-500 text-sm">FY {year}</Text>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                {notes && bs && ops ? (
                    <Animated.View entering={FadeInDown.springify()} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
                        
                        <View className="items-center pb-4 border-b border-gray-100">
                            <Text className="text-center font-black text-slate-900 tracking-wider text-[11px] uppercase">
                                {notes.organizationName}
                            </Text>
                            <Text className="text-center text-[10px] text-gray-500 mt-1">
                                {notes.organizationAddress}
                            </Text>
                            <Text className="text-center font-bold text-gray-900 text-sm mt-3 uppercase tracking-widest">
                                Notes to Financial Statements
                            </Text>
                            <Text className="text-center text-[10px] text-gray-400 italic">
                                For the fiscal year ended December 31, {year}
                            </Text>
                        </View>

                        {/* Note 1: Organization */}
                        {renderNoteHeader(1, 'General Information')}
                        <Text className="text-[11px] text-gray-600 leading-relaxed mb-2">
                            {notes.organizationName} develops agricultural land into crop production cycles shared with land owners and capital partners, and settles the harvest on a per-kilo basis. Registered with the Cooperative Development Authority (CDA) under Certificate of Registration No. {notes.registrationNumber}.
                        </Text>

                        {/* Note 2: Significant Accounting Policies */}
                        {renderNoteHeader(2, 'Significant Accounting Policies')}
                        <Text className="text-[11px] text-gray-600 leading-relaxed mb-2">
                            Harvest revenue is recognized when the delivered kilos are weighed in and the off-take price per kilo is agreed. Farm inputs are expensed to the crop cycle in which they are applied; field labor is expensed when the work is performed and land-owner settlements at the computed payout for the week. Section totals are struck on the whole account class, so an account the presentation does not name is still included. Financial assets are measured at cost.
                        </Text>

                        {/* Note 5: Cash and Cash Equivalents */}
                        {renderNoteHeader(5, 'Cash and Cash Equivalents')}
                        {renderItem('Cash on Hand', notes.cashNote.cashOnHand)}
                        {renderItem('Cash in Bank', notes.cashNote.cashInBank)}
                        <View className="flex-row justify-between py-2.5 bg-slate-50 px-2 rounded mt-2 border-t border-slate-200">
                            <Text className="text-xs font-bold text-slate-900">Total Cash</Text>
                            <Text className="text-xs font-bold text-slate-900">{formatPHP(notes.cashNote.total).replace('PHP ', '')}</Text>
                        </View>

                        {/* Note 6: Farm Assets */}
                        {renderNoteHeader(6, 'Standing Crops, Produce & Farm Inputs')}
                        {renderItem('Biological assets — standing crops', notes.farmAssetNote.standingCrops)}
                        {renderItem('Harvested produce awaiting delivery', notes.farmAssetNote.harvestedProduce)}
                        {renderItem('Agricultural supplies in storage', notes.farmAssetNote.farmInputsInventory)}
                        <View className="flex-row justify-between py-2.5 bg-slate-50 px-2 rounded mt-2 border-t border-slate-200">
                            <Text className="text-xs font-bold text-slate-900">Total Farm Assets</Text>
                            <Text className="text-xs font-bold text-slate-900">{formatPHP(notes.farmAssetNote.total).replace('PHP ', '')}</Text>
                        </View>

                        {/* Note 7: Other Non-Current Assets */}
                        {renderNoteHeader(7, 'Other Non-Current Assets')}
                        {renderItem('Sundry Assets', bs.assets.sundryAssets.current)}

                        {/* Note 8: Land-Owner Settlements Payable */}
                        {renderNoteHeader(8, 'Land-Owner Settlements Payable')}
                        {renderItem('Settlements payable at year end', notes.settlementNote.landOwnerSettlementsPayable)}
                        <Text className="text-[10px] text-gray-400 italic mt-1 leading-relaxed">
                            Note: Recognized at the computed per-kilo payout for the harvest weeks weighed in and discharged through the weekly settlement run.
                        </Text>

                        {/* Note 9: Capital Partner Profit Share */}
                        {renderNoteHeader(9, 'Capital Partner Profit Share Payable')}
                        {renderItem('Beginning Balance', bs.liabilities.otherPayables.prior)}
                        {renderItem('Add: Allocation from Net Surplus', ops.allocations.find(a => a.fundType.includes('Capital Partner'))?.amount ?? 0)}
                        {renderItem('Ending Balance', bs.liabilities.otherPayables.current)}

                        {/* Note 10: Field Labor Payable */}
                        {renderNoteHeader(10, 'Field Labor Payable')}
                        {renderItem('Beginning Balance', bs.liabilities.laborPayable.prior)}
                        {renderItem('Ending Balance', bs.liabilities.laborPayable.current)}

                        {/* Note 11: Accounts Payable */}
                        {renderNoteHeader(11, 'Accounts Payable')}
                        {renderItem('Beginning Balance', bs.liabilities.accountsPayable.prior)}
                        {renderItem('Ending Balance', bs.liabilities.accountsPayable.current)}

                        {/* Note 12: Statutory Funds */}
                        {renderNoteHeader(12, 'Statutory Funds')}
                        {renderItem('Reserve Fund', notes.statutoryNote.reserveFund)}
                        {renderItem('Education and Training Fund', notes.statutoryNote.educationFund)}
                        {renderItem('Community Development Fund', notes.statutoryNote.communityDevFund)}
                        {renderItem('Optional Fund', notes.statutoryNote.optionalFund)}
                        <View className="flex-row justify-between py-2.5 bg-slate-50 px-2 rounded mt-2 border-t border-slate-200">
                            <Text className="text-xs font-bold text-slate-900">Total Statutory Funds</Text>
                            <Text className="text-xs font-bold text-slate-900">{formatPHP(notes.statutoryNote.total).replace('PHP ', '')}</Text>
                        </View>

                        {/* Note 13: Harvest Revenue */}
                        {renderNoteHeader(13, 'Harvest Revenue')}
                        {renderItem('Off-take revenue', ops.revenues.offtakeRevenue.current)}
                        {renderItem('By-product & residue revenue', ops.revenues.byproductRevenue.current)}
                        <View className="flex-row justify-between py-2.5 bg-slate-50 px-2 rounded mt-2 border-t border-slate-200">
                            <Text className="text-xs font-bold text-slate-900">Total Harvest Revenue</Text>
                            <Text className="text-xs font-bold text-slate-900">{formatPHP(ops.revenues.offtakeRevenue.current + ops.revenues.byproductRevenue.current).replace('PHP ', '')}</Text>
                        </View>

                        {/* Note 14: Other Revenue */}
                        {renderNoteHeader(14, 'Other Revenue')}
                        <Text className="text-[11px] text-gray-600 leading-relaxed mb-2">
                            The 4xxx revenue accounts not presented as harvest revenue, computed as the whole class so nothing is omitted from total revenues.
                        </Text>
                        {renderItem('Other revenue accounts', ops.revenues.otherRevenue.current)}
                        <View className="flex-row justify-between py-2.5 bg-slate-50 px-2 rounded mt-2 border-t border-slate-200">
                            <Text className="text-xs font-bold text-slate-900">Total Other Revenue</Text>
                            <Text className="text-xs font-bold text-slate-900">{formatPHP(ops.revenues.otherRevenue.current).replace('PHP ', '')}</Text>
                        </View>

                        {/* Note 15: Farm Production Costs */}
                        {renderNoteHeader(15, 'Farm Production Costs')}
                        {renderItem('Land-owner settlements', ops.expenses.landOwnerSettlements.current)}
                        {renderItem('Field labor', ops.expenses.farmLabor.current)}
                        {renderItem('Farm inputs', ops.expenses.farmInputs.current)}
                        {renderItem('Machinery & logistics', ops.expenses.machineryAndLogistics.current)}
                        {renderItem('Other farm costs', ops.expenses.otherFarmCosts.current)}
                        <View className="flex-row justify-between py-2.5 bg-slate-50 px-2 rounded mt-2 border-t border-slate-200">
                            <Text className="text-xs font-bold text-slate-900">Total Farm Production Costs</Text>
                            <Text className="text-xs font-bold text-slate-900">{formatPHP(ops.expenses.farmProductionCosts.current).replace('PHP ', '')}</Text>
                        </View>

                        {/* Note 16: Administrative Costs */}
                        {renderNoteHeader(16, 'Administrative Costs')}
                        {renderItem('Salaries and Wages', ops.expenses.salaries.current)}
                        {renderItem('Office Expenses', ops.expenses.office.current)}
                        {renderItem('Communication Expenses', ops.expenses.communication.current)}
                        {renderItem('Transportation Expenses', ops.expenses.transportation.current)}
                        {renderItem('Depreciation & Amortization', ops.expenses.depreciation.current)}
                        {renderItem('Taxes & Licenses', ops.expenses.taxes.current)}
                        {renderItem('Repairs & Maintenance', ops.expenses.repairs.current)}
                        {renderItem('Training & Development', ops.expenses.training.current)}
                        {renderItem('Professional Fees', ops.expenses.professional.current)}
                        {renderItem('Other Operating Expenses', ops.expenses.otherExpenses.current)}
                        <View className="flex-row justify-between py-2.5 bg-slate-50 px-2 rounded mt-2 border-t border-slate-200">
                            <Text className="text-xs font-bold text-slate-900">Total Administrative Costs</Text>
                            <Text className="text-xs font-bold text-slate-900">{formatPHP(ops.expenses.totalAdminCosts.current).replace('PHP ', '')}</Text>
                        </View>

                    </Animated.View>
                ) : (
                    <View className="p-10 items-center">
                        <MaterialIcons name="error-outline" size={40} color="#D1D5DB" />
                        <Text className="text-gray-700 font-semibold mt-3">No notes data compiled</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
