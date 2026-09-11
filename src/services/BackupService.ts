import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import { ErrorService } from "./ErrorService";

const COLLECTIONS = [
    'user_profiles',
    'collectors',
    'borrowers',
    'loans',
    'payment_schedules',
    'payments',
    'loan_penalties',
    'expenses',
    'cash_transactions',
    'bank_accounts',
    'bank_transactions',
    'collection_logs',
    'financial_snapshots',
    'remittances',
    'savings_transactions',
    'expense_categories',
    'collection_groups',
    'action_logs',
    'app_settings',
    'loan_products',
    'feature_flags',
    'role_permissions',
];

export class BackupService {
    /**
     * Export all data to a JSON file and share it.
     */
    static async exportBackup() {
        try {
            console.log('[BackupService] Starting export...');
            const backupData: Record<string, any[]> = {};

            for (const table of COLLECTIONS) {
                const records = await database.collections.get(table).query().fetch();
                // Map records to plain objects, removing Watermelon internal fields if necessary, 
                // but keeping IDs for relationships.
                backupData[table] = records.map(r => r._raw);
            }

            const jsonString = JSON.stringify({
                version: 1,
                timestamp: Date.now(),
                data: backupData
            }, null, 2);

            if (Platform.OS === 'web') {
                this.downloadWeb(jsonString, `infinity_backup_${new Date().toISOString().split('T')[0]}.json`);
                return { success: true, message: 'Backup downloaded' };
            } else {
                const fileUri = `${(FileSystem as any).cacheDirectory}infinity_backup_${Date.now()}.json`;
                await FileSystem.writeAsStringAsync(fileUri, jsonString);

                if (!(await Sharing.isAvailableAsync())) {
                    throw new Error('Sharing is not available on this device');
                }

                await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/json',
                    dialogTitle: 'Save Backup',
                    UTI: 'public.json'
                });

                return { success: true, message: 'Backup shared successfully' };
            }
        } catch (error: any) {
            ErrorService.handleError(error, '[BackupService] Export failed:');
            throw ErrorService.handleError(error, 'BackupService');
        }
    }

    /**
     * Import data from a JSON file.
     * @param options strategy: 'reset' (wipe first) or 'merge' (upsert)
     */
    static async importBackup(strategy: 'reset' | 'merge' = 'merge', onProgress?: (msg: string) => void) {
        try {
            console.log(`[BackupService] Starting import with strategy: ${strategy}...`);
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true
            });

            if (result.canceled) {
                return { success: false, message: 'Import cancelled' };
            }

            const fileUri = result.assets[0].uri;
            let jsonString: string;

            if (Platform.OS === 'web') {
                const fileObj = (result.assets[0] as any).file;
                if (fileObj && typeof fileObj.text === 'function') {
                    jsonString = await fileObj.text();
                } else {
                    const response = await fetch(fileUri);
                    jsonString = await response.text();
                }
            } else {
                jsonString = await (FileSystem as any).readAsStringAsync(fileUri);
            }

            const backup = JSON.parse(jsonString);
            if (!backup.data || typeof backup.data !== 'object') {
                throw new Error('Invalid backup file format');
            }

            // Remove unsafeResetDatabase entirely. We will do a full manual wipe cleanly inside the action!
            await database.write(async () => {
                if (strategy === 'reset') {
                    onProgress?.('Wiping current database cleanly...');
                    const allRecords = await Promise.all(
                        COLLECTIONS.map(table => database.collections.get(table).query().fetch())
                    );
                    const recordsToDelete = allRecords.flat().map(r => r.prepareDestroyPermanently());
                    
                    // Batch delete in chunks if there are thousands of records to avoid memory issues
                    for (let i = 0; i < recordsToDelete.length; i += 500) {
                        const batchChunk = recordsToDelete.slice(i, i + 500);
                        await database.batch(...batchChunk);
                    }
                }

                for (const table of COLLECTIONS) {
                    const records = backup.data[table];
                    if (!records || !Array.isArray(records)) continue;

                    onProgress?.(`Restoring ${table} (${records.length} records)...`);
                    
                    const collection = database.collections.get(table);
                    const batches = [];
                    
                    for (const recordData of records) {
                        // For WatermelonDB, we use prepareCreate or prepareUpdate
                        // If merging, we check for existence
                        let existing;
                        if (strategy === 'merge') {
                            try {
                                existing = await collection.find(recordData.id);
                            } catch (e) {
                                // Not found, will create
                            }
                        }

                        if (existing) {
                            batches.push(
                                existing.prepareUpdate(record => {
                                    Object.assign(record._raw, recordData);
                                    record._raw._status = 'synced';
                                })
                            );
                        } else {
                            batches.push(
                                collection.prepareCreate(record => {
                                    Object.assign(record._raw, recordData);
                                    // Ensure _status is 'synced' to avoid immediate re-sync to Supabase
                                    // since this is a restore of existing data.
                                    record._raw._status = 'synced'; 
                                })
                            );
                        }

                        // Batch every 500 records to avoid memory issues
                        if (batches.length >= 500) {
                            await database.batch(...batches);
                            batches.length = 0;
                        }
                    }

                    if (batches.length > 0) {
                        await database.batch(...batches);
                    }
                }
            });

            return { success: true, message: 'Restore completed successfully' };
        } catch (error: any) {
            ErrorService.handleError(error, '[BackupService] Import failed:');
            throw ErrorService.handleError(error, 'BackupService');
        }
    }

    private static downloadWeb(content: string, filename: string) {
        const file = new Blob([content], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(file);
        const element = document.createElement('a');
        element.style.display = 'none';
        element.href = url;
        element.setAttribute('download', filename);
        document.body.appendChild(element);
        element.click();
        
        setTimeout(() => {
            document.body.removeChild(element);
            URL.revokeObjectURL(url);
        }, 500);
    }
}
