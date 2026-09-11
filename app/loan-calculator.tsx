import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LoanCalculatorService } from '../src/services/LoanCalculatorService';
import { formatPHP } from '../src/utils/currency';
import {
    isInstitutionalLoanType,
    LOAN_PRODUCT_PRESETS,
    LoanProductType,
    loanProductLabel,
    processingFeeFromPrincipal,
    notarialFeeFromPrincipal,
    validateLoanProductPrincipal,
    validateLoanProductTerm,
} from '../src/utils/loanProducts';
import { lookupApr2026Insurance } from '../src/utils/insuranceTable';

type Frequency = 'daily' | 'weekly' | 'bi_monthly' | 'monthly';
type TermUnit = 'months' | 'days' | 'weeks';

export default function OnlineLoanCalculatorScreen() {
    const router = useRouter();
    const [loanType, setLoanType] = useState<LoanProductType>('standard');
    const [principal, setPrincipal] = useState('10000');
    const [ratePercent, setRatePercent] = useState('2.5');
    const [term, setTerm] = useState('6');
    const [termUnit, setTermUnit] = useState<TermUnit>('months');
    const [frequency, setFrequency] = useState<Frequency>('monthly');
    const [savingsPerPayment, setSavingsPerPayment] = useState('0');
    const [rebateAmount, setRebateAmount] = useState('0');

    const principalNumber = parseFloat(principal || '0') || 0;
    const tableInsurance = lookupApr2026Insurance({
        principal: principalNumber,
        term: parseInt(term || '0', 10) || 0,
        termUnit,
    });
    const processingFee = processingFeeFromPrincipal(loanType, principalNumber);
    const notarialFee = notarialFeeFromPrincipal(loanType, principalNumber);

    const validationMessage = useMemo(() => {
        return validateLoanProductPrincipal(loanType, principal)
            || validateLoanProductTerm(loanType, term, termUnit)
            || null;
    }, [loanType, principal, term, termUnit]);

    const result = useMemo(() => {
        if (validationMessage) return null;
        const parsedPrincipal = parseFloat(principal || '0') || 0;
        const parsedRate = parseFloat(ratePercent || '0') || 0;
        const parsedTerm = parseInt(term || '0', 10) || 0;
        if (parsedPrincipal <= 0 || parsedTerm <= 0) return null;

        if (isInstitutionalLoanType(loanType)) {
            return LoanCalculatorService.calculateInstitutionalLoan({
                loanType,
                principal: parsedPrincipal,
                monthlyRatePercent: parsedRate,
                term: parsedTerm,
                termUnit,
                frequency,
                releaseDate: new Date(),
                processingFee,
                notarialFee,
                insuranceFee: tableInsurance.premium,
                savingsPerPayment: parseFloat(savingsPerPayment || '0') || 0,
                rebatePerPayment: parseFloat(rebateAmount || '0') || 0,
            });
        }

        return LoanCalculatorService.calculate(
            parsedPrincipal,
            parsedRate,
            parsedTerm,
            termUnit,
            'flat',
            frequency,
            new Date(),
            0,
            tableInsurance.premium
        );
    }, [frequency, loanType, notarialFee, principal, processingFee, ratePercent, rebateAmount, savingsPerPayment, tableInsurance.premium, term, termUnit, validationMessage]);

    function applyPreset(type: LoanProductType) {
        const preset = LOAN_PRODUCT_PRESETS[type];
        setLoanType(type);
        setRatePercent(preset.defaultRatePercent);
        setTerm(preset.defaultTerm);
        setTermUnit(preset.defaultTermUnit);
        setFrequency(preset.defaultFrequency);
        setSavingsPerPayment(preset.defaultSavingsPerPayment);
        if (preset.defaultPrincipal) setPrincipal(preset.defaultPrincipal);
    }

    function continueApplication() {
        if (!result || validationMessage) {
            Alert.alert('Cannot continue', validationMessage || 'Please enter valid loan details first.');
            return;
        }
        router.push({
            pathname: '/loan-application',
            params: { loanType, principal, ratePercent, term, termUnit, frequency },
        } as any);
    }

    return (
        <ScrollView className="flex-1 bg-slate-950" contentContainerStyle={{ padding: 20 }}>
            <View className="max-w-5xl w-full self-center">
                <Pressable onPress={() => router.replace('/login')} className="mb-4">
                    <Text className="text-emerald-200 font-bold">← Back to login</Text>
                </Pressable>

                <View className="bg-white rounded-[32px] p-6 mb-5">
                    <Text testID="online-calculator-title" className="text-3xl font-black text-slate-900">Online Loan Calculator</Text>
                    <Text className="text-slate-600 mt-2">Estimate amortization before submitting an application.</Text>
                </View>

                <View className="bg-white rounded-[32px] p-6 mb-5">
                    <Text className="text-xs font-black text-slate-500 uppercase mb-2">Loan product</Text>
                    <View className="flex-row flex-wrap gap-2">
                        {(Object.keys(LOAN_PRODUCT_PRESETS) as LoanProductType[]).map(type => (
                            <Pressable
                                key={type}
                                testID={`public-loan-type-${type}`}
                                onPress={() => applyPreset(type)}
                                className={`px-4 py-3 rounded-2xl border ${loanType === type ? 'bg-emerald-700 border-emerald-700' : 'bg-slate-50 border-slate-200'}`}
                            >
                                <Text className={`font-black text-xs ${loanType === type ? 'text-white' : 'text-slate-700'}`}>{loanProductLabel(type)}</Text>
                            </Pressable>
                        ))}
                    </View>

                    <View className="mt-5 gap-3">
                        <Field label="Principal" value={principal} onChangeText={setPrincipal} />
                        <Field label="Monthly rate (%)" value={ratePercent} onChangeText={setRatePercent} />
                        <Field label="Term" value={term} onChangeText={setTerm} />
                        <Segment label="Term unit" value={termUnit} values={['months', 'days', 'weeks']} onChange={value => setTermUnit(value as TermUnit)} />
                        <Segment label="Payment frequency" value={frequency} values={['daily', 'weekly', 'bi_monthly', 'monthly']} onChange={value => setFrequency(value as Frequency)} />
                        {isInstitutionalLoanType(loanType) && (
                            <View className="flex-row gap-3">
                                <View className="flex-1"><Field label="Savings/payment" value={savingsPerPayment} onChangeText={setSavingsPerPayment} /></View>
                                <View className="flex-1"><Field label="Rebate/payment" value={rebateAmount} onChangeText={setRebateAmount} /></View>
                            </View>
                        )}
                    </View>
                </View>

                <View className="bg-white rounded-[32px] p-6">
                    <Text className="text-xl font-black text-slate-900 mb-4">Estimate</Text>
                    {validationMessage ? (
                        <Text testID="calculator-validation" className="text-red-700 font-bold">{validationMessage}</Text>
                    ) : result ? (
                        <View testID="calculator-result" className="gap-3">
                            <Summary label="Installment" value={formatPHP(result.installmentAmount)} />
                            <Summary label="Total Interest" value={formatPHP(result.totalInterest)} />
                            <Summary label="Insurance" value={formatPHP(tableInsurance.premium)} />
                            <Summary label="Processing Fee" value={formatPHP(processingFee)} />
                            <Summary label="Notarial Fee" value={formatPHP(notarialFee)} />
                            <Summary label="Total Payable" value={formatPHP(result.totalAmount)} />
                            <Pressable testID="continue-application" onPress={continueApplication} className="mt-3 bg-emerald-700 rounded-2xl py-4 items-center">
                                <Text className="text-white font-black">Continue to Online Application</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <Text className="text-slate-500">Enter valid loan details to see the computation.</Text>
                    )}
                </View>
            </View>
        </ScrollView>
    );
}

function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
    return (
        <View>
            <Text className="text-xs font-black text-slate-500 uppercase mb-1">{label}</Text>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                keyboardType="numeric"
                className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-900"
            />
        </View>
    );
}

function Segment({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
    return (
        <View>
            <Text className="text-xs font-black text-slate-500 uppercase mb-1">{label}</Text>
            <View className="flex-row flex-wrap gap-2">
                {values.map(item => (
                    <Pressable key={item} onPress={() => onChange(item)} className={`px-3 py-2 rounded-xl ${value === item ? 'bg-slate-900' : 'bg-slate-100'}`}>
                        <Text className={`text-xs font-black ${value === item ? 'text-white' : 'text-slate-700'}`}>{item.replace('_', ' ')}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

function Summary({ label, value }: { label: string; value: string }) {
    return (
        <View className="flex-row justify-between border-b border-slate-100 pb-2">
            <Text className="text-slate-500 font-bold">{label}</Text>
            <Text className="text-slate-900 font-black">{value}</Text>
        </View>
    );
}
