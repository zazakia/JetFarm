import { Database } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { SettingsServiceClass } from '../SettingsService';
import { DEFAULT_FEATURE_FLAGS, DEFAULT_ROLE_PERMISSIONS } from '../../constants/configDefaults';

describe('SettingsService', () => {
    let db: Database;
    let service: SettingsServiceClass;

    beforeEach(() => {
        db = createTestDatabase();
        service = new SettingsServiceClass(db);
    });

    afterEach(async () => {
        await closeTestDatabase(db);
    });

    it('bootstraps configurable defaults into the local database', async () => {
        await service.ensureDefaults();

        const [loanProducts, featureFlags, rolePermissions] = await Promise.all([
            db.get('loan_products').query().fetch(),
            db.get('feature_flags').query().fetch(),
            db.get('role_permissions').query().fetch(),
        ]);

        expect(loanProducts).toHaveLength(0);
        expect(featureFlags).toHaveLength(DEFAULT_FEATURE_FLAGS.length);
        expect(rolePermissions).toHaveLength(DEFAULT_ROLE_PERMISSIONS.length);
        expect([
            ...loanProducts,
            ...featureFlags,
            ...rolePermissions,
        ].every(record => (record as any)._raw._status === 'synced' && (record as any)._raw._changed === '')).toBe(true);
    });

    it('exposes feature and role permission maps', async () => {
        const [flags, permissions] = await Promise.all([
            service.getFeatureFlagMap(),
            service.getRolePermissionMap('collector'),
        ]);

        expect(flags['module.loans']).toBe(true);
        expect(permissions['route.(collector)']).toBe(true);
        expect(permissions['route.(admin)']).toBe(false);
    });

    it('updates feature and role toggles through the service maps', async () => {
        await service.ensureDefaults();

        const feature = (await service.getFeatureFlags()).find(flag => flag.key === 'module.loans');
        const permission = (await service.getRolePermissions()).find(item => (
            item.role === 'collector' && item.permissionKey === 'route.(collector)'
        ));

        expect(feature).toBeTruthy();
        expect(permission).toBeTruthy();

        await service.setFeatureEnabled(feature!, false);
        await service.setRolePermissionEnabled(permission!, false);

        await expect(service.isFeatureEnabled('module.loans')).resolves.toBe(false);
        await expect(service.isRolePermissionEnabled('collector', 'route.(collector)')).resolves.toBe(false);
    });

    it('bootstraps branding and company name settings defaults', async () => {
        await service.ensureDefaults();

        const [companyName, companyNameFull, logoBase64Setting] = await Promise.all([
            service.getAppSetting('brand.company_name'),
            service.getAppSetting('brand.company_name_full'),
            service.getAppSetting('brand.logo_base64'),
        ]);

        expect(companyName).toBe('Agri-One');
        expect(companyNameFull).toBe('Agri-One');
        expect(logoBase64Setting).toBe('');
    });

    it('keeps brand logo local-only and never stores the blob in synced app_settings', async () => {
        const AsyncStorage = require('@react-native-async-storage/async-storage');
        await service.ensureDefaults();

        const logo = `data:image/png;base64,${'Z'.repeat(4000)}`;
        await service.setAppSetting('brand.logo_base64', logo, 'admin-1');

        await expect(service.getAppSetting('brand.logo_base64')).resolves.toBe(logo);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('local_only_setting:brand.logo_base64', logo);

        const rows = await db.get('app_settings').query().fetch() as any[];
        const logoRow = rows.find(r => r.key === 'brand.logo_base64');
        expect(logoRow.value).toBe('');

        const logs = await db.get('action_logs').query().fetch() as any[];
        const logoLog = logs.find(l => l.entityId === 'setting-brand-logo-base64' || (l.newData || '').includes('brand.logo_base64'));
        expect(logoLog).toBeTruthy();
        expect(logoLog.newData).not.toContain('data:image/png;base64,ZZZ');
    });
});
