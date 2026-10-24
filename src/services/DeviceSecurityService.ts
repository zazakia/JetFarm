import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { SecureStorageAdapter } from '../utils/SecureStorageAdapter';
import { supabase } from '../database/supabase';
import { database } from '../database';
import { isLocalWebE2E } from '../utils/e2eEnvironment';
import { ErrorService } from "./ErrorService";

const DEVICE_ID_KEY = 'poscursor_device_unique_id';

export interface DeviceStatus {
    deviceId: string;
    isLocked: boolean;
    wipeRequested: boolean;
    branchId?: string | null;
}

type LockListener = (isLocked: boolean) => void;

class DeviceSecurityService {
    private static instance: DeviceSecurityService;
    private cachedDeviceId: string | null = null;
    private isLockedState: boolean = false;
    private listeners: Set<LockListener> = new Set();
    private heartbeatTimer: any = null;
    private isRemoteAvailable: boolean = true;

    static getInstance(): DeviceSecurityService {
        if (!DeviceSecurityService.instance) {
            DeviceSecurityService.instance = new DeviceSecurityService();
        }
        return DeviceSecurityService.instance;
    }

    /**
     * Get or initialize the persistent device identifier.
     */
    async getDeviceId(): Promise<string> {
        if (this.cachedDeviceId) return this.cachedDeviceId;

        let id = await SecureStorageAdapter.getItem(DEVICE_ID_KEY);
        if (!id) {
            id = `pos-${Platform.OS}-${uuidv4().substring(0, 8)}`;
            await SecureStorageAdapter.setItem(DEVICE_ID_KEY, id);
        }
        this.cachedDeviceId = id;
        return id;
    }

    /**
     * Subscribe to lock state changes.
     */
    onLockChange(listener: LockListener): () => void {
        this.listeners.add(listener);
        listener(this.isLockedState);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners(locked: boolean) {
        this.isLockedState = locked;
        this.listeners.forEach(fn => fn(locked));
    }

    isLocked(): boolean {
        return this.isLockedState;
    }

    /**
     * Heartbeat check: Ping Supabase device_registry, update last_heartbeat,
     * and check if device has been marked locked or wiped remotely.
     */
    async checkAndReportStatus(branchId?: string | null): Promise<DeviceStatus> {
        const deviceId = await this.getDeviceId();

        const status: DeviceStatus = {
            deviceId,
            isLocked: this.isLockedState,
            wipeRequested: false,
            branchId: branchId || null
        };

        // E2E / preview hosts mock sync and often lack write RLS for non-admin roles.
        if (!supabase || isLocalWebE2E() || !this.isRemoteAvailable) {
            return status;
        }

        // Only query/heartbeat remote device_registry when user is authenticated.
        // Unauthenticated calls trigger 401 Unauthorized against Supabase REST endpoint.
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
            return status;
        }

        try {
            // Check existing record in remote device_registry
            const { data, error } = await supabase
                .from('device_registry')
                .select('is_locked, wipe_requested, branch_id')
                .eq('device_id', deviceId)
                .maybeSingle();

            if (error) {
                const errAny = error as any;
                if (
                    error.code === 'PGRST205' ||
                    errAny.status === 404 ||
                    error.message?.includes('does not exist') ||
                    error.message?.includes('schema cache')
                ) {
                    this.isRemoteAvailable = false;
                    this.stopHeartbeat();
                    return status;
                }
                console.warn('[DeviceSecurity] Check error:', error.message);
                return status;
            }

            const now = new Date().toISOString();

            if (!data) {
                // Register this device on first contact
                const { error: insertError } = await supabase.from('device_registry').insert({
                    device_id: deviceId,
                    branch_id: branchId || 'unassigned',
                    device_name: `${Platform.OS.toUpperCase()} Terminal`,
                    os_version: Platform.OS,
                    app_version: '0.1.0',
                    is_locked: false,
                    wipe_requested: false,
                    last_heartbeat: now,
                    is_active: true
                });
                if (insertError) {
                    console.warn('[DeviceSecurity] Register error:', insertError.message);
                }
            } else {
                // Device exists in registry
                status.isLocked = !!data.is_locked;
                status.wipeRequested = !!data.wipe_requested;
                status.branchId = data.branch_id || branchId;

                // Update heartbeat
                const { error: updateError } = await supabase
                    .from('device_registry')
                    .update({
                        last_heartbeat: now,
                        ...(branchId ? { branch_id: branchId } : {})
                    })
                    .eq('device_id', deviceId);
                if (updateError) {
                    console.warn('[DeviceSecurity] Heartbeat error:', updateError.message);
                }

                // Handle Lock
                if (status.isLocked !== this.isLockedState) {
                    this.notifyListeners(status.isLocked);
                }

                // Handle Wipe
                if (status.wipeRequested) {
                    console.warn('[DeviceSecurity] Remote wipe requested! Executing wipe...');
                    await this.executeRemoteWipe(deviceId);
                }
            }
        } catch (err: any) {
            console.warn('[DeviceSecurity] Status check failed:', err?.message || err);
        }

        return status;
    }

    /**
     * Clear all local database tables and authentication tokens upon remote wipe request.
     */
    async executeRemoteWipe(deviceId: string): Promise<void> {
        try {
            if (database && typeof (database as any).unsafeResetDatabase === 'function') {
                await (database as any).unsafeResetDatabase();
                console.log('[DeviceSecurity] WatermelonDB wiped successfully.');
            }

            // Remove auth session tokens
            await SecureStorageAdapter.removeItem('supabase.auth.token');
            await SecureStorageAdapter.removeItem('poscursor_active_branch');

            // Notify Supabase that wipe was completed
            if (supabase) {
                await supabase
                    .from('device_registry')
                    .update({
                        wipe_requested: false,
                        wipe_completed_at: new Date().toISOString(),
                        is_locked: true // Keep device locked after wipe
                    })
                    .eq('device_id', deviceId);
            }

            this.notifyListeners(true);
        } catch (err) {
            ErrorService.handleError(err, '[DeviceSecurity] Wipe failed:');
        }
    }

    /**
     * Start background heartbeat timer (runs every 15 minutes).
     */
    startHeartbeat(branchId?: string | null, intervalMs: number = 15 * 60 * 1000): void {
        this.stopHeartbeat();
        void this.checkAndReportStatus(branchId);
        this.heartbeatTimer = setInterval(() => {
            void this.checkAndReportStatus(branchId);
        }, intervalMs);
    }

    stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
}

export const deviceSecurityService = DeviceSecurityService.getInstance();
