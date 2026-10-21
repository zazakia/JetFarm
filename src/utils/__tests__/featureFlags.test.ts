import { AGRIBUSINESS_FEATURE_KEYS, ROUTE_FEATURE_MAPPINGS, getFeatureKeyForRoute, isAgribusinessFeatureKey } from '../featureFlags';
import { DEFAULT_FEATURE_FLAGS } from '../../constants/configDefaults';

describe('getFeatureKeyForRoute', () => {
    it('returns null for un-gated routes', () => {
        expect(getFeatureKeyForRoute('/(admin)')).toBeNull();
        expect(getFeatureKeyForRoute('/(admin)/')).toBeNull();
        expect(getFeatureKeyForRoute('/(admin)/users')).toBeNull();
        expect(getFeatureKeyForRoute('/(admin)/settings')).toBeNull();
        expect(getFeatureKeyForRoute('/(admin)/settings/feature-flags')).toBeNull();
        expect(getFeatureKeyForRoute('/(admin)/agribusiness/parcels')).toBeNull();
    });

    it('maps the surviving finance routes to their feature flags', () => {
        expect(getFeatureKeyForRoute('/(admin)/expenses')?.featureKey).toBe('module.expenses');
        expect(getFeatureKeyForRoute('/(admin)/accounting')?.featureKey).toBe('module.accounting');
        expect(getFeatureKeyForRoute('/accounting/crj')?.featureKey).toBe('module.accounting');
        expect(getFeatureKeyForRoute('/(admin)/accounting/suppliers')?.featureKey).toBe('module.accounting');
        expect(getFeatureKeyForRoute('/(admin)/reports/balance-sheet')?.featureKey).toBe('module.reports');
        expect(getFeatureKeyForRoute('/(admin)/cash-on-hand')?.featureKey).toBe('module.cash_on_hand');
        expect(getFeatureKeyForRoute('/(admin)/bank-accounts')?.featureKey).toBe('module.bank_accounts');
    });

    // The lending, module and marketplace screens are physically deleted on this branch. A mapping
    // that survives its route is a gate on nothing, so these assert the absence rather than the
    // FeatureDisabledNotice behaviour the main-branch version of this file checked.
    it('gates no retired lending, module or marketplace route', () => {
        for (const retired of [
            '/(admin)/borrowers',
            '/(admin)/loans',
            '/(admin)/payments',
            '/(admin)/payroll',
            '/(admin)/collectors',
            '/(admin)/file-cases',
            '/(admin)/cic',
            '/(admin)/modules',
            '/(admin)/modules/water-station',
            '/(admin)/marketplace',
        ]) {
            expect(getFeatureKeyForRoute(retired)).toBeNull();
        }
    });
});

describe('agribusiness feature flag posture', () => {
    it('ships exactly the flags whose route groups still exist', () => {
        expect(DEFAULT_FEATURE_FLAGS.map(f => f.key).sort()).toEqual([
            'module.accounting',
            'module.bank_accounts',
            'module.cash_on_hand',
            'module.expenses',
            'module.reports',
        ]);
    });

    it('has no lending master switch and no retired module key', () => {
        const keys = DEFAULT_FEATURE_FLAGS.map(f => f.key);
        for (const retired of ['system.lending', 'module.borrowers', 'module.loans', 'module.payments',
            'module.remittances', 'module.file_cases', 'module.savings', 'module.payroll',
            'module.employees', 'module.business_modules', 'module.marketplace', 'module.cic']) {
            expect(keys).not.toContain(retired as never);
            expect(isAgribusinessFeatureKey(retired)).toBe(false);
        }
        // Deleting the switch is what makes the fail-open isEnabled on main harmless here: nothing
        // can re-enable a lending flag this build has no screen for.
        expect(AGRIBUSINESS_FEATURE_KEYS).not.toContain('system.lending' as never);
    });

    it('ships every flag enabled and gates nothing dark', () => {
        expect(DEFAULT_FEATURE_FLAGS.filter(f => !f.enabled)).toEqual([]);
    });

    it('only maps routes to allowlisted keys', () => {
        const offList = ROUTE_FEATURE_MAPPINGS
            .map(m => m.featureKey)
            .filter(key => !isAgribusinessFeatureKey(key));
        expect(offList).toEqual([]);
    });
});
