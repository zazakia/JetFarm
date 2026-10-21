import {
    getDeploymentMode,
    isAgri,
    isCrispyKing,
    isCooperative,
    setDeploymentMode,
    resetDeploymentMode,
} from '../deployment';

// Agribusiness-only variant. The mode used to default to 'crispy-king', which on this branch means
// "the QSR POS build" - a build whose screens no longer exist. The fallback is now 'agri' so a
// fresh clone, a Jest run and an export with no EXPO_PUBLIC_BUSINESS_TYPE all resolve to the one
// product this branch ships. The other modes stay readable so an operator can spot a stale
// production env value instead of silently getting agribusiness behaviour from a POS config.
describe('deployment config', () => {
    const originalType = process.env.EXPO_PUBLIC_BUSINESS_TYPE;
    const originalMode = process.env.EXPO_PUBLIC_DEPLOYMENT_MODE;

    beforeEach(() => {
        resetDeploymentMode();
        delete process.env.EXPO_PUBLIC_BUSINESS_TYPE;
        delete process.env.EXPO_PUBLIC_DEPLOYMENT_MODE;
    });

    afterEach(() => {
        resetDeploymentMode();
        for (const [name, value] of [
            ['EXPO_PUBLIC_BUSINESS_TYPE', originalType],
            ['EXPO_PUBLIC_DEPLOYMENT_MODE', originalMode],
        ] as const) {
            if (value !== undefined) {
                process.env[name] = value;
            } else {
                delete process.env[name];
            }
        }
    });

    it('defaults to agri when neither environment variable is set', () => {
        expect(getDeploymentMode()).toBe('agri');
        expect(isAgri()).toBe(true);
        expect(isCrispyKing()).toBe(false);
        expect(isCooperative()).toBe(false);
    });

    it('reads agribusiness from EXPO_PUBLIC_BUSINESS_TYPE, the documented build selector', () => {
        process.env.EXPO_PUBLIC_BUSINESS_TYPE = 'agribusiness';
        expect(getDeploymentMode()).toBe('agri');
        expect(isAgri()).toBe(true);
    });

    it('does not silently treat a stale POS or cooperative env as agribusiness', () => {
        process.env.EXPO_PUBLIC_BUSINESS_TYPE = 'crispy-king';
        expect(getDeploymentMode()).toBe('crispy-king');
        expect(isAgri()).toBe(false);
        expect(isCrispyKing()).toBe(true);

        process.env.EXPO_PUBLIC_BUSINESS_TYPE = 'coop';
        expect(getDeploymentMode()).toBe('cooperative');
        expect(isCooperative()).toBe(true);
    });

    it('prefers EXPO_PUBLIC_BUSINESS_TYPE over the legacy deployment-mode name', () => {
        process.env.EXPO_PUBLIC_BUSINESS_TYPE = 'agri';
        process.env.EXPO_PUBLIC_DEPLOYMENT_MODE = 'crispy-king';
        expect(getDeploymentMode()).toBe('agri');
    });

    it('trims and lower-cases the environment value', () => {
        process.env.EXPO_PUBLIC_BUSINESS_TYPE = '  AGRIBUSINESS  ';
        expect(getDeploymentMode()).toBe('agri');
    });

    it('allows runtime override using setDeploymentMode', () => {
        setDeploymentMode('cooperative');
        expect(getDeploymentMode()).toBe('cooperative');
        expect(isCooperative()).toBe(true);
        expect(isAgri()).toBe(false);

        setDeploymentMode('agri');
        expect(getDeploymentMode()).toBe('agri');
        expect(isAgri()).toBe(true);
    });

    it('resets runtime override back to the agribusiness fallback', () => {
        setDeploymentMode('cooperative');
        expect(getDeploymentMode()).toBe('cooperative');

        resetDeploymentMode();
        expect(getDeploymentMode()).toBe('agri');
    });
});
