import { getFeatureKeyForRoute } from '../featureFlags';
import { DEFAULT_FEATURE_FLAGS } from '../../constants/configDefaults';

describe('getFeatureKeyForRoute', () => {
    it('returns null for un-gated routes', () => {
        expect(getFeatureKeyForRoute('/(admin)')).toBeNull();
        expect(getFeatureKeyForRoute('/(admin)/')).toBeNull();
        expect(getFeatureKeyForRoute('/(admin)/users')).toBeNull();
        expect(getFeatureKeyForRoute('/(admin)/settings')).toBeNull();
        expect(getFeatureKeyForRoute('/(admin)/settings/feature-flags')).toBeNull();
    });

    it('maps core module routes to their feature flags', () => {
        expect(getFeatureKeyForRoute('/(admin)/borrowers')?.featureKey).toBe('module.borrowers');
        expect(getFeatureKeyForRoute('/(admin)/borrowers/create')?.featureKey).toBe('module.borrowers');
        expect(getFeatureKeyForRoute('/(admin)/loans')?.featureKey).toBe('module.loans');
        expect(getFeatureKeyForRoute('/(admin)/payments')?.featureKey).toBe('module.payments');
        expect(getFeatureKeyForRoute('/(admin)/expenses')?.featureKey).toBe('module.expenses');
        expect(getFeatureKeyForRoute('/(admin)/payroll')?.featureKey).toBe('module.payroll');
        expect(getFeatureKeyForRoute('/(admin)/accounting')?.featureKey).toBe('module.accounting');
        expect(getFeatureKeyForRoute('/accounting/crj')?.featureKey).toBe('module.accounting');
        expect(getFeatureKeyForRoute('/(admin)/accounting/suppliers')?.featureKey).toBe('module.accounting');
    });

    // The coop business-unit module framework (Water Station / Agri-Store / Pharmacy /
    // Transport consoles) and the marketplace are physically removed on this branch, so
    // their routes carry no feature gate any more. Guard against re-introducing the mapping.
    it('gates no retired module or marketplace route', () => {
        expect(getFeatureKeyForRoute('/(admin)/modules')).toBeNull();
        expect(getFeatureKeyForRoute('/(admin)/modules/agri-store')).toBeNull();
        expect(getFeatureKeyForRoute('/(admin)/modules/water-station')).toBeNull();
        expect(getFeatureKeyForRoute('/(admin)/marketplace')).toBeNull();
        const keys = DEFAULT_FEATURE_FLAGS.map(f => f.key);
        expect(keys).not.toContain('feature.modules.water_station.enabled');
        expect(keys).not.toContain('feature.modules.agri_store.enabled');
        expect(keys).not.toContain('feature.modules.pharmacy.enabled');
        expect(keys).not.toContain('feature.modules.transport.enabled');
    });
});

describe('default feature flag posture', () => {
    // Guard: loan management ships dark. If someone flips the master switch back on,
    // every lending E2E spec and the FeatureDisabledNotice coverage needs revisiting.
    it('ships the system.lending master switch disabled', () => {
        const lending = DEFAULT_FEATURE_FLAGS.find(f => f.key === 'system.lending');
        expect(lending).toBeDefined();
        expect(lending!.enabled).toBe(false);
    });

    it('keeps non-lending modules enabled by default', () => {
        const enabledKeys = DEFAULT_FEATURE_FLAGS.filter(f => f.enabled).map(f => f.key);
        expect(enabledKeys).toContain('module.accounting');
        expect(enabledKeys).toContain('module.reports');
        expect(enabledKeys).not.toContain('system.lending');
        expect(enabledKeys).not.toContain('module.file_cases');
    });
});
