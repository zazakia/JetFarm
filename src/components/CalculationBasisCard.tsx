import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LoanCalculatorService } from '../services/LoanCalculatorService';

interface CalculationBasisCardProps {
    interestType?: string;
    title?: string;
}

export function CalculationBasisCard({ interestType = 'flat', title = 'Calculation Basis' }: CalculationBasisCardProps) {
    const basis = LoanCalculatorService.getFormulaBasis(interestType);

    return (
        <View className="bg-gray-50 p-5 rounded-2xl border border-gray-100 mt-4">
            <View className="flex-row items-center mb-4">
                <MaterialIcons name="info-outline" size={18} color="#4B5563" className="mr-2" />
                <Text className="text-xs font-black text-gray-700 uppercase tracking-widest">{title}</Text>
            </View>

            <View className="space-y-4">
                <FormulaItem 
                    label="Total Interest" 
                    formula={basis.interest} 
                    description="Calculated based on the selected interest rate and principal amount."
                />
                <FormulaItem 
                    label="Total Loan" 
                    formula={basis.totalLoan} 
                    description="The aggregate amount that includes principal, interest, and all fees/savings."
                />
                <FormulaItem 
                    label="Installment" 
                    formula={basis.installment} 
                    description="The amount collected per payment frequency (Daily, Weekly, etc.)"
                />
                <FormulaItem 
                    label="Net Release" 
                    formula={basis.netRelease} 
                    description="The actual cash received by the borrower after deducting the previous loan balance."
                />
            </View>
        </View>
    );
}

function FormulaItem({ label, formula, description }: { label: string; formula: string; description: string }) {
    return (
        <View className="mb-4">
            <Text className="text-[10px] font-bold text-blue-600 uppercase mb-1">{label}</Text>
            <View className="bg-white/80 p-3 rounded-xl border border-blue-50">
                <Text className="text-sm font-black text-gray-900 mb-1">{formula}</Text>
                <Text className="text-[10px] text-gray-700 leading-3">{description}</Text>
            </View>
        </View>
    );
}
