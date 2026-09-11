import {
    getDeploymentMode,
    isCrispyKing,
    isCooperative,
    setDeploymentMode,
    resetDeploymentMode,
    DeploymentMode,
} from '../deployment';

describe('deployment config', () => {
    const originalEnv = process.env.EXPO_PUBLIC_DEPLOYMENT_MODE;

    beforeEach(() => {
        resetDeploymentMode();
        delete process.env.EXPO_PUBLIC_DEPLOYMENT_MODE;
    });

    afterEach(() => {
        resetDeploymentMode();
        if (originalEnv !== undefined) {
            process.env.EXPO_PUBLIC_DEPLOYMENT_MODE = originalEnv;
        } else {
            delete process.env.EXPO_PUBLIC_DEPLOYMENT_MODE;
        }
    });

    it('defaults to crispy-king when environment variable is not set', () => {
        expect(getDeploymentMode()).toBe('crispy-king');
        expect(isCrispyKing()).toBe(true);
        expect(isCooperative()).toBe(false);
    });

    it('reads cooperative mode from environment variable', () => {
        process.env.EXPO_PUBLIC_DEPLOYMENT_MODE = 'cooperative';
        expect(getDeploymentMode()).toBe('cooperative');
        expect(isCooperative()).toBe(true);
        expect(isCrispyKing()).toBe(false);
    });

    it('reads crispy-king mode explicitly from environment variable', () => {
        process.env.EXPO_PUBLIC_DEPLOYMENT_MODE = 'crispy-king';
        expect(getDeploymentMode()).toBe('crispy-king');
        expect(isCrispyKing()).toBe(true);
        expect(isCooperative()).toBe(false);
    });

    it('allows runtime override using setDeploymentMode', () => {
        setDeploymentMode('cooperative');
        expect(getDeploymentMode()).toBe('cooperative');
        expect(isCooperative()).toBe(true);
        expect(isCrispyKing()).toBe(false);

        setDeploymentMode('crispy-king');
        expect(getDeploymentMode()).toBe('crispy-king');
        expect(isCrispyKing()).toBe(true);
        expect(isCooperative()).toBe(false);
    });

    it('resets runtime override using resetDeploymentMode', () => {
        setDeploymentMode('cooperative');
        expect(getDeploymentMode()).toBe('cooperative');

        resetDeploymentMode();
        expect(getDeploymentMode()).toBe('crispy-king');
    });
});
