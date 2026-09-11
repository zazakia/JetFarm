import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../../src/database';
import Loan from '../../../src/database/models/Loan';
import { excelExportService } from '../../../src/services/ExcelExportService';
import { Button } from '../../../src/components/Button';

export default function ParReportScreen() {
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [parMetrics, setParMetrics] = useState({ totalOutstanding: 0, parAmount: 0, parPercentage: 0 });

    useEffect(() => {
        const calculatePar = async () => {
            try {
                const activeLoans = await database.get<Loan>('loans')
                    .query(
                        Q.where('status', 'active'),
                        Q.where('deleted_at', null)
                    )
                    .fetch();

                let totalOutstanding = 0;
                let parAmount = 0;

                for (const loan of activeLoans) {
                    totalOutstanding += loan.totalAmount;
                    // PAR is typically defined as outstanding balance of loans > 0 days past due
                    if (loan.dpd > 0) {
                        parAmount += loan.totalAmount;
                    }
                }

                const parPercentage = totalOutstanding > 0 ? (parAmount / totalOutstanding) * 100 : 0;
                setParMetrics({ totalOutstanding, parAmount, parPercentage });
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        calculatePar();
    }, []);

    const handleExport = async () => {
        try {
            setExporting(true);
            const headers = ['Metric', 'Amount'];
            const data = [
                ['Total Outstanding Portfolio', parMetrics.totalOutstanding.toFixed(2)],
                ['Portfolio At Risk (PAR > 1 Day)', parMetrics.parAmount.toFixed(2)],
                ['PAR %', parMetrics.parPercentage.toFixed(2) + '%']
            ];
            await excelExportService.exportToCsv('PAR_Report', headers, data);
        } catch (error) {
            Alert.alert('Export Failed', 'Unable to export PAR report.');
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return <ActivityIndicator size="large" color="#0000ff" className="mt-10 flex-1" />;
    }

    return (
        <ScrollView className="flex-1 bg-gray-100 p-4">
            <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xl font-bold text-gray-800">Portfolio At Risk (PAR)</Text>
                <Button 
                    title={exporting ? "Exporting..." : "Export CSV"} 
                    onPress={handleExport} 
                    disabled={exporting}
                />
            </View>

            <View className="bg-white p-6 rounded-lg shadow mb-4">
                <Text className="text-gray-500 text-sm mb-1">Total Outstanding Portfolio</Text>
                <Text className="text-2xl font-bold text-gray-800">₱{parMetrics.totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>

            <View className="bg-white p-6 rounded-lg shadow mb-4">
                <Text className="text-gray-500 text-sm mb-1">Portfolio At Risk (PAR &gt; 1 Day)</Text>
                <Text className="text-2xl font-bold text-red-600">₱{parMetrics.parAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>

            <View className="bg-white p-6 rounded-lg shadow">
                <Text className="text-gray-500 text-sm mb-1">PAR Percentage</Text>
                <Text className="text-3xl font-bold text-orange-500">{parMetrics.parPercentage.toFixed(2)}%</Text>
                <Text className="text-xs text-gray-400 mt-2">Target: Below 5%</Text>
            </View>
        </ScrollView>
    );
}
