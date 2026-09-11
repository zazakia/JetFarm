import { Database, Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database as globalDatabase } from '../database';
import AppSetting from '../database/models/AppSetting';
import LoanProduct from '../database/models/LoanProduct';
import FeatureFlag from '../database/models/FeatureFlag';
import RolePermission from '../database/models/RolePermission';
import { ActionLogService } from './ActionLogService';
import {
    DEFAULT_FEATURE_FLAGS,
    DEFAULT_LOAN_PRODUCTS,
    DEFAULT_ROLE_PERMISSIONS,
    DEFAULT_COOP_SETTINGS,
    DefaultFeatureFlag,
    DefaultRolePermission,
    DefaultCoopSetting,
} from '../constants/configDefaults';
import { LoanProductPreset, LoanProductType, LOAN_PRODUCT_PRESETS, setRuntimeLoanProductPresets } from '../utils/loanProducts';
import { isLendingFeatureKey } from '../utils/featureFlags';
import { ErrorService } from "./ErrorService";
import {
    isLocalOnlyAppSettingKey,
    stripLocalOnlySettingValue,
} from '../utils/auditPayloadSanitizer';

type ConfigDatabase = Database;

export type LoanProductConfig = typeof DEFAULT_LOAN_PRODUCTS[number];

const now = () => Date.now();
const activeQuery = [Q.where('deleted_at', Q.eq(null))];
const localSettingStorageKey = (key: string) => `local_only_setting:${key}`;

const optionalNumber = (value: number | null | undefined): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return undefined;
    return value;
};

export class SettingsServiceClass {
    private ensureDefaultsPromise: Promise<void> | null = null;
    private actionLogService: ActionLogService;

    constructor(private db: ConfigDatabase = globalDatabase) {
        this.actionLogService = new ActionLogService(db);
    }

    private get database() {
        return this.db;
    }

    async ensureDefaults() {
        if (this.ensureDefaultsPromise) return this.ensureDefaultsPromise;

        this.ensureDefaultsPromise = (async () => {
            await this.ensureLoanProducts();
            await this.ensureFeatureFlags();
            await this.ensureRolePermissions();
            await this.ensureCoopSettings();
        })().finally(() => {
            this.ensureDefaultsPromise = null;
        });

        return this.ensureDefaultsPromise;
    }

    private async exists(tableName: string, id: string) {
        try {
            await this.database.collections.get(tableName).find(id);
            return true;
        } catch {
            return false;
        }
    }

    private markSeededDefaultAsSynced(record: any) {
        // Defaults are an offline fallback copy of server-managed configuration.
        // They must not be treated as client-authored changes or non-admin roles
        // will try to push them and correctly hit configuration-table RLS.
        record._raw._status = 'synced';
        record._raw._changed = '';
    }

    private async ensureLoanProducts() {
        const collection = this.database.get<LoanProduct>('loan_products');
        for (const product of DEFAULT_LOAN_PRODUCTS) {
            if (await this.exists('loan_products', product.id)) continue;
            await this.database.write(async () => {
                await collection.create(record => {
                    (record as any)._raw.id = product.id;
                    this.assignLoanProduct(record, product);
                    record.createdAt = now();
                    record.updatedAt = now();
                    record.deletedAt = null;
                    this.markSeededDefaultAsSynced(record);
                });
            });
        }
    }

    private async ensureFeatureFlags() {
        const collection = this.database.get<FeatureFlag>('feature_flags');
        for (const flag of DEFAULT_FEATURE_FLAGS) {
            if (await this.exists('feature_flags', flag.id)) continue;
            await this.database.write(async () => {
                await collection.create(record => {
                    (record as any)._raw.id = flag.id;
                    this.assignFeatureFlag(record, flag);
                    record.createdAt = now();
                    record.updatedAt = now();
                    record.deletedAt = null;
                    this.markSeededDefaultAsSynced(record);
                });
            });
        }
    }

    private async ensureRolePermissions() {
        const collection = this.database.get<RolePermission>('role_permissions');
        for (const permission of DEFAULT_ROLE_PERMISSIONS) {
            if (await this.exists('role_permissions', permission.id)) continue;
            await this.database.write(async () => {
                await collection.create(record => {
                    (record as any)._raw.id = permission.id;
                    this.assignRolePermission(record, permission);
                    record.createdAt = now();
                    record.updatedAt = now();
                    record.deletedAt = null;
                    this.markSeededDefaultAsSynced(record);
                });
            });
        }
    }

    private async ensureCoopSettings() {
        const collection = this.database.get<AppSetting>('app_settings');
        for (const setting of DEFAULT_COOP_SETTINGS) {
            if (await this.exists('app_settings', setting.id)) continue;
            await this.database.write(async () => {
                await collection.create(record => {
                    (record as any)._raw.id = setting.id;
                    record.key = setting.key;
                    record.value = setting.value;
                    record.valueType = setting.valueType;
                    record.scope = setting.scope;
                    record.isActive = setting.isActive;
                    record.createdAt = now();
                    record.updatedAt = now();
                    record.deletedAt = null;
                    this.markSeededDefaultAsSynced(record);
                });
            });
        }
    }

    private assignLoanProduct(record: LoanProduct, product: LoanProductConfig) {
        record.productType = product.productType;
        record.label = product.label;
        record.description = product.description;
        record.defaultRatePercent = product.defaultRatePercent;
        record.defaultTerm = product.defaultTerm;
        record.defaultTermUnit = product.defaultTermUnit;
        record.defaultFrequency = product.defaultFrequency;
        record.defaultProcessingFeeRate = product.defaultProcessingFeeRate;
        record.defaultProcessingFeeFlat = product.defaultProcessingFeeFlat;
        record.defaultNotarialFee = product.defaultNotarialFee;
        record.notarialFeeThreshold = product.notarialFeeThreshold;
        record.notarialFeeAboveThreshold = product.notarialFeeAboveThreshold;
        record.defaultSavingsPerPayment = product.defaultSavingsPerPayment;
        record.defaultPrincipal = product.defaultPrincipal;
        record.maxPrincipal = product.maxPrincipal;
        record.minTermMonths = product.minTermMonths;
        record.maxTermMonths = product.maxTermMonths;
        record.isActive = product.isActive;
        record.sortOrder = product.sortOrder;
    }

    private assignFeatureFlag(record: FeatureFlag, flag: DefaultFeatureFlag) {
        record.key = flag.key;
        record.label = flag.label;
        record.description = flag.description;
        record.category = flag.category;
        record.enabled = flag.enabled;
        record.sortOrder = flag.sortOrder;
    }

    private assignRolePermission(record: RolePermission, permission: DefaultRolePermission) {
        record.role = permission.role;
        record.permissionKey = permission.permissionKey;
        record.label = permission.label;
        record.category = permission.category;
        record.enabled = permission.enabled;
    }

    async getAppSetting(key: string, fallback: string = '') {
        await this.ensureDefaults();

        if (isLocalOnlyAppSettingKey(key)) {
            try {
                const local = await AsyncStorage.getItem(localSettingStorageKey(key));
                if (local != null) return local;
            } catch (error) {
                ErrorService.handleError(error, `[SettingsService] Failed reading local-only setting ${key}:`);
            }
        }

        const records = await this.database.get<AppSetting>('app_settings').query(
            ...activeQuery,
            Q.where('key', key),
            Q.take(1),
        ).fetch();
        const value = records[0]?.value ?? fallback;

        // Migrate any legacy logo blob out of the synced Watermelon row into device storage.
        if (isLocalOnlyAppSettingKey(key) && records[0] && value) {
            try {
                await AsyncStorage.setItem(localSettingStorageKey(key), value);
                await this.database.write(async () => {
                    await records[0].update(r => {
                        r.value = '';
                        r.updatedAt = now();
                    });
                });
            } catch (error) {
                ErrorService.handleError(error, `[SettingsService] Failed migrating local-only setting ${key}:`);
            }
            return value;
        }

        return value;
    }

    async getNumberSetting(key: string, fallback: number): Promise<number> {
        const value = await this.getAppSetting(key, String(fallback));
        const num = Number(value);
        return isNaN(num) ? fallback : num;
    }

    async setAppSetting(key: string, value: string, performedBy?: string) {
        await this.ensureDefaults();
        const collection = this.database.get<AppSetting>('app_settings');
        const records = await collection.query(
            ...activeQuery,
            Q.where('key', key),
            Q.take(1),
        ).fetch();

        const persistValue = stripLocalOnlySettingValue(key, value);
        if (isLocalOnlyAppSettingKey(key)) {
            try {
                if (value) {
                    await AsyncStorage.setItem(localSettingStorageKey(key), value);
                } else {
                    await AsyncStorage.removeItem(localSettingStorageKey(key));
                }
            } catch (error) {
                ErrorService.handleError(error, `[SettingsService] Failed writing local-only setting ${key}:`);
                throw error;
            }
        }

        const record = records[0];
        if (record) {
            const oldData = { ...record._raw, value: stripLocalOnlySettingValue(record.key, record.value) };
            await this.database.write(async () => {
                await record.update(r => {
                    r.value = persistValue;
                    r.updatedAt = now();
                });
            });
            await this.actionLogService.logAction({
                entityType: 'app_settings',
                entityId: record.id,
                action: 'UPDATE',
                oldData,
                newData: {
                    ...record._raw,
                    value: persistValue,
                    // Audit trail records presence, not the binary payload.
                    local_only_value_present: isLocalOnlyAppSettingKey(key) ? Boolean(value) : undefined,
                },
                performedBy,
            });
        } else {
            const def = DEFAULT_COOP_SETTINGS.find(s => s.key === key);
            const id = def?.id || `setting-${key.replace(/\./g, '-')}`;
            await this.database.write(async () => {
                const newRecord = await collection.create(r => {
                    (r as any)._raw.id = id;
                    r.key = key;
                    r.value = persistValue;
                    r.valueType = def?.valueType || 'string';
                    r.scope = def?.scope || 'global';
                    r.isActive = true;
                    r.createdAt = now();
                    r.updatedAt = now();
                    r.deletedAt = null;
                });
                await this.actionLogService.logAction({
                    entityType: 'app_settings',
                    entityId: id,
                    action: 'CREATE',
                    oldData: null,
                    newData: {
                        ...newRecord._raw,
                        value: persistValue,
                        local_only_value_present: isLocalOnlyAppSettingKey(key) ? Boolean(value) : undefined,
                    },
                    performedBy,
                });
            });
        }
    }

    async getLoanProducts() {
        await this.ensureDefaults();
        return this.database.get<LoanProduct>('loan_products').query(
            ...activeQuery,
            Q.sortBy('sort_order', Q.asc),
        ).fetch();
    }

    async getLoanProductPresetMap() {
        const products = await this.getLoanProducts();
        const map: Record<LoanProductType, LoanProductPreset> = { ...LOAN_PRODUCT_PRESETS };
        products
            .forEach(product => {
                const type = product.productType as LoanProductType;
                if (!LOAN_PRODUCT_PRESETS[type]) return;
                map[type] = this.toPreset(product);
            });
        setRuntimeLoanProductPresets(map);
        return map;
    }

    toPreset(product: LoanProduct): LoanProductPreset {
        return {
            label: product.label,
            description: product.description || '',
            defaultRatePercent: String(product.defaultRatePercent ?? 0),
            defaultTerm: String(product.defaultTerm ?? 1),
            defaultTermUnit: (product.defaultTermUnit || 'months') as LoanProductPreset['defaultTermUnit'],
            defaultFrequency: (product.defaultFrequency || 'monthly') as LoanProductPreset['defaultFrequency'],
            defaultProcessingFeeRate: product.defaultProcessingFeeRate ?? 0,
            defaultProcessingFeeFlat: optionalNumber(product.defaultProcessingFeeFlat),
            defaultNotarialFee: String(product.defaultNotarialFee ?? 0),
            notarialFeeThreshold: optionalNumber(product.notarialFeeThreshold),
            notarialFeeAboveThreshold: optionalNumber(product.notarialFeeAboveThreshold),
            defaultSavingsPerPayment: String(product.defaultSavingsPerPayment ?? 0),
            defaultPrincipal: optionalNumber(product.defaultPrincipal)?.toString(),
            maxPrincipal: optionalNumber(product.maxPrincipal),
            minTermMonths: optionalNumber(product.minTermMonths),
            maxTermMonths: optionalNumber(product.maxTermMonths),
            isActive: product.isActive !== false,
        };
    }

    async updateLoanProduct(product: LoanProduct, patch: Partial<LoanProductConfig>, performedBy?: string) {
        const oldData = { ...product._raw };
        await this.database.write(async () => {
            await product.update(record => {
                this.assignLoanProduct(record, {
                    id: product.id,
                    productType: product.productType as LoanProductType,
                    label: patch.label ?? product.label,
                    description: patch.description ?? product.description,
                    defaultRatePercent: patch.defaultRatePercent ?? product.defaultRatePercent,
                    defaultTerm: patch.defaultTerm ?? product.defaultTerm,
                    defaultTermUnit: (patch.defaultTermUnit ?? product.defaultTermUnit) as LoanProductConfig['defaultTermUnit'],
                    defaultFrequency: (patch.defaultFrequency ?? product.defaultFrequency) as LoanProductConfig['defaultFrequency'],
                    defaultProcessingFeeRate: patch.defaultProcessingFeeRate ?? product.defaultProcessingFeeRate,
                    defaultProcessingFeeFlat: patch.defaultProcessingFeeFlat ?? product.defaultProcessingFeeFlat ?? 0,
                    defaultNotarialFee: patch.defaultNotarialFee ?? product.defaultNotarialFee ?? 0,
                    notarialFeeThreshold: patch.notarialFeeThreshold ?? product.notarialFeeThreshold ?? 0,
                    notarialFeeAboveThreshold: patch.notarialFeeAboveThreshold ?? product.notarialFeeAboveThreshold ?? 0,
                    defaultSavingsPerPayment: patch.defaultSavingsPerPayment ?? product.defaultSavingsPerPayment ?? 0,
                    defaultPrincipal: patch.defaultPrincipal ?? product.defaultPrincipal ?? 0,
                    maxPrincipal: patch.maxPrincipal ?? product.maxPrincipal ?? 0,
                    minTermMonths: patch.minTermMonths ?? product.minTermMonths ?? 0,
                    maxTermMonths: patch.maxTermMonths ?? product.maxTermMonths ?? 0,
                    isActive: patch.isActive ?? product.isActive,
                    sortOrder: patch.sortOrder ?? product.sortOrder ?? 0,
                });
                record.updatedAt = now();
            });
        });
        await this.actionLogService.logAction({
            entityType: 'loan_products',
            entityId: product.id,
            action: 'UPDATE',
            oldData,
            newData: product._raw,
            performedBy,
        });
        await this.getLoanProductPresetMap();
    }

    async getFeatureFlags() {
        await this.ensureDefaults();
        return this.database.get<FeatureFlag>('feature_flags').query(
            ...activeQuery,
            Q.sortBy('sort_order', Q.asc),
        ).fetch();
    }

    async getFeatureFlagMap() {
        const flags = await this.getFeatureFlags();
        return Object.fromEntries(flags.map(flag => [flag.key, flag.enabled !== false])) as Record<string, boolean>;
    }

    async isFeatureEnabled(key: string, fallback = true) {
        const flags = await this.getFeatureFlags();
        const masterFlag = flags.find(item => item.key === 'system.lending');
        if (masterFlag && masterFlag.enabled === false && isLendingFeatureKey(key)) {
            return false;
        }
        const flag = flags.find(item => item.key === key);
        return flag ? flag.enabled !== false : fallback;
    }

    private featureFlagListeners = new Set<(flags: Record<string, boolean>) => void>();

    subscribeToFeatureFlags(callback: (flags: Record<string, boolean>) => void): () => void {
        this.featureFlagListeners.add(callback);
        let unsubscribeWdb: (() => void) | undefined;
        try {
            const query = this.database.get<FeatureFlag>('feature_flags').query(
                ...activeQuery,
                Q.sortBy('sort_order', Q.asc)
            );
            if (query && typeof (query as any).observe === 'function') {
                const sub = (query as any).observe().subscribe({
                    next: (records: FeatureFlag[]) => {
                        const map = Object.fromEntries(records.map(f => [f.key, f.enabled !== false])) as Record<string, boolean>;
                        callback(map);
                    },
                    error: (err: any) => {
                        console.warn('[SettingsService] feature_flags observe error:', err);
                    }
                });
                unsubscribeWdb = () => sub.unsubscribe();
            }
        } catch {
            // Ignore in environments where observe is not supported
        }

        return () => {
            this.featureFlagListeners.delete(callback);
            if (unsubscribeWdb) {
                unsubscribeWdb();
            }
        };
    }

    private async notifyFeatureFlagListeners() {
        try {
            const map = await this.getFeatureFlagMap();
            for (const listener of this.featureFlagListeners) {
                try {
                    listener(map);
                } catch (e) {
                    ErrorService.handleError(e, '[SettingsService] listener error:');
                }
            }
        } catch (e) {
            console.warn('[SettingsService] notifyFeatureFlagListeners failed:', e);
        }
    }

    async setFeatureEnabled(flag: FeatureFlag, enabled: boolean, performedBy?: string) {
        const oldData = { ...flag._raw };
        await this.database.write(async () => {
            await flag.update(record => {
                record.enabled = enabled;
                record.updatedAt = now();
            });
        });
        await this.actionLogService.logAction({
            entityType: 'feature_flags',
            entityId: flag.id,
            action: 'UPDATE',
            oldData,
            newData: flag._raw,
            performedBy,
        });
        void this.notifyFeatureFlagListeners();
    }

    async getRolePermissions() {
        await this.ensureDefaults();
        return this.database.get<RolePermission>('role_permissions').query(
            ...activeQuery,
            Q.sortBy('role', Q.asc),
            Q.sortBy('permission_key', Q.asc),
        ).fetch();
    }

    async getRolePermissionMap(role: string | null | undefined) {
        if (!role) return {};
        const permissions = await this.getRolePermissions();
        return Object.fromEntries(
            permissions
                .filter(permission => permission.role === role)
                .map(permission => [permission.permissionKey, permission.enabled !== false])
        ) as Record<string, boolean>;
    }

    async isRolePermissionEnabled(role: string | null | undefined, permissionKey: string, fallback = true) {
        if (!role) return false;
        const permissions = await this.getRolePermissions();
        const permission = permissions.find(item => item.role === role && item.permissionKey === permissionKey);
        return permission ? permission.enabled !== false : fallback;
    }

    async setRolePermissionEnabled(permission: RolePermission, enabled: boolean, performedBy?: string) {
        const oldData = { ...permission._raw };
        await this.database.write(async () => {
            await permission.update(record => {
                record.enabled = enabled;
                record.updatedAt = now();
            });
        });
        await this.actionLogService.logAction({
            entityType: 'role_permissions',
            entityId: permission.id,
            action: 'UPDATE',
            oldData,
            newData: permission._raw,
            performedBy,
        });
    }
}

export const SettingsService = new SettingsServiceClass();
