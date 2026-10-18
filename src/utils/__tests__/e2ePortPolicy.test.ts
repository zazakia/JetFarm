import {
    DEFAULT_E2E_PORT,
    LEGACY_SHARED_E2E_PORT,
    isDedicatedE2EPort,
    portOf,
} from '../e2ePortPolicy';

/**
 * The mapping specs used to pin baseURL to one literal port (19129). That could
 * never be satisfied by the systematic-test-matrix runner, which allocates a
 * dynamic free port, so the specs failed under every automated entry point while
 * passing only for a developer who happened to export the right variable.
 *
 * The real hazard the pin was reaching for is `reuseExistingServer: !CI` handing a
 * spec the stale bundle left on the legacy shared port. Refusing that port
 * expresses the intent without breaking dynamic allocation.
 */
describe('E2E port policy', () => {
    it('refuses the legacy shared port, which is the one prone to a stale reused server', () => {
        expect(isDedicatedE2EPort(`http://127.0.0.1:${LEGACY_SHARED_E2E_PORT}`)).toBe(false);
    });

    it('accepts the default dedicated port', () => {
        expect(isDedicatedE2EPort(`http://127.0.0.1:${DEFAULT_E2E_PORT}`)).toBe(true);
        expect(DEFAULT_E2E_PORT).toBe('19129');
    });

    it('accepts a dynamically allocated port so the matrix runner keeps working', () => {
        expect(isDedicatedE2EPort('http://127.0.0.1:19009')).toBe(true);
        expect(isDedicatedE2EPort('http://127.0.0.1:52341')).toBe(true);
    });

    it('rejects a missing or malformed baseURL instead of passing vacuously', () => {
        expect(isDedicatedE2EPort(undefined)).toBe(false);
        expect(isDedicatedE2EPort('')).toBe(false);
        expect(isDedicatedE2EPort('not a url')).toBe(false);
        expect(isDedicatedE2EPort('http://127.0.0.1')).toBe(false);
    });

    it('extracts the port without treating a path segment as one', () => {
        expect(portOf('http://127.0.0.1:19129')).toBe('19129');
        expect(portOf('http://127.0.0.1:19129/agribusiness/mapping')).toBe('19129');
        expect(portOf('http://localhost:19119')).toBe('19119');
        expect(portOf('http://127.0.0.1')).toBe('');
        expect(portOf(undefined)).toBe('');
    });
});
