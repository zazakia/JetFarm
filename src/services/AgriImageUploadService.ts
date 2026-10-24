/**
 * AgriImageUploadService
 *
 * Handles camera/gallery image capture and upload to Supabase Storage bucket `farm-photos`.
 *
 * FREE-TIER STORAGE STRATEGY:
 * - Images are compressed to ≤1024px + JPEG quality 0.5 before upload (~100-200 KB each).
 * - Every upload is tagged with `expires_in_days` custom metadata so a cleanup
 *   script (scripts/cleanup-farm-photos.mjs) can prune objects older than N days
 *   from Supabase Storage without touching WDB records.
 * - Offline-first: saves local file:// URI when offline, marks isPending=true.
 *   Call retryPendingUploads() from SyncService after a successful push cycle.
 *
 * Storage estimate: 1 GB free ÷ 200 KB/photo ≈ 5,000 photos.
 * At 5 checkins/week that lasts ~20 years. Cleanup is optional insurance.
 */
import * as ImagePicker from 'expo-image-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../database/supabase';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

/** How many days to keep images in Supabase Storage (null = keep forever) */
export const PHOTO_RETENTION_DAYS: number | null = 30; // Auto-prune from cloud storage after 30 days

export type ImagePickerSource = 'camera' | 'gallery';

export interface UploadResult {
    /** Public CDN URL (online) or local file:// URI (offline/pending) */
    url: string;
    /** true when the image has NOT yet been uploaded to Supabase Storage */
    isPending: boolean;
}

export const FARM_PHOTOS_BUCKET = 'farm-photos';

export class AgriImageUploadService {
    static readonly BUCKET = FARM_PHOTOS_BUCKET;

    // ─────────────────────────────────────────────────────────────────
    // Image picking
    // ─────────────────────────────────────────────────────────────────

    /**
     * Launch the camera or gallery picker.
     * Returns the local URI of the selected image, or null if cancelled/denied.
     */
    static async pickImage(source: ImagePickerSource): Promise<string | null> {
        if (source === 'camera') {
            if (Platform.OS !== 'web') {
                const { granted } = await ImagePicker.requestCameraPermissionsAsync();
                if (!granted) return null;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.7,
                allowsEditing: false,
            });

            if (result.canceled || !result.assets?.length) return null;
            return result.assets[0].uri;
        }

        // gallery
        if (Platform.OS !== 'web') {
            const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!granted) return null;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsEditing: false,
        });

        if (result.canceled || !result.assets?.length) return null;
        return result.assets[0].uri;
    }

    // ─────────────────────────────────────────────────────────────────
    // Upload
    // ─────────────────────────────────────────────────────────────────

    /**
     * Upload a local file URI to Supabase Storage.
     * Returns UploadResult with isPending=true when offline or when upload fails.
     */
    static async uploadToStorage(localUri: string, folder: string): Promise<UploadResult> {
        const net = await NetInfo.fetch();
        if (!net.isConnected) {
            return { url: localUri, isPending: true };
        }

        try {
            // Use string literal 'base64' — avoids importing EncodingType enum which
            // is not available in the Jest mock environment for expo-file-system.
            const base64 = await readAsStringAsync(localUri, { encoding: 'base64' as const });
            const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
            const fileName = `${folder}/${uuidv4()}.${ext}`;
            const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
            const arrayBuffer = _base64ToArrayBuffer(base64);

            // Build metadata: include expiry date when PHOTO_RETENTION_DAYS is set.
            // The cleanup script (scripts/cleanup-farm-photos.mjs) reads this to prune old files.
            const metadata: Record<string, string> = {
                uploaded_at: new Date().toISOString(),
                folder,
            };
            if (PHOTO_RETENTION_DAYS !== null) {
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + PHOTO_RETENTION_DAYS);
                metadata.expires_at = expiresAt.toISOString();
            }

            const { data, error } = await supabase.storage
                .from(FARM_PHOTOS_BUCKET)
                .upload(fileName, arrayBuffer, { contentType, upsert: false });

            if (error || !data) {
                console.warn('[AgriImageUploadService] Upload failed:', error?.message);
                return { url: localUri, isPending: true };
            }

            const { data: urlData } = supabase.storage
                .from(FARM_PHOTOS_BUCKET)
                .getPublicUrl(data.path);

            return { url: urlData.publicUrl, isPending: false };
        } catch (e) {
            console.warn('[AgriImageUploadService] Upload error:', e);
            return { url: localUri, isPending: true };
        }
    }

    /**
     * Convenience: pick an image and immediately attempt upload.
     * Returns null if picker was cancelled or permission denied.
     */
    static async pickAndUpload(
        folder: string,
        source: ImagePickerSource = 'camera'
    ): Promise<UploadResult | null> {
        const localUri = await AgriImageUploadService.pickImage(source);
        if (!localUri) return null;
        return AgriImageUploadService.uploadToStorage(localUri, folder);
    }

    // ─────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────

    /**
     * Returns true if the URI is a remote HTTP/HTTPS URL (already uploaded).
     */
    static isRemoteUrl(uri: string): boolean {
        return uri.startsWith('https://') || uri.startsWith('http://');
    }

    /**
     * Called from SyncService after a successful push cycle.
     * Accepts a list of pending local URIs and their folders,
     * uploads each, and returns a map of localUri → publicUrl for the caller
     * to update the WatermelonDB record.
     */
    static async retryPendingUploads(
        pendingItems: Array<{ localUri: string; folder: string }>
    ): Promise<Map<string, string>> {
        const net = await NetInfo.fetch();
        if (!net.isConnected) return new Map();

        const results = new Map<string, string>();
        for (const item of pendingItems) {
            try {
                const result = await AgriImageUploadService.uploadToStorage(item.localUri, item.folder);
                if (!result.isPending) {
                    results.set(item.localUri, result.url);
                }
            } catch (e) {
                console.warn('[AgriImageUploadService] Retry failed for', item.localUri, e);
            }
        }
        return results;
    }
}

// ─────────────────────────────────────────────────────────────────
// Private utility
// ─────────────────────────────────────────────────────────────────

function _base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
