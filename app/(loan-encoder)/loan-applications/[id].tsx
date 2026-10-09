import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { loanApplicationService } from '../../../src/services/LoanApplicationService';
import LoanApplication from '../../../src/database/models/LoanApplication';
import { Button } from '../../../src/components/Button';
import { formatPHP } from '../../../src/utils/currency';

export default function LoanApplicationDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [application, setApplication] = useState<LoanApplication | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const record = await loanApplicationService.getApplicationById(id);
                if (mounted) {
                    setApplication(record);
                    setNotFound(!record);
                }
            } catch (error) {
                console.error('Failed to load application detail:', error);
                if (mounted) setNotFound(true);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [id]);

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-100">
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    if (notFound || !application) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-100 p-4">
                <Text className="text-gray-500 text-base mb-4">
                    Loan application not found. It may have been removed.
                </Text>
                <Button title="Back to List" onPress={() => router.back()} />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-100 p-4">
            <View className="bg-white p-4 rounded-lg shadow">
                <Text className="font-bold text-xl mb-3">
                    Loan Application {application.id.slice(0, 8)}
                </Text>

                <View className="flex-row justify-between py-1">
                    <Text className="text-gray-600">Status</Text>
                    <Text className="font-semibold text-gray-900">{application.status}</Text>
                </View>
                <View className="flex-row justify-between py-1">
                    <Text className="text-gray-600">Amount Applied</Text>
                    <Text className="font-semibold text-gray-900">{formatPHP(application.amountApplied)}</Text>
                </View>
                <View className="flex-row justify-between py-1">
                    <Text className="text-gray-600">Amount Approved</Text>
                    <Text className="font-semibold text-gray-900">
                        {application.amountApproved != null ? formatPHP(application.amountApproved) : '—'}
                    </Text>
                </View>
                <View className="flex-row justify-between py-1">
                    <Text className="text-gray-600">Application Date</Text>
                    <Text className="text-gray-900">{new Date(application.applicationDate).toLocaleDateString()}</Text>
                </View>
                <View className="flex-row justify-between py-1">
                    <Text className="text-gray-600">Approved Date</Text>
                    <Text className="text-gray-900">
                        {application.approvedAt ? new Date(application.approvedAt).toLocaleDateString() : '—'}
                    </Text>
                </View>

                {application.purpose ? (
                    <View className="mt-3">
                        <Text className="text-gray-600 mb-1">Purpose</Text>
                        <Text className="text-gray-900">{application.purpose}</Text>
                    </View>
                ) : null}

                {application.notes ? (
                    <View className="mt-3">
                        <Text className="text-gray-600 mb-1">Notes</Text>
                        <Text className="text-gray-900">{application.notes}</Text>
                    </View>
                ) : null}
            </View>

            <Button title="Back" onPress={() => router.back()} className="mt-4" />
        </View>
    );
}
