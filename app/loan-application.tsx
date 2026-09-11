import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COMPANY_NAME } from '../src/constants/brand';
import { DEMO_ADMIN_CONTACT } from '../src/services/InquiryService';
import { LoanProductType, loanProductLabel } from '../src/utils/loanProducts';

type ApplicationStatus = 'idle' | 'ready' | 'error';

export default function OnlineLoanApplicationScreen() {
    const params = useLocalSearchParams<{
        loanType?: string;
        principal?: string;
        ratePercent?: string;
        term?: string;
        termUnit?: string;
        frequency?: string;
    }>();
    const router = useRouter();
    const [status, setStatus] = useState<ApplicationStatus>('idle');
    const [form, setForm] = useState({
        fullName: '',
        contactNumber: '',
        address: '',
        occupation: '',
        monthlyIncome: '',
        purpose: '',
        loanType: params.loanType || 'standard',
        principal: params.principal || '10000',
        term: params.term || '6',
        termUnit: params.termUnit || 'months',
    });

    const missingRequired = !form.fullName.trim() || !form.contactNumber.trim() || !form.address.trim() || !form.principal.trim();

    const applicationMessage = [
        `Online Loan Application - ${COMPANY_NAME}`,
        '',
        `Name: ${form.fullName}`,
        `Contact Number: ${form.contactNumber}`,
        `Address: ${form.address}`,
        `Occupation/Business: ${form.occupation || 'N/A'}`,
        `Monthly Income: ${form.monthlyIncome || 'N/A'}`,
        `Loan Type: ${loanProductLabel(form.loanType)}`,
        `Requested Principal: PHP ${form.principal}`,
        `Preferred Term: ${form.term} ${form.termUnit}`,
        `Purpose: ${form.purpose || 'N/A'}`,
        '',
        'Please review and contact the applicant for requirements.',
    ].join('\n');

    function update(field: keyof typeof form, value: string) {
        setForm(current => ({ ...current, [field]: value }));
    }

    async function submit(channel: 'whatsapp' | 'email') {
        if (missingRequired) {
            setStatus('error');
            Alert.alert('Incomplete application', 'Please provide name, contact number, address, and requested principal.');
            return;
        }

        const encodedMessage = encodeURIComponent(applicationMessage);
        const url = channel === 'whatsapp'
            ? `https://wa.me/${DEMO_ADMIN_CONTACT.whatsappInternational}?text=${encodedMessage}`
            : `mailto:${DEMO_ADMIN_CONTACT.email}?subject=${encodeURIComponent(`${COMPANY_NAME} Online Loan Application`)}&body=${encodedMessage}`;

        try {
            await Linking.openURL(url);
            setStatus('ready');
        } catch (error) {
            setStatus('error');
            Alert.alert('Unable to open application channel', error instanceof Error ? error.message : 'Please try again.');
        }
    }

    return (
        <ScrollView className="flex-1 bg-slate-950" contentContainerStyle={{ padding: 20 }}>
            <View className="max-w-4xl w-full self-center">
                <Pressable onPress={() => router.replace('/login')} className="mb-4">
                    <Text className="text-emerald-200 font-bold">← Back to login</Text>
                </Pressable>

                <View className="bg-white rounded-[32px] p-6 mb-5">
                    <Text testID="online-application-title" className="text-3xl font-black text-slate-900">Online Loan Application</Text>
                    <Text className="text-slate-600 mt-2">Submit applicant details to the office for review. This does not disburse a loan automatically.</Text>
                    {status === 'ready' && <Text testID="application-status" className="text-emerald-700 font-black mt-3">Application message opened. Please send it to complete submission.</Text>}
                    {status === 'error' && <Text testID="application-status" className="text-red-700 font-black mt-3">Please complete the required fields.</Text>}
                </View>

                <View className="bg-white rounded-[32px] p-6 gap-3">
                    <Field label="Full Name *" value={form.fullName} onChangeText={value => update('fullName', value)} />
                    <Field label="Contact Number *" value={form.contactNumber} onChangeText={value => update('contactNumber', value)} />
                    <Field label="Address *" value={form.address} onChangeText={value => update('address', value)} />
                    <Field label="Occupation / Business" value={form.occupation} onChangeText={value => update('occupation', value)} />
                    <Field label="Monthly Income" value={form.monthlyIncome} onChangeText={value => update('monthlyIncome', value)} keyboardType="numeric" />

                    <View>
                        <Text className="text-xs font-black text-slate-500 uppercase mb-1">Loan Type</Text>
                        <TextInput
                            value={loanProductLabel(form.loanType as LoanProductType)}
                            editable={false}
                            className="bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-900"
                        />
                    </View>

                    <View className="flex-row gap-3">
                        <View className="flex-1">
                            <Field label="Requested Principal *" value={form.principal} onChangeText={value => update('principal', value)} keyboardType="numeric" />
                        </View>
                        <View className="flex-1">
                            <Field label="Preferred Term" value={form.term} onChangeText={value => update('term', value)} keyboardType="numeric" />
                        </View>
                    </View>

                    <Field label="Loan Purpose" value={form.purpose} onChangeText={value => update('purpose', value)} multiline />

                    <View className="flex-row flex-wrap gap-3 mt-2">
                        <Pressable testID="submit-application-whatsapp" onPress={() => submit('whatsapp')} className="bg-emerald-700 rounded-2xl py-4 px-5">
                            <Text className="text-white font-black">Send via WhatsApp</Text>
                        </Pressable>
                        <Pressable testID="submit-application-email" onPress={() => submit('email')} className="bg-slate-900 rounded-2xl py-4 px-5">
                            <Text className="text-white font-black">Send via Email</Text>
                        </Pressable>
                        <Pressable onPress={() => router.push('/loan-calculator')} className="bg-slate-100 rounded-2xl py-4 px-5">
                            <Text className="text-slate-800 font-black">Open Calculator</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

function Field({
    label,
    value,
    onChangeText,
    keyboardType = 'default',
    multiline = false,
}: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    keyboardType?: 'default' | 'numeric' | 'phone-pad';
    multiline?: boolean;
}) {
    return (
        <View>
            <Text className="text-xs font-black text-slate-500 uppercase mb-1">{label}</Text>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                keyboardType={keyboardType}
                multiline={multiline}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-900"
                style={multiline ? { minHeight: 92, textAlignVertical: 'top' } : undefined}
            />
        </View>
    );
}
