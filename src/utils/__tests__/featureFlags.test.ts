import { getFeatureKeyForRoute } from '../featureFlags';

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
        expect(getFeatureKeyForRoute('/(admin)/marketplace')?.featureKey).toBe('module.marketplace');
        expect(getFeatureKeyForRoute('/(admin)/accounting')?.featureKey).toBe('module.accounting');
        expect(getFeatureKeyForRoute('/accounting/crj')?.featureKey).toBe('module.accounting');
        expect(getFeatureKeyForRoute('/(admin)/accounting/suppliers')?.featureKey).toBe('module.accounting');
    });

    it('maps business units and sub-modules properly', () => {
        expect(getFeatureKeyForRoute('/(admin)/modules')?.featureKey).toBe('module.business_modules');
        expect(getFeatureKeyForRoute('/(admin)/modules/water-station')?.featureKey).toBe('feature.modules.water_station.enabled');
        expect(getFeatureKeyForRoute('/(admin)/modules/agri-store')?.featureKey).toBe('feature.modules.agri_store.enabled');
        expect(getFeatureKeyForRoute('/(admin)/modules/pharmacy')?.featureKey).toBe('feature.modules.pharmacy.enabled');
        expect(getFeatureKeyForRoute('/(admin)/modules/transport')?.featureKey).toBe('feature.modules.transport.enabled');
    });
});
