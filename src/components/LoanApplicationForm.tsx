import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Button } from './Button'; // Assuming a generic Button component exists
import { loanApplicationService } from '../services/LoanApplicationService';

export const LoanApplicationForm = ({ borrowerId, onSuccess, onCancel }: { borrowerId: string, onSuccess: () => void, onCancel: () => void }) => {
    const [amountApplied, setAmountApplied] = useState('');
    const [purpose, setPurpose] = useState('');
    const [notes, setNotes] = useState('');
    const [guarantorName, setGuarantorName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!amountApplied || isNaN(Number(amountApplied))) {
            alert('Please enter a valid amount.');
            return;
        }

        try {
            setLoading(true);
            const guarantors = guarantorName ? [{ guarantorName }] : [];
            await loanApplicationService.createApplication({
                borrowerId,
                amountApplied: Number(amountApplied),
                purpose,
                notes,
                guarantors,
            });
            onSuccess();
        } catch (error) {
            console.error('Error creating application:', error);
            alert('Failed to submit application.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView className="p-4 bg-white">
            <Text className="text-lg font-bold mb-4">New Loan Application</Text>
            
            <Text className="mb-1 text-gray-700">Amount Applied</Text>
            <TextInput
                className="border border-gray-300 rounded p-2 mb-4 text-gray-900"
                keyboardType="numeric"
                value={amountApplied}
                onChangeText={setAmountApplied}
                placeholder="e.g. 5000"
             placeholderTextColor="#9CA3AF"/>

            <Text className="mb-1 text-gray-700">Purpose</Text>
            <TextInput
                className="border border-gray-300 rounded p-2 mb-4 text-gray-900"
                value={purpose}
                onChangeText={setPurpose}
                placeholder="e.g. Business Capital"
             placeholderTextColor="#9CA3AF"/>

            <Text className="text-md font-semibold mt-4 mb-2">Guarantor Information</Text>
            <Text className="mb-1 text-gray-700">Guarantor Name</Text>
            <TextInput
                className="border border-gray-300 rounded p-2 mb-4 text-gray-900"
                value={guarantorName}
                onChangeText={setGuarantorName}
                placeholder="Full Name"
             placeholderTextColor="#9CA3AF"/>

            <Text className="mb-1 text-gray-700">Additional Notes</Text>
            <TextInput
                className="border border-gray-300 rounded p-2 mb-4 text-gray-900"
                value={notes}
                onChangeText={setNotes}
                placeholder="Notes..."
                multiline
             placeholderTextColor="#9CA3AF"/>

            <View className="flex-row justify-end space-x-2 mt-4">
                <Button title="Cancel" onPress={onCancel} variant="outline" disabled={loading} />
                <Button title={loading ? 'Submitting...' : 'Submit Application'} onPress={handleSubmit} disabled={loading} />
            </View>
        </ScrollView>
    );
};
