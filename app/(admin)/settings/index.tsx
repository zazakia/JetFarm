import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Switch, Platform, DevSettings, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SyncService } from '../../../src/services/SyncService';
import { BackupService } from '../../../src/services/BackupService';
import { SupabaseBackupService } from '../../../src/services/SupabaseBackupService';
import { database } from '../../../src/database';
import { useAuth , SKIP_NEXT_AUTO_SYNC_KEY } from '../../../src/store/AuthContext';

import Toast from '../../../src/components/AppToast';
import { AnimatedPressable } from '../../../src/components/AnimatedPressable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COMPANY_NAME } from '../../../src/constants/brand';
import { SampleDataService } from '../../../src/services/SampleDataService';
import { useFeatureFlags } from '../../../src/hooks/useSettingsConfig';

export default function SettingsScreen() {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const { isEnabled } = useFeatureFlags();
    const isLendingEnabled = isEnabled('system.lending');
    const [syncing, setSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<string>('Never');
    const [restoreProgress, setRestoreProgress] = useState<string | null>(null);
    const [cloudBackupLoading, setCloudBackupLoading] = useState(false);
    const [cloudRestoreProgress, setCloudRestoreProgress] = useState<string | null>(null);
    const [restoreModalVisible, setRestoreModalVisible] = useState(false);
    const [sampleDataLoading, setSampleDataLoading] = useState(false);
    const [sampleDataEnabled, setSampleDataEnabled] = useState(false);
    const [sampleDataSummary, setSampleDataSummary] = useState('No sample records');

    useEffect(() => {
        setLastSync(new Date().toLocaleString());
        if (user) {
            loadSampleDataStatus();
        }
    }, [user]);

    const loadSampleDataStatus = async () => {
        try {
            const status = await SampleDataService.getStatus();
            setSampleDataEnabled(status.enabled);
            const t = status.totals;
            const moduleBreakdown = [
                t.agriParcels > 0 ? `${t.agriParcels} parcels` : '',
                t.agriCropCycles > 0 ? `${t.agriCropCycles} cycles` : '',
                t.agriWeeklySettlements > 0 ? `${t.agriWeeklySettlements} settlements` : '',
                t.chartOfAccounts > 0 ? `${t.chartOfAccounts} accounts` : '',
                t.journalEntries > 0 ? `${t.journalEntries} journals` : '',
                t.marketplaceProducts > 0 ? `${t.marketplaceProducts} products` : '',
                t.suppliers > 0 ? `${t.suppliers} suppliers` : '',
                t.waterCustomers > 0 ? `${t.waterCustomers} water clients` : '',
                t.loans > 0 ? `${t.loans} loans` : '',
                t.employees > 0 ? `${t.employees} staff` : '',
            ].filter(Boolean).join(' • ');

            setSampleDataSummary(
                status.active > 0
                    ? `${status.active} active records: ${moduleBreakdown}`
                    : status.deleted > 0
                        ? `${status.deleted} records hidden/deleted`
                        : 'No sample records'
            );
        } catch (error) {
            console.warn('[Settings] Unable to load sample data status:', error);
            setSampleDataEnabled(false);
            setSampleDataSummary('Sample data status unavailable');
        }
    };

    const runSampleDataAction = async (action: 'enable' | 'disable' | 'restore' | 'purge') => {
        setSampleDataLoading(true);
        try {
            if (action === 'enable') await SampleDataService.enable();
            if (action === 'disable') await SampleDataService.disable();
            if (action === 'restore') await SampleDataService.restore();
            if (action === 'purge') await SampleDataService.purge();
            await loadSampleDataStatus();
            const labels = {
                enable: 'Sample data enabled.',
                disable: 'Sample data hidden.',
                restore: 'Sample data restored.',
                purge: 'Sample data deleted permanently.',
            };
            if (Platform.OS === 'web') window.alert(labels[action]);
            else Alert.alert('Sample Data', labels[action]);
        } catch (error: any) {
            Alert.alert('Sample Data Failed', error.message || 'Unable to update sample data.');
        } finally {
            setSampleDataLoading(false);
        }
    };

    const confirmPurgeSampleData = () => {
        const message = 'This permanently deletes only records created by the sample-data tool. Real client data is not touched.';
        if (Platform.OS === 'web') {
            if (window.confirm(message)) runSampleDataAction('purge');
            return;
        }
        Alert.alert('Delete Sample Data', message, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => runSampleDataAction('purge') },
        ]);
    };

    const handleBackup = async () => {
        try {
            const result = await BackupService.exportBackup();
            if (result.success) {
                Toast.show({
                    type: 'success',
                    text1: 'Backup Created',
                    text2: result.message
                });
            }
        } catch (error) {
            Alert.alert("Backup Failed", "An error occurred while creating the backup.");
        }
    };

    const handleRestore = async () => {
        if (Platform.OS === 'web') {
            setRestoreModalVisible(true);
        } else {
            Alert.alert(
                "Restore Data",
                "Choose how you want to restore the data. 'Wipe & Restore' will clear all current local data first.",
                [
                    { text: "Cancel", style: "cancel" },
                    { 
                        text: "Merge Data", 
                        onPress: () => performRestore('merge') 
                    },
                    { 
                        text: "Wipe & Restore", 
                        style: "destructive",
                        onPress: () => performRestore('reset')
                    }
                ]
            );
        }
    };

    const performRestore = async (strategy: 'reset' | 'merge') => {
        setRestoreProgress('Starting restore...');
        try {
            const result = await BackupService.importBackup(strategy, (msg) => {
                setRestoreProgress(msg);
            });

            if (result.success) {
                if (strategy === 'reset') {
                    Alert.alert("Restore Successful", "Data wiped and restored safely.");
                } else {
                    Alert.alert("Restore Successful", "Your data has been merged with the backup file.");
                }
            }
        } catch (error: any) {
            Alert.alert("Restore Failed", error.message || "An error occurred during restore.");
        } finally {
            setRestoreProgress(null);
        }
    };

    const handleCloudBackup = async () => {
        setCloudBackupLoading(true);
        try {
            const result = await SupabaseBackupService.exportBackup();
            if (result.success) {
                Toast.show({
                    type: 'success',
                    text1: 'Cloud Backup Created',
                    text2: result.message
                });
            }
        } catch (error: any) {
            Alert.alert("Cloud Backup Failed", error.message || "An error occurred while creating the cloud backup.");
        } finally {
            setCloudBackupLoading(false);
        }
    };

    const handleCloudRestore = async () => {
        const message = "This will merge the backup file with the live Supabase database. A safety backup of the current cloud data will be automatically created first.";
        
        const startCloudRestore = async () => {
            setCloudRestoreProgress('Initializing cloud restore...');
            try {
                const result = await SupabaseBackupService.importBackup((msg) => {
                    setCloudRestoreProgress(msg);
                });

                if (result.success) {
                    Alert.alert("Cloud Restore Successful", result.message);
                }
            } catch (error: any) {
                Alert.alert("Cloud Restore Failed", error.message || "An error occurred during cloud restore.");
            } finally {
                setCloudRestoreProgress(null);
            }
        };

        Alert.alert(
            "Restore Cloud Database",
            message,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Backup & Merge Now", 
                    onPress: startCloudRestore 
                }
            ]
        );
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            await SyncService.checkAndSync({ force: true });
            setLastSync(new Date().toLocaleString());
            Alert.alert("Sync Complete", "Database is now up to date with Supabase.");
        } catch (error) {
            console.error(error);
            Alert.alert("Sync Failed", "Please check your internet connection.");
        } finally {
            setSyncing(false);
        }
    };

    const handleReset = async () => {
        try {
            const pendingChanges = await SyncService.updatePendingCount();
            if (pendingChanges > 0) {
                const blockMessage = `Wipe Blocked: You have ${pendingChanges} unsynced change(s) stored locally. To prevent data loss, please connect to the internet and click "Sync Now" first.`;
                if (Platform.OS === 'web') {
                    window.alert(blockMessage);
                } else {
                    Alert.alert("Sync Required", blockMessage, [{ text: "OK" }]);
                }
                return;
            }
        } catch (err) {
            console.error("Failed to check pending changes:", err);
        }

        const message = "This will clear the local WatermelonDB. Use ONLY if database is corrupted. Unsynced changes will be LOST.";
        
        const performReset = async () => {
            try {
                await AsyncStorage.setItem(SKIP_NEXT_AUTO_SYNC_KEY, 'true');
                await database.write(async () => {
                    await database.unsafeResetDatabase();
                });
                if (Platform.OS === 'web') {
                    window.location.reload();
                } else {
                    Alert.alert(
                        "Reset Successful", 
                        "Application data wiped. The app will now reload to apply changes.",
                        [{ 
                            text: "OK", 
                            onPress: () => {
                                // DevSettings.reload() works in development.
                                // In production with expo-updates, you would use Updates.reloadAsync()
                                if (__DEV__) {
                                    DevSettings.reload();
                                } else {
                                    Alert.alert("Manual Restart Required", "Please close and reopen the app to complete the reset.");
                                }
                            }
                        }]
                    );
                }
            } catch (error: any) {
                Alert.alert("Reset Failed", error.message || "An error occurred during reset.");
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(message)) {
                performReset();
            }
        } else {
            Alert.alert(
                "Wipe Local Data",
                message,
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Wipe Now",
                        style: "destructive",
                        onPress: performReset
                    }
                ]
            );
        }
    };

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="mb-8 p-4 items-center">
                <View className="w-20 h-20 rounded-full bg-blue-900 items-center justify-center mb-4 shadow-lg">
                    <MaterialIcons name="person" size={40} color="white" />
                </View>
                <Text className="text-xl font-black text-gray-900">{user?.email}</Text>
                <Text className="text-gray-700 font-bold uppercase tracking-widest text-[10px] mt-1">Admin Access</Text>
            </View>

            <Section title="Synchronization">
                <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <Text className="text-gray-900 font-bold text-base">Instant Sync</Text>
                            <Text className="text-gray-700 text-xs mt-1">Push changes automatically</Text>
                        </View>
                        <Switch value={true} trackColor={{ true: '#1E3A8A' }} />
                    </View>

                    <View className="bg-gray-50 p-4 rounded-2xl mb-6">
                        <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-1">Last Successful Sync</Text>
                        <Text className="text-gray-900 font-bold">{lastSync}</Text>
                    </View>

                    <AnimatedPressable
                        onPress={handleSync}
                        disabled={syncing}
                        className="w-full"
                    >
                        <View className={`py-4 rounded-xl items-center flex-row justify-center ${syncing ? 'bg-gray-200' : 'bg-white border border-blue-900'}`}>
                            {syncing ? <ActivityIndicator color="#1E3A8A" /> : (
                                <>
                                    <MaterialIcons name="sync" size={20} color="#1E3A8A" style={{ marginRight: 8 }} />
                                    <Text className="text-blue-900 font-bold uppercase tracking-wider">Sync Now</Text>
                                </>
                            )}
                        </View>
                    </AnimatedPressable>
                </View>
            </Section>

            <Section title="Data Management">
                <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 gap-y-4">
                    <View className="bg-amber-50 p-4 rounded-2xl border border-amber-100 mb-2">
                        <View className="flex-row items-center mb-1">
                            <MaterialIcons name="warning" size={16} color="#B45309" className="mr-2" />
                            <Text className="text-amber-800 font-bold text-xs">Security Note</Text>
                        </View>
                        <Text className="text-amber-700 text-xs leading-4">
                            Backups contain UNENCRYPTED financial data. Keep exported files in a secure location.
                        </Text>
                    </View>

                    <AnimatedPressable
                        onPress={handleBackup}
                        className="w-full"
                    >
                        <View style={{ backgroundColor: '#1E3A8A' }} className="py-4 rounded-xl items-center flex-row justify-center">
                            <MaterialIcons name="backup" size={20} color="white" style={{ marginRight: 8 }} />
                            <Text style={{ color: 'white' }} className="font-bold uppercase tracking-wider">Manual Backup (Export)</Text>
                        </View>
                    </AnimatedPressable>
 
                    <AnimatedPressable
                        onPress={handleRestore}
                        className="w-full"
                    >
                        <View className="py-4 rounded-xl items-center flex-row justify-center bg-gray-100 border border-gray-200">
                            <MaterialIcons name="settings-backup-restore" size={20} color="#374151" style={{ marginRight: 8 }} />
                            <Text className="text-gray-700 font-bold uppercase tracking-wider">Restore from File</Text>
                        </View>
                    </AnimatedPressable>

                    {restoreProgress && (
                        <View className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100 flex-row items-center">
                            <ActivityIndicator size="small" color="#2563EB" className="mr-3" />
                            <Text className="text-blue-700 text-xs font-semibold flex-1">{restoreProgress}</Text>
                        </View>
                    )}
                </View>
            </Section>

            <Section title="Demo Data">
                <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 gap-y-4">
                    <View className="flex-row justify-between items-center">
                        <View className="flex-1 pr-4">
                            <Text className="text-gray-900 font-bold text-base">Sample Data</Text>
                            <Text className="text-gray-700 text-xs mt-1">{sampleDataSummary}</Text>
                        </View>
                        {sampleDataLoading ? (
                            <ActivityIndicator color="#1E3A8A" />
                        ) : (
                            <Switch
                                value={sampleDataEnabled}
                                trackColor={{ true: '#1E3A8A' }}
                                onValueChange={(value) => runSampleDataAction(value ? 'enable' : 'disable')}
                            />
                        )}
                    </View>

                    <View className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <Text className="text-xs text-gray-700 leading-4">
                            Populates reversible mock data across all modules: Agribusiness (Parcels, Crop Cycles, Farm Workers, Harvest Scales), Marketplace & POS (Products, Inventory, Stock Movements, Returns), Water Station (Customers, Containers, Deliveries), Lending, Banking, and Staff Directory.
                        </Text>
                    </View>

                    <View className="flex-row gap-3">
                        <AnimatedPressable
                            onPress={() => runSampleDataAction('restore')}
                            disabled={sampleDataLoading}
                            className="flex-1"
                        >
                            <View className="py-3 rounded-xl items-center flex-row justify-center bg-gray-100 border border-gray-200">
                                <MaterialIcons name="restore" size={18} color="#374151" style={{ marginRight: 6 }} />
                                <Text className="text-gray-700 font-bold text-xs uppercase">Restore</Text>
                            </View>
                        </AnimatedPressable>

                        <AnimatedPressable
                            onPress={confirmPurgeSampleData}
                            disabled={sampleDataLoading}
                            className="flex-1"
                        >
                            <View className="py-3 rounded-xl items-center flex-row justify-center bg-red-50 border border-red-100">
                                <MaterialIcons name="delete-outline" size={18} color="#B91C1C" style={{ marginRight: 6 }} />
                                <Text className="text-red-700 font-bold text-xs uppercase">Delete</Text>
                            </View>
                        </AnimatedPressable>
                    </View>
                </View>
            </Section>

            <Section title="Cloud Database Management">
                <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 gap-y-4">
                    <View className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-2">
                        <View className="flex-row items-center mb-1">
                            <MaterialIcons name="cloud-upload" size={16} color="#1E3A8A" className="mr-2" />
                            <Text className="text-blue-800 font-bold text-xs">Supabase Cloud</Text>
                        </View>
                        <Text className="text-blue-700 text-xs leading-4">
                            These actions affect the LIVE cloud database. Changes will be reflected for all users on the next sync.
                        </Text>
                    </View>

                    <AnimatedPressable
                        onPress={handleCloudBackup}
                        disabled={cloudBackupLoading}
                        className="w-full"
                    >
                        <View style={{ backgroundColor: '#0284c7' }} className="py-4 rounded-xl items-center flex-row justify-center">
                            {cloudBackupLoading ? <ActivityIndicator color="white" /> : (
                                <>
                                    <MaterialIcons name="cloud-download" size={20} color="white" style={{ marginRight: 8 }} />
                                    <Text style={{ color: 'white' }} className="font-bold uppercase tracking-wider">Cloud Backup (Remote)</Text>
                                </>
                            )}
                        </View>
                    </AnimatedPressable>

                    <AnimatedPressable
                        onPress={handleCloudRestore}
                        className="w-full"
                    >
                        <View className="py-4 rounded-xl items-center flex-row justify-center bg-sky-50 border border-sky-100">
                            <MaterialIcons name="cloud-sync" size={20} color="#0369a1" style={{ marginRight: 8 }} />
                            <Text className="text-sky-800 font-bold uppercase tracking-wider">Cloud Merge (Supabase)</Text>
                        </View>
                    </AnimatedPressable>

                    {cloudRestoreProgress && (
                        <View className="mt-2 p-3 bg-sky-50 rounded-xl border border-sky-100 flex-row items-center">
                            <ActivityIndicator size="small" color="#0369a1" className="mr-3" />
                            <Text className="text-sky-700 text-xs font-semibold flex-1">{cloudRestoreProgress}</Text>
                        </View>
                    )}
                </View>
            </Section>

            <Section title="System">
                <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <SettingsItem
                        icon="storage"
                        label="Data Maintenance & Lookups"
                        color="#1E3A8A"
                        onPress={() => router.push('/(admin)/settings/data-maintenance')}
                    />
                    <SettingsItem
                        icon="tune"
                        label="Business Rules"
                        color="#1E3A8A"
                        onPress={() => router.push('/(admin)/settings/business-rules')}
                    />
                    {isLendingEnabled && (
                        <SettingsItem
                            icon="receipt-long"
                            label="Loan Products"
                            color="#1E3A8A"
                            onPress={() => router.push('/(admin)/settings/loan-products')}
                        />
                    )}
                    <SettingsItem
                        icon="toggle-on"
                        label="Feature Flags"
                        color="#1E3A8A"
                        onPress={() => router.push('/(admin)/settings/feature-flags')}
                    />
                    <SettingsItem
                        icon="admin-panel-settings"
                        label="Role Access"
                        color="#1E3A8A"
                        onPress={() => router.push('/(admin)/settings/role-access')}
                    />
                    <SettingsItem
                        icon="color-lens"
                        label="UI Module Settings"
                        color="#1E3A8A"
                        onPress={() => router.push('/(admin)/settings/ui-branding')}
                    />
                    <SettingsItem
                        icon="info-outline"
                        label="About App"
                        onPress={() => Alert.alert(`${COMPANY_NAME} v1.0`, "Built with React Native Expo & WatermelonDB")}
                    />
                    <SettingsItem
                        icon="campaign"
                        label="Updates & Changes"
                        color="#1E3A8A"
                        onPress={() => router.push('/(admin)/settings/updates')}
                    />
                    <SettingsItem
                        icon="category"
                        label="Expense Categories"
                        onPress={() => router.push('/(admin)/settings/expense-categories')}
                    />
                    {isLendingEnabled && (
                        <SettingsItem
                            icon="group-work"
                            label="Collection Groups"
                            onPress={() => router.push('/(admin)/settings/collection-groups')}
                        />
                    )}
                    <SettingsItem
                        icon="lock"
                        label="Monthly Financial Closing"
                        onPress={() => router.push('/(admin)/settings/closing')}
                    />
                    <SettingsItem
                        icon="system-update-alt"
                        label="Excel Data Migration"
                        color="#FF8C00"
                        onPress={() => router.push('/(admin)/settings/migration')}
                    />
                    <SettingsItem
                        icon="history"
                        label="Audit Trail"
                        color="#1E3A8A"
                        onPress={() => router.push('/(admin)/settings/audit-trail')}
                    />
                    <SettingsItem
                        icon="verified-user"
                        label="Data Integrity Audit"
                        color="#1E3A8A"
                        onPress={() => router.push('/(admin)/settings/audit')}
                    />
                    <SettingsItem
                        icon="delete-forever"
                        label="Clear Local Database"
                        color="#D32F2F"
                        onPress={handleReset}
                    />
                </View>
            </Section>

            <AnimatedPressable
                onPress={signOut}
                className="mt-8 w-full"
            >
                <View className="flex-row items-center justify-center p-4 bg-red-50 rounded-2xl">
                    <MaterialIcons name="logout" size={20} color="#D32F2F" style={{ marginRight: 8 }} />
                    <Text className="text-red-600 font-black uppercase tracking-widest">Sign Out Account</Text>
                </View>
            </AnimatedPressable>

            <View className="h-20" />

            {/* Custom Restore Modal for Web Compatibility */}
            <Modal
                transparent={true}
                visible={restoreModalVisible}
                animationType="fade"
                onRequestClose={() => setRestoreModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/50 p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
                        <Pressable 
                            onPress={() => setRestoreModalVisible(false)} 
                            className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full active:bg-gray-200 z-10"
                        >
                            <MaterialIcons name="close" size={20} color="#4B5563" />
                        </Pressable>
                        <MaterialIcons name="settings-backup-restore" size={40} color="#1E3A8A" className="mb-4" />
                        <Text className="text-xl font-bold text-gray-900 mb-2">Restore Data</Text>
                        <Text className="text-sm text-gray-600 mb-6 leading-5">
                            Choose how you want to restore the data. <Text className="font-bold text-red-600">Wipe & Restore</Text> will clear all current local data first.
                        </Text>
                        
                        <View className="gap-y-3">
                            <AnimatedPressable
                                onPress={() => {
                                    setRestoreModalVisible(false);
                                    performRestore('merge');
                                }}
                                className="w-full"
                            >
                                <View className="py-3.5 rounded-xl bg-blue-900 items-center">
                                    <Text className="text-white font-bold tracking-wider">Merge Data Safely</Text>
                                </View>
                            </AnimatedPressable>
 
                            <AnimatedPressable
                                onPress={() => {
                                    setRestoreModalVisible(false);
                                    performRestore('reset');
                                }}
                                className="w-full"
                            >
                                <View className="py-3.5 rounded-xl bg-red-50 border border-red-200 items-center">
                                    <Text className="text-red-700 font-bold tracking-wider">Wipe & Restore</Text>
                                </View>
                            </AnimatedPressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <View className="mb-8">
            <Text className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-4 ml-1">{title}</Text>
            {children}
        </View>
    );
}

function SettingsItem({ icon, label, onPress, color = '#4B5563' }: { icon: any, label: string, onPress: () => void, color?: string }) {
    return (
        <AnimatedPressable
            onPress={onPress}
            className="p-5 border-b border-gray-50 active:bg-gray-50"
        >
            <View className="flex-row items-center w-full">
                <MaterialIcons name={icon} size={22} color={color} className="mr-4" />
                <Text className="flex-1 text-base font-medium" style={{ color: color }}>{label}</Text>
                <MaterialIcons name="chevron-right" size={20} color="#E5E7EB" />
            </View>
        </AnimatedPressable>
    )
}
