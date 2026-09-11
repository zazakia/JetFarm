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
                            The cooperative is registered as a Savings and Credit Cooperative under the Cooperative Development Authority (CDA) with Certificate of Registration No. {notes.registrationNumber}. Its primary goal is to promote thrift and provide credit facilities to members for productive and provident purposes.
                        </Text>

                        {/* Note 2: Significant Accounting Policies */}
                        {renderNoteHeader(2, 'Significant Accounting Policies')}
                        <Text className="text-[11px] text-gray-600 leading-relaxed mb-2">
                            Revenues are recognized upon receipt of cash for interest income, service fees, and other charges (cash basis). Expenses are recognized on accrual basis. Financial assets are measured at face value.
                        </Text>

                        {/* Note 5: Cash and Cash Equivalents */}
                        {renderNoteHeader(5, 'Cash and Cash Equivalents')}
                        {renderItem('Cash on Hand', notes.cashNote.cashOnHand)}
                        {renderItem('Cash in Bank', notes.cashNote.cashInBank)}
                        <View className="flex-row justify-between py-2.5 bg-slate-50 px-2 rounded mt-2 border-t border-slate-200">
                            <Text className="text-xs font-bold text-slate-900">Total Cash</Text>
                            <Text className="text-xs font-bold text-slate-900">{formatPHP(notes.cashNote.total).replace('PHP ', '')}</Text>
                        </View>

                        {/* Note 6: Loans and Receivables */}
                        {renderNoteHeader(6, 'Loans and Receivables')}
                        {renderItem('Loans Receivable - Current', notes.loanNote.current)}
                        {renderItem('Loans Receivable - Past Due', notes.loanNote.pastDue)}
                        {renderItem('Gross Loans Receivable', notes.loanNote.outstandingLoans)}
                        {renderItem('Less: Allowance for Probable Losses', -notes.loanNote.allowance)}
                        <View className="flex-row justify-between py-2.5 bg-slate-50 px-2 rounded mt-2 border-t border-slate-200">
                            <Text className="text-xs font-bold text-slate-900">Net Loan Portfolio</Text>
                            <Text className="text-xs font-bold text-slate-900">{formatPHP(notes.loanNote.net).replace('PHP ', '')}</Text>
                        </View>

                        {/* Note 7: Other Non-Current Assets */}
                        {renderNoteHeader(7, 'Other Non-Current Assets')}
                        {renderItem('Sundry Assets', bs.assets.sundryAssets.current)}

                        {/* Note 8: Deposit Liabilities */}
                        {renderNoteHeader(8, 'Deposit Liabilities')}
                        {renderItem('Member Savings Deposits', bs.liabilities.depositLiabilities.current)}
                        <Text className="text-[10px] text-gray-400 italic mt-1 leading-relaxed">
                            Note: Savings deposits earn interest at a rate of 6% per annum.
                        </Text>

                        {/* Note 9: Interest on Share Capital Payable */}
                        {renderNoteHeader(9, 'Interest on Share Capital Payable')}
                        {renderItem('Beginning Balance', bs.liabilities.interestShareCapitalPayable.prior)}
                        {renderItem('Add: Allocation from Net Surplus', ops.allocations.find(a => a.fundType.includes('share capital'))?.amount ?? 0)}
                        {renderItem('Ending Balance', bs.liabilities.interestShareCapitalPayable.current)}

                        {/* Note 10: Patronage Refund Payable */}
                        {renderNoteHeader(10, 'Patronage Refund Payable')}
                        {renderItem('Beginning Balance', bs.liabilities.patronageRefundPayable.prior)}
                        {renderItem('Add: Allocation from Net Surplus', ops.allocations.find(a => a.fundType.includes('Patronage'))?.amount ?? 0)}
                        {renderItem('Ending Balance', bs.liabilities.patronageRefundPayable.current)}

                        {/* Note 11: Due to Union / Federation */}
                        {renderNoteHeader(11, 'Due to Union / Federation')}
                        {renderItem('Beginning Balance', bs.liabilities.dueToUnion.prior)}
                        {renderItem('Add: Allocation from Net Surplus', ops.allocations.find(a => a.fundType.includes('Union'))?.amount ?? 0)}
                        {renderItem('Ending Balance', bs.liabilities.dueToUnion.current)}

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

                        {/* Note 13: Income from Credit Operations */}
                        {renderNoteHeader(13, 'Income from Credit Operations')}
                        {renderItem('Interest income from loans', ops.revenues.interestOnLoans.current)}
                        {renderItem('Service Fees', ops.revenues.serviceCharges.current)}
                        {renderItem('Fines and penalties', ops.revenues.penalties.current)}
                        <View className="flex-row justify-between py-2.5 bg-slate-50 px-2 rounded mt-2 border-t border-slate-200">
                            <Text className="text-xs font-bold text-slate-900">Total Credit Ops Income</Text>
                            <Text className="text-xs font-bold text-slate-900">{formatPHP(ops.revenues.totalCreditOps.current).replace('PHP ', '')}</Text>
                        </View>

                        {/* Note 14: Other Income */}
                        {renderNoteHeader(14, 'Other Income')}
                        {renderItem('Membership Fees', ops.revenues.membershipFees.current)}
                        {renderItem('Interest income on investments', ops.revenues.interestOnInvestments.current)}
                        {renderItem('Miscellaneous Income', ops.revenues.miscellaneousIncome.current)}
                        <View className="flex-row justify-between py-2.5 bg-slate-50 px-2 rounded mt-2 border-t border-slate-200">
                            <Text className="text-xs font-bold text-slate-900">Total Other Income</Text>
                            <Text className="text-xs font-bold text-slate-900">{formatPHP(ops.revenues.totalOtherIncome.current).replace('PHP ', '')}</Text>
                        </View>

                        {/* Note 15: Financing Costs */}
                        {renderNoteHeader(15, 'Financing Costs')}
                        {renderItem('Interest on Deposit Liabilities', ops.expenses.financingCosts.current)}

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
