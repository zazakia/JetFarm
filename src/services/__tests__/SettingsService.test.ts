import { Database } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { SettingsServiceClass } from '../SettingsService';
import { DEFAULT_COOP_SETTINGS, DEFAULT_FEATURE_FLAGS, DEFAULT_ROLE_PERMISSIONS } from '../../constants/configDefaults';

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

    // Post-teardown config set: the lending `loan_products` table is retired, so the bootstrap
    // contract is asserted over the surviving configuration tables. SettingsService.ensureDefaults
    // owns app_settings / feature_flags / role_permissions; the other surviving config tables
    // belong to their own services and must stay untouched by bootstrap.
    const OWNED_CONFIG_TABLES = ['app_settings', 'feature_flags', 'role_permissions'];
    const FOREIGN_CONFIG_TABLES = ['statutory_rates', 'financial_period_settings', 'statutory_fund_allocations'];

    it('bootstraps configurable defaults into the local database', async () => {
        expect(OWNED_CONFIG_TABLES).toHaveLength(3);
        expect(FOREIGN_CONFIG_TABLES).toHaveLength(3);
        // Positive control: the expectation lists below come from real default sets, not empty arrays.
        expect(DEFAULT_COOP_SETTINGS.length).toBeGreaterThan(0);
        expect(DEFAULT_FEATURE_FLAGS.length).toBeGreaterThan(0);
        expect(DEFAULT_ROLE_PERMISSIONS.length).toBeGreaterThan(0);

        await service.ensureDefaults();

        const [appSettings, featureFlags, rolePermissions] = await Promise.all(
            OWNED_CONFIG_TABLES.map(table => db.get(table).query().fetch())
        );

        expect(appSettings).toHaveLength(DEFAULT_COOP_SETTINGS.length);
        expect(featureFlags).toHaveLength(DEFAULT_FEATURE_FLAGS.length);
        expect(rolePermissions).toHaveLength(DEFAULT_ROLE_PERMISSIONS.length);

        const bootstrapped = [...appSettings, ...featureFlags, ...rolePermissions];
        expect(bootstrapped).toHaveLength(
            DEFAULT_COOP_SETTINGS.length + DEFAULT_FEATURE_FLAGS.length + DEFAULT_ROLE_PERMISSIONS.length
        );
        expect(bootstrapped.every(record =>
            (record as any)._raw._status === 'synced' && (record as any)._raw._changed === '')).toBe(true);

        // Bootstrap must not seed configuration owned elsewhere (was the `loan_products` guard).
        const foreignCounts = await Promise.all(
            FOREIGN_CONFIG_TABLES.map(table => db.get(table).query().fetchCount())
        );
        expect(foreignCounts).toEqual([0, 0, 0]);
    });

    it('exposes feature and role permission maps', async () => {
        const [flags, permissions] = await Promise.all([
            service.getFeatureFlagMap(),
            service.getRolePermissionMap('expenses_encoder'),
        ]);

        expect(flags['module.accounting']).toBe(true);
        expect(permissions['route.(expenses-encoder)']).toBe(true);
        expect(permissions['route.(admin)']).toBe(false);
    });

    it('updates feature and role toggles through the service maps', async () => {
        await service.ensureDefaults();

        const feature = (await service.getFeatureFlags()).find(flag => flag.key === 'module.accounting');
        const permission = (await service.getRolePermissions()).find(item => (
            item.role === 'expenses_encoder' && item.permissionKey === 'route.(expenses-encoder)'
        ));

        expect(feature).toBeTruthy();
        expect(permission).toBeTruthy();

        await service.setFeatureEnabled(feature!, false);
        await service.setRolePermissionEnabled(permission!, false);

        await expect(service.isFeatureEnabled('module.accounting')).resolves.toBe(false);
        await expect(service.isRolePermissionEnabled('expenses_encoder', 'route.(expenses-encoder)')).resolves.toBe(false);
    });

    it('treats an unseeded key as off unless this build ships it', async () => {
        await service.ensureDefaults();

        // A feature_flags row left over from a pre-teardown database, or a plain typo, must not
        // resolve to enabled - that was the fail-open default on main.
        await expect(service.isFeatureEnabled('module.loans')).resolves.toBe(false);
        await expect(service.isFeatureEnabled('module.bananas')).resolves.toBe(false);
        expect(await service.isFeatureEnabled('module.accounting')).toBe(true);
        // The explicit fallback still overrides, for callers that want fail-open.
        await expect(service.isFeatureEnabled('module.loans', true)).resolves.toBe(true);
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
