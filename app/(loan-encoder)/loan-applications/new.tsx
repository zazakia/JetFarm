import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { LoanApplicationForm } from '../../../src/components/LoanApplicationForm';

export default function NewLoanApplicationScreen() {
    const router = useRouter();
    // For a real implementation, a member selection step would come first.
    // Assuming a hardcoded borrowerId for this initial form scaffolding.
    const [selectedBorrowerId, setSelectedBorrowerId] = useState('temp-borrower-id');

    return (
        <View className="flex-1 bg-gray-100">
            <View className="p-4 bg-white border-b border-gray-200">
                <Text className="text-xl font-bold">Create Loan Application</Text>
            </View>
            
            <LoanApplicationForm
                borrowerId={selectedBorrowerId}
                onSuccess={() => {
                    alert('Application submitted successfully!');
                    router.back();
                }}
                onCancel={() => router.back()}
            />
        </View>
    );
}
