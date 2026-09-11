import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../../src/database';
import Loan from '../../../src/database/models/Loan';
import { excelExportService } from '../../../src/services/ExcelExportService';
import { Button } from '../../../src/components/Button';

export default function AgingReportScreen() {
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const fetchAgingLoans = async () => {
            try {
                const data = await database.get<Loan>('loans')
                    .query(
                        Q.where('status', 'active'),
                        Q.where('is_delinquent', true),
                        Q.where('deleted_at', null)
                    )
                    .fetch();
                setLoans(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchAgingLoans();
    }, []);

    const handleExport = async () => {
        try {
            setExporting(true);
            const headers = ['Loan ID', 'Amount', 'DPD', 'Aging Bucket'];
            const data = loans.map(loan => [
                loan.id,
                loan.totalAmount,
                loan.dpd || 0,
                loan.agingBucket || 'UNKNOWN'
            ]);
            await excelExportService.exportToCsv('Aging_Report', headers, data);
        } catch (error) {
            Alert.alert('Export Failed', 'Unable to export aging report.');
        } finally {
            setExporting(false);
        }
    };

    const renderItem = ({ item }: { item: Loan }) => (
        <View className="bg-white p-4 rounded-lg shadow mb-3 flex-row justify-between">
            <View>
                <Text className="font-bold text-gray-800">Loan #{item.id.substring(0, 8)}</Text>
                <Text className="text-red-600 font-semibold mt-1">{item.agingBucket} ({item.dpd} DPD)</Text>
            </View>
            <View className="items-end">
                <Text className="font-bold text-lg">₱{item.totalAmount}</Text>
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-gray-100 p-4">
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-gray-800">Aging Report</Text>
                <Button 
                    title={exporting ? "Exporting..." : "Export CSV"} 
                    onPress={handleExport} 
                    disabled={exporting || loans.length === 0}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#0000ff" />
            ) : loans.length === 0 ? (
                <View className="flex-1 justify-center items-center">
                    <Text className="text-gray-500">No delinquent loans found.</Text>
                </View>
            ) : (
                <FlatList
                    data={loans}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                />
            )}
        </View>
    );
}
