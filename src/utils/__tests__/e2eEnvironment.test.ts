import { isLocalWebE2E } from '../e2eEnvironment';

describe('isLocalWebE2E', () => {
    const originalEnv = process.env.EXPO_PUBLIC_E2E_MODE;
    const originalWindow = (globalThis as any).window;

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.EXPO_PUBLIC_E2E_MODE;
        } else {
            process.env.EXPO_PUBLIC_E2E_MODE = originalEnv;
        }
        (globalThis as any).window = originalWindow;
    });

    it('returns true when EXPO_PUBLIC_E2E_MODE is enabled', () => {
        process.env.EXPO_PUBLIC_E2E_MODE = '1';
        (globalThis as any).window = undefined;
        expect(isLocalWebE2E()).toBe(true);
    });

    it('returns true for localhost Playwright default port 19119', () => {
        delete process.env.EXPO_PUBLIC_E2E_MODE;
        (globalThis as any).window = {
            location: { hostname: '127.0.0.1', port: '19119' },
        };
        expect(isLocalWebE2E()).toBe(true);
    });

    it('returns false for unrelated localhost ports without E2E mode', () => {
        delete process.env.EXPO_PUBLIC_E2E_MODE;
        (globalThis as any).window = {
            location: { hostname: '127.0.0.1', port: '3000' },
        };
        expect(isLocalWebE2E()).toBe(false);
    });
});
