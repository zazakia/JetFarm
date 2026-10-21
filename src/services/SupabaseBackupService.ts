import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../database/supabase';
import Toast from '../components/AppToast';
import { ErrorService } from "./ErrorService";
import syncTableContract from './syncTableContract.json';

/**
 * Backup scope comes from the sync contract, not a hand-maintained list. The retired lending
 * remote tables (app_borrowers, app_loans, app_payments, app_loan_products, ...) no longer
 * exist on this variant, and both exportBackup and importBackup rethrow the first query error,
 * so a stale literal list broke the Settings backup button outright.
 */
const REMOTE_TABLES: string[] = Array.from(
    new Set<string>(Object.values(syncTableContract.remoteTableMap as Record<string, string>)),
);

export class SupabaseBackupService {
    /**
     * Export all data from Supabase to a JSON file and share it.
     */
    static async exportBackup(silent = false) {
        try {
            console.log('[SupabaseBackupService] Starting export...');
            const backupData: Record<string, any[]> = {};

            for (const table of REMOTE_TABLES) {
                // To fetch all data we may need to paginate if data > 1000 rows.
                // Doing a simple while loop pagination.
                let allActive: any[] = [];
                let activePage = 0;
                const pageSize = 1000;
                let activeHasMore = true;

                while (activeHasMore) {
                    const { data, error } = await supabase
                        .from(table)
                        .select('*')
                        .range(activePage * pageSize, (activePage + 1) * pageSize - 1);
                    
                    if (error) throw ErrorService.handleError(error, `Fetch failed for ${table}: ${error.message}`);
                    
                    if (data && data.length > 0) {
                        allActive = allActive.concat(data);
                        if (data.length < pageSize) activeHasMore = false;
                        else activePage++;
                    } else {
                        activeHasMore = false;
                    }
                }
                backupData[table] = allActive;
                console.log(`[SupabaseBackupService] Fetched ${allActive.length} rows for ${table}`);
            }

            const jsonString = JSON.stringify({
                version: 1,
                timestamp: Date.now(),
                data: backupData
            }, null, 2);

            const filename = `infinity_cloud_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

            if (Platform.OS === 'web') {
                if (silent) {
                    return { success: true, message: 'Cloud backup prepared' };
                }
                this.downloadWeb(jsonString, filename);
                return { success: true, message: 'Cloud backup downloaded' };
            } else {
                const fileUri = `${(FileSystem as any).cacheDirectory}${filename}`;
                await FileSystem.writeAsStringAsync(fileUri, jsonString);

                if (!silent) {
                    if (!(await Sharing.isAvailableAsync())) {
                        throw new Error('Sharing is not available on this device');
                    }
                    await Sharing.shareAsync(fileUri, {
                        mimeType: 'application/json',
                        dialogTitle: 'Save Cloud Backup',
                        UTI: 'public.json'
                    });
                    return { success: true, message: 'Cloud backup shared successfully' };
                }
                return { success: true, message: `Backup saved to cache: ${fileUri}`, uri: fileUri };
            }
        } catch (error: any) {
            ErrorService.handleError(error, '[SupabaseBackupService] Export failed:');
            throw ErrorService.handleError(error, 'SupabaseBackupService');
        }
    }

    /**
     * Import data from a JSON file using Upsert (Merge)
     */
    static async importBackup(onProgress?: (msg: string) => void) {
        try {
            console.log(`[SupabaseBackupService] Starting Upsert Merge...`);
            
            // 1. Force a backup first.
            // On web, silent export does not persist an artifact, so we need a
            // real download before continuing the restore flow.
            const isWeb = Platform.OS === 'web';
            onProgress?.(isWeb
                ? 'Preparing to restore. Downloading a safety backup first...'
                : 'Preparing to restore. Creating a safety backup first...');
            await this.exportBackup(!isWeb);
            
            onProgress?.(isWeb
                ? 'Safety backup downloaded. Please select the file to restore.'
                : 'Safety backup created. Please select the file to restore.');

            // 2. Start restore
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true
            });

            if (result.canceled) {
                return { success: false, message: 'Restore cancelled' };
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
                jsonString = await FileSystem.readAsStringAsync(fileUri);
            }

            const backup = JSON.parse(jsonString);
            if (!backup.data || typeof backup.data !== 'object') {
                throw new Error('Invalid backup file format');
            }

            for (const table of REMOTE_TABLES) {
                const records = backup.data[table];
                if (!records || !Array.isArray(records) || records.length === 0) continue;

                onProgress?.(`Restoring ${table} (${records.length} records)...`);
                
                // Batch upsert every 500 records
                for (let i = 0; i < records.length; i += 500) {
                    const batchChunk = records.slice(i, i + 500);
                    const { error } = await supabase.from(table).upsert(batchChunk);
                    if (error) {
                        throw ErrorService.handleError(error, `Failed to upsert ${table}: ${error.message}`);
                    }
                }
            }

            return { success: true, message: 'Cloud restore completed successfully' };
        } catch (error: any) {
            ErrorService.handleError(error, '[SupabaseBackupService] Import failed:');
            throw ErrorService.handleError(error, 'SupabaseBackupService');
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
            if (typeof document !== 'undefined' && document.body) {
                document.body.removeChild(element);
            }
            if (typeof URL.revokeObjectURL === 'function') {
                URL.revokeObjectURL(url);
            }
        }, 500);
    }
}
